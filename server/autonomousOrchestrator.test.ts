import { describe, expect, it } from "vitest";
import type { Application, Job, UserProfile } from "../drizzle/schema";
import {
  buildAutonomousPlan,
  getExecutableDecisions,
  isJobCurrentForAutonomousProcessing,
  parseAutonomousPreferences,
} from "./autonomousOrchestrator";

const baseJob: Job = {
  id: 1,
  externalId: "job-1",
  title: "Senior React Engineer",
  company: "Example Co",
  description: "Build React and TypeScript products with Node.js.",
  requirements: "React, TypeScript, Node.js",
  responsibilities: null,
  benefits: null,
  location: "Remote - Worldwide",
  jobType: "full-time",
  salaryMin: 120000,
  salaryMax: 160000,
  salaryCurrency: "USD",
  skills: "React, TypeScript, Node.js",
  applicationUrl: "https://boards.greenhouse.io/example/jobs/1",
  applicationEmail: null,
  applicationProcess: "greenhouse",
  platformId: 1,
  sourceUrl: null,
  postedDate: new Date(),
  expiryDate: null,
  isActive: 1,
  visaSponsorshipAvailable: 1,
  openHiringSupport: 0,
  diversityFriendly: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const profile: Partial<UserProfile> = {
  skills: "React, TypeScript, Node.js",
  desiredJobTypes: "full-time",
  desiredLocations: "remote, worldwide",
  salaryExpectationMin: 100000,
  resumeUrl: "https://example.com/resume.pdf",
};

describe("autonomous orchestrator", () => {
  it("normalizes unsafe persisted daily limits", () => {
    expect(parseAutonomousPreferences("{}").autonomousEnabled).toBe(false);
    expect(parseAutonomousPreferences('{"autonomousEnabled":true}').autonomousEnabled).toBe(true);
    expect(parseAutonomousPreferences('{"dailyApplicationLimit":100}').dailyApplicationLimit).toBe(25);
    expect(parseAutonomousPreferences('{"dailyApplicationLimit":0}').dailyApplicationLimit).toBe(1);
    expect(parseAutonomousPreferences('{"dailyApplicationLimit":7.6}').dailyApplicationLimit).toBe(8);
    expect(parseAutonomousPreferences('{"minMatchScore":140}').minMatchScore).toBe(100);
    expect(parseAutonomousPreferences('{"minMatchScore":-10}').minMatchScore).toBe(0);
  });

  it("queues review when human review is required", () => {
    const plan = buildAutonomousPlan([baseJob], profile, [], {
      mode: "auto_apply",
      requireHumanReview: true,
      minMatchScore: 70,
    });

    expect(plan.summary.queuedForReview).toBe(1);
    expect(plan.summary.queuedForApply).toBe(0);
    expect(plan.decisions[0].reviewRequired).toBe(true);
  });

  it("requires review for ATS forms that can be prepared but not submitted", () => {
    const plan = buildAutonomousPlan([baseJob], profile, [], {
      mode: "auto_apply",
      requireHumanReview: false,
      minMatchScore: 70,
    });

    expect(plan.summary.queuedForApply).toBe(0);
    expect(plan.summary.queuedForReview).toBe(1);
    expect(plan.decisions[0].automationSupported).toBe(false);
  });

  it("keeps jobs outside explicit target roles out of autonomous queues", () => {
    const plan = buildAutonomousPlan([baseJob], {
      ...profile,
      desiredJobTypes: "Product Designer",
    }, [], {
      minMatchScore: 0,
      dailyApplicationLimit: 2,
    });

    expect(plan.decisions[0]).toMatchObject({ action: "skip" });
    expect(plan.decisions[0].blockers).toContain("Role does not match the user's target preferences");
  });

  it("enforces daily limits for review preparation", () => {
    const todayApplication: Application = {
      id: 20,
      userId: 1,
      jobId: 99,
      status: "pending",
      appliedDate: null,
      lastActivity: null,
      coverLetter: null,
      customResume: null,
      notes: "Autonomous queue",
      isAutoApplied: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const plan = buildAutonomousPlan([baseJob], profile, [todayApplication], {
      mode: "auto_apply",
      requireHumanReview: false,
      dailyApplicationLimit: 1,
    });

    expect(plan.summary.dailyRemaining).toBe(0);
    expect(plan.summary.queuedForApply).toBe(0);
    expect(plan.summary.queuedForReview).toBe(0);
    expect(plan.decisions[0].action).toBe("skip");
    expect(plan.decisions[0].automationNotes).toContain(
      "Daily preparation limit reached; this job will be reconsidered on a future run."
    );
  });

  it("allows a pending preparation to be reconciled without treating it as submitted", () => {
    const pendingPreparation: Application = {
      id: 22,
      userId: 1,
      jobId: baseJob.id,
      status: "pending",
      appliedDate: null,
      lastActivity: null,
      coverLetter: null,
      customResume: null,
      notes: "Preparation was interrupted before its ledger artifacts were recorded.",
      isAutoApplied: 0,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(),
    };

    const plan = buildAutonomousPlan([baseJob], profile, [pendingPreparation], {
      minMatchScore: 70,
      dailyApplicationLimit: 2,
    });

    expect(plan.decisions[0].action).toBe("queue_for_review");
    expect(plan.decisions[0].blockers).not.toContain("Already applied to this job");
  });

  it("keeps progressed application history out of later autonomous preparation", () => {
    const submittedApplication: Application = {
      id: 23,
      userId: 1,
      jobId: baseJob.id,
      status: "applied",
      appliedDate: new Date(),
      lastActivity: new Date(),
      coverLetter: null,
      customResume: null,
      notes: "Employer submission confirmed.",
      isAutoApplied: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const plan = buildAutonomousPlan([baseJob], profile, [submittedApplication], {
      minMatchScore: 70,
      dailyApplicationLimit: 2,
    });

    expect(plan.decisions[0].action).toBe("skip");
    expect(plan.decisions[0].blockers).toContain("Already applied to this job");
  });

  it("counts autonomous manual tasks toward the daily preparation limit", () => {
    const manualTask: Application = {
      id: 21,
      userId: 1,
      jobId: 98,
      status: "pending",
      appliedDate: null,
      lastActivity: null,
      coverLetter: null,
      customResume: null,
      notes: "Manual apply queue.",
      isAutoApplied: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const plan = buildAutonomousPlan([baseJob], profile, [manualTask], {
      dailyApplicationLimit: 1,
      minMatchScore: 0,
    });

    expect(plan.summary.dailyRemaining).toBe(0);
    expect(plan.decisions[0].action).toBe("skip");
  });

  it("assigns limited preparation slots to the highest-scoring jobs", () => {
    const lowerScoreJob: Job = {
      ...baseJob,
      id: 2,
      externalId: "job-2",
      title: "General Developer",
      skills: "PHP",
    };
    const plan = buildAutonomousPlan([lowerScoreJob, baseJob], profile, [], {
      dailyApplicationLimit: 1,
      minMatchScore: 0,
    });

    expect(plan.decisions[0].jobId).toBe(baseJob.id);
    expect(plan.decisions[0].action).toBe("queue_for_review");
    expect(plan.decisions[1].action).toBe("skip");
  });

  it("excludes expired listings from every autonomous preparation decision", () => {
    const expiredJob: Job = {
      ...baseJob,
      id: 2,
      externalId: "expired-job",
      expiryDate: new Date(Date.now() - 60_000),
    };

    expect(isJobCurrentForAutonomousProcessing(expiredJob)).toBe(false);

    const plan = buildAutonomousPlan([expiredJob, baseJob], profile, [], {
      minMatchScore: 0,
      dailyApplicationLimit: 2,
    });

    expect(plan.summary.scanned).toBe(1);
    expect(plan.summary.expiredJobsSkipped).toBe(1);
    expect(plan.decisions.map((decision) => decision.jobId)).toEqual([baseJob.id]);
    expect(plan.nextActions).toContain("Excluded 1 expired job posting from autonomous preparation.");
  });

  it("never auto-applies without a connected resume", () => {
    const plan = buildAutonomousPlan([baseJob], { ...profile, resumeUrl: null }, [], {
      mode: "auto_apply",
      requireHumanReview: false,
      minMatchScore: 70,
    });

    expect(plan.summary.queuedForApply).toBe(0);
    expect(plan.summary.queuedForReview).toBe(1);
    expect(plan.decisions[0].reviewRequired).toBe(true);
  });

  it("plans follow-ups for stale applied applications", () => {
    const oldDate = new Date(Date.now() - 7 * 86400000);
    const application: Application = {
      id: 30,
      userId: 1,
      jobId: 1,
      status: "applied",
      appliedDate: oldDate,
      lastActivity: oldDate,
      coverLetter: null,
      customResume: null,
      notes: null,
      isAutoApplied: 0,
      createdAt: oldDate,
      updatedAt: oldDate,
    };

    const disabledPlan = buildAutonomousPlan([], profile, [application], {});
    const plan = buildAutonomousPlan([], profile, [application], { createFollowUps: true });

    expect(disabledPlan.summary.followUpsDue).toBe(0);
    expect(getExecutableDecisions(disabledPlan).followUps).toHaveLength(0);
    expect(plan.summary.followUpsDue).toBe(1);
    expect(plan.followUps[0].action).toBe("send_follow_up");
    expect(getExecutableDecisions(plan).followUps).toHaveLength(1);
  });

  it("uses status checks instead of repeated thank-you drafts for stale interviews", () => {
    const oldDate = new Date(Date.now() - 7 * 86400000);
    const application: Application = {
      id: 31,
      userId: 1,
      jobId: 1,
      status: "interview",
      appliedDate: oldDate,
      lastActivity: oldDate,
      coverLetter: null,
      customResume: null,
      notes: null,
      isAutoApplied: 0,
      createdAt: oldDate,
      updatedAt: oldDate,
    };

    const plan = buildAutonomousPlan([], profile, [application], { createFollowUps: true });

    expect(plan.followUps[0].action).toBe("send_follow_up");
    expect(plan.followUps[0].messageType).toBe("status_check");
  });
});
