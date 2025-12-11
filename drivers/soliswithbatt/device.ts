import * as Modbus from 'jsmodbus';

import { ForceBatteryChargeDirection, ForceBatteryChargeMode, PassiveMode, Solis, StorageControlMode } from '../solis';

import { HelperService } from '../../helper';
import Homey from 'homey';
import { Measurement } from '../measurement';
import net from 'net';
import { write } from '../response';

const RETRY_INTERVAL = 30 * 1000;

class MySolisDeviceBattery extends Solis {
  timer!: NodeJS.Timer;
  //  timer2!: NodeJS.Timer;
  client?: Modbus.ModbusTCPClient;
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

    /*
    this.timer2 = this.homey.setInterval(() => {
      if (this.client) {
        this.updateSolisRegister('BATTERY_POWER', this.batteryRegisters.BATTERY_POWER, this.client)
          .then()
          .catch((error) => console.error(`Error updating BATTERY_POWER register: ${error.message}`));
        this.updateSolisRegister('METER_POWER', this.meterRegisters.METER_POWER, this.client)
          .then()
          .catch((error) => console.error(`Error updating METER_POWER register: ${error.message}`));
      }
    }, 5000);
    */

    // homey menu / device actions
    this.registerCapabilityListener('storage_control_mode', async (value) => {
      this.updateControl('storage_control_mode', Number(value), this);
      return value;
    });

    this.registerCapabilityListener('storage_working_mode', async (value) => {
      this.updateControl('storage_working_mode', Number(value), this);
      return value;
    });

    this.registerCapabilityListener('force_battery_charge_mode', async (value) => {
      this.updateControl('force_battery_charge_mode', Number(value), this);
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

    const changedForceBatteryCharge = this.homey.flow.getConditionCard('changedforce_battery_charge_mode');
    changedForceBatteryCharge.registerRunListener(async (args, state) => {
      this.log(`changedforce_battery_charge_mode  force_battery_charge_mode_main ${args.device.getCapabilityValue('force_battery_charge_mode_main')}`);
      this.log(`changedforce_battery_charge_mode  argument_main ${args.argument_main}`);
      const result = (await args.device.getCapabilityValue('force_battery_charge_mode_main')) === args.argument_main;
      return Promise.resolve(result);
    });

  }

  async onUninit(): Promise<void> {
    this.log('MySolisDeviceBattery onUninit');
    this.homey.clearInterval(this.timer);
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
      logLabel: 'Solis Inverter Battery',
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
        const storageControlMode: StorageControlMode = value;
        await write(this.batteryRegisters.STORAGE_CONTROL_MODE, client, storageControlMode);
        console.log('storage_working_mode', storageControlMode);
      }

      if (type === 'force_battery_charge_mode') {
        try {
          await write(this.batteryRegisters.FORCE_CHARGE_LIMIT, client, 5000);
          await write(this.batteryRegisters.FORCE_CHARGE_SOURCE, client, 1);

          const chargeMode = value as ForceBatteryChargeMode;

          if (chargeMode === ForceBatteryChargeMode.CHARGE) {
            console.log('= Setting CHARGE mode');
            await write(this.inverterRegisters.PASSIVE_MODE, client, PassiveMode.ON);
            await write(this.batteryRegisters.STORAGE_CONTROL_MODE, client, StorageControlMode.PEAK_SHAVING);
            await write(this.batteryRegisters.FORCE_CHARGE_POWER, client, 5000);
            await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION, client, ForceBatteryChargeDirection.CHARGE);
            await write(this.batteryRegisters.FORCE_DISCHARGE_POWER, client, 0);
          } else if (chargeMode === ForceBatteryChargeMode.DISCHARGE) {
            console.log('= Setting DISCHARGE mode');
            await write(this.inverterRegisters.PASSIVE_MODE, client, PassiveMode.ON);
            await write(this.batteryRegisters.STORAGE_CONTROL_MODE, client, StorageControlMode.PEAK_SHAVING);
            await write(this.batteryRegisters.FORCE_CHARGE_POWER, client, 0);
            await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION, client, ForceBatteryChargeDirection.DISCHARGE);
            await write(this.batteryRegisters.FORCE_DISCHARGE_POWER, client, 5000);
          } else if (chargeMode === ForceBatteryChargeMode.PEAKSHAVING) {
            console.log('= Setting PEAKSHAVING mode');
            await write(this.inverterRegisters.PASSIVE_MODE, client, PassiveMode.ON);
            await write(this.batteryRegisters.STORAGE_CONTROL_MODE, client, StorageControlMode.PEAK_SHAVING);
            await write(this.batteryRegisters.FORCE_CHARGE_POWER, client, 0);
            await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION, client, ForceBatteryChargeDirection.DISCHARGE);
            await write(this.batteryRegisters.FORCE_DISCHARGE_POWER, client, 5000);
          } else if (chargeMode === ForceBatteryChargeMode.IDLE) {
            console.log('= Setting IDLE mode');
            await write(this.inverterRegisters.PASSIVE_MODE, client, PassiveMode.ON);
            await write(this.batteryRegisters.FORCE_CHARGE_POWER, client, 0);
            await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION, client, ForceBatteryChargeDirection.DISCHARGE);
            await write(this.batteryRegisters.FORCE_DISCHARGE_POWER, client, 0);
          } else {
            await write(this.inverterRegisters.PASSIVE_MODE, client, PassiveMode.OFF);
            await write(this.batteryRegisters.STORAGE_CONTROL_MODE, client, StorageControlMode.SELF_USE_MODE | StorageControlMode.ALLOW_GRID_CHARGE);
          }

          await HelperService.delay(2000);

          const storageControlMode = await this.updateSolisRegister('STORAGE_CONTROL_MODE', this.batteryRegisters.STORAGE_CONTROL_MODE, client);
          const storageWorkingMode = await this.updateSolisRegister('STORAGE_WORKING_MODE', this.batteryRegisters.STORAGE_WORKING_MODE, client);
          const peakPower = await this.updateSolisRegister('PEAK_SHAVING_MAX_GRID_POWER', this.inverterRegisters.PEAK_SHAVING_MAX_GRID_POWER, client);
          const forceChargePower = await this.updateSolisRegister('FORCE_CHARGE_POWER', this.batteryRegisters.FORCE_CHARGE_POWER, client);
          const forceChargeDirection = await this.updateSolisRegister('FORCE_CHARGE_DIRECTION', this.batteryRegisters.FORCE_CHARGE_DIRECTION, client);
          const forceDischargePower = await this.updateSolisRegister('FORCE_DISCHARGE_POWER', this.batteryRegisters.FORCE_DISCHARGE_POWER, client);
          const forceChargeSource = await this.updateSolisRegister('FORCE_CHARGE_SOURCE', this.batteryRegisters.FORCE_CHARGE_SOURCE, client);
          const forceChargeLimit = await this.updateSolisRegister('FORCE_CHARGE_LIMIT', this.batteryRegisters.FORCE_CHARGE_LIMIT, client);

          const result = {
            STORAGE_CONTROL_MODE: storageControlMode,
            STORAGE_WORKING_MODE: storageWorkingMode,
            PEAK_SHAVING_MAX_GRID_POWER: peakPower,
            FORCE_CHARGE_POWER: forceChargePower,
            FORCE_CHARGE_DIRECTION: forceChargeDirection,
            FORCE_DISCHARGE_POWER: forceDischargePower,
            FORCE_CHARGE_SOURCE: forceChargeSource,
            FORCE_CHARGE_LIMIT: forceChargeLimit,
          };

          this.setForceChargeCapability(result);

        } catch (error) {
          console.error('Error writing force battery charge mode:', error);
        }
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
      logLabel: 'Solis Inverter Battery',
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
      this.client = client;
      this.log('Connected ...');
      this.log(modbusOptions);
      const startTime = new Date();
      await HelperService.delay(5000);

      const registers = {
        ...this.inverterRegisters,
        ...this.batteryRegisters,
        ...this.meterRegisters,
      };

      const results: Record<string, Measurement> = {};

      for (const key of Object.keys(registers)) {

        const reg = registers[key];
        if (!reg.capability) {
          continue;
        }

        try {
          const result = await this.updateSolisRegister(key, reg, client);
          results[key] = result;
        } catch (error) {
          this.log(`error updating register ${reg.addr} - ${(error as Error).message}`);
        }
      }

      try {
        console.log('==== Setting force charge capability values...');
        await this.setForceChargeCapability(results);
        console.log('==== Values set!');
      } catch (error) {
        this.log('error updating force charge capability!');
      }

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
