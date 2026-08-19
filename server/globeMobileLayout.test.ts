import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = path.resolve(
  import.meta.dirname,
  "../client/src/components/GlobeRegionSelector.tsx",
);

const source = readFileSync(componentPath, "utf8");

describe("GlobeRegionSelector mobile entry layout", () => {
  it("keeps the entry screen scrollable and gives the globe a bounded mobile height", () => {
    expect(source).toContain("overflow-x-hidden overflow-y-auto");
    expect(source).toContain("h-[230px]");
    expect(source).toContain("md:h-auto");
  });

  it("suppresses desktop-only visual overlays while preserving a full-width entry action", () => {
    expect(source).toContain("hidden pointer-events-none md:block");
    expect(source).toContain("min-h-11 w-full");
    expect(source).toContain("h-[220px]");
  });
});
