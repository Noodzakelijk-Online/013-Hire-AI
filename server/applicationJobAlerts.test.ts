import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  limit: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: mocks.getDb,
}));

import { processJobAlerts } from "./applicationFeatures";

describe("job alert processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a matching alert refresh without sending an external notification", async () => {
    const alert = {
      id: 412,
      userId: 82,
      name: "Remote TypeScript roles",
      keywords: "TypeScript, React",
      locations: "Remote",
      platforms: "Remote OK",
      minSalary: 100000,
      jobTypes: "full-time",
      frequency: "daily",
      lastTriggered: null,
    };
    mocks.select
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([alert]) }) })
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve([{
          id: 1,
          title: "TypeScript Engineer",
          description: "Build React applications",
          location: "Remote worldwide",
          platformId: 7,
          salaryMax: 150000,
          jobType: "full-time",
        }]) }),
      })
      .mockReturnValueOnce({ from: () => Promise.resolve([{ id: 7, name: "Remote OK" }]) });
    mocks.update.mockReturnValue({ set: () => ({ where: mocks.where.mockResolvedValue(undefined) }) });
    mocks.getDb.mockResolvedValue({ select: mocks.select, update: mocks.update });

    await expect(processJobAlerts()).resolves.toEqual({ processed: 1, externalNotifications: 0 });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.where).toHaveBeenCalledTimes(1);
  });

  it("does not mark an alert as refreshed when active jobs miss its criteria", async () => {
    const alert = {
      id: 413,
      userId: 82,
      name: "Senior Go roles",
      keywords: "Go",
      locations: "Europe",
      platforms: "We Work Remotely",
      minSalary: 120000,
      jobTypes: "contract",
      frequency: "daily",
      lastTriggered: null,
    };
    mocks.select
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([alert]) }) })
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve([{
          id: 2,
          title: "Go Engineer",
          location: "Remote, Europe",
          platformId: 3,
          salaryMax: 160000,
          jobType: "full-time",
        }]) }),
      })
      .mockReturnValueOnce({ from: () => Promise.resolve([{ id: 3, name: "We Work Remotely" }]) });
    mocks.getDb.mockResolvedValue({ select: mocks.select, update: mocks.update });

    await expect(processJobAlerts()).resolves.toEqual({ processed: 0, externalNotifications: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
