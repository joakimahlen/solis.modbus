// @ts-expect-error - Homey-log has no types
import * as HomeyLog from 'homey-log';
import Homey from 'homey';

import { PollRate, RegisterDef } from '@digistrada/modbus-core';
import {
    DetectedMode,
    ModeCommand,
    PollValues,
    SOLIS_BATTERY_REGISTERS,
    SOLIS_INVERTER_REGISTERS,
    SOLIS_METER_REGISTERS,
    SolisInverter,
    SolisMode,
    SolisRegisterKey,
    SolisScope,
    UNKNOWN_MODE,
    solisModeFromCode,
    solisModeToCode,
} from '@digistrada/inverter-modbus';
import { isNil, sum } from 'lodash';

import { ModbusLease, modbusClients } from '../lib/modbus-client';
import { Poller } from '../lib/poller';

const READ_ONLY_SETTING = 'external_ems_readonly';
const READ_ONLY_MESSAGE = 'This inverter is controlled by an external EMS (read-only); writes are disabled.';
const CONNECTION_SETTINGS = ['address', 'port', 'inverterid', READ_ONLY_SETTING];

const POWER_SETTING: Partial<Record<SolisMode, string>> = {
    CHARGE: 'force_battery_charge_power',
    DISCHARGE: 'force_battery_discharge_power',
    EXPORT: 'force_battery_export_power',
};

const DERIVED_CAPABILITIES: Record<string, string> = {
    PV1_POWER: 'measure_power.pv1',
    PV2_POWER: 'measure_power.pv2',
    PV3_POWER: 'measure_power.pv3',
    PV4_POWER: 'measure_power.pv4',
    BATTERY_POWER: 'measure_power.batt_power',
};

/** Homey adapter over `SolisInverter`: owns the connection lease and poll loop, maps values to capabilities, keeps the desired mode in settings. */
export abstract class Solis extends Homey.Device {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    homeyLog: any;
    protected inverter?: SolisInverter;
    private lease?: ModbusLease;
    private poller?: Poller;
    private desired: ModeCommand<SolisMode> | null = null;

    protected abstract readonly scope: SolisScope;

    /** Register or derived key → capability, where this device differs from the register's default. */
    protected capabilityOverrides(): Record<string, string> {
        return {};
    }

    protected abstract startDelayMs(): number;

    protected abstract onStarted(): Promise<void>;

    async onInit() {
        this.homeyLog = new HomeyLog.Log({ homey: this.homey });
        this.log(`device name id ${this.getData().id}`);
        this.log(`device name ${this.getName()}`);
        await this.startInverter();
    }

    get readOnly(): boolean {
        return this.getSetting(READ_ONLY_SETTING) === true;
    }

    protected registerKeys(): SolisRegisterKey[] {
        const inverterKeys = (Object.keys(SOLIS_INVERTER_REGISTERS) as SolisRegisterKey[]).filter((key) => key !== 'PASSIVE_MODE');
        const meterKeys = Object.keys(SOLIS_METER_REGISTERS) as SolisRegisterKey[];
        const batteryKeys = [...Object.keys(SOLIS_BATTERY_REGISTERS) as SolisRegisterKey[], 'PASSIVE_MODE' as const];
        return this.scope === 'inverter' ? [...inverterKeys, ...meterKeys] : batteryKeys;
    }

    private capabilityOf(key: string): string | undefined {
        const def = (SOLIS_INVERTER_REGISTERS as Record<string, RegisterDef>)[key]
            ?? (SOLIS_METER_REGISTERS as Record<string, RegisterDef>)[key]
            ?? (SOLIS_BATTERY_REGISTERS as Record<string, RegisterDef>)[key];
        return this.capabilityOverrides()[key] ?? def?.capability ?? DERIVED_CAPABILITIES[key];
    }

    private loadDesired(): ModeCommand<SolisMode> | null {
        const code = this.getSetting('force_battery_charge_mode');
        if (isNil(code)) {
            return null;
        }
        const mode = solisModeFromCode(Number(code));
        if (mode === UNKNOWN_MODE) {
            return null;
        }
        return { mode, powerW: this.powerFor(mode) };
    }

    private async storeDesired(command: ModeCommand<SolisMode>) {
        this.desired = command;
        this.log('= Storing charge mode', command.mode);
        await this.setSettings({ force_battery_charge_mode: solisModeToCode(command.mode) });
    }

    private powerFor(mode: SolisMode): number | undefined {
        const setting = POWER_SETTING[mode];
        const power = setting ? this.getSetting(setting) : undefined;
        return typeof power === 'number' ? power : undefined;
    }

    private async startInverter() {
        const settings = this.getSettings();
        const address = settings.address as string;
        const port = settings.port as number;
        const unitId = (settings.inverterid as number) ?? 1;
        this.log(`Connection settings: ${address}:${port} unit ${unitId}${this.readOnly ? ' (read-only)' : ''}`);

        if (!address || !port) {
            this.log('=== No connection settings configured on device. Please configure in device settings.');
            await this.setUnavailable('Please configure IP address and port in device settings.');
            return;
        }
        await this.setAvailable();
        await this.onStarted();

        const logger = { log: this.log.bind(this), error: this.error.bind(this) };
        const inverter = new SolisInverter({ scope: this.scope, readOnly: this.readOnly, logger });
        this.inverter = inverter;
        this.desired = this.loadDesired();
        this.lease = modbusClients.acquire(address, port, unitId, logger);
        this.poller = new Poller(inverter, this.lease, {
            desired: () => this.desired,
            onAdopt: (command) => this.storeDesired(command).catch((e) => this.error('Storing detected mode failed:', e)),
            onModeDetected: (mode) => this.onModeDetected(mode).catch((e) => this.error('error updating force charge capability!', e)),
            onValues: (values, elapsed) => this.onValues(values, elapsed).catch((e) => this.error('Error updating capabilities:', e)),
        }, logger);

        await this.registerListeners();
        this.poller.start(this.startDelayMs());
    }

    private stopInverter() {
        this.poller?.stop();
        this.lease?.release();
        this.poller = undefined;
        this.lease = undefined;
        this.inverter = undefined;
    }

    async onSettings({ changedKeys }: {
        oldSettings: Record<string, unknown>;
        newSettings: Record<string, unknown>;
        changedKeys: string[];
    }): Promise<void> {
        if (!changedKeys.some((k) => CONNECTION_SETTINGS.includes(k))) {
            return;
        }
        this.log('Connection settings changed, restarting polling');
        this.stopInverter();
        // New settings are applied only after onSettings returns.
        setImmediate(() => this.startInverter().catch((e) => this.error('Restart failed:', e)));
    }

    async onUninit(): Promise<void> {
        this.log(`${this.constructor.name} onUninit`);
        this.stopInverter();
    }

    async onDeleted() {
        this.log(`${this.constructor.name} has been deleted`);
        this.stopInverter();
    }

    // ---- values → capabilities ----

    private async ensureCapability(capability: string) {
        if (this.hasCapability(capability)) {
            return;
        }
        try {
            await this.addCapability(capability);
        } catch (e) {
            const { message } = e as Error;
            if (/Invalid Capability/.test(message)) {
                const oldCapability = message.split(':')[1]?.trim();
                if (oldCapability && oldCapability !== capability) {
                    this.error(`= Capability ${capability} is not supported. Was it removed? '${oldCapability}'`);
                    await this.removeCapability(oldCapability).catch((removeError) => {
                        this.error(`= Error removing old capability ${oldCapability}:`, removeError);
                    });
                }
            }
            this.error(`= Error adding capability ${capability}:`, e);
        }
    }

    private async onValues(values: PollValues, elapsedSeconds: number) {
        for (const [key, value] of Object.entries(values)) {
            const capability = this.capabilityOf(key);
            this.log(`= Read ${key} (${capability}) => ${value}`);
            if (!capability) {
                continue;
            }
            await this.ensureCapability(capability);
            await this.setCapabilityValue(capability, value);
        }

        const firmware = this.inverter?.extras().firmware;
        if (firmware && elapsedSeconds % PollRate.PRIO3 === 0) {
            const extras = this.inverter!.extras();
            this.log(`=== Firmware: ${firmware} | Model=${extras.model ?? '?'} | SN=${extras.serial ?? '?'}`);
        }

        const lastRead = this.inverter?.lastReadAt;
        if (lastRead && Object.keys(values).length > 0) {
            await this.setSettings({ last_successful_read: lastRead.toISOString() });
            if (this.scope === 'inverter') {
                await this.ensureCapability('last_successful_read');
                await this.setCapabilityValue('last_successful_read', lastRead.toISOString());
            }
        }
    }

    private async onModeDetected(mode: DetectedMode<SolisMode>) {
        // NOTE: addCapability re-initializes the capability and removes any registered capability listener,
        // so only add it when it does not exist yet.
        const code = solisModeToCode(mode);
        await this.ensureCapability('force_battery_charge_mode');
        await this.setCapabilityValue('force_battery_charge_mode', `${code}`);
        await this.ensureCapability('force_battery_charge_mode_num');
        await this.setCapabilityValue('force_battery_charge_mode_num', code);
        // While an external EMS controls the battery, its mode is the one to keep once read-only is turned off.
        if (this.readOnly && mode !== UNKNOWN_MODE && this.desired?.mode !== mode) {
            await this.storeDesired({ mode, powerW: this.powerFor(mode) });
        }
    }

    // ---- writes ----

    private assertWritable() {
        if (this.readOnly) {
            throw new Error(READ_ONLY_MESSAGE);
        }
    }

    private requireInverter(): { inverter: SolisInverter; lease: ModbusLease } {
        if (!this.inverter || !this.lease) {
            throw new Error('Inverter is not connected. Please configure IP address and port in device settings.');
        }
        return { inverter: this.inverter, lease: this.lease };
    }

    private applyDesired(command: ModeCommand<SolisMode>) {
        const { inverter, lease } = this.requireInverter();
        // A failed write stays pending and is retried by the next poll.
        inverter.apply(lease.transport, command)
            .then((result) => result !== 'applied' && this.log(`= ${command.mode} ${result}`))
            .catch((e) => this.error(`Applying ${command.mode} failed, retrying next poll:`, e));
    }

    async handleForceBatteryChargeMode(value: string | number) {
        this.assertWritable();
        const mode = solisModeFromCode(typeof value === 'string' ? Number.parseInt(value, 10) : value);
        if (mode === UNKNOWN_MODE) {
            throw new Error(`Unknown force battery charge mode: ${value}`);
        }
        this.log(`= Setting force battery mode to: ${mode}`);
        this.requireInverter();
        const command = { mode, powerW: this.powerFor(mode) };
        await this.storeDesired(command);
        this.applyDesired(command);
    }

    private async setModePower(mode: SolisMode, value: number) {
        this.assertWritable();
        const setting = POWER_SETTING[mode]!;
        await this.setSettings({ [setting]: value });
        await this.setCapabilityValue(setting, value);
        this.requireInverter();
        if (this.desired?.mode === mode) {
            this.log(`= ${mode} power changed to ${value}W, triggering rewrite`);
            await this.storeDesired({ mode, powerW: value });
            this.applyDesired({ mode, powerW: value });
        }
    }

    /** Settable capabilities that are not a single register: mode selection and per-mode power. */
    private customSetters(): Record<string, (value: string | number) => Promise<void>> {
        if (this.scope === 'inverter') {
            return {};
        }
        return {
            force_battery_charge_mode: (value) => this.handleForceBatteryChargeMode(value),
            force_battery_charge_power: (value) => this.setModePower('CHARGE', Number(value)),
            force_battery_discharge_power: (value) => this.setModePower('DISCHARGE', Number(value)),
            force_battery_export_power: (value) => this.setModePower('EXPORT', Number(value)),
        };
    }

    async writeCapability(capability: string, value: string | number) {
        const custom = this.customSetters()[capability];
        if (custom) {
            await custom(value);
            return;
        }
        const key = this.registerKeys().find((k) => this.capabilityOf(k) === capability);
        if (!key) {
            throw new Error(`Capability ${capability} is not writable on this device`);
        }
        this.assertWritable();
        const { inverter, lease } = this.requireInverter();
        await inverter.writeRaw(lease.transport, key, Number(value));
    }

    private async registerListeners() {
        const customSetters = this.customSetters();

        // Initial values for capabilities backed by settings rather than registers.
        for (const [mode, setting] of Object.entries(POWER_SETTING)) {
            const capability = setting!;
            if (!customSetters[capability]) {
                continue;
            }
            await this.ensureCapability(capability);
            const value = this.powerFor(mode as SolisMode);
            if (!isNil(value)) {
                await this.setCapabilityValue(capability, value);
            }
        }

        const settable = new Set<string>(Object.keys(customSetters));
        for (const key of this.registerKeys()) {
            const def = (SOLIS_INVERTER_REGISTERS as Record<string, RegisterDef>)[key]
                ?? (SOLIS_METER_REGISTERS as Record<string, RegisterDef>)[key]
                ?? (SOLIS_BATTERY_REGISTERS as Record<string, RegisterDef>)[key];
            const capability = this.capabilityOf(key);
            if (def?.writable && capability) {
                settable.add(capability);
            }
        }
        const capabilities = new Set<string>([
            ...settable,
            ...this.registerKeys().map((key) => this.capabilityOf(key)).filter((c): c is string => !!c),
        ]);

        for (const capability of capabilities) {
            if (settable.has(capability)) {
                this.log(`= Setting up capability listener: ${capability}`);
                this.registerCapabilityListener(capability, async (value) => {
                    this.log(`= Setting ${capability} to: `, value);
                    await this.writeCapability(capability, value);
                    return value;
                });
            }

            try {
                const conditionCard = this.homey.flow.getConditionCard(capability);
                this.log('=== Registering condition card for:', capability);
                conditionCard.registerRunListener(async (args) => {
                    // Use args.device (the device selected in the flow) instead of this,
                    // because registerRunListener is global — the last device to register wins.
                    const device = args.device || this;
                    let currentValue = await device.getCapabilityValue(capability);

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
                            this.log(`= Checking condition for ${capability} - ${args.argument_main}: ${currentValue} => ${checkResult}`);
                            return checkResult;
                        }
                        if (argument.conjunction === 'or') {
                            const checkResult = values.some((val) => val === currentValue);
                            this.log(`= Checking condition for ${capability} - ${args.argument_main}: ${currentValue} => ${checkResult}`);
                            return checkResult;
                        }
                    }

                    const checkResult = args.argument_main === currentValue;
                    this.log(`= Checking condition for ${capability} - ${args.argument_main}: ${currentValue} => ${checkResult}`);
                    return checkResult;
                });
            } catch (e) {
                if (!/Invalid Flow Card ID/.test((e as Error).message)) {
                    this.error(`= Skipping condition card for capability: ${capability} - ${(e as Error).message}`);
                }
            }

            if (settable.has(capability)) {
                try {
                    const actionCard = this.homey.flow.getActionCard(`${capability}_main`);
                    this.log('=== Registering action card for:', capability);
                    actionCard.registerRunListener(async (args) => {
                        // Use args.device (the device selected in the flow) instead of this,
                        // because registerRunListener is global — the last device to register wins.
                        const targetDevice = (args.device || this) as Solis;
                        await targetDevice.writeCapability(capability, args.argument_main);
                    });
                } catch (e) {
                    if (!/Invalid Flow Card ID/.test((e as Error).message)) {
                        this.error(`= Skipping action card for capability: ${capability} - ${(e as Error).message}`);
                    }
                }
            }
        }

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
                const lastRead = device.getSetting('last_successful_read') as string | null;
                if (!lastRead) {
                    this.log('= Checking condition for last_successful_read - never read => false');
                    return false;
                }
                const minutesAgo = (Date.now() - new Date(lastRead).getTime()) / 60000;
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
