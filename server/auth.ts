/**
 * Self-contained authentication system for Redroom.
 * Email + password registration/login with JWT sessions.
 * No external OAuth providers — fully independent.
 */
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { getDb } from "./db";
import { activityLog, platformSettings, adminRegistrationRequests, keyHistory } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

const SALT_ROUNDS = 12;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting for auth endpoints (in-memory, resets on restart)
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = authAttempts.get(ip);
  if (!record || now > record.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (record.count >= MAX_ATTEMPTS_PER_HOUR) return false;
  record.count++;
  return true;
}

// Get the admin secret key from DB (falls back to env)
async function getAdminSecretKey(): Promise<string> {
  try {
    const drizzleDb = await getDb();
    if (!drizzleDb) return process.env.ADMIN_SECRET_KEY || "";
    const [setting] = await drizzleDb.select().from(platformSettings).where(eq(platformSettings.key, "admin_secret_key")).limit(1);
    return setting?.value || process.env.ADMIN_SECRET_KEY || "";
  } catch {
    return process.env.ADMIN_SECRET_KEY || "";
  }
}

// Check if the admin secret key has expired
async function isKeyExpired(): Promise<boolean> {
  try {
    const drizzleDb = await getDb();
    if (!drizzleDb) return false;
    const [expirySetting] = await drizzleDb.select().from(platformSettings).where(eq(platformSettings.key, "admin_key_expires_at")).limit(1);
    if (!expirySetting || expirySetting.value === "never") return false;
    const expiresAt = new Date(expirySetting.value);
    return Date.now() > expiresAt.getTime();
  } catch {
    return false;
  }
}

// Log activity to DB
async function logActivity(data: { userId?: number; userEmail?: string; userRole?: string; action: string; target?: string; details?: string; ipAddress?: string; userAgent?: string }) {
  try {
    const drizzleDb = await getDb();
    if (!drizzleDb) return;
    await drizzleDb.insert(activityLog).values(data);
  } catch { /* non-critical */ }
}

export function registerAuthRoutes(app: Express) {
  // ─── Register ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }

    const { email, password, name } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: "Invalid email format." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }
    if (password.length > 128) {
      res.status(400).json({ error: "Password too long." });
      return;
    }

    try {
      // Check if email already exists
      const existing = await db.getUserByEmail(email.toLowerCase().trim());
      if (existing) {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const openId = `local_${crypto.randomUUID()}`;

      await db.upsertUser({
        openId,
        name: name?.trim() || email.split("@")[0],
        email: email.toLowerCase().trim(),
        passwordHash,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name: name?.trim() || email.split("@")[0],
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Log registration
      await logActivity({
        userEmail: email.toLowerCase().trim(),
        userRole: "user",
        action: "auth.register",
        target: `user:${openId}`,
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || undefined,
      });

      res.status(201).json({ success: true, message: "Account created successfully." });
    } catch (error) {
      console.error("[Auth] Registration failed:", error);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  // ─── Login ────────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }

    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    try {
      const user = await db.getUserByEmail(email.toLowerCase().trim());
      if (!user || !user.passwordHash) {
        // Check if user has a pending registration request
        const drizzleDb = await getDb();
        if (drizzleDb) {
          const [pendingReq] = await drizzleDb.select().from(adminRegistrationRequests)
            .where(eq(adminRegistrationRequests.email, email.toLowerCase().trim()))
            .limit(1);
          if (pendingReq) {
            if (pendingReq.status === "pending") {
              res.status(403).json({ error: "Your registration is pending approval. The platform owner will review your request." });
              return;
            } else if (pendingReq.status === "rejected") {
              res.status(403).json({ error: "Your registration request was not approved." });
              return;
            }
          }
        }
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      // Update last signed in
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email.split("@")[0],
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Log login
      await logActivity({
        userId: user.id,
        userEmail: user.email || undefined,
        userRole: user.role,
        action: "auth.login",
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || undefined,
      });

      res.status(200).json({ success: true, message: "Login successful." });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  // ─── Admin Registration (Secret Key Gated → Pending Approval) ──────────────────
  app.post("/api/auth/admin-register", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }

    const { email, password, name, secretKey } = req.body;
    const usedKeyValue = secretKey; // Track which key was used for registration

    // Validate secret key against DB-stored value
    const validKey = await getAdminSecretKey();
    if (!secretKey || secretKey !== validKey) {
      // Return fake 404 to hide the endpoint
      res.status(404).json({ error: "Not found" });
      await logActivity({
        action: "auth.admin_register_failed",
        details: JSON.stringify({ reason: "invalid_key", email: email || "unknown" }),
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || undefined,
      });
      return;
    }

    // Check if key has expired
    const expired = await isKeyExpired();
    if (expired) {
      res.status(404).json({ error: "Not found" });
      await logActivity({
        action: "auth.admin_register_failed",
        details: JSON.stringify({ reason: "key_expired", email: email || "unknown" }),
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || undefined,
      });
      return;
    }

    // Standard validation
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: "Invalid email format." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    try {
      const drizzleDb = await getDb();
      if (!drizzleDb) {
        res.status(500).json({ error: "Database unavailable." });
        return;
      }

      // Check if email already has a pending request
      const [existingRequest] = await drizzleDb.select().from(adminRegistrationRequests)
        .where(eq(adminRegistrationRequests.email, email.toLowerCase().trim()))
        .limit(1);
      if (existingRequest && existingRequest.status === "pending") {
        res.status(200).json({ success: true, message: "Your request is already pending approval. You will be notified once reviewed.", pending: true });
        return;
      }

      // Check if email already exists as a user
      const existingUser = await db.getUserByEmail(email.toLowerCase().trim());
      if (existingUser) {
        if (existingUser.role === "admin") {
          res.status(200).json({ success: true, message: "This email already has admin access. Please login.", pending: false });
        } else {
          // Create pending request for promotion
          const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
          await drizzleDb.insert(adminRegistrationRequests).values({
            email: email.toLowerCase().trim(),
            name: name?.trim() || email.split("@")[0],
            passwordHash,
            status: "pending",
            ipAddress: ip,
            userAgent: req.headers["user-agent"] || undefined,
            usedKey: usedKeyValue || null,
          });
          // Increment key registration count in key_history
          if (usedKeyValue) {
            await drizzleDb.update(keyHistory)
              .set({ registrationCount: sql`${keyHistory.registrationCount} + 1` })
              .where(eq(keyHistory.keyValue, usedKeyValue));
          }
          res.status(201).json({ success: true, message: "Your admin access request has been submitted. Awaiting owner approval.", pending: true });
        }
        return;
      }

      // Create pending registration request
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await drizzleDb.insert(adminRegistrationRequests).values({
        email: email.toLowerCase().trim(),
        name: name?.trim() || email.split("@")[0],
        passwordHash,
        status: "pending",
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || undefined,
        usedKey: usedKeyValue || null,
      });

      // Increment key registration count in key_history
      if (usedKeyValue) {
        await drizzleDb.update(keyHistory)
          .set({ registrationCount: sql`${keyHistory.registrationCount} + 1` })
          .where(eq(keyHistory.keyValue, usedKeyValue));
      }

      await logActivity({
        userEmail: email.toLowerCase().trim(),
        action: "auth.admin_request_submitted",
        details: JSON.stringify({ name: name?.trim() || email.split("@")[0] }),
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || undefined,
      });

      // Notify owner about new pending request
      try {
        await notifyOwner({
          title: "📋 New Admin Registration Request",
          content: `A new admin registration request was submitted:\n\nEmail: ${email}\nName: ${name?.trim() || email.split("@")[0]}\nIP: ${ip}\nTime: ${new Date().toISOString()}\n\nReview it in the CMS → PENDING tab.`,
        });
      } catch { /* non-critical */ }

      res.status(201).json({ success: true, message: "Your admin access request has been submitted. Awaiting owner approval.", pending: true });
    } catch (error) {
      console.error("[Auth] Admin registration request failed:", error);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  // ─── Validate Admin Secret Key (for frontend gate) ──────────────────────────────
  app.post("/api/auth/validate-key", async (req: Request, res: Response) => {
    const { key } = req.body;
    const validKey = await getAdminSecretKey();
    const expired = await isKeyExpired();
    if (key === validKey && !expired) {
      res.status(200).json({ valid: true });
    } else if (key === validKey && expired) {
      res.status(410).json({ error: "Registration key has expired. Contact the platform owner." });
    } else {
      // Fake 404
      res.status(404).json({ error: "Not found" });
    }
  });
}
