import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module to avoid real DB connections in unit tests
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getFacilities: vi.fn().mockResolvedValue([]),
  getFacilityById: vi.fn().mockResolvedValue(null),
  bulkInsertFacilities: vi.fn().mockResolvedValue(0),
  createFacility: vi.fn().mockResolvedValue({ id: 1, name: "Test Facility", type: "military", country: "Test", latitude: 0, longitude: 0 }),
  updateFacility: vi.fn().mockResolvedValue({ id: 1, name: "Updated Facility", type: "military", country: "Test", latitude: 0, longitude: 0 }),
  deleteFacility: vi.fn().mockResolvedValue(undefined),
  searchFacilities: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getFacilitySources: vi.fn().mockResolvedValue([]),
  addFacilitySource: vi.fn().mockResolvedValue(1),
  deleteFacilitySource: vi.fn().mockResolvedValue(undefined),
  getFacilityCandidates: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getFacilityCandidateById: vi.fn().mockResolvedValue(null),
  createFacilityCandidate: vi.fn().mockResolvedValue({ id: 1, name: "Candidate", type: "military", country: "Test", reviewStatus: "pending" }),
  updateFacilityCandidate: vi.fn().mockResolvedValue({ id: 1, reviewStatus: "approved" }),
  deleteFacilityCandidate: vi.fn().mockResolvedValue(undefined),
  getFacilityEnrichmentJobs: vi.fn().mockResolvedValue([]),
  runFacilityReenrichment: vi.fn().mockResolvedValue(42),
  getNewsAgencies: vi.fn().mockResolvedValue([]),
  getNewsAgencyById: vi.fn().mockResolvedValue(null),
  bulkInsertNewsAgencies: vi.fn().mockResolvedValue(0),
  getArticles: vi.fn().mockResolvedValue([]),
  getArticleById: vi.fn().mockResolvedValue(null),
  insertArticle: vi.fn().mockResolvedValue(null),
  getArticleStats: vi.fn().mockResolvedValue({ total: 0, breaking: 0, today: 0 }),
  getTrendingTopics: vi.fn().mockResolvedValue([]),
  getArticleFacilityLinks: vi.fn().mockResolvedValue([]),
  insertArticleFacilityLink: vi.fn().mockResolvedValue(null),
  createCrawlJob: vi.fn().mockResolvedValue(null),
  updateCrawlJob: vi.fn().mockResolvedValue(null),
  getRecentCrawlJobs: vi.fn().mockResolvedValue([]),
  getNotifications: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn().mockResolvedValue(null),
  markNotificationRead: vi.fn().mockResolvedValue(null),
  serializeArticle: vi.fn().mockImplementation((a: any) => a),
}));

vi.mock("./crawler", () => ({
  crawlAgencyRSS: vi.fn(),
  scheduleCrawl: vi.fn(),
  runCrawlJob: vi.fn(),
  createJobAndRun: vi.fn(),
  cancelJob: vi.fn(),
  getActiveJobIds: vi.fn().mockReturnValue(new Set()),
  cleanupStuckJobs: vi.fn(),
  cleanupTimedOutJobs: vi.fn(),
}));

vi.mock("./crawlEventBus", () => ({
  crawlEventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

vi.mock("./referenceChecker", () => ({
  checkReference: vi.fn(),
  batchCheckReferences: vi.fn(),
  filterVerifiedArticles: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: '{"facilities":[]}' } }],
  }),
}));

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, cookies: {} } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

const caller = appRouter.createCaller(createCtx());

describe("facilities.search", () => {
  it("returns empty result when no facilities exist", async () => {
    const result = await caller.facilities.search({});
    expect(result).toEqual({ rows: [], total: 0 });
  });

  it("accepts all filter parameters without error", async () => {
    const result = await caller.facilities.search({
      search: "nuclear",
      type: "nuclear",
      country: "Iran",
      region: "MENA",
      threatLevel: "high",
      verificationStatus: "verified",
      approvalStatus: "approved",
      limit: 10,
      offset: 0,
    });
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("total");
  });
});

describe("facilities.create", () => {
  it("creates a facility with required fields", async () => {
    const result = await caller.facilities.create({
      name: "Test Nuclear Facility",
      type: "nuclear",
      country: "Iran",
      latitude: 32.1234,
      longitude: 51.5678,
    });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test Facility"); // mocked return
  });

  it("requires name and country", async () => {
    await expect(caller.facilities.create({
      name: "X", // too short
      type: "nuclear",
      country: "Iran",
      latitude: 32.1234,
      longitude: 51.5678,
    })).rejects.toThrow();
  });
});

describe("facilities.update", () => {
  it("updates a facility by id", async () => {
    const result = await caller.facilities.update({
      id: 1,
      name: "Updated Nuclear Facility",
      threatLevel: "critical",
    });
    expect(result).toBeDefined();
  });
});

describe("facilities.delete", () => {
  it("deletes a facility by id", async () => {
    const result = await caller.facilities.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("facilities.getSources", () => {
  it("returns sources for a facility", async () => {
    const result = await caller.facilities.getSources({ facilityId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("facilities.addSource", () => {
  it("adds a source with valid URL", async () => {
    const result = await caller.facilities.addSource({
      facilityId: 1,
      sourceUrl: "https://www.iaea.org/report/iran-2024",
      sourceName: "IAEA",
      sourceType: "iaea_report",
      reliability: 95,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", async () => {
    await expect(caller.facilities.addSource({
      facilityId: 1,
      sourceUrl: "not-a-url",
      sourceName: "IAEA",
    })).rejects.toThrow();
  });
});

describe("facilities.listCandidates", () => {
  it("returns candidate list", async () => {
    const result = await caller.facilities.listCandidates({});
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("total");
  });
});

describe("facilities.submitCandidate", () => {
  it("submits a candidate for review", async () => {
    const result = await caller.facilities.submitCandidate({
      name: "Candidate Facility",
      type: "military",
      country: "Syria",
      discoveryMethod: "manual",
    });
    expect(result).toBeDefined();
    expect(result?.reviewStatus).toBe("pending");
  });
});

describe("facilities.rejectCandidate", () => {
  it("rejects a candidate", async () => {
    const result = await caller.facilities.rejectCandidate({
      candidateId: 1,
      reviewedBy: "analyst",
      reviewNotes: "Insufficient source quality",
    });
    expect(result.success).toBe(true);
  });
});

describe("facilities.deleteCandidate", () => {
  it("deletes a candidate", async () => {
    const result = await caller.facilities.deleteCandidate({ candidateId: 1 });
    expect(result.success).toBe(true);
  });
});

describe("facilities.searchOnline", () => {
  it("returns empty results when LLM returns no facilities", async () => {
    const result = await caller.facilities.searchOnline({
      query: "nuclear facilities in Iran",
      maxResults: 3,
    });
    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("candidates");
    expect(result.count).toBe(0);
  });

  it("requires a minimum query length", async () => {
    await expect(caller.facilities.searchOnline({
      query: "ab", // too short
    })).rejects.toThrow();
  });
});

describe("facilities.triggerReenrichment", () => {
  it("returns job ID when facility exists", async () => {
    const { getFacilityById } = await import("./db");
    vi.mocked(getFacilityById).mockResolvedValueOnce({
      id: 1, name: "Test Facility", type: "military", country: "Test",
      latitude: 0, longitude: 0, region: "MENA",
    } as any);
    const result = await caller.facilities.triggerReenrichment({ facilityId: 1 });
    expect(result).toHaveProperty("jobId");
    expect(result.facilityName).toBe("Test Facility");
  });

  it("throws when facility not found", async () => {
    await expect(caller.facilities.triggerReenrichment({ facilityId: 9999 })).rejects.toThrow("Facility not found");
  });
});
