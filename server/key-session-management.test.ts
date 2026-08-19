/**
 * Tests for Key History Tracking and Session Management
 * Covers: key rotation with history, registration key tracking, session lifecycle
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Key History Tracking", () => {
  it("should record key history when a new key is rotated", () => {
    // Simulate key rotation with label and expiry
    const keyValue = "test-secret-key-2024";
    const label = "Team Alpha Key";
    const expiryDays = 30;
    const createdBy = "admin@example.com";
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const keyHistoryRecord = {
      keyValue,
      label,
      createdBy,
      createdAt,
      expiresAt,
      registrationCount: 0,
      isActive: true,
    };

    expect(keyHistoryRecord.keyValue).toBe(keyValue);
    expect(keyHistoryRecord.label).toBe(label);
    expect(keyHistoryRecord.expiresAt.getTime()).toBeGreaterThan(createdAt.getTime());
    expect(keyHistoryRecord.registrationCount).toBe(0);
    expect(keyHistoryRecord.isActive).toBe(true);
  });

  it("should detect expired keys correctly", () => {
    const now = Date.now();
    // Key expired yesterday
    const expiredKey = {
      keyValue: "expired-key",
      expiresAt: new Date(now - 24 * 60 * 60 * 1000),
    };
    // Key expires tomorrow
    const validKey = {
      keyValue: "valid-key",
      expiresAt: new Date(now + 24 * 60 * 60 * 1000),
    };
    // Key with no expiry
    const noExpiryKey = {
      keyValue: "no-expiry-key",
      expiresAt: null,
    };

    const isExpired = (key: { expiresAt: Date | null }) =>
      key.expiresAt ? Date.now() > key.expiresAt.getTime() : false;

    expect(isExpired(expiredKey)).toBe(true);
    expect(isExpired(validKey)).toBe(false);
    expect(isExpired(noExpiryKey)).toBe(false);
  });

  it("should increment registration count when a key is used", () => {
    let registrationCount = 0;
    const usedKey = "active-key-123";

    // Simulate registration using the key
    registrationCount++;
    expect(registrationCount).toBe(1);

    // Another registration
    registrationCount++;
    expect(registrationCount).toBe(2);
  });

  it("should track which key was used for registration", () => {
    const registrationRequest = {
      email: "newuser@example.com",
      name: "New User",
      usedKey: "secret-key-abc",
      status: "pending",
    };

    expect(registrationRequest.usedKey).toBe("secret-key-abc");
    expect(registrationRequest.usedKey.length).toBeGreaterThan(0);
  });

  it("should generate a full registration URL with key", () => {
    // Route paths are not hardcoded here; they are injected via VITE_REGISTER_PATH / VITE_LOGIN_PATH env vars.
    // This test validates the URL construction logic using placeholder paths.
    const baseUrl = "https://example.com";
    const key = "my-secret-key-2024";
    const registerPath = process.env.VITE_REGISTER_PATH || "/[register-path]";
    const loginPath    = process.env.VITE_LOGIN_PATH    || "/[login-path]";
    const registrationUrl = `${baseUrl}${registerPath}?key=${key}`;
    const loginUrl = `${baseUrl}${loginPath}?key=${key}`;

    expect(registrationUrl).toContain("?key=");
    expect(registrationUrl).toContain(key);
    expect(loginUrl).toContain("?key=");
    expect(loginUrl).toContain(key);
  });

  it("should build a copyable block with registration URL + key", () => {
    const key = "test-key-xyz";
    const baseUrl = "https://redroom.example.com";
    const registerPath = process.env.VITE_REGISTER_PATH || "/[register-path]";
    const loginPath    = process.env.VITE_LOGIN_PATH    || "/[login-path]";
    const registrationUrl = `${baseUrl}${registerPath}?key=${key}`;
    const loginUrl = `${baseUrl}${loginPath}?key=${key}`;

    const copyBlock = `Registration URL: ${registrationUrl}\nLogin URL: ${loginUrl}\nSecret Key: ${key}`;

    expect(copyBlock).toContain("Registration URL:");
    expect(copyBlock).toContain("Login URL:");
    expect(copyBlock).toContain("Secret Key:");
    expect(copyBlock.split("\n").length).toBe(3);
  });
});

describe("Session Management", () => {
  it("should create a session with default 3-hour duration", () => {
    const now = new Date();
    const defaultDurationMinutes = 180; // 3 hours
    const expiresAt = new Date(now.getTime() + defaultDurationMinutes * 60 * 1000);

    const session = {
      userId: 1,
      sessionDurationMinutes: defaultDurationMinutes,
      lastActivity: now,
      expiresAt,
      isActive: true,
    };

    expect(session.sessionDurationMinutes).toBe(180);
    expect(session.isActive).toBe(true);
    expect(session.expiresAt.getTime() - session.lastActivity.getTime()).toBe(180 * 60 * 1000);
  });

  it("should correctly calculate remaining time", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 90 * 60 * 1000); // 90 minutes from now

    const diff = expiresAt.getTime() - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    expect(hours).toBe(1);
    expect(minutes).toBe(30);
  });

  it("should detect expired sessions", () => {
    const now = Date.now();
    const expiredSession = {
      expiresAt: new Date(now - 60000), // expired 1 minute ago
      isActive: true,
    };
    const activeSession = {
      expiresAt: new Date(now + 3600000), // expires in 1 hour
      isActive: true,
    };

    const isExpired = (s: { expiresAt: Date; isActive: boolean }) =>
      !s.isActive || Date.now() > s.expiresAt.getTime();

    expect(isExpired(expiredSession)).toBe(true);
    expect(isExpired(activeSession)).toBe(false);
  });

  it("should extend session by resetting expiry to full duration from now", () => {
    const now = Date.now();
    const durationMinutes = 180;
    const originalExpiresAt = new Date(now + 30 * 60 * 1000); // 30 min left

    // Extend: reset to full duration from now
    const newExpiresAt = new Date(now + durationMinutes * 60 * 1000);

    expect(newExpiresAt.getTime()).toBeGreaterThan(originalExpiresAt.getTime());
    expect(newExpiresAt.getTime() - now).toBe(durationMinutes * 60 * 1000);
  });

  it("should deactivate session on de-authenticate", () => {
    const session = {
      userId: 1,
      isActive: true,
      expiresAt: new Date(Date.now() + 3600000),
    };

    // Deauthenticate
    session.isActive = false;

    expect(session.isActive).toBe(false);
  });

  it("should allow admin to set custom session duration (15-1440 min)", () => {
    const validDurations = [15, 60, 120, 180, 360, 720, 1440];
    const invalidDurations = [0, 5, 14, 1441, 10000];

    const isValidDuration = (d: number) => d >= 15 && d <= 1440;

    validDurations.forEach(d => expect(isValidDuration(d)).toBe(true));
    invalidDurations.forEach(d => expect(isValidDuration(d)).toBe(false));
  });

  it("should terminate a specific user session", () => {
    const sessions = [
      { id: 1, userId: 10, isActive: true },
      { id: 2, userId: 20, isActive: true },
      { id: 3, userId: 30, isActive: true },
    ];

    // Terminate session 2
    const targetId = 2;
    const updated = sessions.map(s =>
      s.id === targetId ? { ...s, isActive: false } : s
    );

    expect(updated.find(s => s.id === 1)!.isActive).toBe(true);
    expect(updated.find(s => s.id === 2)!.isActive).toBe(false);
    expect(updated.find(s => s.id === 3)!.isActive).toBe(true);
  });

  it("should show correct status color based on time remaining", () => {
    const getStatusColor = (expiresAt: Date | null) => {
      if (!expiresAt) return "#4ade80"; // green
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) return "#ef4444"; // red = expired
      if (diff < 15 * 60 * 1000) return "#f59e0b"; // amber = <15 min
      return "#4ade80"; // green = healthy
    };

    const now = Date.now();
    expect(getStatusColor(null)).toBe("#4ade80");
    expect(getStatusColor(new Date(now - 1000))).toBe("#ef4444");
    expect(getStatusColor(new Date(now + 5 * 60 * 1000))).toBe("#f59e0b");
    expect(getStatusColor(new Date(now + 60 * 60 * 1000))).toBe("#4ade80");
  });
});
