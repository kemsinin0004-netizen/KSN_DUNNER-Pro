import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { ScreenContainer } from "@/components/screen-container";
import { deleteMemory, importMemories, listMemories, updateMemory, type MemoryRecord } from "@/lib/memory-db";
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
  const [status, setStatus] = useState("Memory រក្សាទុកក្នុងឧបករណ៍នេះ");

  const loadMemories = useCallback(async () => {
    try {
      setMemories(await listMemories());
    } catch {
      setStatus("មិនអាចអាន SQLite បានទេ");
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadMemories();
  }, [loadMemories]));

  const filteredMemories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return memories;
    return memories.filter((memory) => `${memory.title} ${memory.content}`.toLowerCase().includes(normalized));
  }, [memories, query]);

  const beginEdit = (memory: MemoryRecord) => {
    setEditing(memory);
    setEditTitle(memory.title);
    setEditContent(memory.content);
  };

  const saveEdit = async () => {
    if (!editing || !editTitle.trim() || !editContent.trim()) {
      setStatus("សូមបំពេញចំណងជើង និងមាតិកា");
      return;
    }
    await updateMemory(editing.id, editTitle, editContent);
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

  const shareExport = async (format: "json" | "markdown") => {
    try {
      const allMemories = await listMemories();
      if (!allMemories.length) {
        setStatus("មិនទាន់មាន Memory សម្រាប់ export ទេ");
        return;
      }
      if (!FileSystem.documentDirectory) throw new Error("មិនមាន local document directory");
      const extension = format === "json" ? "json" : "md";
      const mimeType = format === "json" ? "application/json" : "text/markdown";
      const fileUri = `${FileSystem.documentDirectory}skillnext-memory-${Date.now()}.${extension}`;
      const content = format === "json" ? memoriesToJson(allMemories) : memoriesToMarkdown(allMemories);
      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: `Export ${format.toUpperCase()}` });
        setStatus(`បាន export ${allMemories.length} Memories ជា ${format.toUpperCase()}`);
      } else {
        setStatus("Share sheet មិនមានលើឧបករណ៍នេះទេ");
      }
    } catch {
      setStatus("Export មិនបានសម្រេចទេ");
    }
  };

  const chooseExportFormat = () => {
    Alert.alert("Export Memory", "ជ្រើសរើសទម្រង់ឯកសារ", [
      { text: "JSON", onPress: () => void shareExport("json") },
      { text: "Markdown", onPress: () => void shareExport("markdown") },
      { text: "បោះបង់", style: "cancel" },
    ]);
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
        <View style={styles.transferRow}>
          <Pressable onPress={chooseExportFormat} style={({ pressed }) => [styles.transferButton, pressed && styles.pressed]}><MaterialIcons name="ios-share" size={17} color={COLORS.green} /><Text style={styles.transferText}>Export</Text></Pressable>
          <Pressable onPress={() => void importBackup()} style={({ pressed }) => [styles.transferButton, pressed && styles.pressed]}><MaterialIcons name="file-upload" size={17} color="#7DB8FF" /><Text style={[styles.transferText, { color: "#7DB8FF" }]}>Import</Text></Pressable>
        </View>

        {editing ? (
          <View style={styles.editorCard}>
            <View style={styles.editorHeader}><Text style={styles.editorTitle}>កែប្រែ Memory</Text><Pressable onPress={() => setEditing(null)}><MaterialIcons name="close" size={20} color={COLORS.muted} /></Pressable></View>
            <TextInput value={editTitle} onChangeText={setEditTitle} placeholder="ចំណងជើង" placeholderTextColor={COLORS.muted} style={styles.input} />
            <TextInput value={editContent} onChangeText={setEditContent} multiline placeholder="មាតិកា" placeholderTextColor={COLORS.muted} style={[styles.input, styles.contentInput]} />
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
              <View style={styles.memoryIcon}><MaterialIcons name="sticky-note-2" size={20} color={COLORS.green} /></View>
              <View style={styles.memoryBody}><Text style={styles.memoryTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.memoryContent} numberOfLines={3}>{item.content}</Text><Text style={styles.memoryDate}>{new Date(item.createdAt).toLocaleDateString("km-KH")}</Text></View>
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
  transferRow: { flexDirection: "row", gap: 9, marginBottom: 14 },
  transferButton: { flex: 1, height: 39, borderRadius: 11, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  transferText: { color: COLORS.green, fontSize: 11, fontWeight: "800" },
  listContent: { paddingBottom: 32, flexGrow: 1 },
  memoryCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, marginBottom: 9 },
  memoryIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: COLORS.greenDark, alignItems: "center", justifyContent: "center" },
  memoryBody: { flex: 1, minWidth: 0 },
  memoryTitle: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
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
