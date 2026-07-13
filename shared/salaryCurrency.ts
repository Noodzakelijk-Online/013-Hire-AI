export const DEFAULT_SALARY_CURRENCY = "USD";

export function normalizeSalaryCurrency(value?: string | null, fallback = DEFAULT_SALARY_CURRENCY) {
  const currency = value?.trim().toUpperCase();
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : fallback;
}

export function areSalaryCurrenciesComparable(
  jobCurrency?: string | null,
  profileCurrency?: string | null
) {
  return normalizeSalaryCurrency(jobCurrency) === normalizeSalaryCurrency(profileCurrency);
}
