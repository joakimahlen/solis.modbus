import Homey from 'homey';

class SolisBatteryDriver extends Homey.Driver {
  async onInit() {
    this.log('SolisBatteryDriver has been initialized');
  }

  async onPairListDevices() {
    return [];
  }
}

module.exports = SolisBatteryDriver;
