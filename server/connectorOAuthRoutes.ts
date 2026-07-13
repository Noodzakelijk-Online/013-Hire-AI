import type { Express, Request, Response } from "express";
import {
  encryptConnectorToken,
  exchangeConnectorAuthorizationCode,
  getConnectorOAuthConfig,
  isOAuthConnectorProvider,
  verifyConnectorOAuthState,
} from "./connectorOAuth";
import {
  createAuditEvent,
  listUserConnectorAccounts,
  upsertConnectorAuthorization,
  upsertUserConnectorAccount,
} from "./db";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function connectorConsentScopes(provider: "gmail" | "google_drive" | "dropbox" | "outlook" | "linkedin" | "github") {
  switch (provider) {
    case "gmail":
      return ["email.metadata.read", "email.messages.read_recruiting", "email.messages.send"];
    case "outlook":
      return ["mail.metadata.read", "mail.messages.read_recruiting", "mail.messages.send"];
    case "google_drive":
    case "dropbox":
      return ["files.metadata.read", "files.content.read_resume_candidates"];
    case "linkedin":
      return ["profile.basic.read"];
    case "github":
      return ["profile.basic.read", "repositories.metadata.read"];
  }
}

function hasRequiredOutboundScope(provider: "gmail" | "google_drive" | "dropbox" | "outlook" | "linkedin" | "github", grantedScopes: string[]) {
  if (provider === "gmail") return grantedScopes.includes("https://www.googleapis.com/auth/gmail.send");
  if (provider === "outlook") return grantedScopes.includes("Mail.Send");
  return true;
}

function completeRedirect(provider: string, status: "connected" | "denied" | "failed") {
  return `/profile?connector=${encodeURIComponent(provider)}&connectorStatus=${status}`;
}

export function registerConnectorOAuthRoutes(app: Express) {
  app.get("/api/connectors/oauth/callback", async (req: Request, res: Response) => {
    const state = getQueryParam(req, "state");
    const code = getQueryParam(req, "code");
    const providerError = getQueryParam(req, "error");
    if (!state) {
      res.status(400).json({ error: "Invalid connector authorization state." });
      return;
    }

    const verifiedState = verifyConnectorOAuthState(state);
    if (!verifiedState || !isOAuthConnectorProvider(verifiedState.provider)) {
      res.status(400).json({ error: "Invalid or expired connector authorization state." });
      return;
    }

    const provider = verifiedState.provider;
    const account = (await listUserConnectorAccounts(verifiedState.userId))
      .find((item) => item.provider === provider);
    if (account?.status === "disabled") {
      res.redirect(302, completeRedirect(provider, "denied"));
      return;
    }

    if (providerError || !code) {
      await upsertUserConnectorAccount({
        userId: verifiedState.userId,
        provider,
        status: "needs_reauth",
        consentScopes: JSON.stringify(connectorConsentScopes(provider)),
      });
      await createAuditEvent({
        userId: verifiedState.userId,
        entityType: "user",
        entityId: verifiedState.userId,
        action: "connector_oauth_denied",
        actor: "user",
        source: "connectors.oauth.callback",
        afterState: JSON.stringify({ provider, status: "needs_reauth" }),
        riskLevel: "medium",
      });
      res.redirect(302, completeRedirect(provider, "denied"));
      return;
    }

    const config = getConnectorOAuthConfig(provider);
    if (!config) {
      res.status(503).json({ error: "Connector OAuth is not configured for this provider." });
      return;
    }

    try {
      const token = await exchangeConnectorAuthorizationCode(config, code);
      if (!hasRequiredOutboundScope(provider, token.grantedScopes)) {
        throw new Error("Required mailbox send consent was not granted.");
      }
      await upsertConnectorAuthorization({
        userId: verifiedState.userId,
        provider,
        encryptedAccessToken: encryptConnectorToken(token.accessToken),
        encryptedRefreshToken: token.refreshToken ? encryptConnectorToken(token.refreshToken) : null,
        accessTokenExpiresAt: token.expiresAt,
        tokenType: token.tokenType,
        grantedScopes: JSON.stringify(token.grantedScopes),
      });
      await upsertUserConnectorAccount({
        userId: verifiedState.userId,
        provider,
        status: "connected",
        consentScopes: JSON.stringify(connectorConsentScopes(provider)),
        lastVerifiedAt: new Date(),
        disconnectedAt: null,
      });
      await createAuditEvent({
        userId: verifiedState.userId,
        entityType: "user",
        entityId: verifiedState.userId,
        action: "connector_oauth_connected",
        actor: "user",
        source: "connectors.oauth.callback",
        afterState: JSON.stringify({
          provider,
          status: "connected",
          tokenExpiresAt: token.expiresAt?.toISOString() ?? null,
        }),
        riskLevel: "medium",
      });
      res.redirect(302, completeRedirect(provider, "connected"));
    } catch {
      await upsertUserConnectorAccount({
        userId: verifiedState.userId,
        provider,
        status: "needs_reauth",
        consentScopes: JSON.stringify(connectorConsentScopes(provider)),
      });
      await createAuditEvent({
        userId: verifiedState.userId,
        entityType: "user",
        entityId: verifiedState.userId,
        action: "connector_oauth_failed",
        actor: "system",
        source: "connectors.oauth.callback",
        afterState: JSON.stringify({ provider, status: "needs_reauth" }),
        riskLevel: "medium",
      });
      res.redirect(302, completeRedirect(provider, "failed"));
    }
  });
}
