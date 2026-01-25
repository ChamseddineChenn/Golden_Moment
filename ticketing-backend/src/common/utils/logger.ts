import { Logger } from '@nestjs/common';

export class AppLogger extends Logger {
  error(message: string, context?: string, meta?: any) {
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    super.error(`${message}${metaStr}`, context);
  }

  warn(message: string, context?: string, meta?: any) {
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    super.warn(`${message}${metaStr}`, context);
  }

  log(message: string, context?: string, meta?: any) {
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    super.log(`${message}${metaStr}`, context);
  }

  debug(message: string, context?: string, meta?: any) {
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    super.debug(`${message}${metaStr}`, context);
  }

  verbose(message: string, context?: string, meta?: any) {
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    super.verbose(`${message}${metaStr}`, context);
  }
}
