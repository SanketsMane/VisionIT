/**
 * Everything the public website says about the business, in one place.
 *
 * The footer, contact page and structured data all read from here, so changing
 * a phone number is one edit rather than a search across a dozen components.
 *
 * Fields left as `null` are not rendered at all — an empty address line is
 * worse than no address line, and nothing here is invented to fill a gap.
 */
export const SITE = {
  name: 'Vision IT Infra',
  legalName: 'Vision IT Infra',
  tagline: 'Software, infrastructure and AI, built to last.',
  description:
    'We design, build and run web platforms, mobile apps, trading systems and AI products — and we keep them running afterwards.',
  url: 'https://visionitinfra.com',

  contact: {
    /** Shown in the footer and on the contact page. */
    email: 'contact@visionitinfra.com',
    /** The address mail is sent from. Never shown as a reply-to. */
    noreply: 'noreply@visionitinfra.com',
    phone: null as string | null,
    whatsapp: null as string | null,
  },

  address: {
    line1: null as string | null,
    line2: null as string | null,
    city: null as string | null,
    state: null as string | null,
    postalCode: null as string | null,
    country: 'India',
  },

  /** Company registration details, shown in the footer's fine print. */
  registration: {
    gstin: null as string | null,
    cin: null as string | null,
  },

  social: {
    linkedin: null as string | null,
    twitter: null as string | null,
    instagram: null as string | null,
    github: null as string | null,
    facebook: null as string | null,
  },

  /** Local business hours, shown on the contact page. */
  hours: 'Monday to Saturday, 10am – 7pm IST',

  /** How quickly an enquiry gets answered. Stated because people ask. */
  responseTime: 'Within one working day',
} as const;

/** The address as renderable lines, with the gaps dropped. */
export const addressLines = (): string[] =>
  [
    SITE.address.line1,
    SITE.address.line2,
    [SITE.address.city, SITE.address.state, SITE.address.postalCode].filter(Boolean).join(', ') ||
      null,
    SITE.address.country,
  ].filter((line): line is string => Boolean(line));

/** Social links that actually have a URL. */
export const socialLinks = (): { key: string; url: string }[] =>
  Object.entries(SITE.social)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, url]) => ({ key, url }));

export const hasAddress = (): boolean => addressLines().length > 1;
