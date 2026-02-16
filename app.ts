import Homey from 'homey';
const LogToFile = require('homey-log-to-file');

class MySolisApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    await LogToFile();
    this.log('MySolisApp has been initialized');

    // Set default app-level connection settings if not yet configured
    if (!this.homey.settings.get('port')) {
      this.homey.settings.set('port', 502);
    }
    if (this.homey.settings.get('inverterid') == null) {
      this.homey.settings.set('inverterid', 1);
    }
  }
}

module.exports = MySolisApp;
