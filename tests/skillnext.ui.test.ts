import { describe, expect, it } from "vitest";

import { createDraftEntry, filterEntries } from "../lib/skillnext-helpers";

describe("SkillNext entry helpers", () => {
  const entries = [
    { id: "1", title: "បញ្ចូលទិន្នន័យអតិថិជន", subtitle: "Google Sheet", time: "ម្សិលមិញ", status: "ready" as const },
    { id: "2", title: "រៀបចំបញ្ជីផលិតផល", subtitle: "CSV File", time: "២ ថ្ងៃមុន", status: "ready" as const },
  ];

  it("filters case-insensitively and preserves the matching item", () => {
    expect(filterEntries(entries, "ផលិតផល")).toEqual([entries[1]]);
    expect(filterEntries(entries, "missing")).toEqual([]);
    expect(filterEntries(entries, "")).toHaveLength(2);
  });

  it("creates a predictable draft entry for a new task", () => {
    expect(createDraftEntry("test-id")).toEqual({
      id: "test-id",
      title: "កិច្ចការថ្មីរបស់ខ្ញុំ",
      subtitle: "Draft · ចាប់ផ្តើមឥឡូវនេះ",
      time: "ឥឡូវនេះ",
      status: "draft",
    });
  });
});
