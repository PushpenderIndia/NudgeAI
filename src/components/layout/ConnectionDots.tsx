import { TOOLS, type ToolKey } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Status = "connected" | "demo" | "off";

const DOT: Record<Status, string> = {
  connected: "bg-success",
  demo: "bg-nudge",
  off: "bg-muted/40",
};

const LABEL: Record<Status, string> = {
  connected: "Live",
  demo: "Demo data",
  off: "Not connected",
};

export function ConnectionDots({
  statuses,
  compact = false,
}: {
  statuses?: Partial<Record<ToolKey, Status>>;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", compact && "flex-row gap-2")}>
      {TOOLS.map((tool) => {
        const status: Status = statuses?.[tool.key] ?? "demo";
        return (
          <div key={tool.key} className="flex items-center gap-2 text-xs text-muted" title={`${tool.label}: ${LABEL[status]}`}>
            <span className={cn("h-2 w-2 rounded-full", DOT[status])} />
            {!compact && (
              <>
                <span className="text-fg/80">{tool.label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted">{LABEL[status]}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
