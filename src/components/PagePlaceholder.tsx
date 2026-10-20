import { OwlMark } from "@/components/NudgeLogo";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

export function PagePlaceholder({ title, helper }: { title: string; helper: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle={helper} />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-20 text-center">
        <OwlMark size={56} animated />
        <p className="mt-4 max-w-sm text-sm text-muted">
          This is where <span className="text-fg">{title}</span> will live. Nudge is still
          getting this part ready — check back soon.
        </p>
      </div>
    </div>
  );
}
