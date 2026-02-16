import { BaseRegister, MonitoredRegister } from '../solis';
import { MySolisBaseDevice } from '../basedevice';
import { HelperService } from '../../helper';
import { acquireConnection, releaseConnection } from '../connection-manager';

export default class SolisBatteryDevice extends MySolisBaseDevice {

  private getConnectionSettings() {
    return {
      address: this.homey.settings.get('address') as string,
      port: this.homey.settings.get('port') as number,
      unitId: this.homey.settings.get('inverterid') as number ?? 1,
    };
  }

  registers(): Record<string, MonitoredRegister<BaseRegister>> {
    return {
      ...this.batteryRegisters,
    };
  }

  async startPolling() {
    this.log('startPolling (solisbattery)');

    const { address, port, unitId } = this.getConnectionSettings();
    this.log(`Connection settings: ${address}:${port} unit ${unitId}`);

    if (!address || !port) {
      this.log('=== No connection settings configured. Please configure in app settings.');
      return;
    }

    // Build register map with capability remapping:
    // - BATTERY_POWER → measure_power (primary power for this device)
    // - Include PASSIVE_MODE from inverterRegisters (needed for mode control display)
    const { BATTERY_POWER, ...restBatteryRegisters } = this.batteryRegisters;

    const registers: Record<string, MonitoredRegister<BaseRegister>> = {
      ...restBatteryRegisters,
      PASSIVE_MODE: this.inverterRegisters.PASSIVE_MODE,
      BATTERY_POWER: {
        ...BATTERY_POWER,
        reg: { ...BATTERY_POWER.reg, capability: 'measure_power' },
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
    this.log('SolisBatteryDevice onUninit');
    this.active = false;
    const { address, port, unitId } = this.getConnectionSettings();
    if (address && port) {
      releaseConnection(address, port, unitId, this.log.bind(this));
    }
  }

  async onDeleted() {
    this.log('SolisBatteryDevice has been deleted');
    this.isPolling = false;
    this.active = false;
    const { address, port, unitId } = this.getConnectionSettings();
    if (address && port) {
      releaseConnection(address, port, unitId, this.log.bind(this));
    }
  }
}

module.exports = SolisBatteryDevice;
