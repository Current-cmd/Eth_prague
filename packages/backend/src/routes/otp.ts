import type { FastifyPluginAsync } from "fastify";
import nodemailer from "nodemailer";
import { db } from "../services/db.js";
import { keccak256, toBytes } from "viem";

const OTP_TTL_SECS = 600;

// Set DEMO_OTP=123456 in .env to use a fixed code (skips real OTP check).
// If not set, a random 6-digit code is generated each time.
const DEMO_OTP = process.env.DEMO_OTP ?? null;

function genOtp(): string {
  return DEMO_OTP ?? String(Math.floor(100000 + Math.random() * 900000));
}

function domainHashFor(email: string): `0x${string}` {
  const domain = email.split("@")[1] ?? email;
  return keccak256(toBytes(domain));
}

function nullifierFor(email: string): `0x${string}` {
  return keccak256(toBytes(email));
}

async function trySendEmail(to: string, otp: string, ensName: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    // No SMTP configured — log to console so the demo can proceed
    console.log(`\n[OTP] ${to} → ${otp}  (no SMTP configured, code printed here)\n`);
    return;
  }

  const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass: pass.replace(/\s/g, "") } });
  await transport.sendMail({
    from: `"ShieldPass" <${user}>`,
    to,
    subject: `Your ShieldPass verification code — ${ensName}`,
    text: [
      `Your ShieldPass one-time code is:`,
      ``,
      `  ${otp}`,
      ``,
      `This code expires in 10 minutes.`,
      `Company: ${ensName}`,
      ``,
      `If you did not request this, ignore this email.`,
    ].join("\n"),
  });
}

export const otpRoute: FastifyPluginAsync = async (app) => {
  // POST /v1/auth/otp/request
  app.post<{ Body: { email: string; ensName: string } }>(
    "/auth/otp/request",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "ensName"],
          properties: {
            email: { type: "string" },
            ensName: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, ensName } = req.body;
      if (!email.includes("@")) return reply.code(400).send({ error: "invalid email" });

      const otp = genOtp();
      const expiresAt = Math.floor(Date.now() / 1000) + OTP_TTL_SECS;

      db.prepare("INSERT INTO email_otps (email, otp, expires_at) VALUES (?, ?, ?)").run(email, otp, expiresAt);

      // Best-effort send — never block the response on SMTP failure
      trySendEmail(email, otp, ensName).catch((e) =>
        console.warn("[OTP] email send failed:", e.message, `| code: ${otp}`)
      );

      return reply.send({ ok: true });
    }
  );

  // POST /v1/auth/otp/verify
  app.post<{ Body: { email: string; otp: string; ensName: string } }>(
    "/auth/otp/verify",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "otp", "ensName"],
          properties: {
            email: { type: "string" },
            otp: { type: "string" },
            ensName: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, otp } = req.body;
      const now = Math.floor(Date.now() / 1000);

      // DEMO_OTP bypass: any code matches when a fixed code is configured
      if (DEMO_OTP) {
        if (otp !== DEMO_OTP) return reply.code(401).send({ error: "wrong code" });
        // Mark any pending OTP for this email as used
        db.prepare("UPDATE email_otps SET used = 1 WHERE email = ? AND used = 0").run(email);
      } else {
        const row = db
          .prepare("SELECT id, otp FROM email_otps WHERE email = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1")
          .get(email, now) as { id: number; otp: string } | undefined;

        if (!row || row.otp !== otp) return reply.code(401).send({ error: "invalid or expired code" });
        db.prepare("UPDATE email_otps SET used = 1 WHERE id = ?").run(row.id);
      }

      return reply.send({
        ok: true,
        domainHash: domainHashFor(email),
        nullifier: nullifierFor(email),
      });
    }
  );
};
