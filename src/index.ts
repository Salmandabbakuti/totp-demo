import { serve } from "bun";
import { generateSecret, generateURI, verify, generate } from "otplib";
import QRCode from "qrcode";
import homepage from "../client/index.html";

// Deliberately in-memory: this is a single-user local prototype.
let activeSecret = generateSecret();
const activeLabel = "demo@example.com";

const handleEnroll = async () => {
  try {
    const uri = generateURI({
      issuer: "TOTP Playground",
      label: activeLabel,
      secret: activeSecret
    });
    const qrCode = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240
    });

    return Response.json({
      secret: activeSecret,
      uri,
      qrCode,
      label: activeLabel
    });
  } catch (err) {
    return Response.json(
      {
        code: "Internal server error",
        error: err instanceof Error ? err.message : "Unknown error"
      },
      { status: 500 }
    );
  }
};

const handleVerify = async (req: Request) => {
  try {
    const { token } = (await req.json()) as { token: string };
    if (!token) throw new Error("Missing token in request body");
    const result = await verify({ secret: activeSecret, token });
    return Response.json({ ok: result.valid });
  } catch (err) {
    return Response.json(
      {
        code: "Internal server error",
        error: err instanceof Error ? err.message : "Unknown error"
      },
      { status: 500 }
    );
  }
};

const server = serve({
  routes: {
    "/": homepage,
    "/api/enroll": {
      POST: handleEnroll
    },
    "/api/verify": {
      POST: handleVerify
    },
    "/events/totp": {
      GET: (req, server) => {
        // Set timeout to 0 to keep the connection open indefinitely (ideal 10s)
        server.timeout(req, 0);
        return new Response(
          async function* () {
            while (true) {
              const code = await generate({ secret: activeSecret });

              yield `data: ${JSON.stringify({ code })}\n\n`;

              // Wait until the next 30-second TOTP boundary
              const nextBoundary =
                (Math.floor(Date.now() / 30_000) + 1) * 30_000;

              await Bun.sleep(nextBoundary - Date.now());
            }
          },
          {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no"
            }
          }
        );
      }
    }
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  }
});

console.log(`TOTP Playground running at ${server.url}`);
