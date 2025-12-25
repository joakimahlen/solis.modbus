// @ts-expect-error - Homey-log has no types
import * as HomeyLog from 'homey-log';
import * as Modbus from 'jsmodbus';

import { filter, isNumber, min, multiply, reduce, sum, values } from 'lodash';
import Homey from 'homey';
import { read, write } from './response';

import { HelperService } from '../helper';
import { Measurement } from './measurement';

/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable indent */

export enum ForceBatteryChargeMode {
    UNKNOWN = -1,
    SELF_USE = 0,
    PEAK_SHAVING = 1,
    CHARGE = 2,
    DISCHARGE = 3,
    IDLE = 4
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
    PASSIVE = 256,
    RESERVED9 = 512,
    RESERVED10 = 1024,
    RESERVED11 = 2048,
    RESERVED12 = 4096,
    RESERVED13 = 8192,
    RESERVED14 = 16384,
    RESERVED15 = 32768
}

export enum ForceBatteryChargeDirection {
    OFF = 0,
    CHARGE = 1,
    DISCHARGE = 2
}

export enum BatteryChargeDirection {
    CHARGE = 0,
    DISCHARGE = 1
}

export enum ForceBatteryChargeSource {
    GRID_ONLY = 0,
    GRID_AND_PV = 1,
}

export const ForceStorageModes: Record<ForceBatteryChargeMode, number> = {
    [ForceBatteryChargeMode.UNKNOWN]: 0,
    [ForceBatteryChargeMode.SELF_USE]:
        StorageControlMode.SELF_USE_MODE
        | StorageControlMode.ALLOW_GRID_CHARGE,
    [ForceBatteryChargeMode.PEAK_SHAVING]:
        StorageControlMode.ALLOW_GRID_CHARGE
        | StorageControlMode.PEAK_SHAVING,
    [ForceBatteryChargeMode.CHARGE]:
        StorageControlMode.SELF_USE_MODE
        | StorageControlMode.RESERVE_BATTERY
        | StorageControlMode.ALLOW_GRID_CHARGE
        | StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING,
    [ForceBatteryChargeMode.DISCHARGE]:
        StorageControlMode.SELF_USE_MODE
        | StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING,
    [ForceBatteryChargeMode.IDLE]:
        StorageControlMode.SELF_USE_MODE
        | StorageControlMode.BATTERY_FORCE_CHARGE_PEAK_SHAVING,
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

export enum MRType { HOLDING, INPUT }

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
    settable?: boolean
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
    handler: (client: InstanceType<typeof Modbus.client.TCP>, value: string | number) => void;
    capability: string;
    settable?: boolean
}

export type BaseRegister = ModbusRegister | CompoundRegister | CustomRegister;
export interface MonitoredRegister<T extends BaseRegister> {
    reg: T;
    pollRate: PollRate;
}

export const IDLE_RECONNECT_TIMEOUT = 120000; // 120 seconds

export class Solis extends Homey.Device {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    homeyLog: any;
    lastSuccessfulRead = new Date();
    isPolling = false;

    async onInit() {
        this.homeyLog = new HomeyLog.Log({ homey: this.homey });
    }

    chargeMode: ForceBatteryChargeMode = ForceBatteryChargeMode.UNKNOWN;

    inverterRegisters: Record<string, MonitoredRegister<BaseRegister>> = {
        ACTIVE_POWER: { reg: { type: MRType.INPUT, addr: 33079, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power', operation: Operation.INVERT }, pollRate: PollRate.PRIO1 },
        PHASE_A_POWER: { reg: { type: MRType.INPUT, addr: 33512, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase1', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_B_POWER: { reg: { type: MRType.INPUT, addr: 33515, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase2', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        PHASE_C_POWER: { reg: { type: MRType.INPUT, addr: 33518, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase3', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        INTERNAL_TEMPERATURE: { reg: { type: MRType.INPUT, addr: 33093, len: 1, dtype: 'INT16', scale: -1, capability: 'measure_temperature.inverter', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        DEVICE_STATUS: { reg: { type: MRType.INPUT, addr: 33095, len: 1, dtype: 'UINT16', scale: 0, capability: 'solis_status', operation: Operation.STATUS }, pollRate: PollRate.PRIO2 },
        modelName: { reg: { type: MRType.INPUT, addr: 35000, len: 1, dtype: 'UINT16', scale: 0, capability: 'solis_model', operation: Operation.MODEL }, pollRate: PollRate.PRIO4 },
        PV1voltage: { reg: { type: MRType.INPUT, addr: 33049, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV1current: { reg: { type: MRType.INPUT, addr: 33050, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV2voltage: { reg: { type: MRType.INPUT, addr: 33051, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV2current: { reg: { type: MRType.INPUT, addr: 33052, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV3voltage: { reg: { type: MRType.INPUT, addr: 33053, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV3current: { reg: { type: MRType.INPUT, addr: 33054, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV4voltage: { reg: { type: MRType.INPUT, addr: 33055, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV4current: { reg: { type: MRType.INPUT, addr: 33056, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO2 },
        PV_POWER: { reg: { type: MRType.INPUT, addr: 33057, len: 2, dtype: 'UINT32', scale: 0, capability: 'measure_power.pv', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        PV1_POWER: { reg: { operation: CompoundOperation.MULTIPLY, registers: ['PV1voltage', 'PV1current'], capability: 'measure_power.pv1' }, pollRate: PollRate.PRIO2 },
        PV2_POWER: { reg: { operation: CompoundOperation.MULTIPLY, registers: ['PV2voltage', 'PV2current'], capability: 'measure_power.pv2' }, pollRate: PollRate.PRIO2 },
        PV3_POWER: { reg: { operation: CompoundOperation.MULTIPLY, registers: ['PV3voltage', 'PV3current'], capability: 'measure_power.pv3' }, pollRate: PollRate.PRIO2 },
        PV4_POWER: { reg: { operation: CompoundOperation.MULTIPLY, registers: ['PV4voltage', 'PV4current'], capability: 'measure_power.pv4' }, pollRate: PollRate.PRIO2 },
        PASSIVE_MODE: { reg: { type: MRType.HOLDING, addr: 43311, len: 1, dtype: 'UINT16', scale: 0, capability: 'passive_mode', operation: Operation.TOSTRING }, pollRate: PollRate.PRIO4 },
        TOU_SWITCH: { reg: { type: MRType.HOLDING, addr: 43707, len: 1, dtype: 'UINT16', scale: 0, capability: 'tou_slots', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        HOUSE_LOAD_POWER: { reg: { type: MRType.INPUT, addr: 33147, len: 1, dtype: 'UINT16', scale: 0, capability: 'measure_power.house_load', operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
    };

    meterRegisters: Record<string, MonitoredRegister<BaseRegister>> = {
        METER_POWER: { reg: { type: MRType.INPUT, addr: 33263, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power.grid', operation: Operation.INVERT }, pollRate: PollRate.PRIO1 },
        GRID_IMPORTED_ENERGY: { reg: { type: MRType.INPUT, addr: 33169, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power.grid_import', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        GRID_EXPORTED_ENERGY: { reg: { type: MRType.INPUT, addr: 33173, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power.grid_export', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        GRID_IMPORTED_ENERGY_DAILY: { reg: { type: MRType.INPUT, addr: 33171, len: 2, dtype: 'UINT16', scale: -1, capability: 'meter_power.grid_import_daily', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        GRID_EXPORTED_ENERGY_DAILY: { reg: { type: MRType.INPUT, addr: 33175, len: 2, dtype: 'UINT16', scale: -1, capability: 'meter_power.grid_export_daily', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        ACCUMULATED_YIELD_ENERGY: { reg: { type: MRType.INPUT, addr: 33029, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        DAILY_YIELD_ENERGY: { reg: { type: MRType.INPUT, addr: 33035, len: 1, dtype: 'UINT16', scale: -1, capability: 'meter_power.daily', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
    };

    batteryRegisters: Record<string, MonitoredRegister<BaseRegister>> = {
        BATTERY_DIRECTION: { reg: { type: MRType.INPUT, addr: 33135, len: 2, dtype: 'UINT16', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        BATTERY_POWER_RAW: { reg: { type: MRType.INPUT, addr: 33149, len: 2, dtype: 'INT32', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO1 },
        BATTERY_POWER: { reg: { operation: CompoundOperation.POWER_DIRECTION, registers: ['BATTERY_POWER_RAW', 'BATTERY_DIRECTION'], capability: 'measure_power.batt_power' }, pollRate: PollRate.PRIO1 },
        BATTERY: { reg: { type: MRType.INPUT, addr: 33139, len: 1, dtype: 'UINT16', scale: 0, capability: 'battery', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        MEASURE_BATTERY: { reg: { type: MRType.INPUT, addr: 33139, len: 1, dtype: 'UINT16', scale: 0, capability: 'measure_battery', operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        STORAGE_CURRENT_DAY_CHARGE_CAPACITY: { reg: { type: MRType.INPUT, addr: 33163, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO4 },
        STORAGE_CURRENT_DAY_DISCHARGE_CAPACITY: { reg: { type: MRType.INPUT, addr: 33167, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT }, pollRate: PollRate.PRIO4 },
        STORAGE_TOTAL_CHARGE: { reg: { type: MRType.INPUT, addr: 33161, len: 2, dtype: 'UINT32', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        STORAGE_TOTAL_DISCHARGE: { reg: { type: MRType.INPUT, addr: 33165, len: 2, dtype: 'UINT32', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO3 },
        STORAGE_MAXIMUM_CHARGE_POWER: { reg: { type: MRType.HOLDING, addr: 43012, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.chargesetting', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO3 },
        STORAGE_MAXIMUM_DISCHARGE_POWER: { reg: { type: MRType.HOLDING, addr: 43013, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.dischargesetting', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO3 },
        STORAGE_RATED_CAPACITY: { reg: { type: MRType.HOLDING, addr: 43019, len: 1, dtype: 'UINT16', scale: 0, operation: Operation.DIRECT }, pollRate: PollRate.PRIO4 },
        STORAGE_CONTROL_MODE: { reg: { type: MRType.HOLDING, addr: 43110, len: 1, dtype: 'UINT16', scale: 0, capability: 'storage_control_mode', operation: Operation.STORAGE_CONTROL, settable: true }, pollRate: PollRate.PRIO1 },
        OPERATING_MODE: { reg: { type: MRType.INPUT, addr: 33122, len: 1, dtype: 'UINT16', scale: 0, capability: 'operating_mode', operation: Operation.OPERATING_MODE }, pollRate: PollRate.PRIO1 },
        FORCE_CHARGE_SOURCE: { reg: { type: MRType.HOLDING, addr: 43028, len: 1, dtype: 'UINT16', scale: 0, capability: 'force_charge_source', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO1 },
        FORCE_CHARGE_LIMIT: { reg: { type: MRType.HOLDING, addr: 43027, len: 1, dtype: 'UINT16', scale: 1, capability: 'measure_power.force_charge_limit', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO1 },
        FORCE_CHARGE_POWER: { reg: { type: MRType.HOLDING, addr: 43136, len: 1, dtype: 'UINT16', scale: 1, capability: 'measure_power.force_charge_power', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO1 },
        FORCE_DISCHARGE_POWER: { reg: { type: MRType.HOLDING, addr: 43129, len: 1, dtype: 'UINT16', scale: 1, capability: 'measure_power.force_discharge_power', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO1 },
        FORCE_CHARGE_DIRECTION: { reg: { type: MRType.HOLDING, addr: 43135, len: 1, dtype: 'UINT16', scale: 0, capability: 'force_charge_direction', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO1 },
        FORCE_BATTERY_CHARGE_MODE: { reg: { capability: 'force_battery_charge_mode', handler: (client, value) => this.handleForceBatteryChargeMode(client, value), settable: true }, pollRate: PollRate.PRIO2 },
        PEAK_SOC: { reg: { type: MRType.HOLDING, addr: 43487, len: 1, dtype: 'UINT16', scale: 0, capability: 'peak_soc', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO1 },
        PEAK_SHAVING_MAX_GRID_POWER: { reg: { type: MRType.HOLDING, addr: 43488, len: 1, dtype: 'UINT16', scale: 2, capability: 'peak_shaving_max_grid_power', operation: Operation.DIRECT, settable: true }, pollRate: PollRate.PRIO3 },
    };

    static applyOperation(measurement: Measurement, operation: Operation): number | string {
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

        const hasChargeLimit = chargeLimit !== 0;
        const isCharging = chargeSource === ForceBatteryChargeSource.GRID_AND_PV && chargeDirection === ForceBatteryChargeDirection.CHARGE && chargePower !== 0 && dischargePower === 0 && hasChargeLimit;
        const isDischarging = chargeSource === ForceBatteryChargeSource.GRID_AND_PV && chargeDirection === ForceBatteryChargeDirection.DISCHARGE && dischargePower !== 0 && chargePower === 0 && hasChargeLimit;
        const isIdle = chargeSource === ForceBatteryChargeSource.GRID_AND_PV && chargeDirection === ForceBatteryChargeDirection.DISCHARGE && dischargePower === 0 && chargePower === 0 && hasChargeLimit;

        let mode = ForceBatteryChargeMode.UNKNOWN;

        /*
        this.log(`==== CHARGE STATUS: ${hasChargeLimit} / ${chargeSource} / ${chargeDirection} / ${dischargePower}`);
        this.log(`=== SELF_USE: Storage mode is ${storageControlMode}, should be ${ForceStorageModes[ForceBatteryChargeMode.SELF_USE]}`);
        this.log(`=== PEAK_SHAVING: Storage mode is ${storageControlMode}, should be ${ForceStorageModes[ForceBatteryChargeMode.PEAK_SHAVING]}`);
        this.log(`=== CHARGE: Storage mode is ${storageControlMode}, should be ${ForceStorageModes[ForceBatteryChargeMode.CHARGE]}`);
        this.log(`=== DISCHARGE: Storage mode is ${storageControlMode}, should be ${ForceStorageModes[ForceBatteryChargeMode.DISCHARGE]}`);
        this.log(`=== IDLE: Storage mode is ${storageControlMode}, should be ${ForceStorageModes[ForceBatteryChargeMode.IDLE]}`);

        this.log('=== Is Charging:', isCharging);
        this.log('=== Is Discharging:', isDischarging);
        this.log('=== Is Idle:', isIdle);
        */

        if (isCharging && storageControlMode === ForceStorageModes[ForceBatteryChargeMode.CHARGE]) {
            mode = ForceBatteryChargeMode.CHARGE;
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

        await this.addCapability('force_battery_charge_mode');
        await this.setCapabilityValue('force_battery_charge_mode', `${mode}`);

        return mode;
    }

    async readRegister(key: string, register: ModbusRegister, client: InstanceType<typeof Modbus.client.TCP>) {
        const measurement = await read(register, client);
        if (register.capability) {
            try {
                await this.addCapability(register.capability);
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

    async registerListeners(client: InstanceType<typeof Modbus.client.TCP>, registers: Record<string, MonitoredRegister<BaseRegister>>) {
        Object.values(registers)
            .map((register) => register.reg)
            .forEach(async (register) => {
                try {
                    const isModbusRegister = (register as ModbusRegister).addr !== undefined;
                    const isCustomRegister = (register as CustomRegister).handler !== undefined;
                    const isSettable = (register as CustomRegister).settable || (register as ModbusRegister).settable || false;

                    const modbusRegister = register as ModbusRegister;
                    const customRegister = register as CustomRegister;

                    if (isSettable) {
                        this.log(`= Capability listener: ${register.capability}`);

                        this.registerCapabilityListener(register.capability!, async (value) => {
                            this.log(`= Setting ${register.capability} to: `, value);

                            if (isModbusRegister) {
                                await write(modbusRegister, client, value);
                            } else if (isCustomRegister) {
                                await customRegister.handler(client, value);
                            }

                            return value;
                        });
                    }

                    try {
                        const conditionCard = this.homey.flow.getConditionCard(register.capability!);
                        this.log('=== Registering condition card for:', register.capability);
                        conditionCard.registerRunListener(async (args, state) => {
                            let currentValue = await this.getCapabilityValue(register.capability!);
                            let checkResult = null;

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const argument = conditionCard.getArgument('argument_main') as any;
                            if (argument && argument.type === 'multiselect') {
                                const values = args.argument_main as string[];
                                if (argument.conjunction === 'and') {
                                    const sumValues = sum(values.map((value) => Number.parseInt(value, 10)));
                                    if (typeof currentValue === 'string') {
                                        currentValue = Number.parseInt(currentValue, 10);
                                    }
                                    checkResult = sumValues === currentValue;
                                } if (argument.conjunction === 'or') {
                                    checkResult = values.some((val) => val === currentValue);
                                }
                            } else {
                                checkResult = args.argument_main === currentValue;
                            }

                            this.log(`= Checking condition for ${register.capability} - ${args.argument_main}: ${currentValue} => ${checkResult}`);
                            return Promise.resolve(checkResult);
                        });

                        if (isSettable) {
                            const actionCard = this.homey.flow.getActionCard(`${register.capability}_main`);
                            this.log('=== Registering action card for:', register.capability);
                            actionCard.registerRunListener(async (args, state) => {
                                if (isModbusRegister) {
                                    await write(modbusRegister, client, args.argument_main);
                                } else if (isCustomRegister) {
                                    await customRegister.handler(client, args.argument_main);
                                }
                            });
                        }
                    } catch (e) {
                        if (!/Invalid Flow Card ID/.test((e as Error).message)) {
                            this.error(`= Skipping flow cards for capability: ${register.capability} - ${(e as Error).message}`);
                            return;
                        }
                    }
                } catch (e) {
                    this.error(`= Error getting capability: ${register.capability}`, e);
                }
            });
    }

    private async rewriteChargeModeSetting(client: InstanceType<typeof Modbus.client.TCP>) {
        if (this.chargeMode === undefined || this.chargeMode === ForceBatteryChargeMode.UNKNOWN) {
            this.log('= Charge mode is undefined or unknown, skipping rewrite');
            return;
        }
        this.log(`=== Setting ${ForceBatteryChargeMode[this.chargeMode]} mode`);

        try {
            await write(this.batteryRegisters.FORCE_CHARGE_LIMIT.reg as ModbusRegister, client, 5000);
            await write(this.batteryRegisters.FORCE_CHARGE_SOURCE.reg as ModbusRegister, client, 1);

            const forceStorageMode = ForceStorageModes[this.chargeMode];

            if (this.chargeMode === ForceBatteryChargeMode.CHARGE) {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, 10000);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.CHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, 0);
            } else if (this.chargeMode === ForceBatteryChargeMode.DISCHARGE) {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.DISCHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, 5000);
            } else if (this.chargeMode === ForceBatteryChargeMode.IDLE) {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.DISCHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, 0);
            } else if (this.chargeMode === ForceBatteryChargeMode.PEAK_SHAVING) {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.ON);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
                await write(this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client, 0);
                await write(this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client, ForceBatteryChargeDirection.DISCHARGE);
                await write(this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client, 5000);
            } else {
                await write(this.inverterRegisters.PASSIVE_MODE.reg as ModbusRegister, client, PassiveMode.OFF);
                await write(this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client, forceStorageMode);
            }

            await HelperService.delay(2500);

            const storageControlMode = await this.readRegister('STORAGE_CONTROL_MODE', this.batteryRegisters.STORAGE_CONTROL_MODE.reg as ModbusRegister, client);
            const operatingMode = await this.readRegister('OPERATING_MODE', this.batteryRegisters.OPERATING_MODE.reg as ModbusRegister, client);
            const forceChargePower = await this.readRegister('FORCE_CHARGE_POWER', this.batteryRegisters.FORCE_CHARGE_POWER.reg as ModbusRegister, client);
            const forceChargeDirection = await this.readRegister('FORCE_CHARGE_DIRECTION', this.batteryRegisters.FORCE_CHARGE_DIRECTION.reg as ModbusRegister, client);
            const forceDischargePower = await this.readRegister('FORCE_DISCHARGE_POWER', this.batteryRegisters.FORCE_DISCHARGE_POWER.reg as ModbusRegister, client);
            const forceChargeSource = await this.readRegister('FORCE_CHARGE_SOURCE', this.batteryRegisters.FORCE_CHARGE_SOURCE.reg as ModbusRegister, client);
            const forceChargeLimit = await this.readRegister('FORCE_CHARGE_LIMIT', this.batteryRegisters.FORCE_CHARGE_LIMIT.reg as ModbusRegister, client);

            const result = {
                STORAGE_CONTROL_MODE: storageControlMode,
                OPERATING_MODE: operatingMode,
                FORCE_CHARGE_POWER: forceChargePower,
                FORCE_CHARGE_DIRECTION: forceChargeDirection,
                FORCE_DISCHARGE_POWER: forceDischargePower,
                FORCE_CHARGE_SOURCE: forceChargeSource,
                FORCE_CHARGE_LIMIT: forceChargeLimit,
            };

            this.updateForceChargeCapability(result);

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

            this.log('= Polling modbus registers...');
            for (const key of Object.keys(registers)) {
                const register = registers[key] as MonitoredRegister<ModbusRegister>;

                if (!register.reg.addr) {
                    continue;
                }

                const shouldPoll = (accumulatedTime % register.pollRate) === 0;
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

                const measurements = register.reg.registers
                    .map((regKey) => results[regKey]);

                if (!measurements.every((measurement) => measurement !== undefined)) {
                    this.log(`== Skipping compound register key: ${register.reg.capability}, missing one of: ${register.reg.registers.join(', ')}`);
                    continue;
                }

                if (!measurements.every((measurement) => typeof measurement.computedValue !== 'string')) {
                    this.log(`== Skipping compound register key: ${register.reg.capability}, cannot use string values in calculations`);
                    continue;
                }

                await this.addCapability(register.reg.capability);

                const values = register.reg.registers
                    .map((regKey) => {
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
                    const [rawPower, direction] = values;
                    switch (direction) {
                        case BatteryChargeDirection.CHARGE:
                            compoundValue = -1 * rawPower;
                            break;
                        case BatteryChargeDirection.DISCHARGE:
                            compoundValue = rawPower;
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

            let detectedMode = ForceBatteryChargeMode.UNKNOWN;
            try {
                detectedMode = await this.updateForceChargeCapability(results);
            } catch (error) {
                this.log('error updating force charge capability!', (error as Error).message);
            }

            if ((accumulatedTime % 60) === 0) {
                try {
                    if (this.chargeMode !== ForceBatteryChargeMode.UNKNOWN && this.chargeMode !== detectedMode) {
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
}
