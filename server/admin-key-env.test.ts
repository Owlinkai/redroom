import { describe, it, expect } from 'vitest';

describe('ADMIN_SECRET_KEY Environment Variable', () => {
  it('should be set and non-empty', () => {
    const key = process.env.ADMIN_SECRET_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key!.length).toBeGreaterThanOrEqual(1);
  });

  it('should be at least 6 characters for security', () => {
    const key = process.env.ADMIN_SECRET_KEY!;
    expect(key.length).toBeGreaterThanOrEqual(6);
  });
});
