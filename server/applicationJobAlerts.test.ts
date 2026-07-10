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
      frequency: "daily",
      lastTriggered: null,
    };
    mocks.select
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([alert]) }) })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({ limit: mocks.limit.mockResolvedValue([{ id: 1, title: "TypeScript Engineer" }]) }),
        }),
      });
    mocks.update.mockReturnValue({ set: () => ({ where: mocks.where.mockResolvedValue(undefined) }) });
    mocks.getDb.mockResolvedValue({ select: mocks.select, update: mocks.update });

    await expect(processJobAlerts()).resolves.toEqual({ processed: 1, externalNotifications: 0 });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.where).toHaveBeenCalledTimes(1);
  });
});
