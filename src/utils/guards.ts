/**
 * Type guards and safe property access utilities
 */

/**
 * Safely gets a property from an object, with a fallback value if
 * the object or property is undefined
 *
 * @param obj The object to access
 * @param key The property key
 * @param defaultValue The default value to return if property is undefined
 * @returns The property value or default value
 */
export function safeGet<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K,
  defaultValue: T[K]
): T[K] {
  if (obj == null) {
    return defaultValue;
  }
  return obj[key] != null ? obj[key] : defaultValue;
}

/**
 * Type guard to check if a value is defined (not null or undefined)
 *
 * @param value Value to check
 * @returns True if the value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value != null;
}

/**
 * Safely access a nested property in an object with a fallback value
 *
 * @param obj Root object
 * @param path Path to property as array of keys
 * @param defaultValue Default value if property is undefined
 * @returns Property value or default value
 */
export function safeGetNested(
  obj: any,
  path: string[],
  defaultValue: any
): any {
  let current = obj;

  for (const key of path) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }

  return current ?? defaultValue;
}
