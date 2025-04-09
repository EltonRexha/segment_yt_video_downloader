# Application Configuration

## Overview

The application configuration centralizes all configurable aspects of the YouTube Video Processor. It provides a consistent way to manage settings across the application, supporting both environment variables and command-line arguments. This centralized approach makes the application more flexible and easier to manage in different environments.

## File Location

`src/config.ts`

## Dependencies

- **dotenv**: For loading environment variables from `.env` file
- **path**: For resolving file paths

## Configuration Properties

The configuration object (`AppConfig` interface) includes the following properties:

### `concurrency: number`

Number of videos to process in parallel.

- **Default Value**: 2
- **Environment Variable**: `CONCURRENCY`
- **Command-line Argument**: `--concurrency <number>` or `-c <number>`
- **Purpose**: Controls the level of parallelism in video processing to balance performance and resource usage.

### `outputDir: string`

Directory where processed video segments will be saved.

- **Default Value**: `./output` (resolved to absolute path)
- **Environment Variable**: `OUTPUT_DIR`
- **Command-line Argument**: `--output <directory>` or `-o <directory>`
- **Purpose**: Specifies where the final segmented videos will be stored.

### `tempDir: string`

Temporary directory for downloaded videos before processing.

- **Default Value**: `./temp` (resolved to absolute path)
- **Environment Variable**: `TEMP_DIR`
- **Command-line Argument**: `--temp <directory>` or `-t <directory>`
- **Purpose**: Specifies where downloaded videos are temporarily stored before segmentation.

### `logLevel: string`

The logging level for the application.

- **Default Value**: 'info'
- **Environment Variable**: `LOG_LEVEL`
- **Purpose**: Controls the verbosity of logging. Valid values are 'error', 'warn', 'info', and 'debug'.

## Implementation Details

The configuration is loaded in the following order of precedence:

1. Command-line arguments (highest priority)
2. Environment variables
3. Default values (lowest priority)

```typescript
// Load environment variables from .env file
config();

// Default configuration
const defaultConfig: AppConfig = {
  concurrency: 2,
  outputDir: path.resolve(process.cwd(), 'output'),
  tempDir: path.resolve(process.cwd(), 'temp'),
  logLevel: 'info',
};

// Read from environment variables
const appConfig: AppConfig = {
  concurrency: parseInt(
    process.env.CONCURRENCY || `${defaultConfig.concurrency}`,
    10
  ),
  outputDir: process.env.OUTPUT_DIR || defaultConfig.outputDir,
  tempDir: process.env.TEMP_DIR || defaultConfig.tempDir,
  logLevel: process.env.LOG_LEVEL || defaultConfig.logLevel,
};

// Later, command-line arguments override these values
```

## Usage

The configuration is imported and used throughout the application:

```typescript
import config from './config';

// Use configuration values
await fs.ensureDir(config.outputDir);
await fs.ensureDir(config.tempDir);

// Process videos with configured concurrency
for (let i = 0; i < videos.length; i += config.concurrency) {
  const batch = videos.slice(i, i + config.concurrency);
  // Process batch...
}
```

## Command-line Arguments

The application uses the `commander` library to parse command-line arguments:

```typescript
const program = new Command();
program
  .option(
    '-c, --concurrency <number>',
    'Number of videos to process in parallel'
  )
  .option('-o, --output <directory>', 'Output directory for processed videos')
  .option('-t, --temp <directory>', 'Temporary directory for downloaded videos')
  .option('-f, --force', 'Force reprocessing of already completed videos')
  .parse(process.argv);

const options = program.opts();

// Update config with command line options
config.concurrency = parseInt(options.concurrency, 10);
config.outputDir = options.output;
config.tempDir = options.tempDir;
```

## Environment Variables

Environment variables can be set in a `.env` file at the root of the project:

```
# .env file example
CONCURRENCY=4
OUTPUT_DIR=./my-videos
TEMP_DIR=./downloads
LOG_LEVEL=debug
```

## Design Considerations

1. **Centralized Configuration**: Having all configuration in one place makes it easier to manage and update.

2. **Multiple Configuration Sources**: Supporting both environment variables and command-line arguments provides flexibility for different usage scenarios.

3. **Type Safety**: Using TypeScript interface ensures type-safe access to configuration properties.

4. **Default Values**: Providing sensible defaults makes the application usable without explicit configuration.

5. **Absolute Paths**: Converting relative paths to absolute paths prevents issues with working directory changes.

## Common Issues

1. **Type Conversion**: Remember to convert string environment variables to appropriate types (e.g., parsing integers).

2. **Path Resolution**: Be careful with path resolution, especially when the application might be run from different directories.

## Future Improvements

1. **Configuration Validation**: Add validation for configuration values to catch invalid settings early.

2. **Dynamic Reconfiguration**: Allow some settings to be changed at runtime without restarting the application.

3. **Configuration Profiles**: Support different configuration profiles for different environments (development, production, etc.).

4. **Secrets Management**: Add more secure handling for any sensitive configuration values.
