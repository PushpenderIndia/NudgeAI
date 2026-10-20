import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { MobileNav } from "@/components/layout/MobileNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
      <ChatPanel />
    </div>
  );
}
