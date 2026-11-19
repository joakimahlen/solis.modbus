import Homey from 'homey';
import { logToFile } from './lib/log-to-file';
import { setupCrashReport } from './lib/crash-report';

class MySolisApp extends Homey.App {
    async onInit() {
        logToFile();
        setupCrashReport(this);
        this.log('MySolisApp has been initialized');
    }
}

module.exports = MySolisApp;
