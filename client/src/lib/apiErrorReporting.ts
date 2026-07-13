export const API_QUERY_FAILURE_LOG = "[API Query Error] Request failed.";
export const API_MUTATION_FAILURE_LOG = "[API Mutation Error] Request failed.";

/**
 * Query keys and tRPC error objects can include user input or upstream provider
 * details. Keep browser diagnostics operational without putting those values in
 * a shared console.
 */
export function reportApiQueryFailure(_error: unknown): void {
  console.error(API_QUERY_FAILURE_LOG);
}

export function reportApiMutationFailure(_error: unknown): void {
  console.error(API_MUTATION_FAILURE_LOG);
}
