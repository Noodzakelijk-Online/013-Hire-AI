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

  it("records completed runs and source errors without claiming the scheduler is stopped", async () => {
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
      errors: ["We Work Remotely: Rate limited"],
    });
  });

  it("reports start and stop state for deployment health checks", () => {
    const scheduler = new JobScrapingScheduler({ intervalMinutes: 60, maxJobsPerRun: 25 });

    scheduler.start();
    expect(scheduler.getStatus().isStarted).toBe(true);

    scheduler.stop();
    expect(scheduler.getStatus()).toMatchObject({ isStarted: false, nextRunAt: null });
  });

  it("applies a revised runtime configuration before the next discovery run", () => {
    const scheduler = new JobScrapingScheduler({ intervalMinutes: 60, maxJobsPerRun: 25 });

    scheduler.updateConfig({ intervalMinutes: 120, maxJobsPerRun: 80 });

    expect(scheduler.getStatus()).toMatchObject({
      intervalMinutes: 120,
      maxJobsPerRun: 80,
      isStarted: false,
    });
  });

  it("updates an existing scheduler singleton with operator configuration", () => {
    const initial = getScheduler({ intervalMinutes: 30, maxJobsPerRun: 40 });
    const updated = getScheduler({ intervalMinutes: 90, maxJobsPerRun: 75 });

    expect(updated).toBe(initial);
    expect(updated.getStatus()).toMatchObject({ intervalMinutes: 90, maxJobsPerRun: 75 });
  });
});
