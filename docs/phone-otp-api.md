# SkillNext Phone OTP Authentication API

**Version:** 1.0  
**Status:** Implemented  
**Audience:** Mobile-app developers, backend developers, QA engineers, and deployment administrators

## 1. Overview

SkillNext provides a provider-backed phone authentication flow with two API operations. The client first requests a one-time password (OTP) through AWS Simple Notification Service (AWS SNS). The client then submits the six-digit code for verification. When verification succeeds, the backend creates or updates the phone user and issues a signed login session.

The backend stores only a SHA-256 hash of the OTP. It does not return or log the plaintext OTP. Each OTP challenge expires after five minutes and permits a maximum of five verification attempts.

> **Security rule:** AWS credentials, `JWT_SECRET`, and database credentials must remain on the backend. Never place them in the APK, Expo public variables, or mobile source code.

## 2. Base URL

The mobile application resolves the API base URL in this order:

1. `EXPO_PUBLIC_API_BASE_URL`, when configured.
2. On web preview, the hostname derived by replacing the Metro port prefix `8081-` with the API prefix `3000-`.
3. A relative URL fallback.

For examples below, replace `{API_BASE_URL}` with the deployed backend URL. Do not include a trailing slash.

```text
{API_BASE_URL}/api/auth/phone/request-code
{API_BASE_URL}/api/auth/phone/verify-code
```

## 3. Authentication Flow

| Step | Client action | Server result |
|---|---|---|
| 1 | Submit an E.164 phone number | Creates a challenge and sends an SMS through AWS SNS |
| 2 | Receive the SMS | Contains a six-digit OTP that expires in five minutes |
| 3 | Submit `challengeId` and the six-digit OTP | Verifies the hash and attempt limit |
| 4 | Verification succeeds | Provisions the phone user and creates a signed session |
| 5 | Store the session | Web uses the HTTP cookie; native clients store the returned token securely |

The client may implement a 60-second resend cooldown. The current backend challenge is replaced when a new request succeeds, so the mobile client must use the latest `challengeId`.

## 4. Request OTP

### Endpoint

```http
POST /api/auth/phone/request-code
Content-Type: application/json
```

### Request body

```json
{
  "phone": "+85512345678"
}
```

The `phone` field must use international E.164-style formatting. The current server validation requires a leading `+`, a first digit from `1` through `9`, and a total length of 8 to 15 digits after the plus sign.

### Successful response

**HTTP 200 OK**

```json
{
  "ok": true,
  "challengeId": "2f5d2f8f-4f6a-4ad7-9539-54f13e2a6e55",
  "expiresInSeconds": 300
}
```

The client must retain `challengeId` in memory and send it with the verification request. The server does not return the OTP value.

### Error responses

| HTTP status | Meaning | Example response |
|---:|---|---|
| 400 | Phone number is missing or invalid | `{ "ok": false, "error": "Phone number must use international format, for example +85512345678" }` |
| 503 | AWS SNS provider is not enabled | `{ "ok": false, "error": "AWS SNS OTP is not configured. Set OTP_PROVIDER=aws-sns and AWS credentials on the server." }` |
| 502 | AWS SNS rejected or failed to deliver the message | `{ "ok": false, "error": "មិនអាចផ្ញើ SMS បានទេ។ ពិនិត្យ AWS SNS configuration និង SMS permissions។" }` |

### cURL example

```bash
curl -X POST "$API_BASE_URL/api/auth/phone/request-code" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+85512345678"}'
```

## 5. Verify OTP and Create Session

### Endpoint

```http
POST /api/auth/phone/verify-code
Content-Type: application/json
```

For web clients, include credentials so the response cookie is accepted:

```javascript
fetch(`${API_BASE_URL}/api/auth/phone/verify-code`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ challengeId, code }),
});
```

### Request body

```json
{
  "challengeId": "2f5d2f8f-4f6a-4ad7-9539-54f13e2a6e55",
  "code": "123456"
}
```

The `code` field must contain exactly six decimal digits. OTP input may be typed or pasted in the mobile application. The client can automatically submit once six digits are available, but it must still prevent duplicate requests while verification is in progress.

### Successful response

**HTTP 200 OK**

```json
{
  "ok": true,
  "verified": true,
  "phone": "+85512345678",
  "sessionToken": "<signed-session-token>",
  "user": {
    "openId": "phone_4e0c7c1a9a0f2f8f2c9e7e5c0e1a6b4d",
    "name": "+85512345678",
    "loginMethod": "phone"
  }
}
```

The backend also sets the `app_session_id` HTTP cookie for web clients. The session token is signed by the server and has a one-year lifetime according to the current implementation. Native clients must store it with platform-secure storage, such as Android Keystore-backed SecureStore, rather than ordinary plaintext storage.

### Error responses

| HTTP status | Meaning | Client action |
|---:|---|---|
| 400 | Missing `challengeId` or code is not exactly six digits | Ask the user to enter a six-digit code |
| 401 | Code does not match | Show an invalid-code message and allow another attempt |
| 410 | Challenge expired or does not exist | Ask the user to request a new code |
| 429 | Five verification attempts were used | Discard the challenge and request a new code |
| 500 | OTP was valid but user/session creation failed | Keep the user signed out and report a server configuration problem |

Example invalid-code response:

```json
{
  "ok": false,
  "error": "Invalid verification code"
}
```

Example expired-challenge response:

```json
{
  "ok": false,
  "error": "Verification challenge expired"
}
```

### cURL example

```bash
curl -i -c cookies.txt \
  -X POST "$API_BASE_URL/api/auth/phone/verify-code" \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"2f5d2f8f-4f6a-4ad7-9539-54f13e2a6e55","code":"123456"}'
```

## 6. Session Behavior

After a successful verification, the server derives a deterministic phone-user identifier from a SHA-256 hash of the normalized phone number. The identifier is prefixed with `phone_`. The server then upserts the user with `loginMethod: "phone"` and updates `lastSignedIn`.

The session is created through the existing application session service. The session payload contains the phone user identifier, application identifier, and display name. The web response sets the `app_session_id` cookie. The native response includes `sessionToken`, which the mobile client stores securely.

The OTP challenge is deleted after successful verification. A previously verified code cannot be reused.

## 7. Backend Configuration

Set the following values on the backend deployment environment:

```env
OTP_PROVIDER=aws-sns
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=replace-with-server-secret
AWS_SECRET_ACCESS_KEY=replace-with-server-secret
# Optional when using temporary AWS credentials
AWS_SESSION_TOKEN=replace-with-server-secret
# Optional; Transactional is recommended for OTP messages
AWS_SNS_SMS_TYPE=Transactional
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=mysql://user:password@host:3306/database
```

The server requires `OTP_PROVIDER=aws-sns` before it will send a message. `AWS_REGION` is required by the AWS SDK. Static AWS credentials are optional when the hosting environment supplies an approved IAM role or another supported credential provider.

The IAM principal should follow least privilege. The current adapter publishes directly through SNS and therefore requires `sns:Publish`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "*"
    }
  ]
}
```

Before production release, configure AWS SMS spending limits, sender/origination requirements, and destination-country compliance. AWS may require additional SMS registration or origination configuration depending on the destination country.

## 8. Mobile Client Behavior

The mobile client should clear the OTP field when a new challenge is issued. It should start a 60-second resend cooldown after every successful request. It should use only the newest `challengeId` after a resend.

The OTP input should accept numeric characters only and limit the value to six digits. Auto-focus may be applied when the code screen opens. A paste action should be user-triggered. After a six-digit value is typed or pasted, the client may submit automatically and must disable duplicate submission until the request finishes.

A successful verification should show a short success animation before navigating to the home screen. An invalid, expired, or rate-limited response should remain on the code screen and present an actionable Khmer error message.

## 9. Recommended Error Mapping for Khmer UI

| API condition | Recommended Khmer message |
|---|---|
| Invalid phone | `សូមបញ្ចូលលេខទូរសព្ទ៍ជាទម្រង់អន្តរជាតិ ឧ. +85512345678` |
| Invalid OTP | `កូដ OTP មិនត្រឹមត្រូវទេ។ សូមពិនិត្យសារ SMS ហើយបញ្ចូលម្ដងទៀត។` |
| Expired OTP | `កូដ OTP បានផុតកំណត់។ សូមស្នើកូដថ្មី។` |
| Too many attempts | `អ្នកបានបញ្ចូលខុសច្រើនដង។ សូមស្នើកូដថ្មី ហើយព្យាយាមម្ដងទៀត។` |
| SMS provider failure | `ប្រព័ន្ធផ្ញើ SMS មានបញ្ហា។ សូមព្យាយាមម្ដងទៀត។` |
| Session creation failure | `បាន Verify Code ប៉ុន្តែមិនអាចបង្កើត Login Session បានទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រង។` |

The UI should not expose AWS error details, access-key identifiers, database errors, or stack traces to end users. Detailed provider errors belong in protected server logs.

## 10. Test Plan

| Test | Expected result |
|---|---|
| Submit a valid E.164 phone number with AWS configured | HTTP 200, `challengeId`, and `expiresInSeconds: 300` |
| Submit a malformed phone number | HTTP 400; no SMS is sent |
| Submit a valid six-digit code | HTTP 200, session cookie, and session token |
| Submit an incorrect code | HTTP 401; attempt count increases |
| Submit the same incorrect code five times | HTTP 429; challenge is deleted |
| Submit an expired challenge | HTTP 410; challenge is deleted |
| Submit a code with letters or fewer than six digits | HTTP 400; verification does not run |
| Disable AWS configuration | HTTP 503; no challenge is sent |
| Make AWS SNS reject the publish operation | HTTP 502; temporary challenge is removed |
| Verify the same valid code twice | First request succeeds; second request returns HTTP 410 |
| Verify with a database or JWT configuration failure | HTTP 500; user remains unauthenticated |

For local testing, use a real test phone number only when AWS SMS spending and compliance settings permit it. Never commit real phone numbers, OTP values, access keys, secret keys, or session tokens to source control.

## 11. Operational and Security Notes

The current challenge store is an in-memory `Map`. It is appropriate for a single backend process and development testing. A multi-instance production deployment should move challenge records to a shared store with TTL support, such as Redis or a database table, so that request and verification can reach different instances safely.

The API should be protected by IP and phone-number rate limits in addition to the five-attempt challenge limit. Resend cooldown in the mobile UI improves user experience but is not a security control because a malicious client can call the API directly.

Production logs should record request identifiers, status codes, and provider failure categories without recording OTP values, AWS secret material, session tokens, or unnecessary full phone numbers. Consider masking phone numbers in operational logs.

## 12. Source Implementation

The current implementation is located in:

```text
server/_core/phone-otp.ts
components/phone-login-panel.tsx
constants/oauth.ts
lib/_core/auth.ts
```

The AWS deployment notes are maintained in [`aws-sns-otp.md`](./aws-sns-otp.md).

## References

[1]: https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html "Publishing an SMS message using Amazon SNS"

[2]: https://docs.aws.amazon.com/sns/latest/dg/sms_manage.html "Managing SMS messages in Amazon SNS"

[3]: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html "Security best practices in IAM"

[4]: https://docs.aws.amazon.com/sns/latest/dg/sms_sending-overview.html "Sending SMS messages with Amazon SNS"

[5]: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_sns_code_examples.html "AWS SDK for JavaScript v3 Amazon SNS code examples"

## Author

**Manus AI**

**Last updated:** 2026-09-12

> This document describes the current SkillNext implementation. Review the backend source and deployment environment before using it as a public contract.

[1] [2] [3] [4] [5]
