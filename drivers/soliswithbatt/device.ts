import { BaseRegister, MonitoredRegister } from '../solis';
import { MySolisBaseDevice } from '../basedevice';
import { HelperService } from '../../helper';
import { acquireConnection, ConnectionHandle } from '../connection-manager';

export default class MySolisBatteryDevice extends MySolisBaseDevice {

  private connectionHandle?: ConnectionHandle;

  protected hasBatteryControl(): boolean {
    return false;
  }

  private getConnectionSettings() {
    return {
      address: this.homey.settings.get('address') as string ?? this.getSetting('address') as string,
      port: this.homey.settings.get('port') as number ?? this.getSetting('port') as number,
      unitId: this.homey.settings.get('inverterid') as number ?? this.getSetting('id') as number ?? 1,
    };
  }

  registers(): Record<string, MonitoredRegister<BaseRegister>> {
    return {
      ...this.inverterRegisters,
      ...this.batteryRegisters,
      ...this.meterRegisters,
    };
  }

  async startPolling() {
    this.log('startPolling (soliswithbatt)');

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

    const registers: Record<string, MonitoredRegister<BaseRegister>> = {
      ...this.inverterRegisters,
      ...this.batteryRegisters,
      ...this.meterRegisters,
    };

    this.connectionHandle = acquireConnection(address, port, unitId, this.log.bind(this));
    const { client } = this.connectionHandle;

    this.registerListeners(client, registers);

    this.connectionHandle.onConnect(async () => {
      this.log('=== Connected! Delaying poll start by 15s to stagger with other devices');
      await HelperService.delay(15000);
      this.active = true;
      this.poll(client, registers, () => this.active);
    });
  }

  async onUninit(): Promise<void> {
    this.log('MySolisBatteryDevice onUninit');
    this.active = false;
    this.connectionHandle?.release();
  }

  async onDeleted() {
    this.log('MySolisBatteryDevice has been deleted');
    this.isPolling = false;
    this.active = false;
    this.connectionHandle?.release();
  }
}

module.exports = MySolisBatteryDevice;
