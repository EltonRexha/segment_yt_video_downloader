#!/usr/bin/env node

/**
 * Debug script specifically for troubleshooting "Cannot read properties of undefined (reading 'replace')" errors
 *
 * Run with: node scripts/debug-replace.js [path/to/your/videos.json]
 */

const fs = require('fs');
const path = require('path');

// Check if videos.json path is provided
const videosPath =
  process.argv[2] || path.join(process.cwd(), 'data', 'videos.json');

console.log('🔍 Advanced Debug Tool for YouTube Video Processor');
console.log(
  'Looking for potential issues that could cause "Cannot read properties of undefined (reading \'replace\')" errors'
);
console.log('-'.repeat(80));

// Read the videos configuration file
try {
  console.log(`Checking videos configuration file: ${videosPath}`);

  if (!fs.existsSync(videosPath)) {
    console.error(`❌ Error: File does not exist: ${videosPath}`);
    process.exit(1);
  }

  const videosData = JSON.parse(fs.readFileSync(videosPath, 'utf8'));

  if (!Array.isArray(videosData)) {
    console.error(
      '❌ Error: videos.json should contain an array of video configurations'
    );
    process.exit(1);
  }

  console.log(`Found ${videosData.length} videos in configuration file`);

  // Debug check 1: Missing required properties
  const missingProperties = [];

  videosData.forEach((video, index) => {
    if (!video.id)
      missingProperties.push(
        `Video at index ${index} is missing 'id' property`
      );
    if (!video.url)
      missingProperties.push(
        `Video with id '${video.id || index}' is missing 'url' property`
      );

    // Check segments structure
    if (
      video.segments !== 'auto' &&
      (!Array.isArray(video.segments) || video.segments.length === 0)
    ) {
      missingProperties.push(
        `Video with id '${
          video.id || index
        }' has invalid 'segments' property (should be 'auto' or non-empty array)`
      );
    }

    // Check each segment for required properties
    if (Array.isArray(video.segments)) {
      video.segments.forEach((segment, segIndex) => {
        if (!segment.name)
          missingProperties.push(
            `Video with id '${
              video.id || index
            }' - segment at index ${segIndex} is missing 'name' property`
          );
        if (!segment.start)
          missingProperties.push(
            `Video with id '${
              video.id || index
            }' - segment at index ${segIndex} is missing 'start' property`
          );
        if (!segment.end)
          missingProperties.push(
            `Video with id '${
              video.id || index
            }' - segment at index ${segIndex} is missing 'end' property`
          );
      });
    }
  });

  if (missingProperties.length > 0) {
    console.log('\n⚠️ Found properties that might cause issues:');
    missingProperties.forEach((issue) => console.log(`- ${issue}`));
  } else {
    console.log('✅ All required properties are present in videos.json');
  }

  // Debug check 2: URL validation
  console.log('\nChecking YouTube URLs...');

  const invalidUrls = [];

  videosData.forEach((video) => {
    const url = video.url;
    const isValid =
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/.test(url);

    if (!isValid) {
      invalidUrls.push(
        `Video with id '${video.id}' has potentially invalid YouTube URL: ${url}`
      );
    }
  });

  if (invalidUrls.length > 0) {
    console.log('⚠️ Found potentially invalid URLs:');
    invalidUrls.forEach((issue) => console.log(`- ${issue}`));
  } else {
    console.log('✅ All URLs appear to be valid YouTube watch URLs');
  }

  // Debug check 3: Potential problematic strings
  console.log(
    '\nChecking for problematic strings that could cause issues with replace()...'
  );

  const problematicStrings = [];

  videosData.forEach((video) => {
    // Check title
    if (video.title === undefined || video.title === null) {
      problematicStrings.push(
        `Video with id '${video.id}' has undefined or null title (might cause replace() errors)`
      );
    }

    // Check segments
    if (Array.isArray(video.segments)) {
      video.segments.forEach((segment, index) => {
        if (segment.name === undefined || segment.name === null) {
          problematicStrings.push(
            `Video with id '${video.id}' - segment at index ${index} has undefined or null name (might cause replace() errors)`
          );
        }
      });
    }
  });

  if (problematicStrings.length > 0) {
    console.log('⚠️ Found problematic string values:');
    problematicStrings.forEach((issue) => console.log(`- ${issue}`));
  } else {
    console.log('✅ No problematic string values found');
  }

  console.log(
    '\nDebugging completed. Fix any issues identified above to prevent "Cannot read properties of undefined" errors.'
  );
  console.log(
    'After fixing the issues, run the application with the --dev flag for enhanced error reporting.'
  );
} catch (error) {
  console.error(`❌ Error analyzing videos.json: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
