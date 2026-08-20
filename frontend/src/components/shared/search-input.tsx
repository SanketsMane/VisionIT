'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * Search box that reports upward on a debounce. Local state keeps typing
 * responsive while the parent only re-queries once the user pauses.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  delay = 350,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}) {
  const [local, setLocal] = useState(value);

  // Reflect external resets (e.g. "clear all filters") back into the input.
  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => onChange(local), delay);
    return () => clearTimeout(timer);
  }, [local, value, delay, onChange]);

  return (
    <Input
      value={local}
      onChange={(event) => setLocal(event.target.value)}
      placeholder={placeholder}
      className={className}
      leading={<Search />}
      trailing={
        local ? (
          <button
            type="button"
            onClick={() => {
              setLocal('');
              onChange('');
            }}
            className="transition-colors hover:text-foreground"
            aria-label="Clear search"
          >
            <X />
          </button>
        ) : undefined
      }
    />
  );
}
