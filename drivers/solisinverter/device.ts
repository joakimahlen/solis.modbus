import { SolisScope } from '@digistrada/inverter-modbus';

import { Solis } from '../solis';

export default class SolisInverterDevice extends Solis {
    protected readonly scope: SolisScope = 'inverter';

    protected capabilityOverrides(): Record<string, string> {
        return {
            // PV_POWER is the primary power for this device; ACTIVE_POWER is the inverter AC output.
            PV_POWER: 'measure_power',
            ACTIVE_POWER: 'measure_power.active',
        };
    }

    /** The inverter's core live telemetry, both polled every PRIO1 cycle. */
    protected criticalKeys(): readonly string[] {
        return ['ACTIVE_POWER', 'PV_POWER'];
    }

    protected startDelayMs(): number {
        return 2500;
    }

    /**
     * Battery-only capabilities that older app versions may have added to the
     * inverter device via addCapability (Homey persists these in the device
     * store). The inverter driver neither declares them nor registers listeners
     * for them, so they show up as dead selectors that throw
     * "Missing Capability Listener" when tapped. Remove any that linger.
     */
    protected async onStarted(): Promise<void> {
        const leftover = ['force_battery_charge_mode', 'force_battery_charge_mode_num'];
        for (const cap of leftover) {
            if (this.hasCapability(cap)) {
                this.log(`Removing leftover battery capability from inverter device: ${cap}`);
                await this.removeCapability(cap).catch((e) => this.error(`Failed removing leftover capability ${cap}:`, e));
            }
        }
    }
}

module.exports = SolisInverterDevice;
