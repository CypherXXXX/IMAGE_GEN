import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

export class Logger {
  private logDir: string;
  private logFile: string;
  private errorDir: string;
  private minLevel: LogLevel;

  constructor(logDir: string, minLevel: LogLevel = LogLevel.INFO) {
    this.logDir = logDir;
    this.logFile = path.join(logDir, 'events.jsonl');
    this.errorDir = path.join(logDir, 'errors');
    this.minLevel = minLevel;

    fs.mkdirSync(this.logDir, { recursive: true });
    fs.mkdirSync(this.errorDir, { recursive: true });
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logFile, line);

    // Also console log
    const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.category}]`;
    if (entry.level === LogLevel.ERROR) {
      console.error(`${prefix} ${entry.message}`, entry.data || '');
    } else if (entry.level === LogLevel.WARN) {
      console.warn(`${prefix} ${entry.message}`, entry.data || '');
    } else {
      console.log(`${prefix} ${entry.message}`);
    }
  }

  private createEntry(level: LogLevel, category: string, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
  }

  debug(category: string, message: string, data?: any): void {
    this.write(this.createEntry(LogLevel.DEBUG, category, message, data));
  }

  info(category: string, message: string, data?: any): void {
    this.write(this.createEntry(LogLevel.INFO, category, message, data));
  }

  warn(category: string, message: string, data?: any): void {
    this.write(this.createEntry(LogLevel.WARN, category, message, data));
  }

  error(category: string, message: string, data?: any): void {
    const entry = this.createEntry(LogLevel.ERROR, category, message, data);
    this.write(entry);

    // Also save error details to separate file
    const errorFile = path.join(
      this.errorDir,
      `error_${Date.now()}.json`
    );
    fs.writeFileSync(errorFile, JSON.stringify(entry, null, 2));
  }

  getLogPath(): string {
    return this.logFile;
  }
}

// Global logger instance (initialized when batch starts)
let globalLogger: Logger | null = null;

export function initGlobalLogger(logDir: string, minLevel?: LogLevel): Logger {
  globalLogger = new Logger(logDir, minLevel);
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    // Fallback to console-based logger
    const tempDir = path.join(process.cwd(), 'logs');
    globalLogger = new Logger(tempDir);
  }
  return globalLogger;
}
