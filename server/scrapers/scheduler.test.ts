import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getScraperManager: vi.fn(),
  runScrapingCycle: vi.fn(),
}));

vi.mock("./scraperManager", () => ({
  getScraperManager: mocks.getScraperManager,
}));

import { getScheduler, JobScrapingScheduler } from "./scheduler";

describe("job scraping scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getScraperManager.mockResolvedValue({ runScrapingCycle: mocks.runScrapingCycle });
    mocks.runScrapingCycle.mockResolvedValue({
      totalSaved: 3,
      platformResults: {
        RemoteOK: { errors: [] },
        "We Work Remotely": { errors: ["Rate limited"] },
      },
    });
  });

  it("records a partial cycle when one source reports an error", async () => {
    const scheduler = new JobScrapingScheduler({ intervalMinutes: 60, maxJobsPerRun: 25 });

    await scheduler.runScraping();

    expect(mocks.runScrapingCycle).toHaveBeenCalledWith({ limit: 25 });
    expect(scheduler.getStatus()).toMatchObject({
      isStarted: false,
      isRunning: false,
      intervalMinutes: 60,
      maxJobsPerRun: 25,
      totalJobsScraped: 3,
      totalRunsCompleted: 1,
      totalSuccessfulRuns: 0,
      totalPartialRuns: 1,
      totalFailedRuns: 0,
      lastRunOutcome: "partial",
      errors: ["We Work Remotely: Rate limited"],
    });
  });

  it("records a clean cycle only when every source succeeds", async () => {
    mocks.runScrapingCycle.mockResolvedValueOnce({
      totalSaved: 4,
      platformResults: {
        RemoteOK: { errors: [] },
        Remotive: { errors: [] },
      },
    });
    const scheduler = new JobScrapingScheduler({ intervalMinutes: 60, maxJobsPerRun: 25 });

    await scheduler.runScraping();

    expect(scheduler.getStatus()).toMatchObject({
      totalRunsCompleted: 1,
      totalSuccessfulRuns: 1,
      totalPartialRuns: 0,
      totalFailedRuns: 0,
      lastRunOutcome: "success",
      errors: [],
    });
  });

  it("records a failed cycle when every requested source fails", async () => {
    mocks.runScrapingCycle.mockResolvedValueOnce({
      totalSaved: 0,
      platformResults: {
        RemoteOK: { errors: ["HTTP 429"] },
        Remotive: { errors: ["HTTP 503"] },
      },
    });
    const scheduler = new JobScrapingScheduler({ intervalMinutes: 60, maxJobsPerRun: 25 });

    await scheduler.runScraping();

    expect(scheduler.getStatus()).toMatchObject({
      totalRunsCompleted: 1,
      totalSuccessfulRuns: 0,
      totalPartialRuns: 0,
      totalFailedRuns: 1,
      lastRunOutcome: "failed",
    });
  });

  it("passes an explicit platform allowlist to a discovery run", async () => {
    const scheduler = new JobScrapingScheduler({
      intervalMinutes: 60,
      maxJobsPerRun: 25,
      enabledPlatforms: ["RemoteOK", "Remotive"],
    });

    await scheduler.runScraping();

    expect(mocks.runScrapingCycle).toHaveBeenCalledWith({
      limit: 25,
      platformNames: ["RemoteOK", "Remotive"],
    });
    expect(scheduler.getStatus().enabledPlatforms).toEqual(["RemoteOK", "Remotive"]);
  });

  it("reports start and stop state for deployment health checks", () => {
    const scheduler = new JobScrapingScheduler({ intervalMinutes: 60, maxJobsPerRun: 25 });

    scheduler.start();
    expect(scheduler.getStatus().isStarted).toBe(true);

    scheduler.stop();
    expect(scheduler.getStatus()).toMatchObject({ isStarted: false, nextRunAt: null });
  });

  it("applies a revised runtime configuration before the next discovery run", () => {
    const scheduler = new JobScrapingScheduler({
      intervalMinutes: 60,
      maxJobsPerRun: 25,
      enabledPlatforms: ["RemoteOK"],
    });

    scheduler.updateConfig({
      intervalMinutes: 120,
      maxJobsPerRun: 80,
      enabledPlatforms: null,
    });

    expect(scheduler.getStatus()).toMatchObject({
      intervalMinutes: 120,
      maxJobsPerRun: 80,
      isStarted: false,
      enabledPlatforms: null,
    });
  });

  it("updates an existing scheduler singleton with operator configuration", () => {
    const initial = getScheduler({
      intervalMinutes: 30,
      maxJobsPerRun: 40,
      enabledPlatforms: ["RemoteOK"],
    });
    const updated = getScheduler({ maxJobsPerRun: 75 });

    expect(updated).toBe(initial);
    expect(updated.getStatus()).toMatchObject({
      intervalMinutes: 30,
      maxJobsPerRun: 75,
      enabledPlatforms: ["RemoteOK"],
    });
  });
});
