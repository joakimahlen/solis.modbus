import Homey from 'homey';
const LogToFile = require('homey-log-to-file');

class MySolisApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    await LogToFile();
    this.log('MySolisApp has been initialized');
  }
}

module.exports = MySolisApp;
