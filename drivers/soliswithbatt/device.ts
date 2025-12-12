import { MonitoredRegister } from '../solis';
import { MySolisBaseDevice } from '../basedevice';

export default class MySolisBatteryDevice extends MySolisBaseDevice {

  registers(): Record<string, MonitoredRegister> {
    return {
      ...this.inverterRegisters,
      ...this.batteryRegisters,
      ...this.meterRegisters,
    };
  }
}

module.exports = MySolisBatteryDevice;
