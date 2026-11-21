/**
 * CLI entry for the ingestion pipeline.
 * Usage: npm run db:ingest
 */
import "dotenv/config";
import { db } from "@/server/db";
import { runIngestion } from "@/server/ingest/pipeline";

runIngestion({ trigger: "cli", log: (m) => console.log(m) })
  .then((result) => {
    console.log(JSON.stringify(result.stats, null, 2));
  })
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
