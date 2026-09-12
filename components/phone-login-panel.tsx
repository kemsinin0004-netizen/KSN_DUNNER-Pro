import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import { setSessionToken, setUserInfo } from "@/lib/_core/auth";

const COLORS = {
  bg: "#070B10",
  surface: "#101720",
  line: "#223040",
  text: "#F5F7FA",
  muted: "#8B9AAA",
  green: "#4ADE80",
  blue: "#62B0FF",
};

type LoginStep = "phone" | "code" | "verified";
type ErrorAction = "request" | "focus-code" | "resend" | undefined;
type Language = "km" | "en";
type ErrorKey = "phone" | "codeRequired" | "invalidCode" | "expired" | "tooMany" | "smsFailed" | "serviceUnavailable" | "requestFailed" | "verifyFailed" | "clipboardEmpty" | "clipboardRead";
type OtpError = { key: ErrorKey; action: ErrorAction };

const ERROR_COPY: Record<ErrorKey, { km: { title: string; message: string }; en: { title: string; message: string } }> = {
  phone: { km: { title: "លេខទូរសព្ទ៍មិនត្រឹមត្រូវ", message: "សូមប្រើទម្រង់អន្តរជាតិ ដូចជា +85512345678។" }, en: { title: "Invalid phone number", message: "Use international format, for example +85512345678." } },
  codeRequired: { km: { title: "Verify Code មិនពេញលេញ", message: "សូមបញ្ចូលលេខកូដ OTP ចំនួន ៦ ខ្ទង់។" }, en: { title: "Incomplete verification code", message: "Enter the 6-digit OTP code." } },
  invalidCode: { km: { title: "កូដ OTP មិនត្រឹមត្រូវ", message: "កូដនេះមិនត្រូវនឹងសារ SMS ទេ។ សូមពិនិត្យ ហើយសាកល្បងម្ដងទៀត។" }, en: { title: "Incorrect OTP", message: "This code does not match the SMS. Check it and try again." } },
  expired: { km: { title: "កូដ OTP ផុតកំណត់", message: "កូដមានសុពលភាពត្រឹម ៥ នាទី។ សូមស្នើកូដថ្មី។" }, en: { title: "OTP expired", message: "The code is valid for 5 minutes. Request a new code." } },
  tooMany: { km: { title: "ព្យាយាមលើសចំនួនកំណត់", message: "អ្នកបានបញ្ចូលកូដខុស ៥ ដង។ សូមស្នើកូដថ្មី។" }, en: { title: "Too many attempts", message: "You entered the wrong code 5 times. Request a new code." } },
  smsFailed: { km: { title: "ផ្ញើ SMS មិនបានសម្រេច", message: "ប្រព័ន្ធផ្ញើ SMS មានបញ្ហា។ សូមព្យាយាមម្ដងទៀត។" }, en: { title: "SMS delivery failed", message: "The SMS service had a problem. Please try again." } },
  serviceUnavailable: { km: { title: "OTP Service មិនទាន់រួចរាល់", message: "AWS SNS OTP មិនទាន់បានកំណត់នៅ server។ សូមទាក់ទងអ្នកគ្រប់គ្រង។" }, en: { title: "OTP service unavailable", message: "AWS SNS OTP is not configured on the server. Contact an administrator." } },
  requestFailed: { km: { title: "ស្នើ Verify Code មិនបានសម្រេច", message: "មិនអាចទទួលបានកូដ OTP ទេ។ សូមព្យាយាមម្ដងទៀត។" }, en: { title: "Could not request code", message: "We could not request an OTP. Please try again." } },
  verifyFailed: { km: { title: "ផ្ទៀងផ្ទាត់ OTP មិនបានសម្រេច", message: "ការផ្ទៀងផ្ទាត់មិនបានសម្រេច។ សូមពិនិត្យការតភ្ជាប់ ហើយសាកល្បងម្ដងទៀត។" }, en: { title: "Verification failed", message: "Verification could not be completed. Check your connection and try again." } },
  clipboardEmpty: { km: { title: "Clipboard មិនមាន OTP", message: "សូម Copy Code ៦ ខ្ទង់ពីសារ SMS មុនសិន។" }, en: { title: "No OTP in clipboard", message: "Copy the 6-digit code from your SMS first." } },
  clipboardRead: { km: { title: "មិនអាចអាន Clipboard", message: "សូមបញ្ចូល OTP ដោយដៃ។" }, en: { title: "Could not read clipboard", message: "Please enter the OTP manually." } },
};

export function PhoneLoginPanel({ onSuccess }: { onSuccess?: () => void }) {
  const [language, setLanguage] = useState<Language>("km");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [step, setStep] = useState<LoginStep>("phone");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState<OtpError | null>(null);
  const loadingRotation = useRef(new Animated.Value(0)).current;
  const codeInputRef = useRef<TextInput>(null);
  const verifyingRef = useRef(false);
  const successHandledRef = useRef(false);
  const successScale = useRef(new Animated.Value(0.65)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const [notice, setNotice] = useState("AWS SNS OTP · បញ្ចូលលេខទូរសព្ទ៍ដើម្បីទទួល SMS");

  useEffect(() => {
    if (!loading) {
      loadingRotation.stopAnimation();
      loadingRotation.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.timing(loadingRotation, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [loading, loadingRotation]);

  useEffect(() => {
    if (step === "code") {
      const timer = setTimeout(() => codeInputRef.current?.focus(), 250);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (step !== "verified") {
      successHandledRef.current = false;
      return undefined;
    }
    if (successHandledRef.current) return undefined;
    successHandledRef.current = true;
    successScale.setValue(0.65);
    successOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => onSuccess?.(), 1200);
    return () => clearTimeout(timer);
  }, [onSuccess, step, successOpacity, successScale]);

  const clearError = () => setOtpError(null);

  const friendlyError = (status: number, _fallback: string, phase: "request" | "verify"): OtpError => {
    if (status === 400 && phase === "request") return { key: "phone", action: "request" };
    if (status === 400) return { key: "codeRequired", action: "focus-code" };
    if (status === 401) return { key: "invalidCode", action: "focus-code" };
    if (status === 410) return { key: "expired", action: "resend" };
    if (status === 429) return { key: "tooMany", action: "resend" };
    if (status === 502) return { key: "smsFailed", action: "request" };
    if (status === 503) return { key: "serviceUnavailable", action: undefined };
    return { key: phase === "request" ? "requestFailed" : "verifyFailed", action: phase === "request" ? "request" : "focus-code" };
  };

  const showError = (status: number, fallback: string, phase: "request" | "verify", overrideKey?: ErrorKey) => setOtpError(overrideKey ? { key: overrideKey, action: "focus-code" } : friendlyError(status, fallback, phase));

  const requestCode = async () => {
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      showError(400, "សូមបញ្ចូលលេខទូរសព្ទ៍ជាទម្រង់អន្តរជាតិ ឧ. +85512345678", "request");
      return;
    }
    clearError();
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/phone/request-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.trim() }) });
      const payload = await response.json() as { ok?: boolean; challengeId?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.challengeId) {
        showError(response.status, payload.error || "មិនអាចផ្ញើ SMS បានទេ", "request");
        return;
      }
      setChallengeId(payload.challengeId);
      setStep("code");
      setCode("");
      setResendCooldown(60);
      setNotice("បានផ្ញើ Verify Code ទៅលេខទូរសព្ទ៍របស់អ្នក។ Code មានសុពលភាព 5 នាទី។");
    } catch (error) {
      showError(0, error instanceof Error ? error.message : "មិនអាចផ្ញើ SMS បានទេ", "request");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (codeOverride?: string) => {
    const submittedCode = (codeOverride ?? code).trim();
    if (!/^\d{6}$/.test(submittedCode)) {
      showError(400, "សូមបញ្ចូល Verify Code ចំនួន ៦ ខ្ទង់។", "verify");
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    clearError();
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/phone/verify-code`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, code: submittedCode }) });
      const payload = await response.json() as { ok?: boolean; verified?: boolean; sessionToken?: string; user?: { openId: string; name: string; loginMethod: string }; error?: string };
      if (!response.ok || !payload.ok || !payload.verified) {
        showError(response.status, payload.error || "Verify Code មិនត្រឹមត្រូវទេ", "verify");
        return;
      }
      if (payload.sessionToken) await setSessionToken(payload.sessionToken);
      if (payload.user) await setUserInfo({ id: 0, openId: payload.user.openId, name: payload.user.name, email: null, loginMethod: payload.user.loginMethod, lastSignedIn: new Date() });
      setStep("verified");
      setNotice("Login និង Verify លេខទូរសព្ទ៍ជោគជ័យ។ Session ត្រូវបានរក្សាទុកដោយសុវត្ថិភាព។");
    } catch (error) {
      showError(0, error instanceof Error ? error.message : "Verify Code មិនបានសម្រេចទេ", "verify");
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  const pasteOtp = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      const pastedCode = clipboardText.replace(/\D/g, "").slice(0, 6);
      if (pastedCode.length !== 6) {
        showError(400, "Clipboard មិនមាន OTP ៦ ខ្ទង់ទេ។", "verify", "clipboardEmpty");
        return;
      }
      setCode(pastedCode);
      clearError();
      setNotice("បានបំពេញ OTP ៦ ខ្ទង់។ កំពុងផ្ទៀងផ្ទាត់ដោយស្វ័យប្រវត្តិ…");
      codeInputRef.current?.focus();
      void verifyCode(pastedCode);
    } catch {
      showError(0, "Clipboard read failed", "verify", "clipboardRead");
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0 || loading) return;
    clearError();
    await requestCode();
  };

  const handleErrorAction = () => {
    if (otpError?.action === "request") void requestCode();
    if (otpError?.action === "resend") void resendCode();
    if (otpError?.action === "focus-code") {
      setCode("");
      clearError();
      codeInputRef.current?.focus();
    }
  };

  const errorActionLabel = otpError?.action === "request"
    ? language === "km" ? "ព្យាយាមម្ដងទៀត" : "Try again"
    : otpError?.action === "resend"
      ? resendCooldown > 0 ? language === "km" ? `ស្នើកូដថ្មីក្នុង ${resendCooldown} វិនាទី` : `Request a new code in ${resendCooldown}s` : language === "km" ? "ស្នើកូដថ្មី" : "Request new code"
      : otpError?.action === "focus-code" ? language === "km" ? "បញ្ចូលកូដម្ដងទៀត" : "Enter code again" : "";

  const activeErrorCopy = otpError ? ERROR_COPY[otpError.key][language] : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}><MaterialIcons name="person-outline" size={22} color={COLORS.green} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>{language === "km" ? "Login គណនី" : "Account login"}</Text><Text style={styles.subtitle}>Custom Backend · AWS SNS SMS OTP</Text></View>
        <Pressable onPress={() => setLanguage((current) => current === "km" ? "en" : "km")} style={styles.languageButton} accessibilityLabel={language === "km" ? "Switch to English" : "ប្ដូរទៅភាសាខ្មែរ"}><Text style={styles.languageText}>{language === "km" ? "EN" : "ខ្មែរ"}</Text></Pressable>
      </View>
      <View style={styles.notice}><MaterialIcons name="info-outline" size={16} color={COLORS.blue} /><Text style={styles.noticeText}>{notice}</Text></View>
      {otpError ? <View style={styles.error} accessibilityRole="alert">
        <MaterialIcons name="error-outline" size={19} color="#FF7474" />
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>{activeErrorCopy?.title}</Text>
          <Text style={styles.errorText}>{activeErrorCopy?.message}</Text>
          {otpError.action ? <Pressable disabled={loading || (otpError.action === "resend" && resendCooldown > 0)} onPress={handleErrorAction} style={({ pressed }) => [styles.errorAction, pressed && styles.pressed, (loading || (otpError.action === "resend" && resendCooldown > 0)) && styles.disabled]}><Text style={styles.errorActionText}>{errorActionLabel}</Text></Pressable> : null}
        </View>
      </View> : null}
      {step === "phone" ? <>
        <Text style={styles.label}>លេខទូរសព្ទ៍</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" placeholder="+85512345678" placeholderTextColor={COLORS.muted} style={styles.input} />
        <Text style={styles.help}>ប្រើទម្រង់អន្តរជាតិ ដោយចាប់ផ្តើមពី + និង country code។</Text>
        <Pressable disabled={loading} onPress={() => void requestCode()} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}><Animated.View style={{ transform: [{ rotate: loadingRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}><MaterialIcons name={loading ? "sync" : "sms"} size={18} color={COLORS.bg} /></Animated.View><Text style={styles.buttonText}>{loading ? "កំពុងផ្ញើ SMS…" : "ស្នើ Verify Code"}</Text></Pressable>
      </> : step === "code" ? <>
        <Text style={styles.label}>Verify Code សម្រាប់ {phone}</Text>
        <TextInput ref={codeInputRef} value={code} onChangeText={(value) => { const nextCode = value.replace(/\D/g, "").slice(0, 6); setCode(nextCode); clearError(); if (nextCode.length === 6) void verifyCode(nextCode); }} keyboardType="number-pad" autoFocus maxLength={6} placeholder="000000" placeholderTextColor={COLORS.muted} style={[styles.input, styles.codeInput]} />
        <Pressable onPress={() => void pasteOtp()} style={({ pressed }) => [styles.pasteButton, pressed && styles.pressed]}><MaterialIcons name="content-paste" size={16} color={COLORS.blue} /><Text style={styles.pasteText}>Paste OTP ពី Clipboard</Text></Pressable>
        <Pressable disabled={loading} onPress={() => void verifyCode()} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}><Animated.View style={{ transform: [{ rotate: loadingRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}><MaterialIcons name={loading ? "sync" : "verified-user"} size={18} color={COLORS.bg} /></Animated.View><Text style={styles.buttonText}>{loading ? "កំពុងផ្ទៀងផ្ទាត់…" : "ផ្ទៀងផ្ទាត់ Code"}</Text></Pressable>
        <Pressable disabled={loading || resendCooldown > 0} onPress={() => void resendCode()} style={({ pressed }) => [styles.resendButton, pressed && styles.pressed, (loading || resendCooldown > 0) && styles.disabled]}><MaterialIcons name="refresh" size={16} color={resendCooldown > 0 ? COLORS.muted : COLORS.green} /><Text style={[styles.resendText, resendCooldown > 0 && styles.resendDisabledText]}>{resendCooldown > 0 ? `ផ្ញើ Code ម្តងទៀតក្នុង ${resendCooldown} វិនាទី` : "ផ្ញើ Code ម្តងទៀត"}</Text></Pressable>
        <Pressable onPress={() => setStep("phone")} style={styles.secondaryButton}><Text style={styles.secondaryText}>ប្តូរលេខទូរសព្ទ៍</Text></Pressable>
      </> : <>
        <Animated.View style={[styles.success, { opacity: successOpacity, transform: [{ scale: successScale }] }]}><View style={styles.successIcon}><MaterialIcons name="check" size={22} color={COLORS.bg} /></View><Text style={styles.successText}>លេខទូរសព្ទ៍ Verify ជោគជ័យ</Text></Animated.View>
        <Text style={styles.help}>OTP ត្រូវបានផ្ទៀងផ្ទាត់នៅ backend ហើយ Login Session ត្រូវបានបង្កើត។</Text>
        <Pressable onPress={() => { setStep("phone"); setCode(""); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>សាកល្បងម្ដងទៀត</Text></Pressable>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: "#0D2118", borderWidth: 1, borderColor: "#2A744A" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#4ADE8018", alignItems: "center", justifyContent: "center" },
  languageButton: { paddingVertical: 7, paddingHorizontal: 9, borderRadius: 8, backgroundColor: "#173926", borderWidth: 1, borderColor: "#2A744A" },
  languageText: { color: COLORS.green, fontSize: 10, fontWeight: "900" },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  subtitle: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  notice: { flexDirection: "row", gap: 7, padding: 10, borderRadius: 10, backgroundColor: "#101C2A", marginBottom: 14 },
  noticeText: { flex: 1, color: "#BFD8F5", fontSize: 10, lineHeight: 16 },
  label: { color: COLORS.text, fontSize: 11, fontWeight: "800", marginBottom: 7 },
  input: { height: 46, borderRadius: 11, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.bg, color: COLORS.text, paddingHorizontal: 13, fontSize: 14 },
  codeInput: { letterSpacing: 8, textAlign: "center", fontWeight: "800" },
  help: { color: COLORS.muted, fontSize: 10, lineHeight: 16, marginTop: 7 },
  button: { marginTop: 13, height: 44, borderRadius: 11, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  buttonText: { color: COLORS.bg, fontSize: 12, fontWeight: "900" },
  secondaryButton: { alignItems: "center", paddingVertical: 12 },
  secondaryText: { color: COLORS.green, fontSize: 11, fontWeight: "800" },
  pasteButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 },
  pasteText: { color: COLORS.blue, fontSize: 11, fontWeight: "800" },
  resendButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9 },
  resendText: { color: COLORS.green, fontSize: 11, fontWeight: "800" },
  resendDisabledText: { color: COLORS.muted },
  success: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13, borderRadius: 11, backgroundColor: "#123A26" },
  successIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center" },
  successText: { color: COLORS.green, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  error: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 11, borderRadius: 10, backgroundColor: "#351A20", borderWidth: 1, borderColor: "#71333E", marginBottom: 12 },
  errorContent: { flex: 1, gap: 3 },
  errorTitle: { color: "#FFD2D2", fontSize: 12, fontWeight: "900" },
  errorText: { flex: 1, color: "#FFB5B5", fontSize: 11, lineHeight: 17 },
  errorAction: { alignSelf: "flex-start", marginTop: 5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: "#57242D" },
  errorActionText: { color: "#FFD2D2", fontSize: 10, fontWeight: "900" },
});
