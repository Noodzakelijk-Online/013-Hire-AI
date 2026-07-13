import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getActiveResume: vi.fn(),
}));

vi.mock("./resumeStorage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resumeStorage")>()),
  getActiveResume: mocks.getActiveResume,
}));
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveResume.mockResolvedValue({
      id: 99601,
      userId: 99601,
      fileName: "resume.pdf",
      fileUrl: "https://storage.example.local/resumes/99601/resume.pdf",
      fileKey: "resumes/99601/resume.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      version: 1,
      isActive: true,
      uploadedAt: new Date(),
    });
  });

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

  it("blocks evidence readiness when profile metadata has no active resume record", async () => {
    const userId = 99602;
    mocks.getActiveResume.mockResolvedValueOnce(null);
    await upsertUserProfile({
      userId,
      skills: "TypeScript, React, Node.js",
      experience: "Built remote SaaS products for five years.",
      education: "BSc Computer Science",
      desiredJobTypes: "Full Stack Engineer",
      desiredLocations: "Remote",
      salaryExpectationMin: 90000,
      salaryExpectationMax: 140000,
      resumeUrl: "https://untrusted.example.local/resume.pdf",
      resumeFileKey: "resumes/99602/resume.pdf",
    });

    const caller = appRouter.createCaller(createContext(userId));
    const summary = await caller.profile.getEvidenceReadiness();

    expect(summary.status).toBe("blocked");
    expect(summary.providers.find((provider) => provider.id === "resume")?.status).toBe("missing");
  });

  it("does not read cloud storage before a fresh connector grant exists", async () => {
    const caller = appRouter.createCaller(createContext(99603));

    await expect(caller.profile.discoverCloudDocuments({ provider: "google_drive" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Google Drive must be freshly authorized with resume-document read consent before Hire.AI can discover cloud documents.",
    });
  });
});
