import * as SQLite from "expo-sqlite";

export type MemoryRecord = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

export type ImportMemoryRecord = Pick<MemoryRecord, "title" | "content"> & { createdAt?: string };

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
      created_at TEXT NOT NULL
    );
  `);
  return database;
}

export async function listMemories(): Promise<MemoryRecord[]> {
  const database = await getDatabase();
  return database.getAllAsync<MemoryRecord>(
    "SELECT id, title, content, created_at AS createdAt FROM memories ORDER BY id DESC",
  );
}

export async function createMemory(title: string, content: string): Promise<MemoryRecord> {
  const database = await getDatabase();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    "INSERT INTO memories (title, content, created_at) VALUES (?, ?, ?)",
    title.trim(),
    content.trim(),
    createdAt,
  );
  return { id: result.lastInsertRowId, title: title.trim(), content: content.trim(), createdAt };
}

export async function updateMemory(id: number, title: string, content: string) {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE memories SET title = ?, content = ? WHERE id = ?",
    title.trim(),
    content.trim(),
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
      "INSERT INTO memories (title, content, created_at) VALUES (?, ?, ?)",
      title,
      content,
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
