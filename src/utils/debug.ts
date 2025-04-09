/**
 * Debug utilities for advanced error diagnostics
 */

import { inspect } from 'util';
import logger from '../services/logger';
import config from '../config';

/**
 * Track all string operations to detect potential undefined access
 * @param value The value being operated on
 * @param operation The operation being performed (e.g., 'replace')
 * @param location Information about where the operation is happening
 * @returns The original value
 */
export function trackStringOperation<T>(
  value: T,
  operation: string,
  location: string
): T {
  if (config.devMode && value === undefined) {
    const error = new Error(
      `DEBUG: Attempted to use '${operation}' on undefined value at ${location}`
    );

    console.error('===============================================');
    console.error(`🚨 POTENTIAL NULL SAFETY ISSUE DETECTED 🚨`);
    console.error(`Operation: ${operation}`);
    console.error(`Location: ${location}`);
    console.error(`Stack trace:`);
    console.error(error.stack);
    console.error('===============================================');

    logger.error(`DEBUG: Null safety issue at ${location}`, {
      operation,
      stack: error.stack,
      location,
    });
  }
  return value;
}

/**
 * Dump detailed information about an object to help debug issues
 * @param value The value to inspect
 * @param label Optional label to identify the output
 */
export function debugDump(value: any, label = 'Debug Object'): void {
  if (!config.devMode) return;

  console.log('\n==== DEBUG DUMP ====');
  console.log(`🔍 ${label}:`);
  console.log('Type:', typeof value);
  console.log('Is undefined:', value === undefined);
  console.log('Is null:', value === null);

  if (value !== undefined && value !== null) {
    if (typeof value === 'object') {
      console.log(
        'Keys:',
        Object.keys(value).length ? Object.keys(value) : '(empty object)'
      );
      console.log('Structure:');
      console.log(inspect(value, { depth: 5, colors: true }));
    } else {
      console.log('Value:', value);
    }
  }

  console.log('====================\n');
}

/**
 * Create a proxy that monitors all property access
 * @param obj The object to monitor
 * @param name The name of the object (for logging)
 * @returns A proxy that tracks all property access
 */
export function createAccessTracker<T extends object>(obj: T, name: string): T {
  if (!config.devMode || obj === undefined || obj === null) return obj;

  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (value === undefined) {
        const error = new Error();
        console.warn(
          `⚠️ Accessed undefined property '${String(prop)}' on ${name}`
        );
        console.warn('Access Stack:', error.stack);
      }
      return value;
    },
  });
}
