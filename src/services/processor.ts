import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs-extra';
import { Segment } from '../types';
import logger from './logger';
import { sanitizeFileName, safeReplace } from '../utils/string';
import { isDefined, safeGet } from '../utils/guards';
import config from '../config';
import { debugDump } from '../utils/debug';

// Configure ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic as string);

/**
 * Segment a video into multiple parts based on provided timestamps
 * @param inputPath Path to the input video file
 * @param outputDir Output directory for segments
 * @param segments Array of segments to extract
 * @returns Array of paths to the segmented videos
 */
export async function segmentVideo(
  inputPath: string,
  outputDir: string,
  segments: Segment[]
): Promise<string[]> {
  try {
    logger.info(`Starting video segmentation for: ${inputPath}`);

    // In dev mode, dump the segments for inspection
    if (config.devMode) {
      debugDump(segments, 'Segments to Process');
    }

    const outputPaths: string[] = [];

    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    // Process each segment
    for (const [index, segment] of segments.entries()) {
      // In dev mode, dump each segment for debugging
      if (config.devMode) {
        debugDump(segment, `Segment ${index + 1}`);
      }

      // Use safe property access with defaults
      const name = safeGet(segment, 'name', `segment_${index + 1}`);
      const start = safeGet(segment, 'start', '00:00:00');
      const end = safeGet(segment, 'end', '23:59:59');

      // In dev mode, dump the extracted values
      if (config.devMode) {
        console.log(`Segment ${index + 1} values:`);
        console.log(`- name: ${name}`);
        console.log(`- start: ${start}`);
        console.log(`- end: ${end}`);
      }

      // Use the utility to safely handle potentially undefined names
      const sanitizedName = sanitizeFileName(name, `segment_${index + 1}`);

      const outputPath = path.join(outputDir, `${sanitizedName}.mp4`);

      // Check if file already exists
      if (await fs.pathExists(outputPath)) {
        logger.info(`Segment already exists: ${outputPath}`);
        outputPaths.push(outputPath);
        continue;
      }

      // Use safe access for logging
      const segmentName = isDefined(name) ? name : `segment_${index + 1}`;

      logger.info(
        `Processing segment ${index + 1}/${segments.length}: ${segmentName}`
      );

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(start)
          .duration(calculateDuration(start, end))
          .output(outputPath)
          .outputOptions('-c copy') // Copy streams without re-encoding for speed
          .on('start', (commandLine) => {
            logger.debug(`FFmpeg command: ${commandLine}`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              logger.debug(
                `Segment progress: ${Math.round(progress.percent)}%`
              );
            }
          })
          .on('end', () => {
            logger.info(`Segment completed: ${segmentName}`);
            outputPaths.push(outputPath);
            resolve();
          })
          .on('error', (err) => {
            logger.error(`Error segmenting video: ${err.message}`);
            reject(new Error(`Error segmenting video: ${err.message}`));
          })
          .run();
      });
    }

    logger.info(
      `All segments processed successfully. Total: ${outputPaths.length}`
    );
    return outputPaths;
  } catch (error: unknown) {
    // In development mode, rethrow the error for better debugging
    if (config.devMode) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to segment video: ${errorMessage}`, { error });
    throw error;
  }
}

/**
 * Calculate duration between two timestamps
 * @param start Start timestamp (HH:MM:SS)
 * @param end End timestamp (HH:MM:SS)
 * @returns Duration in seconds
 */
function calculateDuration(start: string, end: string): number {
  const startSeconds = timestampToSeconds(start);
  const endSeconds = timestampToSeconds(end);
  return endSeconds - startSeconds;
}

/**
 * Convert a timestamp string to seconds
 * @param timestamp Timestamp in HH:MM:SS format
 * @returns Number of seconds
 */
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);

  if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else {
    // SS format
    return parts[0];
  }
}

/**
 * Get metadata from a video file
 * @param filePath Path to the video file
 * @returns Promise with video metadata
 */
export function getVideoMetadata(
  filePath: string
): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        // In development mode, expose the original error
        if (config.devMode) {
          reject(err);
          return;
        }
        reject(new Error(`Error getting video metadata: ${err.message}`));
        return;
      }
      resolve(metadata);
    });
  });
}
