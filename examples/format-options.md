# Video Format Options Examples

This document provides examples of how to use the new format options when segmenting videos.

## Available Formats

The segmentation function now supports multiple output formats:

- `mp4` - Standard MP4 container (default)
- `mkv` - Matroska container (better compatibility with some codecs)
- `webm` - WebM container (good for web playback)
- `ts` - MPEG Transport Stream (good for streaming and better handling of segment boundaries)

## Quality Options

You can specify the quality of the output:

- `high` - Better quality, larger file size
- `medium` - Balanced quality and size (default)
- `low` - Lower quality, smaller file size

## Usage Examples

### Basic Usage

```typescript
import { segmentVideo } from '../src/services/processor';

// Using default options (mp4, medium quality)
const outputPaths = await segmentVideo('input.mp4', 'output-directory', [
  { name: 'Intro', start: '00:00:00', end: '00:01:30' },
  { name: 'Main Content', start: '00:01:30', end: '00:10:00' },
]);
```

### Using MKV Format (better compatibility)

```typescript
const outputPaths = await segmentVideo(
  'input.mp4',
  'output-directory',
  [
    { name: 'Intro', start: '00:00:00', end: '00:01:30' },
    { name: 'Main Content', start: '00:01:30', end: '00:10:00' },
  ],
  { format: 'mkv' }
);
```

### Using Transport Stream (TS) Format (better for segmenting)

```typescript
const outputPaths = await segmentVideo(
  'input.mp4',
  'output-directory',
  [
    { name: 'Intro', start: '00:00:00', end: '00:01:30' },
    { name: 'Main Content', start: '00:01:30', end: '00:10:00' },
  ],
  { format: 'ts' }
);
```

### Forcing Re-encoding (more reliable but slower)

```typescript
const outputPaths = await segmentVideo(
  'input.mp4',
  'output-directory',
  [
    { name: 'Intro', start: '00:00:00', end: '00:01:30' },
    { name: 'Main Content', start: '00:01:30', end: '00:10:00' },
  ],
  { forceEncode: true }
);
```

### Audio-Only Extraction

```typescript
const outputPaths = await segmentVideo(
  'input.mp4',
  'output-directory',
  [
    { name: 'Intro', start: '00:00:00', end: '00:01:30' },
    { name: 'Main Content', start: '00:01:30', end: '00:10:00' },
  ],
  { audioOnly: true }
);
```

### Combining Options

```typescript
const outputPaths = await segmentVideo(
  'input.mp4',
  'output-directory',
  [
    { name: 'Intro', start: '00:00:00', end: '00:01:30' },
    { name: 'Main Content', start: '00:01:30', end: '00:10:00' },
  ],
  {
    format: 'webm',
    quality: 'high',
    forceEncode: true,
  }
);
```

## Best Practices

1. **For maximum compatibility**: Use `mkv` format or the `ts` format with `forceEncode: true`
2. **For web streaming**: Use `webm` format
3. **For problematic MP4 files**: Try using the `ts` format or set `forceEncode: true`
4. **For highest quality**: Use any format with `quality: 'high'`
5. **For fastest processing**: Use any format with default options (stream copy)
6. **For audio extraction**: Use any format with `audioOnly: true`

## Format-Specific Notes

- **MP4**: Good general-purpose format but may have issues with stream copying during segmentation
- **MKV**: More flexible container that handles a wider variety of codecs
- **WebM**: Good for web playback but doesn't support stream copying for most sources
- **TS**: Good for solving segmentation issues, particularly at non-keyframe boundaries
