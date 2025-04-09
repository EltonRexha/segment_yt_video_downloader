# Video Processing Troubleshooting Guide

This guide will help you systematically identify and fix issues with the video processing pipeline, from YouTube downloads to final segmentation.

## Understanding the Problem

Invalid MP4 segments can be caused by problems at different stages of the pipeline:

1. **YouTube Download Issues**: Problems with the source video download
2. **Cache Corruption**: Previously downloaded videos may be corrupted
3. **Intermediate Processing**: Issues during format conversion or preprocessing
4. **Segmentation Process**: Problems during the final segmentation step
5. **Player Compatibility**: Issues with how different players handle the segments

## Diagnosing the Root Cause

### Step 1: Clear Any Cached Video Data

**Critical First Step**: Many issues are resolved by clearing cached video data that may have been corrupted during download.

```bash
# Run the cache cleanup script
node debug/clear-cache.js

# Or manually clear the cache
rm -rf temp/*.mp4
rm -rf output/*
```

### Step 2: Check Downloaded Source Videos

After clearing the cache, determine if newly downloaded YouTube videos are valid:

```bash
# Inspect a downloaded YouTube video
node debug/analyze-mp4-segment.js temp/VIDEO_ID.mp4
```

Look for these indicators:

- MOOV atom is missing in the source video
- Unusual keyframe patterns or sparse keyframes
- Timestamp inconsistencies in the source

If the YouTube downloader is creating problematic files, try:

```bash
# Enable verbose YouTube download logging
export YT_DOWNLOAD_DEBUG=1
npm start -- --video=problematic_id
```

Review logs for download errors or retries.

### Step 3: Check Intermediate Processing

Sometimes issues occur during format conversion:

```bash
# Enable processor service debug logs
export DEBUG=processor,*
npm start -- --video=problematic_id
```

Watch for:

- Format detection errors
- Codec compatibility warnings
- "Non-monotonous DTS" errors
- Key frame errors

### Step 4: Trace Segmentation Process

To debug the segmentation process itself:

```bash
# Run the diagnostic script on problematic segment
node debug/trace-segment-creation.js --input=temp/VIDEO_ID.mp4 --start=00:01:30 --end=00:02:00
```

This will trace the exact FFmpeg commands being used and their outputs.

### Step 5: Test Different Container Formats

Test segmenting into different formats to isolate container-specific issues:

```javascript
// In your code, try with different formats
const testFormats = ['mp4', 'ts', 'mkv', 'webm'];
for (const format of testFormats) {
  try {
    await segmentVideo(inputPath, testOutputDir, segments, { format });
    console.log(`Format ${format} succeeded`);
  } catch (err) {
    console.error(`Format ${format} failed: ${err.message}`);
  }
}
```

## Common Root Causes and Solutions

### Corrupted Cache Files

**Symptoms:**

- Files are corrupted when viewing segments
- Clearing cache and re-downloading fixes the issue
- Issues occur intermittently, especially after network problems

**Solutions:**

- Always clear the cache before starting a new download session
- Implement network retry logic for more resilient downloads
- Add integrity checks after downloads complete

### Network Errors During Download

**Symptoms:**

- Incomplete downloads
- Corrupted video files

**Diagnosis:**
Enable network logging and check for timeout errors or partial responses.

**Solutions:**

- Implement download retry logic with exponential backoff
- Verify download integrity after completion

### Keyframe Issues

**Symptoms:**

- Segments start with artifacts
- Only partial frame visible at segment start

**Diagnosis:**

```bash
# Check keyframe distribution
ffprobe -v error -select_streams v -show_entries frame=pict_type,pts_time -of csv input.mp4 | grep -n I
```

**Solutions:**

- Use TS container format which is more tolerant of keyframe issues
- Force re-encoding with regular keyframe intervals

## Player-Specific Issues

Different video players handle MP4 container issues differently:

- **Chrome/Firefox**: Strict about MOOV atom placement
- **VLC**: More tolerant but can still have issues with broken segments
- **MPC-HC**: Most forgiving with container issues
- **Safari**: Strict about HLS segment compatibility

Test playback on multiple players to identify player-specific problems.

## Debugging Tools

### 1. Video File Structure Analyzer

```bash
node debug/analyze-mp4-segment.js path/to/video.mp4
```

Analyzes:

- File structure (atoms, boxes)
- Keyframe placement
- Timestamp continuity

### 2. Segment Creation Tracer

```bash
node debug/trace-segment-creation.js --input=input.mp4 --start=00:01:30 --end=00:02:00
```

Provides:

- Detailed FFmpeg command execution
- Input/output analysis
- Error tracing

### 3. Cache Clearing Tool

```bash
node debug/clear-cache.js
```

Clears:

- Temporary downloaded videos
- Generated segments
- Debug outputs

## Logging

Enable detailed logging to trace the entire pipeline:

```bash
# Set environment variables
export DEBUG=*
export LOG_LEVEL=debug
export FFMPEG_LOG_LEVEL=debug

# Run with specific video
npm start -- --video=problematic_id
```

This will log every step of the processing pipeline, making it easier to identify where issues are occurring.

## Common FFmpeg Error Messages and Their Meanings

| Error Message                              | Probable Cause             | Troubleshooting Step                 |
| ------------------------------------------ | -------------------------- | ------------------------------------ |
| "moov atom not found"                      | Missing metadata container | Check YouTube download integrity     |
| "Non-monotonous DTS"                       | Timestamp ordering issues  | Check source video or use -vsync cfr |
| "Invalid data found when processing input" | Corrupted source file      | Re-download or check source file     |
| "Error while decoding stream"              | Codec compatibility issue  | Try different codec or container     |
| "Could not find codec parameters"          | Missing stream information | Check source video headers           |

## Creating Diagnostic Reports

For persistent issues, generate a full diagnostic report:

```bash
node debug/generate-diagnostic-report.js --video=problematic_id
```

This will create a ZIP file with:

- Full FFmpeg logs
- File structure analysis
- Segment information
- System configuration

Share this report when seeking support or filing bug reports.
