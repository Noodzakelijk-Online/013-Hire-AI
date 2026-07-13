import type { ProfileEvidenceProviderId } from "./profileEvidenceControl";

export type ConnectorProviderId = Exclude<ProfileEvidenceProviderId, "resume">;
export type ConnectorRequestAction = "start_oauth" | "record_request";

/**
 * OAuth is only useful when the provider and deployment can actually support it.
 * Manual evidence sources stay visible in the ledger without pretending external access exists.
 */
export function getConnectorRequestAction(
  provider: ConnectorProviderId,
  oauthAvailable: boolean | undefined
): ConnectorRequestAction {
  if (provider === "portfolio" || oauthAvailable === false) return "record_request";
  return "start_oauth";
}
