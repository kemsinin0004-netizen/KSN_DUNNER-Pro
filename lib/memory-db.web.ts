export type MemoryRecord = {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
};

export type ImportMemoryRecord = Pick<MemoryRecord, "title" | "content"> & { category?: string; tags?: string[]; createdAt?: string };
export type SavedFilter = { id: number; name: string; query: string; category: string; tags: string[] };

const webMemories: MemoryRecord[] = [];
const webSavedFilters: SavedFilter[] = [];

export async function listMemories(): Promise<MemoryRecord[]> {
  return [...webMemories];
}

export async function createMemory(title: string, content: string, category = "General", tags: string[] = []): Promise<MemoryRecord> {
  const record: MemoryRecord = {
    id: Date.now(),
    title: title.trim(),
    content: content.trim(),
    category: category.trim() || "General",
    tags,
    createdAt: new Date().toISOString(),
  };
  webMemories.unshift(record);
  return record;
}

export async function updateMemory(id: number, title: string, content: string, category = "General", tags: string[] = []) {
  const record = webMemories.find((memory) => memory.id === id);
  if (record) {
    record.title = title.trim();
    record.content = content.trim();
    record.category = category.trim() || "General";
    record.tags = tags;
  }
}

export async function importMemories(records: ImportMemoryRecord[]) {
  const known = new Set(webMemories.map((memory) => `${memory.title}\u0000${memory.content}`));
  let imported = 0;
  for (const record of records) {
    const title = record.title.trim();
    const content = record.content.trim();
    if (!title || !content || known.has(`${title}\u0000${content}`)) continue;
    webMemories.unshift({ id: Date.now() + imported, title, content, category: record.category?.trim() || "General", tags: record.tags ?? [], createdAt: record.createdAt ?? new Date().toISOString() });
    known.add(`${title}\u0000${content}`);
    imported += 1;
  }
  return imported;
}

export async function deleteMemory(id: number) {
  const index = webMemories.findIndex((memory) => memory.id === id);
  if (index >= 0) webMemories.splice(index, 1);
}

export async function listSavedFilters(): Promise<SavedFilter[]> {
  return [...webSavedFilters];
}

export async function createSavedFilter(name: string, query: string, category: string, tags: string[]) {
  const filter = { id: Date.now(), name: name.trim(), query: query.trim(), category, tags };
  webSavedFilters.unshift(filter);
  return filter;
}

export async function deleteSavedFilter(id: number) {
  const index = webSavedFilters.findIndex((filter) => filter.id === id);
  if (index >= 0) webSavedFilters.splice(index, 1);
}
