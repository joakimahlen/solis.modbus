import { dueRates, PollRate, type Logger } from '@digistrada/modbus-core';
import type { DetectedMode, ModeCommand, PollValues, SolisInverter, SolisMode } from '@digistrada/inverter-modbus';

import type { ModbusLease } from './modbus-client';

export interface PollerHooks {
    /** The mode to enforce; null until one is stored or adopted. */
    desired(): ModeCommand<SolisMode> | null;
    onAdopt(command: ModeCommand<SolisMode>): Promise<void>;
    onModeDetected(mode: DetectedMode<SolisMode>): Promise<void>;
    onValues(values: PollValues, elapsedSeconds: number): Promise<void>;
    /** Called once after every poll tick, whether it succeeded, failed, or was skipped (offline). */
    onPollComplete(): void;
}

/** Polls one device every PRIO1 seconds: due registers, then mode enforcement when it controls the battery. */
export class Poller {
    private timer?: ReturnType<typeof setTimeout>;
    private elapsedSeconds = 0;
    private running = false;
    private stopped = false;

    constructor(
        private readonly inverter: SolisInverter,
        private readonly lease: ModbusLease,
        private readonly hooks: PollerHooks,
        private readonly logger: Logger,
    ) {}

    start(startDelayMs: number): void {
        this.timer = setTimeout(() => this.loop(), startDelayMs);
    }

    stop(): void {
        this.stopped = true;
        clearTimeout(this.timer);
    }

    private async loop(): Promise<void> {
        if (this.stopped) return;
        await this.tick().catch((e) => this.logger.error('Poll failed:', e));
        if (this.stopped) return;
        this.hooks.onPollComplete();
        this.timer = setTimeout(() => this.loop(), PollRate.PRIO1 * 1000);
    }

    private async tick(): Promise<void> {
        if (this.running) return;
        if (!this.lease.online) {
            // Every tier is read again once the connection is back.
            this.elapsedSeconds = 0;
            return;
        }
        this.running = true;
        try {
            const elapsed = this.elapsedSeconds;
            this.elapsedSeconds += PollRate.PRIO1;
            const { transport } = this.lease;
            const values: PollValues = {};
            for (const rate of dueRates(elapsed)) {
                Object.assign(values, await this.inverter.read(transport, this.inverter.keysFor(rate)));
            }
            if (this.inverter.hasControl) {
                const result = await this.inverter.enforce(transport, this.hooks.desired());
                Object.assign(values, result.values);
                if (result.detected) await this.hooks.onModeDetected(result.detected);
                if (result.adopt) await this.hooks.onAdopt(result.adopt);
            }
            await this.hooks.onValues(values, elapsed);
        } finally {
            this.running = false;
        }
    }
}
