import { BaseRegister, MonitoredRegister } from '../solis';

import { MySolisBaseDevice } from '../basedevice';

export default class MySolisBatteryDevice extends MySolisBaseDevice {

  registers(): Record<string, MonitoredRegister<BaseRegister>> {
    return {
      ...this.inverterRegisters,
      ...this.batteryRegisters,
      ...this.meterRegisters,
    };
  }
}

module.exports = MySolisBatteryDevice;
