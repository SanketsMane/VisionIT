import path from 'node:path';
import winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;

const LOG_DIR = path.resolve(process.cwd(), 'logs');

const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level}: ${stack || message}${extra}`;
});

/**
 * Console transport for humans in dev; rotating JSON files for machines in prod.
 * `LOG_LEVEL` is read lazily from process.env so this module stays importable
 * from `env.ts`'s failure path without a circular dependency.
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'vision-it-infra-api' },
  format: combine(errors({ stack: true }), splat(), timestamp()),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat,
      ),
    }),
    new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      format: combine(timestamp(), json()),
    }),
    new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      format: combine(timestamp(), json()),
    }),
  ],
  exitOnError: false,
});

/** Morgan pipes HTTP access lines through winston at `http` level. */
export const httpLogStream = {
  write: (message: string) => logger.log('http', message.trim()),
};

export default logger;
