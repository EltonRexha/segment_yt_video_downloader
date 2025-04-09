import fs from 'fs-extra';
import path from 'path';
import { ProgressTracker } from '../types';
import logger from '../services/logger';

const PROGRESS_FILE = path.resolve(process.cwd(), 'progress.json');

/**
 * Initialize progress tracker
 * @returns Progress tracker object
 */
export async function initProgressTracker(): Promise<ProgressTracker> {
  try {
    // Check if progress file exists
    if (await fs.pathExists(PROGRESS_FILE)) {
      const data = await fs.readJSON(PROGRESS_FILE);
      logger.info(
        `Loaded existing progress: ${data.completed.length} completed, ${data.failed.length} failed`
      );
      return data as ProgressTracker;
    }

    // Create a new progress file
    const initialProgress: ProgressTracker = {
      completed: [],
      failed: [],
    };

    await fs.writeJSON(PROGRESS_FILE, initialProgress, { spaces: 2 });
    logger.info('Created new progress tracker');

    return initialProgress;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize progress tracker: ${errorMessage}`, {
      error,
    });

    // Return empty tracker on error
    return {
      completed: [],
      failed: [],
    };
  }
}

/**
 * Save progress to file
 * @param progress Progress tracker data
 */
export async function saveProgress(progress: ProgressTracker): Promise<void> {
  try {
    await fs.writeJSON(PROGRESS_FILE, progress, { spaces: 2 });
    logger.debug('Progress saved to file');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save progress: ${errorMessage}`, { error });
  }
}

/**
 * Mark a video as completed
 * @param progress Progress tracker
 * @param videoId ID of the completed video
 * @returns Updated progress tracker
 */
export async function markVideoCompleted(
  progress: ProgressTracker,
  videoId: string
): Promise<ProgressTracker> {
  // Skip if already completed
  if (progress.completed.includes(videoId)) {
    return progress;
  }

  // Add to completed list
  progress.completed.push(videoId);

  // Remove from failed list if it was there
  progress.failed = progress.failed.filter((item) => item.id !== videoId);

  // Save updated progress
  await saveProgress(progress);

  return progress;
}

/**
 * Mark a video as failed
 * @param progress Progress tracker
 * @param videoId ID of the failed video
 * @param error Error message
 * @returns Updated progress tracker
 */
export async function markVideoFailed(
  progress: ProgressTracker,
  videoId: string,
  error: string
): Promise<ProgressTracker> {
  // Remove from completed list if it was there
  progress.completed = progress.completed.filter((id) => id !== videoId);

  // Remove existing entry from failed list
  progress.failed = progress.failed.filter((item) => item.id !== videoId);

  // Add to failed list with error details
  progress.failed.push({ id: videoId, error });

  // Save updated progress
  await saveProgress(progress);

  return progress;
}
