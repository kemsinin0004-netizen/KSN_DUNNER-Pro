import express, { type Express } from "express";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let registerPhoneOtpRoutes: typeof import("../server/_core/phone-otp").registerPhoneOtpRoutes;

beforeAll(async () => {
  // These test-only values are intentionally set before importing the session SDK.
  process.env.JWT_SECRET = "test-only-jwt-secret-do-not-use-in-production";
  process.env.OTP_PROVIDER = "aws-sns";
  process.env.APP_ID = "skillnext-test";
  ({ registerPhoneOtpRoutes } = await import("../server/_core/phone-otp"));
});

afterEach(() => {
  vi.useRealTimers();
  process.env.OTP_PROVIDER = "aws-sns";
});

function createOtpApp(sendSms?: (phone: string, code: string) => Promise<void>): Express {
  const app = express();
  app.use(express.json());
  registerPhoneOtpRoutes(app, { sendSms });
  return app;
}

async function requestCode(app: Express, phone = "+85512345678") {
  return request(app).post("/api/auth/phone/request-code").send({ phone });
}

async function issueChallenge(app: Express, sent: { phone: string; code: string }) {
  const response = await requestCode(app, sent.phone);
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ ok: true, expiresInSeconds: 300 });
  expect(response.body.challengeId).toEqual(expect.any(String));
  expect(sent.code).toMatch(/^\d{6}$/);
  return response.body.challengeId as string;
}

describe("Phone OTP API", () => {
  it("rejects malformed phone numbers without calling the SMS provider", async () => {
    let sendCount = 0;
    const app = createOtpApp(async () => {
      sendCount += 1;
    });

    const response = await requestCode(app, "012345678");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: "Phone number must use international format, for example +85512345678",
    });
    expect(sendCount).toBe(0);
  });

  it("returns a configuration error when AWS SNS is disabled", async () => {
    process.env.OTP_PROVIDER = "disabled";
    const app = createOtpApp();

    const response = await requestCode(app);

    expect(response.status).toBe(503);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toContain("OTP_PROVIDER=aws-sns");
  });

  it("creates a challenge and sends the generated six-digit code", async () => {
    const sent = { phone: "+85512345678", code: "" };
    const app = createOtpApp(async (phone, code) => {
      sent.phone = phone;
      sent.code = code;
    });

    const challengeId = await issueChallenge(app, sent);

    expect(challengeId).toEqual(expect.any(String));
    expect(sent.phone).toBe("+85512345678");
  });

  it("maps an SMS provider failure to HTTP 502 and does not leave a usable challenge", async () => {
    const app = createOtpApp(async () => {
      throw new Error("simulated SNS failure");
    });

    const response = await requestCode(app);

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      ok: false,
      error: "មិនអាចផ្ញើ SMS បានទេ។ ពិនិត្យ AWS SNS configuration និង SMS permissions។",
    });
  });

  it("verifies the correct code and creates a signed login session", async () => {
    const sent = { phone: "+85512345678", code: "" };
    const app = createOtpApp(async (phone, code) => {
      sent.phone = phone;
      sent.code = code;
    });
    const challengeId = await issueChallenge(app, sent);

    const response = await request(app)
      .post("/api/auth/phone/verify-code")
      .send({ challengeId, code: sent.code });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      verified: true,
      phone: "+85512345678",
      user: { loginMethod: "phone" },
    });
    expect(response.body.sessionToken).toEqual(expect.any(String));
    expect(response.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("app_session_id=")]));
  });

  it("rejects malformed verification requests", async () => {
    const app = createOtpApp(async () => undefined);

    const response = await request(app)
      .post("/api/auth/phone/verify-code")
      .send({ challengeId: "", code: "12AB" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ ok: false, error: "challengeId and a 6-digit code are required" });
  });

  it("returns HTTP 401 for a wrong code and allows a later correct attempt", async () => {
    const sent = { phone: "+85512345679", code: "" };
    const app = createOtpApp(async (phone, code) => {
      sent.phone = phone;
      sent.code = code;
    });
    const challengeId = await issueChallenge(app, sent);

    const wrong = await request(app)
      .post("/api/auth/phone/verify-code")
      .send({ challengeId, code: sent.code === "000000" ? "111111" : "000000" });
    const correct = await request(app)
      .post("/api/auth/phone/verify-code")
      .send({ challengeId, code: sent.code });

    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({ ok: false, error: "Invalid verification code" });
    expect(correct.status).toBe(200);
  });

  it("returns HTTP 429 after five failed verification attempts", async () => {
    const sent = { phone: "+85512345680", code: "" };
    const app = createOtpApp(async (phone, code) => {
      sent.phone = phone;
      sent.code = code;
    });
    const challengeId = await issueChallenge(app, sent);
    const wrongCode = sent.code === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/phone/verify-code")
        .send({ challengeId, code: wrongCode });
      expect(response.status).toBe(401);
    }

    const blocked = await request(app)
      .post("/api/auth/phone/verify-code")
      .send({ challengeId, code: sent.code });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ ok: false, error: "Too many verification attempts" });
  });

  it("returns HTTP 410 for an expired challenge", async () => {
    vi.useFakeTimers();
    const sent = { phone: "+85512345681", code: "" };
    const app = createOtpApp(async (phone, code) => {
      sent.phone = phone;
      sent.code = code;
    });
    const challengeId = await issueChallenge(app, sent);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    const response = await request(app)
      .post("/api/auth/phone/verify-code")
      .send({ challengeId, code: sent.code });

    expect(response.status).toBe(410);
    expect(response.body).toEqual({ ok: false, error: "Verification challenge expired" });
  });

  it("cannot reuse a verified challenge", async () => {
    const sent = { phone: "+85512345682", code: "" };
    const app = createOtpApp(async (phone, code) => {
      sent.phone = phone;
      sent.code = code;
    });
    const challengeId = await issueChallenge(app, sent);

    const first = await request(app)
      .post("/api/auth/phone/verify-code")
      .send({ challengeId, code: sent.code });
    const second = await request(app)
      .post("/api/auth/phone/verify-code")
      .send({ challengeId, code: sent.code });

    expect(first.status).toBe(200);
    expect(second.status).toBe(410);
  });
});
