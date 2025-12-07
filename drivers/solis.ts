import Homey from 'homey';
/* eslint-disable indent */
import { Measurement } from './measurement';

export const DEVICE_STORAGE_WORKING_MODES: { [key: string]: string } = {
    0x0001: 'UPS',
    0x0002: 'Self use',
    0x0004: 'TOU Self use',
    0x0008: 'Feed in priority',
    0x0010: 'TOU Feed in priority',
    0x0020: 'Backup',
    0x0040: 'Off-grid',
};

export const DEVICE_MODEL_DEFINITIONS: { [key: string]: string } = {
    0x0000: 'No definition',
    0x1010: '1 phase grid-tied inverter (Models 0.7-8K1P / 7-10K1P)',
    0x1020: '3 phase grid-tied inverter (Models 3-20K 3P)',
    0x1021: '3 phase grid-tied inverter (Models 25-50K/50-70K/80-110K/90-136K/125K/250K)',
    0x1070: 'External EPM device',
    0x2030: '1 phase LV Hybrid inverter',
    0x2031: '1 phase LV AC Couple energy storage inverter',
    0x2032: '5-15kWh all in one hybrid',
    0x2040: '1 phase HV Hybrid inverter',
    0x2050: '3 phases LV Hybrid inverter',
    0x2060: '3 phases HV Hybrid inverter 5G',
    0x2070: 'S6 3PH HV 5-10Kw Hybrid',
    0x2071: 'S6 3PH HV 12-20kW Hybrid',
    0x2072: 'S6 3PH LV 10-15kW Hybrid',
    0x2073: 'S6 3PH HV 50kW Hybrid',
    0x2171: 'S6 3PH HV 15kW Hybrid',
    0x2080: '1 phase HV Hybrid inverter S6',
    0x2090: '1 phase LV Hybrid inverter S6',
    0x2091: 'S6 1PH LV AC Coupled Hybrid',
    0x3010: 'OGI Off-grid inverter',
    0x3020: 'S6 1PH LV Off Grid Hybrid',
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

export interface ModbusRegister {
    type: MRType;
    addr: number;
    len: number;
    dtype: string;
    scale: number;
    capability?: string;
    operation: Operation;
}

export class Solis extends Homey.Device {
    inverterRegisters: Record<string, ModbusRegister> = {
        inputPower: { type: MRType.INPUT, addr: 33057, len: 2, dtype: 'UINT32', scale: 0, capability: 'measure_power', operation: Operation.DIRECT },
        PHASE_A_VOLTAGE: { type: MRType.INPUT, addr: 33073, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.phase1', operation: Operation.DIRECT },
        PHASE_B_VOLTAGE: { type: MRType.INPUT, addr: 33074, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.phase2', operation: Operation.DIRECT },
        PHASE_C_VOLTAGE: { type: MRType.INPUT, addr: 33075, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.phase3', operation: Operation.DIRECT },
        PHASE_A_CURRENT: { type: MRType.INPUT, addr: 33076, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.phase1', operation: Operation.DIRECT },
        PHASE_B_CURRENT: { type: MRType.INPUT, addr: 33077, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.phase2', operation: Operation.DIRECT },
        PHASE_C_CURRENT: { type: MRType.INPUT, addr: 33078, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.phase3', operation: Operation.DIRECT },
        PHASE_A_POWER: { type: MRType.INPUT, addr: 33512, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase1', operation: Operation.DIRECT },
        PHASE_B_POWER: { type: MRType.INPUT, addr: 33515, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase2', operation: Operation.DIRECT },
        PHASE_C_POWER: { type: MRType.INPUT, addr: 33518, len: 1, dtype: 'INT16', scale: 1, capability: 'measure_power.grid_phase3', operation: Operation.DIRECT },
        ACTIVE_POWER: { type: MRType.INPUT, addr: 33079, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power.active_power', operation: Operation.DIRECT },
        INTERNAL_TEMPERATURE: { type: MRType.INPUT, addr: 33093, len: 1, dtype: 'INT16', scale: -1, capability: 'measure_temperature.inverter', operation: Operation.DIRECT },
        DEVICE_STATUS: { type: MRType.INPUT, addr: 33095, len: 1, dtype: 'UINT16', scale: 0, capability: 'solis_status', operation: Operation.STATUS },
        modelName: { type: MRType.INPUT, addr: 35000, len: 1, dtype: 'UINT16', scale: 0, capability: 'solis_model', operation: Operation.MODEL },
        PV1voltage: { type: MRType.INPUT, addr: 33049, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.pv1', operation: Operation.DIRECT },
        PV1current: { type: MRType.INPUT, addr: 33050, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.pv1', operation: Operation.DIRECT },
        PV2voltage: { type: MRType.INPUT, addr: 33051, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.pv2', operation: Operation.DIRECT },
        PV2current: { type: MRType.INPUT, addr: 33052, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.pv2', operation: Operation.DIRECT },
        PV3voltage: { type: MRType.INPUT, addr: 33053, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.pv3', operation: Operation.DIRECT },
        PV3current: { type: MRType.INPUT, addr: 33054, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.pv3', operation: Operation.DIRECT },
        PV4voltage: { type: MRType.INPUT, addr: 33055, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_voltage.pv4', operation: Operation.DIRECT },
        PV4current: { type: MRType.INPUT, addr: 33056, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.pv4', operation: Operation.DIRECT },
    };

    meterRegisters: Record<string, ModbusRegister> = {
        GRID_IMPORTED_ENERGY: { type: MRType.INPUT, addr: 33169, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power.grid_import', operation: Operation.DIRECT },
        GRID_EXPORTED_ENERGY: { type: MRType.INPUT, addr: 33173, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power.grid_export', operation: Operation.DIRECT },
        GRID_IMPORTED_ENERGY_DAILY: { type: MRType.INPUT, addr: 33171, len: 2, dtype: 'UINT16', scale: -1, capability: 'meter_power.grid_import_daily', operation: Operation.DIRECT },
        GRID_EXPORTED_ENERGY_DAILY: { type: MRType.INPUT, addr: 33175, len: 2, dtype: 'UINT16', scale: -1, capability: 'meter_power.grid_export_daily', operation: Operation.DIRECT },
        ACCUMULATED_YIELD_ENERGY: { type: MRType.INPUT, addr: 33029, len: 2, dtype: 'UINT32', scale: 0, capability: 'meter_power', operation: Operation.DIRECT },
        DAILY_YIELD_ENERGY: { type: MRType.INPUT, addr: 33035, len: 1, dtype: 'UINT16', scale: -1, capability: 'meter_power.daily', operation: Operation.DIRECT },
    };

    batteryRegisters: Record<string, ModbusRegister> = {
        BATTERY_POWER: { type: MRType.INPUT, addr: 33149, len: 2, dtype: 'INT32', scale: 0, capability: 'measure_power.batt_power', operation: Operation.DIRECT },
        BATTERY: { type: MRType.INPUT, addr: 33139, len: 1, dtype: 'UINT16', scale: 0, capability: 'battery', operation: Operation.DIRECT },
        MEASURE_BATTERY: { type: MRType.INPUT, addr: 33139, len: 1, dtype: 'UINT16', scale: 0, capability: 'measure_battery', operation: Operation.DIRECT },
        STORAGE_CURRENT_DAY_CHARGE_CAPACITY: { type: MRType.INPUT, addr: 33163, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT },
        STORAGE_CURRENT_DAY_DISCHARGE_CAPACITY: { type: MRType.INPUT, addr: 33167, len: 1, dtype: 'UINT16', scale: -1, operation: Operation.DIRECT },
        STORAGE_TOTAL_CHARGE: { type: MRType.INPUT, addr: 33161, len: 2, dtype: 'UINT32', scale: 0, operation: Operation.DIRECT },
        STORAGE_TOTAL_DISCHARGE: { type: MRType.INPUT, addr: 33165, len: 2, dtype: 'UINT32', scale: 0, operation: Operation.DIRECT },
        STORAGE_MAXIMUM_CHARGE_POWER: { type: MRType.HOLDING, addr: 43012, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.chargesetting', operation: Operation.DIRECT },
        STORAGE_MAXIMUM_DISCHARGE_POWER: { type: MRType.HOLDING, addr: 43013, len: 1, dtype: 'UINT16', scale: -1, capability: 'measure_current.dischargesetting', operation: Operation.DIRECT },
        STORAGE_RATED_CAPACITY: { type: MRType.INPUT, addr: 43019, len: 1, dtype: 'UINT16', scale: 0, operation: Operation.DIRECT },
        STORAGE_CONTROL_MODE: { type: MRType.HOLDING, addr: 43110, len: 1, dtype: 'UINT16', scale: 0, capability: 'storage_control_mode', operation: Operation.STORAGE_CONTROL },
        ALLOW_GRIDCHARGE: { type: MRType.HOLDING, addr: 43110, len: 1, dtype: 'UINT16', scale: 0, capability: 'storage_allow_gridcharge', operation: Operation.ALLOW_GRIDCHARGE },
        STORAGE_WORKING_MODE: { type: MRType.INPUT, addr: 33122, len: 1, dtype: 'UINT16', scale: 0, capability: 'storage_working_mode_settings', operation: Operation.TOSTRING },
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

            case Operation.ALLOW_GRIDCHARGE:
                return (numValue >> 5) & 1;

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

    async addCapabilities(capabilities: string[]): Promise<void[]> {
        const promises = capabilities
            .map((capability) => this.addCapability(capability));

        return Promise.all(promises);
    }

    async setCapabilityValues(result: Record<string, Measurement>): Promise<void[]> {
        const promises = Object.keys(result).map(async (k) => {
            const measurement = result[k];
            console.log('solis: ', k, measurement.value, measurement.scale);

            if (measurement.value !== '-1' && measurement.value !== 'xxx') {
                const convertedValue = Solis.applyOperation(measurement, measurement.operation);

                console.log(`Setting '${measurement.capability}' to`, convertedValue);
                return this.setCapabilityValue(measurement.capability, convertedValue)
                    .catch((e) => {
                        console.error('Error setting capability value for', measurement.capability, (e as Error).message);
                        return Promise.resolve();
                    });
            }
            console.log('=== Skipping measurement', measurement);
            return Promise.resolve();

        });

        return Promise.all(promises);
    }
}
