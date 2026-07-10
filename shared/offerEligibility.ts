export function isOfferEligibleApplicationStatus(status?: string | null): boolean {
  return status === "offer" || status === "accepted";
}
