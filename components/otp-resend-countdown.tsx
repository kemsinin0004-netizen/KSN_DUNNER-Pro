import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getOtpResendUiState } from "../lib/otp-countdown";

type Language = "km" | "en";

export function OtpResendCountdown({
  seconds,
  loading,
  language,
  onResend,
}: {
  seconds: number;
  loading: boolean;
  language: Language;
  onResend: () => void;
}) {
  const ui = getOtpResendUiState(seconds, loading, language);

  return (
    <>
      <View style={styles.cooldownBox} accessibilityLiveRegion="polite" testID="otp-resend-countdown">
        <View style={styles.cooldownHeader}>
          <MaterialIcons name={seconds > 0 ? "schedule" : "check-circle-outline"} size={15} color={seconds > 0 ? "#62B0FF" : "#4ADE80"} />
        <Text style={styles.cooldownLabel} testID="otp-countdown-label">{ui.label}</Text>
        </View>
        <View style={styles.progressTrack} testID="otp-countdown-progress-track">
          <View testID="otp-countdown-progress" style={[styles.progressFill, { width: `${ui.progress * 100}%` }]} />
        </View>
      </View>
      <Pressable
        testID="otp-resend-button"
        accessibilityRole="button"
        accessibilityState={{ disabled: ui.disabled }}
        disabled={ui.disabled}
        onPress={onResend}
        style={({ pressed }) => [styles.resendButton, pressed && styles.pressed, ui.disabled && styles.disabled]}
      >
        <MaterialIcons name="refresh" size={16} color={ui.disabled ? "#8B9AAA" : "#4ADE80"} />
        <Text style={[styles.resendText, ui.disabled && styles.resendDisabledText]}>{ui.buttonLabel}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  cooldownBox: { marginTop: 8, padding: 9, borderRadius: 9, backgroundColor: "#0B1622", borderWidth: 1, borderColor: "#223040" },
  cooldownHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  cooldownLabel: { flex: 1, color: "#8B9AAA", fontSize: 10, fontWeight: "800" },
  progressTrack: { height: 4, marginTop: 7, borderRadius: 2, overflow: "hidden", backgroundColor: "#1D2A37" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: "#4ADE80" },
  resendButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9 },
  resendText: { color: "#4ADE80", fontSize: 11, fontWeight: "800" },
  resendDisabledText: { color: "#8B9AAA" },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
});
