import * as fs from 'node:fs';
import * as http from 'node:http';

const LOG_FILE = '/userdata/std.log';
const OLD_LOG_FILE = '/userdata/std.log.1';
/** Per file; with one rotated file the log never takes more than 50 MB. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PORT = 8008;

/**
 * Mirrors stdout/stderr to /userdata/std.log and serves it on port 8008.
 * Rotates to std.log.1 at MAX_FILE_BYTES so the log cannot fill the disk.
 */
export function logToFile(): void {
    let fd = fs.openSync(LOG_FILE, 'w');
    let size = 0;

    const append = (chunk: string | Uint8Array): void => {
        try {
            const data = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            if (size + data.length > MAX_FILE_BYTES) {
                fs.closeSync(fd);
                fs.renameSync(LOG_FILE, OLD_LOG_FILE);
                fd = fs.openSync(LOG_FILE, 'w');
                size = 0;
            }
            fs.writeSync(fd, data);
            size += data.length;
        } catch {
            // Logging must never take the app down (e.g. ENOSPC).
        }
    };

    for (const stream of [process.stdout, process.stderr]) {
        const original = stream.write.bind(stream) as (...args: unknown[]) => boolean;
        stream.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
            append(chunk);
            return original(chunk, ...rest);
        }) as typeof stream.write;
    }

    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        const files = [OLD_LOG_FILE, LOG_FILE].filter((file) => fs.existsSync(file));
        const next = (): void => {
            const file = files.shift();
            if (!file) {
                res.end();
                return;
            }
            fs.createReadStream(file).on('error', next).on('end', next).pipe(res, { end: false });
        };
        next();
    }).listen(PORT);
}
