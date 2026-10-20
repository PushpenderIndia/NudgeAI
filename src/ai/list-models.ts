/**
 * Lists the models available to your Nebius Token Factory account.
 * Run: npm run models   (reads NEBIUS_API_KEY from .env)
 */
import { getClient, NEBIUS_BASE_URL } from "./client";

async function main() {
  console.log(`Querying ${NEBIUS_BASE_URL}/models …\n`);
  const client = getClient();
  const res = await client.models.list();
  const ids = res.data.map((m) => m.id).sort();

  console.log("All models:");
  for (const id of ids) console.log("  " + id);

  const nemotron = ids.filter((i) => /nemotron/i.test(i));
  console.log("\nNemotron models (use these for MODEL_HEAVY / MODEL_FAST):");
  for (const id of nemotron) console.log("  " + id);
}

main().catch((e) => {
  console.error("Failed to list models:", e?.message ?? e);
  process.exit(1);
});
