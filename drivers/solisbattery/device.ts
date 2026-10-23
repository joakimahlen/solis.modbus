import { PollRate } from '@digistrada/modbus-core';
import { SolisScope } from '@digistrada/inverter-modbus';

import { Solis } from '../solis';

export default class SolisBatteryDevice extends Solis {
    protected readonly scope: SolisScope = 'battery';

    protected capabilityOverrides(): Record<string, string> {
        // BATTERY_POWER is the primary power for this device.
        return { BATTERY_POWER: 'measure_power' };
    }

    protected startDelayMs(): number {
        // Staggers this device's poll with the inverter device on the shared connection.
        return (PollRate.PRIO1 / 2) * 1000;
    }

    protected async onStarted(): Promise<void> {}
}

module.exports = SolisBatteryDevice;
