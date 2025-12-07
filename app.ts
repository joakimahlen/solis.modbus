import Homey from 'homey';

class MySolisApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MySolisApp has been initialized');
  }
}

module.exports = MySolisApp;
