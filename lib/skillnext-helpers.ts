export type SkillNextEntryStatus = "ready" | "draft";

export type SkillNextEntry = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  status: SkillNextEntryStatus;
};

export function filterEntries(entries: SkillNextEntry[], query: string) {
  return entries.filter((entry) => entry.title.toLowerCase().includes(query.toLowerCase()));
}

export function createDraftEntry(id = `${Date.now()}`): SkillNextEntry {
  return {
    id,
    title: "កិច្ចការថ្មីរបស់ខ្ញុំ",
    subtitle: "Draft · ចាប់ផ្តើមឥឡូវនេះ",
    time: "ឥឡូវនេះ",
    status: "draft",
  };
}
