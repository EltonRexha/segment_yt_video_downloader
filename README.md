# Video Segmentation System

A system for generating video segments from longer videos, with support for multiple output formats and configurations.

## Features

- Segment videos by timestamps
- Multiple output format support (MP4, MKV, WebM, TS)
- Adjustable quality settings
- Audio-only extraction
- Automatic re-encoding fallback for problematic videos
- Intelligent MOOV atom handling
- Keyframe-aware segmentation

## Recent Improvements

This project has recently improved its video segmentation capabilities to handle problematic MP4 files and ensure segments are playable in various players. The key enhancements include:

1. **Multiple Format Support**: Now supports MP4, MKV, WebM, and MPEG-TS formats for optimal compatibility
2. **Smart Fallback Strategy**: Attempts stream-copying first and falls back to re-encoding if issues occur
3. **MOOV Atom Optimization**: Ensures the MOOV atom is placed at the beginning of MP4 files for better compatibility
4. **Quality Control Options**: Configurable quality settings for different use cases
5. **Two-step Conversion Process**: Uses intermediate formats when needed for problem files

## Usage

```javascript
const outputPaths = await segmentVideo(
  'input.mp4',
  'output-directory',
  [
    { name: 'Intro', start: '00:00:00', end: '00:01:30' },
    { name: 'Main Content', start: '00:01:30', end: '00:10:00' },
  ],
  {
    format: 'ts', // 'mp4', 'mkv', 'webm', or 'ts'
    quality: 'medium', // 'high', 'medium', or 'low'
    forceEncode: false, // Force re-encoding instead of stream copy
    audioOnly: false, // Extract audio only
  }
);
```

## Format Options

### MP4 Format

- Standard format with wide compatibility
- May have issues when segmenting at non-keyframe boundaries
- Uses `-movflags faststart` for better streaming

### MKV Format

- More flexible container that handles a wider variety of codecs
- Better compatibility with different video sources
- Good for local playback

### WebM Format

- Optimized for web playback
- Smaller file sizes for comparable quality
- Uses VP9 video codec and Opus audio codec

### MPEG-TS Format (Recommended for Segmentation)

- Designed for broadcasting and streaming
- Most tolerant of segment boundaries
- Best choice for problematic source files

## Debugging Tools

The project includes a debugging tool to help diagnose issues with video segments:

```bash
node debug/analyze-mp4-segment.js path/to/segment.mp4
```

This tool will analyze the video file and provide detailed information about:

- File metadata
- Keyframe placement and spacing
- MOOV atom presence and position
- Timestamp continuity
- Recommendations for fixing issues

## Documentation

For detailed information about video segmentation issues and solutions, see:

- [Video Segmentation Issues](docs/video-segmentation-issues.md)
- [Format Options Examples](examples/format-options.md)

## Requirements

- Node.js 12+
- FFmpeg 4.0+
