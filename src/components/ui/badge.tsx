import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border",
  {
    variants: {
      variant: {
        default: "bg-surface-2 border-border text-muted",
        primary: "bg-primary/15 border-primary/40 text-primary-soft",
        urgent: "bg-nudge/15 border-nudge/50 text-nudge",
        success: "bg-success/15 border-success/40 text-success",
        danger: "bg-danger/15 border-danger/40 text-danger",
        // source badges
        meeting: "bg-indigo/15 border-indigo/40 text-primary-soft",
        email: "bg-primary/15 border-primary/40 text-primary-soft",
        jira: "bg-[#2684ff]/15 border-[#2684ff]/40 text-[#8fb6ff]",
        github: "bg-surface-2 border-border text-fg",
        manual: "bg-surface-2 border-border text-muted",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
