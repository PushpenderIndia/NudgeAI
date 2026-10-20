import { PageHeader } from "@/components/PagePlaceholder";
import { ApprovalQueue } from "@/components/approvals/ApprovalQueue";

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Everything Nudge has prepared, waiting for your OK. Nothing leaves without you."
      />
      <ApprovalQueue />
    </div>
  );
}
