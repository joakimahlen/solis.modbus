import * as Modbus from 'jsmodbus';

import net from 'net';
import { HelperService } from '../../helper';
import { Solis } from '../solis';
import { checkSolisRegisters } from '../response';

const RETRY_INTERVAL = 32 * 1000;

class MySolisDevice extends Solis {
  timer!: NodeJS.Timer;
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('MySolisDevice has been initialized');

    const name = this.getData().id;
    this.log(`device name id ${name}`);
    this.log(`device name ${this.getName()}`);

    this.pollInverter();

    this.timer = this.homey.setInterval(() => {
      // poll device state from inverter
      this.pollInverter();
    }, RETRY_INTERVAL);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MySolisDevice has been added');
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
    this.log('MySolisDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('MySolisDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MySolisDevice has been deleted');
    this.homey.clearInterval(this.timer);
  }

  async pollInverter() {
    this.log('pollInverter');
    this.log(this.getSetting('address'));

    const modbusOptions = {
      host: this.getSetting('address'),
      port: this.getSetting('port'),
      unitId: this.getSetting('id'),
      timeout: 500,
      autoReconnect: false,
      logLabel: 'solis Inverter',
      logLevel: 'debug',
      logEnabled: true,
    };

    const socket = new net.Socket();
    const unitID = this.getSetting('id');
    const client = new Modbus.client.TCP(socket, unitID, 3500);
    socket.setKeepAlive(false);
    socket.connect(modbusOptions);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    socket.on('connect', async () => {
      this.log('Connected ...');
      this.log(modbusOptions);
      const startTime = new Date();
      await HelperService.delay(5000);

      const capabilities = Object.values(this.inverterRegisters)
        .filter((reg) => reg.capability !== undefined)
        .map((reg) => reg.capability!);

      console.log('==== Adding capabilities...');
      await this.addCapabilities(capabilities);

      const results = await checkSolisRegisters(this.inverterRegisters, client);

      await this.setCapabilityValues(results);

      this.log('disconnect');
      client.socket.end();
      socket.end();
      const endTime = new Date();
      const timeDiff = endTime.getTime() - startTime.getTime();
      const seconds = Math.floor(timeDiff / 1000);
      this.log(`total time: ${seconds} seconds`);
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

module.exports = MySolisDevice;
