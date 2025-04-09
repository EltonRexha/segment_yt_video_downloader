# YouTube Video Processor - Documentation

## Overview

The YouTube Video Processor is a Node.js application built with TypeScript that automates the process of downloading YouTube videos and segmenting them into smaller parts. This tool is particularly useful for content creators, educators, or anyone who needs to extract specific portions of videos for various purposes.

## Architecture

The application follows a modular architecture with clear separation of concerns:

1. **Core Services**: Specialized modules for video downloading, processing, and logging
2. **Utilities**: Helper functions for tracking progress and handling common tasks
3. **Types**: TypeScript interfaces that define the data structures used throughout the application
4. **Configuration**: Centralized settings management

```
/
├── data/               # Input data with video URLs and segmentation info
├── src/                # Source code
│   ├── index.ts        # Entry point
│   ├── config.ts       # Application configuration
│   ├── types/          # TypeScript type definitions
│   ├── services/       # Core services
│   │   ├── downloader.ts    # YouTube video downloading
│   │   ├── processor.ts     # Video segmentation with FFmpeg
│   │   └── logger.ts        # Logging service
│   └── utils/          # Utility functions
│       └── progress.ts      # Progress tracking
├── output/             # Directory for processed videos
└── logs/               # Application logs
```

## Core Features

1. **Video Download**: Download videos from YouTube with the highest available quality
2. **Video Segmentation**: Cut videos into segments based on specified timestamps
3. **Chapter Detection**: Automatically detect and segment videos based on YouTube chapters
4. **Concurrent Processing**: Process multiple videos in parallel
5. **Progress Tracking**: Track progress and resume from failures
6. **Comprehensive Logging**: Detailed logging for debugging and monitoring

## Key Components

| Component       | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `downloader.ts` | Handles downloading videos from YouTube using ytdl-core  |
| `processor.ts`  | Processes videos with FFmpeg to create segments          |
| `logger.ts`     | Provides consistent logging across the application       |
| `progress.ts`   | Tracks processing progress and enables recovery          |
| `config.ts`     | Centralizes application configuration                    |
| `index.ts`      | Orchestrates the workflow and provides the CLI interface |

## Workflow

1. The application reads a list of videos from `data/videos.json`
2. For each video, it:
   - Downloads the video if not already downloaded
   - Determines segments based on provided timestamps or auto-detection
   - Processes each segment using FFmpeg
   - Generates a summary file with metadata
3. Progress is tracked to allow for recovery in case of failures

## Design Decisions

1. **TypeScript**: Provides type safety and better developer experience
2. **Modular Architecture**: Enables easier maintenance and testing
3. **Stream Processing**: Uses Node.js streams for efficient memory usage
4. **Error Handling**: Comprehensive error handling with detailed logging
5. **Progress Tracking**: Persistent progress tracking enables recovery from failures
6. **Command-line Interface**: Flexible command-line options for customization

## Documentation Structure

- `docs/README.md`: This overview document
- `docs/services/`: Documentation for core services
- `docs/utils/`: Documentation for utility functions
- `docs/types/`: Documentation for TypeScript interfaces

## Getting Started

See the main [README.md](../README.md) for installation and usage instructions.
