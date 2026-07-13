import { isConnectorAuthorizationStale } from "@shared/profileEvidence";
import { decryptConnectorToken } from "./connectorOAuth";
import { getConnectorAuthorization, getUserApplications, listUserConnectorAccounts } from "./db";

export type InboxProvider = "gmail" | "outlook";
export type InboxResponseType = "rejection" | "interview_invite" | "offer" | "employer_question" | "other";

export type InboxResponseCandidate = {
  provider: InboxProvider;
  messageId: string;
  applicationId: number;
  company: string;
  jobTitle: string;
  sender: string | null;
  subject: string;
  preview: string;
  receivedAt: string;
  suggestedResponseType: InboxResponseType;
  confidence: "high" | "medium";
};

const MAX_MESSAGES = 50;
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export type InboxResponseDiscoveryDependencies = {
  getConnectorAuthorization: typeof getConnectorAuthorization;
  getUserApplications: typeof getUserApplications;
  listUserConnectorAccounts: typeof listUserConnectorAccounts;
  decryptConnectorToken: typeof decryptConnectorToken;
};

const defaults: InboxResponseDiscoveryDependencies = {
  getConnectorAuthorization,
  getUserApplications,
  listUserConnectorAccounts,
  decryptConnectorToken,
};

function displayName(provider: InboxProvider) {
  return provider === "gmail" ? "Gmail" : "Outlook";
}

function parseScopes(value: string | null) {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === "string") : [];
  } catch {
    return [];
  }
}

async function getInboxAccess(
  userId: number,
  provider: InboxProvider,
  now: Date,
  dependencies: InboxResponseDiscoveryDependencies
) {
  const account = (await dependencies.listUserConnectorAccounts(userId))
    .find((item) => item.provider === provider);
  const requiredScope = provider === "gmail" ? "email.messages.read_recruiting" : "mail.messages.read_recruiting";
  if (
    !account ||
    account.status !== "connected" ||
    !parseScopes(account.consentScopes).includes(requiredScope) ||
    isConnectorAuthorizationStale(account.lastVerifiedAt, now)
  ) {
    throw new Error(`${displayName(provider)} must be freshly authorized with recruiting-message consent before inbox discovery.`);
  }
  const authorization = await dependencies.getConnectorAuthorization(userId, provider);
  if (!authorization || !authorization.accessTokenExpiresAt || authorization.accessTokenExpiresAt.getTime() <= now.getTime() + TOKEN_EXPIRY_SKEW_MS) {
    throw new Error(`${displayName(provider)} authorization has expired. Reauthorize before inbox discovery.`);
  }
  return dependencies.decryptConnectorToken(authorization.encryptedAccessToken);
}

function classifyResponse(text: string): InboxResponseType {
  const value = text.toLowerCase();
  if (/\b(interview|phone screen|technical screen|schedule (a |an )?(call|meeting)|meet the team)\b/.test(value)) return "interview_invite";
  if (/\b(unfortunately|not moving forward|regret to inform|position has been filled|will not be proceeding)\b/.test(value)) return "rejection";
  if (/\b(offer|compensation package|employment agreement)\b/.test(value)) return "offer";
  if (/\b(question|clarify|could you|please (share|send|confirm)|availability)\b/.test(value)) return "employer_question";
  return "other";
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findApplicationMatch(
  text: string,
  applications: Awaited<ReturnType<typeof getUserApplications>>
) {
  const haystack = normalized(text);
  const matches = applications
    .filter((application) => application.status !== "rejected" && application.status !== "withdrawn")
    .map((application) => {
      const company = normalized(application.job?.company || "");
      const title = normalized(application.job?.title || "");
      let score = company.length >= 3 && haystack.includes(company) ? 2 : 0;
      if (title.length >= 8 && haystack.includes(title)) score += 1;
      return { application, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = matches[0];
  if (!best || (matches[1] && matches[1].score === best.score)) return null;
  const company = typeof best.application.job?.company === "string" ? best.application.job.company : "";
  const jobTitle = typeof best.application.job?.title === "string" ? best.application.job.title : "";
  if (!company || !jobTitle) return null;
  return {
    applicationId: best.application.id,
    company,
    jobTitle,
    confidence: best.score >= 3 ? "high" as const : "medium" as const,
  };
}

function gmailHeaders(payload: Record<string, unknown>) {
  const headers = Array.isArray((payload.payload as { headers?: unknown } | undefined)?.headers)
    ? (payload.payload as { headers: Array<{ name?: unknown; value?: unknown }> }).headers
    : [];
  const value = (name: string) => headers.find((header) => String(header.name).toLowerCase() === name.toLowerCase())?.value;
  const sender = value("From");
  const subject = value("Subject");
  const receivedAt = value("Date");
  return {
    sender: typeof sender === "string" ? sender : null,
    subject: typeof subject === "string" ? subject : "",
    receivedAt: typeof receivedAt === "string" ? receivedAt : null,
  };
}

export async function discoverInboxResponseCandidates(
  userId: number,
  provider: InboxProvider,
  options: { fetcher?: typeof fetch; now?: Date; dependencies?: InboxResponseDiscoveryDependencies } = {}
): Promise<InboxResponseCandidate[]> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const dependencies = options.dependencies ?? defaults;
  const accessToken = await getInboxAccess(userId, provider, now, dependencies);
  const applications = await dependencies.getUserApplications(userId);
  if (provider === "gmail") {
    const list = await fetcher("https://gmail.googleapis.com/gmail/v1/users/me/messages?" + new URLSearchParams({
      maxResults: String(MAX_MESSAGES),
      q: "newer_than:30d",
    }), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!list.ok) throw new Error("Gmail inbox discovery is temporarily unavailable.");
    const payload = await list.json() as { messages?: Array<{ id?: unknown }> };
    const messages = Array.isArray(payload.messages) ? payload.messages.slice(0, MAX_MESSAGES) : [];
    const candidates: InboxResponseCandidate[] = [];
    for (const message of messages) {
      if (typeof message.id !== "string" || !message.id) continue;
      const detail = await fetcher(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!detail.ok) continue;
      const metadata = await detail.json() as Record<string, unknown>;
      const headers = gmailHeaders(metadata);
      const preview = typeof metadata.snippet === "string" ? metadata.snippet.slice(0, 600) : "";
      const match = findApplicationMatch(`${headers.sender || ""} ${headers.subject} ${preview}`, applications);
      const received = headers.receivedAt ? new Date(headers.receivedAt) : now;
      if (!match || Number.isNaN(received.getTime())) continue;
      candidates.push({
        provider,
        messageId: message.id,
        ...match,
        sender: headers.sender,
        subject: headers.subject.slice(0, 500),
        preview,
        receivedAt: received.toISOString(),
        suggestedResponseType: classifyResponse(`${headers.subject} ${preview}`),
      });
    }
    return candidates;
  }

  const response = await fetcher("https://graph.microsoft.com/v1.0/me/messages?" + new URLSearchParams({
    "$top": String(MAX_MESSAGES),
    "$select": "id,subject,from,receivedDateTime,bodyPreview",
    "$orderby": "receivedDateTime desc",
  }), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Outlook inbox discovery is temporarily unavailable.");
  const payload = await response.json() as { value?: Array<Record<string, unknown>> };
  return (Array.isArray(payload.value) ? payload.value : []).flatMap((message): InboxResponseCandidate[] => {
    const messageId = typeof message.id === "string" ? message.id : "";
    const subject = typeof message.subject === "string" ? message.subject : "";
    const preview = typeof message.bodyPreview === "string" ? message.bodyPreview.slice(0, 600) : "";
    const received = typeof message.receivedDateTime === "string" ? new Date(message.receivedDateTime) : null;
    const sender = typeof (message.from as { emailAddress?: { address?: unknown } } | undefined)?.emailAddress?.address === "string"
      ? (message.from as { emailAddress: { address: string } }).emailAddress.address
      : null;
    const match = findApplicationMatch(`${sender || ""} ${subject} ${preview}`, applications);
    if (!messageId || !match || !received || Number.isNaN(received.getTime())) return [];
    return [{
      provider,
      messageId,
      ...match,
      sender,
      subject: subject.slice(0, 500),
      preview,
      receivedAt: received.toISOString(),
      suggestedResponseType: classifyResponse(`${subject} ${preview}`),
    }];
  });
}
