import { describe, expect, it } from "vitest";

import { createMemory, listMemories } from "../lib/memory-db.web";

describe("SkillNext memory repository contract", () => {
  it("creates and lists a memory record", async () => {
    const before = await listMemories();
    const created = await createMemory("Test memory", "រក្សាទុក context សម្រាប់តេស្ត");
    const after = await listMemories();

    expect(created.title).toBe("Test memory");
    expect(created.content).toContain("context");
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toEqual(created);
  });
});
