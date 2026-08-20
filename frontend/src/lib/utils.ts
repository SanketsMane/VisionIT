import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges conditional class names and resolves conflicting Tailwind utilities. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

/** Debounce for search inputs — keeps the API from firing on every keystroke. */
export const debounce = <A extends unknown[]>(fn: (...args: A) => void, delay = 300) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** "Rohan Mehta" -> "RM". Used for avatar fallbacks. */
export const initials = (name?: string | null): string =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Deterministic colour per string, so the same client always looks the same. */
export const colorFromString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360} 65% 55%)`;
};

/**
 * Strips empty strings, null and undefined so they never reach the query
 * string as `?status=&search=`. Constrained to `object` rather than
 * `Record<string, unknown>` so plain interfaces (which have no index
 * signature) can be passed without a cast at every call site.
 */
export const cleanParams = <T extends object>(params: T): Partial<T> => {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    output[key] = value;
  }
  return output as Partial<T>;
};

/** Where a user belongs after signing in, based on which app they're part of. */
export const homeFor = (userType?: 'INTERNAL' | 'CLIENT' | null): string =>
  userType === 'CLIENT' ? '/portal' : '/dashboard';
