import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";

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

export function PhoneLoginPanel() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [step, setStep] = useState<LoginStep>("phone");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("AWS SNS OTP · បញ្ចូលលេខទូរសព្ទ៍ដើម្បីទទួល SMS");

  const requestCode = async () => {
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      setNotice("សូមបញ្ចូលលេខទូរសព្ទ៍ជាទម្រង់អន្តរជាតិ ឧ. +85512345678");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/phone/request-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.trim() }) });
      const payload = await response.json() as { ok?: boolean; challengeId?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.challengeId) throw new Error(payload.error || "មិនអាចផ្ញើ SMS បានទេ");
      setChallengeId(payload.challengeId);
      setStep("code");
      setNotice("បានផ្ញើ Verify Code ទៅលេខទូរសព្ទ៍របស់អ្នក។ Code មានសុពលភាព 5 នាទី។");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "មិនអាចផ្ញើ SMS បានទេ");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setNotice("សូមបញ្ចូល Verify Code ចំនួន ៦ ខ្ទង់");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/phone/verify-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, code: code.trim() }) });
      const payload = await response.json() as { ok?: boolean; verified?: boolean; error?: string };
      if (!response.ok || !payload.ok || !payload.verified) throw new Error(payload.error || "Verify Code មិនត្រឹមត្រូវទេ");
      setStep("verified");
      setNotice("លេខទូរសព្ទ៍ត្រូវបានផ្ទៀងផ្ទាត់ជោគជ័យ។");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Verify Code មិនបានសម្រេចទេ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}><MaterialIcons name="person-outline" size={22} color={COLORS.green} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Login គណនី</Text><Text style={styles.subtitle}>Custom Backend · AWS SNS SMS OTP</Text></View>
      </View>
      <View style={styles.notice}><MaterialIcons name="info-outline" size={16} color={COLORS.blue} /><Text style={styles.noticeText}>{notice}</Text></View>
      {step === "phone" ? <>
        <Text style={styles.label}>លេខទូរសព្ទ៍</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" placeholder="+85512345678" placeholderTextColor={COLORS.muted} style={styles.input} />
        <Text style={styles.help}>ប្រើទម្រង់អន្តរជាតិ ដោយចាប់ផ្តើមពី + និង country code។</Text>
        <Pressable disabled={loading} onPress={() => void requestCode()} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}><MaterialIcons name={loading ? "sync" : "sms"} size={18} color={COLORS.bg} /><Text style={styles.buttonText}>{loading ? "កំពុងផ្ញើ…" : "ស្នើ Verify Code"}</Text></Pressable>
      </> : step === "code" ? <>
        <Text style={styles.label}>Verify Code សម្រាប់ {phone}</Text>
        <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor={COLORS.muted} style={[styles.input, styles.codeInput]} />
        <Pressable disabled={loading} onPress={() => void verifyCode()} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}><MaterialIcons name={loading ? "sync" : "verified-user"} size={18} color={COLORS.bg} /><Text style={styles.buttonText}>{loading ? "កំពុងផ្ទៀងផ្ទាត់…" : "ផ្ទៀងផ្ទាត់ Code"}</Text></Pressable>
        <Pressable onPress={() => setStep("phone")} style={styles.secondaryButton}><Text style={styles.secondaryText}>ប្តូរលេខទូរសព្ទ៍</Text></Pressable>
      </> : <>
        <View style={styles.success}><MaterialIcons name="check-circle" size={22} color={COLORS.green} /><Text style={styles.successText}>លេខទូរសព្ទ៍ Verify ជោគជ័យ</Text></View>
        <Text style={styles.help}>OTP ត្រូវបានផ្ទៀងផ្ទាត់នៅ backend។ ការបង្កើត app session អាចភ្ជាប់បន្ថែមជំហានបន្ទាប់។</Text>
        <Pressable onPress={() => { setStep("phone"); setCode(""); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>សាកល្បងម្ដងទៀត</Text></Pressable>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: "#0D2118", borderWidth: 1, borderColor: "#2A744A" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#4ADE8018", alignItems: "center", justifyContent: "center" },
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
  success: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13, borderRadius: 11, backgroundColor: "#123A26" },
  successText: { color: COLORS.green, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
});
