export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function calculateNextVerificationDue(fromDate: Date = new Date()): Date {
  return addUtcDays(fromDate, 90);
}

export function calculateVerificationGraceExpiry(fromDate: Date): Date {
  return addUtcDays(fromDate, 14);
}
