# AWS SNS OTP configuration

The phone login flow uses the backend endpoints `/api/auth/phone/request-code` and `/api/auth/phone/verify-code`. The backend generates a six-digit code, stores only a SHA-256 hash with a five-minute expiry, sends the code through AWS SNS, and never returns or logs the code.

Set these variables on the backend server only:

```env
OTP_PROVIDER=aws-sns
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
# Optional for temporary credentials
AWS_SESSION_TOKEN=...
# Optional: Transactional or Promotional; Transactional is recommended for OTP
AWS_SNS_SMS_TYPE=Transactional
```

Use an IAM principal with the minimum permission required:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["sns:Publish"],
    "Resource": "*"
  }]
}
```

Before production use, configure AWS End User Messaging SMS spending limits and the appropriate origination identity for each destination country. Phone numbers must be in E.164 format, such as `+85512345678`. Do not put AWS credentials in the mobile app, Expo config, APK, or client-side environment variables.

The endpoint intentionally returns a configuration error until `OTP_PROVIDER=aws-sns` and valid server credentials are installed. After verification, the current response confirms the phone number but does not yet create an application session; connect that result to the project’s session/auth provider before treating the user as signed in.
