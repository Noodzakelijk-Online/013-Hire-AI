import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { upsertUserProfile } from "./db";
import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `profile-evidence-${userId}`,
      name: "Profile Evidence User",
      email: `profile-evidence-${userId}@example.local`,
      loginMethod: "test",
      role: "user",
      stripeCustomerId: null,
      accountStatus: "active",
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("profile evidence readiness router", () => {
  it("returns sanitized connector and document readiness through tRPC", async () => {
    const userId = 99601;
    await upsertUserProfile({
      userId,
      skills: "TypeScript, React, Node.js",
      experience: "Built remote SaaS products for five years.",
      education: "BSc Computer Science",
      desiredJobTypes: "Full Stack Engineer",
      desiredLocations: "Remote",
      salaryExpectationMin: 90000,
      salaryExpectationMax: 140000,
      resumeUrl: "https://storage.example.local/resumes/99601/resume.pdf",
      resumeFileKey: "resumes/99601/resume.pdf",
      linkedinUrl: "https://linkedin.com/in/example",
      githubUrl: "https://github.com/example",
    });

    const caller = appRouter.createCaller(createContext(userId));
    const summary = await caller.profile.getEvidenceReadiness();

    expect(summary.score).toBeGreaterThanOrEqual(80);
    expect(summary.providers.find((provider) => provider.id === "resume")?.status).toBe("connected");
    expect(summary.providers.find((provider) => provider.id === "linkedin")?.status).toBe("connected");
    expect(summary.providers.find((provider) => provider.id === "gmail")?.status).toBe("consent_required");
    expect(summary.providers.find((provider) => provider.id === "google_drive")?.status).toBe("consent_required");
    expect(JSON.stringify(summary)).not.toContain("accessToken");
  });
});
