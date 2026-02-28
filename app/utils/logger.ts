type LogContext = Record<string, unknown> | unknown;

function emit(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: LogContext) {
  if (context === undefined) {
    switch (level) {
      case 'debug':
        console.debug(message);
        return;
      case 'info':
        console.info(message);
        return;
      case 'warn':
        console.warn(message);
        return;
      case 'error':
        console.error(message);
        return;
    }
  }

  switch (level) {
    case 'debug':
      console.debug(message, context);
      break;
    case 'info':
      console.info(message, context);
      break;
    case 'warn':
      console.warn(message, context);
      break;
    case 'error':
      console.error(message, context);
      break;
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    emit('debug', message, context);
  },
  info(message: string, context?: LogContext) {
    emit('info', message, context);
  },
  warn(message: string, context?: LogContext) {
    emit('warn', message, context);
  },
  error(message: string, context?: LogContext) {
    emit('error', message, context);
  },
};
