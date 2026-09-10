import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "skillnext.crash_logs.v1";
const MAX_LOGS = 50;

export type CrashLog = {
  id: string;
  kind: "fatal" | "promise" | "startup" | "manual";
  message: string;
  stack?: string;
  timestamp: string;
  platform: string;
  appVersion: string;
};

function appVersion() {
  try {
    // Keep this dependency-free so the logger can run during the earliest startup phase.
    return "1.0.0";
  } catch {
    return "unknown";
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export async function readCrashLogs(): Promise<CrashLog[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CrashLog[]) : [];
  } catch {
    return [];
  }
}

export async function recordCrash(error: unknown, kind: CrashLog["kind"] = "fatal") {
  const normalized = normalizeError(error);
  const entry: CrashLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    message: normalized.message || "Unknown error",
    stack: normalized.stack,
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
    appVersion: appVersion(),
  };
  try {
    const logs = await readCrashLogs();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...logs].slice(0, MAX_LOGS)));
  } catch {
    // Crash logging must never create another crash.
  }
  return entry;
}

export async function clearCrashLogs() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function formatCrashLogs(logs: CrashLog[]) {
  if (!logs.length) return "SkillNext crash logs\nNo errors recorded.";
  return [
    "SkillNext crash logs",
    `Exported: ${new Date().toISOString()}`,
    "",
    ...logs.map((log, index) => [
      `#${index + 1} ${log.kind.toUpperCase()} · ${log.timestamp}`,
      `Platform: ${log.platform} · App: ${log.appVersion}`,
      `Message: ${log.message}`,
      log.stack ? `Stack:\n${log.stack}` : "",
      "",
    ].filter(Boolean).join("\n")),
  ].join("\n");
}

export function installCrashHandlers(onError?: (entry: CrashLog) => void) {
  const runtime = globalThis as typeof globalThis & {
    ErrorUtils?: { getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void; setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void };
    onunhandledrejection?: (event: PromiseRejectionEvent) => void;
  };
  const previousHandler = runtime.ErrorUtils?.getGlobalHandler?.();
  const handler = (error: unknown, isFatal = true) => {
    void recordCrash(error, isFatal ? "fatal" : "startup").then((entry) => onError?.(entry));
    previousHandler?.(error, isFatal);
  };
  runtime.ErrorUtils?.setGlobalHandler?.(handler);

  const previousRejection = runtime.onunhandledrejection;
  if (Platform.OS === "web") {
    runtime.onunhandledrejection = (event) => {
      void recordCrash(event.reason, "promise").then((entry) => onError?.(entry));
      previousRejection?.(event);
    };
  }

  return () => {
    if (runtime.ErrorUtils?.setGlobalHandler && previousHandler) runtime.ErrorUtils.setGlobalHandler(previousHandler);
    if (Platform.OS === "web" && runtime.onunhandledrejection === previousRejection) runtime.onunhandledrejection = previousRejection;
  };
}
