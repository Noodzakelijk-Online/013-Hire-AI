import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          marketRate: { low: 80000, median: 100000, high: 130000, currency: "USD" },
          factors: [{ factor: "Experience", impact: "positive", adjustment: 10000, explanation: "5+ years" }],
          recommendedRange: { minimum: 95000, target: 110000, stretch: 125000 },
          negotiationTips: ["Research market rates", "Highlight achievements"],
          counterOfferStrategy: "Start 10% above target",
          redFlags: ["Below market rate"],
          benefits: { typical: ["Health insurance"], negotiable: ["Remote work"], highValue: ["Equity"] },
        }),
      },
    }],
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Career Intelligence API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("career.analyzeSalary", () => {
    it("should analyze salary and return negotiation strategy", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.career.analyzeSalary({
        jobTitle: "Senior Software Engineer",
        company: "Tech Corp",
        location: "San Francisco, CA",
        yearsExperience: 5,
        skills: ["TypeScript", "React", "Node.js"],
        currentSalary: 90000,
      });

      expect(result).toBeDefined();
      expect(result.marketRate).toBeDefined();
      expect(result.marketRate.median).toBeGreaterThan(0);
      expect(result.recommendedRange).toBeDefined();
      expect(result.negotiationTips).toBeInstanceOf(Array);
    });
  });
});

describe("Diversity & Inclusion API", () => {
  describe("diversity.getDIPlatforms", () => {
    it("should return D&I platforms for specified categories", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.diversity.getDIPlatforms({
        categories: ["veterans", "disabilities"],
      });

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((p: any) => p.categories.includes("veterans"))).toBe(true);
    });

    it("should return all platforms when no categories specified", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.diversity.getDIPlatforms({
        categories: [],
      });

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(10);
    });
  });
});

describe("Social Connections API", () => {
  describe("social.validateUrl", () => {
    it("should validate LinkedIn URL format", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const validResult = await caller.social.validateUrl({
        url: "https://linkedin.com/in/johndoe",
        type: "linkedin",
      });
      expect(validResult.isValid).toBe(true);

      const invalidResult = await caller.social.validateUrl({
        url: "https://example.com/johndoe",
        type: "linkedin",
      });
      expect(invalidResult.isValid).toBe(false);
    });

    it("should validate GitHub URL format", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const validResult = await caller.social.validateUrl({
        url: "https://github.com/johndoe",
        type: "github",
      });
      expect(validResult.isValid).toBe(true);
    });

    it("should validate portfolio URL format", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const validResult = await caller.social.validateUrl({
        url: "https://johndoe.dev",
        type: "portfolio",
      });
      expect(validResult.isValid).toBe(true);

      const invalidResult = await caller.social.validateUrl({
        url: "not-a-valid-url",
        type: "portfolio",
      });
      expect(invalidResult.isValid).toBe(false);
    });
  });
});

describe("Scraping API", () => {
  describe("scraping.status", () => {
    it("should return scraping status with supported platforms", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.scraping.status();

      expect(result).toBeDefined();
      expect(result.initialized).toBe(true);
      expect(result.availableScrapers).toBeGreaterThanOrEqual(48);
      expect(result.supportedPlatforms).toBeInstanceOf(Array);
      expect(result.supportedPlatforms.length).toBeGreaterThanOrEqual(48);
      expect(result.platforms).toBeInstanceOf(Array);
      expect(result.scheduler).toMatchObject({
        intervalMinutes: expect.any(Number),
        maxJobsPerRun: expect.any(Number),
      });
      // Check that some common platforms are present
      const platformNames = result.supportedPlatforms.map((p: any) => p.name);
      expect(platformNames.length).toBeGreaterThan(0);
    });

    it("rejects scraper visibility and controls for a regular user", async () => {
      const caller = appRouter.createCaller(createAuthContext());

      await expect(caller.scraping.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.scraping.listScrapers()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.scraping.runNow()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});

describe("Automation API", () => {
  describe("automation.detectATS", () => {
    it("should detect Greenhouse ATS", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.automation.detectATS({
        url: "https://boards.greenhouse.io/company/jobs/123",
      });

      expect(result.atsType).toBe("greenhouse");
      // Greenhouse is supported for automation
    });

    it("should detect Lever ATS", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.automation.detectATS({
        url: "https://jobs.lever.co/company/123",
      });

      expect(result.atsType).toBe("lever");
      // Lever is supported for automation
    });

    it("should detect Workday ATS", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.automation.detectATS({
        url: "https://company.wd5.myworkdayjobs.com/careers",
      });

      expect(result.atsType).toBe("workday");
    });

    it("should return unknown for unrecognized URLs", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.automation.detectATS({
        url: "https://example.com/careers",
      });

      expect(result.atsType).toBe("unknown");
    });
  });
});
