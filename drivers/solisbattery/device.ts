import { BaseRegister, MonitoredRegister, PollRate } from '../solis';
import { MySolisBaseDevice } from '../basedevice';
import { HelperService } from '../../helper';
import { acquireConnection, ConnectionHandle } from '../connection-manager';

import { filter, isNumber, min, values } from 'lodash';

export default class SolisBatteryDevice extends MySolisBaseDevice {

  private connectionHandle?: ConnectionHandle;

  private getConnectionSettings() {
    const settings = this.getSettings();
    return {
      address: settings.address as string,
      port: settings.port as number,
      unitId: (settings.inverterid as number) ?? 1,
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
      this.log('=== No connection settings configured on device. Please configure in device settings.');
      await this.setUnavailable('Please configure IP address and port in device settings.');
      return;
    }

    await this.setAvailable();

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

    this.connectionHandle = acquireConnection(address, port, unitId, this.log.bind(this));
    const { client } = this.connectionHandle;

    this.registerListeners(client, registers);

    const pollingOffset = (min(filter(values(PollRate), isNumber)) || PollRate.PRIO1) / 2;

    this.connectionHandle.onConnect(async () => {
      this.log(`=== Connected! Delaying poll start by ${pollingOffset}s to stagger with inverter device`);
      await HelperService.delay(pollingOffset * 1000);
      this.active = true;
      this.poll(client, registers, () => this.active);
    });
  }

  async onSettings({ changedKeys }: {
    oldSettings: Record<string, unknown>;
    newSettings: Record<string, unknown>;
    changedKeys: string[];
  }): Promise<void> {
    const connectionKeys = ['address', 'port', 'inverterid'];
    if (!changedKeys.some((k) => connectionKeys.includes(k))) {
      return;
    }
    this.log('Connection settings changed, restarting polling');
    this.active = false;
    this.isPolling = false;
    this.connectionHandle?.release();
    this.connectionHandle = undefined;
    setImmediate(() => this.startPolling());
  }

  async onUninit(): Promise<void> {
    this.log('SolisBatteryDevice onUninit');
    this.active = false;
    this.connectionHandle?.release();
  }

  async onDeleted() {
    this.log('SolisBatteryDevice has been deleted');
    this.isPolling = false;
    this.active = false;
    this.connectionHandle?.release();
  }
}

module.exports = SolisBatteryDevice;
