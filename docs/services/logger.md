# Logger Service

## Overview

The logger service provides a centralized logging mechanism for the entire application. It uses the Winston logging library to handle various log levels, formats, and destinations. Having a dedicated logging service ensures consistent log formatting, proper error tracking, and the ability to adjust logging behavior application-wide.

## File Location

`src/services/logger.ts`

## Dependencies

- **winston**: Core logging library
- **fs-extra**: For ensuring log directories exist
- **path**: For resolving log file paths

## Implementation Details

The logger service is implemented as a Winston logger instance with the following features:

1. **Multiple Log Levels**: Supports different levels (error, warn, info, debug) for appropriate message categorization
2. **Console Output**: Logs to the console with colored output for better readability
3. **File Output**: Logs to files in the logs directory, with separate files for errors
4. **Timestamps**: All logs include timestamps in YYYY-MM-DD HH:mm:ss format
5. **Error Stack Traces**: Error objects include stack traces for better debugging
6. **JSON Format**: Logs are stored in structured JSON format for potential automated processing

```typescript
// Example implementation
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'youtube-video-processor' },
  transports: [
    new winston.transports.Console({
      /* console format */
    }),
    new winston.transports.File({
      /* error log config */
    }),
    new winston.transports.File({
      /* combined log config */
    }),
  ],
});
```

## Usage

The logger service is exported as a default export and can be imported and used throughout the application:

```typescript
import logger from './services/logger';

// Different log levels
logger.error('Critical error occurred', { errorDetails });
logger.warn('Warning: Some issue might need attention');
logger.info('Process completed successfully');
logger.debug('Detailed information for debugging purposes');

// Logging errors with stack traces
try {
  // Some operation that might fail
} catch (error) {
  logger.error('Operation failed', { error });
}
```

## Log Levels

The logger supports the following log levels (in order of severity):

1. **Error**: Critical issues that require immediate attention
2. **Warn**: Potential issues or unexpected behavior that doesn't stop the application
3. **Info**: General informational messages about application flow
4. **Debug**: Detailed information useful for development and troubleshooting

The actual log level used by the application is determined by the `LOG_LEVEL` environment variable, defaulting to 'info' if not specified. This allows adjusting the verbosity of logs without code changes.

## Log Storage

Logs are stored in the following locations:

1. **Console**: All logs at or above the configured level
2. **Error Log File**: `logs/error.log` contains only error-level messages
3. **Combined Log File**: `logs/combined.log` contains all logs at or above the configured level

The log files are created and managed automatically. They will grow indefinitely, so in a production environment, you might want to implement log rotation.

## Design Considerations

1. **Centralized Configuration**: A single logger instance is shared across the application to ensure consistent logging behavior.

2. **Environment-Based Configuration**: Log level can be adjusted via environment variables, allowing different verbosity in different environments.

3. **Structured Logging**: Using JSON format enables potentially parsing and analyzing logs programmatically.

4. **Error Handling**: Special handling for error objects to ensure stack traces are included.

5. **Multiple Outputs**: Console logs for immediate feedback during development, file logs for persistence.

## Common Issues

1. **Log Volume**: Debug-level logging can generate large volumes of logs, potentially affecting performance or disk space.

2. **Sensitive Information**: Be careful not to log sensitive information such as credentials or personal data.

## Future Improvements

1. **Log Rotation**: Implement log rotation to manage file sizes in long-running deployments.

2. **Remote Logging**: Add support for sending logs to remote monitoring services.

3. **Context Preservation**: Enhance the logger to maintain context across asynchronous operations.

4. **Performance Metrics**: Integrate with performance monitoring tools.
