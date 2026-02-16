import Homey from 'homey';

class SolisInverterDriver extends Homey.Driver {
  async onInit() {
    this.log('SolisInverterDriver has been initialized');
  }

  async onPairListDevices() {
    return [];
  }
}

module.exports = SolisInverterDriver;
