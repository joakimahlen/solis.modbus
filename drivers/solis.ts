// @ts-expect-error - Homey-log has no types
import * as HomeyLog from 'homey-log';
import * as Modbus from 'jsmodbus';

import { filter, isNil, isNumber, min, multiply, reduce, sum, values } from 'lodash';
import { read, write } from './response';

import { HelperService } from '../helper';
import Homey from 'homey';
import { Measurement } from './measurement';

/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable indent */

export enum ForceBatteryChargeMode {
    UNKNOWN = -1,
    SELF_USE = 0,
    PEAK_SHAVING = 1,
    CHARGE = 2,
    DISCHARGE = 3,
    IDLE = 4,
    EXPORT = 5,
}

export enum PassiveMode {
    OFF = 0,
    ON = 0xaa55,
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
    PEAK_SHAVING = 2048,
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
    PASSIVE = 256,
    RESERVED9 = 512,
    RESERVED10 = 1024,
    RESERVED11 = 2048,
    RESERVED12 = 4096,
    RESERVED13 = 8192,
    RESERVED14 = 16384,
    RESERVED15 = 32768,
}

export enum ForceBatteryChargeDirection {
    OFF = 0,
    CHARGE = 1,
    DISCHARGE = 2,
}

export enum BatteryChargeDirection {
    CHARGE = 0,
    DISCHARGE = 1,
}

export enum ForceBatteryChargeSource {
    GRID_ONLY = 0,
    GRID_AND_PV = 1,
}

export const ForceStorageModes: Record<ForceBatteryChargeMode, number> = {
    [ForceBatteryChargeMode.UNKNOWN]: 0,
    [ForceBatteryChargeMode.SELF_USE]: StorageControlMode.SELF_USE_MODE | StorageControlMode.ALLOW_GRID_CHARGE,
    [ForceBatteryChargeMode.PEAK_SHAVING]: StorageControlMode.ALLOW_GRID_CHARGE | StorageControlMode.PEAK_SHAVING,
    [ForceBatteryChargeMode.CHARGE]:
        StorageControlMode.SELF_USE_MODE |
        StorageControlMode.RESERVE_BATTERY |
        StorageControlMode.ALLOW_GRID_CHARGE |
        StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING,
    [ForceBatteryChargeMode.DISCHARGE]: StorageControlMode.SELF_USE_MODE | StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING,
    [ForceBatteryChargeMode.IDLE]: StorageControlMode.SELF_USE_MODE | StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING,
    [ForceBatteryChargeMode.EXPORT]: StorageControlMode.SELF_USE_MODE | StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING,
};

export const DEVICE_OPERATING_MODES: { [key: string]: string } = {
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

export enum MRType {
    HOLDING,
    INPUT,
}

export enum Operation {
    STATUS,
    DIRECT,
    INVERT,
    TOSTRING,
    MODEL,
    NEGATIVE_TO_POSITIVE,
    POSITIVE_OR_ZERO,
    STORAGE_CONTROL,
    OPERATING_MODE,
    ALLOW_GRIDCHARGE,
}

export enum PollRate {
    PRIO1 = 10,
    PRIO2 = 60,
    PRIO3 = 120,
    PRIO4 = 86400,
}

export interface ModbusRegister {
    type: MRType;
    addr: number;
    len: number;
    dtype: string;
    scale: number;
    capability?: string;
    operation: Operation;
    settable?: boolean;
}

export enum CompoundOperation {
    MULTIPLY = 'multiply',
    ADD = 'add',
    POWER_DIRECTION = 'power_direction',
}

export interface CompoundRegister {
    operation: CompoundOperation;
    registers: string[];
    capability: string;
}

export interface CustomRegister {
    getValue: (client: InstanceType<typeof Modbus.client.TCP>) => string | number;
    setValue?: (client: InstanceType<typeof Modbus.client.TCP>, value: string | number) => void;
    capability: string;
    settable?: boolean;
}

export type BaseRegister = ModbusRegister | CompoundRegister | CustomRegister;
export interface MonitoredRegister<T extends BaseRegister> {
    reg: T;
    pollRate: PollRate;
}

export const IDLE_RECONNECT_TIMEOUT = 120000; // 120 seconds
export const FORCE_CHARGE_POWER_LIMIT = 15000; // 15 kW

export class Solis extends Homey.Device {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    homeyLog: any;
    isPolling = false;

    protected hasBatteryControl(): boolean {
        return true;
    }

    async onInit() {
        this.homeyLog = new HomeyLog.Log({ homey: this.homey });
        this.lastSuccessfulRead = new Date();
    }

    inverterRegisters: Record<string, MonitoredRegister<BaseRegister>> = {
        ACTIVE_POWER: {
            reg: { type: MRType.INPUT, addr: 33079, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power', operation: Operation.INVERT },
            pollRate: PollRate.PRIO1,
        },
        PHASE_A_POWER: {
            reg: { type: MRType.INPUT, addr: 33512, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase1', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        PHASE_B_POWER: {
            reg: { type: MRType.INPUT, addr: 33515, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase2', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        PHASE_C_POWER: {
            reg: { type: MRType.INPUT, addr: 33518, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase3', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        INTERNAL_TEMPERATURE: {
            reg: { type: MRType.INPUT, addr: 33093, len: 1, dtype: 'INT16', scale: -1, capability: 'measure_temperature.inverter', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        DEVICE_STATUS: {
            reg: { type: MRType.INPUT, addr: 33095, len: 1, dtype: 'UINT16', scale: 0, capability: 'solis_status', operation: Operation.STATUS },
            pollRate: PollRate.PRIO2,
        },
        modelName: {
            reg: { type: MRType.INPUT, addr: 35000, len: 1, dtype: 'UINT16', scale: 0, capability: 'solis_model', operation: Operation.MODEL },
            pollRate: PollRate.PRIO4,
        },
        PV1voltage: { reg: { type: MRType.INPUT, addr: 33049, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV1current: { reg: { type: MRType.INPUT, addr: 33050, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV2voltage: { reg: { type: MRType.INPUT, addr: 33051, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV2current: { reg: { type: MRType.INPUT, addr: 33052, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV3voltage: { reg: { type: MRType.INPUT, addr: 33053, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV3current: { reg: { type: MRType.INPUT, addr: 33054, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV4voltage: { reg: { type: MRType.INPUT, addr: 33055, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV4current: { reg: { type: MRType.INPUT, addr: 33056, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV_POWER: {
            reg: { type: MRType.INPUT, addr: 33057, len: 2, dtype: 'UINT32', scale: 0, capability: 'measure_power.pv', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO1,
        },
        PV1_POWER: {
            reg: { operation: CompoundOperation.MULTIPLY, registers: ['PV1voltage', 'PV1current'], capability: 'measure_power.pv1' },
            pollRate: PollRate.PRIO2,
        },
        PV2_POWER: {
            reg: { operation: CompoundOperation.MULTIPLY, registers: ['PV2voltage', 'PV2current'], capability: 'measure_power.pv2' },
            pollRate: PollRate.PRIO2,
        },
        PV3_POWER: {
            reg: { operation: CompoundOperation.MULTIPLY, registers: ['PV3voltage', 'PV3current'], capability: 'measure_power.pv3' },
            pollRate: PollRate.PRIO2,
        },
        PV4_POWER: {
            reg: { operation: CompoundOperation.MULTIPLY, registers: ['PV4voltage', 'PV4current'], capability: 'measure_power.pv4' },
            pollRate: PollRate.PRIO2,
        },
        PASSIVE_MODE: {
            reg: { type: MRType.HOLDING, addr: 43311, len: 1, dtype: 'UINT16', scale: 0, capability: 'passive_mode', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO4,
        },
        TOU_SWITCH: {
            reg: { type: MRType.HOLDING, addr: 43707, len: 1, dtype: 'UINT16', scale: 0, capability: 'tou_slots', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        HOUSE_LOAD_POWER: {
            reg: { type: MRType.INPUT, addr: 33147, len: 1, dtype: 'UINT16', scale: 0, capability: 'measure_power.house_load', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO1,
        },
        LAST_SUCCESS: {
            reg: {
                capability: 'last_successful_read',
                getValue: (client) => this.getSetting('last_successful_read'),
                setValue: (client, value) => this.setSetting('last_successful_read', value),
                settable: true,
            },
            pollRate: PollRate.PRIO2,
        },
    };

    meterRegisters: Record<string, MonitoredRegister<BaseRegister>> = {
        METER_POWER: {
            reg: { type: MRType.INPUT, addr: 33263, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power.grid', operation: Operation.INVERT },
            pollRate: PollRate.PRIO1,
        },
        GRID_IMPORTED_ENERGY: {
            reg: { type: MRType.INPUT, addr: 33169, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power.grid_import', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        GRID_EXPORTED_ENERGY: {
            reg: { type: MRType.INPUT, addr: 33173, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power.grid_export', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        GRID_IMPORTED_ENERGY_DAILY: {
            reg: { type: MRType.INPUT, addr: 33171, len: 2, dtype: 'UINT16', scale: -1, capability: 'meter_power.grid_import_daily', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        GRID_EXPORTED_ENERGY_DAILY: {
            reg: { type: MRType.INPUT, addr: 33175, len: 2, dtype: 'UINT16', scale: -1, capability: 'meter_power.grid_export_daily', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        ACCUMULATED_YIELD_ENERGY: {
            reg: { type: MRType.INPUT, addr: 33029, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        DAILY_YIELD_ENERGY: {
            reg: { type: MRType.INPUT, addr: 33035, len: 1, dtype: 'UINT16', scale: -1, capability: 'meter_power.daily', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
    };

    batteryRegisters: Record<string, MonitoredRegister<BaseRegister>> = {
        BATTERY_DIRECTION: { reg: { type: MRType.INPUT, addr: 33135, len: 2, dtype: 'UINT16', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        BATTERY_POWER_RAW: { reg: { type: MRType.INPUT, addr: 33149, len: 2, dtype: 'INT32', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        BATTERY_POWER: {
            reg: { operation: CompoundOperation.POWER_DIRECTION, registers: ['BATTERY_POWER_RAW', 'BATTERY_DIRECTION'], capability: 'measure_power.batt_power' },
            pollRate: PollRate.PRIO1,
        },
        BATTERY: {
            reg: { type: MRType.INPUT, addr: 33139, len: 1, dtype: 'UINT16', scale: 0, capability: 'battery', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        MEASURE_BATTERY: {
            reg: { type: MRType.INPUT, addr: 33139, len: 1, dtype: 'UINT16', scale: 0, capability: 'measure_battery', operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        STORAGE_CURRENT_DAY_CHARGE_CAPACITY: {
            reg: { type: MRType.INPUT, addr: 33163, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT },
            pollRate: PollRate.PRIO4,
        },
        STORAGE_CURRENT_DAY_DISCHARGE_CAPACITY: {
            reg: { type: MRType.INPUT, addr: 33167, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT },
            pollRate: PollRate.PRIO4,
        },
        STORAGE_TOTAL_CHARGE: {
            reg: { type: MRType.INPUT, addr: 33161, len: 2, dtype: 'UINT32', scale: 0, operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        STORAGE_TOTAL_DISCHARGE: {
            reg: { type: MRType.INPUT, addr: 33165, len: 2, dtype: 'UINT32', scale: 0, operation: Operation.DIRECT },
            pollRate: PollRate.PRIO3,
        },
        STORAGE_MAXIMUM_CHARGE_POWER: {
            reg: {
                type: MRType.HOLDING,
                addr: 43012,
                len: 1,
                dtype: 'UINT16',
                scale: -1,
                capability: 'measure_current.chargesetting',
                operation: Operation.DIRECT,
                settable: true,
            },
            pollRate: PollRate.PRIO3,
        },
        STORAGE_MAXIMUM_DISCHARGE_POWER: {
            reg: {
                type: MRType.HOLDING,
                addr: 43013,
                len: 1,
                dtype: 'UINT16',
                scale: -1,
                capability: 'measure_current.dischargesetting',
                operation: Operation.DIRECT,
                settable: true,
            },
            pollRate: PollRate.PRIO3,
        },
        STORAGE_RATED_CAPACITY: {
            reg: { type: MRType.HOLDING, addr: 43019, len: 1, dtype: 'UINT16', scale: 0, operation: Operation.DIRECT },
            pollRate: PollRate.PRIO4,
        },
        STORAGE_CONTROL_MODE: {
            reg: {
                type: MRType.HOLDING,
                addr: 43110,
                len: 1,
                dtype: 'UINT16',
                scale: 0,
                capability: 'storage_control_mode',
                operation: Operation.STORAGE_CONTROL,
                settable: true,
            },
            pollRate: PollRate.PRIO1,
        },
        OPERATING_MODE: {
            reg: { type: MRType.INPUT, addr: 33122, len: 1, dtype: 'UINT16', scale: 0, capability: 'operating_mode', operation: Operation.OPERATING_MODE },
            pollRate: PollRate.PRIO1,
        },
        FORCE_CHARGE_SOURCE: {
            reg: {
                type: MRType.HOLDING,
                addr: 43028,
                len: 1,
                dtype: 'UINT16',
                scale: 0,
                capability: 'force_charge_source',
                operation: Operation.DIRECT,
                settable: true,
            },
            pollRate: PollRate.PRIO1,
        },
        FORCE_CHARGE_LIMIT: {
            reg: {
                type: MRType.HOLDING,
                addr: 43027,
                len: 1,
                dtype: 'UINT16',
                scale: 1,
                capability: 'measure_power.force_charge_limit',
                operation: Operation.DIRECT,
                settable: true,
            },
            pollRate: PollRate.PRIO1,
        },
        FORCE_CHARGE_POWER: {
            reg: { type: MRType.HOLDING, addr: 43136, len: 1, dtype: 'UINT16', scale: 1, operation: Operation.DIRECT, settable: true },
            pollRate: PollRate.PRIO3,
        },
        FORCE_DISCHARGE_POWER: {
            reg: { type: MRType.HOLDING, addr: 43129, len: 1, dtype: 'UINT16', scale: 1, operation: Operation.DIRECT, settable: true },
            pollRate: PollRate.PRIO3,
        },
        FORCE_CHARGE_DIRECTION: {
            reg: {
                type: MRType.HOLDING,
                addr: 43135,
                len: 1,
                dtype: 'UINT16',
                scale: 0,
                capability: 'force_charge_direction',
                operation: Operation.DIRECT,
                settable: true,
            },
            pollRate: PollRate.PRIO1,
        },
        FORCE_BATTERY_CHARGE_MODE: {
            reg: {
                capability: 'force_battery_charge_mode',
                // getValue returns current capability value (no-op during polling);
                // actual value is managed by updateForceChargeCapability()
                getValue: (client) => this.getCapabilityValue('force_battery_charge_mode'),
                setValue: (client, value) => this.handleForceBatteryChargeMode(client, value),
                settable: true,
            },
            pollRate: PollRate.PRIO2,
        },
        FORCE_BATTERY_CHARGE_MODE_NUM: {
            reg: {
                capability: 'force_battery_charge_mode_num',
                // getValue returns current capability value (no-op during polling);
                // actual value is managed by updateForceChargeCapability()
                getValue: (client) => this.getCapabilityValue('force_battery_charge_mode_num'),
                settable: false,
            },
            pollRate: PollRate.PRIO1,
        },
        FORCE_BATTERY_CHARGE_POWER: {
            reg: {
                capability: 'force_battery_charge_power',
                getValue: (client) => this.getSetting('force_battery_charge_power'),
                setValue: (client, value) => this.setSetting('force_battery_charge_power', value),
                settable: true,
            },
            pollRate: PollRate.PRIO2,
        },
        FORCE_BATTERY_DISCHARGE_POWER: {
            reg: {
                capability: 'force_battery_discharge_power',
                getValue: (client) => this.getSetting('force_battery_discharge_power'),
                setValue: (client, value) => this.setSetting('force_battery_discharge_power', value),
                settable: true,
            },
            pollRate: PollRate.PRIO2,
        },
        FORCE_BATTERY_EXPORT_POWER: {
            reg: {
                capability: 'force_battery_export_power',
                getValue: (client) => this.getSetting('force_battery_export_power'),
                setValue: async (client, value) => {
                    this.setSetting('force_battery_export_power', value);
                    if (this.chargeMode === ForceBatteryChargeMode.EXPORT) {
                        this.log(`= Export power changed to ${value}W, triggering rewrite`);
                        await this.rewriteChargeModeSetting(client);
                    }
                },
                settable: true,
            },
            pollRate: PollRate.PRIO2,
        },
        GRID_PORT_POWER: {
            reg: { type: MRType.HOLDING, addr: 43128, len: 1, dtype: 'INT16', scale: 1, capability: 'grid_port_power', operation: Operation.DIRECT, settable: true },
            pollRate: PollRate.PRIO1,
        },
        GRID_SYSTEM_POWER: {
            reg: { type: MRType.HOLDING, addr: 43133, len: 1, dtype: 'INT16', scale: 1, capability: 'grid_system_power', operation: Operation.DIRECT, settable: true },
            pollRate: PollRate.PRIO1,
        },
        GRID_PORT_POWER_CONTROL: {
            reg: { type: MRType.HOLDING, addr: 43132, len: 1, dtype: 'UINT16', scale: 0, capability: 'grid_port_power_control', operation: Operation.DIRECT, settable: true },
            pollRate: PollRate.PRIO1,
        },
        PEAK_SOC: {
            reg: { type: MRType.HOLDING, addr: 43487, len: 1, dtype: 'UINT16', scale: -2, capability: 'peak_soc', operation: Operation.DIRECT, settable: true },
            pollRate: PollRate.PRIO2,
        },
        PEAK_SHAVING_MAX_GRID_POWER: {
            reg: {
                type: MRType.HOLDING,
                addr: 43488,
                len: 1,
                dtype: 'UINT16',
                scale: 2,
                capability: 'peak_shaving_max_grid_power',
                operation: Operation.DIRECT,
                settable: true,
            },
            pollRate: PollRate.PRIO3,
        },
        PEAK_SHAVING_MAX_GRID_POWER_SENSOR: {
            reg: {
                type: MRType.HOLDING,
                addr: 43488,
                len: 1,
                dtype: 'UINT16',
                scale: 2,
                capability: 'peak_shaving_max_grid_power_sensor',
                operation: Operation.DIRECT,
            },
            pollRate: PollRate.PRIO3,
        },
    };

    private _chargeMode?: ForceBatteryChargeMode;

    get chargeMode(): ForceBatteryChargeMode {
        if (this._chargeMode != null) return this._chargeMode;
        return this.getSetting('force_battery_charge_mode') as ForceBatteryChargeMode;
    }

    set chargeMode(mode: ForceBatteryChargeMode) {
        console.log('= Storing charge mode', mode);
        this._chargeMode = mode;
        this.setSettings({ force_battery_charge_mode: mode });
    }

    get chargePower(): number {
        return this.getSetting('force_battery_charge_power');
    }

    get dischargePower(): number {
        return this.getSetting('force_battery_discharge_power');
    }

    get exportPower(): number {
        return this.getSetting('force_battery_export_power');
    }

    get lastSuccessfulRead(): Date {
        console.log('= Retrieving last successful read', this.getSetting('last_successful_read'));
        return this.getSetting('last_successful_read') as Date;
    }

    set lastSuccessfulRead(date: Date) {
        this.setSettings({ last_successful_read: date });
    }

    private setSetting(setting: string, value: string | number) {
        console.log('= Storing', setting, value);
        this.setSettings({ [setting]: value });
    }

    static applyOperation(measurement: Measurement, operation: Operation): number | string {
        if (isNil(measurement.value)) {
            console.log('= Measurement value is nil, cannot apply operation');
            return NaN;
        }

        const numValue = Number(measurement.value);
        const scaledValue = numValue * Math.pow(10, measurement.scale);

        switch (operation) {
            case Operation.STATUS:
                return DEVICE_STATUS_DEFINITIONS[numValue] || 'Unknown status code';

            case Operation.MODEL:
                return DEVICE_MODEL_DEFINITIONS[numValue] || `${numValue}`;

            case Operation.STORAGE_CONTROL: {
                const setFlags = Object.entries(StorageControlMode)
                    .filter(([key, value]) => typeof value === 'number' && (numValue & value) === value)
                    .map(([key]) => key)
                    .join(' | ');
                console.log('= DECODE STORAGE CONTROL MODE:', setFlags || 'NONE');
                return numValue;
            }

            case Operation.OPERATING_MODE: {
                const setFlags = Object.entries(StorageWorkingMode)
                    .filter(([key, value]) => typeof value === 'number' && (numValue & value) === value)
                    .map(([key]) => key)
                    .join(' | ');
                console.log('= DECODE STORAGE WORKING MODE:', setFlags || 'NONE');
                return numValue.toString();
            }

            case Operation.DIRECT:
                return scaledValue;

            case Operation.INVERT:
                return -scaledValue;

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

    async updateForceChargeCapability(result: Record<string, Measurement>): Promise<ForceBatteryChargeMode> {
        const chargeSource: ForceBatteryChargeSource = result.FORCE_CHARGE_SOURCE?.computedValue as number;
        const chargeLimit = result.FORCE_CHARGE_LIMIT?.computedValue as number;

        const chargePower = result.FORCE_CHARGE_POWER?.computedValue as number;
        const dischargePower = result.FORCE_DISCHARGE_POWER?.computedValue as number;

        const chargeDirection: ForceBatteryChargeDirection = result.FORCE_CHARGE_DIRECTION?.computedValue as number;
        const storageControlMode: StorageControlMode = result.STORAGE_CONTROL_MODE?.computedValue as number;
        const gridPortPower = result.GRID_PORT_POWER?.computedValue as number;
        const gridSystemPower = result.GRID_SYSTEM_POWER?.computedValue as number;
        const gridPortPowerControl = result.GRID_PORT_POWER_CONTROL?.computedValue as number;

        const hasChargeLimit = chargeLimit !== 0;
        const isCharging = chargeSource === ForceBatteryChargeSource.GRID_AND_PV && chargeDirection === ForceBatteryChargeDirection.CHARGE && hasChargeLimit;
        const isDischarging = chargeSource === ForceBatteryChargeSource.GRID_AND_PV &&
            chargeDirection === ForceBatteryChargeDirection.DISCHARGE &&
            hasChargeLimit &&
            dischargePower > 0;
        const isIdle = chargeSource === ForceBatteryChargeSource.GRID_AND_PV &&
            chargeDirection === ForceBatteryChargeDirection.CHARGE &&
            hasChargeLimit &&
            dischargePower === 0 &&
            chargePower === 0;
        const isExporting = (gridPortPowerControl === 1 && gridSystemPower > 0 ||
            gridPortPowerControl === 2 && gridPortPower > 0) &&
            chargeDirection === ForceBatteryChargeDirection.OFF;
        let mode = ForceBatteryChargeMode.UNKNOWN;

        this.log(`=== Detection: src=${chargeSource} dir=${chargeDirection} chgPwr=${chargePower} disPwr=${dischargePower} limit=${chargeLimit} storage=${storageControlMode} gridCtrl=${gridPortPowerControl} gridPort=${gridPortPower} gridSys=${gridSystemPower} isChg=${isCharging} isDis=${isDischarging} isIdle=${isIdle} isExp=${isExporting}`);

        if (isCharging && storageControlMode === ForceStorageModes[ForceBatteryChargeMode.CHARGE]) {
            mode = ForceBatteryChargeMode.CHARGE;
        } else if (isExporting && storageControlMode === ForceStorageModes[ForceBatteryChargeMode.EXPORT]) {
            mode = ForceBatteryChargeMode.EXPORT;
        } else if (isDischarging && storageControlMode === ForceStorageModes[ForceBatteryChargeMode.DISCHARGE]) {
            mode = ForceBatteryChargeMode.DISCHARGE;
        } else if (isIdle && storageControlMode === ForceStorageModes[ForceBatteryChargeMode.IDLE]) {
            mode = ForceBatteryChargeMode.IDLE;
        } else if (storageControlMode === ForceStorageModes[ForceBatteryChargeMode.SELF_USE]) {
            mode = ForceBatteryChargeMode.SELF_USE;
        } else if (storageControlMode === ForceStorageModes[ForceBatteryChargeMode.PEAK_SHAVING]) {
            mode = ForceBatteryChargeMode.PEAK_SHAVING;
        }

        this.log('=== Determined force charge mode:', ForceBatteryChargeMode[mode]);

        // Only adopt detected mode as desired mode on initial startup (no stored mode yet)
        // Never overwrite with UNKNOWN — that would destroy the desired mode
        if (mode !== ForceBatteryChargeMode.UNKNOWN && (isNil(this.chargeMode) || this.chargeMode === ForceBatteryChargeMode.UNKNOWN)) {
            this.chargeMode = mode;
        }

        await this.addCapability('force_battery_charge_mode');
        await this.setCapabilityValue('force_battery_charge_mode', `${mode}`);

        await this.addCapability('force_battery_charge_mode_num');
        await this.setCapabilityValue('force_battery_charge_mode_num', mode);

        return mode;
    }

    async readRegister(key: string, register: ModbusRegister, client: InstanceType<typeof Modbus.client.TCP>) {
        const measurement = await read(register, client);
        if (register.capability) {
            try {
                if (!this.hasCapability(register.capability)) {
                    await this.addCapability(register.capability);
                }
            } catch (e) {
                const { message } = e as Error;
                if (/Invalid Capability/.test(message)) {
                    const oldCapability = message.split(':')[1].trim();

                    if (oldCapability !== register.capability) {
                        this.error(`= Capability ${register.capability} is not supported. Was it removed? '${oldCapability}'`);
                        await this.removeCapability(oldCapability).catch((removeError) => {
                            this.error(`= Error removing old capability ${oldCapability}:`, removeError);
                        });
                    }
                }
                this.error(`= Error adding capability ${register.capability}:`, e);
            }
        }
        const value = Solis.applyOperation(measurement, register.operation);
        this.log(`= Read ${MRType[register.type]} #${register.addr} ${key} (${register.capability}) => ${measurement.value} => ${value}`);
        if (register.capability) {
            await this.setCapabilityValue(register.capability, value);
        }
        measurement.computedValue = value;
        await HelperService.delay(10);

        return measurement;
    }

    findCustomRegisterByCapability(capability: string): CustomRegister | undefined {
        const allRegisters = { ...this.inverterRegisters, ...this.meterRegisters, ...this.batteryRegisters };
        for (const monitored of Object.values(allRegisters)) {
            const reg = monitored.reg as CustomRegister;
            if (reg.capability === capability && reg.getValue !== undefined) {
                return reg;
            }
        }
        return undefined;
    }

    async registerListeners(client: InstanceType<typeof Modbus.client.TCP>, registers: Record<string, MonitoredRegister<BaseRegister>>) {
        Object.values(registers)
            .map((register) => register.reg)
            .forEach(async (register) => {
                try {
                    if (!register.capability) {
                        return;
                    }
                    //                    this.log(`= Setting up register: ${register.capability}`);

                    const isModbusRegister = (register as ModbusRegister).addr !== undefined;
                    const isCustomRegister = (register as CustomRegister).getValue !== undefined;
                    const isSettable = (register as CustomRegister).settable || (register as ModbusRegister).settable || false;

                    const modbusRegister = register as ModbusRegister;
                    const customRegister = register as CustomRegister;

                    if (isCustomRegister) {
                        try {
                            await this.addCapability(customRegister.capability);
                            const capabilityValue = await customRegister.getValue(client);
                            if (!isNil(capabilityValue)) {
                                this.log(`= Custom register capability ${customRegister.capability} initial value:`, capabilityValue, typeof capabilityValue);
                                await this.setCapabilityValue(customRegister.capability, capabilityValue);
                            }
                        } catch (e) {
                            console.error(`= Error setting up initial value for capability ${customRegister.capability}`, e);
                        }
                    }

                    if (isSettable) {
                        this.log(`= Setting up capability listener: ${register.capability}`);

                        this.registerCapabilityListener(register.capability!, async (value) => {
                            this.log(`= Setting ${register.capability} to: `, value);

                            if (isModbusRegister) {
                                await write(modbusRegister, client, value);
                            } else if (isCustomRegister) {
                                await customRegister.setValue!(client, value);
                            }

                            return value;
                        });
                    }

                    try {
                        const conditionCard = this.homey.flow.getConditionCard(register.capability!);
                        this.log('=== Registering condition card for:', register.capability);
                        conditionCard.registerRunListener(async (args) => {
                            // Use args.device (the device selected in the flow) instead of this,
                            // because registerRunListener is global — the last device to register wins.
                            const device = args.device || this;
                            let currentValue = await device.getCapabilityValue(register.capability!);

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const argument = conditionCard.getArgument('argument_main') as any;
                            if (argument && argument.type === 'multiselect') {
                                const values = args.argument_main as string[];
                                if (argument.conjunction === 'and') {
                                    const sumValues = sum(values.map((value) => Number.parseInt(value, 10)));
                                    if (typeof currentValue === 'string') {
                                        currentValue = Number.parseInt(currentValue, 10);
                                    }
                                    const checkResult = sumValues === currentValue;
                                    this.log(`= Checking condition for ${register.capability} - ${args.argument_main}: ${currentValue} => ${checkResult}`);
                                    return checkResult;
                                }
                                if (argument.conjunction === 'or') {
                                    const checkResult = values.some((val) => val === currentValue);
                                    this.log(`= Checking condition for ${register.capability} - ${args.argument_main}: ${currentValue} => ${checkResult}`);
                                    return checkResult;
                                }
                            }

                            const checkResult = args.argument_main === currentValue;
                            this.log(`= Checking condition for ${register.capability} - ${args.argument_main}: ${currentValue} => ${checkResult}`);
                            return checkResult;
                        });
                    } catch (e) {
                        if (!/Invalid Flow Card ID/.test((e as Error).message)) {
                            this.error(`= Skipping condition card for capability: ${register.capability} - ${(e as Error).message}`);
                        }
                    }

                    if (isSettable) {
                        try {
                            const actionCard = this.homey.flow.getActionCard(`${register.capability}_main`);
                            this.log('=== Registering action card for:', register.capability);
                            actionCard.registerRunListener(async (args, state) => {
                                // Use args.device (the device selected in the flow) instead of this,
                                // because registerRunListener is global — the last device to register wins.
                                const targetDevice = (args.device || this) as Solis;
                                if (isModbusRegister) {
                                    await write(modbusRegister, client, args.argument_main);
                                } else if (isCustomRegister) {
                                    // Look up the register from the target device's own register sets
                                    // so the arrow function's captured `this` points to the correct device
                                    const targetRegister = targetDevice.findCustomRegisterByCapability(register.capability!);
                                    if (targetRegister?.setValue) {
                                        await targetRegister.setValue(client, args.argument_main);
                                    } else {
                                        await customRegister.setValue!(client, args.argument_main);
                                    }
                                }
                            });
                        } catch (e) {
                            if (!/Invalid Flow Card ID/.test((e as Error).message)) {
                                this.error(`= Skipping action card for capability: ${register.capability} - ${(e as Error).message}`);
                            }
                        }
                    }
                } catch (e) {
                    this.error(`= Error getting capability: ${register.capability}`, e);
                }
            });

        // Register custom condition card handlers that override the generic handler
        try {
            const peakShavingCard = this.homey.flow.getConditionCard('peak_shaving_max_grid_power');
            this.log('=== Registering custom condition card for: peak_shaving_max_grid_power');
            peakShavingCard.registerRunListener(async (args) => {
                const device = args.device || this;
                const currentValue = await device.getCapabilityValue('peak_shaving_max_grid_power') as number;
                let checkResult = false;
                switch (args.comparison) {
                    case 'equal':
                        checkResult = currentValue === args.value;
                        break;
                    case 'greater':
                        checkResult = currentValue > args.value;
                        break;
                    case 'less':
                        checkResult = currentValue < args.value;
                        break;
                }
                this.log(`= Checking condition for peak_shaving_max_grid_power - ${currentValue} ${args.comparison} ${args.value} => ${checkResult}`);
                return checkResult;
            });
        } catch (e) {
            if (!/Invalid Flow Card ID/.test((e as Error).message)) {
                this.error('= Error registering peak_shaving_max_grid_power condition card:', e);
            }
        }

        try {
            const lastReadCard = this.homey.flow.getConditionCard('last_successful_read');
            this.log('=== Registering custom condition card for: last_successful_read');
            lastReadCard.registerRunListener(async (args) => {
                const device = args.device || this;
                const lastRead = device.getSetting('last_successful_read') as Date;
                const minutesAgo = (Date.now() - lastRead.getTime()) / 60000;
                const checkResult = minutesAgo <= args.minutes;
                this.log(`= Checking condition for last_successful_read - ${minutesAgo.toFixed(1)} min ago <= ${args.minutes} min => ${checkResult}`);
                return checkResult;
            });
        } catch (e) {
            if (!/Invalid Flow Card ID/.test((e as Error).message)) {
                this.error('= Error registering last_successful_read condition card:', e);
            }
        }
    }

    private async rewriteChargeModeSetting(client: InstanceType<typeof Modbus.client.TCP>) {
        if (isNil(this.chargeMode) || this.chargeMode === ForceBatteryChargeMode.UNKNOWN) {
            this.log('= Charge mode is undefined or unknown, skipping rewrite');
            return;
        }
        this.log(`=== Setting ${ForceBatteryChargeMode[this.chargeMode]} mode`, this.chargeMode, typeof this.chargeMode);

        try {
            await write(this.batteryRegisters.FORCE_CHARGE_LIMIT.reg as ModbusRegister, client, FORCE_CHARGE_POWER_LIMIT);
            await write(this.batteryRegisters.FORCE_CHARGE_SOURCE.reg as ModbusRegister, client, ForceBatteryChargeSource.GRID_AND_PV);

            // Reset grid power control when not in EXPORT mode
            if (this.chargeMode !== ForceBatteryChargeMode.EXPORT) {
                await write(this.batteryRegisters.GRID_PORT_POWER_CONTROL.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.GRID_PORT_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.GRID_SYSTEM_POWER.reg as ModbusRegister, client, 0);
            }

            const forceStorageMode = ForceStorageModes[this.chargeMode];

            if (this.chargeMode === ForceBatteryChargeMode.CHARGE) {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, this.chargePower);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.CHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, 0);
            } else if (this.chargeMode === ForceBatteryChargeMode.DISCHARGE) {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.DISCHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, this.dischargePower);
            } else if (this.chargeMode === ForceBatteryChargeMode.IDLE) {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.CHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, 0);
            } else if (this.chargeMode === ForceBatteryChargeMode.PEAK_SHAVING) {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.DISCHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, this.dischargePower);
            } else if (this.chargeMode === ForceBatteryChargeMode.EXPORT) {
                this.log(`=== EXPORT: writing grid system power=${this.exportPower}W, storage=${forceStorageMode}, grid control=1, passive=OFF`);
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.OFF);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.OFF);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.GRID_PORT_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.GRID_PORT_POWER_CONTROL.reg as ModbusRegister, client, 1);
                await write(this.batteryRegisters.GRID_SYSTEM_POWER.reg as ModbusRegister, client, this.exportPower);
            } else {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.OFF);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
            }

            // Don't read back or update force_battery_charge_mode capability here.
            // The main poll loop detection (executePoll) is the sole source for the capability value,
            // so condition cards reflect the actual inverter state, not the transient post-rewrite state.
        } catch (error) {
            this.error('Error updating force battery charge mode:', error);
        }
    }

    async handleForceBatteryChargeMode(client: InstanceType<typeof Modbus.client.TCP>, value: string | number) {
        if (typeof value === 'string') {
            this.chargeMode = Number.parseInt(value, 10) as ForceBatteryChargeMode;
        } else {
            this.chargeMode = value as ForceBatteryChargeMode;
        }
        this.log(`= Setting force battery mode to: ${ForceBatteryChargeMode[this.chargeMode]}`);
        await this.rewriteChargeModeSetting(client);
    }

    async poll(client: InstanceType<typeof Modbus.client.TCP>, registers: Record<string, MonitoredRegister<BaseRegister>>, active: () => boolean) {
        if (this.isPolling) {
            this.log('== Poll already running, skipping');
            return;
        }

        this.isPolling = true;
        try {
            await this.executePoll(client, registers, active);
        } finally {
            this.isPolling = false;
        }
    }

    private async executePoll(client: InstanceType<typeof Modbus.client.TCP>, registers: Record<string, MonitoredRegister<BaseRegister>>, active: () => boolean) {
        this.lastSuccessfulRead = new Date();
        const highestPollRate = min(filter(values(PollRate), isNumber)) || PollRate.PRIO4;

        let accumulatedTime = 0;
        const results: Record<string, Measurement> = {};

        while (active()) {
            if (client.connectionState === 'offline') {
                this.log('== Client offline! Aborting poll.');
                client.socket.destroy(new Error('Client offline'));
                return;
            }

            if (client.connectionState === 'online' && Date.now() - this.lastSuccessfulRead.getTime() > IDLE_RECONNECT_TIMEOUT) {
                this.log('== No successful read for a while, reconnecting client...');
                client.socket.destroy(new Error('Reconnecting due to idle timeout'));
                return;
            }

            const startTime = new Date();

            if (this.hasBatteryControl()) {
                this.log(`= [${this.getName()}] Polling modbus registers... Charge mode is `, ForceBatteryChargeMode[this.chargeMode]);
            } else {
                this.log(`= [${this.getName()}] Polling modbus registers...`);
            }
            for (const key of Object.keys(registers)) {
                const register = registers[key] as MonitoredRegister<ModbusRegister>;

                if (!register.reg.addr) {
                    continue;
                }

                const shouldPoll = accumulatedTime % register.pollRate === 0;
                if (!shouldPoll) {
                    continue;
                }

                try {
                    const result = await this.readRegister(key, register.reg, client);
                    this.lastSuccessfulRead = new Date();
                    results[key] = result;
                } catch (error) {
                    this.log(`=== error reading register ${register.reg.addr} - '${(error as Error).message}'`);
                }
            }

            this.log('= Calculating compound registers...');
            for (const key of Object.keys(registers)) {
                const register = registers[key] as MonitoredRegister<CompoundRegister>;

                if (!register.reg.operation || !register.reg.registers) {
                    continue;
                }

                const shouldPoll = accumulatedTime % register.pollRate === 0;
                if (!shouldPoll) {
                    continue;
                }

                const measurements = register.reg.registers.map((regKey) => results[regKey]);

                if (!measurements.every((measurement) => measurement !== undefined)) {
                    this.log(`== Skipping compound register key: ${register.reg.capability}, missing one of: ${register.reg.registers.join(', ')}`);
                    continue;
                }

                if (!measurements.every((measurement) => typeof measurement.computedValue !== 'string')) {
                    this.log(`== Skipping compound register key: ${register.reg.capability}, cannot use string values in calculations`);
                    continue;
                }

                await this.addCapability(register.reg.capability);

                const values = register.reg.registers.map((regKey) => {
                    const measurement = results[regKey];

                    return measurement.computedValue as number;
                });

                let compoundValue = 0;
                if (register.reg.operation === 'multiply') {
                    compoundValue = reduce(values, multiply, 1.0);
                    this.log(`= Calculated multiply for ${register.reg.registers.join(' * ')} = ${values.join(' * ')} = ${compoundValue}`);
                } else if (register.reg.operation === 'add') {
                    this.log(`= Calculated add for ${register.reg.registers.join(' + ')} = ${values.join(' + ')} = ${compoundValue}`);
                    compoundValue = sum(values);
                } else if (register.reg.operation === 'power_direction') {
                    // Homey convention: positive = charging (consuming), negative = discharging (delivering)
                    const [rawPower, direction] = values;
                    switch (direction) {
                        case BatteryChargeDirection.CHARGE:
                            compoundValue = rawPower;
                            break;
                        case BatteryChargeDirection.DISCHARGE:
                            compoundValue = -1 * rawPower;
                            break;
                        default:
                            compoundValue = 0;
                            break;
                    }
                    this.log(`= Calculated power direction ${rawPower} at ${BatteryChargeDirection[direction]} = ${compoundValue}`);
                } else {
                    throw new Error(`Unknown compound register operation: ${register.reg.operation}`);
                }
                await this.setCapabilityValue(register.reg.capability, compoundValue);
            }

            this.log('= Calculating custom registers...');
            for (const key of Object.keys(registers)) {
                const register = registers[key] as MonitoredRegister<CustomRegister>;

                if (!register.reg.getValue) {
                    continue;
                }

                const shouldPoll = accumulatedTime % register.pollRate === 0;
                if (!shouldPoll) {
                    continue;
                }

                try {
                    const value = await register.reg.getValue(client);
                    results[key] = {
                        value,
                        scale: 0,
                        operation: Operation.DIRECT,
                        capability: register.reg.capability,
                        computedValue: value,
                    } as Measurement;

                    this.log(`= Read customer register ${key} (${register.reg.capability}) => ${value}`);
                    await this.addCapability(register.reg.capability);
                    await this.setCapabilityValue(register.reg.capability, value);
                } catch (error) {
                    this.log(`=== error reading custom register ${register.reg.capability} - '${(error as Error).message}'`);
                }
            }

            if (this.hasBatteryControl()) {
                let detectedMode = ForceBatteryChargeMode.UNKNOWN;
                try {
                    detectedMode = await this.updateForceChargeCapability(results);
                } catch (error) {
                    this.log('error updating force charge capability!', (error as Error).message);
                }

                try {
                    if (!isNil(this.chargeMode) && this.chargeMode !== ForceBatteryChargeMode.UNKNOWN && this.chargeMode !== detectedMode) {
                        this.log(`=== Detected ${detectedMode}, rewriting force charge to ${this.chargeMode} ===`);
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

    setCapabilityValue(capabilityId: string, value: string | number): Promise<void> {
        return super.setCapabilityValue(capabilityId, value).catch((e) => {
            if (/Expected: string/.test((e as Error).message)) {
                return super.setCapabilityValue(capabilityId, `${value}`);
            }
            console.log('ERROR!', e);
            throw e;
        });
    }
}
