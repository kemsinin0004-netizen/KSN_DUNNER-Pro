import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import { receiveTelegramMessages, type TelegramReceivedMessage } from "@/lib/telegram-bot";

export const TELEGRAM_BACKGROUND_TASK = "skillnext-telegram-receive";
const OFFSET_KEY = "skillnext.telegram.update_offset";
const MESSAGES_KEY = "skillnext.telegram.received_messages";

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
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "SkillNext · Telegram",
          body: result.messages.length === 1 ? result.messages[0].text : `${result.messages.length} សារថ្មីពី Telegram`,
          data: { screen: "home", updateIds: result.messages.map((message) => message.updateId) },
        },
        trigger: null,
      });
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
