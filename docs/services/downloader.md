# Downloader Service

## Overview

The downloader service is responsible for fetching videos from YouTube. It utilizes the `ytdl-core` library to handle the complexity of YouTube's API and download streams. This service is a critical component that handles video retrieval, format selection, and progress tracking.

## File Location

`src/services/downloader.ts`

## Dependencies

- **ytdl-core**: Core library for YouTube video downloading
- **fs-extra**: Enhanced file system operations
- **path**: Path manipulation utilities
- **logger**: Custom logging service

## Public Functions

### `downloadVideo(url: string, outputPath: string): Promise<string>`

Downloads a video from YouTube and saves it to the specified path.

#### Parameters:

- `url`: YouTube video URL
- `outputPath`: Directory where the video will be saved

#### Returns:

- Promise resolving to the path of the downloaded video file

#### Implementation Details:

1. Validates the YouTube URL
2. Ensures the output directory exists
3. Gets video metadata using ytdl-core
4. Checks if the video was already downloaded
5. Selects the best quality format with both audio and video
6. Downloads the video using a streaming approach
7. Tracks and logs download progress
8. Returns the path to the downloaded file

#### Error Handling:

- Invalid URLs throw an error with a descriptive message
- Download errors are logged and rethrown for upper-level handling
- All errors are properly typed with TypeScript
- Guards against undefined values before applying string operations like `replace()`

#### Usage Example:

```typescript
const videoPath = await downloadVideo(
  'https://www.youtube.com/watch?v=VIDEO_ID',
  './temp'
);
```

### `detectVideoChapters(url: string): Promise<Segment[]>`

Detects chapters in a YouTube video to enable automatic segmentation.

#### Parameters:

- `url`: YouTube video URL

#### Returns:

- Promise resolving to an array of segment objects with name, start, and end timestamps

#### Implementation Details:

1. Validates the YouTube URL
2. Retrieves video information using ytdl-core
3. Extracts chapter information if available
4. Handles edge cases where chapter end times aren't provided
5. Formats timestamps in a consistent format (HH:MM:SS)

#### Error Handling:

- Returns an empty array if no chapters are found
- Network errors are logged and rethrown
- Type assertions are used to handle incomplete type definitions
- Guards against undefined chapter properties to prevent "Cannot read properties of undefined" errors

#### Usage Example:

```typescript
const chapters = await detectVideoChapters(
  'https://www.youtube.com/watch?v=VIDEO_ID'
);
```

## Private Functions

### `formatSeconds(seconds: number): string`

Converts seconds to a formatted time string (HH:MM:SS).

#### Parameters:

- `seconds`: Time in seconds

#### Returns:

- Formatted time string (e.g., "01:23:45")

#### Implementation Details:

- Handles hours, minutes, and seconds correctly
- Ensures values are padded with leading zeros

## Design Considerations

1. **Stream-Based Downloading**: The service uses Node.js streams to efficiently handle large files without excessive memory usage.

2. **Format Selection**: The service attempts to get the highest quality format that includes both video and audio, falling back to separate streams if needed.

3. **Progress Tracking**: Download progress is tracked and logged at reasonable intervals (every 5%) to avoid excessive logging.

4. **Caching**: The service checks if a video is already downloaded to avoid redundant downloads, improving efficiency.

5. **Error Handling**: Comprehensive error handling ensures that issues are properly reported and don't crash the application.

6. **TypeScript Integration**: Strong typing ensures that the service integrates well with the rest of the application.

7. **Null/Undefined Guards**: The service includes guards against undefined values to prevent common errors like "Cannot read properties of undefined (reading 'replace')".

## Common Issues

1. **YouTube API Changes**: YouTube occasionally changes its API, which may require updates to ytdl-core or the way we use it.

2. **Rate Limiting**: Excessive downloads may trigger YouTube's rate limiting, requiring implementation of delays or proxies.

3. **Regional Restrictions**: Some videos may be region-restricted and require additional handling.

4. **Undefined Title or Properties**: When YouTube doesn't return expected metadata (like title), attempting to use string methods like `replace()` can cause errors.

### Fixing "Cannot read properties of undefined (reading 'replace')"

This error often occurs when processing video metadata. To fix:

1. **Check for undefined values**:

   ```typescript
   // Bad - might cause "Cannot read properties of undefined"
   const videoTitle = info.videoDetails.title.replace(/[^\w\s-]/gi, '');

   // Good - guards against undefined
   const videoTitle = info.videoDetails.title
     ? info.videoDetails.title.replace(/[^\w\s-]/gi, '')
     : 'untitled';
   ```

2. **Use optional chaining**:

   ```typescript
   const videoTitle =
     info.videoDetails?.title?.replace(/[^\w\s-]/gi, '') || 'untitled';
   ```

3. **Provide default fallbacks**:
   ```typescript
   const title = (info.videoDetails && info.videoDetails.title) || 'untitled';
   const videoTitle = title.replace(/[^\w\s-]/gi, '');
   ```

## Future Improvements

1. **Download Resumption**: Add support for resuming interrupted downloads.

2. **Proxy Support**: Implement proxy rotation to avoid rate limiting.

3. **Format Selection**: Provide more options for quality selection based on user preferences.

4. **Subtitle Support**: Add capability to download and process subtitles/captions.

5. **Enhanced Error Handling**: Further improve error handling for API response edge cases.
