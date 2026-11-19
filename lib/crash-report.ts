import * as fs from 'node:fs';
import type Homey from 'homey';

const CRASH_FILE = '/userdata/last-crash.txt';
const RUNNING_FILE = '/userdata/running';
const MEMORY_LOG_INTERVAL_MS = 10 * 60 * 1000;
/** A crash loop must not flood the timeline. */
const MIN_NOTIFICATION_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Records why the previous run ended and reports it on the next start:
 * - an uncaught exception, or any other non-zero exit, is logged with its stack, saved to CRASH_FILE on
 *   exit and posted as a timeline notification on the next start. (Unhandled rejections do not crash
 *   the app: homey-log's Raven handler reports them to Sentry and the process keeps running.)
 * - a run that ended without an 'exit' event (SIGKILL/SIGTERM: memory limit, app update, reboot)
 *   is detected via RUNNING_FILE and logged; the periodic memory line shows whether memory was growing.
 */
export function setupCrashReport(app: Homey.App): void {
    let firstError: string | undefined;

    // Monitor only: does not change Node's default crash behaviour, so Homey still restarts the app.
    process.on('uncaughtExceptionMonitor', (error, origin) => {
        const report = `${new Date().toISOString()} ${origin}: ${error?.stack ?? String(error)}`;
        console.error(`=== Uncaught ${report}`);
        firstError ??= report;
    });
    process.on('exit', (code) => {
        console.error(`=== Process exit, code ${code}`);
        // Exit code 0 means the exception was handled and the run ended normally: not a crash.
        if (code !== 0) {
            try {
                fs.writeFileSync(CRASH_FILE, firstError ?? `${new Date().toISOString()} exit: process exited with code ${code}`);
            } catch {
                // Nothing more we can do.
            }
        }
        try {
            fs.rmSync(RUNNING_FILE, { force: true });
        } catch {
            // Ignore.
        }
    });

    const crash = readAndRemove(CRASH_FILE);
    const wasRunning = fs.existsSync(RUNNING_FILE);
    try {
        fs.writeFileSync(RUNNING_FILE, new Date().toISOString());
    } catch {
        // Diagnostics must never stop the app from starting (e.g. ENOSPC).
    }

    if (crash) {
        app.error(`=== Previous run crashed: ${crash}`);
        const lastNotified = Number(app.homey.settings.get('lastCrashNotification')) || 0;
        if (Date.now() - lastNotified >= MIN_NOTIFICATION_INTERVAL_MS) {
            app.homey.settings.set('lastCrashNotification', Date.now());
            const firstLine = crash.split('\n')[0].replace(/^\S+ /, ''); // drop the timestamp
            app.homey.notifications
                .createNotification({ excerpt: `Solis Modbus crashed and was restarted: ${firstLine}`.slice(0, 300) })
                .catch((err: unknown) => app.error('=== Could not post crash notification', err));
        }
    } else if (wasRunning) {
        app.error('=== Previous run ended without an exit event (SIGKILL/SIGTERM: memory limit, app update or reboot)');
    }

    app.homey.setInterval(() => {
        const m = process.memoryUsage();
        const mb = (n: number): string => (n / 1024 / 1024).toFixed(1);
        app.log(`=== Memory rss=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB external=${mb(m.external)}MB`);
    }, MEMORY_LOG_INTERVAL_MS);
}

function readAndRemove(file: string): string | undefined {
    try {
        const text = fs.readFileSync(file, 'utf8');
        fs.rmSync(file, { force: true });
        return text;
    } catch {
        return undefined;
    }
}
