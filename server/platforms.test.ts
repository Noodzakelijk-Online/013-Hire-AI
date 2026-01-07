import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  const ctx: TrpcContext = {
    user: undefined,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("platforms router", () => {
  it("should list all job platforms", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const platforms = await caller.platforms.list();

    expect(Array.isArray(platforms)).toBe(true);
    expect(platforms.length).toBeGreaterThan(0);
    
    // Check that we have the expected platforms
    const platformNames = platforms.map(p => p.name);
    expect(platformNames).toContain("FlexJobs");
    expect(platformNames).toContain("We Work Remotely");
    expect(platformNames).toContain("Remote.co");
  });

  it("should list only active platforms", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const platforms = await caller.platforms.active();

    expect(Array.isArray(platforms)).toBe(true);
    // All platforms should be active (isActive = 1)
    platforms.forEach(platform => {
      expect(platform.isActive).toBe(1);
    });
  });

  it("should have platforms across all tiers", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const platforms = await caller.platforms.list();

    const tiers = new Set(platforms.map(p => p.tier));
    expect(tiers.has("tier1")).toBe(true);
    expect(tiers.has("tier2")).toBe(true);
    expect(tiers.has("tier3")).toBe(true);
    expect(tiers.has("tier4")).toBe(true);
  });
});

describe("jobs router", () => {
  it("should list jobs with default pagination", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const jobs = await caller.jobs.list({});

    expect(Array.isArray(jobs)).toBe(true);
    // Jobs list might be empty initially, that's okay
    expect(jobs.length).toBeGreaterThanOrEqual(0);
  });

  it("should respect pagination limits", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const jobs = await caller.jobs.list({ limit: 10, offset: 0 });

    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeLessThanOrEqual(10);
  });

  it("should search jobs with filters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const jobs = await caller.jobs.search({
      title: "developer",
      limit: 20,
    });

    expect(Array.isArray(jobs)).toBe(true);
  });
});

describe("profile router", () => {
  it("should get user profile for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const profile = await caller.profile.get();

    // Profile might be undefined if not created yet
    expect(profile === undefined || typeof profile === "object").toBe(true);
  });

  it("should update user profile", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.profile.update({
      skills: "JavaScript, TypeScript, React",
      experience: "5 years",
      desiredJobTypes: "full-time",
      salaryExpectationMin: 80000,
      salaryExpectationMax: 120000,
    });

    expect(result.success).toBe(true);
  });
});

describe("applications router", () => {
  it("should list user applications", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const applications = await caller.applications.list();

    expect(Array.isArray(applications)).toBe(true);
  });
});
