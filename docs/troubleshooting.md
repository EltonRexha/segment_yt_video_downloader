# Troubleshooting Guide

## Common Errors and Solutions

This document provides guidance for diagnosing and fixing common errors you might encounter while using the YouTube Video Processor.

## Application Errors

### "Cannot read properties of undefined (reading 'replace')"

**Error Message:**

```
error: Application error: Cannot read properties of undefined (reading 'replace')
```

**Cause:**
This error occurs when the application attempts to call the `replace()` method on a value that is `undefined`. The application processes strings in several key areas where this error can happen:

1. When sanitizing video titles during download
2. When sanitizing segment names during video processing
3. When creating directory or file names from video/segment information

The most common causes include:

1. Using `videos.json` with missing video titles or segment names
2. YouTube API returning unexpected data structure or missing video details
3. Auto-segmentation with videos that don't have proper chapter information

**Solutions:**

1. **Use the utility functions**:
   The application includes utility functions in `src/utils/string.ts` to safely handle string operations:

   ```typescript
   // Use these functions instead of direct string operations
   import { sanitizeFileName, safeReplace } from './utils/string';

   // Safe with fallback value
   const title = sanitizeFileName(video.title, 'default_title');

   // Safe string replacement
   const result = safeReplace(segmentName, /[^\w\s-]/gi, '', 'default_segment');
   ```

2. **Verify your videos.json structure**:
   Ensure all required fields have values and provide fallbacks for optional fields:

   ```json
   {
     "id": "video1",
     "url": "https://www.youtube.com/watch?v=VIDEO_ID",
     "title": "My Video Title", // Add titles to avoid undefined values
     "segments": [
       {
         "name": "Introduction", // Ensure segment names are defined
         "start": "00:00:00",
         "end": "00:05:00"
       }
     ]
   }
   ```

3. **Add defensive null checks**:
   Always check if values exist before operating on them:

   ```typescript
   // Bad - might cause "Cannot read properties of undefined (reading 'replace')"
   const sanitized = video.title.replace(/[^\w\s-]/gi, '');

   // Good - safe approach
   const sanitized = video.title
     ? video.title.replace(/[^\w\s-]/gi, '')
     : 'untitled';

   // Better - using optional chaining and nullish coalescing
   const sanitized = video.title?.replace(/[^\w\s-]/gi, '') ?? 'untitled';
   ```

4. **Check application logs**:
   Review the detailed logs in `logs/error.log` to see exactly which object and property is undefined:

   ```
   error: Failed to process video video123: Error segmenting video:
   Cannot read properties of undefined (reading 'replace')
   ```

   This will help you identify whether it's a video title, segment name, or something else.

### Null Safety Patterns

To prevent undefined property errors, the application implements several null safety patterns:

1. **Safe string operations**

   The application includes utility functions for safely working with potentially undefined strings:

   ```typescript
   // src/utils/string.ts

   // Safe filename sanitization
   const safeFilename = sanitizeFileName(
     someValue, // Input string (might be undefined)
     'defaultName' // Default value if input is undefined
   );

   // Safe string replacement
   const result = safeReplace(
     someValue, // Input string (might be undefined)
     /[^\w\s-]/gi, // Pattern to replace
     '', // Replacement
     'defaultIfUndefined' // Default value if input is undefined
   );
   ```

2. **Safe property access**

   For safely accessing object properties:

   ```typescript
   // src/utils/guards.ts

   // Safe property access with default
   const title = safeGet(video, 'title', 'Untitled');

   // Safe nested property access
   const chapterName = safeGetNested(
     videoData,
     ['videoDetails', 'chapters', 0, 'title'],
     'Chapter 1'
   );

   // Type guard for defined values
   if (isDefined(video.title)) {
     // Safe to use video.title here
   }
   ```

3. **Defensive coding practices**

   - Always provide fallback values: `const name = value || 'default'`
   - Use optional chaining: `data?.property?.subProperty`
   - Use nullish coalescing: `const result = value ?? defaultValue`
   - Convert values to strings safely: `String(value || '')`

Using these patterns throughout the application prevents "Cannot read properties of undefined" errors by ensuring values are properly handled before operating on them.

## Network Errors

### YouTube API Connection Issues

**Error Messages:**

```
error: Failed to download video: Status code: 429
error: Failed to download video: Error: getaddrinfo ENOTFOUND www.youtube.com
```

**Causes:**

1. Rate limiting by YouTube (HTTP 429 errors)
2. Network connectivity issues
3. YouTube API changes

**Solutions:**

1. **Rate Limiting:**

   - Wait a few hours before trying again
   - Reduce concurrency (`--concurrency 1`)
   - Use a VPN or different IP address

2. **Network Issues:**

   - Check your internet connection
   - Verify you can access YouTube in a browser
   - Check firewall settings

3. **API Changes:**
   - Update to the latest version of the application
   - Check for updates to the ytdl-core dependency

## File System Errors

### Permission or Space Issues

**Error Messages:**

```
error: Failed to create directory: EACCES: permission denied
error: Failed to write file: ENOSPC: no space left on device
```

**Solutions:**

1. **Permission Issues:**

   - Run the application with appropriate permissions
   - Check file and directory ownership
   - Specify an output directory where you have write access

2. **Disk Space:**
   - Free up disk space
   - Specify a different output directory with more space
   - Process fewer videos at a time

## Processing Errors

### FFmpeg Errors

**Error Messages:**

```
error: Error segmenting video: Error: ffmpeg exited with code 1
error: Error segmenting video: Error: Output stream closed
```

**Causes:**

1. Incompatible video format
2. Corrupted download
3. Invalid timestamp format
4. FFmpeg installation issues

**Solutions:**

1. **Check FFmpeg installation:**

   - Ensure ffmpeg is properly installed via ffmpeg-static
   - Try installing FFmpeg system-wide as a fallback

2. **Verify timestamps:**

   - Ensure segment timestamps are in valid format (HH:MM:SS)
   - Verify that end timestamps are greater than start timestamps
   - Check that timestamps don't exceed video duration

3. **Re-download the video:**
   - Delete partially downloaded videos in the temp directory
   - Run again with `--force` flag

## Getting More Help

If you're still encountering issues:

1. **Check full logs:**

   - Examine both `logs/error.log` and `logs/combined.log` for more details

2. **Use development mode:**

   - Run the application with the `--dev` flag to get detailed error stacks
   - Example: `node dist/index.js --dev`
   - In dev mode, errors are not caught and wrapped, allowing you to see the full original stack trace
   - This is especially useful for debugging during development

3. **Use advanced debugging:**

   For persistent or hard-to-track errors, especially with "Cannot read properties of undefined", use the enhanced debugging features:

   ```bash
   # Enable both development mode and verbose output
   node dist/index.js --dev
   ```

   The enhanced debugging features provide:

   - Detailed information about YouTube API responses
   - Object structure inspection before accessing properties
   - Special tracking for string operations that might cause errors
   - Stack traces showing exactly where undefined values are accessed
   - Runtime monitoring of the code execution flow

   When you see the original error:

   ```
   error: Application error: Cannot read properties of undefined (reading 'replace')
   ```

   The enhanced version will show:

   ```
   🚨 POTENTIAL NULL SAFETY ISSUE DETECTED 🚨
   Operation: replace
   Location: [specific function/file]
   Stack trace:
   [detailed stack trace showing the exact location]
   ```

   This lets you pinpoint exactly which object is undefined and where in the codebase the error is occurring.

   **Using the Specialized Debug Script**

   For "Cannot read properties of undefined (reading 'replace')" errors specifically, you can use our specialized debug script:

   ```bash
   # Run the debug script on your videos.json file
   node scripts/debug-replace.js data/videos.json
   ```

   This script will:

   1. Check your videos.json for missing required properties
   2. Validate YouTube URLs
   3. Identify null or undefined values that might cause replace() errors
   4. Provide specific recommendations for fixing the issues

4. **Report issues:**
   - Provide complete error messages
   - Include your videos.json configuration (sanitize any sensitive data)
   - Describe your environment (OS, Node.js version)
