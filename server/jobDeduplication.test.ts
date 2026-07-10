import { describe, expect, it } from "vitest";
import { compareJobsForDeduplication, findBestJobDuplicateCandidate } from "./jobDeduplication";

describe("job deduplication", () => {
  it("matches canonical application URLs across tracking parameters", () => {
    const match = compareJobsForDeduplication(
      { applicationUrl: "https://boards.greenhouse.io/acme/jobs/123?source=remoteok" },
      { applicationUrl: "https://boards.greenhouse.io/acme/jobs/123?gh_src=linkedin" }
    );

    expect(match).toMatchObject({ isDuplicate: true, similarity: 1, reason: "application_url" });
  });

  it("preserves query parameters that identify different jobs", () => {
    const match = compareJobsForDeduplication(
      { applicationUrl: "https://careers.example.com/apply?jobId=123" },
      { applicationUrl: "https://careers.example.com/apply?jobId=456" }
    );

    expect(match.isDuplicate).toBe(false);
  });

  it("matches strongly overlapping cross-platform job content", () => {
    const match = compareJobsForDeduplication(
      {
        company: "Acme Technologies",
        title: "Senior Software Engineer - Remote",
        description: "Build distributed TypeScript services with Node.js, PostgreSQL, AWS, and Kubernetes.",
      },
      {
        company: "Acme Technologies",
        title: "Senior Software Engineer",
        description: "Build distributed TypeScript services using Node.js, PostgreSQL, AWS and Kubernetes.",
      }
    );

    expect(match.isDuplicate).toBe(true);
    expect(match.reason).toBe("content");
  });

  it("keeps distinct openings with the same generic title", () => {
    const match = compareJobsForDeduplication(
      {
        company: "Acme",
        title: "Software Engineer",
        description: "Develop iOS applications with Swift and UIKit.",
      },
      {
        company: "Acme",
        title: "Software Engineer",
        description: "Build data pipelines with Python, Spark, and Airflow.",
      }
    );

    expect(match.isDuplicate).toBe(false);
  });

  it("chooses the strongest canonical source deterministically before linking a duplicate", () => {
    const match = findBestJobDuplicateCandidate(
      {
        company: "Acme Technologies",
        title: "Senior Software Engineer - Remote",
        description: "Build distributed TypeScript services with Node.js, PostgreSQL, AWS, and Kubernetes.",
      },
      [
        {
          id: 9,
          company: "Acme Technologies",
          title: "Senior Software Engineer",
          description: "Build distributed TypeScript services with Node.js, PostgreSQL, AWS, and Kubernetes.",
        },
        {
          id: 3,
          company: "Acme Technologies",
          title: "Senior Software Engineer",
          description: "Build distributed TypeScript services using Node.js, PostgreSQL, AWS and Kubernetes.",
        },
      ]
    );

    expect(match).toMatchObject({
      job: { id: 9 },
      match: { isDuplicate: true, reason: "content" },
    });
  });

  it("does not create a source link when no candidate is a duplicate", () => {
    const match = findBestJobDuplicateCandidate(
      {
        company: "Acme",
        title: "Software Engineer",
        description: "Develop iOS applications with Swift and UIKit.",
      },
      [
        {
          id: 4,
          company: "Acme",
          title: "Software Engineer",
          description: "Build data pipelines with Python, Spark, and Airflow.",
        },
      ]
    );

    expect(match).toBeNull();
  });
});
