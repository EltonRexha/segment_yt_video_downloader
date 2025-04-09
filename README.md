# YouTube Video Processor

A Node.js application that downloads YouTube videos and segments them based on provided timestamps or automatic chapter detection.

## Features

- Download videos from YouTube in high quality
- Segment videos into parts based on timestamps
- Auto-detect video chapters for segmentation
- Concurrent processing of multiple videos
- Progress tracking and recovery from failures
- Customizable output formats

## Prerequisites

- Node.js 16 or higher
- FFmpeg (automatically installed via ffmpeg-static)

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Add YouTube video URLs and segment information to `data/videos.json`:

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
       "url": "https://www.youtube.com/watch?v=ANOTHER_ID",
       "segments": "auto"
     }
   ]
   ```

2. Run the application:

   ```bash
   npm start
   ```

3. Advanced options:

   ```bash
   # Process with higher concurrency
   npm start -- --concurrency=4

   # Specify custom output directory
   npm start -- --output=./my-videos

   # Force reprocessing of already completed videos
   npm start -- --force
   ```

## Configuration

The application can be configured through environment variables or a `.env` file:

- `LOG_LEVEL`: Logging level (default: info)
- `CONCURRENCY`: Number of videos to process in parallel (default: 2)
- `OUTPUT_DIR`: Directory for processed videos (default: ./output)
- `TEMP_DIR`: Temporary directory for downloaded videos (default: ./temp)

## Output

For each video, the application creates:

1. A directory named after the video ID
2. Segmented video files within that directory
3. A `summary.json` file with metadata about the segments

## Development

Build the project:

```bash
npm run build
```

Run in development mode with auto-restart:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## License

MIT
