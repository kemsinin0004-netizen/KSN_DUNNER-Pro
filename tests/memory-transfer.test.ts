import { describe, expect, it } from "vitest";

import { memoriesToJson, memoriesToMarkdown, parseMemoryImport } from "../lib/memory-transfer";

const memories = [{ id: 1, title: "Khmer context", content: "ចងចាំព័ត៌មាននេះ", createdAt: "2026-09-05T00:00:00.000Z" }];

describe("Memory export and import formats", () => {
  it("round-trips JSON memories", () => {
    const imported = parseMemoryImport(memoriesToJson(memories), "json");
    expect(imported).toEqual([{ title: "Khmer context", content: "ចងចាំព័ត៌មាននេះ", createdAt: "2026-09-05T00:00:00.000Z" }]);
  });

  it("parses Markdown memory sections", () => {
    const imported = parseMemoryImport(memoriesToMarkdown(memories), "markdown");
    expect(imported[0]).toMatchObject({ title: "Khmer context", content: "ចងចាំព័ត៌មាននេះ" });
  });
});
