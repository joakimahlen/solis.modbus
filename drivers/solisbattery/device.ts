import { PollRate } from '@digistrada/modbus-core';
import { SolisScope } from '@digistrada/inverter-modbus';

import { Solis } from '../solis';

export default class SolisBatteryDevice extends Solis {
    protected readonly scope: SolisScope = 'battery';

    protected capabilityOverrides(): Record<string, string> {
        // BATTERY_POWER is the primary power for this device.
        return { BATTERY_POWER: 'measure_power' };
    }

    /**
     * The control registers the rewrite mechanism reads every tick (so "available" means "I can still
     * read what I need to protect the battery"), plus SOC as the core telemetry. All are polled well
     * inside the staleness window: the control snapshot every tick, SOC every PRIO3 cycle.
     */
    protected criticalKeys(): readonly string[] {
        return ['STORAGE_CONTROL_MODE', 'FORCE_CHARGE_DIRECTION', 'FORCE_CHARGE_POWER', 'FORCE_DISCHARGE_POWER', 'MEASURE_BATTERY'];
    }

    protected startDelayMs(): number {
        // Staggers this device's poll with the inverter device on the shared connection.
        return (PollRate.PRIO1 / 2) * 1000;
    }

    protected async onStarted(): Promise<void> {}
}

module.exports = SolisBatteryDevice;
