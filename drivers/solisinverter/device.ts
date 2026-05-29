import { BaseRegister, MonitoredRegister } from '../solis';
import { MySolisBaseDevice } from '../basedevice';
import { HelperService } from '../../helper';
import { acquireConnection, ConnectionHandle } from '../connection-manager';

export default class SolisInverterDevice extends MySolisBaseDevice {

  private connectionHandle?: ConnectionHandle;

  protected hasBatteryControl(): boolean {
    return false;
  }

  private getConnectionSettings() {
    const settings = this.getSettings();
    return {
      address: settings.address as string,
      port: settings.port as number,
      unitId: (settings.inverterid as number) ?? 1,
    };
  }

  registers(): Record<string, MonitoredRegister<BaseRegister>> {
    return {
      ...this.inverterRegisters,
      ...this.meterRegisters,
    };
  }

  /**
   * Battery-only capabilities that older app versions may have added to the
   * inverter device via addCapability (Homey persists these in the device
   * store). The inverter driver neither declares them nor registers listeners
   * for them, so they show up as dead selectors that throw
   * "Missing Capability Listener" when tapped. Remove any that linger.
   */
  private async removeLeftoverBatteryCapabilities() {
    const leftover = ['force_battery_charge_mode', 'force_battery_charge_mode_num'];
    for (const cap of leftover) {
      if (this.hasCapability(cap)) {
        this.log(`Removing leftover battery capability from inverter device: ${cap}`);
        await this.removeCapability(cap).catch((e) => this.error(`Failed removing leftover capability ${cap}:`, e));
      }
    }
  }

  async startPolling() {
    this.log('startPolling (solisinverter)');

    await this.removeLeftoverBatteryCapabilities();

    const { address, port, unitId } = this.getConnectionSettings();
    this.log(`Connection settings: ${address}:${port} unit ${unitId}`);

    if (!address || !port) {
      this.log('=== No connection settings configured on device. Please configure in device settings.');
      await this.setUnavailable('Please configure IP address and port in device settings.');
      return;
    }

    await this.setAvailable();

    // Build register map with capability remapping:
    // - PV_POWER → measure_power (primary power for this device)
    // - ACTIVE_POWER → measure_power.active (inverter AC output)
    // - Remove PASSIVE_MODE (battery device handles it)
    const { PASSIVE_MODE, PV_POWER, ACTIVE_POWER, ...restInverterRegisters } = this.inverterRegisters;

    const registers: Record<string, MonitoredRegister<BaseRegister>> = {
      ...restInverterRegisters,
      ...this.meterRegisters,
      PV_POWER: {
        ...PV_POWER,
        reg: { ...PV_POWER.reg, capability: 'measure_power' },
      },
      ACTIVE_POWER: {
        ...ACTIVE_POWER,
        reg: { ...ACTIVE_POWER.reg, capability: 'measure_power.active' },
      },
    };

    this.connectionHandle = acquireConnection(address, port, unitId, this.log.bind(this));
    const { client } = this.connectionHandle;

    this.registerListeners(client, registers);

    this.connectionHandle.onConnect(async () => {
      this.log('=== Connected!');
      await HelperService.delay(2500);
      this.active = true;
      this.poll(client, registers, () => this.active);
    });
  }

  async onSettings({ changedKeys }: {
    oldSettings: Record<string, unknown>;
    newSettings: Record<string, unknown>;
    changedKeys: string[];
  }): Promise<void> {
    const connectionKeys = ['address', 'port', 'inverterid'];
    if (!changedKeys.some((k) => connectionKeys.includes(k))) {
      return;
    }
    this.log('Connection settings changed, restarting polling');
    this.active = false;
    this.isPolling = false;
    this.connectionHandle?.release();
    this.connectionHandle = undefined;
    setImmediate(() => this.startPolling());
  }

  async onUninit(): Promise<void> {
    this.log('SolisInverterDevice onUninit');
    this.active = false;
    this.connectionHandle?.release();
  }

  async onDeleted() {
    this.log('SolisInverterDevice has been deleted');
    this.isPolling = false;
    this.active = false;
    this.connectionHandle?.release();
  }
}

module.exports = SolisInverterDevice;
