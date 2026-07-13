/**
 * Emits a fixed operational marker without accepting an error object. This keeps
 * sensitive provider, resume, connector, and database details out of logs.
 */
export function logOperationalFailure(scope: string, operation: string): void {
  console.error(`[${scope}] ${operation} failed.`);
}
