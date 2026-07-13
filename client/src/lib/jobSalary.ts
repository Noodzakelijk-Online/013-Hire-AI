import { normalizeSalaryCurrency } from "@shared/salaryCurrency";

function formatSalaryAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatJobSalary(
  min?: number | null,
  max?: number | null,
  salaryCurrency?: string | null
) {
  if (!min && !max) return "Not specified";

  const currency = normalizeSalaryCurrency(salaryCurrency);
  if (min && max) return `${formatSalaryAmount(min, currency)} - ${formatSalaryAmount(max, currency)}`;
  if (min) return `${formatSalaryAmount(min, currency)}+`;
  return `Up to ${formatSalaryAmount(max!, currency)}`;
}
