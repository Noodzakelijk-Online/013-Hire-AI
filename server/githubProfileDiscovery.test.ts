import { describe, expect, it, vi } from "vitest";
import {
  discoverGitHubProfile,
  mergeGitHubSkills,
  type GitHubProfileDiscoveryDependencies,
} from "./githubProfileDiscovery";

const now = new Date("2026-07-13T12:00:00.000Z");

function dependencies(): GitHubProfileDiscoveryDependencies {
  return {
    getConnectorAuthorization: vi.fn().mockResolvedValue({
      encryptedAccessToken: "encrypted-github-token",
      accessTokenExpiresAt: null,
    }),
    listUserConnectorAccounts: vi.fn().mockResolvedValue([{
      userId: 18,
      provider: "github",
      status: "connected",
      consentScopes: JSON.stringify(["profile.basic.read", "repositories.metadata.read"]),
      externalAccountLabel: null,
      connectionRequestedAt: now,
      lastVerifiedAt: now,
      disconnectedAt: null,
    }]),
    upsertUserConnectorAccount: vi.fn().mockResolvedValue(undefined),
    decryptConnectorToken: vi.fn().mockReturnValue("github-access-token"),
  } as unknown as GitHubProfileDiscoveryDependencies;
}

describe("GitHub profile discovery", () => {
  it("reads only public profile and owned public repository metadata", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        login: "octavia",
        html_url: "https://github.com/octavia",
        name: "Octavia Example",
        bio: "Platform engineer",
        public_repos: 4,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { name: "platform", html_url: "https://github.com/octavia/platform", language: "TypeScript", stargazers_count: 4, fork: false, archived: false },
        { name: "docs", html_url: "https://github.com/octavia/docs", language: "TypeScript", stargazers_count: 0, fork: false, archived: true },
        { name: "fork", html_url: "https://github.com/octavia/fork", language: "Go", stargazers_count: 0, fork: true, archived: false },
        { name: "data", html_url: "https://github.com/octavia/data", language: "Python", stargazers_count: 2, fork: false, archived: false },
      ]), { status: 200 }));
    const deps = dependencies();

    const result = await discoverGitHubProfile(18, { fetcher, now, dependencies: deps });

    expect(result).toMatchObject({
      username: "octavia",
      profileUrl: "https://github.com/octavia",
      suggestedSkills: ["Python", "TypeScript"],
    });
    expect(result.repositories.map((repository) => repository.name)).toEqual(["platform", "data"]);
    expect(fetcher.mock.calls[1][0]).toContain("/users/octavia/repos?");
    expect(fetcher.mock.calls[1][0]).toContain("type=owner");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer github-access-token");
    expect(deps.upsertUserConnectorAccount).toHaveBeenCalledWith(expect.objectContaining({
      provider: "github",
      lastVerifiedAt: now,
    }));
  });

  it("rejects stale connector consent before making an external request", async () => {
    const deps = dependencies();
    (deps.listUserConnectorAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([{
      userId: 18,
      provider: "github",
      status: "connected",
      consentScopes: JSON.stringify(["profile.basic.read"]),
      lastVerifiedAt: new Date("2026-06-01T00:00:00.000Z"),
    }]);
    const fetcher = vi.fn();

    await expect(discoverGitHubProfile(18, { fetcher, now, dependencies: deps }))
      .rejects.toThrow("freshly authorized");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("merges source-supported skills without duplicate casing", () => {
    expect(mergeGitHubSkills("React, typescript", ["TypeScript", "Python"]))
      .toBe("React, typescript, Python");
  });
});
