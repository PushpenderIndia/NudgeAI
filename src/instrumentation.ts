/**
 * Next.js instrumentation — runs once when the server starts.
 * Boots Nudge's background scheduler (reminders) in the Node.js runtime only.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/scheduler");
    await startScheduler();
  }
}
