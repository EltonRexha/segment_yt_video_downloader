import fs from 'fs-extra';
import path from 'path';
import { Command } from 'commander';
import { VideoConfig, Segment } from './types';
import logger from './services/logger';
import config from './config';
import { downloadVideo, detectVideoChapters } from './services/downloader';
import { segmentVideo } from './services/processor';
import {
  initProgressTracker,
  markVideoCompleted,
  markVideoFailed,
} from './utils/progress';
import { sanitizeFileName, safeReplace } from './utils/string';
import { isDefined, safeGet, safeGetNested } from './utils/guards';
import { debugDump } from './utils/debug';

// Setup command line options
const program = new Command();
program
  .version('1.0.0')
  .option(
    '-c, --concurrency <number>',
    'Number of videos to process in parallel',
    String(config.concurrency)
  )
  .option(
    '-o, --output <directory>',
    'Output directory for processed videos',
    config.outputDir
  )
  .option(
    '-t, --temp <directory>',
    'Temporary directory for downloaded videos',
    config.tempDir
  )
  .option('-f, --force', 'Force reprocessing of already completed videos')
  .option(
    '-d, --dev',
    'Run in development mode with enhanced debugging and full error traces'
  )
  .option('--verbose', 'Display additional debug information during processing')
  .parse(process.argv);

const options = program.opts();

// Debug the command line options to see what's being received
if (process.argv.includes('--dev')) {
  console.log('Command line arguments:');
  console.log(process.argv);
  console.log('Parsed options:');
  console.log(options);
}

// Update config with command line options
config.concurrency = parseInt(options.concurrency, 10);

// Explicitly check and set the output directory
if (options.output) {
  config.outputDir = options.output;
}

// Explicitly check and set the temp directory
if (options.temp) {
  config.tempDir = options.temp;
} else {
  // Make sure temp directory has a default value even if not provided
  config.tempDir = path.resolve(process.cwd(), 'temp');
}

config.devMode = options.dev || config.devMode;
const forceReprocess = options.force || false;
const verbose = options.verbose || false;

// Main function
async function main() {
  try {
    // In development mode, install enhanced debugging
    if (config.devMode) {
      logger.info('Running in development mode with enhanced debugging');
      console.log(
        '🐞 DEVELOPMENT MODE ACTIVE - Enhanced error reporting enabled'
      );

      if (verbose) {
        console.log(
          '📊 VERBOSE MODE ACTIVE - Additional diagnostic information will be displayed'
        );
        // Set global verbosity for debugging
        (global as any).VERBOSE_DEBUG = true;
      }
    }

    logger.info('Starting YouTube Video Processor');

    // Debug config values
    if (config.devMode) {
      console.log('Config values:');
      console.log(
        `- outputDir: ${
          typeof config.outputDir === 'undefined'
            ? 'undefined'
            : config.outputDir
        }`
      );
      console.log(
        `- tempDir: ${
          typeof config.tempDir === 'undefined' ? 'undefined' : config.tempDir
        }`
      );
      console.log(`- concurrency: ${config.concurrency}`);
    }

    // Ensure required directories exist
    try {
      if (typeof config.outputDir !== 'string' || !config.outputDir) {
        throw new Error('Output directory path is undefined or invalid');
      }
      console.log(`Creating output directory: ${config.outputDir}`);
      await fs.ensureDir(config.outputDir);
      logger.info(`Output directory ensured: ${config.outputDir}`);
    } catch (error) {
      console.error('Failed to create output directory:', error);
      throw error;
    }

    try {
      if (typeof config.tempDir !== 'string' || !config.tempDir) {
        throw new Error('Temp directory path is undefined or invalid');
      }
      console.log(`Creating temp directory: ${config.tempDir}`);
      await fs.ensureDir(config.tempDir);
      logger.info(`Temp directory ensured: ${config.tempDir}`);
    } catch (error) {
      console.error('Failed to create temp directory:', error);
      throw error;
    }

    // Initialize progress tracker
    const progress = await initProgressTracker();

    // Read video configurations
    const dataPath = path.resolve(process.cwd(), 'data', 'videos.json');

    if (!(await fs.pathExists(dataPath))) {
      throw new Error(`Data file not found: ${dataPath}`);
    }

    const videos: VideoConfig[] = await fs.readJSON(dataPath);
    logger.info(`Loaded ${videos.length} videos from data file`);

    // Process videos in batches based on concurrency
    const videoBatches = [];
    for (let i = 0; i < videos.length; i += config.concurrency) {
      videoBatches.push(videos.slice(i, i + config.concurrency));
    }

    for (const [batchIndex, batch] of videoBatches.entries()) {
      logger.info(`Processing batch ${batchIndex + 1}/${videoBatches.length}`);

      // Process videos in batch concurrently
      await Promise.all(
        batch.map((video) => processVideo(video, progress, forceReprocess))
      );
    }

    logger.info('All videos processed successfully');
  } catch (error: unknown) {
    // In development mode, rethrow the error for better debugging
    if (config.devMode) {
      throw error;
    }

    // Add detailed stack trace to error log
    if (error instanceof Error) {
      logger.error(`Application error: ${error.message}`, {
        error,
        stack: error.stack,
        location: 'main function',
      });
    } else {
      logger.error(`Application error: ${String(error)}`, {
        errorType: typeof error,
        location: 'main function',
      });
    }
    process.exit(1);
  }
}

/**
 * Process a single video
 * @param video Video configuration
 * @param progress Progress tracker
 * @param force Force reprocessing
 */
async function processVideo(
  video: VideoConfig,
  progress: { completed: string[]; failed: { id: string; error: string }[] },
  force = false
): Promise<void> {
  // Skip already completed videos unless force is true
  if (!force && progress.completed.includes(video.id)) {
    logger.info(`Skipping already processed video: ${video.id}`);
    return;
  }

  try {
    logger.info(`Processing video: ${video.id} (${video.url})`);

    // Declare variables at function scope to make them available throughout the function
    let videoOutputDir: string;
    let videoPath: string;

    try {
      // Create a subdirectory for this video
      videoOutputDir = path.join(config.outputDir, video.id);
      await fs.ensureDir(videoOutputDir);
      logger.debug(`Created output directory: ${videoOutputDir}`);
    } catch (err) {
      // In development mode, rethrow the error for better debugging
      if (config.devMode) {
        throw err;
      }
      throw new Error(
        `Error creating output directory: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    try {
      // Download the video
      videoPath = await downloadVideo(video.url, config.tempDir);
      logger.debug(`Downloaded video to: ${videoPath}`);
    } catch (err) {
      // In development mode, rethrow the error for better debugging
      if (config.devMode) {
        throw err;
      }
      throw new Error(
        `Error downloading video: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // Determine segments
    let segments: Segment[];

    try {
      if (video.segments === 'auto') {
        logger.info('Using auto-segmentation based on video chapters');
        segments = await detectVideoChapters(video.url);

        // If no chapters were detected, create a single segment for the entire video
        if (segments.length === 0) {
          logger.info(
            'No chapters detected, using entire video as a single segment'
          );
          segments = [
            { name: 'Full Video', start: '00:00:00', end: '23:59:59' },
          ];
        }
      } else {
        segments = video.segments;
      }
      logger.debug(`Determined ${segments.length} segments for processing`);
    } catch (err) {
      // In development mode, rethrow the error for better debugging
      if (config.devMode) {
        throw err;
      }
      throw new Error(
        `Error determining segments: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    logger.info(`Processing ${segments.length} segments`);

    let segmentPaths: string[];
    try {
      // Process segments
      segmentPaths = await segmentVideo(videoPath, videoOutputDir, segments);
      logger.debug(`Successfully processed ${segmentPaths.length} segments`);
    } catch (err) {
      // In development mode, rethrow the error for better debugging
      if (config.devMode) {
        throw err;
      }
      throw new Error(
        `Error processing segments: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    try {
      // Create a summary file
      const summary = {
        id: video.id,
        title: safeGet(video, 'title', `Video ${video.id}`), // Provide a fallback title using safeGet
        url: video.url,
        segments: segments.map((segment, index) => {
          // Make sure all segment properties are defined with fallbacks using safeGet
          const segmentName = safeGet(segment, 'name', `Segment ${index + 1}`);
          return {
            name: segmentName,
            start: safeGet(segment, 'start', '00:00:00'),
            end: safeGet(segment, 'end', '00:00:00'),
            file: segmentPaths[index] ? path.basename(segmentPaths[index]) : '',
          };
        }),
      };

      await fs.writeJSON(path.join(videoOutputDir, 'summary.json'), summary, {
        spaces: 2,
      });
      logger.debug(`Created summary file for video ${video.id}`);
    } catch (err) {
      // In development mode, rethrow the error for better debugging
      if (config.devMode) {
        throw err;
      }
      throw new Error(
        `Error creating summary file: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // Mark as completed
    await markVideoCompleted(progress, video.id);

    logger.info(`Video processing completed: ${video.id}`);
  } catch (error: unknown) {
    // In development mode, rethrow the error for better debugging
    if (config.devMode) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to process video ${video.id}: ${errorMessage}`, {
      error,
      stack: error instanceof Error ? error.stack : 'No stack trace available',
      videoDetails: {
        id: video.id,
        url: video.url,
        hasTitle: video.title ? true : false,
        segmentType: typeof video.segments === 'string' ? 'auto' : 'manual',
        segmentCount:
          typeof video.segments === 'string' ? 'auto' : video.segments.length,
      },
    });

    // Mark as failed
    await markVideoFailed(progress, video.id, errorMessage);
  }
}

// Start the application
main().catch((error: unknown) => {
  // In development mode, log the full error details to console
  if (config.devMode) {
    console.error('Unhandled error in development mode:');
    console.error(error);
    process.exit(1);
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Unhandled error: ${errorMessage}`, { error });
  process.exit(1);
});
