import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const CODE_PATTERN = /^\d{6}$/;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type Challenge = { phone: string; hash: string; expiresAt: number; attempts: number };
const challenges = new Map<string, Challenge>();
let snsClient: SNSClient | null = null;

function hashCode(challengeId: string, code: string) {
  return crypto.createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
}

function jsonError(res: Response, status: number, error: string) {
  res.status(status).json({ ok: false, error });
}

function getSnsClient() {
  if (snsClient) return snsClient;
  const region = process.env.AWS_REGION;
  if (!region) throw new Error("AWS_REGION is not configured");
  snsClient = new SNSClient({
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    } : undefined,
  });
  return snsClient;
}

async function sendSms(phone: string, code: string) {
  const messageAttributes = process.env.AWS_SNS_SMS_TYPE ? {
    "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: process.env.AWS_SNS_SMS_TYPE },
  } : undefined;
  await getSnsClient().send(new PublishCommand({
    Message: `SkillNext verification code: ${code}. It expires in 5 minutes.`,
    PhoneNumber: phone,
    MessageAttributes: messageAttributes,
  }));
}

/**
 * Custom backend contract for phone OTP. This scaffold never returns an OTP code.
 * This implementation uses AWS SNS. Credentials must be server-side environment variables.
 */
export function registerPhoneOtpRoutes(app: Express) {
  app.post("/api/auth/phone/request-code", async (req: Request, res: Response) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    if (!PHONE_PATTERN.test(phone)) {
      jsonError(res, 400, "Phone number must use international format, for example +85512345678");
      return;
    }

    // Do not silently create a fake login flow on the server.
    if (process.env.OTP_PROVIDER !== "aws-sns") {
      jsonError(res, 503, "AWS SNS OTP is not configured. Set OTP_PROVIDER=aws-sns and AWS credentials on the server.");
      return;
    }

    const challengeId = crypto.randomUUID();
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    challenges.set(challengeId, { phone, hash: hashCode(challengeId, code), expiresAt: Date.now() + CHALLENGE_TTL_MS, attempts: 0 });

    try {
      await sendSms(phone, code);
      res.json({ ok: true, challengeId, expiresInSeconds: CHALLENGE_TTL_MS / 1000 });
    } catch (error) {
      challenges.delete(challengeId);
      console.error("[OTP] AWS SNS send failed", error instanceof Error ? error.message : String(error));
      jsonError(res, 502, "មិនអាចផ្ញើ SMS បានទេ។ ពិនិត្យ AWS SNS configuration និង SMS permissions។");
    }
  });

  app.post("/api/auth/phone/verify-code", async (req: Request, res: Response) => {
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
    try {
      const phoneHash = crypto.createHash("sha256").update(challenge.phone).digest("hex").slice(0, 32);
      const openId = `phone_${phoneHash}`;
      const signedInAt = new Date();
      await upsertUser({ openId, name: challenge.phone, email: null, loginMethod: "phone", lastSignedIn: signedInAt });
      const user = await getUserByOpenId(openId);
      const sessionToken = await sdk.createSessionToken(openId, { name: user?.name || challenge.phone, expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ ok: true, verified: true, phone: challenge.phone, sessionToken, user: { openId, name: user?.name || challenge.phone, loginMethod: "phone" } });
    } catch (error) {
      console.error("[OTP] Session creation failed", error instanceof Error ? error.message : String(error));
      jsonError(res, 500, "បាន Verify Code ប៉ុន្តែមិនអាចបង្កើត Login Session បានទេ។ ពិនិត្យ database និង JWT_SECRET។");
    }
  });
}
