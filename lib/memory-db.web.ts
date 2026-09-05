export type MemoryRecord = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

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

export async function deleteMemory(id: number) {
  const index = webMemories.findIndex((memory) => memory.id === id);
  if (index >= 0) webMemories.splice(index, 1);
}
