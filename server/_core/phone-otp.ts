import type { Express, Request, Response } from "express";
import crypto from "node:crypto";

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const CODE_PATTERN = /^\d{6}$/;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type Challenge = { phone: string; hash: string; expiresAt: number; attempts: number };
const challenges = new Map<string, Challenge>();

function hashCode(challengeId: string, code: string) {
  return crypto.createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
}

function jsonError(res: Response, status: number, error: string) {
  res.status(status).json({ ok: false, error });
}

/**
 * Custom backend contract for phone OTP. This scaffold never returns an OTP code.
 * Connect sendSms() to Firebase Admin, Twilio, or another SMS provider before enabling production use.
 */
export function registerPhoneOtpRoutes(app: Express) {
  app.post("/api/auth/phone/request-code", async (req: Request, res: Response) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    if (!PHONE_PATTERN.test(phone)) {
      jsonError(res, 400, "Phone number must use international format, for example +85512345678");
      return;
    }

    // Do not silently create a fake login flow on the server.
    if (process.env.OTP_PROVIDER !== "firebase-admin" && process.env.OTP_PROVIDER !== "custom") {
      jsonError(res, 503, "OTP provider is not configured. Set OTP_PROVIDER and connect sendSms() first.");
      return;
    }

    const challengeId = crypto.randomUUID();
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    challenges.set(challengeId, { phone, hash: hashCode(challengeId, code), expiresAt: Date.now() + CHALLENGE_TTL_MS, attempts: 0 });

    // TODO: send code through the configured provider. Never log or return `code`.
    // await sendSms(phone, `Your SkillNext verification code is ${code}`);
    res.status(501).json({ ok: false, error: "SMS provider adapter is not implemented yet", challengeId });
  });

  app.post("/api/auth/phone/verify-code", (req: Request, res: Response) => {
    const challengeId = typeof req.body?.challengeId === "string" ? req.body.challengeId : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!challengeId || !CODE_PATTERN.test(code)) {
      jsonError(res, 400, "challengeId and a 6-digit code are required");
      return;
    }
    const challenge = challenges.get(challengeId);
    if (!challenge || challenge.expiresAt < Date.now()) {
      challenges.delete(challengeId);
      jsonError(res, 410, "Verification challenge expired");
      return;
    }
    if (challenge.attempts >= 5) {
      challenges.delete(challengeId);
      jsonError(res, 429, "Too many verification attempts");
      return;
    }
    challenge.attempts += 1;
    if (hashCode(challengeId, code) !== challenge.hash) {
      jsonError(res, 401, "Invalid verification code");
      return;
    }
    challenges.delete(challengeId);
    // TODO: create the app session only after provider verification succeeds.
    res.json({ ok: true, verified: true, phone: challenge.phone, session: null });
  });
}
