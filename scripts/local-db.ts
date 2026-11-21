/**
 * Local development database.
 *
 * Starts a real PostgreSQL 17 server from the `embedded-postgres` npm package,
 * so contributors don't need Docker or a system-wide Postgres install.
 * Production uses a hosted Postgres (Neon) instead — only DATABASE_URL changes.
 *
 * The data directory lives OUTSIDE the project folder on purpose: syncing
 * tools (OneDrive, Dropbox) corrupt live Postgres data files.
 *
 * Usage: npm run db:local   (keep it running; Ctrl+C stops the server)
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const DB_NAME = "oneatlas";
const baseDir =
  process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share");
const databaseDir = path.join(baseDir, "oneatlas", "pgdata");

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  autoRehydrateSymlinks: true,
  // Windows defaults to the WIN1252 code page, which can't store characters
  // like "→" or CJK model names. Force UTF-8 to match production (Neon).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

async function main() {
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    console.log(`Initialising new cluster in ${databaseDir}`);
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  const existing = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [DB_NAME],
  );
  if (existing.rowCount === 0) await pg.createDatabase(DB_NAME);
  await client.end();

  console.log(
    `Postgres ready → postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}`,
  );

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Keep the process alive while Postgres runs.
  setInterval(() => {}, 1 << 30);
}

main().catch(async (err) => {
  console.error(err);
  await pg.stop().catch(() => {});
  process.exit(1);
});
