# TOTP Playground

A Bun + React demo for exploring time-based one-time passwords. Enrollment loads automatically when the page opens. Scan the QR code with an authenticator app, then enter its six-digit code to test server-side verification. The Verify card also shows the server-generated code and a countdown as a live diagnostic; real verification screens should never reveal the OTP.

## Run

```bash
bun install
bun run dev
```

Open http://localhost:3000.

## API

- `POST /api/enroll`: returns the fixed demo label, TOTP secret, provisioning URI, and QR code data URL.
- `POST /api/verify`: send `{"token":"123456"}`; responds with `{"ok":true}` for a valid code or `{"ok":false}` for an invalid or expired code.
- `GET /events/totp`: opens a Server-Sent Events stream. It sends the current server-generated code immediately, then updates on each 30-second TOTP boundary. The browser listens for the default SSE `message` event and displays its `code` value.

### Watch the SSE stream

```bash
curl -N http://localhost:3000/events/totp
```

Example output (the six-digit code changes every 30 seconds):

```text
data: {"code":"123456"}

data: {"code":"804219"}
```

### Verify a code

```bash
curl -X POST http://localhost:3000/api/verify \
  -H 'Content-Type: application/json' \
  -d '{"token":"123456"}'
```

```json
{ "ok": true }
```

## Defaults and limitations

The demo uses otplib defaults: SHA-1, six digits, a 30-second period, and a Base32 secret. The active secret is held in memory and shared by the single server process. Both the enrollment response and the diagnostic SSE stream expose it or its current OTP for learning purposes. This is not production authentication infrastructure; do not use a real account secret or deploy it as a 2FA service.
