import * as SQLite from "expo-sqlite";

export type MemoryRecord = {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
};

export type ImportMemoryRecord = Pick<MemoryRecord, "title" | "content"> & { category?: string; tags?: string[]; createdAt?: string };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("skillnext-memory.db");
  }
  const database = await databasePromise;
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
  `);
  try { await database.execAsync("ALTER TABLE memories ADD COLUMN category TEXT NOT NULL DEFAULT 'General'"); } catch {}
  try { await database.execAsync("ALTER TABLE memories ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"); } catch {}
  return database;
}

export async function listMemories(): Promise<MemoryRecord[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ id: number; title: string; content: string; category: string; tags: string; createdAt: string }>("SELECT id, title, content, category, tags, created_at AS createdAt FROM memories ORDER BY id DESC");
  return rows.map((row) => ({ ...row, tags: parseTags(row.tags) }));
}

export async function createMemory(title: string, content: string, category = "General", tags: string[] = []): Promise<MemoryRecord> {
  const database = await getDatabase();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    "INSERT INTO memories (title, content, category, tags, created_at) VALUES (?, ?, ?, ?, ?)",
    title.trim(),
    content.trim(),
    category.trim() || "General",
    JSON.stringify(tags),
    createdAt,
  );
  return { id: result.lastInsertRowId, title: title.trim(), content: content.trim(), category: category.trim() || "General", tags, createdAt };
}

export async function updateMemory(id: number, title: string, content: string, category = "General", tags: string[] = []) {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE memories SET title = ?, content = ?, category = ?, tags = ? WHERE id = ?",
    title.trim(),
    content.trim(),
    category.trim() || "General",
    JSON.stringify(tags),
    id,
  );
}

export async function importMemories(records: ImportMemoryRecord[]) {
  const database = await getDatabase();
  const existing = await listMemories();
  const known = new Set(existing.map((memory) => `${memory.title}\u0000${memory.content}`));
  let imported = 0;
  for (const record of records) {
    const title = record.title.trim();
    const content = record.content.trim();
    if (!title || !content || known.has(`${title}\u0000${content}`)) continue;
    await database.runAsync(
      "INSERT INTO memories (title, content, category, tags, created_at) VALUES (?, ?, ?, ?, ?)",
      title,
      content,
      record.category?.trim() || "General",
      JSON.stringify(record.tags ?? []),
      record.createdAt ?? new Date().toISOString(),
    );
    known.add(`${title}\u0000${content}`);
    imported += 1;
  }
  return imported;
}

export async function deleteMemory(id: number) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM memories WHERE id = ?", id);
}

function parseTags(value: string) {
  try { return Array.isArray(JSON.parse(value)) ? JSON.parse(value).filter((tag: unknown): tag is string => typeof tag === "string") : []; } catch { return []; }
}
