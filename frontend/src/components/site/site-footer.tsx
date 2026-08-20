import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { SITE, addressLines, hasAddress, socialLinks } from '@/lib/site.config';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'What we build',
    links: [
      { href: '/services#build', label: 'Web development' },
      { href: '/services#build', label: 'Android & iOS apps' },
      { href: '/services#build', label: 'AI software' },
      { href: '/services#trading', label: 'Trading systems' },
      { href: '/services#ai', label: 'Vision AI' },
    ],
  },
  {
    heading: 'What we run',
    links: [
      { href: '/services#hosting', label: 'VPS hosting' },
      { href: '/services#hosting', label: 'Windows hosting' },
      { href: '/services#messaging', label: 'Bulk SMS' },
      { href: '/services#growth', label: 'SEO & marketing' },
      { href: '/services#growth', label: 'Lead generation' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/work', label: 'Our work' },
      { href: '/about', label: 'About us' },
      { href: '/contact', label: 'Contact' },
      { href: '/register', label: 'Create an account' },
      { href: '/login', label: 'Client sign-in' },
    ],
  },
];

const SOCIAL_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  twitter: 'X',
  instagram: 'Instagram',
  github: 'GitHub',
  facebook: 'Facebook',
};

export function SiteFooter() {
  const socials = socialLinks();
  const address = addressLines();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* ── Identity and contact ─────────────────────────────────────── */}
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.png" alt="" className="size-8 rounded-lg" />
              <span className="text-[15px] font-semibold tracking-tight">{SITE.name}</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {SITE.description}
            </p>

            <div className="mt-5 space-y-2.5 text-sm">
              <a
                href={`mailto:${SITE.contact.email}`}
                className="flex items-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="size-4 shrink-0" />
                {SITE.contact.email}
              </a>

              {/* Each contact line renders only when it exists. A footer with a
                  blank phone row looks unfinished; one without a phone row does
                  not. */}
              {SITE.contact.phone && (
                <a
                  href={`tel:${SITE.contact.phone.replace(/\s+/g, '')}`}
                  className="flex items-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="size-4 shrink-0" />
                  {SITE.contact.phone}
                </a>
              )}

              {hasAddress() && (
                <p className="flex items-start gap-2.5 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {address.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </p>
              )}
            </div>

            {socials.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {socials.map(({ key, url }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* ── Link columns ─────────────────────────────────────────────── */}
          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {column.heading}
              </p>
              <ul className="mt-3.5 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} {SITE.legalName}. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {SITE.registration.gstin && <span>GSTIN {SITE.registration.gstin}</span>}
            {SITE.registration.cin && <span>CIN {SITE.registration.cin}</span>}
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
