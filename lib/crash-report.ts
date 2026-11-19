import * as fs from 'node:fs';
import * as v8 from 'node:v8';
import type Homey from 'homey';

const CRASH_FILE = '/userdata/last-crash.txt';
const RUNNING_FILE = '/userdata/running';
const MEMORY_LOG_INTERVAL_MS = 10 * 60 * 1000;
/** A crash loop must not flood the timeline. */
const MIN_NOTIFICATION_INTERVAL_MS = 60 * 60 * 1000;

const mb = (bytes: number): string => (bytes / 1024 / 1024).toFixed(1);

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
        try {
            const lastNotified = Number(app.homey.settings.get('lastCrashNotification')) || 0;
            const elapsed = Date.now() - lastNotified;
            if (elapsed < 0 || elapsed >= MIN_NOTIFICATION_INTERVAL_MS) { // < 0: clock went backwards
                // Set before posting: a crash loop may kill the app before the post resolves.
                app.homey.settings.set('lastCrashNotification', Date.now());
                const firstLine = crash.split('\n')[0].replace(/^\S+ /, '').slice(0, 250); // drop the timestamp
                app.homey.notifications
                    .createNotification({ excerpt: `Solis Modbus crashed and was restarted: ${firstLine}` })
                    .catch((err: unknown) => app.error('=== Could not post crash notification', err));
                app.homey.flow
                    .getTriggerCard('app_crashed')
                    .trigger({ error: firstLine })
                    .catch((err: unknown) => app.error('=== Could not fire app_crashed flow trigger', err));
            }
        } catch (err) {
            app.error('=== Could not prepare crash notification', err);
        }
    } else if (wasRunning) {
        app.error('=== Previous run ended without an exit event (SIGKILL/SIGTERM: memory limit, app update or reboot)');
    }

    // process.memoryUsage() (and its .rss()) throws ENOENT in Homey's sandbox, which cannot read RSS; v8 heap stats can.
    // peakRSS comes from getrusage(2), not /proc; guarded separately so heap stats log regardless.
    const logMemory = (): void => {
        let line: string;
        try {
            const h = v8.getHeapStatistics();
            let peakRss = 'n/a';
            try {
                peakRss = `${mb(process.resourceUsage().maxRSS * 1024)}MB`; // maxRSS is in KB
            } catch {
                // Unavailable in this sandbox.
            }
            line = `=== Memory heapUsed=${mb(h.used_heap_size)}MB heapTotal=${mb(h.total_heap_size)}MB `
                + `external=${mb(h.external_memory)}MB heapLimit=${mb(h.heap_size_limit)}MB peakRSS=${peakRss}`;
        } catch (err) {
            app.homey.clearInterval(memoryTimer);
            app.error('=== Memory stats unavailable, stopping memory log', err);
            return;
        }
        app.log(line);
    };
    const memoryTimer = app.homey.setInterval(logMemory, MEMORY_LOG_INTERVAL_MS);
    logMemory();
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
