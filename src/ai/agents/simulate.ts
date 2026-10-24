import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emails } from "@/db/schema";

/**
 * Demo-only arrivals for the Simulate menu. Inserting one of these is the only
 * scripted part: the run that follows triages, searches and drafts for real.
 */
const ARRIVALS = [
  {
    fromName: "Claire Dawson",
    fromEmail: "claire.dawson@northwind.com",
    subject: "Board moved to Monday: can we have the Atlas summary tomorrow?",
    body:
      "Hi Pushpender,\n\nOur board meeting has moved up to Monday morning. Could you send the Atlas executive summary by 10am tomorrow instead of Friday? " +
      "If the revised estimate is ready, please include it too so I can take both in.\n\nSorry for the short notice.\nClaire",
  },
  {
    fromName: "Dan Whitlock",
    fromEmail: "dan.whitlock@company.com",
    subject: "URGENT: client escalation on findings export",
    body:
      "Pushpender, Raj from Northwind says their team can't download the findings export since this morning (403 on the read-only account). " +
      "Can you look before the 11:00 sync? Let me know if you need Marcus.\n\nDan",
  },
  {
    fromName: "Priya Nair",
    fromEmail: "priya.nair@company.com",
    subject: "Need the revised estimate in the next hour",
    body:
      "Hi Pushpender,\n\nClaire just pinged me. They want the revised Atlas estimate before lunch so finance can sign off today. " +
      "Can you send it over in the next hour, or tell me what's blocking it?\n\nThanks,\nPriya",
  },
];

/** Drops the next demo email into the inbox and returns its id. */
export async function simulateIncomingEmail() {
  const existing = new Set((await db.select({ subject: emails.subject }).from(emails).where(eq(emails.isSent, false))).map((e) => e.subject));
  const next = ARRIVALS.find((a) => !existing.has(a.subject)) ?? ARRIVALS[Math.floor(Math.random() * ARRIVALS.length)];
  const [row] = await db.insert(emails).values({ ...next, receivedAt: new Date(), triage: null, isRead: false }).returning({ id: emails.id });
  return row.id;
}
