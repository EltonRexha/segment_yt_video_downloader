# Video Processing Tips & Best Practices

This document provides practical tips and best practices for processing videos in this application, with a focus on maintaining reliability and quality.

## Clearing the Cache

**Important**: Many video corruption issues are simply caused by cached files that were corrupted during download (possibly due to network interruptions).

### When to Clear the Cache

Always clear the cache:

- Before processing important videos
- When you encounter corrupted segments
- If the internet connection was interrupted during a previous download
- When switching between different videos

### How to Clear the Cache

```bash
# Basic cache clearing
node debug/clear-cache.js

# Clear cache and all debug data
node debug/clear-cache.js --all

# Force clear without confirmation
node debug/clear-cache.js --force
```

## Download Reliability

For more reliable downloads:

1. **Use a stable internet connection** - Wired connections are preferable to wireless when downloading large videos.

2. **Try different quality settings** - Sometimes certain quality options download more reliably than others:

   ```javascript
   // In your config:
   {
     "videoId": "example123",
     "quality": "highest" // Try: "720p", "480p", etc. if highest fails
   }
   ```

3. **Download in smaller batches** - Process 5-10 videos at a time rather than dozens in one go.

## Format Selection Tips

Different container formats have different advantages:

| Format | Pros                        | Cons                             |
| ------ | --------------------------- | -------------------------------- |
| MP4    | Most compatible             | Sensitive to keyframe boundaries |
| TS     | Very tolerant of segmenting | Less widely supported            |
| MKV    | Supports almost any codec   | Limited web player support       |
| WebM   | Good for web delivery       | Limited codec support            |

For most reliable results:

```javascript
// For highest compatibility
{ format: "mp4", quality: "high" }

// For most reliable segmentation
{ format: "ts", quality: "medium" }

// For best quality/size ratio
{ format: "mkv", quality: "high" }
```

## Performance Optimization

1. **Stream copying vs. re-encoding**:

   - Stream copying (`-c copy`) is much faster but requires proper keyframes
   - Re-encoding ensures perfect segments but is 10-20x slower

2. **Parallel processing**:

   - Process multiple videos simultaneously on multi-core systems
   - Set `"maxConcurrent": 3` for a quad-core system

3. **Disk space management**:
   - Regularly clean cached videos with `node debug/clear-cache.js`
   - Store output on SSD for better performance

## Troubleshooting Common Issues

### Corrupted Segments After Download

**Symptom**: Generated segments won't play correctly or show errors in players.

**Solution**:

1. Clear the cache: `node debug/clear-cache.js`
2. Re-download the video
3. Use TS format if MP4 continues to have issues

### Long Processing Times

**Symptom**: Video processing taking much longer than expected.

**Solution**:

1. Check if fallback re-encoding is happening (see logs)
2. Try using explicit format settings to avoid fallback
3. Consider lower quality settings for faster processing

### Misaligned Segments

**Symptom**: Segments start too early/late or have artifacts at the beginning.

**Solution**:

1. Try TS format which is more tolerant of boundary issues
2. Add a small buffer (1-2 seconds) to each segment
3. Consider using explicit keyframe cutting with the trace tool:
   ```bash
   node debug/trace-segment-creation.js --input=video.mp4 --start=00:01:30 --end=00:02:00
   ```

## Best Practices Summary

1. **Always clear cache between downloads**
2. **Use appropriate formats for your needs**
3. **Monitor network stability during downloads**
4. **Check segment quality before publishing**
5. **Keep your FFmpeg version current**

Remember that network issues during download are a common source of corrupted videos. When in doubt, clear your cache and try again!
