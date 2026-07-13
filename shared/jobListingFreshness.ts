export const MAX_LISTING_OBSERVATION_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type ListingDate = Date | string | null | undefined;

export type JobListingFreshnessInput = {
  isActive?: number | boolean | null;
  expiryDate?: ListingDate;
  updatedAt?: ListingDate;
  createdAt?: ListingDate;
};

function dateMilliseconds(value: ListingDate) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const milliseconds = date.getTime();
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

/**
 * Listings without a provider expiry remain current only while their source
 * has re-observed them. This prevents an active database row from becoming an
 * indefinitely eligible autonomous application target.
 */
export function isJobListingCurrent(
  listing: JobListingFreshnessInput,
  now = new Date()
) {
  if (listing.isActive !== 1 && listing.isActive !== true) return false;
  const expiryMilliseconds = dateMilliseconds(listing.expiryDate);
  if (listing.expiryDate) return expiryMilliseconds !== null && expiryMilliseconds > now.getTime();

  const observedMilliseconds = dateMilliseconds(listing.updatedAt) ?? dateMilliseconds(listing.createdAt);
  return observedMilliseconds !== null && observedMilliseconds > now.getTime() - MAX_LISTING_OBSERVATION_AGE_MS;
}

export function getListingObservationCutoff(now = new Date()) {
  return new Date(now.getTime() - MAX_LISTING_OBSERVATION_AGE_MS);
}
