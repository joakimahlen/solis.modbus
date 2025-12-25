import * as Modbus from 'jsmodbus';

import net from 'net';
import { BaseRegister, MonitoredRegister, Solis } from './solis';

import { HelperService } from '../helper';

export abstract class MySolisBaseDevice extends Solis {
  active = true;
  socket = new net.Socket();
  unitID = this.getSetting('id');
  client = new Modbus.client.TCP(this.socket, this.unitID, 5000);
  connectionOptions: net.SocketConnectOpts = {
    host: this.getSetting('address'),
    port: this.getSetting('port'),
    keepAlive: true,
  };

  /**
  * onInit is called when the device is initialized.
  */
  async onInit() {
    await super.onInit();
    const name = this.getData().id;
    this.log(`device name id ${name}`);
    this.log(`device name ${this.getName()}`);

    this.startPolling();
  }

  abstract registers(): Record<string, MonitoredRegister<BaseRegister>>;

  async onUninit(): Promise<void> {
    this.log('MySolisDeviceBattery onUninit');
    this.active = false;
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MySolisDeviceBattery has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings: { }, newSettings: { }, changedKeys: { } }): Promise<string | void> {
    this.log('MySolisDeviceBattery settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('MySolisDeviceBattery was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MySolisDeviceBattery has been deleted');
    this.isPolling = false;
    this.active = false;
  }

  async startPolling() {
    this.log('startPolling');
    this.log(this.getSetting('address'));

    const registers = {
      ...this.inverterRegisters,
      ...this.batteryRegisters,
      ...this.meterRegisters,
    };

    this.connect();
    this.registerListeners(this.client, registers);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.socket.on('connect', async () => {
      this.log('=== Connected!');
      await HelperService.delay(2500);

      this.active = true;
      this.poll(this.client, registers, () => this.active);
    });

    this.socket.on('close', () => {
      this.log('=== Client closed. Reconnecting in 5s...');
      setTimeout(this.connect.bind(this), 5000);
    });

    this.socket.on('timeout', () => {
      this.log('=== Socket timed out!');
      this.client.socket.end();
      this.socket.end();
    });

    this.socket.on('error', (err) => {
      this.log('=== Socket error', err);
      this.client.socket.end();
      this.socket.end();
    });
  }

  connect() {
    this.socket.setKeepAlive(true);
    this.active = false;

    this.log('=== Connecting...', this.connectionOptions);
    this.socket.connect(this.connectionOptions);
  }
}
