#!/usr/bin/env node

/**
 * MP4 Segment Analyzer
 *
 * This script helps debug issues with MP4 video segments by analyzing
 * the file structure, keyframes, and providing recommendations.
 *
 * Usage: node analyze-mp4-segment.js path/to/video.mp4
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Get the input file from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    `${colors.red}${colors.bold}Error: Please provide a video file path.${colors.reset}`
  );
  console.log('Usage: node analyze-mp4-segment.js path/to/video.mp4');
  process.exit(1);
}

const inputFile = args[0];

// Validate file exists
if (!fs.existsSync(inputFile)) {
  console.error(
    `${colors.red}${colors.bold}Error: File not found: ${inputFile}${colors.reset}`
  );
  process.exit(1);
}

console.log(
  `${colors.bold}Analyzing video file: ${colors.cyan}${inputFile}${colors.reset}\n`
);

// Run the analysis
(async () => {
  try {
    const results = {
      fileInfo: await getFileInfo(inputFile),
      keyframeInfo: await getKeyframeInfo(inputFile),
      moovInfo: await checkMoovAtom(inputFile),
      timestampInfo: await checkTimestamps(inputFile),
    };

    // Print results
    printResults(results);

    // Provide recommendations
    provideRecommendations(results);
  } catch (error) {
    console.error(
      `${colors.red}${colors.bold}Analysis failed: ${error.message}${colors.reset}`
    );
  }
})();

/**
 * Get basic file information using ffprobe
 */
async function getFileInfo(filePath) {
  return new Promise((resolve, reject) => {
    const command = 'ffprobe';
    const args = [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,avg_frame_rate,pix_fmt',
      '-of',
      'json',
      filePath,
    ];

    const process = spawn(command, args);
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const info = JSON.parse(output);
        resolve(info);
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e.message}`));
      }
    });
  });
}

/**
 * Get keyframe information
 */
async function getKeyframeInfo(filePath) {
  return new Promise((resolve, reject) => {
    const command = 'ffprobe';
    const args = [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'frame=pict_type,pts_time,key_frame',
      '-of',
      'json',
      filePath,
    ];

    const process = spawn(command, args);
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const info = JSON.parse(output);

        // Calculate keyframe statistics
        const frames = info.frames || [];
        const keyframes = frames.filter((f) => f.key_frame === 1);

        if (keyframes.length === 0) {
          resolve({
            numKeyframes: 0,
            firstKeyframeAt: null,
            keyframeTimes: [],
            keyframeSpacing: {
              min: 0,
              max: 0,
              avg: 0,
            },
            hasKeyframeAtStart: false,
          });
          return;
        }

        const keyframeTimes = keyframes.map((f) => parseFloat(f.pts_time));

        // Calculate keyframe spacing
        const spacings = [];
        for (let i = 1; i < keyframeTimes.length; i++) {
          spacings.push(keyframeTimes[i] - keyframeTimes[i - 1]);
        }

        const firstKeyframeAt = keyframeTimes[0];
        const hasKeyframeAtStart = firstKeyframeAt < 0.1; // Consider 0.1s as "at start"

        const result = {
          numKeyframes: keyframes.length,
          firstKeyframeAt,
          keyframeTimes,
          keyframeSpacing: {
            min: spacings.length ? Math.min(...spacings) : 0,
            max: spacings.length ? Math.max(...spacings) : 0,
            avg: spacings.length
              ? spacings.reduce((a, b) => a + b, 0) / spacings.length
              : 0,
          },
          hasKeyframeAtStart,
        };

        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse keyframe info: ${e.message}`));
      }
    });
  });
}

/**
 * Check for MOOV atom presence and placement
 */
async function checkMoovAtom(filePath) {
  return new Promise((resolve, reject) => {
    // Using ffprobe to check for moov atom presence
    const command = 'ffprobe';
    const args = ['-v', 'trace', '-show_entries', 'format=duration', filePath];

    const process = spawn(command, args);
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      // Check if "moov atom not found" appears in the error output
      const moovNotFound = errorOutput.includes('moov atom not found');

      // Check if moov atom is at the beginning (faststart)
      const hasMoovAtom = errorOutput.includes("type:'moov'");
      const moovPosition = errorOutput.indexOf("type:'moov'");
      const ftypPosition = errorOutput.indexOf("type:'ftyp'");

      // If ftyp appears before moov and they're both present, moov is at beginning
      const isMoovAtBeginning =
        hasMoovAtom &&
        ftypPosition > 0 &&
        moovPosition > 0 &&
        moovPosition - ftypPosition < 1000; // Arbitrary threshold

      resolve({
        hasMoovAtom,
        moovNotFound,
        isMoovAtBeginning,
      });
    });
  });
}

/**
 * Check for timestamp issues
 */
async function checkTimestamps(filePath) {
  return new Promise((resolve, reject) => {
    const command = 'ffprobe';
    const args = [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'frame=pkt_dts_time,pkt_pts_time',
      '-of',
      'json',
      filePath,
    ];

    const process = spawn(command, args);
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const info = JSON.parse(output);
        const frames = info.frames || [];

        // Check for timestamp discontinuities
        let discontinuities = 0;
        let previousDts = null;
        let hasNegativeTimestamps = false;

        for (const frame of frames) {
          const dts =
            frame.pkt_dts_time !== 'N/A'
              ? parseFloat(frame.pkt_dts_time)
              : null;

          if (dts !== null) {
            if (dts < 0) {
              hasNegativeTimestamps = true;
            }

            if (previousDts !== null && dts < previousDts) {
              discontinuities++;
            }

            previousDts = dts;
          }
        }

        resolve({
          numFrames: frames.length,
          discontinuities,
          hasNegativeTimestamps,
        });
      } catch (e) {
        reject(new Error(`Failed to parse timestamp info: ${e.message}`));
      }
    });
  });
}

/**
 * Print analysis results
 */
function printResults(results) {
  console.log(
    `${colors.bold}${colors.magenta}=== File Information ===${colors.reset}`
  );

  if (results.fileInfo.format) {
    console.log(`Duration: ${results.fileInfo.format.duration}s`);
    console.log(`Size: ${formatSize(results.fileInfo.format.size)}`);
    console.log(`Bitrate: ${formatBitrate(results.fileInfo.format.bit_rate)}`);
  }

  if (results.fileInfo.streams) {
    console.log('\nStreams:');
    results.fileInfo.streams.forEach((stream, index) => {
      console.log(
        `  Stream #${index}: ${stream.codec_type} (${stream.codec_name})`
      );
      if (stream.codec_type === 'video') {
        console.log(`    Resolution: ${stream.width}x${stream.height}`);
        console.log(`    Framerate: ${stream.avg_frame_rate}`);
        console.log(`    Pixel Format: ${stream.pix_fmt}`);
      }
    });
  }

  console.log(
    `\n${colors.bold}${colors.magenta}=== Keyframe Analysis ===${colors.reset}`
  );
  console.log(`Total Keyframes: ${results.keyframeInfo.numKeyframes}`);
  console.log(
    `First Keyframe At: ${
      results.keyframeInfo.firstKeyframeAt !== null
        ? `${results.keyframeInfo.firstKeyframeAt.toFixed(3)}s`
        : 'N/A'
    }`
  );
  console.log(
    `Keyframe at start: ${
      results.keyframeInfo.hasKeyframeAtStart
        ? colors.green + 'Yes' + colors.reset
        : colors.red + 'No' + colors.reset
    }`
  );

  if (results.keyframeInfo.keyframeSpacing.avg > 0) {
    console.log(
      `Keyframe Spacing: Min=${results.keyframeInfo.keyframeSpacing.min.toFixed(
        3
      )}s, Max=${results.keyframeInfo.keyframeSpacing.max.toFixed(
        3
      )}s, Avg=${results.keyframeInfo.keyframeSpacing.avg.toFixed(3)}s`
    );
  }

  console.log(
    `\n${colors.bold}${colors.magenta}=== Container Format Analysis ===${colors.reset}`
  );
  console.log(
    `MOOV Atom Present: ${
      results.moovInfo.hasMoovAtom
        ? colors.green + 'Yes' + colors.reset
        : colors.red + 'No' + colors.reset
    }`
  );
  console.log(
    `MOOV Atom at Beginning: ${
      results.moovInfo.isMoovAtBeginning
        ? colors.green + 'Yes' + colors.reset
        : colors.red + 'No' + colors.reset
    }`
  );

  console.log(
    `\n${colors.bold}${colors.magenta}=== Timestamp Analysis ===${colors.reset}`
  );
  console.log(`Total Frames: ${results.timestampInfo.numFrames}`);
  console.log(
    `Timestamp Discontinuities: ${
      results.timestampInfo.discontinuities === 0
        ? colors.green + results.timestampInfo.discontinuities + colors.reset
        : colors.red + results.timestampInfo.discontinuities + colors.reset
    }`
  );
  console.log(
    `Negative Timestamps: ${
      !results.timestampInfo.hasNegativeTimestamps
        ? colors.green + 'No' + colors.reset
        : colors.red + 'Yes' + colors.reset
    }`
  );
}

/**
 * Provide recommendations based on analysis
 */
function provideRecommendations(results) {
  console.log(
    `\n${colors.bold}${colors.blue}=== Recommendations ===${colors.reset}`
  );

  const issues = [];

  // Keyframe issues
  if (!results.keyframeInfo.hasKeyframeAtStart) {
    issues.push({
      severity: 'high',
      issue: 'No keyframe at the start of the video',
      solution:
        'Re-encode the segment with force_key_frames option or use TS format for segmentation',
    });
  }

  // MOOV atom issues
  if (!results.moovInfo.hasMoovAtom || results.moovInfo.moovNotFound) {
    issues.push({
      severity: 'critical',
      issue: 'MOOV atom not found',
      solution:
        'The file is likely corrupted. Try re-encoding or using an intermediate format like MPEG-TS',
    });
  } else if (!results.moovInfo.isMoovAtBeginning) {
    issues.push({
      severity: 'medium',
      issue: 'MOOV atom not at the beginning of the file',
      solution: 'Re-encode with -movflags faststart option',
    });
  }

  // Timestamp issues
  if (results.timestampInfo.discontinuities > 0) {
    issues.push({
      severity: 'high',
      issue: `${results.timestampInfo.discontinuities} timestamp discontinuities found`,
      solution: 'Use -reset_timestamps 1 when segmenting or try re-encoding',
    });
  }

  if (results.timestampInfo.hasNegativeTimestamps) {
    issues.push({
      severity: 'medium',
      issue: 'Negative timestamps detected',
      solution: 'Use -avoid_negative_ts 1 option with FFmpeg',
    });
  }

  // Sort issues by severity
  issues.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  if (issues.length === 0) {
    console.log(
      `${colors.green}No issues detected! The file appears to be valid.${colors.reset}`
    );
  } else {
    issues.forEach((issue) => {
      let color;
      switch (issue.severity) {
        case 'critical':
          color = colors.red;
          break;
        case 'high':
          color = colors.magenta;
          break;
        case 'medium':
          color = colors.yellow;
          break;
        case 'low':
          color = colors.cyan;
          break;
      }

      console.log(
        `${color}${colors.bold}[${issue.severity.toUpperCase()}]${
          colors.reset
        } ${issue.issue}`
      );
      console.log(
        `    ${colors.green}Solution: ${colors.reset}${issue.solution}`
      );
    });

    // Provide format recommendation
    if (
      issues.some((i) => i.severity === 'critical' || i.severity === 'high')
    ) {
      console.log(
        `\n${colors.yellow}${colors.bold}Recommended format change:${colors.reset}`
      );
      console.log(
        `  Consider using MPEG-TS (.ts) format instead of MP4 for better segment compatibility.`
      );
      console.log(`  Example: { format: 'ts', forceEncode: true }`);
    } else if (issues.length > 0) {
      console.log(
        `\n${colors.yellow}${colors.bold}Recommended FFmpeg options:${colors.reset}`
      );
      console.log(`  -movflags faststart -avoid_negative_ts 1`);
    }
  }
}

// Utility functions
function formatSize(bytes) {
  if (!bytes) return 'unknown';

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function formatBitrate(bps) {
  if (!bps) return 'unknown';

  const bpsMB = bps / 1000000;
  return bpsMB.toFixed(2) + ' Mbps';
}
