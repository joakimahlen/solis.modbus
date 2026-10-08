import Homey from 'homey';
// @ts-expect-error - homey-log-to-file has no types
import LogToFile from 'homey-log-to-file';

class MySolisApp extends Homey.App {
    async onInit() {
        await LogToFile();
        this.log('MySolisApp has been initialized');
    }
}

module.exports = MySolisApp;
