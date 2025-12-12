import * as Modbus from 'jsmodbus';

import { MonitoredRegister, Solis } from './solis';

import { HelperService } from '../helper';
import net from 'net';

export abstract class MySolisBaseDevice extends Solis {
  active = true;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    const name = this.getData().id;
    this.log(`device name id ${name}`);
    this.log(`device name ${this.getName()}`);

    this.startPolling();
  }

  abstract registers(): Record<string, MonitoredRegister>;

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
    this.active = false;
  }

  async startPolling() {
    this.log('startPolling');
    this.log(this.getSetting('address'));

    const modbusOptions = {
      host: this.getSetting('address'),
      port: this.getSetting('port'),
      unitId: this.getSetting('id'),
      timeout: 500,
      autoReconnect: false,
      logLabel: 'Solis Inverter Battery',
      logLevel: 'debug',
      logEnabled: true,
    };

    const socket = new net.Socket();
    const unitID = this.getSetting('id');
    const client = new Modbus.client.TCP(socket, unitID, 5500);
    socket.setKeepAlive(true);
    socket.connect(modbusOptions);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    socket.on('connect', async () => {
      this.log('Connected ...');
      this.log(modbusOptions);
      await HelperService.delay(2500);
      this.registerListeners(client);

      const registers = {
        ...this.inverterRegisters,
        ...this.batteryRegisters,
        ...this.meterRegisters,
      };

      this.poll(client, registers, () => this.active);
    });

    socket.on('close', () => {
      this.log('Client closed');
    });

    socket.on('timeout', () => {
      this.log('socket timed out!');
      client.socket.end();
      socket.end();
    });

    socket.on('error', (err) => {
      this.log(err);
      client.socket.end();
      socket.end();
    });
  }
}
