# Processor Service

## Overview

The processor service is responsible for segmenting downloaded videos into smaller clips based on specified timestamps. It leverages FFmpeg, a powerful multimedia framework, to perform precise video cutting operations while maintaining video quality. This service handles the core video processing functionality of the application.

## File Location

`src/services/processor.ts`

## Dependencies

- **fluent-ffmpeg**: Node.js wrapper around FFmpeg
- **ffmpeg-static**: Provides FFmpeg binaries
- **fs-extra**: Enhanced file system operations
- **path**: Path manipulation utilities
- **logger**: Custom logging service

## Public Functions

### `segmentVideo(inputPath: string, outputDir: string, segments: Segment[]): Promise<string[]>`

Segments a video into multiple parts based on provided timestamps.

#### Parameters:

- `inputPath`: Path to the input video file
- `outputDir`: Directory where the segmented videos will be saved
- `segments`: Array of segment objects with name, start, and end timestamps

#### Returns:

- Promise resolving to an array of paths to the segmented video files

#### Implementation Details:

1. Ensures the output directory exists
2. Processes each segment sequentially
3. Uses FFmpeg to extract the segment with the specified start time and duration
4. Preserves video quality by using stream copying (`-c copy`)
5. Tracks and logs progress for each segment
6. Returns an array of paths to the generated segment files
7. Safely handles undefined segment names to prevent errors

#### Error Handling:

- FFmpeg errors are captured and wrapped with descriptive messages
- Filesystem errors are properly handled
- Each segment is processed independently, so failure of one doesn't affect others
- Validates segment data to prevent "Cannot read properties of undefined" errors

#### Usage Example:

```typescript
const segmentPaths = await segmentVideo(
  '/path/to/video.mp4',
  '/path/to/output',
  [
    { name: 'Intro', start: '00:00:00', end: '00:01:30' },
    { name: 'Main Content', start: '00:01:30', end: '00:05:45' },
  ]
);
```

### `getVideoMetadata(filePath: string): Promise<ffmpeg.FfprobeData>`

Retrieves detailed metadata about a video file.

#### Parameters:

- `filePath`: Path to the video file

#### Returns:

- Promise resolving to FFmpeg probe data with file information

#### Implementation Details:

1. Uses FFmpeg's probe functionality to analyze the video file
2. Returns comprehensive metadata including codecs, duration, format, etc.

#### Error Handling:

- Errors during probing are captured and wrapped with descriptive messages

#### Usage Example:

```typescript
const metadata = await getVideoMetadata('/path/to/video.mp4');
console.log(`Video duration: ${metadata.format.duration} seconds`);
```

## Private Functions

### `calculateDuration(start: string, end: string): number`

Calculates the duration between two timestamps in seconds.

#### Parameters:

- `start`: Start timestamp (HH:MM:SS)
- `end`: End timestamp (HH:MM:SS)

#### Returns:

- Duration in seconds

#### Implementation Details:

- Converts both timestamps to seconds
- Calculates the difference

### `timestampToSeconds(timestamp: string): number`

Converts a timestamp string to seconds.

#### Parameters:

- `timestamp`: Time in format HH:MM:SS, MM:SS, or SS

#### Returns:

- Time in seconds

#### Implementation Details:

- Handles different timestamp formats (HH:MM:SS, MM:SS, SS)
- Correctly calculates the total seconds

## Design Considerations

1. **Stream Copying**: The service uses FFmpeg's stream copying (`-c copy`) to avoid re-encoding, which significantly speeds up processing and maintains original quality.

2. **Sequential Processing**: Segments are processed sequentially to avoid overloading the system, especially with large videos.

3. **Progress Monitoring**: The service provides progress updates during segment processing for better user feedback.

4. **Idempotent Operations**: The service checks if a segment already exists before processing it, allowing for resumption of interrupted operations.

5. **Error Isolation**: Each segment is processed independently, so a failure in one segment doesn't affect others.

6. **Metadata Extraction**: The service includes functionality to extract detailed metadata, which can be useful for additional processing or information display.

7. **Data Validation**: The service validates segment data before processing to prevent common errors like "Cannot read properties of undefined (reading 'replace')".

## Common Issues

1. **FFmpeg Availability**: The service assumes FFmpeg is available through ffmpeg-static, but this might not work in all environments.

2. **Large Files**: Processing very large video files might require additional system resources.

3. **Timestamp Accuracy**: FFmpeg might have slight variations in timestamp precision, which can affect segment boundaries.

4. **Codec Compatibility**: Stream copying requires compatible codecs between input and output, which might not always be the case.

5. **Undefined Segment Names**: When processing segments with undefined names, using string methods like `replace()` can cause errors.

### Handling Undefined Segment Names

This error often occurs when processing segment information. To fix:

```typescript
// Bad approach - might cause "Cannot read properties of undefined"
const segmentName = segment.name.replace(/[^\w\s-]/gi, '');

// Good approach - with fallback
const segmentName = segment.name
  ? segment.name.replace(/[^\w\s-]/gi, '')
  : `segment_${index + 1}`;

// Alternative with optional chaining
const sanitizedName =
  segment.name?.replace(/[^\w\s-]/gi, '') || `segment_${index + 1}`;
```

## Future Improvements

1. **Parallel Processing**: Add option for parallel segment processing when appropriate.

2. **Enhanced Progress Reporting**: Provide more detailed progress information, including ETA.

3. **Transcoding Support**: Add options for re-encoding with different codecs or quality settings.

4. **Video Effects**: Add support for applying effects or filters during segmentation.

5. **Custom FFmpeg Commands**: Allow users to specify custom FFmpeg options for advanced use cases.

6. **Enhanced Data Validation**: Implement more comprehensive validation for segment data.
