import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") ?? path.join(process.cwd(), "nudge.db");

// Reuse a single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __nudgeDb?: Database.Database };

const sqlite = globalForDb.__nudgeDb ?? new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
if (process.env.NODE_ENV !== "production") globalForDb.__nudgeDb = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
export type DB = typeof db;
