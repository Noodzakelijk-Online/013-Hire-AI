import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getScraperManager: vi.fn(),
  runScrapingCycle: vi.fn(),
}));

vi.mock("./scraperManager", () => ({
  getScraperManager: mocks.getScraperManager,
}));

import { JobScrapingScheduler } from "./scheduler";

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
});
