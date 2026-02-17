import { BaseRegister, MonitoredRegister } from '../solis';
import { MySolisBaseDevice } from '../basedevice';
import { HelperService } from '../../helper';
import { acquireConnection, ConnectionHandle } from '../connection-manager';

export default class SolisInverterDevice extends MySolisBaseDevice {

  private connectionHandle?: ConnectionHandle;

  protected hasBatteryControl(): boolean {
    return false;
  }

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
      this.log('=== No connection settings configured. Waiting for app settings...');
      this.homey.settings.on('set', (key: string) => {
        if (key === 'address' || key === 'port') {
          const settings = this.getConnectionSettings();
          if (settings.address && settings.port) {
            this.log('=== App settings configured, starting polling...');
            this.startPolling();
          }
        }
      });
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

    this.connectionHandle = acquireConnection(address, port, unitId, this.log.bind(this));
    const { client } = this.connectionHandle;

    this.registerListeners(client, registers);

    this.connectionHandle.onConnect(async () => {
      this.log('=== Connected!');
      await HelperService.delay(2500);
      this.active = true;
      this.poll(client, registers, () => this.active);
    });
  }

  async onUninit(): Promise<void> {
    this.log('SolisInverterDevice onUninit');
    this.active = false;
    this.connectionHandle?.release();
  }

  async onDeleted() {
    this.log('SolisInverterDevice has been deleted');
    this.isPolling = false;
    this.active = false;
    this.connectionHandle?.release();
  }
}

module.exports = SolisInverterDevice;
