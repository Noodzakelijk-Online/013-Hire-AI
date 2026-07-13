import { describe, expect, it } from "vitest";
import { createJobMatch, getUserJobMatches } from "./db";

describe("job match persistence", () => {
  it("updates one current match record for each user and job", async () => {
    const userId = 991001;
    const jobId = 881001;

    const firstWrite = await createJobMatch({
      userId,
      jobId,
      matchScore: 62,
      matchReasons: "Initial profile match",
      skillsMatch: 50,
      experienceMatch: 60,
      locationMatch: 80,
      salaryMatch: 70,
    });
    const recalculation = await createJobMatch({
      userId,
      jobId,
      matchScore: 88,
      matchReasons: "Updated profile evidence improves the match",
      skillsMatch: 90,
      experienceMatch: 85,
      locationMatch: 80,
      salaryMatch: 95,
    });

    const matches = await getUserJobMatches(userId, 0);

    expect(recalculation).toMatchObject({ insertId: firstWrite.insertId, existing: true });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      userId,
      jobId,
      matchScore: 88,
      matchReasons: "Updated profile evidence improves the match",
      skillsMatch: 90,
      experienceMatch: 85,
      locationMatch: 80,
      salaryMatch: 95,
    });
    expect(matches[0].updatedAt).toBeInstanceOf(Date);
  });

  it("filters the current records by the requested threshold", async () => {
    const userId = 991002;
    await createJobMatch({ userId, jobId: 881002, matchScore: 44 });
    await createJobMatch({ userId, jobId: 881003, matchScore: 78 });

    const matches = await getUserJobMatches(userId, 70);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ jobId: 881003, matchScore: 78 });
  });
});
