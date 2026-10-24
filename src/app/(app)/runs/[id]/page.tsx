import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RunTrace } from "@/components/graph/RunTrace";
import { getRunDetail } from "@/lib/runs";
import { getRequestContext } from "@/nudge/session";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessionKey } = await getRequestContext();
  const run = await getRunDetail(id, sessionKey);
  if (!run) notFound();
  return (
    <div>
      <Link href="/runs" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" />All runs
      </Link>
      <RunTrace initial={run} />
    </div>
  );
}
