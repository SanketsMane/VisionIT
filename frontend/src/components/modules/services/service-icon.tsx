'use client';

import {
  Boxes, Globe, Landmark, Megaphone, MonitorCog, Server, Share2,
  Smartphone, Sparkles, Target, TrendingUp, type LucideIcon,
} from 'lucide-react';

/**
 * Maps the icon name stored on a service to a component.
 *
 * An explicit map rather than a dynamic lookup: the icon name comes from the
 * database, and resolving it dynamically would either pull the entire icon set
 * into the bundle or let a typo render nothing at all. Anything unrecognised
 * falls back rather than disappearing.
 */
const ICONS: Record<string, LucideIcon> = {
  Globe,
  Smartphone,
  // lucide has no Apple glyph; a phone reads correctly enough next to "iOS".
  Apple: Smartphone,
  Sparkles,
  Landmark,
  Server,
  MonitorCog,
  Share2,
  Megaphone,
  TrendingUp,
  Target,
};

export function ServiceIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Boxes;
  return <Icon className={className} />;
}
