#!/usr/bin/env node

/**
 * Cache Clearing Utility
 *
 * This script cleans up all cached video files, generated segments,
 * and temporary debug outputs to ensure you're working with fresh data.
 *
 * Usage:
 *   node clear-cache.js [--all]
 *
 *   Options:
 *     --all: Also remove debug logs and analysis data
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const minimist = require('minimist');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['all', 'force', 'help'],
  alias: {
    a: 'all',
    f: 'force',
    h: 'help',
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

// Display help if requested
if (argv.help) {
  console.log(`
${colors.bold}Video Cache Clearing Utility${colors.reset}

This script removes all cached video files and temporary data to ensure 
clean processing of videos.

${colors.bold}Usage:${colors.reset}
  node clear-cache.js [options]

${colors.bold}Options:${colors.reset}
  --all, -a    Also remove debug logs and analysis data
  --force, -f  Skip confirmation prompt
  --help, -h   Show this help message
  `);
  process.exit(0);
}

/**
 * Log a message with timestamp and color
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
 * Prompt for confirmation
 */
function confirm(message) {
  if (argv.force) return true;

  process.stdout.write(`${colors.yellow}${message} (y/N): ${colors.reset}`);
  const response = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    response.question('', (answer) => {
      response.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Delete files in a directory matching a pattern
 */
function deleteFiles(directory, pattern, description) {
  try {
    if (!fs.existsSync(directory)) {
      log(`Directory does not exist: ${directory}`, 'warning');
      return 0;
    }

    const files = fs.readdirSync(directory);
    const matchingFiles = files.filter((file) => {
      if (typeof pattern === 'function') {
        return pattern(file);
      }
      return file.match(pattern);
    });

    let deleteCount = 0;

    for (const file of matchingFiles) {
      const filePath = path.join(directory, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          // Skip directories unless we match exactly
          continue;
        }

        fs.unlinkSync(filePath);
        deleteCount++;
      } catch (err) {
        log(`Failed to delete ${filePath}: ${err.message}`, 'error');
      }
    }

    if (deleteCount > 0) {
      log(
        `Deleted ${deleteCount} ${description} files from ${directory}`,
        'success'
      );
    } else {
      log(`No ${description} files found in ${directory}`, 'info');
    }

    return deleteCount;
  } catch (err) {
    log(
      `Error clearing ${description} in ${directory}: ${err.message}`,
      'error'
    );
    return 0;
  }
}

/**
 * Delete entire directory and its contents
 */
function deleteDirectory(directory, description) {
  try {
    if (!fs.existsSync(directory)) {
      log(`Directory does not exist: ${directory}`, 'warning');
      return 0;
    }

    // Recursively remove files and subdirectories
    const files = fs.readdirSync(directory);
    let deleteCount = 0;

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        deleteCount += deleteDirectory(filePath, `${description} subdirectory`);
      } else {
        fs.unlinkSync(filePath);
        deleteCount++;
      }
    }

    // Try to remove the directory (will succeed if empty)
    try {
      fs.rmdirSync(directory);
      log(`Removed directory: ${directory}`, 'success');
    } catch (err) {
      log(
        `Note: Could not remove directory ${directory} (it may not be empty)`,
        'warning'
      );
    }

    if (deleteCount > 0) {
      log(`Deleted ${deleteCount} files from ${description}`, 'success');
    }

    return deleteCount;
  } catch (err) {
    log(`Error deleting directory ${directory}: ${err.message}`, 'error');
    return 0;
  }
}

/**
 * Calculate the total size of files in a directory
 */
function calculateDirectorySize(directory, pattern) {
  try {
    if (!fs.existsSync(directory)) {
      return 0;
    }

    const files = fs.readdirSync(directory);
    const matchingFiles = pattern
      ? files.filter((file) => file.match(pattern))
      : files;

    let totalSize = 0;

    for (const file of matchingFiles) {
      const filePath = path.join(directory, file);
      try {
        const stats = fs.statSync(filePath);
        if (!stats.isDirectory()) {
          totalSize += stats.size;
        }
      } catch (err) {
        // Skip errors
      }
    }

    return totalSize;
  } catch (err) {
    return 0;
  }
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * Main function
 */
async function main() {
  log(`${colors.bold}Cache Clearing Utility${colors.reset}`, 'info');
  log(`This will clear all cached video files and temporary data.`, 'info');

  // Calculate total space that will be freed
  const rootDir = process.cwd();
  const tempDir = path.join(rootDir, 'temp');
  const outputDir = path.join(rootDir, 'output');
  const debugTempDir = path.join(os.tmpdir(), 'segment-tracer');
  const ytAnalyzerDir = path.join(os.tmpdir(), 'yt-analyzer');
  const totalSize =
    calculateDirectorySize(tempDir, /\.(mp4|mkv|webm|ts)$/) +
    calculateDirectorySize(outputDir) +
    calculateDirectorySize(debugTempDir) +
    calculateDirectorySize(ytAnalyzerDir);

  log(
    `This will free approximately ${formatSize(totalSize)} of space.`,
    'info'
  );

  // Get confirmation
  if (!argv.force) {
    const confirmed = await confirm('Continue with cache clearing?');
    if (!confirmed) {
      log('Cache clearing cancelled by user.', 'warning');
      process.exit(0);
    }
  }

  // Clear video cache directories
  log(`\n${colors.bold}=== CLEARING VIDEO CACHE ===${colors.reset}`, 'info');

  const videoCount = deleteFiles(tempDir, /\.(mp4|mkv|webm|ts)$/, 'video');
  const segmentCount = deleteFiles(
    outputDir,
    /\.(mp4|mkv|webm|ts)$/,
    'segment'
  );

  // Clear temporary directories if --all flag is provided
  if (argv.all) {
    log(
      `\n${colors.bold}=== CLEARING DEBUG OUTPUTS ===${colors.reset}`,
      'info'
    );

    const tracerCount = deleteDirectory(debugTempDir, 'segment tracer outputs');
    const analyzerCount = deleteDirectory(
      ytAnalyzerDir,
      'YouTube analyzer outputs'
    );

    // Clear NPM cache related to YouTube downloads if available
    try {
      log(`\n${colors.bold}=== CLEARING NPM CACHES ===${colors.reset}`, 'info');
      execSync('npm cache clean --force ytdl-core');
      log(`Cleaned npm cache for ytdl-core`, 'success');
    } catch (err) {
      log(`Note: Could not clear npm cache (${err.message})`, 'warning');
    }
  }

  // Summary
  log(`\n${colors.bold}=== CACHE CLEARING SUMMARY ===${colors.reset}`, 'info');
  log(`Cleared ${videoCount} video files from temp directory`, 'success');
  log(`Cleared ${segmentCount} segment files from output directory`, 'success');

  if (argv.all) {
    log(`Also cleared debug outputs and NPM caches`, 'success');
  } else {
    log(
      `Tip: Use --all flag to also clear debug outputs and NPM caches`,
      'info'
    );
  }

  log(
    `\nCache clearing complete. Your system is ready for fresh downloads.`,
    'success'
  );
}

// Run the main function
main().catch((err) => {
  log(`Fatal error: ${err.message}`, 'error');
  process.exit(1);
});
