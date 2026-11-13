import Homey from 'homey';
import { logToFile } from './lib/log-to-file';

class MySolisApp extends Homey.App {
    async onInit() {
        logToFile();
        this.log('MySolisApp has been initialized');
    }
}

module.exports = MySolisApp;
