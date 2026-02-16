import { BaseRegister, MonitoredRegister } from '../solis';
import { MySolisBaseDevice } from '../basedevice';
import { HelperService } from '../../helper';
import { acquireConnection, releaseConnection } from '../connection-manager';

export default class SolisInverterDevice extends MySolisBaseDevice {

  private getConnectionSettings() {
    return {
      address: this.homey.settings.get('address') as string,
      port: this.homey.settings.get('port') as number,
      unitId: this.homey.settings.get('inverterid') as number ?? 1,
    };
  }

  registers(): Record<string, MonitoredRegister<BaseRegister>> {
    return {
      ...this.inverterRegisters,
      ...this.meterRegisters,
    };
  }

  async startPolling() {
    this.log('startPolling (solisinverter)');

    const { address, port, unitId } = this.getConnectionSettings();
    this.log(`Connection settings: ${address}:${port} unit ${unitId}`);

    if (!address || !port) {
      this.log('=== No connection settings configured. Please configure in app settings.');
      return;
    }

    // Build register map with capability remapping:
    // - PV_POWER → measure_power (primary power for this device)
    // - ACTIVE_POWER → measure_power.active (inverter AC output)
    // - Remove PASSIVE_MODE (battery device handles it)
    const { PASSIVE_MODE, PV_POWER, ACTIVE_POWER, ...restInverterRegisters } = this.inverterRegisters;

    const registers: Record<string, MonitoredRegister<BaseRegister>> = {
      ...restInverterRegisters,
      ...this.meterRegisters,
      PV_POWER: {
        ...PV_POWER,
        reg: { ...PV_POWER.reg, capability: 'measure_power' },
      },
      ACTIVE_POWER: {
        ...ACTIVE_POWER,
        reg: { ...ACTIVE_POWER.reg, capability: 'measure_power.active' },
      },
    };

    const { socket, client } = acquireConnection(address, port, unitId, this.log.bind(this));

    this.registerListeners(client, registers);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    socket.on('connect', async () => {
      this.log('=== Connected!');
      await HelperService.delay(2500);

      this.active = true;
      this.poll(client, registers, () => this.active);
    });
  }

  async onUninit(): Promise<void> {
    this.log('SolisInverterDevice onUninit');
    this.active = false;
    const { address, port, unitId } = this.getConnectionSettings();
    if (address && port) {
      releaseConnection(address, port, unitId, this.log.bind(this));
    }
  }

  async onDeleted() {
    this.log('SolisInverterDevice has been deleted');
    this.isPolling = false;
    this.active = false;
    const { address, port, unitId } = this.getConnectionSettings();
    if (address && port) {
      releaseConnection(address, port, unitId, this.log.bind(this));
    }
  }
}

module.exports = SolisInverterDevice;
