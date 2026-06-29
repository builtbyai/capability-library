/**
 * Minimal structured logger.
 * Capabilities create a scoped child so log lines carry their id automatically.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'severe';

const levelRank: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, severe: 4 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Use for unrecoverable / human-attention conditions (mirrors the PTY bridge's SEVERE). */
  severe(msg: string, fields?: Record<string, unknown>): void;
  child(scope: string): Logger;
}

class ConsoleLogger implements Logger {
  constructor(
    private scope: string,
    private min: LogLevel = (process.env.MMD_LOG_LEVEL as LogLevel) || 'info',
  ) {}

  private emit(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
    if (levelRank[level] < levelRank[this.min]) return;
    const line = { t: new Date().toISOString(), level, scope: this.scope, msg, ...(fields ?? {}) };
    const sink = level === 'error' || level === 'severe' ? console.error : console.log;
    sink(JSON.stringify(line));
  }

  debug = (m: string, f?: Record<string, unknown>) => this.emit('debug', m, f);
  info = (m: string, f?: Record<string, unknown>) => this.emit('info', m, f);
  warn = (m: string, f?: Record<string, unknown>) => this.emit('warn', m, f);
  error = (m: string, f?: Record<string, unknown>) => this.emit('error', m, f);
  severe = (m: string, f?: Record<string, unknown>) => this.emit('severe', m, f);
  child = (scope: string) => new ConsoleLogger(`${this.scope}:${scope}`, this.min);
}

export function createLogger(scope: string): Logger {
  return new ConsoleLogger(scope);
}

export const log = createLogger('multimarcdown');
