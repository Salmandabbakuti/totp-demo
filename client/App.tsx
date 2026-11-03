import { SyntheticEvent, useEffect, useState } from "react";

type Enrollment = {
  secret: string;
  uri: string;
  qrCode: string;
  label: string;
};

export default function App() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverCode, setServerCode] = useState("");
  const [codeReceivedAt, setCodeReceivedAt] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [sseConnected, setSseConnected] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [token, setToken] = useState("");
  const [verification, setVerification] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const createEnrollment = async () => {
    setError("");
    setLoading(true);
    setVerification(null);
    setToken("");
    setShowSecret(false);
    try {
      const response = await fetch("/api/enroll", { method: "POST" });
      if (!response.ok) throw new Error("Enrollment request failed");
      const result = (await response.json()) as Enrollment;
      setEnrollment(result);
    } catch {
      setError("Could not create enrollment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void createEnrollment();
  }, []);

  useEffect(() => {
    if (!enrollment) return;

    const events = new EventSource("/events/totp");
    events.onopen = () => setSseConnected(true);
    events.onerror = () => setSseConnected(false);
    const handleCode = (event: Event) => {
      const { code } = JSON.parse((event as MessageEvent<string>).data) as {
        code: string;
      };
      setServerCode(code);
      setCodeReceivedAt(Date.now());
    };
    events.addEventListener("message", handleCode);

    return () => {
      events.close();
      setSseConnected(false);
    };
  }, [enrollment]);

  useEffect(() => {
    if (codeReceivedAt === null) return;

    const updateProgress = () => {
      setProgress(
        Math.max(0, 100 - ((Date.now() - codeReceivedAt) / 30_000) * 100)
      );
    };
    updateProgress();
    const timer = window.setInterval(updateProgress, 100);
    return () => window.clearInterval(timer);
  }, [codeReceivedAt]);

  async function verifyCode(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setVerification(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (!response.ok) throw new Error("Verification request failed");
      const result = (await response.json()) as { ok: boolean };
      setVerification({
        valid: result.ok,
        message: result.ok
          ? "Code verified successfully"
          : "Invalid or expired code"
      });
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  async function copySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(
        "Clipboard access is unavailable. Reveal the secret to copy it manually."
      );
    }
  }

  return (
    <main className="shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="TOTP Playground">
          <span>TOTP</span>
          <i />
        </a>
      </header>

      <section className="intro">
        <div className="kicker">TIME-BASED ONE-TIME PASSWORD</div>
        <h1>
          One secret.
          <br />
          <span>Every 30 seconds.</span>
        </h1>
        <p>
          Explore how authenticator apps generate time-based codes, and how a
          server verifies them independently.
        </p>
      </section>

      <section className="panel setup-panel">
        <div className="section-heading">
          <div className="section-title">
            <i /> <h2>SETUP</h2>
          </div>
          <span className="section-index">01 / ENROLLMENT</span>
        </div>

        <div className="qr-area" aria-busy={loading}>
          {loading ? (
            <div
              className="qr-skeleton"
              role="status"
              aria-label="Loading enrollment"
            />
          ) : enrollment ? (
            <div className="qr-frame">
              <img src={enrollment.qrCode} alt="TOTP enrollment QR code" />
            </div>
          ) : (
            <p className="scan-copy">ENROLLMENT UNAVAILABLE</p>
          )}
          <p className="scan-copy">
            {loading
              ? "PREPARING YOUR SECRET"
              : enrollment
                ? "SCAN WITH YOUR AUTHENTICATOR"
                : "PLEASE TRY AGAIN"}
          </p>
          {!loading && enrollment && (
            <p className="muted small-copy">
              Google Authenticator · Microsoft Authenticator · 1Password
            </p>
          )}
        </div>

        {loading && (
          <div className="secret-skeleton" aria-hidden="true">
            <span />
            <span />
          </div>
        )}

        {!loading && !enrollment && (
          <button className="primary-button" onClick={createEnrollment}>
            TRY AGAIN <span>↗</span>
          </button>
        )}

        {!loading && enrollment && (
          <div className="secret-block">
            <div className="secret-toolbar">
              <label>
                MANUAL SECRET <span>· BASE32</span>
              </label>
              <button
                className="text-button"
                onClick={() => setShowSecret((value) => !value)}
              >
                {showSecret ? "HIDE SECRET" : "SHOW SECRET"}
              </button>
            </div>
            <div className="secret-value">
              <code>
                {showSecret ? enrollment.secret : "•••• •••• •••• ••••"}
              </code>
              <button
                className="copy-button"
                onClick={copySecret}
                aria-label="Copy secret"
                title="Copy secret"
              >
                {copied ? "✓" : "COPY"}
              </button>
            </div>
            <details className="uri-details">
              <summary>VIEW PROVISIONING URI</summary>
              <code>{enrollment.uri}</code>
            </details>
          </div>
        )}
      </section>

      <section className="panel verify-panel">
        <div className="section-heading">
          <div className="section-title">
            <i /> <h2>VERIFY</h2>
          </div>
          <div className="validation-info">
            <div className="section-index validation-index">
              <span
                className={`live-indicator ${sseConnected ? "connected" : ""}`}
                aria-label={sseConnected ? "SSE connected" : "SSE connecting"}
                title={sseConnected ? "SSE connected" : "SSE connecting"}
              >
                <i />
                {sseConnected ? "LIVE" : "WAIT"}
              </span>
              <code>{serverCode || "------"}</code>
              <span>02 / VALIDATION</span>
            </div>
            <div
              className="code-progress"
              role="progressbar"
              aria-label="Time remaining for server code"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <p className="panel-description">
          Open your authenticator app and enter the 6-digit code generated. Live
          code updates are displayed above for diagnosis. Real apps wont show
          that here(vibe-coded apps might though).
        </p>

        <form className="verify-form" onSubmit={verifyCode}>
          <label htmlFor="otp-code">AUTHENTICATOR CODE</label>
          <div className="verify-controls">
            <input
              id="otp-code"
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              value={token}
              onChange={(event) => {
                setToken(event.target.value.replace(/\D/g, "").slice(0, 6));
                setVerification(null);
                setError("");
              }}
              disabled={!enrollment}
            />
            <button
              className="verify-button"
              type="submit"
              disabled={!enrollment || token.length !== 6}
            >
              VERIFY <span>→</span>
            </button>
          </div>
        </form>
        {verification && (
          <div
            className={`result ${verification.valid ? "success" : "failure"}`}
            role="status"
          >
            <b>{verification.valid ? "✓" : "!"}</b>
            {verification.message}
          </div>
        )}
      </section>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <footer>
        <span className="footer-brand">
          TOTP <i />
        </span>
      </footer>
    </main>
  );
}
