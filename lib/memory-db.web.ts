export type MemoryRecord = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

export type ImportMemoryRecord = Pick<MemoryRecord, "title" | "content"> & { createdAt?: string };

const webMemories: MemoryRecord[] = [];

export async function listMemories(): Promise<MemoryRecord[]> {
  return [...webMemories];
}

export async function createMemory(title: string, content: string): Promise<MemoryRecord> {
  const record: MemoryRecord = {
    id: Date.now(),
    title: title.trim(),
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
  webMemories.unshift(record);
  return record;
}

export async function updateMemory(id: number, title: string, content: string) {
  const record = webMemories.find((memory) => memory.id === id);
  if (record) {
    record.title = title.trim();
    record.content = content.trim();
  }
}

export async function importMemories(records: ImportMemoryRecord[]) {
  const known = new Set(webMemories.map((memory) => `${memory.title}\u0000${memory.content}`));
  let imported = 0;
  for (const record of records) {
    const title = record.title.trim();
    const content = record.content.trim();
    if (!title || !content || known.has(`${title}\u0000${content}`)) continue;
    webMemories.unshift({ id: Date.now() + imported, title, content, createdAt: record.createdAt ?? new Date().toISOString() });
    known.add(`${title}\u0000${content}`);
    imported += 1;
  }
  return imported;
}

export async function deleteMemory(id: number) {
  const index = webMemories.findIndex((memory) => memory.id === id);
  if (index >= 0) webMemories.splice(index, 1);
}
