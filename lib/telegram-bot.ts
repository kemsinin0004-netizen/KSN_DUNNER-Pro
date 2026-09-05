import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "skillnext.telegram.bot_token";

export type TelegramBotProfile = {
  id: number;
  username?: string;
  firstName: string;
  canReadAllGroupMessages?: boolean;
};

type TelegramResponse = {
  ok: boolean;
  result?: { id: number; is_bot: boolean; first_name: string; username?: string; can_read_all_group_messages?: boolean };
  description?: string;
};

async function readToken() {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeToken(token: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearTelegramBot() {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getSavedTelegramBot(): Promise<TelegramBotProfile | null> {
  const token = await readToken();
  if (!token) return null;
  try {
    return await verifyTelegramBot(token);
  } catch {
    return null;
  }
}

export async function connectTelegramBot(token: string): Promise<TelegramBotProfile> {
  const normalized = token.trim();
  if (!/^\d{5,}:\S{20,}$/.test(normalized)) {
    throw new Error("ទម្រង់ Bot Token មិនត្រឹមត្រូវ។ សូម copy token ពី @BotFather ឡើងវិញ។");
  }
  const profile = await verifyTelegramBot(normalized);
  await writeToken(normalized);
  return profile;
}

async function verifyTelegramBot(token: string): Promise<TelegramBotProfile> {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`);
  const payload = (await response.json()) as TelegramResponse;
  if (!response.ok || !payload.ok || !payload.result?.is_bot) {
    throw new Error(payload.description || "Telegram មិនអាចផ្ទៀងផ្ទាត់ Bot Token បានទេ");
  }
  return {
    id: payload.result.id,
    username: payload.result.username,
    firstName: payload.result.first_name,
    canReadAllGroupMessages: payload.result.can_read_all_group_messages,
  };
}

export function telegramBotLabel(profile: TelegramBotProfile) {
  return profile.username ? `@${profile.username}` : profile.firstName;
}
