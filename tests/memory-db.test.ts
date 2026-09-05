import { describe, expect, it } from "vitest";

import { createMemory, createSavedFilter, deleteSavedFilter, listMemories, listSavedFilters } from "../lib/memory-db.web";

describe("SkillNext memory repository contract", () => {
  it("creates and lists a memory record", async () => {
    const before = await listMemories();
    const created = await createMemory("Test memory", "រក្សាទុក context សម្រាប់តេស្ត", "Work", ["test", "local"]);
    const after = await listMemories();

    expect(created.title).toBe("Test memory");
    expect(created.content).toContain("context");
    expect(created.category).toBe("Work");
    expect(created.tags).toEqual(["test", "local"]);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toEqual(created);
  });

  it("persists a named category and tag filter", async () => {
    const created = await createSavedFilter("Work urgent", "client", "Work", ["urgent", "client"]);
    expect((await listSavedFilters())[0]).toEqual(created);
    await deleteSavedFilter(created.id);
    expect((await listSavedFilters()).find((filter) => filter.id === created.id)).toBeUndefined();
  });
});
