import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { TELEGRAM_ARCHIVE_ACTION, TELEGRAM_MARK_READ_ACTION, archiveTelegramMessage, configureTelegramNotifications, markTelegramMessageRead } from "@/lib/telegram-background";
import { sendTelegramTestMessage } from "@/lib/telegram-bot";
import { formatCrashLogs, installCrashHandlers, readCrashLogs, type CrashLog } from "@/lib/crash-logger";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

function CrashFallback({ error, onShare }: { error: CrashLog | null; onShare: () => void }) {
  return (
    <View style={styles.crashScreen}>
      <Text style={styles.crashTitle}>កម្មវិធីមានបញ្ហា</Text>
      <Text style={styles.crashText}>SkillNext បានរក្សាទុកព័ត៌មាន error ដើម្បីជួយពិនិត្យមូលហេតុ។ សូមចែករំលែក logs ទៅអ្នកអភិវឌ្ឍន៍។</Text>
      {error ? <Text style={styles.crashError} selectable>{error.message}</Text> : null}
      <Pressable onPress={onShare} style={styles.crashButton}><Text style={styles.crashButtonText}>ចែករំលែក Crash Logs</Text></Pressable>
    </View>
  );
}

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  const [fatalError, setFatalError] = useState<CrashLog | null>(null);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  useEffect(() => {
    let active = true;
    void readCrashLogs().then((logs) => {
      if (active && logs[0]?.kind === "fatal") setFatalError(logs[0]);
    });
    const uninstall = installCrashHandlers((entry) => {
      if (entry.kind === "fatal" && active) setFatalError(entry);
    });
    return () => { active = false; uninstall(); };
  }, []);

  useEffect(() => {
    void configureTelegramNotifications().catch((error) => {
      console.warn("Telegram notification setup failed", error);
    });
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!["telegram-reply-action", TELEGRAM_MARK_READ_ACTION, TELEGRAM_ARCHIVE_ACTION].includes(response.actionIdentifier)) return;
      const data = response.notification.request.content.data;
      const updateId = typeof data.updateId === "number" || typeof data.updateId === "string" ? Number(data.updateId) : NaN;
      if (response.actionIdentifier === TELEGRAM_MARK_READ_ACTION && Number.isFinite(updateId)) {
        void markTelegramMessageRead(updateId);
        return;
      }
      if (response.actionIdentifier === TELEGRAM_ARCHIVE_ACTION && Number.isFinite(updateId)) {
        void archiveTelegramMessage(updateId);
        return;
      }
      const chatId = typeof data.chatId === "string" || typeof data.chatId === "number" ? String(data.chatId) : "";
      const reply = response.userText?.trim() || "";
      if (!chatId || !reply) return;
      void sendTelegramTestMessage(chatId, reply).catch((error) => {
        console.warn("Telegram notification reply failed", error);
      });
    });
    return () => subscription.remove();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  if (fatalError) {
    return <CrashFallback error={fatalError} onShare={() => {
      void readCrashLogs().then((logs) => Share.share({ title: "SkillNext crash logs", message: formatCrashLogs(logs) }));
    }} />;
  }

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  crashScreen: { flex: 1, backgroundColor: "#070B10", justifyContent: "center", padding: 24 },
  crashTitle: { color: "#F5F7FA", fontSize: 26, fontWeight: "800", marginBottom: 12 },
  crashText: { color: "#B7C2CF", fontSize: 16, lineHeight: 24, marginBottom: 18 },
  crashError: { color: "#FF7474", backgroundColor: "#21161A", borderColor: "#7F2D35", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 18 },
  crashButton: { alignSelf: "flex-start", backgroundColor: "#4ADE80", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13 },
  crashButtonText: { color: "#07130B", fontWeight: "800" },
});
