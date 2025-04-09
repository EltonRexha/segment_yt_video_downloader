#!/usr/bin/env node

/**
 * Segment Creation Tracer
 *
 * This tool traces the entire segment creation process to identify where issues
 * might be occurring when creating video segments.
 *
 * Usage:
 *   node trace-segment-creation.js --input=input.mp4 --start=00:01:30 --end=00:02:00 [--format=mp4|ts|mkv|webm]
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const minimist = require('minimist');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['input', 'start', 'end', 'format', 'output-dir'],
  default: {
    format: 'mp4',
    'output-dir': path.join(os.tmpdir(), 'segment-tracer'),
  },
});

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

// Validate required parameters
if (!argv.input || !argv.start || !argv.end) {
  console.error(
    `${colors.red}${colors.bold}Error: Missing required parameters${colors.reset}`
  );
  console.log(
    `Usage: node trace-segment-creation.js --input=input.mp4 --start=00:01:30 --end=00:02:00 [--format=mp4|ts|mkv|webm]`
  );
  process.exit(1);
}

// Input file validation
const inputFile = argv.input;
const startTime = argv.start;
const endTime = argv.end;
const outputFormat = argv.format;
const outputDir = argv['output-dir'];

// Make sure the format is valid
const validFormats = ['mp4', 'ts', 'mkv', 'webm'];
if (!validFormats.includes(outputFormat)) {
  console.error(
    `${colors.red}${
      colors.bold
    }Error: Invalid format '${outputFormat}'. Must be one of: ${validFormats.join(
      ', '
    )}${colors.reset}`
  );
  process.exit(1);
}

// Create a trace log
const traceLog = [];

/**
 * Log a message with timestamp and append to trace log
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colorMap = {
    info: colors.white,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    command: colors.cyan,
    result: colors.magenta,
  };

  const logMessage = `[${timestamp}] ${message}`;
  console.log(`${colorMap[type] || ''}${logMessage}${colors.reset}`);
  traceLog.push({ timestamp, message, type });
}

/**
 * Run a shell command and capture output
 */
async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const cmdStr = `${command} ${args.join(' ')}`;
    log(`Executing: ${cmdStr}`, 'command');

    const process = spawn(command, args, options);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      // Log important FFmpeg messages
      if (
        output.includes('moov atom not found') ||
        output.includes('Non-monotonous DTS') ||
        output.includes('Invalid data') ||
        output.includes('Error while')
      ) {
        log(`IMPORTANT: ${output.trim()}`, 'error');
      }
    });

    process.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;

      // FFmpeg outputs progress to stderr
      if (output.includes('frame=') || output.includes('size=')) {
        return; // Skip progress outputs
      }

      // Log important FFmpeg messages from stderr
      if (
        output.includes('moov atom not found') ||
        output.includes('Non-monotonous DTS') ||
        output.includes('Invalid data') ||
        output.includes('Error while')
      ) {
        log(`IMPORTANT: ${output.trim()}`, 'error');
      }
    });

    process.on('close', (code) => {
      if (code === 0) {
        log(`Command completed successfully with exit code ${code}`, 'success');
        resolve({ stdout, stderr, code });
      } else {
        log(`Command failed with exit code ${code}`, 'error');
        log(`Error output: ${stderr}`, 'error');
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (err) => {
      log(`Failed to execute command: ${err.message}`, 'error');
      reject(err);
    });
  });
}

/**
 * Get file information using ffprobe
 */
async function getFileInfo(filePath) {
  try {
    const { stdout } = await runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,avg_frame_rate,pix_fmt',
      '-of',
      'json',
      filePath,
    ]);

    return JSON.parse(stdout);
  } catch (error) {
    log(`Failed to get file info: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Check for keyframes near the specified start time
 */
async function findNearestKeyframes(filePath, targetTime) {
  try {
    log(`Finding keyframes near ${targetTime}...`, 'info');

    const { stdout } = await runCommand('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-skip_frame',
      'nokey',
      '-show_entries',
      'frame=pkt_pts_time,pict_type',
      '-of',
      'json',
      filePath,
    ]);

    const result = JSON.parse(stdout);
    const frames = result.frames || [];

    // Convert target time to seconds
    const targetSeconds = timeToSeconds(targetTime);

    // Find keyframes before and after target time
    let before = null;
    let after = null;

    for (const frame of frames) {
      const frameTime = parseFloat(frame.pkt_pts_time);

      if (
        frameTime <= targetSeconds &&
        (before === null || frameTime > before.time)
      ) {
        before = { time: frameTime, diff: targetSeconds - frameTime };
      }

      if (
        frameTime >= targetSeconds &&
        (after === null || frameTime < after.time)
      ) {
        after = { time: frameTime, diff: frameTime - targetSeconds };
        break; // Found the first keyframe after target
      }
    }

    return { before, after };
  } catch (error) {
    log(`Failed to find keyframes: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Convert timestamp format (HH:MM:SS) to seconds
 */
function timeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parseFloat(timeStr);
}

/**
 * Convert seconds to timestamp format (HH:MM:SS)
 */
function secondsToTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(start, end) {
  return timeToSeconds(end) - timeToSeconds(start);
}

/**
 * Test direct stream copy
 */
async function testStreamCopy(inputFile, outputFile, startTime, endTime) {
  try {
    log(`Testing segment creation with stream copy...`, 'info');

    await runCommand('ffmpeg', [
      '-i',
      inputFile,
      '-ss',
      startTime,
      '-to',
      endTime,
      '-c',
      'copy',
      '-avoid_negative_ts',
      '1',
      '-y',
      outputFile,
    ]);

    log(`Stream copy successful: ${outputFile}`, 'success');
    return true;
  } catch (error) {
    log(`Stream copy failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Test segment creation with keyframe alignment
 */
async function testKeyframeAlignedCopy(
  inputFile,
  outputFile,
  startKeyframe,
  endTime
) {
  try {
    log(`Testing segment creation with keyframe alignment...`, 'info');

    await runCommand('ffmpeg', [
      '-i',
      inputFile,
      '-ss',
      secondsToTime(startKeyframe),
      '-to',
      endTime,
      '-c',
      'copy',
      '-avoid_negative_ts',
      '1',
      '-y',
      outputFile,
    ]);

    log(`Keyframe-aligned copy successful: ${outputFile}`, 'success');
    return true;
  } catch (error) {
    log(`Keyframe-aligned copy failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Test re-encoding segment
 */
async function testReEncode(inputFile, outputFile, startTime, endTime) {
  try {
    log(`Testing segment creation with re-encoding...`, 'info');

    await runCommand('ffmpeg', [
      '-i',
      inputFile,
      '-ss',
      startTime,
      '-to',
      endTime,
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-movflags',
      'faststart',
      '-preset',
      'fast',
      '-y',
      outputFile,
    ]);

    log(`Re-encoding successful: ${outputFile}`, 'success');
    return true;
  } catch (error) {
    log(`Re-encoding failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Test two-step segment creation (extract to TS, then convert back)
 */
async function testTwoStepSegment(inputFile, outputFile, startTime, endTime) {
  try {
    log(`Testing two-step segment creation...`, 'info');

    const tsOutput = outputFile.replace(/\.[^/.]+$/, '.ts');

    // Step 1: Extract to TS format
    await runCommand('ffmpeg', [
      '-i',
      inputFile,
      '-ss',
      startTime,
      '-to',
      endTime,
      '-c',
      'copy',
      '-y',
      tsOutput,
    ]);

    // Step 2: Convert back to desired format
    await runCommand('ffmpeg', [
      '-i',
      tsOutput,
      '-c',
      'copy',
      '-movflags',
      'faststart',
      '-y',
      outputFile,
    ]);

    log(`Two-step segmentation successful: ${outputFile}`, 'success');
    return true;
  } catch (error) {
    log(`Two-step segmentation failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Test segment creation using segment muxer
 */
async function testSegmentMuxer(inputFile, outputFile, startTime, endTime) {
  try {
    log(`Testing segment creation with segment muxer...`, 'info');

    const duration = calculateDuration(startTime, endTime);
    const segmentTime = duration.toString();

    await runCommand('ffmpeg', [
      '-i',
      inputFile,
      '-ss',
      startTime,
      '-c',
      'copy',
      '-map',
      '0',
      '-f',
      'segment',
      '-segment_time',
      segmentTime,
      '-segment_start_number',
      '0',
      '-segment_format',
      outputFormat,
      '-reset_timestamps',
      '1',
      '-y',
      outputFile,
    ]);

    log(`Segment muxer successful: ${outputFile}`, 'success');
    return true;
  } catch (error) {
    log(`Segment muxer failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Validate segment file
 */
async function validateSegment(filePath) {
  try {
    log(`Validating segment: ${filePath}`, 'info');

    // Check if file exists and has non-zero size
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      log(`Segment file is empty: ${filePath}`, 'error');
      return false;
    }

    // Try to get file info with ffprobe
    const info = await getFileInfo(filePath);

    // Check for streams
    if (!info.streams || info.streams.length === 0) {
      log(`No streams found in segment file`, 'error');
      return false;
    }

    // Check if first frame is a keyframe
    const { stdout } = await runCommand('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'frame=pict_type,key_frame',
      '-of',
      'json',
      '-frames:v',
      '1',
      filePath,
    ]);

    const frameInfo = JSON.parse(stdout);
    const firstFrameIsKeyframe =
      frameInfo.frames &&
      frameInfo.frames.length > 0 &&
      frameInfo.frames[0].key_frame === 1;

    if (!firstFrameIsKeyframe) {
      log(`First frame of segment is NOT a keyframe!`, 'warning');
    } else {
      log(`First frame of segment is a keyframe`, 'success');
    }

    log(`Segment validation successful: ${filePath}`, 'success');
    return true;
  } catch (error) {
    log(`Segment validation failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Save trace log to file
 */
async function saveTraceLog(outputDir) {
  try {
    const logFile = path.join(outputDir, 'trace-log.json');
    await fs.writeFile(logFile, JSON.stringify(traceLog, null, 2));

    log(`Trace log saved to: ${logFile}`, 'success');
    return logFile;
  } catch (error) {
    log(`Failed to save trace log: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Run the full trace process
 */
async function runTrace() {
  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    log(`Trace started for: ${inputFile}`, 'info');
    log(
      `Parameters: Start=${startTime}, End=${endTime}, Format=${outputFormat}`,
      'info'
    );

    // Get source file info
    log(`Analyzing source file: ${inputFile}`, 'info');
    const sourceInfo = await getFileInfo(inputFile);
    log(
      `Source file duration: ${
        sourceInfo.format?.duration || 'unknown'
      } seconds`,
      'info'
    );

    // Find nearest keyframes
    const startKeyframes = await findNearestKeyframes(inputFile, startTime);

    if (startKeyframes.before) {
      log(
        `Keyframe before start time: ${secondsToTime(
          startKeyframes.before.time
        )} (${startKeyframes.before.diff.toFixed(3)}s before target)`,
        'info'
      );
    } else {
      log(`No keyframe found before start time`, 'warning');
    }

    if (startKeyframes.after) {
      log(
        `Keyframe after start time: ${secondsToTime(
          startKeyframes.after.time
        )} (${startKeyframes.after.diff.toFixed(3)}s after target)`,
        'info'
      );
    } else {
      log(`No keyframe found after start time`, 'warning');
    }

    // Define test output files
    const outputBase = path.join(
      outputDir,
      path.basename(inputFile, path.extname(inputFile))
    );
    const streamCopyOutput = `${outputBase}_stream_copy.${outputFormat}`;
    const keyframeAlignedOutput = `${outputBase}_keyframe_aligned.${outputFormat}`;
    const reEncodeOutput = `${outputBase}_re_encode.${outputFormat}`;
    const twoStepOutput = `${outputBase}_two_step.${outputFormat}`;
    const segmentMuxerOutput = `${outputBase}_segment_muxer_%03d.${outputFormat}`;

    // Test different segmentation methods
    const results = {
      streamCopy: false,
      keyframeAligned: false,
      reEncode: false,
      twoStep: false,
      segmentMuxer: false,
    };

    // Method 1: Direct stream copy
    results.streamCopy = await testStreamCopy(
      inputFile,
      streamCopyOutput,
      startTime,
      endTime
    );

    if (results.streamCopy) {
      await validateSegment(streamCopyOutput);
    }

    // Method 2: Keyframe-aligned copy (if we found a keyframe)
    if (startKeyframes.before) {
      results.keyframeAligned = await testKeyframeAlignedCopy(
        inputFile,
        keyframeAlignedOutput,
        startKeyframes.before.time,
        endTime
      );

      if (results.keyframeAligned) {
        await validateSegment(keyframeAlignedOutput);
      }
    } else {
      log(
        `Skipping keyframe-aligned test: no keyframe found before start time`,
        'warning'
      );
    }

    // Method 3: Re-encode
    results.reEncode = await testReEncode(
      inputFile,
      reEncodeOutput,
      startTime,
      endTime
    );

    if (results.reEncode) {
      await validateSegment(reEncodeOutput);
    }

    // Method 4: Two-step segment
    results.twoStep = await testTwoStepSegment(
      inputFile,
      twoStepOutput,
      startTime,
      endTime
    );

    if (results.twoStep) {
      await validateSegment(twoStepOutput);
    }

    // Method 5: Segment muxer
    results.segmentMuxer = await testSegmentMuxer(
      inputFile,
      segmentMuxerOutput,
      startTime,
      endTime
    );

    // Cannot easily validate segment muxer output as it creates multiple files

    // Summarize results
    log(`\n${colors.bold}=== TRACE RESULTS ===${colors.reset}`, 'info');
    log(
      `Stream Copy: ${
        results.streamCopy ? colors.green + 'SUCCESS' : colors.red + 'FAILED'
      }${colors.reset}`,
      results.streamCopy ? 'success' : 'error'
    );
    log(
      `Keyframe-Aligned Copy: ${
        results.keyframeAligned
          ? colors.green + 'SUCCESS'
          : colors.red + 'FAILED'
      }${colors.reset}`,
      results.keyframeAligned ? 'success' : 'error'
    );
    log(
      `Re-Encode: ${
        results.reEncode ? colors.green + 'SUCCESS' : colors.red + 'FAILED'
      }${colors.reset}`,
      results.reEncode ? 'success' : 'error'
    );
    log(
      `Two-Step Process: ${
        results.twoStep ? colors.green + 'SUCCESS' : colors.red + 'FAILED'
      }${colors.reset}`,
      results.twoStep ? 'success' : 'error'
    );
    log(
      `Segment Muxer: ${
        results.segmentMuxer ? colors.green + 'SUCCESS' : colors.red + 'FAILED'
      }${colors.reset}`,
      results.segmentMuxer ? 'success' : 'error'
    );

    // Save trace log
    await saveTraceLog(outputDir);

    // Provide recommendations
    log(`\n${colors.bold}=== RECOMMENDATIONS ===${colors.reset}`, 'info');

    if (results.streamCopy) {
      log(
        `✓ Direct stream copying works! This is the fastest method.`,
        'success'
      );
    } else if (results.keyframeAligned) {
      log(
        `✓ Use keyframe-aligned copying: start at ${secondsToTime(
          startKeyframes.before.time
        )} instead of ${startTime}`,
        'success'
      );
    } else if (results.twoStep) {
      log(
        `✓ Use the two-step process (extract to TS format first, then convert)`,
        'success'
      );
    } else if (results.reEncode) {
      log(`✓ Force re-encoding instead of stream copying`, 'success');
    } else if (results.segmentMuxer) {
      log(`✓ Use the segment muxer with appropriate options`, 'success');
    } else {
      log(
        `✗ All methods failed. Try using a different container format or check if the source file is valid.`,
        'error'
      );
    }

    log(`\nAll outputs saved to: ${outputDir}`, 'info');
  } catch (error) {
    log(`Trace failed: ${error.message}`, 'error');
  }
}

// Run the trace process
runTrace().catch((err) => {
  console.error(
    `${colors.red}${colors.bold}Fatal error: ${err.message}${colors.reset}`
  );
  process.exit(1);
});
