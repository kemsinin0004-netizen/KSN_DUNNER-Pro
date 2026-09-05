import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StatusBar } from "expo-status-bar";

import { ScreenContainer } from "@/components/screen-container";
import { createDraftEntry, filterEntries, type SkillNextEntry } from "@/lib/skillnext-helpers";
import { createMemory, listMemories } from "@/lib/memory-db";

const COLORS = {
  bg: "#070B10",
  surface: "#101720",
  surface2: "#151F2A",
  line: "#223040",
  text: "#F5F7FA",
  muted: "#8B9AAA",
  green: "#4ADE80",
  greenDark: "#123A26",
  blue: "#62B0FF",
  amber: "#F5B84B",
};

type Entry = SkillNextEntry;

const INITIAL_ENTRIES: Entry[] = [
  { id: "1", title: "បញ្ចូលទិន្នន័យអតិថិជន", subtitle: "Google Sheet · 24 ជួរ", time: "ម្សិលមិញ", status: "ready" },
  { id: "2", title: "រៀបចំបញ្ជីផលិតផល", subtitle: "CSV File · 86 ជួរ", time: "២ ថ្ងៃមុន", status: "ready" },
  { id: "3", title: "តាមដាន Leads ថ្មី", subtitle: "Telegram Bot · 12 Leads", time: "៣ ថ្ងៃមុន", status: "draft" },
];

const ACTIONS = [
  { icon: "add-circle-outline" as const, label: "បញ្ចូលថ្មី", color: COLORS.green },
  { icon: "auto-awesome" as const, label: "AI ជួយខ្ញុំ", color: COLORS.blue },
  { icon: "telegram" as const, label: "ភ្ជាប់ Bot", color: COLORS.amber },
];

function ActionButton({ icon, label, color, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}18` }]}>
        <MaterialIcons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function EntryCard({ item, onPress }: { item: Entry; onPress: () => void }) {
  const isDraft = item.status === "draft";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.entryCard, pressed && styles.cardPressed]}>
      <View style={styles.entryIcon}>
        <MaterialIcons name={isDraft ? "description" : "table-chart"} size={22} color={isDraft ? COLORS.amber : COLORS.green} />
      </View>
      <View style={styles.entryContent}>
        <View style={styles.entryTitleRow}>
          <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusDot, { backgroundColor: isDraft ? COLORS.amber : COLORS.green }]} />
        </View>
        <Text style={styles.entrySubtitle}>{item.subtitle}</Text>
      </View>
      <View style={styles.entryMeta}>
        <Text style={styles.entryTime}>{item.time}</Text>
        <MaterialIcons name="chevron-right" size={18} color={COLORS.muted} />
      </View>
    </Pressable>
  );
}

function InsightCard({
  icon,
  eyebrow,
  title,
  detail,
  accent,
  action,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  eyebrow: string;
  title: string;
  detail: string;
  accent: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.insightCard, pressed && styles.cardPressed]}>
      <View style={[styles.insightIcon, { backgroundColor: `${accent}18` }]}>
        <MaterialIcons name={icon} size={20} color={accent} />
      </View>
      <Text style={styles.insightEyebrow}>{eyebrow}</Text>
      <Text style={styles.insightTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.insightDetail} numberOfLines={2}>{detail}</Text>
      <View style={styles.insightAction}><Text style={[styles.insightActionText, { color: accent }]}>{action}</Text><MaterialIcons name="arrow-forward" size={14} color={accent} /></View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("ទំព័រដើម");
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("ស្វាគមន៍មកកាន់ SkillNext");
  const [showComposer, setShowComposer] = useState(false);
  const [showMemoryComposer, setShowMemoryComposer] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("General");
  const [memoryTags, setMemoryTags] = useState("");
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    void listMemories().then((memories) => setMemoryCount(memories.length)).catch(() => {
      setNotice("Memory local កំពុងរង់ចាំ Android SQLite build");
    });
  }, []);

  const filteredEntries = useMemo(() => filterEntries(entries, query), [entries, query]);

  const handleAction = (label: string) => {
    if (label === "បញ្ចូលថ្មី") {
      setShowComposer(true);
      setNotice("បង្កើតកិច្ចការថ្មីសម្រាប់អ្នក");
    } else if (label === "AI ជួយខ្ញុំ") {
      setNotice("AI កំពុងរៀបចំជំនួយសម្រាប់អ្នក…");
    } else {
      setNotice("ការភ្ជាប់ Telegram Bot នឹងមានក្នុងជំហានបន្ទាប់");
    }
  };

  const createEntry = () => {
    const next = createDraftEntry();
    setEntries((current) => [next, ...current]);
    setShowComposer(false);
    setNotice("បានរក្សាទុកកិច្ចការថ្មី");
  };

  const saveMemory = async () => {
    if (!memoryDraft.trim()) {
      setNotice("សូមសរសេរ Memory មុនពេលរក្សាទុក");
      return;
    }
    try {
      await createMemory("Memory ថ្មី", memoryDraft, memoryCategory, memoryTags.split(",").map((tag) => tag.trim()).filter(Boolean));
      const memories = await listMemories();
      setMemoryCount(memories.length);
      setMemoryDraft("");
      setMemoryCategory("General");
      setMemoryTags("");
      setShowMemoryComposer(false);
      setNotice("បានរក្សាទុក Memory នៅលើឧបករណ៍នេះ");
    } catch {
      setNotice("មិនអាចរក្សាទុក Memory បានទេ សូមសាកល្បងម្តងទៀត");
    }
  };

  const handleEntryPress = (title: string) => setNotice(`កំពុងបើក ${title}`);

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo}><MaterialIcons name="bolt" size={21} color={COLORS.bg} /></View>
            <View>
              <Text style={styles.brandName}>SKILLNEXT</Text>
              <Text style={styles.brandSub}>AI DATA ENTRY</Text>
            </View>
          </View>
          <Pressable onPress={() => setNotice("ការជូនដំណឹងរបស់អ្នក") } style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}>
            <MaterialIcons name="notifications-none" size={23} color={COLORS.text} />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ថ្ងៃនេះ · ០៥ កញ្ញា ២០២៦</Text>
            <Text style={styles.greeting}>សួស្តី, <Text style={styles.greetingAccent}>អ្នកបង្កើត</Text> 👋</Text>
            <Text style={styles.greetingSub}>តោះធ្វើការងាររបស់អ្នកឱ្យលឿន និងងាយជាងមុន។</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>ស</Text></View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>AI READY</Text></View>
            <Text style={styles.heroTitle}>ទិន្នន័យរបស់អ្នក{`\n`}ចាប់ផ្តើមពីទីនេះ</Text>
            <Text style={styles.heroDesc}>រៀបចំ បញ្ចូល និងគ្រប់គ្រងទិន្នន័យបានក្នុងកន្លែងតែមួយ។</Text>
            <Pressable onPress={() => setShowComposer(true)} style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}>
              <Text style={styles.heroButtonText}>ចាប់ផ្តើមឥឡូវនេះ</Text>
              <MaterialIcons name="arrow-forward" size={17} color={COLORS.bg} />
            </Pressable>
          </View>
          <View style={styles.heroGraphic}>
            <View style={styles.graphicRingOuter} />
            <View style={styles.graphicRingInner} />
            <MaterialIcons name="auto-awesome" size={31} color={COLORS.green} />
          </View>
        </View>

        {notice ? <View style={styles.notice}><MaterialIcons name="info-outline" size={16} color={COLORS.green} /><Text style={styles.noticeText}>{notice}</Text></View> : null}

        <View style={styles.sectionHeaderInsights}>
          <View><Text style={styles.sectionTitle}>កន្លែងរបស់អ្នក</Text><Text style={styles.sectionHint}>ព័ត៌មានសំខាន់ៗ មើលឃើញភ្លាមៗ</Text></View>
          <View style={styles.localBadge}><View style={styles.localBadgeDot} /><Text style={styles.localBadgeText}>LOCAL</Text></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insightRow}>
          <InsightCard icon="psychology" eyebrow="MEMORY" title={`${memoryCount} Memories`} detail="រក្សាទុក context របស់អ្នកនៅលើឧបករណ៍" accent={COLORS.green} action="មើល Memory" onPress={() => router.push("/memory")} />
          <InsightCard icon="edit-note" eyebrow="DAILY NOTES" title="កំណត់ត្រាថ្ងៃនេះ" detail="កត់ត្រាគំនិត និងកិច្ចការសំខាន់ៗ" accent={COLORS.blue} action="បន្ថែម Note" onPress={() => setNotice("បើកកំណត់ត្រាថ្មីសម្រាប់ថ្ងៃនេះ")} />
          <InsightCard icon="cloud" eyebrow="WEATHER" title="ភ្នំពេញ" detail="អាកាសធាតុ · ពិនិត្យតាមតំបន់របស់អ្នក" accent={COLORS.amber} action="ធ្វើបច្ចុប្បន្នភាព" onPress={() => setNotice("អាកាសធាតុត្រូវបានធ្វើបច្ចុប្បន្នភាព")} />
        </ScrollView>

        {showMemoryComposer && (
          <View style={styles.composer}>
            <View style={styles.composerHeader}><Text style={styles.composerTitle}>បន្ថែម Memory</Text><Pressable onPress={() => setShowMemoryComposer(false)}><MaterialIcons name="close" size={20} color={COLORS.muted} /></Pressable></View>
            <TextInput value={memoryDraft} onChangeText={setMemoryDraft} multiline placeholder="សរសេរ context ឬព័ត៌មានដែលអ្នកចង់ឱ្យ SkillNext ចងចាំ…" placeholderTextColor={COLORS.muted} style={[styles.input, styles.memoryInput]} />
            <TextInput value={memoryCategory} onChangeText={setMemoryCategory} placeholder="Category ឧ. Work, Personal" placeholderTextColor={COLORS.muted} style={styles.input} />
            <TextInput value={memoryTags} onChangeText={setMemoryTags} placeholder="Tags ដាក់ដោយ comma ឧ. client, urgent" placeholderTextColor={COLORS.muted} style={styles.input} />
            <Pressable onPress={() => void saveMemory()} style={({ pressed }) => [styles.saveButton, pressed && styles.heroButtonPressed]}><MaterialIcons name="save" size={18} color={COLORS.bg} /><Text style={styles.saveButtonText}>រក្សាទុកក្នុង SQLite</Text></Pressable>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ចាប់ផ្តើមរហ័ស</Text>
          <Text style={styles.sectionHint}>ជ្រើសរើសមុខងារ</Text>
        </View>
        <View style={styles.actionRow}>
          {ACTIONS.map((action) => <ActionButton key={action.label} {...action} onPress={() => handleAction(action.label)} />)}
        </View>

        {showComposer && (
          <View style={styles.composer}>
            <View style={styles.composerHeader}><Text style={styles.composerTitle}>កិច្ចការថ្មី</Text><Pressable onPress={() => setShowComposer(false)}><MaterialIcons name="close" size={20} color={COLORS.muted} /></Pressable></View>
            <TextInput placeholder="ដាក់ឈ្មោះកិច្ចការរបស់អ្នក" placeholderTextColor={COLORS.muted} style={styles.input} />
            <Pressable onPress={createEntry} style={({ pressed }) => [styles.saveButton, pressed && styles.heroButtonPressed]}><MaterialIcons name="check" size={18} color={COLORS.bg} /><Text style={styles.saveButtonText}>រក្សាទុកកិច្ចការ</Text></Pressable>
          </View>
        )}

        <View style={styles.sectionHeaderRecent}>
          <View><Text style={styles.sectionTitle}>ការងារថ្មីៗ</Text><Text style={styles.sectionHint}>បន្តពីកន្លែងដែលអ្នកបានឈប់</Text></View>
          <Pressable onPress={() => setNotice("បង្ហាញការងារទាំងអស់") }><Text style={styles.viewAll}>មើលទាំងអស់</Text></Pressable>
        </View>
        <View style={styles.searchBox}><MaterialIcons name="search" size={19} color={COLORS.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="ស្វែងរកកិច្ចការ…" placeholderTextColor={COLORS.muted} style={styles.searchInput} /></View>
        <FlatList data={filteredEntries} scrollEnabled={false} keyExtractor={(item) => item.id} renderItem={({ item }) => <EntryCard item={item} onPress={() => handleEntryPress(item.title)} />} ListEmptyComponent={<Text style={styles.emptyText}>មិនមានកិច្ចការដែលត្រូវគ្នា</Text>} />

        <View style={styles.statsCard}>
          <View><Text style={styles.statsEyebrow}>ស្ថានភាពសប្តាហ៍នេះ</Text><Text style={styles.statsTitle}>ការងាររបស់អ្នកកំពុងរីកចម្រើន</Text></View>
          <View style={styles.statsNumber}><Text style={styles.statsValue}>82%</Text><MaterialIcons name="trending-up" size={17} color={COLORS.green} /></View>
          <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
          <Text style={styles.statsFooter}>លឿនជាងសប្តាហ៍មុន ១៨%</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        {[{ icon: "home", label: "ទំព័រដើម" }, { icon: "folder-open", label: "កិច្ចការ" }, { icon: "smart-toy", label: "AI Bot" }, { icon: "person-outline", label: "គណនី" }].map((item) => {
          const active = activeTab === item.label;
          return <Pressable key={item.label} onPress={() => { setActiveTab(item.label); setNotice(`${item.label} កំពុងត្រូវបានបើក`); }} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={22} color={active ? COLORS.green : COLORS.muted} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text></Pressable>;
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 112 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 39, height: 39, borderRadius: 12, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center" },
  brandName: { color: COLORS.text, fontSize: 14, fontWeight: "900", letterSpacing: 2.2 },
  brandSub: { color: COLORS.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.6, marginTop: 2 },
  bellButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  notificationDot: { position: "absolute", right: 9, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  greetingRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  eyebrow: { color: COLORS.green, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 7 },
  greeting: { color: COLORS.text, fontSize: 24, fontWeight: "800", lineHeight: 32 },
  greetingAccent: { color: COLORS.green },
  greetingSub: { color: COLORS.muted, fontSize: 12, lineHeight: 20, marginTop: 5, maxWidth: 300 },
  avatar: { width: 45, height: 45, borderRadius: 16, backgroundColor: COLORS.greenDark, borderWidth: 1, borderColor: "#2A744A", alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.green, fontSize: 19, fontWeight: "800" },
  heroCard: { minHeight: 213, borderRadius: 24, padding: 20, overflow: "hidden", backgroundColor: "#122319", borderWidth: 1, borderColor: "#295F3D", flexDirection: "row", marginBottom: 12 },
  heroGlow: { position: "absolute", width: 230, height: 230, borderRadius: 115, right: -70, top: -76, backgroundColor: "#1B4D2F", opacity: 0.55 },
  heroCopy: { flex: 1, zIndex: 2 },
  livePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1B4B2E", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, marginBottom: 15 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  liveText: { color: COLORS.green, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  heroTitle: { color: COLORS.text, fontSize: 23, fontWeight: "900", lineHeight: 30, letterSpacing: -0.5 },
  heroDesc: { color: "#B5C9BB", fontSize: 11, lineHeight: 18, marginTop: 8, maxWidth: 230 },
  heroButton: { marginTop: 16, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8, backgroundColor: COLORS.green, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 14 },
  heroButtonPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  heroButtonText: { color: COLORS.bg, fontSize: 11, fontWeight: "900" },
  heroGraphic: { width: 94, alignItems: "center", justifyContent: "center", zIndex: 1 },
  graphicRingOuter: { position: "absolute", width: 93, height: 93, borderRadius: 47, borderWidth: 1, borderColor: "#4ADE8050" },
  graphicRingInner: { position: "absolute", width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: "#4ADE8070", backgroundColor: "#4ADE8010" },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 13, backgroundColor: "#0D2118", borderRadius: 12, borderWidth: 1, borderColor: "#234B32", marginBottom: 20 },
  noticeText: { color: "#BEEACB", fontSize: 11, flex: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  sectionHeaderRecent: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 27, marginBottom: 13 },
  sectionHeaderInsights: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24, marginBottom: 13 },
  sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  sectionHint: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  localBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "#0D2118", borderWidth: 1, borderColor: "#234B32" },
  localBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.green },
  localBadgeText: { color: COLORS.green, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  insightRow: { gap: 10, paddingRight: 20 },
  insightCard: { width: 148, minHeight: 173, padding: 14, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
  insightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  insightEyebrow: { color: COLORS.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginBottom: 5 },
  insightTitle: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  insightDetail: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 5, flex: 1 },
  insightAction: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12 },
  insightActionText: { fontSize: 10, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 9 },
  actionButton: { flex: 1, paddingVertical: 13, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", gap: 8 },
  actionIcon: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: COLORS.text, fontSize: 10, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  composer: { marginTop: 16, padding: 15, borderRadius: 18, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: "#355742" },
  composerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 11 },
  composerTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  input: { height: 45, borderRadius: 11, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.bg, color: COLORS.text, paddingHorizontal: 12, fontSize: 12 },
  memoryInput: { height: 86, paddingTop: 12, textAlignVertical: "top" },
  saveButton: { marginTop: 11, height: 43, borderRadius: 11, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  saveButtonText: { color: COLORS.bg, fontSize: 12, fontWeight: "900" },
  viewAll: { color: COLORS.green, fontSize: 11, fontWeight: "800" },
  searchBox: { height: 43, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, marginBottom: 10 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 12 },
  entryCard: { flexDirection: "row", alignItems: "center", padding: 13, marginBottom: 8, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  entryIcon: { width: 41, height: 41, borderRadius: 13, backgroundColor: COLORS.greenDark, alignItems: "center", justifyContent: "center", marginRight: 11 },
  entryContent: { flex: 1, minWidth: 0 },
  entryTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  entryTitle: { color: COLORS.text, fontSize: 12, fontWeight: "800", flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  entrySubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 5 },
  entryMeta: { alignItems: "flex-end", gap: 6, marginLeft: 8 },
  entryTime: { color: COLORS.muted, fontSize: 9 },
  emptyText: { color: COLORS.muted, fontSize: 12, textAlign: "center", padding: 18 },
  statsCard: { marginTop: 17, padding: 17, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
  statsEyebrow: { color: COLORS.green, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  statsTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800", marginTop: 5 },
  statsNumber: { position: "absolute", right: 17, top: 17, flexDirection: "row", alignItems: "center", gap: 4 },
  statsValue: { color: COLORS.green, fontSize: 22, fontWeight: "900" },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: COLORS.line, marginTop: 15, overflow: "hidden" },
  progressFill: { height: "100%", width: "82%", backgroundColor: COLORS.green, borderRadius: 4 },
  statsFooter: { color: COLORS.muted, fontSize: 10, marginTop: 8 },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 80, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, backgroundColor: "#0A1016F5", borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: "row", justifyContent: "space-around" },
  navItem: { alignItems: "center", justifyContent: "center", gap: 4, minWidth: 66 },
  navLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "700" },
  navLabelActive: { color: COLORS.green },
});
