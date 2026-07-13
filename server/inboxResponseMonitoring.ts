import {
  createAuditEvent,
  listUserConnectorAccounts,
  upsertInboxResponseCandidate,
} from "./db";
import {
  discoverInboxResponseCandidates,
  type InboxProvider,
} from "./inboxResponseDiscovery";
import { isConnectorAuthorizationStale } from "@shared/profileEvidence";

const REQUIRED_SCOPE: Record<InboxProvider, string> = {
  gmail: "email.messages.read_recruiting",
  outlook: "mail.messages.read_recruiting",
};

function hasRequiredScope(value: string | null, provider: InboxProvider) {
  try {
    const scopes = value ? JSON.parse(value) : [];
    return Array.isArray(scopes) && scopes.includes(REQUIRED_SCOPE[provider]);
  } catch {
    return false;
  }
}

function needsInboxReauthorization(
  account: Awaited<ReturnType<typeof listUserConnectorAccounts>>[number] | undefined,
  provider: InboxProvider
) {
  return account?.status === "needs_reauth" || (
    account?.status === "connected" &&
    hasRequiredScope(account.consentScopes, provider) &&
    isConnectorAuthorizationStale(account.lastVerifiedAt)
  );
}

export type InboxMonitoringResult = {
  providersScanned: number;
  inboxReauthorizationRequired: number;
  candidatesDiscovered: number;
  monitoringFailures: number;
  errors: string[];
};

type InboxResponseMonitoringDependencies = {
  createAuditEvent: typeof createAuditEvent;
  listUserConnectorAccounts: typeof listUserConnectorAccounts;
  upsertInboxResponseCandidate: typeof upsertInboxResponseCandidate;
  discoverInboxResponseCandidates: typeof discoverInboxResponseCandidates;
};

const defaults: InboxResponseMonitoringDependencies = {
  createAuditEvent,
  listUserConnectorAccounts,
  upsertInboxResponseCandidate,
  discoverInboxResponseCandidates,
};

async function recordMonitoringAudit(
  dependencies: InboxResponseMonitoringDependencies,
  input: Parameters<InboxResponseMonitoringDependencies["createAuditEvent"]>[0]
) {
  try {
    await dependencies.createAuditEvent(input);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Read recruitment-message metadata only after consent. Candidate classifications
 * remain pending until the user confirms them through the application ledger.
 */
export async function monitorInboxResponses(
  userId: number,
  options: { dependencies?: InboxResponseMonitoringDependencies } = {}
): Promise<InboxMonitoringResult> {
  const dependencies = options.dependencies ?? defaults;
  const result: InboxMonitoringResult = {
    providersScanned: 0,
    inboxReauthorizationRequired: 0,
    candidatesDiscovered: 0,
    monitoringFailures: 0,
    errors: [],
  };
  let accounts: Awaited<ReturnType<typeof listUserConnectorAccounts>>;
  try {
    accounts = await dependencies.listUserConnectorAccounts(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.monitoringFailures = 1;
    result.errors.push(`accounts: ${message}`);
    return result;
  }
  const providers = (["gmail", "outlook"] as const).filter((provider) => {
    const account = accounts.find((item) => item.provider === provider);
    return account?.status === "connected" &&
      hasRequiredScope(account.consentScopes, provider) &&
      !isConnectorAuthorizationStale(account.lastVerifiedAt);
  });
  const reauthorizationRequiredProviders = new Set<InboxProvider>(
    (["gmail", "outlook"] as const).filter((provider) =>
      needsInboxReauthorization(accounts.find((item) => item.provider === provider), provider)
    )
  );
  result.inboxReauthorizationRequired = reauthorizationRequiredProviders.size;

  for (const provider of providers) {
    try {
      const candidates = await dependencies.discoverInboxResponseCandidates(userId, provider);
      result.providersScanned += 1;
      const persisted = await Promise.all(candidates.map((candidate) =>
        dependencies.upsertInboxResponseCandidate({
          userId,
          applicationId: candidate.applicationId,
          provider: candidate.provider,
          messageId: candidate.messageId,
          sender: candidate.sender,
          subject: candidate.subject,
          preview: candidate.preview,
          receivedAt: new Date(candidate.receivedAt),
          suggestedResponseType: candidate.suggestedResponseType,
          confidence: candidate.confidence,
        })
      ));
      const newCandidates = persisted.filter((item) => !item.existing).length;
      result.candidatesDiscovered += newCandidates;
      const auditError = await recordMonitoringAudit(dependencies, {
        userId,
        entityType: "user",
        entityId: userId,
        action: "inbox_response_monitoring_scanned",
        actor: "system",
        source: "autonomousService",
        afterState: JSON.stringify({ provider, candidateCount: newCandidates, externalWritePerformed: false }),
        riskLevel: "low",
      });
      if (auditError) {
        result.monitoringFailures += 1;
        result.errors.push(`${provider}: unable to record inbox monitoring audit (${auditError})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.monitoringFailures += 1;
      result.errors.push(`${provider}: ${message}`);
      // A provider request can invalidate a previously healthy grant. Re-read
      // the connector account so this same autonomous run exposes the
      // actionable reauthorization state instead of only a generic failure.
      try {
        const updatedAccounts = await dependencies.listUserConnectorAccounts(userId);
        const updatedAccount = updatedAccounts.find((item) => item.provider === provider);
        if (needsInboxReauthorization(updatedAccount, provider)) {
          reauthorizationRequiredProviders.add(provider);
          result.inboxReauthorizationRequired = reauthorizationRequiredProviders.size;
        }
      } catch {
        // The original provider failure remains the durable signal. A failed
        // status refresh must not replace it or invent a reauthorization state.
      }
      const auditError = await recordMonitoringAudit(dependencies, {
        userId,
        entityType: "user",
        entityId: userId,
        action: "inbox_response_monitoring_failed",
        actor: "system",
        source: "autonomousService",
        afterState: JSON.stringify({ provider, reason: message, externalWritePerformed: false }),
        riskLevel: "medium",
      });
      if (auditError) {
        result.errors.push(`${provider}: unable to record inbox monitoring failure (${auditError})`);
      }
    }
  }

  return result;
}
