/**
 * Represents a single segment of a video
 */
export interface Segment {
  name: string;
  start: string;
  end: string;
}

/**
 * Configuration for a video to be processed
 */
export interface VideoConfig {
  id: string;
  url: string;
  title?: string;
  segments: Segment[] | 'auto';
}

/**
 * Progress tracking for video processing
 */
export interface ProgressTracker {
  completed: string[];
  failed: { id: string; error: string }[];
}

/**
 * Application configuration
 */
export interface AppConfig {
  concurrency: number;
  outputDir: string;
  tempDir: string;
  logLevel: string;
  devMode: boolean;
}
