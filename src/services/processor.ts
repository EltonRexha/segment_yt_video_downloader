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
 * Output format options for video segmentation
 */
export type OutputFormat = 'mp4' | 'mkv' | 'webm' | 'ts';

/**
 * Options for video segmentation
 */
export interface SegmentOptions {
  format?: OutputFormat;
  quality?: 'high' | 'medium' | 'low';
  forceEncode?: boolean;
  audioOnly?: boolean;
}

/**
 * Segment a video into multiple parts based on provided timestamps
 * @param inputPath Path to the input video file
 * @param outputDir Output directory for segments
 * @param segments Array of segments to extract
 * @param options Segmentation options
 * @returns Array of paths to the segmented videos
 */
export async function segmentVideo(
  inputPath: string,
  outputDir: string,
  segments: Segment[],
  options: SegmentOptions = {}
): Promise<string[]> {
  try {
    logger.info(`Starting video segmentation for: ${inputPath}`);

    // Set default options
    const format = options.format || 'mp4';
    const quality = options.quality || 'medium';
    const forceEncode = options.forceEncode || false;
    const audioOnly = options.audioOnly || false;

    // Format-specific settings
    const formatExtension = format === 'ts' ? '.ts' : `.${format}`;

    // Configure encoding options based on format and quality
    const getOutputOptions = (
      selectedFormat: OutputFormat,
      selectedQuality: string,
      useStreamCopy: boolean
    ) => {
      if (useStreamCopy) {
        switch (selectedFormat) {
          case 'mp4':
            return ['-c copy', '-movflags faststart', '-avoid_negative_ts 1'];
          case 'mkv':
            return ['-c copy'];
          case 'webm':
            // WebM doesn't support stream copy well for all sources, defaulting to encoding
            return [
              '-c:v libvpx-vp9',
              '-c:a libopus',
              '-b:v 1M',
              '-cpu-used 2',
            ];
          case 'ts':
            return ['-c copy', '-mpegts_flags +resend_headers'];
          default:
            return ['-c copy'];
        }
      }

      // If we're encoding (not stream copying)
      if (audioOnly) {
        switch (selectedFormat) {
          case 'mp4':
            return ['-vn', '-c:a aac', '-b:a 128k'];
          case 'mkv':
            return ['-vn', '-c:a libopus', '-b:a 128k'];
          case 'webm':
            return ['-vn', '-c:a libopus', '-b:a 128k'];
          case 'ts':
            return ['-vn', '-c:a aac', '-b:a 128k'];
          default:
            return ['-vn', '-c:a aac', '-b:a 128k'];
        }
      }

      // Video encoding options
      const qualitySettings = {
        high: {
          mp4: [
            '-c:v libx264',
            '-crf 18',
            '-preset medium',
            '-c:a aac',
            '-b:a 192k',
            '-movflags faststart',
          ],
          mkv: [
            '-c:v libx264',
            '-crf 18',
            '-preset medium',
            '-c:a libopus',
            '-b:a 192k',
          ],
          webm: [
            '-c:v libvpx-vp9',
            '-crf 20',
            '-b:v 2M',
            '-c:a libopus',
            '-b:a 128k',
          ],
          ts: [
            '-c:v libx264',
            '-crf 18',
            '-preset medium',
            '-c:a aac',
            '-b:a 192k',
          ],
        },
        medium: {
          mp4: [
            '-c:v libx264',
            '-crf 22',
            '-preset fast',
            '-c:a aac',
            '-b:a 128k',
            '-movflags faststart',
          ],
          mkv: [
            '-c:v libx264',
            '-crf 22',
            '-preset fast',
            '-c:a libopus',
            '-b:a 128k',
          ],
          webm: [
            '-c:v libvpx-vp9',
            '-crf 30',
            '-b:v 1M',
            '-c:a libopus',
            '-b:a 96k',
            '-cpu-used 2',
          ],
          ts: [
            '-c:v libx264',
            '-crf 22',
            '-preset fast',
            '-c:a aac',
            '-b:a 128k',
          ],
        },
        low: {
          mp4: [
            '-c:v libx264',
            '-crf 28',
            '-preset ultrafast',
            '-c:a aac',
            '-b:a 96k',
            '-movflags faststart',
          ],
          mkv: [
            '-c:v libx264',
            '-crf 28',
            '-preset ultrafast',
            '-c:a libopus',
            '-b:a 96k',
          ],
          webm: [
            '-c:v libvpx-vp9',
            '-crf 35',
            '-b:v 500k',
            '-c:a libopus',
            '-b:a 64k',
            '-cpu-used 4',
          ],
          ts: [
            '-c:v libx264',
            '-crf 28',
            '-preset ultrafast',
            '-c:a aac',
            '-b:a 96k',
          ],
        },
      };

      return qualitySettings[selectedQuality as keyof typeof qualitySettings][
        selectedFormat
      ];
    };

    // In dev mode, dump the segments for inspection
    if (config.devMode) {
      debugDump(segments, 'Segments to Process');
      console.log('Segmentation options:', {
        format,
        quality,
        forceEncode,
        audioOnly,
      });
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
      const outputPath = path.join(
        outputDir,
        `${sanitizedName}${formatExtension}`
      );

      // Check if file already exists
      if (await fs.pathExists(outputPath)) {
        logger.info(`Segment already exists: ${outputPath}`);
        outputPaths.push(outputPath);
        continue;
      }

      // Use safe access for logging
      const segmentName = isDefined(name) ? name : `segment_${index + 1}`;

      logger.info(
        `Processing segment ${index + 1}/${
          segments.length
        }: ${segmentName} (format: ${format})`
      );

      // If forceEncode is true, we'll always use encoding
      if (forceEncode) {
        logger.info(`Using encoding for segment: ${segmentName}`);

        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .setStartTime(start)
            .duration(calculateDuration(start, end))
            .output(outputPath)
            .outputOptions(getOutputOptions(format, quality, false))
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
              logger.error(`Error encoding segment: ${err.message}`);
              reject(new Error(`Error encoding segment: ${err.message}`));
            })
            .run();
        });

        continue;
      }

      // Try with stream copy first (faster)
      try {
        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .setStartTime(start)
            .duration(calculateDuration(start, end))
            .output(outputPath)
            .outputOptions(getOutputOptions(format, quality, true))
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
              logger.warn(
                `Stream copy failed, trying with encoding: ${err.message}`
              );
              reject(err);
            })
            .run();
        });
      } catch (err) {
        // If stream copy fails, fall back to encoding
        logger.info(`Falling back to encoding for segment: ${segmentName}`);

        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .setStartTime(start)
            .duration(calculateDuration(start, end))
            .output(outputPath)
            .outputOptions(getOutputOptions(format, quality, false))
            .on('progress', (progress) => {
              if (progress.percent) {
                logger.debug(
                  `Encode progress: ${Math.round(progress.percent)}%`
                );
              }
            })
            .on('end', () => {
              logger.info(`Segment completed (with encoding): ${segmentName}`);
              outputPaths.push(outputPath);
              resolve();
            })
            .on('error', (err: Error) => {
              logger.error(`Error encoding segment: ${err.message}`);
              reject(new Error(`Error encoding segment: ${err.message}`));
            })
            .run();
        });
      }
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
