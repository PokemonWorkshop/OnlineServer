import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * A custom logger that overrides ALL console methods to provide
 * colorized console output and persistent log files (one per day).
 *
 * Every value — objects, Errors, nulls, numbers — is properly serialised.
 * Printf-style specifiers (%s, %d, %i, %f, %o, %O, %%) are supported.
 *
 * Log levels: LOG (green), INFO (blue), WARN (yellow), ERROR (red), DEBUG/task (magenta).
 *
 * @example
 * ```ts
 * import './logger';  // side-effect import — once at the top of src/index.ts
 * console.log('Server up');
 * console.info('Player connected:', { id: '123' });
 * console.warn('Slow query: %dms', 540);
 * console.error(new Error('DB failure'));
 * console.debug('AUTH', 'Token refreshed');  // custom task label
 * ```
 */
class Logger {
  private static readonly logsDir = 'logs';

  private static readonly colors: Record<string, string> = {
    LOG:   '\x1b[32m', // Green
    INFO:  '\x1b[34m', // Blue
    WARN:  '\x1b[33m', // Yellow
    ERROR: '\x1b[31m', // Red
    DEBUG: '\x1b[35m', // Magenta — also used for custom task labels
    reset: '\x1b[0m',
  };

  // ── File helpers ────────────────────────────────────────────────────────────

  private static getLogFileName(): string {
    return join(this.logsDir, `${new Date().toISOString().slice(0, 10)}.log`);
  }

  private static ensureLogsDir(): void {
    if (!existsSync(this.logsDir)) mkdirSync(this.logsDir, { recursive: true });
  }

  // ── Serialisation ───────────────────────────────────────────────────────────

  /** Converts any value to a human-readable string — nothing is lost. */
  private static serialize(a: unknown): string {
    if (a === null)            return 'null';
    if (a === undefined)       return 'undefined';
    if (a instanceof Error)    return `${a.name}: ${a.message}${a.stack ? '\n' + a.stack : ''}`;
    if (typeof a === 'object') {
      try { return JSON.stringify(a, null, 2); } catch { return '[Unserializable object]'; }
    }
    return String(a);
  }

  // ── Formatting ──────────────────────────────────────────────────────────────

  private static formatMessage(level: string, args: unknown[], color: string): string {
    const timestamp = new Date().toISOString();

    // If the first argument is a string it may contain printf-style specifiers
    if (typeof args[0] === 'string') {
      let message    = args[0];
      const rest     = args.slice(1);

      message = message.replace(/%[sdifoO%]/g, (spec) => {
        if (spec === '%%') return '%';
        const val = rest.shift();
        if (spec === '%o' || spec === '%O') return this.serialize(val);
        if (spec === '%d' || spec === '%i') return String(Number(val));
        if (spec === '%f')                  return String(parseFloat(String(val)));
        return this.serialize(val); // %s and fallback
      });

      // Append any remaining arguments after all specifiers have been consumed
      const tail = rest.map((a) => this.serialize(a)).join(' ');
      const body = tail ? `${message} ${tail}` : message;
      return `${color}[${level}] ${timestamp}: ${body}${this.colors.reset}`;
    }

    // First argument is not a string — serialise everything directly
    const body = args.map((a) => this.serialize(a)).join(' ');
    return `${color}[${level}] ${timestamp}: ${body}${this.colors.reset}`;
  }

  private static stripAnsi(message: string): string {
    return message.replace(/\x1b\[\d+m/g, '');
  }

  private static writeToFile(message: string): void {
    try {
      appendFileSync(this.getLogFileName(), `${this.stripAnsi(message)}\n`);
    } catch {
      // Never let logger I/O crash the server
    }
  }

  // ── Public initialiser ──────────────────────────────────────────────────────

  /**
   * Patches every `console.*` method so every message is:
   *   1. Printed to stdout/stderr with ANSI colours.
   *   2. Appended to `logs/YYYY-MM-DD.log` (ANSI stripped).
   *
   * Call **once** at the very top of `src/index.ts` via side-effect import.
   */
  public static initialize(): void {
    this.ensureLogsDir();

    const { log: origLog, info: origInfo, warn: origWarn, error: origError } = console;

    console.log = (...args: unknown[]) => {
      const msg = this.formatMessage('LOG', args, this.colors.LOG);
      origLog(msg);
      this.writeToFile(msg);
    };

    console.info = (...args: unknown[]) => {
      const msg = this.formatMessage('INFO', args, this.colors.INFO);
      origInfo(msg);
      this.writeToFile(msg);
    };

    console.warn = (...args: unknown[]) => {
      const msg = this.formatMessage('WARN', args, this.colors.WARN);
      origWarn(msg);
      this.writeToFile(msg);
    };

    console.error = (...args: unknown[]) => {
      const msg = this.formatMessage('ERROR', args, this.colors.ERROR);
      origError(msg);
      this.writeToFile(msg);
    };

    /**
     * `console.debug(label, ...args)` — first argument becomes the log-level label.
     * If the label is not a known level the line is still logged in magenta.
     * @example console.debug('DB', 'Query took %dms', 12)
     */
    console.debug = (label: unknown, ...args: unknown[]) => {
      const level = typeof label === 'string' ? label.toUpperCase() : 'DEBUG';
      const color = this.colors[level] ?? this.colors.DEBUG;
      const msg   = this.formatMessage(level, args, color);
      origLog(msg);
      this.writeToFile(msg);
    };

    // console.trace — keep browser-like behaviour but still capture to file
    console.trace = (...args: unknown[]) => {
      const msg = this.formatMessage('TRACE', args, this.colors.DEBUG);
      origLog(msg);
      this.writeToFile(msg);
    };

    // console.assert — only fires when condition is falsy
    console.assert = (condition: unknown, ...args: unknown[]) => {
      if (!condition) {
        const msg = this.formatMessage('ASSERT', args.length ? args : ['Assertion failed'], this.colors.ERROR);
        origError(msg);
        this.writeToFile(msg);
      }
    };
  }
}

Logger.initialize();

export default Logger;
