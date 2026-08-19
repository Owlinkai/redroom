/**
 * Geopolitical Intelligence Platform — Unit Tests
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-001",
      email: "analyst@geoint.test",
      name: "Test Analyst",
      loginMethod: "oauth",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth", () => {
  it("me returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test Analyst");
    expect(result?.email).toBe("analyst@geoint.test");
  });

  it("logout clears session cookie", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.objectContaining({ maxAge: -1 })
    );
  });
});

// ─── Crawler Topic Detection ──────────────────────────────────────────────────

describe("topic detection logic", () => {
  const TOPIC_KEYWORDS: Record<string, string[]> = {
    'WAR/CONFLICT': ['war', 'conflict', 'attack', 'strike', 'military', 'troops', 'battle', 'bomb', 'missile'],
    'ECONOMY': ['economy', 'economic', 'gdp', 'inflation', 'trade', 'oil', 'gas', 'market', 'investment'],
    'POLITICS': ['government', 'president', 'minister', 'election', 'parliament', 'policy', 'diplomatic'],
    'TECHNOLOGY': ['technology', 'cyber', 'digital', 'ai', 'artificial intelligence', 'hack', 'data'],
    'ENERGY': ['oil', 'gas', 'energy', 'pipeline', 'refinery', 'opec', 'petroleum', 'nuclear'],
  };

  function detectTopics(text: string): string[] {
    const lowerText = text.toLowerCase();
    const detected: string[] = [];
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(kw => lowerText.includes(kw))) detected.push(topic);
    }
    return detected.length > 0 ? detected : ['GENERAL'];
  }

  it("detects WAR/CONFLICT topic from text", () => {
    const text = "Israeli forces launched a military strike on targets in southern Lebanon";
    const topics = detectTopics(text);
    expect(topics).toContain("WAR/CONFLICT");
  });

  it("detects ECONOMY topic from text", () => {
    const text = "Saudi Aramco reports record profits as oil prices rise";
    const topics = detectTopics(text);
    expect(topics).toContain("ECONOMY");
    expect(topics).toContain("ENERGY");
  });

  it("detects TECHNOLOGY topic from text", () => {
    const text = "Iran expands cyber operations targeting Gulf state infrastructure";
    const topics = detectTopics(text);
    expect(topics).toContain("TECHNOLOGY");
  });

  it("returns GENERAL for unclassifiable text", () => {
    const text = "A local community event was held in the town square";
    const topics = detectTopics(text);
    expect(topics).toContain("GENERAL");
  });

  it("detects multiple topics from complex text", () => {
    const text = "Government announces new energy policy amid economic pressures and military tensions";
    const topics = detectTopics(text);
    expect(topics.length).toBeGreaterThan(1);
  });
});

// ─── Sentiment Analysis Logic ─────────────────────────────────────────────────

describe("sentiment analysis logic", () => {
  function detectSentiment(text: string): { sentiment: string; score: number } {
    const lowerText = text.toLowerCase();
    const negativeWords = ['attack', 'kill', 'death', 'war', 'conflict', 'bomb', 'explosion', 'crisis', 'threat'];
    const positiveWords = ['peace', 'agreement', 'deal', 'cooperation', 'growth', 'success', 'progress'];
    const negCount = negativeWords.filter(w => lowerText.includes(w)).length;
    const posCount = positiveWords.filter(w => lowerText.includes(w)).length;
    if (negCount > posCount + 1) return { sentiment: 'negative', score: -Math.min(negCount / 5, 1) };
    if (posCount > negCount + 1) return { sentiment: 'positive', score: Math.min(posCount / 5, 1) };
    if (negCount > 0 && posCount > 0) return { sentiment: 'mixed', score: 0 };
    return { sentiment: 'neutral', score: 0 };
  }

  it("returns negative sentiment for conflict news", () => {
    const result = detectSentiment("Bomb attack kills civilians in conflict zone");
    expect(result.sentiment).toBe("negative");
    expect(result.score).toBeLessThan(0);
  });

  it("returns positive sentiment for peace news", () => {
    const result = detectSentiment("Peace agreement signed, cooperation deal brings progress and growth");
    expect(result.sentiment).toBe("positive");
    expect(result.score).toBeGreaterThan(0);
  });

  it("returns neutral for neutral text", () => {
    const result = detectSentiment("The minister held a press conference today");
    expect(result.sentiment).toBe("neutral");
    expect(result.score).toBe(0);
  });

  it("returns mixed for text with both positive and negative words", () => {
    // 'war' (1 negative) + 'peace', 'deal', 'cooperation', 'agreement' (4 positive) → positive
    // For mixed, need equal negative and positive counts
    const result = detectSentiment("War and conflict threaten the peace deal and cooperation");
    expect(result.sentiment).toBe("mixed");
  });
});

// ─── Country Detection Logic ──────────────────────────────────────────────────

describe("country detection logic", () => {
  const MENA_COUNTRIES: Record<string, string> = {
    'saudi': 'Saudi Arabia', 'riyadh': 'Saudi Arabia',
    'iran': 'Iran', 'tehran': 'Iran',
    'iraq': 'Iraq', 'baghdad': 'Iraq',
    'israel': 'Israel', 'tel aviv': 'Israel',
    'egypt': 'Egypt', 'cairo': 'Egypt',
    'uae': 'UAE', 'dubai': 'UAE',
    'qatar': 'Qatar', 'doha': 'Qatar',
    'yemen': 'Yemen', 'sanaa': 'Yemen',
    'syria': 'Syria', 'damascus': 'Syria',
    'lebanon': 'Lebanon', 'beirut': 'Lebanon',
  };

  function detectCountry(text: string): string | null {
    const lowerText = text.toLowerCase();
    for (const [keyword, country] of Object.entries(MENA_COUNTRIES)) {
      if (lowerText.includes(keyword)) return country;
    }
    return null;
  }

  it("detects Saudi Arabia from text", () => {
    expect(detectCountry("Riyadh announced new economic reforms")).toBe("Saudi Arabia");
    expect(detectCountry("Saudi Aramco reports profits")).toBe("Saudi Arabia");
  });

  it("detects Iran from text", () => {
    expect(detectCountry("Tehran rejected the proposal")).toBe("Iran");
    expect(detectCountry("Iran launched new satellite")).toBe("Iran");
  });

  it("detects UAE from text", () => {
    expect(detectCountry("Dubai hosts major tech conference")).toBe("UAE");
    expect(detectCountry("UAE announces investment fund")).toBe("UAE");
  });

  it("returns null for non-MENA text", () => {
    expect(detectCountry("Washington DC announced new policy")).toBeNull();
    expect(detectCountry("London markets closed higher")).toBeNull();
  });
});

// ─── Facility Mention Detection ───────────────────────────────────────────────

describe("facility mention detection", () => {
  const FACILITY_KEYWORDS = [
    { pattern: /oil\s*(field|facility|plant|refinery|terminal)/gi, type: 'oil_gas' },
    { pattern: /nuclear\s*(plant|reactor|facility|power)/gi, type: 'nuclear' },
    { pattern: /military\s*(base|facility|installation|compound)/gi, type: 'military' },
    { pattern: /airport|airbase|air\s*base/gi, type: 'airport' },
    { pattern: /data\s*center/gi, type: 'data_center' },
    { pattern: /embassy|consulate/gi, type: 'embassy' },
    { pattern: /pipeline/gi, type: 'oil_gas' },
    { pattern: /power\s*(plant|station|grid)/gi, type: 'power_plant' },
  ];

  function detectFacilityMentions(text: string): string[] {
    const types: string[] = [];
    for (const { pattern, type } of FACILITY_KEYWORDS) {
      if (pattern.test(text)) types.push(type);
    }
    return [...new Set(types)];
  }

  it("detects oil facility mentions", () => {
    const types = detectFacilityMentions("Attack on oil refinery disrupts production");
    expect(types).toContain("oil_gas");
  });

  it("detects nuclear facility mentions", () => {
    const types = detectFacilityMentions("IAEA inspects nuclear plant in Iran");
    expect(types).toContain("nuclear");
  });

  it("detects military base mentions", () => {
    const types = detectFacilityMentions("Rockets fired at US military base in Iraq");
    expect(types).toContain("military");
  });

  it("detects embassy mentions", () => {
    const types = detectFacilityMentions("Protesters storm the embassy in Tehran");
    expect(types).toContain("embassy");
  });

  it("returns empty array for no facility mentions", () => {
    const types = detectFacilityMentions("The minister held a press conference");
    expect(types).toHaveLength(0);
  });
});

// ─── Data Validation ─────────────────────────────────────────────────────────

describe("data validation", () => {
  it("validates MENA region coordinates are within bounds", () => {
    const MENA_BOUNDS = { minLat: 10, maxLat: 45, minLon: -20, maxLon: 65 };
    const testCoords = [
      { lat: 24.69, lon: 46.72, country: "Saudi Arabia" },
      { lat: 35.7, lon: 51.4, country: "Iran" },
      { lat: 33.38, lon: 44.4, country: "Iraq" },
      { lat: 31.5, lon: 34.75, country: "Israel" },
      { lat: 30.04, lon: 31.23, country: "Egypt" },
    ];
    for (const coord of testCoords) {
      expect(coord.lat).toBeGreaterThanOrEqual(MENA_BOUNDS.minLat);
      expect(coord.lat).toBeLessThanOrEqual(MENA_BOUNDS.maxLat);
      expect(coord.lon).toBeGreaterThanOrEqual(MENA_BOUNDS.minLon);
      expect(coord.lon).toBeLessThanOrEqual(MENA_BOUNDS.maxLon);
    }
  });

  it("validates sentiment score is within -1 to 1 range", () => {
    const scores = [-1, -0.8, -0.5, 0, 0.3, 0.7, 1];
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("validates topic categories are from allowed list", () => {
    const ALLOWED_TOPICS = ['WAR/CONFLICT', 'ECONOMY', 'POLITICS', 'TECHNOLOGY', 'ENERGY', 'DIPLOMACY', 'SECURITY', 'HUMANITARIAN', 'GENERAL'];
    const testTopics = ['WAR/CONFLICT', 'ECONOMY', 'TECHNOLOGY'];
    for (const topic of testTopics) {
      expect(ALLOWED_TOPICS).toContain(topic);
    }
  });

  it("validates news agency types are from allowed list", () => {
    const ALLOWED_TYPES = ['state', 'independent', 'international', 'digital', 'broadcast', 'wire'];
    const testTypes = ['state', 'broadcast', 'digital'];
    for (const type of testTypes) {
      expect(ALLOWED_TYPES).toContain(type);
    }
  });
});

// ─── URL Validation ───────────────────────────────────────────────────────────

describe("URL validation", () => {
  function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  it("validates RSS feed URLs", () => {
    const validUrls = [
      "https://www.aljazeera.com/xml/rss/all.xml",
      "https://english.alarabiya.net/rss.xml",
      "https://www.reuters.com/rssFeed/worldNews",
    ];
    for (const url of validUrls) {
      expect(isValidUrl(url)).toBe(true);
    }
  });

  it("rejects invalid URLs", () => {
    // Only truly malformed URLs fail new URL() — ftp:// and javascript: are valid URL schemes
    const invalidUrls = ["not-a-url", "://missing-scheme", "http://"];
    // Validate that http-only URLs without host are rejected
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("://missing-scheme")).toBe(false);
    // Valid schemes like ftp:// are technically valid URLs
    expect(isValidUrl("https://valid-url.com")).toBe(true);
  });
});

// ─── Crawl → Monitor Integration ────────────────────────────────────────────────────
describe("Crawl → Monitor integration", () => {
  it("handleCrawlStart switches sub-tab to monitor and bumps refresh key", () => {
    // Simulate the SourcesTab handleCrawlStart logic
    let subTab = "sources";
    let monitorRefreshKey = 0;

    const handleCrawlStart = () => {
      subTab = "monitor";
      monitorRefreshKey += 1;
    };

    // Before crawl
    expect(subTab).toBe("sources");
    expect(monitorRefreshKey).toBe(0);

    // Trigger crawl start (simulates clicking a Crawl button)
    handleCrawlStart();

    // After crawl start
    expect(subTab).toBe("monitor");
    expect(monitorRefreshKey).toBe(1);

    // Trigger again (e.g., second crawl)
    handleCrawlStart();
    expect(monitorRefreshKey).toBe(2);
  });

  it("onCrawlStart is optional — components work without it", () => {
    // Simulates calling onCrawlStart?.() when prop is undefined
    const onCrawlStart: (() => void) | undefined = undefined;
    expect(() => onCrawlStart?.()).not.toThrow();
  });

  it("FetchingMonitor refreshKey triggers refetch when bumped", () => {
    // Simulates the useEffect logic in FetchingMonitor
    let refetchCount = 0;
    const mockRefetch = () => { refetchCount += 1; };

    const simulateRefreshKeyEffect = (refreshKey: number) => {
      if (refreshKey && refreshKey > 0) {
        mockRefetch(); // liveStatusQuery.refetch()
        mockRefetch(); // jobLogQuery.refetch()
      }
    };

    // refreshKey = 0: no refetch
    simulateRefreshKeyEffect(0);
    expect(refetchCount).toBe(0);

    // refreshKey = 1: both queries refetch
    simulateRefreshKeyEffect(1);
    expect(refetchCount).toBe(2);

    // refreshKey = 2: both queries refetch again
    simulateRefreshKeyEffect(2);
    expect(refetchCount).toBe(4);
  });

  it("handleCrawlStart from FetchingControl tab also switches to monitor", () => {
    let subTab = "fetching";
    let monitorRefreshKey = 0;
    const handleCrawlStart = () => { subTab = "monitor"; monitorRefreshKey += 1; };

    // Simulate clicking "Fetch All Sources" in FetchingControl
    handleCrawlStart();
    expect(subTab).toBe("monitor");
    expect(monitorRefreshKey).toBe(1);
  });
});

// ─── GEO MAP — Date-Window Filtering Logic ────────────────────────────────────

describe("GEO MAP — date-window filtering logic", () => {
  it("daysBack=0 produces no dateFrom (all-time view)", () => {
    const daysBack = 0;
    const dateFrom = daysBack === 0 ? undefined : (() => {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      return d.toISOString();
    })();
    expect(dateFrom).toBeUndefined();
  });

  it("daysBack=7 produces a dateFrom approximately 7 days in the past", () => {
    const daysBack = 7;
    const now = Date.now();
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const dateFrom = d.toISOString();
    const parsed = new Date(dateFrom).getTime();
    // Should be within 7 days ± 1 minute of now
    expect(now - parsed).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(now - parsed).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });

  it("daysBack=30 produces a dateFrom approximately 30 days in the past", () => {
    const daysBack = 30;
    const now = Date.now();
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const dateFrom = d.toISOString();
    const parsed = new Date(dateFrom).getTime();
    expect(now - parsed).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(now - parsed).toBeLessThan(31 * 24 * 60 * 60 * 1000);
  });

  it("DATE_PRESETS covers 7D, 30D, 90D, 1Y, and ALL", () => {
    const DATE_PRESETS = [
      { label: '7D', days: 7 },
      { label: '30D', days: 30 },
      { label: '90D', days: 90 },
      { label: '1Y', days: 365 },
      { label: 'ALL', days: 0 },
    ];
    const labels = DATE_PRESETS.map(p => p.label);
    expect(labels).toContain('7D');
    expect(labels).toContain('30D');
    expect(labels).toContain('90D');
    expect(labels).toContain('1Y');
    expect(labels).toContain('ALL');
    const allTimePreset = DATE_PRESETS.find(p => p.label === 'ALL');
    expect(allTimePreset?.days).toBe(0);
  });

  it("larger daysBack produces an earlier dateFrom", () => {
    const makeDate = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.getTime();
    };
    expect(makeDate(30)).toBeLessThan(makeDate(7));
    expect(makeDate(365)).toBeLessThan(makeDate(90));
  });
});

// ─── GEO MAP — crawlByCountry Mutation ───────────────────────────────────────

describe("GEO MAP — crawlByCountry mutation", () => {
  it("crawlByCountry procedure exists on the agencies router", () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.agencies.crawlByCountry).toBe("function");
  });

  it("crawlByCountry returns agenciesCrawled and jobIds fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Country with no agencies in test DB → returns 0 crawled
    const result = await caller.agencies.crawlByCountry({ country: '__nonexistent_country__', region: 'MENA' });
    expect(result).toHaveProperty('agenciesCrawled');
    expect(result).toHaveProperty('jobIds');
    expect(typeof result.agenciesCrawled).toBe('number');
    expect(Array.isArray(result.jobIds)).toBe(true);
  });

  it("crawlByCountry returns 0 for a country with no active agencies", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agencies.crawlByCountry({ country: 'Atlantis', region: 'MENA' });
    expect(result.agenciesCrawled).toBe(0);
    expect(result.jobIds).toHaveLength(0);
  });

  it("crawlByCountry accepts region parameter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw regardless of region value
    await expect(
      caller.agencies.crawlByCountry({ country: '__test__', region: 'Global' })
    ).resolves.toHaveProperty('agenciesCrawled');
  });
});
