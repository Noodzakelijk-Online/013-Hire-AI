export type ApplicationDeepLinkAction = "view" | "schedule-interview" | "employer-response" | "follow-up" | "send-follow-up";

export interface ApplicationDeepLink {
  applicationId: number;
  action: ApplicationDeepLinkAction;
}

const DEFAULT_ACTION: ApplicationDeepLinkAction = "view";
const SUPPORTED_ACTIONS = new Set<ApplicationDeepLinkAction>([
  "view",
  "schedule-interview",
  "employer-response",
  "follow-up",
  "send-follow-up",
]);

export function getApplicationDeepLink(
  applicationId: number,
  action: ApplicationDeepLinkAction = DEFAULT_ACTION
) {
  const params = new URLSearchParams();
  params.set("applicationId", String(applicationId));
  if (action !== DEFAULT_ACTION) {
    params.set("action", action);
  }
  return `/applications?${params.toString()}`;
}

export function parseApplicationDeepLink(searchOrPath: string): ApplicationDeepLink | null {
  const search = searchOrPath.includes("?")
    ? searchOrPath.slice(searchOrPath.indexOf("?"))
    : searchOrPath;
  const params = new URLSearchParams(search);
  const rawApplicationId = params.get("applicationId");
  const applicationId = rawApplicationId ? Number.parseInt(rawApplicationId, 10) : Number.NaN;
  if (!Number.isFinite(applicationId) || applicationId <= 0) {
    return null;
  }

  const rawAction = params.get("action") || DEFAULT_ACTION;
  const action = SUPPORTED_ACTIONS.has(rawAction as ApplicationDeepLinkAction)
    ? rawAction as ApplicationDeepLinkAction
    : DEFAULT_ACTION;

  return { applicationId, action };
}
