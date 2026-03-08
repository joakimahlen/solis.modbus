import { BaseRegister, MonitoredRegister, Solis } from './solis';

export abstract class MySolisBaseDevice extends Solis {
  active = true;

  /**
  * onInit is called when the device is initialized.
  */
  async onInit() {
    await super.onInit();
    const name = this.getData().id;
    this.log(`device name id ${name}`);
    this.log(`device name ${this.getName()}`);

    this.startPolling();
  }

  abstract registers(): Record<string, MonitoredRegister<BaseRegister>>;

  abstract startPolling(): Promise<void>;
}
