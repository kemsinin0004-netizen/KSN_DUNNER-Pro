export const RESEND_COOLDOWN_SECONDS = 60;

export type OtpResendLanguage = "km" | "en";

export function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function getCooldownProgress(seconds: number, total = RESEND_COOLDOWN_SECONDS): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - Math.max(0, seconds) / total));
}

export function isResendDisabled(seconds: number, loading: boolean): boolean {
  return loading || seconds > 0;
}

export function getNextCooldown(seconds: number): number {
  return Math.max(0, Math.floor(seconds) - 1);
}

export function getOtpResendUiState(seconds: number, loading: boolean, language: OtpResendLanguage) {
  const disabled = isResendDisabled(seconds, loading);
  const countdown = formatCountdown(seconds);
  return {
    disabled,
    countdown,
    progress: getCooldownProgress(seconds),
    label: seconds > 0
      ? language === "km" ? `អាចស្នើ OTP ម្ដងទៀតក្នុង ${countdown}` : `Request another OTP in ${countdown}`
      : language === "km" ? "អាចស្នើ OTP ថ្មីបាន" : "You can request a new OTP",
    buttonLabel: seconds > 0
      ? language === "km" ? "រង់ចាំមុនស្នើម្ដងទៀត" : "Wait before requesting again"
      : language === "km" ? "ផ្ញើ Code ម្តងទៀត" : "Resend OTP",
  };
}
