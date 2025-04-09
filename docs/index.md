# Main Application

## Overview

The main application module (`src/index.ts`) is the entry point of the YouTube Video Processor. It orchestrates the entire workflow by coordinating all the services and utilities to download videos, process them into segments, and track progress. This module handles command-line arguments, initializes the application, and executes the main processing logic.

## File Location

`src/index.ts`

## Dependencies

- **fs-extra**: For file system operations
- **path**: For path manipulation
- **commander**: For command-line argument parsing
- **logger**: Custom logging service
- **config**: Application configuration
- **downloader**: YouTube video download service
- **processor**: Video segmentation service
- **progress**: Processing progress tracker

## Command-Line Interface

The application provides a command-line interface with the following options:

```
Options:
  -c, --concurrency <number>  Number of videos to process in parallel (default: 2)
  -o, --output <directory>    Output directory for processed videos (default: ./output)
  -t, --temp <directory>      Temporary directory for downloaded videos (default: ./temp)
  -f, --force                 Force reprocessing of already completed videos
  -h, --help                  Display help information
  -V, --version               Display version information
```

## Main Process Flow

The main application flow consists of the following steps:

1. **Parse Command-Line Arguments**: Use Commander.js to parse and validate command-line options
2. **Initialize Configuration**: Set up the application configuration with values from environment variables and command-line arguments
3. **Create Required Directories**: Ensure output and temporary directories exist
4. **Initialize Progress Tracker**: Set up progress tracking to enable resumption of interrupted operations
5. **Load Video Configurations**: Read the list of videos to process from `data/videos.json`
6. **Process Videos in Batches**: Group videos into batches based on the concurrency setting and process each batch
7. **Handle Errors**: Catch and log any errors that occur during processing

## Functions

### `main(): Promise<void>`

The main function that orchestrates the entire application workflow.

#### Implementation Details:

1. Sets up the application environment
2. Loads the video configuration
3. Processes videos in batches based on concurrency
4. Handles errors and provides appropriate logging

### `processVideo(video: VideoConfig, progress: ProgressTracker, force: boolean): Promise<void>`

Processes a single video from download to segmentation.

#### Parameters:

- `video`: Configuration for the video to process
- `progress`: Progress tracker object
- `force`: Whether to force reprocessing of already completed videos

#### Implementation Details:

1. Checks if the video has already been processed (skips if already done and force is false)
2. Creates output directory for the video
3. Downloads the video from YouTube
4. Determines segments based on configuration or automatic chapter detection
5. Processes segments using FFmpeg
6. Creates a summary file with metadata
7. Marks the video as completed in the progress tracker
8. Logs progress and results

## Batch Processing

The application processes videos in batches to limit concurrency and avoid overwhelming system resources:

```typescript
// Process videos in batches based on concurrency
const videoBatches = [];
for (let i = 0; i < videos.length; i += config.concurrency) {
  videoBatches.push(videos.slice(i, i + config.concurrency));
}

for (const [batchIndex, batch] of videoBatches.entries()) {
  logger.info(`Processing batch ${batchIndex + 1}/${videoBatches.length}`);

  // Process videos in batch concurrently
  await Promise.all(
    batch.map((video) => processVideo(video, progress, forceReprocess))
  );
}
```

This approach provides several benefits:

1. Controls system resource usage
2. Enables progress reporting at the batch level
3. Ensures proper error handling for each video
4. Takes advantage of parallelism for better performance

## Error Handling

The application implements comprehensive error handling at multiple levels:

1. **Global Error Handler**: Catches and logs unhandled errors at the application level
2. **Per-Video Error Handling**: Isolates errors in individual video processing
3. **Service-Level Error Handling**: Each service handles and reports its own errors
4. **Progress Tracking**: Failed videos are tracked to allow for later retry

This multi-layered approach ensures that:

- Errors in one video don't affect others
- All errors are properly logged
- The application can recover from failures
- Users receive clear error messages

## Design Considerations

1. **Modular Architecture**: The main module focuses on orchestration, delegating specific functions to specialized services.

2. **Concurrent Processing**: Videos are processed concurrently within batches to improve performance.

3. **Progress Tracking**: Detailed progress tracking allows for resumption of interrupted operations.

4. **Command-Line Interface**: A flexible command-line interface makes the application easy to use and configure.

5. **Error Isolation**: Each video is processed independently to isolate failures.

## Common Issues

1. **Resource Utilization**: Processing many videos concurrently can strain system resources, especially with large videos.

2. **Network Dependency**: The application depends on network access to download videos, which can lead to failures in unreliable networks.

3. **Disk Space**: Temporary and output files can consume significant disk space.

## Future Improvements

1. **Web Interface**: Add a web-based user interface for easier interaction.

2. **Performance Monitoring**: Add more detailed performance metrics and reporting.

3. **Queue Management**: Implement a more sophisticated queue management system with priorities and retry logic.

4. **Cleanup Options**: Add options to automatically clean up temporary files.

5. **Extended Format Support**: Support more output formats and quality options.
