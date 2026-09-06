import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "com.skillnext.aidataentry";

const config: ExpoConfig = {
  name: "SkillNext AI Data Entry",
  slug: "skillnext-ai-data-entry",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "skillnext",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: bundleId,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#070B10",
      foregroundImage: "./assets/images/splash-icon.png",
      monochromeImage: "./assets/images/splash-icon.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: bundleId,
    permissions: ["POST_NOTIFICATIONS"],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-background-task",
    ["expo-notifications", { defaultChannel: "telegram", color: "#4ADE80" }],
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#070B10" }],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], minSdkVersion: 24 } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
