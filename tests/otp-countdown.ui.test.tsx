import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  getCooldownProgress,
  getNextCooldown,
  getOtpResendUiState,
  isResendDisabled,
} from "../lib/otp-countdown";

describe("OTP resend countdown UI state", () => {
  it("renders Khmer countdown and disables resend during the full cooldown", () => {
    const ui = getOtpResendUiState(60, false, "km");

    expect(ui.countdown).toBe("01:00");
    expect(ui.label).toContain("01:00");
    expect(ui.buttonLabel).toBe("រង់ចាំមុនស្នើម្ដងទៀត");
    expect(ui.disabled).toBe(true);
    expect(ui.progress).toBe(0);
  });

  it("renders English countdown and enables resend at zero", () => {
    const ui = getOtpResendUiState(0, false, "en");

    expect(ui.countdown).toBe("00:00");
    expect(ui.label).toBe("You can request a new OTP");
    expect(ui.buttonLabel).toBe("Resend OTP");
    expect(ui.disabled).toBe(false);
    expect(ui.progress).toBe(1);
  });

  it("keeps the resend button disabled while an OTP request is loading", () => {
    const ui = getOtpResendUiState(0, true, "en");

    expect(ui.disabled).toBe(true);
    expect(ui.buttonLabel).toBe("Resend OTP");
  });

  it("updates countdown and progress as one second elapses", () => {
    const ui = getOtpResendUiState(getNextCooldown(60), false, "km");

    expect(ui.countdown).toBe("00:59");
    expect(ui.progress).toBeCloseTo(1 / 60);
    expect(ui.disabled).toBe(true);
  });

  it("clamps progress and countdown at their safe boundaries", () => {
    expect(formatCountdown(9)).toBe("00:09");
    expect(formatCountdown(-2)).toBe("00:00");
    expect(getCooldownProgress(120)).toBe(0);
    expect(getCooldownProgress(-1)).toBe(1);
    expect(getNextCooldown(0)).toBe(0);
    expect(isResendDisabled(1, false)).toBe(true);
    expect(isResendDisabled(0, true)).toBe(true);
    expect(isResendDisabled(0, false)).toBe(false);
  });
});
