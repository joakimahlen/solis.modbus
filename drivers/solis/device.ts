import { BaseRegister, MonitoredRegister } from '../solis';

import { MySolisBaseDevice } from '../basedevice';

export class MySolisDevice extends MySolisBaseDevice {

  registers(): Record<string, MonitoredRegister<BaseRegister>> {
    return this.inverterRegisters;
  }
}
