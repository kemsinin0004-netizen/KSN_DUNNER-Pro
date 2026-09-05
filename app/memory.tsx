import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { ScreenContainer } from "@/components/screen-container";
import { createSavedFilter, deleteMemory, deleteSavedFilter, importMemories, listMemories, listSavedFilters, markSavedFilterUsed, toggleSavedFilterPinned, updateMemory, type MemoryRecord, type SavedFilter } from "@/lib/memory-db";
import { memoriesToJson, memoriesToMarkdown, parseMemoryImport } from "@/lib/memory-transfer";

const COLORS = {
  bg: "#070B10",
  surface: "#101720",
  surface2: "#151F2A",
  line: "#223040",
  text: "#F5F7FA",
  muted: "#8B9AAA",
  green: "#4ADE80",
  greenDark: "#123A26",
  red: "#FF7474",
};

export default function MemoryScreen() {
  const router = useRouter();
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MemoryRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("General");
  const [editTags, setEditTags] = useState("");
  const [status, setStatus] = useState("Memory រក្សាទុកក្នុងឧបករណ៍នេះ");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState("");

  const loadMemories = useCallback(async () => {
    try {
      setMemories(await listMemories());
      setSavedFilters(await listSavedFilters());
    } catch {
      setStatus("មិនអាចអាន SQLite បានទេ");
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadMemories();
  }, [loadMemories]));

  const filteredMemories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return memories.filter((memory) => {
      const matchesCategory = categoryFilter === "All" || memory.category === categoryFilter;
      const matchesQuery = !normalized || `${memory.title} ${memory.content} ${memory.category} ${memory.tags.join(" ")}`.toLowerCase().includes(normalized);
      const matchesTags = selectedTags.every((tag) => memory.tags.includes(tag));
      return matchesCategory && matchesQuery && matchesTags;
    });
  }, [memories, query, categoryFilter, selectedTags]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(memories.map((memory) => memory.category).filter(Boolean)))], [memories]);
  const allTags = useMemo(() => Array.from(new Set(memories.flatMap((memory) => memory.tags))).sort(), [memories]);

  const beginEdit = (memory: MemoryRecord) => {
    setEditing(memory);
    setEditTitle(memory.title);
    setEditContent(memory.content);
    setEditCategory(memory.category);
    setEditTags(memory.tags.join(", "));
  };

  const saveEdit = async () => {
    if (!editing || !editTitle.trim() || !editContent.trim()) {
      setStatus("សូមបំពេញចំណងជើង និងមាតិកា");
      return;
    }
    await updateMemory(editing.id, editTitle, editContent, editCategory, editTags.split(",").map((tag) => tag.trim()).filter(Boolean));
    setEditing(null);
    await loadMemories();
    setStatus("បានកែប្រែ Memory រួចរាល់");
  };

  const confirmDelete = (memory: MemoryRecord) => {
    Alert.alert("លុប Memory?", `តើអ្នកចង់លុប “${memory.title}” មែនទេ?`, [
      { text: "បោះបង់", style: "cancel" },
      { text: "លុប", style: "destructive", onPress: () => void removeMemory(memory.id) },
    ]);
  };

  const removeMemory = async (id: number) => {
    await deleteMemory(id);
    await loadMemories();
    setStatus("បានលុប Memory រួចរាល់");
  };

  const shareExport = async (format: "json" | "markdown", selectedOnly = false) => {
    try {
      const allMemories = await listMemories();
      const exportMemories = selectedOnly ? allMemories.filter((memory) => selectedIds.includes(memory.id)) : allMemories;
      if (!exportMemories.length) {
        setStatus("មិនទាន់មាន Memory សម្រាប់ export ទេ");
        return;
      }
      if (!FileSystem.documentDirectory) throw new Error("មិនមាន local document directory");
      const extension = format === "json" ? "json" : "md";
      const mimeType = format === "json" ? "application/json" : "text/markdown";
      const fileUri = `${FileSystem.documentDirectory}skillnext-memory-${Date.now()}.${extension}`;
      const content = format === "json" ? memoriesToJson(exportMemories) : memoriesToMarkdown(exportMemories);
      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: `Export ${format.toUpperCase()}` });
        setStatus(`បាន export ${exportMemories.length} Memories ជា ${format.toUpperCase()}`);
      } else {
        setStatus("Share sheet មិនមានលើឧបករណ៍នេះទេ");
      }
    } catch {
      setStatus("Export មិនបានសម្រេចទេ");
    }
  };

  const chooseExportFormat = (selectedOnly = false) => {
    const count = selectedOnly ? selectedIds.length : memories.length;
    Alert.alert("Export Memory", `${count} Memories · ជ្រើសរើសទម្រង់ឯកសារ`, [
      { text: "JSON", onPress: () => void shareExport("json", selectedOnly) },
      { text: "Markdown", onPress: () => void shareExport("markdown", selectedOnly) },
      { text: "បោះបង់", style: "cancel" },
    ]);
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredMemories.map((memory) => memory.id);
    setSelectedIds((current) => visibleIds.every((id) => current.includes(id)) ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])));
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds([]);
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const clearFilters = () => {
    setCategoryFilter("All");
    setSelectedTags([]);
    setQuery("");
  };

  const saveCurrentFilter = async () => {
    if (!query.trim() && categoryFilter === "All" && !selectedTags.length) {
      setStatus("សូមជ្រើស Category, Tags ឬសរសេរ Search មុនពេលរក្សាទុក");
      return;
    }
    const name = filterName.trim() || `Filter ${savedFilters.length + 1}`;
    await createSavedFilter(name, query, categoryFilter, selectedTags);
    setSavedFilters(await listSavedFilters());
    setFilterName("");
    setShowSaveFilter(false);
    setStatus(`បានរក្សាទុក Filter “${name}”`);
  };

  const applySavedFilter = async (filter: SavedFilter) => {
    setQuery(filter.query);
    setCategoryFilter(filter.category);
    setSelectedTags(filter.tags);
    await markSavedFilterUsed(filter.id);
    setSavedFilters(await listSavedFilters());
    setStatus(`បានអនុវត្ត Filter “${filter.name}”`);
  };

  const removeSavedFilter = async (filter: SavedFilter) => {
    await deleteSavedFilter(filter.id);
    setSavedFilters(await listSavedFilters());
    setStatus(`បានលុប Filter “${filter.name}”`);
  };

  const togglePinned = async (filter: SavedFilter) => {
    await toggleSavedFilterPinned(filter.id, !filter.pinned);
    setSavedFilters(await listSavedFilters());
    setStatus(filter.pinned ? `បានដក Pin ពី “${filter.name}”` : `បាន Pin “${filter.name}” នៅខាងលើ`);
  };

  const importBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/markdown", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const format = asset.name.toLowerCase().endsWith(".json") ? "json" : "markdown";
      const records = parseMemoryImport(text, format);
      const imported = await importMemories(records);
      await loadMemories();
      setStatus(imported ? `បាន import ${imported} Memories ថ្មី` : "គ្មាន Memory ថ្មីត្រូវបានបន្ថែម");
    } catch {
      setStatus("Import មិនបានសម្រេចទេ៖ ពិនិត្យ JSON ឬ Markdown file");
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background">
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color={COLORS.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>LOCAL MEMORY</Text><Text style={styles.title}>បណ្ណាល័យចងចាំ</Text><Text style={styles.subtitle}>{memories.length} Memories · រក្សាទុក locally</Text></View>
          <View style={styles.headerIcon}><MaterialIcons name="psychology" size={22} color={COLORS.green} /></View>
        </View>

        <View style={styles.status}><View style={styles.statusDot} /><Text style={styles.statusText}>{status}</Text></View>
        <View style={styles.searchBox}><MaterialIcons name="search" size={19} color={COLORS.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="ស្វែងរក Memory…" placeholderTextColor={COLORS.muted} style={styles.searchInput} /></View>
        <FlatList horizontal data={categories} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow} renderItem={({ item }) => <Pressable onPress={() => setCategoryFilter(item)} style={[styles.categoryChip, categoryFilter === item && styles.categoryChipActive]}><Text style={[styles.categoryText, categoryFilter === item && styles.categoryTextActive]}>{item}</Text></Pressable>} />
        {allTags.length ? <View style={styles.tagFilterHeader}><Text style={styles.filterLabel}>FILTER តាម Tags</Text>{selectedTags.length ? <Pressable onPress={clearFilters}><Text style={styles.clearFilters}>សម្អាត</Text></Pressable> : null}</View> : null}
        {allTags.length ? <FlatList horizontal data={allTags} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow} renderItem={({ item }) => <Pressable onPress={() => toggleTagFilter(item)} style={[styles.tagChip, selectedTags.includes(item) && styles.tagChipActive]}><Text style={[styles.tagFilterText, selectedTags.includes(item) && styles.tagFilterTextActive]}>#{item}</Text></Pressable>} /> : null}
        {selectedTags.length ? <View style={styles.activeFilterNote}><MaterialIcons name="filter-list" size={14} color={COLORS.green} /><Text style={styles.activeFilterText}>បង្ហាញ Memory ដែលមានគ្រប់ {selectedTags.length} Tags ដែលបានជ្រើស</Text></View> : null}
        <View style={styles.savedHeader}><Text style={styles.filterLabel}>SAVED FILTERS</Text><Pressable onPress={() => setShowSaveFilter((current) => !current)}><Text style={styles.saveFilterLink}>{showSaveFilter ? "បិទ" : "+ រក្សាទុក Filter"}</Text></Pressable></View>
        {showSaveFilter ? <View style={styles.saveFilterCard}><TextInput value={filterName} onChangeText={setFilterName} placeholder="ឈ្មោះ Filter ឧ. Work urgent" placeholderTextColor={COLORS.muted} style={styles.input} /><Pressable onPress={() => void saveCurrentFilter()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><MaterialIcons name="bookmark-add" size={17} color={COLORS.bg} /><Text style={styles.primaryButtonText}>រក្សាទុក Filter នេះ</Text></Pressable></View> : null}
        {savedFilters.length ? <FlatList horizontal data={savedFilters} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow} renderItem={({ item }) => <View style={[styles.savedChip, item.pinned && styles.savedChipPinned]}><Pressable onPress={() => void applySavedFilter(item)} style={styles.savedMain}><Text style={styles.savedName} numberOfLines={1}>{item.pinned ? "📌 " : ""}{item.name}</Text><Text style={styles.savedDetails} numberOfLines={1}>{item.category === "All" ? "All" : item.category}{item.tags.length ? ` · ${item.tags.map((tag) => `#${tag}`).join(" ")}` : ""}</Text><Text style={styles.savedUsage} numberOfLines={1}>{item.useCount ? `ប្រើ ${item.useCount} ដង` : "មិនទាន់ប្រើ"}</Text></Pressable><View style={styles.savedActions}><Pressable onPress={() => void togglePinned(item)} style={styles.savedAction}><MaterialIcons name={item.pinned ? "push-pin" : "push-pin"} size={14} color={item.pinned ? COLORS.green : COLORS.muted} /></Pressable><Pressable onPress={() => void removeSavedFilter(item)} style={styles.savedAction}><MaterialIcons name="close" size={13} color={COLORS.red} /></Pressable></View></View>} /> : null}
        <View style={styles.transferRow}>
          {bulkMode ? <Pressable onPress={() => toggleSelectAll()} style={({ pressed }) => [styles.transferButton, pressed && styles.pressed]}><MaterialIcons name="select-all" size={17} color={COLORS.green} /><Text style={styles.transferText}>{selectedIds.length ? "បោះជ្រើស" : "ជ្រើសទាំងអស់"}</Text></Pressable> : <Pressable onPress={() => chooseExportFormat(false)} style={({ pressed }) => [styles.transferButton, pressed && styles.pressed]}><MaterialIcons name="ios-share" size={17} color={COLORS.green} /><Text style={styles.transferText}>Export ទាំងអស់</Text></Pressable>}
          <Pressable onPress={() => void importBackup()} style={({ pressed }) => [styles.transferButton, pressed && styles.pressed]}><MaterialIcons name="file-upload" size={17} color="#7DB8FF" /><Text style={[styles.transferText, { color: "#7DB8FF" }]}>Import</Text></Pressable>
          {!bulkMode ? <Pressable onPress={() => setBulkMode(true)} style={({ pressed }) => [styles.transferButton, pressed && styles.pressed]}><MaterialIcons name="checklist" size={17} color="#D4A7FF" /><Text style={[styles.transferText, { color: "#D4A7FF" }]}>ជ្រើស</Text></Pressable> : <Pressable onPress={() => chooseExportFormat(true)} style={({ pressed }) => [styles.transferButton, pressed && styles.pressed]}><MaterialIcons name="ios-share" size={17} color={COLORS.green} /><Text style={styles.transferText}>Export {selectedIds.length}</Text></Pressable>}
        </View>
        {bulkMode ? <View style={styles.bulkBar}><Text style={styles.bulkText}>បានជ្រើស {selectedIds.length} / {memories.length}</Text><Pressable onPress={exitBulkMode}><Text style={styles.cancelBulk}>បិទការជ្រើស</Text></Pressable></View> : null}

        {editing ? (
          <View style={styles.editorCard}>
            <View style={styles.editorHeader}><Text style={styles.editorTitle}>កែប្រែ Memory</Text><Pressable onPress={() => setEditing(null)}><MaterialIcons name="close" size={20} color={COLORS.muted} /></Pressable></View>
            <TextInput value={editTitle} onChangeText={setEditTitle} placeholder="ចំណងជើង" placeholderTextColor={COLORS.muted} style={styles.input} />
            <TextInput value={editContent} onChangeText={setEditContent} multiline placeholder="មាតិកា" placeholderTextColor={COLORS.muted} style={[styles.input, styles.contentInput]} />
            <TextInput value={editCategory} onChangeText={setEditCategory} placeholder="Category ឧ. Work, Personal" placeholderTextColor={COLORS.muted} style={styles.input} />
            <TextInput value={editTags} onChangeText={setEditTags} placeholder="Tags ដាក់ដោយ comma" placeholderTextColor={COLORS.muted} style={styles.input} />
            <Pressable onPress={() => void saveEdit()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><MaterialIcons name="save" size={18} color={COLORS.bg} /><Text style={styles.primaryButtonText}>រក្សាទុកការកែប្រែ</Text></Pressable>
          </View>
        ) : null}

        <FlatList
          data={filteredMemories}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.memoryCard}>
              {bulkMode ? <Pressable onPress={() => toggleSelected(item.id)} style={[styles.checkbox, selectedIds.includes(item.id) && styles.checkboxSelected]}>{selectedIds.includes(item.id) ? <MaterialIcons name="check" size={15} color={COLORS.bg} /> : null}</Pressable> : null}
              <View style={styles.memoryIcon}><MaterialIcons name="sticky-note-2" size={20} color={COLORS.green} /></View>
              <View style={styles.memoryBody}><View style={styles.metaRow}><Text style={styles.memoryCategory}>{item.category}</Text>{item.tags.slice(0, 2).map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}</View><Text style={styles.memoryTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.memoryContent} numberOfLines={3}>{item.content}</Text><Text style={styles.memoryDate}>{new Date(item.createdAt).toLocaleDateString("km-KH")}</Text></View>
              <View style={styles.cardActions}><Pressable onPress={() => beginEdit(item)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="edit" size={18} color={COLORS.green} /></Pressable><Pressable onPress={() => confirmDelete(item)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={19} color={COLORS.red} /></Pressable></View>
            </View>
          )}
          ListEmptyComponent={<View style={styles.empty}><MaterialIcons name="psychology" size={42} color={COLORS.green} /><Text style={styles.emptyTitle}>{query ? "រកមិនឃើញ Memory" : "មិនទាន់មាន Memory"}</Text><Text style={styles.emptyText}>{query ? "សាកល្បងពាក្យស្វែងរកផ្សេងទៀត" : "ចូល Dashboard ដើម្បីបន្ថែម Memory ដំបូងរបស់អ្នក"}</Text></View>}
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 20 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", marginRight: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: COLORS.green, fontSize: 9, fontWeight: "900", letterSpacing: 1.3, marginBottom: 4 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  subtitle: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  headerIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: COLORS.greenDark, alignItems: "center", justifyContent: "center" },
  status: { flexDirection: "row", alignItems: "center", gap: 7, padding: 12, borderRadius: 12, backgroundColor: "#0D2118", borderWidth: 1, borderColor: "#234B32", marginBottom: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green },
  statusText: { color: "#BEEACB", fontSize: 11 },
  searchBox: { height: 45, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, marginBottom: 14 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 12 },
  categoryRow: { gap: 7, paddingBottom: 12 },
  categoryChip: { paddingHorizontal: 12, height: 30, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, justifyContent: "center" },
  categoryChipActive: { backgroundColor: COLORS.greenDark, borderColor: COLORS.green },
  categoryText: { color: COLORS.muted, fontSize: 10, fontWeight: "700" },
  categoryTextActive: { color: COLORS.green },
  tagFilterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  filterLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  clearFilters: { color: COLORS.red, fontSize: 10, fontWeight: "800" },
  tagRow: { gap: 7, paddingBottom: 10 },
  tagChip: { paddingHorizontal: 10, height: 29, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, justifyContent: "center" },
  tagChipActive: { backgroundColor: "#30215A", borderColor: "#B79AFF" },
  tagFilterText: { color: "#B79AFF", fontSize: 10, fontWeight: "700" },
  tagFilterTextActive: { color: "#E3D7FF" },
  activeFilterNote: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4, marginBottom: 8 },
  activeFilterText: { color: COLORS.muted, fontSize: 10 },
  savedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  saveFilterLink: { color: COLORS.green, fontSize: 10, fontWeight: "800" },
  saveFilterCard: { padding: 11, borderRadius: 14, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: "#355742", marginBottom: 9 },
  savedRow: { gap: 8, paddingBottom: 11 },
  savedChip: { minWidth: 125, maxWidth: 190, flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 10, paddingRight: 6, paddingVertical: 7, borderRadius: 11, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
  savedChipPinned: { borderColor: COLORS.green, backgroundColor: "#0D2118" },
  savedMain: { flex: 1 },
  savedName: { color: COLORS.text, fontSize: 10, fontWeight: "800" },
  savedDetails: { color: COLORS.muted, fontSize: 8, marginTop: 3 },
  savedUsage: { color: COLORS.green, fontSize: 8, marginTop: 2 },
  savedActions: { gap: 2 },
  savedAction: { padding: 4 },
  transferRow: { flexDirection: "row", gap: 9, marginBottom: 14 },
  transferButton: { flex: 1, height: 39, borderRadius: 11, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  transferText: { color: COLORS.green, fontSize: 11, fontWeight: "800" },
  bulkBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginTop: -5, marginBottom: 10 },
  bulkText: { color: COLORS.muted, fontSize: 10 },
  cancelBulk: { color: COLORS.red, fontSize: 10, fontWeight: "800" },
  listContent: { paddingBottom: 32, flexGrow: 1 },
  memoryCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, marginBottom: 9 },
  memoryIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: COLORS.greenDark, alignItems: "center", justifyContent: "center" },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", marginTop: 8 },
  checkboxSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  memoryBody: { flex: 1, minWidth: 0 },
  memoryTitle: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  memoryCategory: { color: COLORS.green, fontSize: 9, fontWeight: "800" },
  tag: { color: "#B79AFF", fontSize: 9 },
  memoryContent: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  memoryDate: { color: COLORS.muted, fontSize: 9, marginTop: 7 },
  cardActions: { gap: 5 },
  iconButton: { width: 31, height: 31, borderRadius: 10, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  editorCard: { padding: 14, borderRadius: 17, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: "#355742", marginBottom: 14 },
  editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  editorTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  input: { height: 44, borderRadius: 11, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.bg, color: COLORS.text, paddingHorizontal: 12, fontSize: 12, marginBottom: 9 },
  contentInput: { height: 88, paddingTop: 12, textAlignVertical: "top" },
  primaryButton: { height: 43, borderRadius: 11, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  primaryButtonText: { color: COLORS.bg, fontSize: 12, fontWeight: "900" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 25, paddingVertical: 85 },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800", marginTop: 13 },
  emptyText: { color: COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 6 },
  pressed: { opacity: 0.72 },
});
