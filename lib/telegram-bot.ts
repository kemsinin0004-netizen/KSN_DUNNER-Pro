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

export type TelegramReceivedMessage = {
  updateId: number;
  chatId: string;
  chatTitle: string;
  senderName: string;
  text: string;
  receivedAt: string;
  readAt?: string;
  archivedAt?: string;
};

type TelegramUpdatesResponse = TelegramResponse & {
  result?: Array<{ update_id: number; message?: { text?: string; date: number; chat: { id: number; title?: string; username?: string; first_name?: string }; from?: { first_name?: string; username?: string } } }>;
};

export async function sendTelegramTestMessage(chatId: string, text: string) {
  const token = await readToken();
  if (!token) throw new Error("សូមភ្ជាប់ Telegram Bot ជាមុនសិន");
  const normalizedChatId = chatId.trim();
  const normalizedText = text.trim();
  if (!normalizedChatId) throw new Error("សូមបញ្ចូល Chat ID");
  if (!normalizedText) throw new Error("សូមបញ្ចូលសារដែលត្រូវផ្ញើ");
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: normalizedChatId, text: normalizedText }),
  });
  const payload = (await response.json()) as TelegramResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || "Telegram មិនអាចផ្ញើសារបានទេ។ ពិនិត្យ Chat ID ហើយចាប់ផ្តើម chat ជាមួយ Bot ជាមុនសិន។");
  }
}

export async function receiveTelegramMessages(offset?: number): Promise<{ messages: TelegramReceivedMessage[]; nextOffset?: number }> {
  const token = await readToken();
  if (!token) throw new Error("សូមភ្ជាប់ Telegram Bot ជាមុនសិន");
  const params = new URLSearchParams({ timeout: "0", limit: "50" });
  if (offset !== undefined) params.set("offset", String(offset));
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getUpdates?${params.toString()}`);
  const payload = (await response.json()) as TelegramUpdatesResponse;
  if (!response.ok || !payload.ok || !Array.isArray(payload.result)) {
    throw new Error(payload.description || "មិនអាចទទួលសារ Telegram បានទេ");
  }
  const messages = payload.result.flatMap((update) => {
    const message = update.message;
    if (!message?.text) return [];
    return [{
      updateId: update.update_id,
      chatId: String(message.chat.id),
      chatTitle: message.chat.title || message.chat.username || message.chat.first_name || String(message.chat.id),
      senderName: message.from?.username ? `@${message.from.username}` : message.from?.first_name || "Telegram user",
      text: message.text,
      receivedAt: new Date(message.date * 1000).toISOString(),
    }];
  });
  const nextOffset = payload.result.length ? Math.max(...payload.result.map((item) => item.update_id)) + 1 : offset;
  return { messages, nextOffset };
}

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
