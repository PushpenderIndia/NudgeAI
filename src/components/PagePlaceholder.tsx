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
      <div className="flex flex-col items-center justify-center border-y border-border px-6 py-16 text-center">
        <OwlMark size={48} />
        <p className="mt-3 max-w-sm text-sm text-muted">Nothing here yet. I&apos;ll keep this space tidy.</p>
      </div>
    </div>
  );
}
