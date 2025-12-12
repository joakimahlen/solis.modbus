/* eslint-disable indent */
import * as Modbus from 'jsmodbus';

import { filter, isNumber, min, values } from 'lodash';
import { read, write } from './response';

import { HelperService } from '../helper';
import Homey from 'homey';
import { Measurement } from './measurement';
import net from 'net';

export enum ForceBatteryChargeMode {
    OFF = 0,
    CHARGE = 1,
    DISCHARGE = 2,
    IDLE = 3,
    PEAKSHAVING = 4
}

export enum PassiveMode {
    OFF = 0,
    ON = 0xaa55
}

export enum StorageControlMode {
    SELF_USE_MODE = 1,
    TOU_MODE = 2,
    OFFGRID = 4,
    BATTERY_WAKEUP = 8,
    RESERVE_BATTERY = 16,
    ALLOW_GRID_CHARGE = 32,
    FEED_IN_PRIORITY = 64,
    BATT_OVC_FUNCTION = 128,
    BATTERY_FORCE_CHARGE_PEAK_SHAVING = 256,
    BATTERY_CORRECTION_ENABLE = 512,
    BATTERY_HEALING = 1024,
    PEAK_SHAVING = 2048
}

export enum StorageWorkingMode {
    UPS = 1,
    SELF_USE = 2,
    TOU_SELF_USE = 4,
    FEED_IN_PRIORITY = 8,
    TOU_FEED_IN_PRIORITY = 16,
    BACKUP = 32,
    OFF_GRID = 64,
    FORCE_BATTERY_CHARGE = 128,
    PASSIVE = 256
}

export enum ForceBatteryChargeDirection {
    OFF = 0,
    CHARGE = 1,
    DISCHARGE = 2
}

export const DEVICE_STORAGE_WORKING_MODES: { [key: string]: string } = {
    1: 'UPS',
    2: 'Self use',
    4: 'TOU Self use',
    8: 'Feed in priority',
    16: 'TOU Feed in priority',
    32: 'Backup',
    64: 'Off-grid',
    128: 'Force battery charge',
    256: 'Passive mode',
};

export const DEVICE_MODEL_DEFINITIONS: { [key: string]: string } = {
    0x2070: 'S6-EH3P-5-10K-H',
    0x2071: 'S6-EH3P-12-20K-H',
    0x2072: 'S6-EH3P-10-15K-LV',
    0x2073: 'S6-EH3P-30-50K-H-Original',
    0x2080: 'S6-EH1P-HV',
    0x2081: 'S6-EH1P-HV-12-16K-US',
    0x2090: 'S6-EH1P-LV',
    0x2091: 'S6-EH1P-LV-AC-Coupled',
    0x2171: 'S6-EH3P-12-20K-H-Adjusted',
    0x2172: 'S6-EH3P-10-15K-LV-Adjusted',
    0x2173: 'S6-EH3P-30-50K-H',
    0x2174: 'S6-EH3P-10K-BatteryReady',
    0x2181: 'S6-EH1P-LV-12-16K-US',
    0x2182: 'S6-EH1P-BatteryReady-US',
    0x2190: 'S6-EH1P-LV-Adjusted',
    0x2193: 'S6-EH1P-BatteryReady',
    0x2273: 'S6-EH3P-30-50K-H-V2',
};

export const DEVICE_STATUS_DEFINITIONS: { [key: string]: string } = {
    0x0: 'Waiting',
    0x1: 'Open run',
    0x2: 'Soft run',
    0x3: 'Generating',
    0x4: 'Bypass inverter running',
    0x5: 'Bypass inverting',
    0x6: 'Bypass grid running',
    0xf: 'Normal running',
    0x1004: 'Grid Off',
    0xf010: 'Grid surge',
    0xf011: 'Fan fault',
    0xf015: 'Fan fault (external)',
    0x1010: 'Grid overvoltage',
    0x1011: 'Grid undervoltage',
    0x1012: 'Grid overfreq',
    0x1013: 'Grid underfreq',
    0x1014: 'Reverse current',
    0x1015: 'No-grid',
    0x1016: 'Unbalanced grid',
    0x1017: 'Grid Frequency Fluctuation',
    0x1018: 'Grid Over Current',
    0x1019: 'Grid current sampling error',
    0x1020: 'DC Over Voltage',
    0x1021: 'DC Bus Over Voltage',
    0x1022: 'DC Bus Unbalance',
    0x1023: 'DC Bus Under Voltage',
    0x1024: 'DC Bus Unbalance 2',
    0x1025: 'DC(Channel A) Over Current',
    0x1026: 'DC(Channel B) Over Current',
    0x1027: 'DC interference',
    0x1028: 'DC reverse connection',
    0x1029: 'PV midpoint grounding fault',
    0x1030: 'The Grid Interference Protection',
    0x1031: 'The DSP Initial Protection',
    0x1032: 'Over temperature protection',
    0x1033: 'PV insulation fault',
    0x1034: 'Leakage current Protection',
    0x1035: 'Relay Check Protection',
    0x1036: 'DSP_B Protection',
    0x1037: 'DC Injection Protection',
    0x1038: '12V Under Voltage Faulty',
    0x1039: 'Leakage Current Check Protection',
    0x103a: 'Under temperature protection',
    0x1040: 'AFCI Check Fault',
    0x1041: 'AFCI Fault',
    0x1046: 'The Grid Interference 02 Protection',
    0x1047: 'The Grid Current Sampling Error',
    0x1048: 'IGBT Over Current',
    0x1050: 'Grid transient overcurrent',
    0x1051: 'Battery hardware overvoltage fault',
    0x1052: 'LLC hardware overcurrent',
    0x1053: 'Battery overvoltage',
    0x1054: 'Battery undervoltage',
    0x1055: 'Battery not connected',
    0x1056: 'Backup overvoltage',
    0x1057: 'Backup overload',
    0x1058: 'DSP Selfcheck error',
    0x105b: 'DSP Detected Battery Overcurrent',
    0x1060: 'Slave Sync Signal Loss',
    0x1061: 'Master Sync Signal Loss',
    0x1062: 'Slave Sync Signal Period Error',
    0x1063: 'Master Sync Signal Period Error',
    0x1064: 'Physical Address Conflict',
    0x1065: 'Heartbeat Loss',
    0x1066: 'DCAN Register Error',
    0x1067: 'Multiple Master Error',
    0x1068: 'Master Slave On-grid Off-grid Mode Conflict',
    0x1069: 'Master Off-grid Slave Connect Voltage Conflict',
    0x106a: 'Other Device Fault Flag',
    0x1070: 'Battery hardware overvoltage 02',
    0x1071: 'Battery hardware overcurrent',
    0x1072: 'Off grid Backup undervoltage',
    0x1073: 'Bus midpoint hardware overcurrent',
    0x1074: 'Battery startup fail',
    0x1075: 'DC 3 average overcurrent',
    0x1076: 'DC 4 average overcurrent',
    0x1077: 'Softrun timeout',
    0x1078: 'Off-grid to Grid Time out',
    0x2010: 'Fail Safe',
    0x2011: 'Meter COM fail',
    0x2012: 'Battery COM fail',
    0x2014: 'DSP COM fail',
    0x2015: 'BMS Alarm',
    0x2016: 'Battery selection not the same',
    0x2017: 'Alarm2-BMS',
    0x2018: 'DRM Connect Fail',
    0x2019: 'Meter select fail',
    0x2020: 'Lead-acid battery High temperature',
    0x2021: 'Lead-acid battery Low temperature',
    0x2030: 'Grid backup overload',
    0x2040: 'EPM Hard Limit Protection',
};

export enum MRType { HOLDING, INPUT }

export enum Operation {
    STATUS,
    DIRECT,
    TOSTRING,
    MODEL,
    NEGATIVE_TO_POSITIVE,
    POSITIVE_OR_ZERO,
    STORAGE_CONTROL,
    ALLOW_GRIDCHARGE,
}

export enum PollRate {
    PRIO1 = 10,
    PRIO2 = 60,
    PRIO3 = 120,
    PRIO4 = 86400
}

export interface ModbusRegister {
    type: MRType;
    addr: number;
    len: number;
    dtype: string;
    scale: number;
    capability?: string;
    operation: Operation;
}

export interface MonitoredRegister {
    reg: ModbusRegister;
    pollRate: PollRate;
}

export class Solis extends Homey.Device {
    chargeMode: ForceBatteryChargeMode = ForceBatteryChargeMode.OFF;

    inverterRegisters: Record<string, MonitoredRegister> = {
        inputPower: { reg: { type: MRType.INPUT, addr: 33057, len: 2, dtype: 'UINT32', scale: 0, capability: 'measure_power', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        PHASE_A_VOLTAGE: { reg: { type: MRType.INPUT, addr: 33073, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.phase1', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_B_VOLTAGE: { reg: { type: MRType.INPUT, addr: 33074, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.phase2', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_C_VOLTAGE: { reg: { type: MRType.INPUT, addr: 33075, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.phase3', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_A_CURRENT: { reg: { type: MRType.INPUT, addr: 33076, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.phase1', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_B_CURRENT: { reg: { type: MRType.INPUT, addr: 33077, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.phase2', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_C_CURRENT: { reg: { type: MRType.INPUT, addr: 33078, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.phase3', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_A_POWER: { reg: { type: MRType.INPUT, addr: 33512, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase1', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_B_POWER: { reg: { type: MRType.INPUT, addr: 33515, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase2', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_C_POWER: { reg: { type: MRType.INPUT, addr: 33518, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase3', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        ACTIVE_POWER: { reg: { type: MRType.INPUT, addr: 33079, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power.active_power', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        INTERNAL_TEMPERATURE: { reg: { type: MRType.INPUT, addr: 33093, len: 1, dtype: 'INT16', scale: -1, capability: 'measure_temperature.inverter', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        DEVICE_STATUS: { reg: { type: MRType.INPUT, addr: 33095, len: 1, dtype: 'UINT16', scale: 0, capability: 'solis_status', operation: Operation.STATUS }, pollRate: PollRate.PRIO2 },
        modelName: { reg: { type: MRType.INPUT, addr: 35000, len: 1, dtype: 'UINT16', scale: 0, capability: 'solis_model', operation: Operation.MODEL }, pollRate: PollRate.PRIO4 },
        PV1voltage: { reg: { type: MRType.INPUT, addr: 33049, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.pv1', operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV1current: { reg: { type: MRType.INPUT, addr: 33050, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.pv1', operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV2voltage: { reg: { type: MRType.INPUT, addr: 33051, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.pv2', operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV2current: { reg: { type: MRType.INPUT, addr: 33052, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.pv2', operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV3voltage: { reg: { type: MRType.INPUT, addr: 33053, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.pv3', operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV3current: { reg: { type: MRType.INPUT, addr: 33054, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.pv3', operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV4voltage: { reg: { type: MRType.INPUT, addr: 33055, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.pv4', operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV4current: { reg: { type: MRType.INPUT, addr: 33056, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.pv4', operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PASSIVE_MODE: { reg: { type: MRType.HOLDING, addr: 43311, len: 1, dtype: 'UINT16', scale: 0, capability: 'passive_mode', operation: Operation.TOSTRING }, pollRate: PollRate.PRIO4 },
        PEAK_SHAVING_MAX_GRID_POWER: { reg: { type: MRType.HOLDING, addr: 43488, len: 1, dtype: 'UINT16', scale: 2, capability: 'peak_shaving_max_grid_power', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
    };

    meterRegisters: Record<string, MonitoredRegister> = {
        METER_POWER: { reg: { type: MRType.INPUT, addr: 33263, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power.grid', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        GRID_IMPORTED_ENERGY: { reg: { type: MRType.INPUT, addr: 33169, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power.grid_import', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        GRID_EXPORTED_ENERGY: { reg: { type: MRType.INPUT, addr: 33173, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power.grid_export', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        GRID_IMPORTED_ENERGY_DAILY: { reg: { type: MRType.INPUT, addr: 33171, len: 2, dtype: 'UINT16', scale: -1, capability: 'meter_power.grid_import_daily', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        GRID_EXPORTED_ENERGY_DAILY: { reg: { type: MRType.INPUT, addr: 33175, len: 2, dtype: 'UINT16', scale: -1, capability: 'meter_power.grid_export_daily', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        ACCUMULATED_YIELD_ENERGY: { reg: { type: MRType.INPUT, addr: 33029, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        DAILY_YIELD_ENERGY: { reg: { type: MRType.INPUT, addr: 33035, len: 1, dtype: 'UINT16', scale: -1, capability: 'meter_power.daily', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
    };

    batteryRegisters: Record<string, MonitoredRegister> = {
        BATTERY_POWER: { reg: { type: MRType.INPUT, addr: 33149, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power.batt_power', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        BATTERY: { reg: { type: MRType.INPUT, addr: 33139, len: 1, dtype: 'UINT16', scale: 0, capability: 'battery', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        MEASURE_BATTERY: { reg: { type: MRType.INPUT, addr: 33139, len: 1, dtype: 'UINT16', scale: 0, capability: 'measure_battery', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        STORAGE_CURRENT_DAY_CHARGE_CAPACITY: { reg: { type: MRType.INPUT, addr: 33163, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO4 },
        STORAGE_CURRENT_DAY_DISCHARGE_CAPACITY: { reg: { type: MRType.INPUT, addr: 33167, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO4 },
        STORAGE_TOTAL_CHARGE: { reg: { type: MRType.INPUT, addr: 33161, len: 2, dtype: 'UINT32', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        STORAGE_TOTAL_DISCHARGE: { reg: { type: MRType.INPUT, addr: 33165, len: 2, dtype: 'UINT32', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        STORAGE_MAXIMUM_CHARGE_POWER: { reg: { type: MRType.HOLDING, addr: 43012, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.chargesetting', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        STORAGE_MAXIMUM_DISCHARGE_POWER: { reg: { type: MRType.HOLDING, addr: 43013, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.dischargesetting', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        STORAGE_RATED_CAPACITY: { reg: { type: MRType.INPUT, addr: 43019, len: 1, dtype: 'UINT16', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO4 },
        STORAGE_CONTROL_MODE: { reg: { type: MRType.HOLDING, addr: 43110, len: 1, dtype: 'UINT16', scale: 0, capability: 'storage_control_mode', operation: Operation.STORAGE_CONTROL }, pollRate: PollRate.PRIO1 },
        ALLOW_GRIDCHARGE: { reg: { type: MRType.HOLDING, addr: 43110, len: 1, dtype: 'UINT16', scale: 0, capability: 'storage_allow_gridcharge', operation: Operation.ALLOW_GRIDCHARGE }, pollRate: PollRate.PRIO1 },
        STORAGE_WORKING_MODE: { reg: { type: MRType.INPUT, addr: 33122, len: 1, dtype: 'UINT16', scale: 0, capability: 'storage_working_mode', operation: Operation.TOSTRING }, pollRate: PollRate.PRIO1 },
        FORCE_CHARGE_SOURCE: { reg: { type: MRType.HOLDING, addr: 43028, len: 1, dtype: 'UINT16', scale: 0, capability: 'force_charge_source', operation: Operation.TOSTRING }, pollRate: PollRate.PRIO1 },
        FORCE_CHARGE_LIMIT: { reg: { type: MRType.HOLDING, addr: 43027, len: 1, dtype: 'UINT16', scale: 1, capability: 'measure_power.force_charge_limit', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        FORCE_CHARGE_POWER: { reg: { type: MRType.HOLDING, addr: 43136, len: 1, dtype: 'UINT16', scale: 1, capability: 'measure_power.force_charge_power', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        FORCE_DISCHARGE_POWER: { reg: { type: MRType.HOLDING, addr: 43129, len: 1, dtype: 'UINT16', scale: 1, capability: 'measure_power.force_discharge_power', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        FORCE_CHARGE_DIRECTION: { reg: { type: MRType.HOLDING, addr: 43135, len: 1, dtype: 'UINT16', scale: 0, capability: 'force_charge_direction', operation: Operation.TOSTRING }, pollRate: PollRate.PRIO1 },
    };

    static applyOperation(measurement: Measurement, operation: Operation): number | string {
        const numValue = Number(measurement.value);
        const scaledValue = numValue * Math.pow(10, measurement.scale);

        switch (operation) {
            case Operation.STATUS:
                return DEVICE_STATUS_DEFINITIONS[numValue] || 'Unknown status code';

            case Operation.MODEL:
                return DEVICE_MODEL_DEFINITIONS[numValue] || `${numValue}`;

            case Operation.STORAGE_CONTROL:
                return `${numValue & ~0x20}`;

            case Operation.ALLOW_GRIDCHARGE: {
                const allowChargeNum = (numValue >> 5) & 1;
                return allowChargeNum.toString();
            }

            case Operation.DIRECT:
                return scaledValue;

            case Operation.TOSTRING:
                return scaledValue.toString();

            case Operation.NEGATIVE_TO_POSITIVE:
                return scaledValue < 0 ? -1 * scaledValue : 0;

            case Operation.POSITIVE_OR_ZERO:
                return scaledValue > 0 ? scaledValue : 0;

            default:
                return scaledValue;
        }

    }

    async updateForceChargeCapability(result: Record<string, Measurement>): Promise<void> {
        const chargeSource = result.FORCE_CHARGE_SOURCE?.value;
        const chargeLimit = result.FORCE_CHARGE_LIMIT?.value;
        const chargePower = result.FORCE_CHARGE_POWER?.value;
        const dischargePower = result.FORCE_DISCHARGE_POWER?.value;
        const chargeDirection = result.FORCE_CHARGE_DIRECTION?.value;
        const peakShavingPower = result.PEAK_SHAVING_MAX_GRID_POWER?.value;
        const storageControlMode: StorageControlMode = Number.parseInt(result.STORAGE_CONTROL_MODE?.value, 10);

        const isForceBatteryCharge = storageControlMode & StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING;
        const isPeakShaving = peakShavingPower !== '0';
        const hasChargeLimit = chargeLimit !== '0';
        const isCharging = chargeSource === '1' && chargeDirection === '1' && chargePower !== '0' && dischargePower === '0' && hasChargeLimit;
        const isDischarging = chargeSource === '1' && chargeDirection === '2' && dischargePower !== '0' && chargePower === '0' && hasChargeLimit;
        const isIdle = chargeSource === '1' && chargeDirection === '2' && dischargePower === '0' && chargePower === '0' && hasChargeLimit;

        let mode = ForceBatteryChargeMode.OFF;

        if (isForceBatteryCharge) {
            if (isDischarging && isPeakShaving) {
                mode = ForceBatteryChargeMode.PEAKSHAVING;
            } else if (isCharging && !isPeakShaving) {
                mode = ForceBatteryChargeMode.CHARGE;
            } else if (isDischarging && !isPeakShaving) {
                mode = ForceBatteryChargeMode.DISCHARGE;
            } else if (isIdle && !isPeakShaving) {
                mode = ForceBatteryChargeMode.IDLE;
            }
        }

        console.log('=== Determined force charge mode:', mode);

        await this.addCapability('force_battery_charge_mode');
        await this.setCapabilityValue('force_battery_charge_mode', `${mode}`);
    }

    async readRegister(key: string, register: ModbusRegister, client: InstanceType<typeof Modbus.client.TCP>) {
        const measurement = await read(register, client);
        await this.addCapability(register.capability!);
        const value = Solis.applyOperation(measurement, register.operation);
        console.log(`= Read ${MRType[register.type]} #${register.addr} ${key} (${register.capability}) => ${measurement.value} => ${value}`);
        await this.setCapabilityValue(register.capability!, value);
        await HelperService.delay(10);

        return measurement;
    }

    async registerListeners(client: InstanceType<typeof Modbus.client.TCP>) {
        // homey menu / device actions
        this.registerCapabilityListener('storage_control_mode', async (value) => {
            await this.handleEvents(client, 'storage_control_mode', Number(value));
            return value;
        });

        this.registerCapabilityListener('storage_working_mode', async (value) => {
            await this.handleEvents(client, 'storage_working_mode', Number(value));
            return value;
        });

        this.registerCapabilityListener('force_battery_charge_mode', async (value) => {
            await this.handleEvents(client, 'force_battery_charge_mode', Number(value));
            return value;
        });

        this.registerCapabilityListener('peak_shaving_max_grid_power', async (value) => {
            await this.handleEvents(client, 'peak_shaving_max_grid_power', Number(value));
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

        const changedPeakShavingMaxGridPower = this.homey.flow.getConditionCard('changedpeak_shaving_max_grid_power');
        changedPeakShavingMaxGridPower.registerRunListener(async (args, state) => {
            this.log(`changedpeak_shaving_max_grid_power  peak_shaving_max_grid_power ${args.device.getCapabilityValue('peak_shaving_max_grid_power')}`);
            this.log(`changedpeak_shaving_max_grid_power  argument_main ${args.argument_main}`);
            const result = (await args.device.getCapabilityValue('peak_shaving_max_grid_power')) === args.argument_main;
            return Promise.resolve(result);
        });

    }

    private async rewriteChargeModeSetting(client: InstanceType<typeof Modbus.client.TCP>) {
        try {
            await write(this.batteryRegisters.FORCE_CHARGE_LIMIT.reg, client, 5000);
            await write(this.batteryRegisters.FORCE_CHARGE_SOURCE.reg, client, 1);

            if (this.chargeMode === ForceBatteryChargeMode.CHARGE) {
                console.log('= Setting CHARGE mode');
                await write(this.inverterRegisters.PASSIVE_MODE.reg, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg, client, StorageControlMode.PEAK_SHAVING);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg, client, 5000);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg, client, ForceBatteryChargeDirection.CHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg, client, 0);
            } else if (this.chargeMode === ForceBatteryChargeMode.DISCHARGE) {
                console.log('= Setting DISCHARGE mode');
                await write(this.inverterRegisters.PASSIVE_MODE.reg, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg, client, StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg, client, ForceBatteryChargeDirection.DISCHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg, client, 5000);
            } else if (this.chargeMode === ForceBatteryChargeMode.PEAKSHAVING) {
                console.log('= Setting PEAKSHAVING mode');
                await write(this.inverterRegisters.PASSIVE_MODE.reg, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg, client, StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg, client, ForceBatteryChargeDirection.DISCHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg, client, 5000);
            } else if (this.chargeMode === ForceBatteryChargeMode.IDLE) {
                console.log('= Setting IDLE mode');
                await write(this.inverterRegisters.PASSIVE_MODE.reg, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg, client, StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg, client, ForceBatteryChargeDirection.DISCHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg, client, 0);
            } else {
                await write(this.inverterRegisters.PASSIVE_MODE.reg, client, PassiveMode.OFF);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg, client, StorageControlMode.SELF_USE_MODE | StorageControlMode.ALLOW_GRID_CHARGE);
            }

            await HelperService.delay(1000);

            const storageControlMode = await this.readRegister('STORAGE_CONTROL_MODE', this.batteryRegisters.STORAGE_CONTROL_MODE.reg, client);
            const storageWorkingMode = await this.readRegister('STORAGE_WORKING_MODE', this.batteryRegisters.STORAGE_WORKING_MODE.reg, client);
            const peakPower = await this.readRegister('PEAK_SHAVING_MAX_GRID_POWER', this.inverterRegisters.PEAK_SHAVING_MAX_GRID_POWER.reg, client);
            const forceChargePower = await this.readRegister('FORCE_CHARGE_POWER', this.batteryRegisters.FORCE_CHARGE_POWER.reg, client);
            const forceChargeDirection = await this.readRegister('FORCE_CHARGE_DIRECTION', this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg, client);
            const forceDischargePower = await this.readRegister('FORCE_DISCHARGE_POWER', this.batteryRegisters.FORCE_DISCHARGE_POWER.reg, client);
            const forceChargeSource = await this.readRegister('FORCE_CHARGE_SOURCE', this.batteryRegisters.FORCE_CHARGE_SOURCE.reg, client);
            const forceChargeLimit = await this.readRegister('FORCE_CHARGE_LIMIT', this.batteryRegisters.FORCE_CHARGE_LIMIT.reg, client);

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

            this.updateForceChargeCapability(result);

        } catch (error) {
            console.error('Error updating force battery charge mode:', error);
        }
    }

    async handleEvents(client: InstanceType<typeof Modbus.client.TCP>, type: string, value: number) {
        if (type === 'storage_control_mode') {
            const storageControlMode: StorageControlMode = value;
            await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg, client, storageControlMode);
            console.log('storage_working_mode', storageControlMode);
        }

        if (type === 'force_battery_charge_mode') {
            this.chargeMode = value as ForceBatteryChargeMode;
            console.log('= Setting force battery mode to: ', ForceBatteryChargeMode[this.chargeMode]);
            await this.rewriteChargeModeSetting(client);
        }

        if (type === 'peak_shaving_max_grid_power') {
            console.log('= Setting max peak shaving grid power to: ', value);
            await write(this.inverterRegisters.PEAK_SHAVING_MAX_GRID_POWER.reg, client, value);
        }
    }

    async poll(client: InstanceType<typeof Modbus.client.TCP>, registers: Record<string, MonitoredRegister>, active: () => boolean) {
        const highestPollRate = min(filter(values(PollRate), isNumber)) || PollRate.PRIO4;

        let accumulatedTime = 0;
        const results: Record<string, Measurement> = {};

        while (active()) {
            const startTime = new Date();

            for (const key of Object.keys(registers)) {
                const register = registers[key];
                const shouldPoll = (accumulatedTime % register.pollRate) === 0;
                if (!shouldPoll) {
                    continue;
                }

                try {
                    const result = await this.readRegister(key, register.reg, client);
                    results[key] = result;
                } catch (error) {
                    this.log(`error updating register ${register.reg.addr} - ${(error as Error).message}`);
                }

            }

            try {
                await this.updateForceChargeCapability(results);
            } catch (error) {
                this.log('error updating force charge capability!', (error as Error).message);
            }

            if ((accumulatedTime % 60) === 0) {
                try {
                    if (this.chargeMode !== ForceBatteryChargeMode.OFF) {
                        console.log('=== Rewriting force charge ===');
                        await this.rewriteChargeModeSetting(client);
                    }
                } catch (error) {
                    this.log('error rewriting charge mode setting!', (error as Error).message);
                }
            }

            const endTime = new Date();
            const timeDiff = endTime.getTime() - startTime.getTime();
            const seconds = Math.floor(timeDiff / 1000);
            this.log(`total time: ${seconds} seconds`);

            accumulatedTime += highestPollRate;
            await HelperService.delay(highestPollRate * 1000);
        }

    }
}
