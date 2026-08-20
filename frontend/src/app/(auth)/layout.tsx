import type { ReactNode } from 'react';
import Image from 'next/image';

/**
 * Split layout: the form on the left stays usable at any width, while the
 * marketing panel on the right is dropped entirely below `lg` rather than
 * being squeezed into an unreadable column.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        {/* Wide enough for the sign-up form's paired fields; the login form
            stays visually centred because its own controls are full-width. */}
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5">
            <Image
              src="/logo-mark.png"
              alt="Vision IT Infra"
              width={72}
              height={72}
              priority
              className="size-9 object-contain"
            />
            <div>
              <p className="text-sm font-semibold leading-tight">Vision IT Infra</p>
              <p className="text-[11px] text-muted-foreground">Build · Deploy · Scale</p>
            </div>
          </div>
          {children}
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 55% at 20% 10%, rgba(99,102,241,0.35), transparent), radial-gradient(ellipse 70% 60% at 85% 85%, rgba(14,165,233,0.28), transparent)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Image
            src="/logo.png"
            alt="Vision IT Infra"
            width={640}
            height={290}
            priority
            className="h-16 w-auto object-contain object-left"
          />
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Every project, invoice and rupee — in one place.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Catalog the work you&apos;ve shipped, bill for it with invoices that look the part, let AI
              draft the awkward client emails, and watch the books balance themselves.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-6">
              {[
                ['Portfolio catalog', 'Web, Android, iOS and AI projects'],
                ['Invoicing', 'Five templates, GST-ready, PDF export'],
                ['AI email', 'Drafted from real invoice data'],
                ['Real accounting', 'Double-entry with live statements'],
              ].map(([title, copy]) => (
                <div key={title}>
                  <dt className="text-xs font-semibold text-white/90">{title}</dt>
                  <dd className="mt-0.5 text-[11px] leading-relaxed text-white/55">{copy}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="text-[11px] text-white/40">
            Next.js · Node.js · PostgreSQL · Prisma · OpenAI
          </p>
        </div>
      </div>
    </div>
  );
}
