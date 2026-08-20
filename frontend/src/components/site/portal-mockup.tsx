import { CheckCircle2, Clock3, FileText, FolderOpen, MessageSquare, PackageCheck } from 'lucide-react';

/**
 * A drawn representation of the client portal, for the hero.
 *
 * Deliberately not a screenshot: a real one carries a real client's project
 * name, invoice totals and balances, none of which belongs on a public page.
 * Deliberately not fabricated records either — no names, no currency, no dates.
 * What it shows is the *shape* of the interface: a project, its stages, and the
 * things a client can reach. That is the claim the headline makes, so it is the
 * claim the picture should support.
 *
 * Rendered in markup rather than as an image so it stays sharp at any density,
 * respects the theme, and never needs re-exporting when the palette changes.
 */
export function PortalMockup() {
  return (
    <div className="relative">
      {/* Glow anchoring the panel to the hero backdrop. */}
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-primary/20 via-info/10 to-transparent blur-2xl"
      />

      <div
        aria-hidden
        className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-15px_rgb(16_24_40/0.25)]"
      >
        {/* ── Browser chrome ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-3">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-danger/60" />
            <span className="size-2.5 rounded-full bg-warning/60" />
            <span className="size-2.5 rounded-full bg-success/60" />
          </span>
          <span className="ml-2 flex-1 truncate rounded-md bg-background px-3 py-1 text-[10px] text-muted-foreground">
            visionitinfra.com/portal
          </span>
        </div>

        <div className="flex">
          {/* ── Sidebar ──────────────────────────────────────────────── */}
          <div className="hidden w-36 shrink-0 border-r border-border p-3 sm:block">
            <div className="rounded-lg bg-primary-muted p-2.5">
              <div className="h-1.5 w-14 rounded-full bg-primary/60" />
              <div className="mt-1.5 h-1 w-9 rounded-full bg-primary/30" />
            </div>
            <div className="mt-3 space-y-1">
              {[
                { icon: FolderOpen, label: 'Overview', active: true },
                { icon: PackageCheck, label: 'Delivery' },
                { icon: FileText, label: 'Invoices' },
                { icon: MessageSquare, label: 'Messages' },
              ].map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                    row.active ? 'bg-accent' : ''
                  }`}
                >
                  <row.icon
                    className={`size-3 ${row.active ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span
                    className={`text-[10px] ${
                      row.active ? 'font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {row.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Panel ────────────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="h-2 w-28 rounded-full bg-foreground/80" />
                <div className="mt-2 h-1.5 w-20 rounded-full bg-muted-foreground/30" />
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-muted px-2 py-1 text-[9px] font-semibold text-success">
                <span className="size-1 rounded-full bg-success" />
                In progress
              </span>
            </div>

            {/* Progress. The proportion is a design choice, not a claim about
                any particular project. */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                <span>Milestones</span>
                <span>3 of 4</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-primary to-info" />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {[
                { label: 'Design', done: true },
                { label: 'Development', done: true },
                { label: 'Testing', done: true },
                { label: 'Handover', done: false },
              ].map((stage) => (
                <div
                  key={stage.label}
                  className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2"
                >
                  {stage.done ? (
                    <CheckCircle2 className="size-3 shrink-0 text-success" />
                  ) : (
                    <Clock3 className="size-3 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={`text-[10px] ${
                      stage.done ? 'text-muted-foreground line-through' : 'font-medium'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span className="ml-auto h-1 w-8 rounded-full bg-muted" />
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary-muted px-3 py-2.5">
              <Clock3 className="size-3.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-primary">Support active</p>
                <p className="text-[9px] text-primary/70">Countdown runs in your dashboard</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
