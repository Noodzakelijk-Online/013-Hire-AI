import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { getAuditEventsForUser, getUserProfile, upsertUserProfile } from "./db";

const mocks = vi.hoisted(() => ({
  discoverGitHubProfile: vi.fn(),
  mergeGitHubSkills: vi.fn(),
}));

vi.mock("./githubProfileDiscovery", () => ({
  discoverGitHubProfile: mocks.discoverGitHubProfile,
  mergeGitHubSkills: mocks.mergeGitHubSkills,
}));

import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `github-profile-${userId}`,
      name: "GitHub Profile User",
      email: `github-profile-${userId}@example.local`,
      loginMethod: "test",
      role: "user",
      stripeCustomerId: null,
      accountStatus: "active",
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("GitHub profile import route", () => {
  it("refetches the server-side candidate before merging skills and recording reviewed repository evidence", async () => {
    const userId = 99130;
    mocks.discoverGitHubProfile.mockResolvedValue({
      username: "octavia",
      profileUrl: "https://github.com/octavia",
      suggestedSkills: ["Python", "TypeScript"],
      repositories: [
        { name: "platform", url: "https://github.com/octavia/platform" },
        { name: "data", url: "https://github.com/octavia/data" },
      ],
    });
    mocks.mergeGitHubSkills.mockReturnValue("React, Python, TypeScript");
    await upsertUserProfile({ userId, skills: "React" });
    const caller = appRouter.createCaller(createContext(userId));

    const result = await caller.profile.importGitHubProfile({
      repositoryUrls: [
        "https://github.com/octavia/platform",
        "https://github.com/octavia/not-returned-by-server",
      ],
    });
    const profile = await getUserProfile(userId);
    const audits = await getAuditEventsForUser(userId, 10);

    expect(mocks.discoverGitHubProfile).toHaveBeenCalledWith(userId);
    expect(mocks.mergeGitHubSkills).toHaveBeenCalledWith("React", ["Python", "TypeScript"]);
    expect(profile).toMatchObject({
      githubUrl: "https://github.com/octavia",
      skills: "React, Python, TypeScript",
    });
    expect(result.selectedRepositories).toEqual([{ name: "platform", url: "https://github.com/octavia/platform" }]);
    expect(audits.some((event) =>
      event.action === "github_profile_imported" &&
      event.afterState?.includes('"selectedRepositoryCount":1') &&
      event.afterState?.includes("platform")
    )).toBe(true);
  });
});
