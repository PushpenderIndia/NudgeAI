"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Play } from "lucide-react";
import { NudgeLogo, OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_EMAIL, DEMO_PASSWORD, isDemoAuthenticated, signInDemo } from "@/lib/auth";
import { hasDemoMarker } from "@/lib/demo-cookies";
import { startDemo } from "@/lib/demo-client";

// Warm the briefing so it is usually ready by the time the user clicks Start.
const prefetchBriefing = () => void fetch("/api/briefing/start", { method: "POST" }).catch(() => {});

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (hasDemoMarker()) prefetchBriefing();
    if (isDemoAuthenticated() || hasDemoMarker()) router.replace("/today");
  }, [router]);

  async function handleTryDemo() {
    setStarting(true);
    setError(null);
    if (!(await startDemo())) {
      setStarting(false);
      setError("The demo could not start. Please try again.");
      return;
    }
    prefetchBriefing();
    router.replace("/today");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setError("That demo email or password is not correct.");
      return;
    }

    signInDemo();
    router.replace("/today");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <NudgeLogo variant="full" size={48} />
        </div>
        <section className="rounded-xl border border-border bg-surface p-6 md:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
              <OwlMark size={48} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted">See how Nudge plans a developer&apos;s day, no account needed.</p>
          </div>

          <Button type="button" size="lg" className="w-full" onClick={handleTryDemo} disabled={starting}>
            <Play className="h-4 w-4" /> {starting ? "Opening the demo…" : "Try the demo"}
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or sign in
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={DEMO_EMAIL}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter the demo password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-border bg-surface-2/50 p-3 text-xs text-muted">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-fg">
              <LockKeyhole className="h-3.5 w-3.5 text-primary-soft" /> Demo access
            </p>
            <p>Email: {DEMO_EMAIL}</p>
            <p>Password: {DEMO_PASSWORD}</p>
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-muted">Demo mode · No real account or credentials are required.</p>
      </div>
    </main>
  );
}
