import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { receiveTelegramMessages, type TelegramReceivedMessage } from "@/lib/telegram-bot";

export const TELEGRAM_BACKGROUND_TASK = "skillnext-telegram-receive";
export const TELEGRAM_REPLY_CATEGORY = "skillnext-telegram-reply";
const OFFSET_KEY = "skillnext.telegram.update_offset";
const MESSAGES_KEY = "skillnext.telegram.received_messages";

if (Platform.OS !== "web") {
  void Notifications.setNotificationCategoryAsync(TELEGRAM_REPLY_CATEGORY, [{
    identifier: "telegram-reply-action",
    buttonTitle: "តបសារ",
    textInput: { submitButtonTitle: "ផ្ញើ", placeholder: "សរសេរចម្លើយ…" },
    options: { opensAppToForeground: true },
  }]);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

TaskManager.defineTask(TELEGRAM_BACKGROUND_TASK, async () => {
  try {
    const storedOffset = await AsyncStorage.getItem(OFFSET_KEY);
    const offset = storedOffset ? Number(storedOffset) : undefined;
    const result = await receiveTelegramMessages(Number.isFinite(offset) ? offset : undefined);
    if (result.nextOffset !== undefined) await AsyncStorage.setItem(OFFSET_KEY, String(result.nextOffset));
    if (result.messages.length) {
      const existing = JSON.parse((await AsyncStorage.getItem(MESSAGES_KEY)) || "[]") as TelegramReceivedMessage[];
      const merged = [...result.messages, ...existing].slice(0, 100);
      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(merged));
      for (const message of result.messages.slice(0, 10)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Telegram · ${message.senderName}`,
            body: message.text,
            ...(Platform.OS === "android" ? { channelId: "telegram" } : {}),
            categoryIdentifier: TELEGRAM_REPLY_CATEGORY,
            data: { screen: "home", updateId: message.updateId, chatId: message.chatId },
          },
          trigger: null,
        });
      }
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn("Telegram background task failed", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function getBackgroundTelegramMessages() {
  const raw = await AsyncStorage.getItem(MESSAGES_KEY);
  return raw ? (JSON.parse(raw) as TelegramReceivedMessage[]) : [];
}

export async function registerTelegramBackgroundTask() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("telegram", {
      name: "Telegram messages",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4ADE80",
    });
  }
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("សូមអនុញ្ញាត Notification ដើម្បីទទួលដំណឹងសារថ្មី");
  if (await TaskManager.isTaskRegisteredAsync(TELEGRAM_BACKGROUND_TASK)) return;
  await BackgroundTask.registerTaskAsync(TELEGRAM_BACKGROUND_TASK, { minimumInterval: 15 });
}

export async function unregisterTelegramBackgroundTask() {
  if (await TaskManager.isTaskRegisteredAsync(TELEGRAM_BACKGROUND_TASK)) {
    await BackgroundTask.unregisterTaskAsync(TELEGRAM_BACKGROUND_TASK);
  }
}

export async function isTelegramBackgroundTaskRegistered() {
  return TaskManager.isTaskRegisteredAsync(TELEGRAM_BACKGROUND_TASK);
}
