# TypeScript Types

## Overview

The application uses TypeScript for better type safety and development experience. The type definitions are centralized in the `src/types/index.ts` file to ensure consistency across the application. These types define the shape of data structures used throughout the application, making the code more maintainable and reducing potential errors.

## File Location

`src/types/index.ts`

## Type Definitions

### `Segment`

Represents a single segment or section of a video with clear start and end timestamps.

```typescript
interface Segment {
  name: string;
  start: string;
  end: string;
}
```

#### Properties:

- `name`: Human-readable name for the segment (e.g., "Introduction", "Chapter 1")
- `start`: Start timestamp in HH:MM:SS format
- `end`: End timestamp in HH:MM:SS format

#### Usage Context:

Used when defining video segments for processing and in the segmentation process itself. This type ensures that all segments have the required properties with correct types.

#### Example:

```typescript
const introSegment: Segment = {
  name: 'Introduction',
  start: '00:00:00',
  end: '00:02:30',
};
```

### `VideoConfig`

Represents the configuration for a video to be processed, including its source URL and segmentation information.

```typescript
interface VideoConfig {
  id: string;
  url: string;
  title?: string;
  segments: Segment[] | 'auto';
}
```

#### Properties:

- `id`: Unique identifier for the video
- `url`: YouTube URL of the video
- `title`: Optional title for the video
- `segments`: Either an array of Segment objects or the string "auto" for automatic chapter detection

#### Usage Context:

Used when loading video information from the data file and throughout the video processing workflow. The application reads an array of `VideoConfig` objects from `data/videos.json`.

#### Example:

```typescript
const videoConfig: VideoConfig = {
  id: 'intro-tutorial',
  url: 'https://www.youtube.com/watch?v=VIDEO_ID',
  title: 'Introduction Tutorial',
  segments: [
    { name: 'Introduction', start: '00:00:00', end: '00:01:30' },
    { name: 'Main Content', start: '00:01:30', end: '00:10:45' },
    { name: 'Conclusion', start: '00:10:45', end: '00:12:20' },
  ],
};

// Example with automatic segmentation
const autoVideoConfig: VideoConfig = {
  id: 'auto-segmented-video',
  url: 'https://www.youtube.com/watch?v=VIDEO_ID',
  segments: 'auto',
};
```

### `ProgressTracker`

Tracks the progress of video processing, including completed videos and failed attempts.

```typescript
interface ProgressTracker {
  completed: string[];
  failed: { id: string; error: string }[];
}
```

#### Properties:

- `completed`: Array of IDs of successfully processed videos
- `failed`: Array of objects containing IDs and error messages for failed videos

#### Usage Context:

Used by the progress utility to track which videos have been processed and which have failed. This information is persisted to enable resuming interrupted processing.

#### Example:

```typescript
const progressData: ProgressTracker = {
  completed: ['video1', 'video2'],
  failed: [{ id: 'video3', error: 'Download failed: Network error' }],
};
```

### `AppConfig`

Defines the application's configuration settings.

```typescript
interface AppConfig {
  concurrency: number;
  outputDir: string;
  tempDir: string;
  logLevel: string;
}
```

#### Properties:

- `concurrency`: Number of videos to process in parallel
- `outputDir`: Directory for processed video segments
- `tempDir`: Temporary directory for downloaded videos
- `logLevel`: Logging level ('error', 'warn', 'info', 'debug')

#### Usage Context:

Used by the configuration module to provide a type-safe way to access application settings.

#### Example:

```typescript
const config: AppConfig = {
  concurrency: 2,
  outputDir: '/path/to/output',
  tempDir: '/path/to/temp',
  logLevel: 'info',
};
```

## Design Considerations

1. **Clear Property Names**: Type properties have clear, descriptive names to improve readability.

2. **Minimal Required Properties**: Only truly required properties are non-optional to keep the interfaces flexible.

3. **Union Types**: Using union types (e.g., `Segment[] | "auto"`) where appropriate to allow for different modes of operation.

4. **Centralized Definitions**: All types are defined in a single file to avoid duplication and ensure consistency.

5. **Interface-based Approach**: Using interfaces rather than type aliases for better extensibility and readability in error messages.

## Usage in the Application

The types are imported and used throughout the application:

```typescript
import { VideoConfig, Segment, ProgressTracker } from './types';

// Function that takes typed parameters
async function processVideo(
  video: VideoConfig,
  progress: ProgressTracker
): Promise<void> {
  // Implementation...
}

// Creating typed objects
const segments: Segment[] = [
  { name: 'Part 1', start: '00:00:00', end: '00:05:00' },
];

// Type checking ensures all required properties are provided
const videoConfig: VideoConfig = {
  id: 'my-video',
  url: 'https://youtube.com/watch?v=abc123',
  segments,
};
```

## Future Improvements

1. **More Detailed Types**: Add more specific types for things like timestamps or video formats.

2. **Stricter Validation**: Add runtime validation to ensure data matches the expected types, especially for user inputs.

3. **Enum Types**: Use enum types for fields with a fixed set of possible values, like log levels.

4. **Documentation Comments**: Add more detailed JSDoc comments to improve IDE tooltips and generated documentation.
