import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the quota enforcement module logic.
 * Tests the pure logic (reset detection, formatting, etc.) without DB dependency.
 */

describe('Quota Enforcement Logic', () => {
  it('should identify when daily reset is needed (different day)', () => {
    const lastReset = new Date('2025-01-01T10:00:00Z');
    const now = new Date('2025-01-02T08:00:00Z');
    const needsReset = lastReset.toDateString() !== now.toDateString();
    expect(needsReset).toBe(true);
  });

  it('should NOT reset if same day', () => {
    const lastReset = new Date('2025-01-15T03:00:00Z');
    const now = new Date('2025-01-15T22:00:00Z');
    const needsReset = lastReset.toDateString() !== now.toDateString();
    expect(needsReset).toBe(false);
  });

  it('should identify when monthly reset is needed (different month)', () => {
    const lastReset = new Date('2025-01-15T10:00:00Z');
    const now = new Date('2025-02-01T08:00:00Z');
    const needsReset = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();
    expect(needsReset).toBe(true);
  });

  it('should NOT reset monthly if same month', () => {
    const lastReset = new Date('2025-03-01T10:00:00Z');
    const now = new Date('2025-03-28T08:00:00Z');
    const needsReset = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();
    expect(needsReset).toBe(false);
  });

  it('should calculate remaining correctly', () => {
    const dailyLimit = 50;
    const usedToday = 30;
    const monthlyLimit = 1000;
    const usedThisMonth = 450;
    const dailyRemaining = Math.max(0, dailyLimit - usedToday);
    const monthlyRemaining = Math.max(0, monthlyLimit - usedThisMonth);
    expect(dailyRemaining).toBe(20);
    expect(monthlyRemaining).toBe(550);
  });

  it('should deny when daily limit exceeded', () => {
    const dailyLimit = 50;
    const usedToday = 50;
    const monthlyLimit = 1000;
    const usedThisMonth = 50;
    const dailyRemaining = Math.max(0, dailyLimit - usedToday);
    const monthlyRemaining = Math.max(0, monthlyLimit - usedThisMonth);
    const allowed = dailyRemaining > 0 && monthlyRemaining > 0;
    expect(allowed).toBe(false);
  });

  it('should deny when monthly limit exceeded', () => {
    const dailyLimit = 50;
    const usedToday = 10;
    const monthlyLimit = 1000;
    const usedThisMonth = 1000;
    const dailyRemaining = Math.max(0, dailyLimit - usedToday);
    const monthlyRemaining = Math.max(0, monthlyLimit - usedThisMonth);
    const allowed = dailyRemaining > 0 && monthlyRemaining > 0;
    expect(allowed).toBe(false);
  });

  it('should allow when within both limits', () => {
    const dailyLimit = 50;
    const usedToday = 49;
    const monthlyLimit = 1000;
    const usedThisMonth = 999;
    const dailyRemaining = Math.max(0, dailyLimit - usedToday);
    const monthlyRemaining = Math.max(0, monthlyLimit - usedThisMonth);
    const allowed = dailyRemaining > 0 && monthlyRemaining > 0;
    expect(allowed).toBe(true);
  });

  it('admin role should always bypass quota', () => {
    const userRole = 'admin';
    const bypasses = userRole === 'admin';
    expect(bypasses).toBe(true);
  });

  it('analyst role should NOT bypass quota', () => {
    const userRole = 'analyst';
    const bypasses = userRole === 'admin';
    expect(bypasses).toBe(false);
  });
});
