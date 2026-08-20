'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, leading, trailing, ...props }, ref) => {
    const field = (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-9.5 w-full rounded-lg border bg-card px-3 text-sm text-foreground shadow-soft transition-colors',
          'placeholder:text-muted-foreground/70',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-danger focus-visible:ring-danger/30 focus-visible:border-danger' : 'border-input',
          leading && 'pl-9',
          trailing && 'pr-9',
          className,
        )}
        {...props}
      />
    );

    if (!leading && !trailing) return field;

    return (
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {leading}
          </span>
        )}
        {field}
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {trailing}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground shadow-soft transition-colors',
      'placeholder:text-muted-foreground/70 resize-y min-h-[80px]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
      'disabled:cursor-not-allowed disabled:opacity-60',
      error ? 'border-danger' : 'border-input',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
