import type { SuccessFee } from "../drizzle/schema";

export type SuccessFeeStatus = NonNullable<SuccessFee["status"]>;

const ALLOWED_TRANSITIONS: Record<SuccessFeeStatus, ReadonlySet<SuccessFeeStatus>> = {
  pending_verification: new Set<SuccessFeeStatus>(["active", "paused", "ended", "suspended", "disputed"]),
  active: new Set<SuccessFeeStatus>(["paused", "suspended", "ended", "disputed"]),
  paused: new Set<SuccessFeeStatus>(["active", "ended", "disputed"]),
  suspended: new Set<SuccessFeeStatus>(["active", "paused", "ended", "disputed"]),
  disputed: new Set<SuccessFeeStatus>(["paused", "ended"]),
  ended: new Set<SuccessFeeStatus>(),
};

export function canTransitionSuccessFeeStatus(
  from: SuccessFeeStatus,
  to: SuccessFeeStatus,
) {
  return from === to || ALLOWED_TRANSITIONS[from].has(to);
}

export function assertSuccessFeeTransition(
  from: SuccessFeeStatus,
  to: SuccessFeeStatus,
) {
  if (!canTransitionSuccessFeeStatus(from, to)) {
    throw new Error(`Invalid success-fee transition: ${from} -> ${to}`);
  }
}
