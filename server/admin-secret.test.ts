import { describe, it, expect } from "vitest";

describe("ADMIN_SECRET_KEY", () => {
  it("should be defined in environment", () => {
    const key = process.env.ADMIN_SECRET_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(5);
  });

  it("should not be empty or a placeholder", () => {
    const key = process.env.ADMIN_SECRET_KEY!;
    expect(key).not.toBe("");
    expect(key).not.toBe("changeme");
    expect(key).not.toBe("placeholder");
  });
});
