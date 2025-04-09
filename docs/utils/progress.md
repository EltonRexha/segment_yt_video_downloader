# Progress Utility

## Overview

The Progress utility is responsible for tracking the processing status of videos and enabling recovery from failures. It maintains a persistent record of which videos have been successfully processed and which have failed, allowing the application to resume from where it left off after interruptions or errors.

## File Location

`src/utils/progress.ts`

## Dependencies

- **fs-extra**: Enhanced file system operations
- **path**: Path manipulation utilities
- **logger**: Custom logging service

## Core Functionality

The progress utility stores its data in a JSON file (`progress.json`) at the root of the project. This file contains two lists:

1. **completed**: An array of video IDs that have been successfully processed
2. **failed**: An array of objects with video IDs and error messages for videos that failed processing

This information is used to:

- Skip already processed videos (unless forced to reprocess)
- Report on processing status
- Enable recovery after application restarts or crashes

## Public Functions

### `initProgressTracker(): Promise<ProgressTracker>`

Initializes or loads the progress tracker.

#### Returns:

- Promise resolving to a ProgressTracker object with completed and failed arrays

#### Implementation Details:

1. Checks if a progress file exists
2. If it exists, loads and returns the data
3. If it doesn't exist, creates a new empty progress tracker
4. Logs the initialization status

#### Error Handling:

- Returns an empty tracker if file operations fail
- Logs errors but doesn't propagate them to avoid stopping the application

#### Usage Example:

```typescript
const progress = await initProgressTracker();
console.log(`${progress.completed.length} videos already processed`);
```

### `saveProgress(progress: ProgressTracker): Promise<void>`

Saves the current progress to the progress file.

#### Parameters:

- `progress`: ProgressTracker object with completed and failed arrays

#### Implementation Details:

1. Writes the progress data to the progress file in JSON format
2. Logs debug information about the save operation

#### Error Handling:

- Logs errors but doesn't throw them to avoid stopping the application

#### Usage Example:

```typescript
await saveProgress(progress);
```

### `markVideoCompleted(progress: ProgressTracker, videoId: string): Promise<ProgressTracker>`

Marks a video as successfully processed.

#### Parameters:

- `progress`: Current ProgressTracker object
- `videoId`: ID of the video to mark as completed

#### Returns:

- Promise resolving to the updated ProgressTracker

#### Implementation Details:

1. Adds the video ID to the completed list if not already there
2. Removes the video ID from the failed list if it was there
3. Saves the updated progress
4. Returns the updated progress object

#### Usage Example:

```typescript
progress = await markVideoCompleted(progress, 'video123');
```

### `markVideoFailed(progress: ProgressTracker, videoId: string, error: string): Promise<ProgressTracker>`

Marks a video as failed with an error message.

#### Parameters:

- `progress`: Current ProgressTracker object
- `videoId`: ID of the video that failed
- `error`: Error message describing the failure

#### Returns:

- Promise resolving to the updated ProgressTracker

#### Implementation Details:

1. Removes the video ID from the completed list if it was there
2. Updates or adds the video to the failed list with the error message
3. Saves the updated progress
4. Returns the updated progress object

#### Usage Example:

```typescript
progress = await markVideoFailed(
  progress,
  'video123',
  'Download failed: Network error'
);
```

## Data Structure

The ProgressTracker object has the following structure:

```typescript
interface ProgressTracker {
  completed: string[]; // Array of completed video IDs
  failed: { id: string; error: string }[]; // Array of failed videos with error messages
}
```

The stored JSON file format matches this structure.

## Design Considerations

1. **Persistent Storage**: Using a JSON file ensures progress is maintained across application restarts.

2. **Error Isolation**: Errors in progress tracking are isolated and don't stop the main application flow.

3. **Idempotent Operations**: The functions are designed to be safely called multiple times with the same parameters.

4. **Atomic Updates**: Each update operation loads the latest data, modifies it, and saves it back to ensure consistency.

5. **Explicit Error Tracking**: Failed videos include error messages to help diagnose and fix issues.

## Common Issues

1. **File Permission Issues**: In some environments, writing to the progress file might fail due to permission issues.

2. **Concurrent Access**: The current implementation doesn't handle concurrent access to the progress file, which could cause issues in multi-process scenarios.

## Future Improvements

1. **Database Storage**: Replace file-based storage with a database for better concurrency and reliability.

2. **More Detailed Progress**: Track more detailed progress, such as which segments were processed for each video.

3. **Automatic Retry**: Implement automatic retry of failed videos with exponential backoff.

4. **Progress Statistics**: Add functions to generate statistics about processing success rates and common errors.

5. **Locking Mechanism**: Add file locking for concurrent access scenarios.
