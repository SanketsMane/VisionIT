import * as si from 'simple-icons';

/**
 * A brand logo in its official colour.
 *
 * Paths and hex values come from `simple-icons` rather than being hand-drawn —
 * these are trademarks, and an approximated Swift bird or a wrong shade of
 * PostgreSQL blue looks worse than no logo at all.
 */
export interface Tech {
  /** simple-icons slug, e.g. `nextdotjs`. */
  slug: string;
  /** Overrides the icon's own title where ours is more accurate. */
  label?: string;
}

interface Resolved {
  title: string;
  path: string;
  hex: string;
  /** The colour to use on a dark ground. Equals `hex` unless it is too dark. */
  darkHex: string;
}

/** Perceived brightness, 0–255. The usual weighted-RGB approximation. */
const luminance = (hex: string): number => {
  const value = parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

export const resolveTech = (tech: Tech): Resolved | null => {
  const key = `si${tech.slug.charAt(0).toUpperCase()}${tech.slug.slice(1)}`;
  const icon = (si as unknown as Record<string, si.SimpleIcon | undefined>)[key];
  if (!icon) return null;

  return {
    title: tech.label ?? icon.title,
    path: icon.path,
    hex: `#${icon.hex}`,
    // Next.js, Vercel and Socket.io are all but black, which disappears against
    // the dark theme's near-black background. Those get a near-white instead of
    // their brand colour, which is the lesser evil against an invisible logo.
    darkHex: luminance(icon.hex) < 60 ? '#E8EDF5' : `#${icon.hex}`,
  };
};

export function TechLogo({ tech, className }: { tech: Tech; className?: string }) {
  const resolved = resolveTech(tech);
  if (!resolved) return null;

  return (
    <svg
      role="img"
      aria-label={resolved.title}
      viewBox="0 0 24 24"
      className={className}
      // The two colours ride on custom properties so a single Tailwind class
      // can switch between them at the `.dark` boundary.
      style={
        {
          '--brand': resolved.hex,
          '--brand-dark': resolved.darkHex,
        } as React.CSSProperties
      }
    >
      <path d={resolved.path} className="fill-[var(--brand)] dark:fill-[var(--brand-dark)]" />
    </svg>
  );
}
