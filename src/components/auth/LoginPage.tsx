"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { NudgeLogo, OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_EMAIL, DEMO_PASSWORD, isDemoAuthenticated, signInDemo } from "@/lib/auth";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoAuthenticated()) router.replace("/today");
  }, [router]);

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
            <p className="mt-2 text-sm text-muted">Sign in to open your gently handled workspace.</p>
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
            <Button type="submit" size="lg" className="w-full">
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
