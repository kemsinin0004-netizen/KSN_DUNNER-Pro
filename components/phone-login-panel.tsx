import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
  const [step, setStep] = useState<LoginStep>("phone");
  const [notice, setNotice] = useState("UI Test Mode · មិនទាន់ផ្ញើ SMS ពិតប្រាកដ");

  const requestCode = () => {
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      setNotice("សូមបញ្ចូលលេខទូរសព្ទ៍ជាទម្រង់អន្តរជាតិ ឧ. +85512345678");
      return;
    }
    setStep("code");
    setNotice("UI Test Mode: ផ្ទាំង Verify Code ត្រូវបានបើក។ មិនទាន់មាន SMS ពិតប្រាកដទេ។");
  };

  const verifyCode = () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setNotice("សូមបញ្ចូល Verify Code ចំនួន ៦ ខ្ទង់");
      return;
    }
    setStep("verified");
    setNotice("UI Test Mode: ទម្រង់ Code ត្រឹមត្រូវ។ មិនទាន់បង្កើត Login Session ទេ។");
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}><MaterialIcons name="person-outline" size={22} color={COLORS.green} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Login គណនី</Text><Text style={styles.subtitle}>Firebase Phone Authentication · UI Test Mode</Text></View>
      </View>
      <View style={styles.notice}><MaterialIcons name="info-outline" size={16} color={COLORS.blue} /><Text style={styles.noticeText}>{notice}</Text></View>
      {step === "phone" ? <>
        <Text style={styles.label}>លេខទូរសព្ទ៍</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" placeholder="+85512345678" placeholderTextColor={COLORS.muted} style={styles.input} />
        <Text style={styles.help}>ប្រើទម្រង់អន្តរជាតិ ដោយចាប់ផ្តើមពី + និង country code។</Text>
        <Pressable onPress={requestCode} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><MaterialIcons name="sms" size={18} color={COLORS.bg} /><Text style={styles.buttonText}>ស្នើ Verify Code</Text></Pressable>
      </> : step === "code" ? <>
        <Text style={styles.label}>Verify Code សម្រាប់ {phone}</Text>
        <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor={COLORS.muted} style={[styles.input, styles.codeInput]} />
        <Pressable onPress={verifyCode} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><MaterialIcons name="verified-user" size={18} color={COLORS.bg} /><Text style={styles.buttonText}>ផ្ទៀងផ្ទាត់ Code</Text></Pressable>
        <Pressable onPress={() => setStep("phone")} style={styles.secondaryButton}><Text style={styles.secondaryText}>ប្តូរលេខទូរសព្ទ៍</Text></Pressable>
      </> : <>
        <View style={styles.success}><MaterialIcons name="check-circle" size={22} color={COLORS.green} /><Text style={styles.successText}>UI Flow បានបញ្ចប់ដោយជោគជ័យ</Text></View>
        <Text style={styles.help}>នៅពេលភ្ជាប់ Firebase ពិតប្រាកដ ទើបបង្កើត user session បន្ទាប់ពី verification។</Text>
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
});
