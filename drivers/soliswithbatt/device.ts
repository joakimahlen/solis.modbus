import * as Modbus from 'jsmodbus';

import Homey from 'homey';
import net from 'net';
import { HelperService } from '../../helper';
import { Solis } from '../solis';
import { checkSolisRegisters } from '../response';

const RETRY_INTERVAL = 120 * 1000;

class MySolisDeviceBattery extends Solis {
  timer!: NodeJS.Timer;
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('MySolisDeviceBattery has been initialized');

    const name = this.getData().id;
    this.log(`device name id ${name}`);
    this.log(`device name ${this.getName()}`);

    this.pollInverter();

    this.timer = this.homey.setInterval(() => {
      // poll device state from inverter
      this.pollInverter();
    }, RETRY_INTERVAL);

    // homey menu / device actions
    this.registerCapabilityListener('storage_control_mode', async (value) => {
      this.updateControl('storage_control_mode', Number(value), this);
      return value;
    });

    this.registerCapabilityListener('storage_working_mode', async (value) => {
      this.updateControl('storage_working_mode', Number(value), this);
      return value;
    });

    const changedStorageWorkingmode = this.homey.flow.getConditionCard('changedstorage_working_mode');
    changedStorageWorkingmode.registerRunListener(async (args, state) => {
      this.log(`changedstorage_working_mode  storage_working_mode_main ${args.device.getCapabilityValue('storage_working_mode_main')}`);
      this.log(`changedstorage_working_mode  argument_main ${args.argument_main}`);
      const result = (await args.device.getCapabilityValue('storage_working_mode_main')) === args.argument_main;
      return Promise.resolve(result);
    });

    const changedStorageControlmode = this.homey.flow.getConditionCard('changedstorage_control_mode');
    changedStorageControlmode.registerRunListener(async (args, state) => {
      this.log(`changedstorage_control_mode  storage_control_mode_main ${args.device.getCapabilityValue('storage_control_mode_main')}`);
      this.log(`changedstorage_control_mode  argument_main ${args.argument_main}`);
      const result = (await args.device.getCapabilityValue('storage_control_mode_main')) === args.argument_main;
      return Promise.resolve(result);
    });

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
    this.homey.clearInterval(this.timer);
  }

  async updateControl(type: string, value: number, device: Homey.Device) {
    const socket = new net.Socket();
    const unitID = device.getSetting('id');

    const client = new Modbus.client.TCP(socket, unitID, 5500);

    const modbusOptions = {
      host: this.getSetting('address'),
      port: this.getSetting('port'),
      unitId: this.getSetting('id'),
      timeout: 500,
      autoReconnect: false,
      logLabel: 'solis Inverter Battery',
      logLevel: 'debug',
      logEnabled: true,
    };

    socket.setKeepAlive(false);
    socket.connect(modbusOptions);
    console.log(modbusOptions);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    socket.on('connect', async () => {
      console.log('Connected ...');

      if (type === 'storage_control_mode') {
        //        const storageForceRes = await client.writeSingleRegister(47100, value);
        const storageForceRes = 'FAKE';
        console.log('storage_control_mode', storageForceRes);
      }

      if (type === 'storage_working_mode') {
        //        const storageworkingmodesettingsRes = await client.writeSingleRegister(47086, value);
        const storageworkingmodesettingsRes = 'FAKE';
        console.log('storage_working_mode', storageworkingmodesettingsRes);
      }

      console.log('disconnect');
      client.socket.end();
      socket.end();
    });

    socket.on('close', () => {
      console.log('Client closed');
    });

    socket.on('error', (err) => {
      console.log(err);
      socket.end();
      setTimeout(() => socket.connect(modbusOptions), 4000);
    });
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
      logLabel: 'solis Inverter Battery',
      logLevel: 'debug',
      logEnabled: true,
    };

    const socket = new net.Socket();
    const unitID = this.getSetting('id');
    const client = new Modbus.client.TCP(socket, unitID, 5500);
    socket.setKeepAlive(false);
    socket.connect(modbusOptions);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    socket.on('connect', async () => {
      this.log('Connected ...');
      this.log(modbusOptions);
      const startTime = new Date();
      await HelperService.delay(5000);

      const registers = { ...this.inverterRegisters, ...this.batteryRegisters, ...this.meterRegisters };

      const capabilities = Object.values(registers)
        .filter((reg) => reg.capability !== undefined)
        .map((reg) => reg.capability!);

      console.log('==== Adding capabilities...');
      await this.addCapabilities(capabilities);

      const results = await checkSolisRegisters(registers, client);

      console.log('==== Setting capability values...');
      await this.setCapabilityValues(results);
      console.log('==== Values set!');

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

module.exports = MySolisDeviceBattery;
