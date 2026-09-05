import type { MemoryRecord } from "@/lib/memory-db";

export type ImportMemoryRecord = Pick<MemoryRecord, "title" | "content"> & { category?: string; tags?: string[]; createdAt?: string };

export function memoriesToJson(memories: MemoryRecord[]) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), memories }, null, 2);
}

export function memoriesToMarkdown(memories: MemoryRecord[]) {
  const body = memories.map((memory) => {
    const date = new Date(memory.createdAt).toLocaleString("km-KH");
    const tags = (memory.tags ?? []).length ? (memory.tags ?? []).map((tag) => `#${tag}`).join(" ") : "";
    return `## ${memory.title}\n\n_${date}_\n\n**Category:** ${memory.category ?? "General"}\n**Tags:** ${tags}\n\n${memory.content}\n`;
  }).join("\n");
  return `# SkillNext Memory Export\n\nExported memories: ${memories.length}\n\n${body}`;
}

export function parseMemoryImport(text: string, format: "json" | "markdown"): ImportMemoryRecord[] {
  if (format === "json") {
    const parsed: unknown = JSON.parse(text);
    const memories = Array.isArray(parsed) ? parsed : (parsed as { memories?: unknown })?.memories;
    if (!Array.isArray(memories)) throw new Error("JSON មិនមាន memories array ទេ");
    return memories.map(normalizeImportedMemory).filter(Boolean) as ImportMemoryRecord[];
  }

  return text.split(/\n(?=## )/g).slice(1).map((section) => {
    const lines = section.split("\n");
    const title = lines[0]?.replace(/^##\s+/, "").trim() ?? "";
    const categoryLine = lines.find((line) => line.startsWith("**Category:**"));
    const tagsLine = lines.find((line) => line.startsWith("**Tags:**"));
    const content = lines.slice(1).filter((line) => line.trim() && !/^_.*_$/.test(line.trim()) && !line.startsWith("**Category:**") && !line.startsWith("**Tags:**")).join("\n").trim();
    return { title, content, category: categoryLine?.replace("**Category:**", "").trim() || "General", tags: tagsLine?.replace("**Tags:**", "").trim().split(/\s+/).filter(Boolean).map((tag) => tag.replace(/^#/, "")) ?? [] };
  }).filter((memory) => memory.title && memory.content);
}

function normalizeImportedMemory(value: unknown): ImportMemoryRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { title?: unknown; content?: unknown; category?: unknown; tags?: unknown; createdAt?: unknown };
  if (typeof candidate.title !== "string" || typeof candidate.content !== "string") return null;
  return {
    title: candidate.title.trim(),
    content: candidate.content.trim(),
    category: typeof candidate.category === "string" ? candidate.category.trim() : "General",
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean) : [],
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : undefined,
  };
}
