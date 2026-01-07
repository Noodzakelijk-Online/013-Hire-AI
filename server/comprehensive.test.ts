/**
 * Comprehensive Test Suite for Hire.AI V2
 * Tests all major features including scrapers, AI matching, D&I, career intelligence, and more
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockContext(userId: number = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `test-user-${userId}`,
      email: `test${userId}@example.com`,
      name: `Test User ${userId}`,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ============================================================================
// PLATFORM TESTS
// ============================================================================

describe("Job Platforms", () => {
  it("should list all available platforms", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const platforms = await caller.platforms.list();
    
    expect(Array.isArray(platforms)).toBe(true);
  });

  it("should list active platforms only", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const platforms = await caller.platforms.active();
    
    expect(Array.isArray(platforms)).toBe(true);
  });
});

// ============================================================================
// SCRAPING TESTS
// ============================================================================

describe("Scraping Infrastructure", () => {
  it("should have listScrapers method", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.scraping).toBeDefined();
    expect(caller.scraping.listScrapers).toBeDefined();
  });

  it("should have scraping methods available", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.scraping.scrapeAll).toBeDefined();
    expect(caller.scraping.scrapePlatform).toBeDefined();
  });

  it("should have scraping status method", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.scraping).toBeDefined();
    expect(caller.scraping.status).toBeDefined();
  });
});

// ============================================================================
// JOB NORMALIZATION TESTS
// ============================================================================

describe("Job Normalization", () => {
  it("should have normalization router available", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.normalization).toBeDefined();
  });

  it("should have salary normalization method", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.normalization.normalizeSalary).toBeDefined();
  });

  it("should have location normalization method", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.normalization.normalizeLocation).toBeDefined();
  });

  it("should have job type normalization method", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.normalization.normalizeJobType).toBeDefined();
  });

  it("should have extractSkills method", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.normalization).toBeDefined();
    expect(caller.normalization.extractSkills).toBeDefined();
  });

  it("should have extractBenefits method", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.normalization).toBeDefined();
    expect(caller.normalization.extractBenefits).toBeDefined();
  });
});

// ============================================================================
// REAL-TIME DISCOVERY TESTS
// ============================================================================

describe("Real-Time Job Discovery", () => {
  it("should have discovery router available", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.discovery).toBeDefined();
  });

  it("should have discovery methods", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.discovery.getStats).toBeDefined();
    expect(caller.discovery.subscribe).toBeDefined();
  });
});

// ============================================================================
// RESUME TESTS
// ============================================================================

describe("Resume Management", () => {
  it("should have resume parse method", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.resume).toBeDefined();
    expect(caller.resume.parse).toBeDefined();
  });

  it("should have resume router methods available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.resume).toBeDefined();
    expect(caller.resume.parse).toBeDefined();
    expect(caller.resume.upload).toBeDefined();
  });
});

// ============================================================================
// JOB ALERTS TESTS
// ============================================================================

describe("Job Alerts", () => {
  it("should list user alerts", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const alerts = await caller.alerts.list();
    
    expect(Array.isArray(alerts)).toBe(true);
  });
});

// ============================================================================
// INTERVIEW PREPARATION TESTS
// ============================================================================

describe("Interview Preparation", () => {
  it("should have interview prep router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.interviewPrep).toBeDefined();
    expect(caller.interviewPrep.generateQuestions).toBeDefined();
    expect(caller.interviewPrep.mockInterview).toBeDefined();
    expect(caller.interviewPrep.videoTips).toBeDefined();
  });
});

// ============================================================================
// CAREER INTELLIGENCE TESTS
// ============================================================================

describe("Career Intelligence", () => {
  it("should have career router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // Check that the career router exists
    expect(caller.career).toBeDefined();
    expect(caller.career.analyzeSalary).toBeDefined();
    expect(caller.career.analyzeCompanyCulture).toBeDefined();
    expect(caller.career.generateNetworkingStrategy).toBeDefined();
    expect(caller.career.generateCareerPlan).toBeDefined();
  });
});

// ============================================================================
// D&I SUPPORT TESTS
// ============================================================================

describe("Diversity & Inclusion Support", () => {
  it("should have D&I router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.diversity).toBeDefined();
    expect(caller.diversity.analyzeCompanyDI).toBeDefined();
    expect(caller.diversity.analyzeVisaSponsorship).toBeDefined();
    expect(caller.diversity.getDIPlatforms).toBeDefined();
  });

  it("should get D&I platforms by category", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const platforms = await caller.diversity.getDIPlatforms({
      categories: ["women_in_tech", "veterans"],
    });
    
    expect(platforms).toBeDefined();
    expect(Array.isArray(platforms)).toBe(true);
  });
});

// ============================================================================
// AUTOMATION TESTS
// ============================================================================

describe("Application Automation", () => {
  it("should have automation router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.automation).toBeDefined();
    expect(caller.automation.detectATS).toBeDefined();
    expect(caller.automation.getATSSupport).toBeDefined();
  });

  it("should detect ATS type from URL", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.automation.detectATS({
      url: "https://boards.greenhouse.io/company/jobs/12345",
    });
    
    expect(result).toBeDefined();
    expect(result.atsType).toBe("greenhouse");
  });

  it("should detect Workday ATS", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.automation.detectATS({
      url: "https://company.myworkday.com/careers/job/12345",
    });
    
    expect(result).toBeDefined();
    expect(result.atsType).toBe("workday");
  });

  it("should detect Lever ATS", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.automation.detectATS({
      url: "https://jobs.lever.co/company/12345",
    });
    
    expect(result).toBeDefined();
    expect(result.atsType).toBe("lever");
  });

  it("should have automation methods available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.automation).toBeDefined();
    expect(caller.automation.detectATS).toBeDefined();
  });
});

// ============================================================================
// APPLICATION FEATURES TESTS
// ============================================================================

describe("Application Features", () => {
  it("should have applications router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.applications).toBeDefined();
    expect(caller.applications.list).toBeDefined();
    expect(caller.applications.addNote).toBeDefined();
    expect(caller.applications.scheduleInterview).toBeDefined();
    expect(caller.applications.createFollowUp).toBeDefined();
  });

  it("should list user applications", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const applications = await caller.applications.list();
    
    expect(Array.isArray(applications)).toBe(true);
  });

  it("should get upcoming interviews", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const interviews = await caller.applications.getUpcomingInterviews();
    
    expect(Array.isArray(interviews)).toBe(true);
  });
});

// ============================================================================
// JOBS ROUTER TESTS
// ============================================================================

describe("Jobs Router", () => {
  it("should list jobs", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const jobs = await caller.jobs.list({ limit: 10, offset: 0 });
    
    expect(Array.isArray(jobs)).toBe(true);
  });

  it("should search jobs", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const jobs = await caller.jobs.search({
      title: "engineer",
      limit: 10,
      offset: 0,
    });
    
    expect(Array.isArray(jobs)).toBe(true);
  });

  it("should get saved jobs for authenticated user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const savedJobs = await caller.jobs.getSavedJobs();
    
    expect(Array.isArray(savedJobs)).toBe(true);
  });
});

// ============================================================================
// PROFILE ROUTER TESTS
// ============================================================================

describe("Profile Router", () => {
  it("should get user profile", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const profile = await caller.profile.get();
    
    // Profile may be null if not created yet
    expect(profile === null || typeof profile === "object").toBe(true);
  });
});

// ============================================================================
// MATCHING ROUTER TESTS
// ============================================================================

describe("Matching Router", () => {
  it("should have matching router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.matching).toBeDefined();
    expect(caller.matching.calculateMatch).toBeDefined();
    expect(caller.matching.getMatches).toBeDefined();
  });

  it("should get user matches", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const matches = await caller.matching.getMatches({ minScore: 70 });
    
    expect(Array.isArray(matches)).toBe(true);
  });
});

// ============================================================================
// AI ROUTER TESTS
// ============================================================================

describe("AI Router", () => {
  it("should have AI router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.ai).toBeDefined();
    expect(caller.ai.generateCoverLetter).toBeDefined();
    expect(caller.ai.prepareInterview).toBeDefined();
  });
});

// ============================================================================
// DECISION MAKERS ROUTER TESTS
// ============================================================================

describe("Decision Makers Router", () => {
  it("should have decision makers router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.decisionMakers).toBeDefined();
    expect(caller.decisionMakers.identify).toBeDefined();
    expect(caller.decisionMakers.getForCompany).toBeDefined();
  });
});

// ============================================================================
// SOCIAL CONNECTIONS TESTS
// ============================================================================

describe("Social Connections", () => {
  it("should have social router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.social).toBeDefined();
    expect(caller.social.connect).toBeDefined();
    expect(caller.social.disconnect).toBeDefined();
    expect(caller.social.getConnections).toBeDefined();
  });

  it("should have social connection methods", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.social.connect).toBeDefined();
    expect(caller.social.disconnect).toBeDefined();
  });
});

// ============================================================================
// AUTH TESTS
// ============================================================================

describe("Authentication", () => {
  it("should return user info for authenticated context", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const user = await caller.auth.me();
    
    expect(user).toBeDefined();
    expect(user?.id).toBe(1);
    expect(user?.email).toBe("test1@example.com");
  });

  it("should return null for unauthenticated context", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const user = await caller.auth.me();
    
    expect(user).toBeNull();
  });

  it("should handle logout", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.logout();
    
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// SCHEDULER TESTS
// ============================================================================

describe("Scraping Scheduler", () => {
  it("should have scheduler router available", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.scraping.status).toBeDefined();
  });
});
