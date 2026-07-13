import { describe, expect, it, vi } from "vitest";
import {
  buildConnectorAuthorizationUrl,
  createConnectorOAuthState,
  decryptConnectorToken,
  encryptConnectorToken,
  exchangeConnectorAuthorizationCode,
  getConnectorOAuthAvailability,
  getConnectorOAuthConfig,
  refreshConnectorAccessToken,
  verifyConnectorOAuthState,
  type ConnectorOAuthEnvironment,
} from "./connectorOAuth";

const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const environment: ConnectorOAuthEnvironment = {
  connectorOAuthRedirectUri: "https://hire.example.com/api/connectors/oauth/callback",
  connectorTokenEncryptionKey: encryptionKey,
  connectorOAuthStateSecret: "connector-state-secret-for-tests",
  googleOAuthClientId: "google-client-id",
  googleOAuthClientSecret: "google-client-secret",
  dropboxOAuthClientId: "dropbox-client-id",
  dropboxOAuthClientSecret: "dropbox-client-secret",
  microsoftOAuthClientId: "microsoft-client-id",
  microsoftOAuthClientSecret: "microsoft-client-secret",
  linkedInOAuthClientId: "linkedin-client-id",
  linkedInOAuthClientSecret: "linkedin-client-secret",
  githubOAuthClientId: "github-client-id",
  githubOAuthClientSecret: "github-client-secret",
};

describe("external connector OAuth boundary", () => {
  it("requires provider credentials, callback, state signing, and token encryption before OAuth is available", () => {
    expect(getConnectorOAuthAvailability("gmail", environment)).toMatchObject({
      provider: "gmail",
      available: true,
    });
    expect(getConnectorOAuthAvailability("gmail", {
      ...environment,
      connectorTokenEncryptionKey: "not-a-32-byte-key",
    }).available).toBe(false);
    expect(getConnectorOAuthAvailability("gmail", {
      ...environment,
      googleOAuthClientSecret: "",
    }).available).toBe(false);
  });

  it("builds an authorization URL without including client secrets", () => {
    const config = getConnectorOAuthConfig("google_drive", environment)!;
    const state = createConnectorOAuthState(
      { provider: "google_drive", userId: 42 },
      environment.connectorOAuthStateSecret,
      1_000
    );
    const url = new URL(buildConnectorAuthorizationUrl(config, state));

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe(environment.googleOAuthClientId);
    expect(url.searchParams.get("scope")).toContain("drive.readonly");
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.toString()).not.toContain(environment.googleOAuthClientSecret);
  });

  it("requests Gmail metadata plus explicit outbound-send authority", () => {
    const config = getConnectorOAuthConfig("gmail", environment)!;

    expect(config.scopes).toEqual([
      "https://www.googleapis.com/auth/gmail.metadata",
      "https://www.googleapis.com/auth/gmail.send",
    ]);
    expect(config.scopes).not.toContain("https://www.googleapis.com/auth/gmail.readonly");
  });

  it("accepts only untampered, short-lived OAuth state", () => {
    const state = createConnectorOAuthState(
      { provider: "gmail", userId: 73 },
      environment.connectorOAuthStateSecret,
      1_000
    );

    expect(verifyConnectorOAuthState(state, environment.connectorOAuthStateSecret, 1_001)).toMatchObject({
      provider: "gmail",
      userId: 73,
    });
    expect(verifyConnectorOAuthState(`${state}x`, environment.connectorOAuthStateSecret, 1_001)).toBeNull();
    expect(verifyConnectorOAuthState(state, environment.connectorOAuthStateSecret, 1_000 + 10 * 60 * 1000 + 1)).toBeNull();
  });

  it("encrypts provider tokens with authenticated encryption", () => {
    const encrypted = encryptConnectorToken("access-token-value", encryptionKey);

    expect(encrypted).not.toContain("access-token-value");
    expect(decryptConnectorToken(encrypted, encryptionKey)).toBe("access-token-value");
    expect(() => decryptConnectorToken(encrypted, Buffer.alloc(32, 8).toString("base64"))).toThrow(
      "could not be decrypted"
    );
  });

  it("exchanges a code through the configured token endpoint without returning secrets", async () => {
    const config = getConnectorOAuthConfig("gmail", environment)!;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      access_token: "provider-access-token",
      refresh_token: "provider-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "https://www.googleapis.com/auth/gmail.readonly",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await exchangeConnectorAuthorizationCode(config, "authorization-code", fetcher);

    expect(result).toMatchObject({
      refreshToken: "provider-refresh-token",
      tokenType: "Bearer",
    });
    expect(result.accessToken).toBe("provider-access-token");
    expect(fetcher).toHaveBeenCalledWith(config.tokenEndpoint, expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("grant_type=authorization_code"),
    }));
  });

  it("uses the same protected token endpoint to refresh an expiring connector grant", async () => {
    const config = getConnectorOAuthConfig("google_drive", environment)!;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      access_token: "refreshed-access-token",
      expires_in: 3600,
      token_type: "Bearer",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await refreshConnectorAccessToken(config, "stored-refresh-token", fetcher);

    expect(result.accessToken).toBe("refreshed-access-token");
    expect(result.refreshToken).toBeNull();
    expect(fetcher).toHaveBeenCalledWith(config.tokenEndpoint, expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("grant_type=refresh_token"),
    }));
  });
});
