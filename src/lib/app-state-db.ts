import "server-only";

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type AppStateRow = {
  data: string;
};

const globalDatabase = globalThis as typeof globalThis & {
  __floorRestorationSqlite?: DatabaseSync;
};

function getDatabasePath() {
  return path.join(process.cwd(), "data", "floor-restoration-manager.sqlite");
}

function getDatabase() {
  if (!globalDatabase.__floorRestorationSqlite) {
    const databasePath = getDatabasePath();
    const databaseDir = path.dirname(databasePath);
    if (!existsSync(databaseDir)) mkdirSync(databaseDir, { recursive: true });

    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    globalDatabase.__floorRestorationSqlite = database;
  }

  return globalDatabase.__floorRestorationSqlite;
}

export function readAppState(id: string) {
  const row = getDatabase().prepare("SELECT data FROM app_state WHERE id = ?").get(id) as AppStateRow | undefined;
  if (!row?.data) return null;
  return JSON.parse(row.data) as unknown;
}

export function writeAppState(id: string, data: unknown) {
  getDatabase()
    .prepare(
      `
        INSERT INTO app_state (id, data, created_at, updated_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          updated_at = datetime('now')
      `,
    )
    .run(id, JSON.stringify(data));
}

export function getAppDatabasePath() {
  return getDatabasePath();
}
