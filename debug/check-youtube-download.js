#!/usr/bin/env node

/**
 * YouTube Download Analyzer
 *
 * This script analyzes YouTube downloads to check for potential issues that might
 * lead to segmentation problems.
 *
 * Usage:
 *   node check-youtube-download.js --url=https://www.youtube.com/watch?v=VIDEO_ID [--quality=best]
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const minimist = require('minimist');
const ytdl = require('ytdl-core');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['url', 'quality', 'output-dir'],
  default: {
    quality: 'highest',
    'output-dir': path.join(os.tmpdir(), 'yt-analyzer'),
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
if (!argv.url) {
  console.error(
    `${colors.red}${colors.bold}Error: Missing required YouTube URL${colors.reset}`
  );
  console.log(
    `Usage: node check-youtube-download.js --url=https://www.youtube.com/watch?v=VIDEO_ID [--quality=highest]`
  );
  process.exit(1);
}

// Check if ytdl-core exists
try {
  require.resolve('ytdl-core');
} catch (e) {
  console.error(
    `${colors.red}${colors.bold}Error: ytdl-core is not installed. Run 'npm install ytdl-core' first.${colors.reset}`
  );
  process.exit(1);
}

// Input validation
const youtubeUrl = argv.url;
const quality = argv.quality;
const outputDir = argv['output-dir'];

/**
 * Log a message with timestamp
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

  console.log(
    `${colorMap[type] || ''}[${timestamp}] ${message}${colors.reset}`
  );
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
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        log(`Command completed successfully with exit code ${code}`, 'success');
        resolve({ stdout, stderr, code });
      } else {
        log(`Command failed with exit code ${code}`, 'error');
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
 * Get information about a YouTube video
 */
async function getVideoInfo(url) {
  try {
    log(`Fetching YouTube video info: ${url}`, 'info');
    const info = await ytdl.getInfo(url);
    return info;
  } catch (error) {
    log(`Failed to get video info: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Download a YouTube video
 */
async function downloadVideo(videoInfo, quality, outputPath) {
  try {
    log(`Downloading video with quality: ${quality}`, 'info');

    // Select format
    const formatFilter =
      quality === 'highest'
        ? (format) => format.hasVideo && format.hasAudio
        : (format) =>
            format.qualityLabel === quality &&
            format.hasVideo &&
            format.hasAudio;

    const format = ytdl.chooseFormat(videoInfo.formats, {
      quality,
      filter: formatFilter,
    });
    log(
      `Selected format: ${format.qualityLabel} (${format.container})`,
      'info'
    );

    // Create writable stream
    const outputStream = createWriteStream(outputPath);

    // Create readable stream
    const videoStream = ytdl.downloadFromInfo(videoInfo, { format });

    let downloadedBytes = 0;
    const totalBytes = parseInt(format.contentLength) || 0;

    videoStream.on('progress', (_, downloaded, total) => {
      downloadedBytes = downloaded;
      const percent = total
        ? Math.round((downloaded / total) * 100)
        : 'unknown';
      log(
        `Download progress: ${percent}% (${formatSize(downloaded)}/${formatSize(
          total
        )})`,
        'info'
      );
    });

    // Pipe the streams
    await pipeline(videoStream, outputStream);

    log(`Download completed: ${outputPath}`, 'success');

    return {
      format,
      downloadedBytes,
      totalBytes,
      outputPath,
    };
  } catch (error) {
    log(`Download failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Analyze downloaded video for issues
 */
async function analyzeVideo(filePath) {
  try {
    log(`Analyzing video file: ${filePath}`, 'info');

    // Check file size
    const stats = await fs.stat(filePath);
    log(`File size: ${formatSize(stats.size)}`, 'info');

    if (stats.size === 0) {
      log(`File is empty!`, 'error');
      return { valid: false, issues: ['File is empty'] };
    }

    // Get basic file info
    const fileInfo = await getFileInfo(filePath);

    // Get stream and format info
    const videoStream = fileInfo.streams?.find((s) => s.codec_type === 'video');
    const audioStream = fileInfo.streams?.find((s) => s.codec_type === 'audio');

    const issues = [];

    // Check for video stream
    if (!videoStream) {
      log(`No video stream found!`, 'error');
      issues.push('No video stream');
    } else {
      log(
        `Video codec: ${videoStream.codec_name}, Resolution: ${videoStream.width}x${videoStream.height}`,
        'info'
      );
    }

    // Check for audio stream
    if (!audioStream) {
      log(`No audio stream found!`, 'warning');
      issues.push('No audio stream');
    } else {
      log(`Audio codec: ${audioStream.codec_name}`, 'info');
    }

    // Check container format
    const format = fileInfo.format || {};
    log(
      `Container format: ${format.format_name}, Duration: ${format.duration}s`,
      'info'
    );

    // Check for MOOV atom (for MP4 files)
    if (path.extname(filePath).toLowerCase() === '.mp4') {
      const moovResult = await checkMoovAtom(filePath);

      if (moovResult.moovNotFound) {
        log(`MOOV atom not found!`, 'error');
        issues.push('MOOV atom missing');
      } else if (!moovResult.isMoovAtBeginning) {
        log(`MOOV atom not at the beginning of the file`, 'warning');
        issues.push('MOOV atom not at beginning');
      } else {
        log(`MOOV atom present and properly positioned`, 'success');
      }
    }

    // Check for keyframes
    const keyframeInfo = await getKeyframeInfo(filePath);

    if (keyframeInfo.numKeyframes === 0) {
      log(`No keyframes found!`, 'error');
      issues.push('No keyframes');
    } else {
      log(`Keyframes found: ${keyframeInfo.numKeyframes}`, 'info');

      if (keyframeInfo.keyframeSpacing.min < 0.5) {
        log(
          `Keyframes are very close together (min spacing: ${keyframeInfo.keyframeSpacing.min.toFixed(
            3
          )}s)`,
          'warning'
        );
        issues.push('Unusually close keyframes');
      }

      if (keyframeInfo.keyframeSpacing.max > 10) {
        log(
          `Large gaps between keyframes (max spacing: ${keyframeInfo.keyframeSpacing.max.toFixed(
            3
          )}s)`,
          'warning'
        );
        issues.push('Large keyframe gaps');
      }
    }

    // Check for timestamp issues
    const timestampInfo = await checkTimestamps(filePath);

    if (timestampInfo.discontinuities > 0) {
      log(
        `Found ${timestampInfo.discontinuities} timestamp discontinuities!`,
        'error'
      );
      issues.push(`${timestampInfo.discontinuities} timestamp discontinuities`);
    }

    if (timestampInfo.hasNegativeTimestamps) {
      log(`Found negative timestamps!`, 'warning');
      issues.push('Negative timestamps');
    }

    // Overall assessment
    const valid = issues.length === 0;

    log(`\n${colors.bold}=== ANALYSIS RESULT ===${colors.reset}`, 'info');

    if (valid) {
      log(
        `✓ The downloaded video appears to be valid with no obvious issues`,
        'success'
      );
    } else {
      log(`✗ The downloaded video has the following issues:`, 'error');
      issues.forEach((issue) => log(`  - ${issue}`, 'error'));
    }

    return { valid, issues, fileInfo, keyframeInfo, timestampInfo };
  } catch (error) {
    log(`Analysis failed: ${error.message}`, 'error');
    return { valid: false, issues: [error.message] };
  }
}

/**
 * Check for timestamp issues
 */
async function checkTimestamps(filePath) {
  try {
    const { stdout } = await runCommand('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'frame=pkt_dts_time,pkt_pts_time',
      '-of',
      'json',
      filePath,
    ]);

    const info = JSON.parse(stdout);
    const frames = info.frames || [];

    // Check for timestamp discontinuities
    let discontinuities = 0;
    let previousDts = null;
    let hasNegativeTimestamps = false;

    for (const frame of frames) {
      const dts =
        frame.pkt_dts_time !== 'N/A' ? parseFloat(frame.pkt_dts_time) : null;

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

    return {
      numFrames: frames.length,
      discontinuities,
      hasNegativeTimestamps,
    };
  } catch (error) {
    log(`Failed to check timestamps: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get keyframe information
 */
async function getKeyframeInfo(filePath) {
  try {
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

    if (frames.length === 0) {
      return {
        numKeyframes: 0,
        keyframeTimes: [],
        keyframeSpacing: {
          min: 0,
          max: 0,
          avg: 0,
        },
      };
    }

    const keyframeTimes = frames
      .map((f) => parseFloat(f.pkt_pts_time))
      .filter((t) => !isNaN(t));

    // Calculate keyframe spacing
    const spacings = [];
    for (let i = 1; i < keyframeTimes.length; i++) {
      spacings.push(keyframeTimes[i] - keyframeTimes[i - 1]);
    }

    return {
      numKeyframes: keyframeTimes.length,
      keyframeTimes,
      keyframeSpacing: {
        min: spacings.length ? Math.min(...spacings) : 0,
        max: spacings.length ? Math.max(...spacings) : 0,
        avg: spacings.length
          ? spacings.reduce((a, b) => a + b, 0) / spacings.length
          : 0,
      },
    };
  } catch (error) {
    log(`Failed to get keyframe info: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Check for MOOV atom presence and placement
 */
async function checkMoovAtom(filePath) {
  try {
    const { stdout, stderr } = await runCommand('ffprobe', [
      '-v',
      'trace',
      '-show_entries',
      'format=duration',
      filePath,
    ]);

    // Check if "moov atom not found" appears in the stderr
    const moovNotFound = stderr.includes('moov atom not found');

    // Check if moov atom is at the beginning (faststart)
    const hasMoovAtom = stderr.includes("type:'moov'");
    const moovPosition = stderr.indexOf("type:'moov'");
    const ftypPosition = stderr.indexOf("type:'ftyp'");

    // If ftyp appears before moov and they're both present, moov is at beginning
    const isMoovAtBeginning =
      hasMoovAtom &&
      ftypPosition > 0 &&
      moovPosition > 0 &&
      moovPosition - ftypPosition < 1000; // Arbitrary threshold

    return {
      hasMoovAtom,
      moovNotFound,
      isMoovAtBeginning,
    };
  } catch (error) {
    log(`Failed to check MOOV atom: ${error.message}`, 'error');
    throw error;
  }
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
 * Format file size in human readable format
 */
function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return 'unknown';

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Try downloading with different quality options to find what works
 */
async function tryDifferentQualities(videoInfo, outputDir) {
  const results = [];

  // Define quality options to try
  const qualityOptions = [
    'highestvideo+highestaudio',
    'highest',
    'highest',
    '720p',
    '480p',
    '360p',
  ];

  log(
    `\n${colors.bold}=== TESTING DIFFERENT QUALITY OPTIONS ===${colors.reset}`,
    'info'
  );

  for (const quality of qualityOptions) {
    try {
      const videoFileName = `${
        videoInfo.videoDetails.videoId
      }_${quality.replace('+', '_')}.mp4`;
      const outputPath = path.join(outputDir, videoFileName);

      log(`\nTrying quality: ${quality}`, 'info');
      const downloadResult = await downloadVideo(
        videoInfo,
        quality,
        outputPath
      );
      const analysisResult = await analyzeVideo(outputPath);

      results.push({
        quality,
        valid: analysisResult.valid,
        issues: analysisResult.issues,
        outputPath,
      });

      if (analysisResult.valid) {
        log(`Found valid quality option: ${quality}`, 'success');
        break;
      }
    } catch (error) {
      log(`Failed with quality ${quality}: ${error.message}`, 'error');
      results.push({
        quality,
        valid: false,
        issues: [error.message],
        outputPath: null,
      });
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    log(`YouTube Download Analyzer`, 'info');
    log(`URL: ${youtubeUrl}`, 'info');
    log(`Requested Quality: ${quality}`, 'info');
    log(`Output Directory: ${outputDir}`, 'info');

    // Get video info
    const videoInfo = await getVideoInfo(youtubeUrl);
    log(`Video Title: ${videoInfo.videoDetails.title}`, 'info');
    log(`Video ID: ${videoInfo.videoDetails.videoId}`, 'info');
    log(`Duration: ${videoInfo.videoDetails.lengthSeconds}s`, 'info');

    // Download the video
    const videoFileName = `${videoInfo.videoDetails.videoId}.mp4`;
    const outputPath = path.join(outputDir, videoFileName);

    log(`\n${colors.bold}=== DOWNLOADING VIDEO ===${colors.reset}`, 'info');
    const downloadResult = await downloadVideo(videoInfo, quality, outputPath);

    // Analyze the video
    log(`\n${colors.bold}=== ANALYZING DOWNLOAD ===${colors.reset}`, 'info');
    const analysisResult = await analyzeVideo(outputPath);

    // If there are issues, try different quality options
    if (!analysisResult.valid) {
      log(
        `\nThe downloaded video has issues. Trying different quality options...`,
        'warning'
      );
      const qualityResults = await tryDifferentQualities(videoInfo, outputDir);

      const validOption = qualityResults.find((r) => r.valid);

      if (validOption) {
        log(`\n${colors.bold}=== RECOMMENDATION ===${colors.reset}`, 'info');
        log(
          `Use quality option "${validOption.quality}" for this video to avoid issues.`,
          'success'
        );
        log(`Valid video file: ${validOption.outputPath}`, 'success');
      } else {
        log(`\n${colors.bold}=== RECOMMENDATION ===${colors.reset}`, 'info');
        log(
          `All quality options had issues. Try these alternatives:`,
          'warning'
        );
        log(`1. Use a different YouTube downloader`, 'info');
        log(`2. Download the video in WebM format instead of MP4`, 'info');
        log(`3. Use the YouTube API or a different streaming service`, 'info');
      }
    } else {
      log(`\n${colors.bold}=== RECOMMENDATION ===${colors.reset}`, 'info');
      log(
        `The downloaded video is valid and should work well for segmentation.`,
        'success'
      );
      log(`Video file: ${outputPath}`, 'success');
    }

    log(`\nAnalysis complete. All files saved to: ${outputDir}`, 'info');
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();
