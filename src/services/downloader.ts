import ytdl from 'ytdl-core';
import fs from 'fs-extra';
import path from 'path';
import logger from './logger';
import { Segment } from '../types';
import { sanitizeFileName, safeReplace } from '../utils/string';
import { isDefined, safeGetNested } from '../utils/guards';
import config from '../config';
import { debugDump, createAccessTracker } from '../utils/debug';

/**
 * Download a YouTube video
 * @param url YouTube video URL
 * @param outputPath Output directory
 * @returns Path to the downloaded video
 */
export async function downloadVideo(
  url: string,
  outputPath: string
): Promise<string> {
  try {
    logger.info(`Starting download for: ${url}`);

    if (!ytdl.validateURL(url)) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }

    // Ensure output directory exists
    await fs.ensureDir(outputPath);

    // Get video info
    const info = await ytdl.getInfo(url);

    // In dev mode, dump the structure of the response for debugging
    if (config.devMode) {
      debugDump(info, 'YouTube API Response');

      // Specifically check the videoDetails and title
      const videoDetails = info.videoDetails;
      debugDump(videoDetails, 'Video Details Object');

      if (videoDetails) {
        debugDump(videoDetails.title, 'Video Title');
      }
    }

    // Use the sanitize utility for safe handling of potentially undefined title
    const sanitizedTitle = sanitizeFileName(
      safeGetNested(info, ['videoDetails', 'title'], `video_${Date.now()}`),
      `video_${Date.now()}`
    );

    const fileName = `${sanitizedTitle}.mp4`;
    const filePath = path.join(outputPath, fileName);

    // Check if file already exists
    if (await fs.pathExists(filePath)) {
      logger.info(`Video already downloaded: ${filePath}`);
      return filePath;
    }

    logger.info(`Downloading video: ${sanitizedTitle}`);

    return new Promise((resolve, reject) => {
      // Get best quality video with audio
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highest',
        filter: 'audioandvideo',
      });

      // If no format with both audio and video is available, choose highest video quality
      const videoStream = format
        ? ytdl.downloadFromInfo(info, { format })
        : ytdl(url, { quality: 'highest' });

      const fileStream = fs.createWriteStream(filePath);

      let lastPercentage = 0;

      videoStream.pipe(fileStream);

      videoStream.on(
        'progress',
        (chunkLength: number, downloaded: number, total: number) => {
          const percentage = Math.floor((downloaded / total) * 100);
          // Only log when percentage changes by at least 5%
          if (percentage >= lastPercentage + 5) {
            logger.info(`Download progress: ${percentage}%`);
            lastPercentage = percentage;
          }
        }
      );

      fileStream.on('finish', () => {
        logger.info(`Download completed: ${fileName}`);
        resolve(filePath);
      });

      fileStream.on('error', (err: Error) => {
        logger.error(`Error writing video file: ${err.message}`);
        reject(err);
      });

      videoStream.on('error', (err: Error) => {
        logger.error(`Error downloading video: ${err.message}`);
        reject(err);
      });
    });
  } catch (error: unknown) {
    // In development mode, rethrow the error for better debugging
    if (config.devMode) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to download video: ${errorMessage}`, { error });
    throw error;
  }
}

/**
 * Detect chapters in a YouTube video
 * @param url YouTube video URL
 * @returns Array of detected segments
 */
export async function detectVideoChapters(url: string): Promise<Segment[]> {
  try {
    logger.info(`Detecting chapters for video: ${url}`);

    if (!ytdl.validateURL(url)) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }

    const info = await ytdl.getInfo(url);

    // In dev mode, debug the chapters structure
    if (config.devMode) {
      const videoDetails = info.videoDetails || {};
      debugDump(videoDetails.chapters, 'Video Chapters');
    }

    const chapters = safeGetNested(info, ['videoDetails', 'chapters'], []);

    if (chapters.length === 0) {
      logger.info('No chapters detected in the video');
      return [];
    }

    logger.info(`Detected ${chapters.length} chapters in the video`);

    // Use type assertion for the entire chapters array since the interface may not be complete
    return chapters.map((chapter: any, index: number) => {
      // Get the chapter data with type assertion to avoid TypeScript errors
      const chapterData = chapter as any;

      let endTime = 0;

      // Check if this chapter has an end time
      if (isDefined(chapterData.end_time)) {
        endTime = chapterData.end_time;
      } else if (index < chapters.length - 1) {
        // If not the last chapter, use the next chapter's start time
        const nextChapter = chapters[index + 1] as any;
        endTime = safeGetNested(nextChapter, ['start_time'], 0);
      } else {
        // If it's the last chapter, use the video duration
        // Convert lengthSeconds to a number to fix type error
        endTime = parseInt(
          safeGetNested(info, ['videoDetails', 'lengthSeconds'], '0'),
          10
        );
      }

      // Use a default name if chapter title is undefined
      const chapterTitle = safeGetNested(
        chapterData,
        ['title'],
        `Chapter ${index + 1}`
      );

      return {
        name: chapterTitle,
        start: formatSeconds(chapterData.start_time || 0),
        end: formatSeconds(endTime),
      };
    });
  } catch (error: unknown) {
    // In development mode, rethrow the error for better debugging
    if (config.devMode) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to detect video chapters: ${errorMessage}`, {
      error,
    });
    throw error;
  }
}

/**
 * Format seconds as HH:MM:SS
 * @param seconds Number of seconds
 * @returns Formatted timestamp
 */
function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
