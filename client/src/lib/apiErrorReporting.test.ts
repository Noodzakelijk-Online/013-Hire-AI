import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_MUTATION_FAILURE_LOG,
  API_QUERY_FAILURE_LOG,
  reportApiMutationFailure,
  reportApiQueryFailure,
} from "./apiErrorReporting";

describe("API error reporting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses fixed diagnostics instead of raw query failure details", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportApiQueryFailure({
      message: "Bearer provider-secret",
      queryKey: ["jobs.list", { search: "candidate-private-input" }],
    });

    expect(errorSpy).toHaveBeenCalledWith(API_QUERY_FAILURE_LOG);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("provider-secret");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("candidate-private-input");
  });

  it("uses fixed diagnostics instead of raw mutation failure details", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportApiMutationFailure(new Error("Bearer worker-secret"));

    expect(errorSpy).toHaveBeenCalledWith(API_MUTATION_FAILURE_LOG);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("worker-secret");
  });
});
