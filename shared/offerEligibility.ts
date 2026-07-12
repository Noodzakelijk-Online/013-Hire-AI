export function isOfferEligibleApplicationStatus(status?: string | null): boolean {
  return status === "offer" || status === "accepted";
}

export function isAcceptedOfferApplicationStatus(status?: string | null): boolean {
  return status === "accepted";
}
