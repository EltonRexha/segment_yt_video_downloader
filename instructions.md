# YouTube Video Processor - AI Agent Instructions

## Overview

This document provides instructions for an AI agent responsible for processing YouTube videos. The application will:

1. Read YouTube video links from a data file (`data/videos.json`)
2. Download each video
3. Segment videos into parts based on timestamps or intervals
4. Save the segmented videos to an output folder
5. Organize the output for easy access

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Libraries**:
  - `ytdl-core` - For downloading YouTube videos
  - `fluent-ffmpeg` - For video processing and segmentation
  - `ffmpeg-static` - For providing ffmpeg binaries
  - `commander` - For CLI interface
  - `dotenv` - For environment variables
  - `winston` - For logging
  - `fs-extra` - For enhanced file system operations

## Project Structure

```
/
├── data/
│   └── videos.json         # Input file containing YouTube video URLs and timestamp info
├── src/
│   ├── index.ts            # Entry point
│   ├── types/              # TypeScript type definitions
│   ├── services/           # Core services
│   │   ├── downloader.ts   # YouTube video downloading service
│   │   ├── processor.ts    # Video processing and segmentation service
│   │   └── logger.ts       # Logging service
│   ├── utils/              # Utility functions
│   └── config.ts           # Application configuration
├── output/                 # Directory for processed videos
├── logs/                   # Application logs
├── .env                    # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## Implementation Steps

### 1. Environment Setup

1. Initialize a new Node.js project with TypeScript
2. Install required dependencies
3. Create the basic project structure
4. Configure TypeScript, linting, and environment variables

### 2. Data Structure

The `videos.json` file should have the following structure:

```json
[
  {
    "id": "video1",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "title": "Optional title",
    "segments": [
      {
        "name": "Segment 1",
        "start": "00:00:00",
        "end": "00:05:30"
      },
      {
        "name": "Segment 2",
        "start": "00:07:15",
        "end": "00:12:45"
      }
    ]
  },
  {
    "id": "video2",
    "url": "https://www.youtube.com/watch?v=ANOTHER_VIDEO_ID",
    "segments": "auto" // Automatically segment (if supported by video chapters)
  }
]
```

### 3. Video Downloader Implementation

Create a service that:

- Validates YouTube URLs
- Retrieves video metadata (title, duration, etc.)
- Downloads videos in the highest quality available
- Implements proper error handling and retry mechanisms
- Shows progress during download

Example code pattern:

```typescript
import ytdl from 'ytdl-core';
import fs from 'fs-extra';
import path from 'path';

export async function downloadVideo(
  url: string,
  outputPath: string
): Promise<string> {
  try {
    if (!ytdl.validateURL(url)) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }

    const info = await ytdl.getInfo(url);
    const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    const fileName = `${videoTitle}.mp4`;
    const filePath = path.join(outputPath, fileName);

    return new Promise((resolve, reject) => {
      const videoStream = ytdl(url, { quality: 'highest' });
      const fileStream = fs.createWriteStream(filePath);

      videoStream.pipe(fileStream);

      videoStream.on('progress', (chunkLength, downloaded, total) => {
        const percent = ((downloaded / total) * 100).toFixed(2);
        console.log(`Downloading: ${percent}%`);
      });

      fileStream.on('finish', () => {
        resolve(filePath);
      });

      fileStream.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Error downloading video: ${error.message}`);
    throw error;
  }
}
```

### 4. Video Processor Implementation

Create a service that:

- Takes the downloaded video file
- Processes it according to the specified segments
- Uses FFmpeg to cut the video at precise timestamps
- Preserves video quality during segmentation
- Handles different timestamp formats

Example code pattern:

```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs-extra';

ffmpeg.setFfmpegPath(ffmpegStatic);

export async function segmentVideo(
  inputPath: string,
  outputDir: string,
  segments: { name: string; start: string; end: string }[]
): Promise<string[]> {
  const outputPaths: string[] = [];

  // Ensure output directory exists
  await fs.ensureDir(outputDir);

  // Process each segment
  for (const [index, segment] of segments.entries()) {
    const { name, start, end } = segment;
    const segmentName = name || `segment_${index + 1}`;
    const sanitizedName = segmentName.replace(/[^\w\s]/gi, '');
    const outputPath = path.join(outputDir, `${sanitizedName}.mp4`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(start)
        .setDuration(calculateDuration(start, end))
        .output(outputPath)
        .outputOptions('-c copy') // Copy streams without re-encoding
        .on('end', () => {
          outputPaths.push(outputPath);
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`Error segmenting video: ${err.message}`));
        })
        .run();
    });
  }

  return outputPaths;
}

function calculateDuration(start: string, end: string): number {
  // Convert timestamp strings to seconds
  const startSeconds = timestampToSeconds(start);
  const endSeconds = timestampToSeconds(end);
  return endSeconds - startSeconds;
}

function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);

  if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else {
    // SS format
    return parts[0];
  }
}
```

### 5. Main Application Logic

Implement the main application flow that:

- Reads the videos.json configuration
- Processes each video sequentially
- Handles errors gracefully
- Provides meaningful progress feedback
- Creates organized output folders

### 6. Advanced Features

#### 6.1 Auto-segmentation

If a video has chapters or markers, implement a feature to automatically segment based on those:

```typescript
async function detectVideoChapters(videoUrl: string): Promise<Segment[]> {
  const info = await ytdl.getInfo(videoUrl);
  const chapters = info.videoDetails.chapters || [];

  if (chapters.length === 0) {
    return [];
  }

  return chapters.map((chapter) => ({
    name: chapter.title,
    start: formatSeconds(chapter.start_time),
    end: formatSeconds(chapter.end_time),
  }));
}

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

#### 6.2 Parallel Processing

Implement parallel processing with configurable concurrency to improve performance:

```typescript
async function processVideosParallel(
  videos: VideoConfig[],
  concurrency = 2
): Promise<void> {
  const chunks = [];

  for (let i = 0; i < videos.length; i += concurrency) {
    chunks.push(videos.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map((video) => processVideo(video)));
  }
}
```

#### 6.3 Error Recovery

Implement a mechanism to resume from failures:

```typescript
async function processWithRecovery(videos: VideoConfig[]): Promise<void> {
  const progress = await loadProgressFile();

  for (const video of videos) {
    if (progress.completed.includes(video.id)) {
      console.log(`Skipping already processed video: ${video.id}`);
      continue;
    }

    try {
      await processVideo(video);
      progress.completed.push(video.id);
      await saveProgressFile(progress);
    } catch (error) {
      console.error(`Error processing video ${video.id}: ${error.message}`);
      progress.failed.push({ id: video.id, error: error.message });
      await saveProgressFile(progress);
    }
  }
}
```

## Running the Application

The application should be run with a simple command:

```bash
npm start
```

Or with additional options:

```bash
npm start -- --concurrency=4 --output=./custom-output
```

## Testing

Implement proper testing for each core component:

1. Unit tests for utilities and helpers
2. Integration tests for the video processing chain
3. End-to-end tests with sample videos

## Error Handling

Implement comprehensive error handling:

1. Input validation errors (invalid URLs, missing files)
2. Download errors (network issues, rate limiting)
3. Processing errors (corrupt files, FFmpeg issues)
4. System errors (disk space, permissions)

## Logging

Implement detailed logging:

1. Progress updates for long-running operations
2. Error details for troubleshooting
3. Summary statistics upon completion

## Performance Considerations

1. Use streams wherever possible to minimize memory usage
2. Implement configurable concurrency for parallel operations
3. Provide options for quality vs. speed tradeoffs

## Conclusion

Following these instructions will result in a robust application capable of downloading and processing YouTube videos into segments. The application is designed to be resilient, efficient, and user-friendly, with clear output and helpful error messages.

The AI agent should follow these guidelines while adapting to specific requirements and handling edge cases appropriately.
