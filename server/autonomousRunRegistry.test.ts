import { describe, expect, it } from "vitest";
import { AutonomousRunRegistry } from "./autonomousRunRegistry";

describe("AutonomousRunRegistry", () => {
  it("releases a successful run", async () => {
    const registry = new AutonomousRunRegistry<string>();
    const run = registry.track(1, Promise.resolve("done"));

    expect(registry.get(1)).toBe(run);
    await expect(run).resolves.toBe("done");
    expect(registry.has(1)).toBe(false);
  });

  it("releases a failed run so the user can retry", async () => {
    const registry = new AutonomousRunRegistry<string>();
    const failedRun = registry.track(1, Promise.reject(new Error("database unavailable")));

    await expect(failedRun).rejects.toThrow("database unavailable");
    expect(registry.has(1)).toBe(false);

    const retry = registry.track(1, Promise.resolve("recovered"));
    await expect(retry).resolves.toBe("recovered");
  });
});
