import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * A custom logger class that overrides the default console methods to provide
 * colorized output and log messages to files. It supports different log levels,
 * such as info, warn, error, log, and task.
 */
class LoggerService {
  // Directory where log files will be stored
  private static logsDir = 'logs';

  // ANSI color codes for different log levels
  private static colors = {
    info: '\x1b[34m', // Blue
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
    log: '\x1b[32m', // Green
    task: '\x1b[35m', // Magenta
    reset: '\x1b[0m', // Reset to default
  };

  /**
   * Generates the filename for the current log file based on the current date.
   * The log file will be stored in the 'logs' directory.
   * @returns {string} The full path to the log file.
   */
  private static getLogFileName(): string {
    return join(this.logsDir, `${new Date().toISOString().slice(0, 10)}.log`);
  }

  /**
   * Ensures the existence of the logs directory. If the directory does not exist,
   * it will be created.
   */
  private static ensureLogsDir(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir);
    }
  }

  /**
   * Formats the log message with a log level, timestamp, and appropriate color.
   * The message will be colorized when displayed in the console.
   * @param {string} level - The log level (e.g., 'LOG', 'INFO', 'WARN', 'ERROR', 'TASK').
   * @param {unknown[]} args - The arguments to be logged.
   * @param {string} color - The ANSI color code corresponding to the log level.
   * @returns {string} The formatted log message.
   */
  private static formatMessage(
    level: string,
    args: unknown[],
    color: string
  ): string {
    const timestamp = new Date().toISOString();

    // The first argument is considered as the message with format specifiers
    let formattedMessage = typeof args[0] === 'string' ? args[0] : '';
    const additionalArgs = args.slice(1);

    // Replace %O placeholders with serialized objects
    formattedMessage = formattedMessage.replace(/%O/g, () => {
      // Use the next argument from additionalArgs for the %O placeholder
      const obj = additionalArgs.shift();
      if (typeof obj === 'object') {
        try {
          return JSON.stringify(obj, null, 2);
        } catch {
          return '[Error serializing argument]';
        }
      }
      return String(obj);
    });

    // Append remaining arguments after replacements
    const remainingArgs = additionalArgs
      .map((arg) =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(' ');

    return `${color}[${level}] ${timestamp}: ${formattedMessage}${remainingArgs}${this.colors.reset}`;
  }

  /**
   * Strips ANSI color codes from the given message. This is used to ensure
   * that log messages written to files do not include terminal-specific color codes.
   * @param {string} message - The message with ANSI color codes.
   * @returns {string} The message without any ANSI color codes.
   */
  private static stripAnsiCodes(message: string): string {
    return message.replace(/\x1b\[\d+m/g, '');
  }

  /**
   * Writes the given log message to a log file, after removing any ANSI color codes.
   * @param {string} message - The formatted log message to be written to the file.
   */
  private static writeToFile(message: string): void {
    const cleanMessage = this.stripAnsiCodes(message);
    appendFileSync(this.getLogFileName(), `${cleanMessage}\n`);
  }

  /**
   * Initializes the custom logger by overriding the console methods (log, info, warn, error)
   * to include colorized output and file logging. Adds support for a 'task' log level.
   */
  public static initialize(): void {
    this.ensureLogsDir();

    // Save original console methods
    const {
      log: originalLog,
      error: originalError,
      warn: originalWarn,
      info: originalInfo,
    } = console;

    // Override console methods with custom logger
    console.log = (...args: unknown[]) => {
      const message = this.formatMessage('LOG', args, this.colors.log);
      originalLog(message);
      this.writeToFile(message);
    };

    console.info = (...args: unknown[]) => {
      const message = this.formatMessage('INFO', args, this.colors.info);
      originalInfo(message);
      this.writeToFile(message);
    };

    console.warn = (...args: unknown[]) => {
      const message = this.formatMessage('WARN', args, this.colors.warn);
      originalWarn(message);
      this.writeToFile(message);
    };

    console.error = (...args: unknown[]) => {
      const message = this.formatMessage('ERROR', args, this.colors.error);
      originalError(message);
      this.writeToFile(message);
    };

    // Adding the 'task' log method for task-specific logging
    console.debug = (field, ...args: unknown[]) => {
      const message = this.formatMessage(field, args, this.colors.task);
      originalLog(message);
      this.writeToFile(message);
    };
  }
}

// Initialize the logger to start overriding console methods
LoggerService.initialize();

export default LoggerService;
