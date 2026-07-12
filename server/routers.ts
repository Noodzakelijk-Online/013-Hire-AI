import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { normalizeSalary, normalizeLocation, normalizeJobType, normalizeExperienceLevel, extractSkills, extractBenefits, getDeduplicator } from "./jobNormalization";
import { getRecentJobs, searchJobs, getDiscoveryStats, getSubscriptionManager } from "./realTimeDiscovery";
import { successFeesRouter } from "./routers/successFees";
import { adminRouter } from "./routers/admin";
import { uploadResume, getActiveResume, getResumeVersions, setActiveVersion, deleteResumeVersion, getResumeStats, getResumeDownloadUrl } from "./resumeStorage";
import {
  saveJob,
  unsaveJob,
  getSavedJobs,
  updateSavedJobNotes,
  addApplicationNote,
  getApplicationNotes,
  updateApplicationNote,
  deleteApplicationNote,
  scheduleInterview,
  getInterviewSchedules,
  getUpcomingInterviews,
  updateInterviewStatus,
  recordInterviewOutcome,
  rescheduleInterview,
  confirmApplicationSubmission,
  recordEmployerResponse,
  createFollowUp,
  getFollowUps,
  withdrawApplication,
  acceptOfferApplication,
  markFollowUpSent,
  markFollowUpResponseReceived,
  generateInterviewPreparationForApplication,
  generateEmployerReplyEmail,
  generateFollowUpEmail,
  createJobAlert,
  getJobAlerts,
  updateJobAlert,
  toggleJobAlert,
  deleteJobAlert,
  generateInterviewQuestions,
  conductMockInterview,
  getVideoInterviewTips,
} from "./applicationFeatures";
import { MAX_FOLLOW_UP_MESSAGE_CHARS } from "./messageSanitization";

const boundedPageSize = z.number().int().min(1).max(100);
const boundedOffset = z.number().int().min(0).max(100_000);
const boundedFilterText = z.string().trim().min(1).max(200);
const jobListPageSize = z.number().int().min(1).max(250);
const jobSearchFiltersInput = z.object({
  query: z.string().trim().max(200).optional(),
  jobType: z.enum(["all", "full-time", "part-time", "contract", "temporary"]).optional(),
  platformId: z.string().trim().max(20).optional(),
  salaryRange: z.tuple([z.number().min(0).max(10_000_000), z.number().min(0).max(10_000_000)]).optional(),
  remoteOnly: z.boolean().optional(),
  experienceLevel: z.enum(["all", "entry", "junior", "mid", "senior", "lead", "executive"]).optional(),
  applicationProcess: z.enum(["all", "greenhouse", "lever", "workday", "email", "other"]).optional(),
  visaSponsorshipOnly: z.boolean().optional(),
  openHiringSupportOnly: z.boolean().optional(),
  diversityFriendlyOnly: z.boolean().optional(),
  salaryDisclosedOnly: z.boolean().optional(),
  postedWithin: z.enum(["all", "1", "3", "7", "30"]).optional(),
}).optional();
const auditEntityType = z.enum(["job", "application", "success_fee", "verification", "user", "admin_review"]);
const connectorProvider = z.enum([
  "gmail",
  "google_drive",
  "dropbox",
  "outlook",
  "linkedin",
  "github",
  "portfolio",
]);
const safeHttpUrl = z.string().trim().max(1000).url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "URL must use HTTP or HTTPS");
const socialProfileText = z.string().trim().min(1).max(30_000);

function defaultConnectorScopes(provider: z.infer<typeof connectorProvider>) {
  switch (provider) {
    case "gmail":
      return ["email.metadata.read", "email.messages.read_recruiting"];
    case "outlook":
      return ["mail.metadata.read", "mail.messages.read_recruiting"];
    case "google_drive":
      return ["files.metadata.read", "files.content.read_resume_candidates"];
    case "dropbox":
      return ["files.metadata.read", "files.content.read_resume_candidates"];
    case "linkedin":
      return ["profile.basic.read"];
    case "github":
      return ["profile.basic.read", "repositories.metadata.read"];
    case "portfolio":
      return ["profile.url.verify"];
  }
}

function profileSnapshotForApplication(
  user: { name?: string | null; email?: string | null },
  profile?: {
    skills?: string | null;
    experience?: string | null;
    education?: string | null;
    preferences?: string | null;
    desiredJobTypes?: string | null;
    desiredLocations?: string | null;
    salaryExpectationMin?: number | null;
    salaryExpectationMax?: number | null;
    resumeUrl?: string | null;
    resumeFileKey?: string | null;
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
  } | null
) {
  return JSON.stringify({
    user: {
      name: user.name || null,
      email: user.email || null,
    },
    profile: profile ? {
      skills: profile.skills || null,
      experience: profile.experience || null,
      education: profile.education || null,
      preferences: profile.preferences || null,
      desiredJobTypes: profile.desiredJobTypes || null,
      desiredLocations: profile.desiredLocations || null,
      salaryExpectationMin: profile.salaryExpectationMin ?? null,
      salaryExpectationMax: profile.salaryExpectationMax ?? null,
      resumeUrl: profile.resumeUrl || null,
      resumeFileKey: profile.resumeFileKey || null,
      linkedinUrl: profile.linkedinUrl || null,
      githubUrl: profile.githubUrl || null,
      portfolioUrl: profile.portfolioUrl || null,
    } : null,
  });
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    acceptTos: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(users).set({ tosAcceptedAt: new Date() }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
  }),

  audit: router({
    getForUser: protectedProcedure
      .input(z.object({
        limit: boundedPageSize.optional().default(25),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getAuditEventsForUser } = await import("./db");
        return await getAuditEventsForUser(ctx.user.id, input?.limit ?? 25);
      }),
    getForEntity: protectedProcedure
      .input(z.object({
        entityType: auditEntityType,
        entityId: z.number().int().positive(),
      }))
      .query(async ({ ctx, input }) => {
        const { getAuditEventsForEntity } = await import("./db");
        return await getAuditEventsForEntity(ctx.user.id, input.entityType, input.entityId);
      }),
  }),

  connectors: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { listUserConnectorAccounts } = await import("./db");
      return await listUserConnectorAccounts(ctx.user.id);
    }),
    requestConnection: protectedProcedure
      .input(z.object({
        provider: connectorProvider,
        consentScopes: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { requestUserConnectorConnection, createAuditEvent } = await import("./db");
        const consentScopes = input.consentScopes?.length
          ? input.consentScopes
          : defaultConnectorScopes(input.provider);
        const account = await requestUserConnectorConnection({
          userId: ctx.user.id,
          provider: input.provider,
          consentScopes,
        });

        await createAuditEvent({
          userId: ctx.user.id,
          entityType: "user",
          entityId: ctx.user.id,
          action: "connector_connection_requested",
          actor: "user",
          source: "connectors.requestConnection",
          afterState: JSON.stringify({
            provider: input.provider,
            status: "connection_requested",
            consentScopes,
          }),
          riskLevel: "medium",
        });

        return {
          success: true,
          requiresOAuth: true,
          account,
          message: "Connection request recorded. OAuth authorization is still required before Hire.AI can read external data.",
        };
      }),
    disconnect: protectedProcedure
      .input(z.object({ provider: connectorProvider }))
      .mutation(async ({ ctx, input }) => {
        const { disconnectUserConnectorAccount, createAuditEvent } = await import("./db");
        const account = await disconnectUserConnectorAccount(ctx.user.id, input.provider);

        await createAuditEvent({
          userId: ctx.user.id,
          entityType: "user",
          entityId: ctx.user.id,
          action: "connector_disconnected",
          actor: "user",
          source: "connectors.disconnect",
          afterState: JSON.stringify({
            provider: input.provider,
            status: "disabled",
          }),
          riskLevel: "low",
        });

        return {
          success: true,
          account,
        };
      }),
  }),

  // Job Platforms
  platforms: router({
    list: publicProcedure.query(async () => {
      const { getAllJobPlatforms } = await import("./db");
      return await getAllJobPlatforms();
    }),
    active: publicProcedure.query(async () => {
      const { getActiveJobPlatforms } = await import("./db");
      return await getActiveJobPlatforms();
    }),
  }),

  // Jobs
  jobs: router({
    getDiscoveryStatus: publicProcedure.query(async () => {
      const { getJobDiscoveryStatus } = await import("./db");
      return await getJobDiscoveryStatus();
    }),
    list: publicProcedure
      .input(
        z.object({
          limit: jobListPageSize.optional().default(50),
          offset: boundedOffset.optional().default(0),
          filters: jobSearchFiltersInput,
        })
      )
      .query(async ({ input }) => {
        const { getActiveJobs } = await import("./db");
        return await getActiveJobs(input.limit, input.offset, input.filters);
      }),
    search: publicProcedure
      .input(
        z.object({
          title: boundedFilterText.optional(),
          company: boundedFilterText.optional(),
          location: boundedFilterText.optional(),
          skills: boundedFilterText.optional(),
          limit: boundedPageSize.optional().default(50),
          offset: boundedOffset.optional().default(0),
        })
      )
      .query(async ({ input }) => {
        const { searchJobs } = await import("./db");
        return await searchJobs(input);
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getJobById } = await import("./db");
        return await getJobById(input.id);
      }),
    getSources: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const { getJobAggregationSources } = await import("./db");
        return await getJobAggregationSources(input.id);
      }),

    // Saved Jobs
    saveJob: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        notes: z.string().optional(),
        tags: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await saveJob({
          userId: ctx.user.id,
          jobId: input.jobId,
          notes: input.notes,
          tags: input.tags,
          priority: input.priority,
        });
      }),

    unsaveJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await unsaveJob(ctx.user.id, input.jobId);
      }),

    getSavedJobs: protectedProcedure
      .query(async ({ ctx }) => {
        return await getSavedJobs(ctx.user.id);
      }),

    updateSavedJobNotes: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        notes: z.string(),
        tags: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await updateSavedJobNotes(
          ctx.user.id,
          input.jobId,
          input.notes,
          input.tags,
          input.priority
        );
      }),
  }),

  // User Profile
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { getUserProfile } = await import("./db");
      return await getUserProfile(ctx.user.id) ?? null;
    }),
    getReadiness: protectedProcedure.query(async ({ ctx }) => {
      const {
        getUserProfile,
        getWorkExperiences,
        getEducationEntries,
        getUserSkills,
      } = await import("./db");
      const { calculateProfileReadiness } = await import("./profileReadiness");
      const [profile, workExperiences, educationEntries, skills] = await Promise.all([
        getUserProfile(ctx.user.id),
        getWorkExperiences(ctx.user.id),
        getEducationEntries(ctx.user.id),
        getUserSkills(ctx.user.id),
      ]);
      const activeResume = await getActiveResume(ctx.user.id);
      return calculateProfileReadiness({
        profile,
        workExperiences,
        educationEntries,
        skills,
        hasActiveResumeArtifact: Boolean(activeResume),
      });
    }),
    getEvidenceReadiness: protectedProcedure.query(async ({ ctx }) => {
      const {
        getUserProfile,
        getWorkExperiences,
        getEducationEntries,
        getUserSkills,
        listUserConnectorAccounts,
      } = await import("./db");
      const { calculateProfileReadiness } = await import("./profileReadiness");
      const { getProfileEvidenceControlSummary } = await import("@shared/profileEvidence");
      const [profile, workExperiences, educationEntries, skills, connectorAccounts, activeResume] = await Promise.all([
        getUserProfile(ctx.user.id),
        getWorkExperiences(ctx.user.id),
        getEducationEntries(ctx.user.id),
        getUserSkills(ctx.user.id),
        listUserConnectorAccounts(ctx.user.id),
        getActiveResume(ctx.user.id),
      ]);
      const readiness = calculateProfileReadiness({
        profile,
        workExperiences,
        educationEntries,
        skills,
        hasActiveResumeArtifact: Boolean(activeResume),
      });
      return getProfileEvidenceControlSummary({
        profile,
        readiness,
        hasActiveResumeArtifact: Boolean(activeResume),
        connectorAccounts: connectorAccounts.map((account) => ({
          provider: account.provider,
          status: account.status,
          externalAccountLabel: account.externalAccountLabel,
          consentScopes: account.consentScopes,
        })),
      });
    }),
    update: protectedProcedure
      .input(
        z.object({
          skills: z.string().optional(),
          experience: z.string().optional(),
          education: z.string().optional(),
          preferences: z.string().optional(),
          desiredJobTypes: z.string().trim().max(500).nullable().optional(),
          desiredLocations: z.string().trim().max(500).nullable().optional(),
          salaryExpectationMin: z.number().int().min(0).max(10_000_000).nullable().optional(),
          salaryExpectationMax: z.number().int().min(0).max(10_000_000).nullable().optional(),
          resumeUrl: safeHttpUrl.optional(),
          resumeFileKey: z.string().trim().max(500).optional(),
          linkedinUrl: safeHttpUrl.optional(),
          githubUrl: safeHttpUrl.optional(),
          portfolioUrl: safeHttpUrl.optional(),
          diversityGroup: z.string().optional(),
          needsVisaSponsorship: z.number().int().min(0).max(1).optional(),
        }).superRefine((value, context) => {
          if (
            value.salaryExpectationMin !== undefined &&
            value.salaryExpectationMax !== undefined &&
            value.salaryExpectationMin !== null &&
            value.salaryExpectationMax !== null &&
            value.salaryExpectationMin > value.salaryExpectationMax
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["salaryExpectationMax"],
              message: "Maximum salary must be at least the minimum salary.",
            });
          }
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { validateLinkedInUrl, validateGitHubUrl, validatePortfolioUrl } = await import("./socialConnections");
        const { upsertUserProfile } = await import("./db");
        const invalidConnection =
          (input.linkedinUrl && !validateLinkedInUrl(input.linkedinUrl)) ||
          (input.githubUrl && !validateGitHubUrl(input.githubUrl)) ||
          (input.portfolioUrl && !validatePortfolioUrl(input.portfolioUrl));
        if (invalidConnection) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more social profile URLs are invalid.",
          });
        }
        await upsertUserProfile({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),

    // Work Experience
    getWorkExperiences: protectedProcedure.query(async ({ ctx }) => {
      const { getWorkExperiences } = await import("./db");
      return await getWorkExperiences(ctx.user.id);
    }),
    addWorkExperience: protectedProcedure
      .input(z.object({
        jobTitle: z.string(),
        company: z.string(),
        location: z.string().optional(),
        startDate: z.string().transform((s) => new Date(s)),
        endDate: z.string().transform((s) => new Date(s)).optional(),
        isCurrent: z.number().optional(),
        description: z.string().optional(),
        achievements: z.string().optional(),
        skills: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createWorkExperience } = await import("./db");
        return await createWorkExperience({ userId: ctx.user.id, ...input });
      }),
    updateWorkExperience: protectedProcedure
      .input(z.object({
        id: z.number(),
        jobTitle: z.string().optional(),
        company: z.string().optional(),
        location: z.string().optional(),
        startDate: z.string().transform((s) => new Date(s)).optional(),
        endDate: z.string().transform((s) => new Date(s)).optional(),
        isCurrent: z.number().optional(),
        description: z.string().optional(),
        achievements: z.string().optional(),
        skills: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const { updateWorkExperience } = await import("./db");
        return await updateWorkExperience(id, ctx.user.id, data);
      }),
    deleteWorkExperience: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteWorkExperience } = await import("./db");
        return await deleteWorkExperience(input.id, ctx.user.id);
      }),

    // Education
    getEducation: protectedProcedure.query(async ({ ctx }) => {
      const { getEducationEntries } = await import("./db");
      return await getEducationEntries(ctx.user.id);
    }),
    addEducation: protectedProcedure
      .input(z.object({
        degree: z.string(),
        fieldOfStudy: z.string().optional(),
        institution: z.string(),
        location: z.string().optional(),
        startDate: z.string().transform((s) => new Date(s)).optional(),
        endDate: z.string().transform((s) => new Date(s)).optional(),
        isCurrent: z.number().optional(),
        gpa: z.string().optional(),
        achievements: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createEducationEntry } = await import("./db");
        return await createEducationEntry({ userId: ctx.user.id, ...input });
      }),
    updateEducation: protectedProcedure
      .input(z.object({
        id: z.number(),
        degree: z.string().optional(),
        fieldOfStudy: z.string().optional(),
        institution: z.string().optional(),
        location: z.string().optional(),
        startDate: z.string().transform((s) => new Date(s)).optional(),
        endDate: z.string().transform((s) => new Date(s)).optional(),
        isCurrent: z.number().optional(),
        gpa: z.string().optional(),
        achievements: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const { updateEducationEntry } = await import("./db");
        return await updateEducationEntry(id, ctx.user.id, data);
      }),
    deleteEducation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteEducationEntry } = await import("./db");
        return await deleteEducationEntry(input.id, ctx.user.id);
      }),

    // Skills
    getSkills: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSkills } = await import("./db");
      return await getUserSkills(ctx.user.id);
    }),
    addSkill: protectedProcedure
      .input(z.object({
        skillName: z.string(),
        category: z.string().optional(),
        proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
        yearsOfExperience: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createUserSkill } = await import("./db");
        return await createUserSkill({ userId: ctx.user.id, ...input });
      }),
    updateSkill: protectedProcedure
      .input(z.object({
        id: z.number(),
        skillName: z.string().optional(),
        category: z.string().optional(),
        proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
        yearsOfExperience: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const { updateUserSkill } = await import("./db");
        return await updateUserSkill(id, ctx.user.id, data);
      }),
    deleteSkill: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteUserSkill } = await import("./db");
        return await deleteUserSkill(input.id, ctx.user.id);
      }),

    // Projects
    getProjects: protectedProcedure.query(async ({ ctx }) => {
      const { getUserProjects } = await import("./db");
      return await getUserProjects(ctx.user.id);
    }),
    addProject: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        url: z.string().optional(),
        technologies: z.string().optional(),
        startDate: z.string().transform((s) => new Date(s)).optional(),
        endDate: z.string().transform((s) => new Date(s)).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createUserProject } = await import("./db");
        return await createUserProject({ userId: ctx.user.id, ...input });
      }),
    updateProject: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        url: z.string().optional(),
        technologies: z.string().optional(),
        startDate: z.string().transform((s) => new Date(s)).optional(),
        endDate: z.string().transform((s) => new Date(s)).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const { updateUserProject } = await import("./db");
        return await updateUserProject(id, ctx.user.id, data);
      }),
    deleteProject: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteUserProject } = await import("./db");
        return await deleteUserProject(input.id, ctx.user.id);
      }),
  }),

  // Applications
  applications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserApplications } = await import("./db");
      return await getUserApplications(ctx.user.id);
    }),
    create: protectedProcedure
      .input(
        z.object({
          jobId: z.number(),
          coverLetter: z.string().optional(),
          customResume: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const {
          createApplication,
          createApplicationMaterial,
          createApplicationAttempt,
          createAuditEvent,
          createAdminReviewItem,
          createApplicationApproval,
        } = await import("./db");
        const activeResume = await getActiveResume(ctx.user.id);
        if (!activeResume) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "An active versioned resume is required before Hire.AI can prepare an application.",
          });
        }
        const {
          applicationPreparationBlockMessage,
          getApplicationPreparationSafety,
        } = await import("./applicationPreparationSafety");
        const preparationSafety = await getApplicationPreparationSafety(ctx.user.id);
        if (!preparationSafety.allowed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: applicationPreparationBlockMessage(preparationSafety),
          });
        }
        const application = await createApplication({
          userId: ctx.user.id,
          jobId: input.jobId,
          coverLetter: input.coverLetter,
          customResume: input.customResume,
          notes: input.notes || "Application prepared and queued for review.",
          status: "pending",
        });
        const applicationId = Number(application.insertId);
        await createApplicationMaterial({
          applicationId,
          resumeId: activeResume.id,
          coverLetter: input.coverLetter,
          customResume: input.customResume,
          sourceProfileSnapshot: profileSnapshotForApplication(ctx.user),
        });
        await createApplicationAttempt({
          applicationId,
          userId: ctx.user.id,
          jobId: input.jobId,
          attemptType: "prepare",
          status: "review_required",
          finishedAt: new Date(),
          confirmationText: "Application materials were prepared and queued for user review.",
          retryCount: 0,
        });
        await createAuditEvent({
          userId: ctx.user.id,
          entityType: "application",
          entityId: applicationId,
          action: "application_prepared",
          actor: "user",
          source: "applications.create",
          afterState: JSON.stringify({
            jobId: input.jobId,
            status: "pending",
            reviewRequired: true,
            resume: { id: activeResume.id, version: activeResume.version },
          }),
          riskLevel: "medium",
        });
        await createAdminReviewItem({
          userId: ctx.user.id,
          entityType: "application",
          entityId: applicationId,
          category: "application_review",
          priority: "medium",
          title: "Application prepared for review",
          description: input.notes || "Application materials were prepared and require review before external submission.",
        });
        await createApplicationApproval({
          userId: ctx.user.id,
          applicationId,
          entityType: "application",
          entityId: applicationId,
          approvalType: "application_submission",
          status: "pending",
          riskLevel: "high",
          requestedBy: "system",
          title: "Approve external application submission",
          description: input.notes || "Prepared application materials require explicit approval before external submission is confirmed.",
          payload: JSON.stringify({
            jobId: input.jobId,
            source: "applications.create",
            status: "pending",
            resumeId: activeResume.id,
            resumeVersion: activeResume.version,
          }),
        });
        return { success: true, applicationRecordId: applicationId };
      }),
    decide: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        decision: z.enum(["apply", "save", "ignore", "review", "manual_apply"]),
        decisionReason: z.string().trim().min(1).max(5000),
        matchScore: z.number().int().min(0).max(100).optional(),
        riskLevel: z.enum(["low", "medium", "high"]).optional(),
        reviewRequired: z.boolean().optional(),
        reviewReason: z.string().trim().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const {
          createApplication,
          createApplicationDecision,
          createApplicationMaterial,
          createApplicationAttempt,
          createAuditEvent,
          createAdminReviewItem,
          createApplicationApproval,
          getApplicationLedgerArtifacts,
          getJobById,
          getUserApplications,
          listUserApplicationApprovals,
          resolveApplicationApproval,
          updateApplicationStatus,
        } = await import("./db");
        const job = await getJobById(input.jobId);
        if (!job) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }

        const createsPreparedApplication = ["apply", "review", "manual_apply"].includes(input.decision);
        const preparationSafety = createsPreparedApplication
          ? await (await import("./applicationPreparationSafety")).getApplicationPreparationSafety(ctx.user.id)
          : null;

        if (preparationSafety?.blockers.some((blocker) => blocker.key === "resume")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "An active versioned resume is required before Hire.AI can queue an application for review.",
          });
        }

        const reviewRequired = input.reviewRequired ?? input.decision !== "ignore";
        const result = await createApplicationDecision({
          userId: ctx.user.id,
          jobId: input.jobId,
          decision: input.decision,
          decisionReason: input.decisionReason,
          matchScore: input.matchScore,
          riskLevel: input.riskLevel || (reviewRequired ? "medium" : "low"),
          reviewRequired: reviewRequired ? 1 : 0,
          reviewReason: input.reviewReason,
          decidedBy: "user",
        });
        await createAuditEvent({
          userId: ctx.user.id,
          entityType: "job",
          entityId: input.jobId,
          action: "application_decision_recorded",
          actor: "user",
          source: "applications.decide",
          afterState: JSON.stringify({
            decision: input.decision,
            matchScore: input.matchScore ?? null,
            riskLevel: input.riskLevel || (reviewRequired ? "medium" : "low"),
            reviewRequired,
            reviewReason: input.reviewReason || null,
          }),
          riskLevel: input.riskLevel === "high" ? "high" : reviewRequired ? "medium" : "low",
        });

        if (createsPreparedApplication && preparationSafety && !preparationSafety.allowed) {
          await createAuditEvent({
            userId: ctx.user.id,
            entityType: "job",
            entityId: input.jobId,
            action: "application_preparation_blocked_profile_readiness",
            actor: "system",
            source: "applications.decide",
            afterState: JSON.stringify({
              decisionId: Number(result.insertId),
              decision: input.decision,
              readinessScore: preparationSafety.readinessScore,
              blockers: preparationSafety.blockers,
              externalSubmissionPerformed: false,
            }),
            riskLevel: "high",
          });
          return {
            success: true,
            decisionId: Number(result.insertId),
            applicationRecordId: null,
            existing: result.existing === true,
            preparationBlocked: true,
            blockers: preparationSafety.blockers,
          };
        }

        const activeResume = createsPreparedApplication
          ? await getActiveResume(ctx.user.id)
          : null;
        if (createsPreparedApplication && !activeResume) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "An active versioned resume is required before Hire.AI can queue an application for review.",
          });
        }

        let applicationRecordId: number | null = null;
        if (input.decision === "apply" || input.decision === "review" || input.decision === "manual_apply") {
          const application = await createApplication({
            userId: ctx.user.id,
            jobId: input.jobId,
            status: "pending",
            notes: [
              `User decision: ${input.decision}.`,
              input.decisionReason,
              input.reviewReason ? `Review reason: ${input.reviewReason}` : "",
            ].filter(Boolean).join(" "),
            isAutoApplied: 0,
          });
          applicationRecordId = Number(application.insertId);
          const existingArtifacts = application.existing === true
            ? await getApplicationLedgerArtifacts(applicationRecordId, ctx.user.id).catch(() => null)
            : null;
          const hasQueuedDecisionAttempt = existingArtifacts?.attempts.some((attempt) =>
            attempt.attemptType === "prepare" &&
            ["prepared", "review_required"].includes(attempt.status || "prepared") &&
            (attempt.confirmationText || "").includes("Application queued from")
          ) === true;
          const shouldCreateQueuedArtifacts = application.existing !== true || !hasQueuedDecisionAttempt;
          await createApplicationMaterial({
            applicationId: applicationRecordId,
            resumeId: activeResume!.id,
            sourceProfileSnapshot: profileSnapshotForApplication(ctx.user),
          });
          if (shouldCreateQueuedArtifacts) {
            await createApplicationAttempt({
              applicationId: applicationRecordId,
              userId: ctx.user.id,
              jobId: input.jobId,
              platformId: job.platformId,
              attemptType: "prepare",
              status: "review_required",
              finishedAt: new Date(),
              confirmationText: [
                `Application queued from ${input.decision} decision.`,
                input.reviewReason ? `Review reason: ${input.reviewReason}` : input.decisionReason,
              ].filter(Boolean).join(" "),
              retryCount: 0,
            });
            await createAuditEvent({
              userId: ctx.user.id,
              entityType: "application",
              entityId: applicationRecordId,
              action: "application_queued_for_review",
              actor: "user",
              source: "applications.decide",
              afterState: JSON.stringify({
                jobId: input.jobId,
                decision: input.decision,
                status: "pending",
                reviewRequired: true,
                resume: { id: activeResume!.id, version: activeResume!.version },
              }),
              riskLevel: input.riskLevel === "high" ? "high" : "medium",
            });
          }
          if (input.riskLevel === "high" || input.decision === "manual_apply" || reviewRequired) {
            await createAdminReviewItem({
              userId: ctx.user.id,
              entityType: "application",
              entityId: applicationRecordId,
              category: "application_review",
              priority: input.riskLevel === "high" ? "high" : "medium",
              title: input.riskLevel === "high" ? "High-risk application needs review" : "Application needs review",
              description: [
                `Decision: ${input.decision}.`,
                input.decisionReason,
                input.reviewReason ? `Review reason: ${input.reviewReason}` : "",
              ].filter(Boolean).join(" "),
            });
            await createApplicationApproval({
              userId: ctx.user.id,
              applicationId: applicationRecordId,
              entityType: "application",
              entityId: applicationRecordId,
              approvalType: "application_submission",
              status: "pending",
              riskLevel: input.riskLevel === "high" || input.decision === "manual_apply" ? "high" : "medium",
              requestedBy: "system",
              title: input.decision === "manual_apply"
                ? "Approve manual application handoff"
                : "Approve external application submission",
              description: [
                `Decision: ${input.decision}.`,
                input.decisionReason,
                input.reviewReason ? `Review reason: ${input.reviewReason}` : "",
              ].filter(Boolean).join(" "),
              payload: JSON.stringify({
                jobId: input.jobId,
                decision: input.decision,
                matchScore: input.matchScore ?? null,
                source: "applications.decide",
                resumeId: activeResume!.id,
                resumeVersion: activeResume!.version,
              }),
            });
          }
        }

        if (input.decision === "save") {
          await saveJob({
            userId: ctx.user.id,
            jobId: input.jobId,
            notes: input.decisionReason,
            priority: input.riskLevel === "low" ? "medium" : "high",
          });
        }

        if (input.decision === "save" || input.decision === "ignore") {
          const userApplications = await getUserApplications(ctx.user.id);
          const preparedApplication = userApplications.find((application) =>
            application.jobId === input.jobId && (application.status || "pending") === "pending"
          );

          if (preparedApplication) {
            applicationRecordId = preparedApplication.id;
            const pendingApprovals = await listUserApplicationApprovals(ctx.user.id, "pending");
            const submissionApproval = pendingApprovals.find((approval) =>
              approval.approvalType === "application_submission" &&
              (
                approval.applicationId === preparedApplication.id ||
                (approval.entityType === "application" && approval.entityId === preparedApplication.id)
              )
            );
            let cancelledApprovalId: number | null = null;
            let cancelledAttemptId: number | null = null;

            if (submissionApproval) {
              const {
                getApplicationSubmissionGateAttemptStatus,
                getApplicationSubmissionGateAttemptText,
              } = await import("./applicationApprovalResolution");
              const decisionNote = input.decision === "save"
                ? "Saved from the review queue; prepared submission gate cancelled until the job is re-queued."
                : "Ignored from the review queue; prepared submission gate cancelled.";
              const resolved = await resolveApplicationApproval(
                submissionApproval.id,
                ctx.user.id,
                "cancelled",
                decisionNote,
                "user"
              );
              cancelledApprovalId = resolved.approval.id;
              const cancelledAttempt = await createApplicationAttempt({
                applicationId: preparedApplication.id,
                userId: ctx.user.id,
                jobId: preparedApplication.jobId,
                platformId: job.platformId,
                attemptType: "external_handoff",
                status: getApplicationSubmissionGateAttemptStatus("cancelled"),
                startedAt: new Date(),
                finishedAt: new Date(),
                confirmationText: getApplicationSubmissionGateAttemptText(
                  resolved.approval,
                  "cancelled",
                  decisionNote
                ),
                retryCount: 0,
              });
              cancelledAttemptId = Number(cancelledAttempt.insertId);
            }

            await updateApplicationStatus(preparedApplication.id, "withdrawn", ctx.user.id);
            await createAuditEvent({
              userId: ctx.user.id,
              entityType: "application",
              entityId: preparedApplication.id,
              action: "application_review_closed",
              actor: "user",
              source: "applications.decide",
              afterState: JSON.stringify({
                jobId: input.jobId,
                decision: input.decision,
                status: "withdrawn",
                cancelledApprovalId,
                cancelledAttemptId,
              }),
              riskLevel: input.decision === "ignore" ? "medium" : "low",
            });
          }
        }

        return {
          success: true,
          decisionId: Number(result.insertId),
          applicationRecordId,
          existing: result.existing === true,
        };
      }),
    listDecisions: protectedProcedure.query(async ({ ctx }) => {
      const { getUserApplicationDecisions } = await import("./db");
      return await getUserApplicationDecisions(ctx.user.id);
    }),
    getOperatingLedger: protectedProcedure.query(async ({ ctx }) => {
      const { getUserOperatingLedger } = await import("./applicationCampaigns");
      return await getUserOperatingLedger(ctx.user.id, {
        includeAdminReviews: ctx.user.role === "admin",
      });
    }),
    setCampaignStatus: protectedProcedure
      .input(z.object({ status: z.enum(["active", "paused"]) }))
      .mutation(async ({ ctx, input }) => {
        const { getUserOperatingLedger } = await import("./applicationCampaigns");
        const { createAuditEvent, updateApplicationCampaignStatus } = await import("./db");

        const ledger = await getUserOperatingLedger(ctx.user.id, {
          includeAdminReviews: ctx.user.role === "admin",
        });
        const previousStatus = ledger.campaign.status;
        const campaign = await updateApplicationCampaignStatus(ctx.user.id, input.status);
        if (previousStatus !== campaign.status) {
          await createAuditEvent({
            userId: ctx.user.id,
            entityType: "user",
            entityId: ctx.user.id,
            action: "application_campaign_status_changed",
            actor: "user",
            source: "applications.setCampaignStatus",
            beforeState: JSON.stringify({ campaignId: campaign.id, status: previousStatus }),
            afterState: JSON.stringify({ campaignId: campaign.id, status: campaign.status }),
            riskLevel: "medium",
          });
        }

        return { success: true, campaign };
      }),
    listInterviewNotifications: protectedProcedure
      .input(z.object({ limit: boundedPageSize.optional().default(25) }).optional())
      .query(async ({ ctx, input }) => {
        const { listUnreadInterviewNotifications } = await import("./db");
        return await listUnreadInterviewNotifications(ctx.user.id, input?.limit ?? 25);
      }),
    markInterviewNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { markInterviewNotificationRead, createAuditEvent } = await import("./db");
        const result = await markInterviewNotificationRead(input.notificationId, ctx.user.id);
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Interview notification not found." });
        }
        if (result.changed) {
          await createAuditEvent({
            userId: ctx.user.id,
            entityType: "application",
            entityId: result.notification.applicationId,
            action: "interview_notification_read",
            actor: "user",
            source: "applications.markInterviewNotificationRead",
            afterState: JSON.stringify({
              notificationId: result.notification.id,
              employerResponseId: result.notification.employerResponseId,
            }),
            riskLevel: "low",
          });
        }
        return { success: true, changed: result.changed, notification: result.notification };
      }),
    getLedgerArtifacts: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getApplicationLedgerArtifacts } = await import("./db");
        try {
          return await getApplicationLedgerArtifacts(input.applicationId, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load application ledger.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
            message,
          });
        }
      }),
    generateInterviewPreparation: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await generateInterviewPreparationForApplication(input.applicationId, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to generate interview preparation.";
          throw new TRPCError({
            code: message.includes("not found") ? "NOT_FOUND" : "BAD_REQUEST",
            message,
          });
        }
      }),
    getEmployerResponses: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getEmployerResponses } = await import("./db");
        try {
          return await getEmployerResponses(input.applicationId, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load employer responses.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
            message,
          });
        }
      }),
    listApprovals: protectedProcedure
      .input(z.object({
        status: z.enum(["all", "pending", "approved", "rejected", "cancelled"]).optional().default("pending"),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { listUserApplicationApprovals } = await import("./db");
        return await listUserApplicationApprovals(ctx.user.id, input?.status ?? "pending");
      }),
    resolveApproval: protectedProcedure
      .input(z.object({
        approvalId: z.number(),
        status: z.enum(["approved", "rejected", "cancelled"]),
        decisionNote: z.string().trim().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const {
          resolveApplicationApproval,
          createAuditEvent,
          createApplicationAttempt,
          getJobById,
          getUserApplications,
          listUserApplicationApprovals,
        } = await import("./db");
        const {
          getApplicationSubmissionGateAttemptStatus,
          getApplicationSubmissionGateAttemptText,
          shouldRecordApplicationSubmissionGateAttempt,
        } = await import("./applicationApprovalResolution");
        try {
          const approval = (await listUserApplicationApprovals(ctx.user.id, "all"))
            .find((item) => item.id === input.approvalId);
          if (
            input.status === "approved" &&
            approval?.approvalType === "application_submission" &&
            approval.applicationId != null
          ) {
            const { getAutonomousEvidenceContext } = await import("./autonomousEvidence");
            const evidenceContext = await getAutonomousEvidenceContext(ctx.user.id);
            const blockingGates = evidenceContext.evidenceGates.filter((gate) =>
              gate.blocks.includes("external_application_submission")
            );
            if (blockingGates.length > 0) {
              await createAuditEvent({
                userId: ctx.user.id,
                entityType: "application",
                entityId: approval.applicationId,
                action: "application_submission_approval_blocked_evidence",
                actor: "user",
                source: "applications.resolveApproval",
                approvalId: approval.id,
                afterState: JSON.stringify({
                  requestedStatus: input.status,
                  decisionNote: input.decisionNote ?? null,
                  blockingGates: blockingGates.map((gate) => ({
                    id: gate.id,
                    label: gate.label,
                    detail: gate.detail,
                    severity: gate.severity,
                  })),
                  externalSubmissionPerformed: false,
                }),
                riskLevel: "high",
              });
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "Resolve the profile evidence gates before approving an external application handoff.",
              });
            }
          }
          const result = await resolveApplicationApproval(
            input.approvalId,
            ctx.user.id,
            input.status,
            input.decisionNote,
            "user"
          );
          let approvalAttemptId: number | null = null;
          let approvalAttemptWarning: string | null = null;
          if (shouldRecordApplicationSubmissionGateAttempt(result.approval)) {
            const applicationId = result.approval.applicationId as number;
            const userApplications = await getUserApplications(ctx.user.id);
            const application = userApplications.find((item) => item.id === applicationId);
            if (application) {
              const job = await getJobById(application.jobId);
              const attempt = await createApplicationAttempt({
                applicationId,
                userId: ctx.user.id,
                jobId: application.jobId,
                platformId: job?.platformId,
                attemptType: "external_handoff",
                status: getApplicationSubmissionGateAttemptStatus(input.status),
                startedAt: new Date(),
                finishedAt: new Date(),
                confirmationText: getApplicationSubmissionGateAttemptText(
                  result.approval,
                  input.status,
                  input.decisionNote
                ),
                retryCount: 0,
              });
              approvalAttemptId = Number(attempt.insertId);
            } else {
              approvalAttemptWarning = "Linked application was not found; approval was resolved without a handoff attempt.";
            }
          }
          await createAuditEvent({
            userId: ctx.user.id,
            entityType: result.approval.applicationId ? "application" : "user",
            entityId: result.approval.applicationId ?? ctx.user.id,
            action: "approval_resolved",
            actor: "user",
            source: "applications.resolveApproval",
            approvalId: input.approvalId,
            afterState: JSON.stringify({
              status: input.status,
              approvalType: result.approval.approvalType,
              entityType: result.approval.entityType,
              entityId: result.approval.entityId,
              decisionNote: input.decisionNote ?? null,
              handoffAttemptId: approvalAttemptId,
              warning: approvalAttemptWarning,
            }),
            riskLevel: result.approval.riskLevel,
          });
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          const message = error instanceof Error ? error.message : "Unable to resolve approval.";
          throw new TRPCError({
            code: message === "Approval not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          applicationId: z.number(),
          status: z.literal("withdrawn"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await withdrawApplication(input.applicationId, ctx.user.id);
          const { createAuditEvent } = await import("./db");
          await createAuditEvent({
            userId: ctx.user.id,
            entityType: "application",
            entityId: input.applicationId,
            action: "application_status_updated",
            actor: "user",
            source: "applications.updateStatus",
            afterState: JSON.stringify({
              status: input.status,
              cancelledApprovalIds: result.cancelledApprovalIds,
              cancelledSubmissionApprovalIds: result.cancelledSubmissionApprovalIds,
            }),
            riskLevel: input.status === "withdrawn" ? "medium" : "low",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to update application.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
        return { success: true };
      }),
    confirmOfferAcceptance: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        confirmed: z.literal(true),
        acceptanceNote: z.string().trim().min(8).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createAuditEvent } = await import("./db");

        try {
          const result = await acceptOfferApplication(input.applicationId, ctx.user.id);
          await createAuditEvent({
            userId: ctx.user.id,
            entityType: "application",
            entityId: input.applicationId,
            action: "offer_acceptance_confirmed",
            actor: "user",
            source: "applications.confirmOfferAcceptance",
            beforeState: JSON.stringify({ status: "offer" }),
            afterState: JSON.stringify({
              status: "accepted",
              confirmed: input.confirmed,
              acceptanceNote: input.acceptanceNote,
              cancelledFollowUpApprovalIds: result.cancelledFollowUpApprovalIds,
              cancelledInterviewIds: result.cancelledInterviewIds,
            }),
            riskLevel: "high",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to confirm offer acceptance.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }

        return { success: true };
      }),
    declineOffer: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        confirmed: z.literal(true),
        declineNote: z.string().trim().min(8).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createAuditEvent, getUserApplications } = await import("./db");
        const application = (await getUserApplications(ctx.user.id)).find((item) => item.id === input.applicationId);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found." });
        }
        if (application.status !== "offer") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Only a recorded offer can be declined.",
          });
        }

        try {
          const result = await withdrawApplication(input.applicationId, ctx.user.id, {
            cancelOfferAttribution: true,
            dismissOfferAttributionReviews: true,
          });
          await createAuditEvent({
            userId: ctx.user.id,
            entityType: "application",
            entityId: input.applicationId,
            action: "offer_declined",
            actor: "user",
            source: "applications.declineOffer",
            beforeState: JSON.stringify({ status: "offer" }),
            afterState: JSON.stringify({
              status: "withdrawn",
              confirmed: input.confirmed,
              declineNote: input.declineNote,
              cancelledOfferAttributionApprovalIds: result.cancelledOfferAttributionApprovalIds,
              dismissedOfferAttributionReviewIds: result.dismissedOfferAttributionReviewIds,
              externalCommunicationSent: false,
            }),
            riskLevel: "high",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to decline offer.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }

        return { success: true };
      }),
    confirmSubmission: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        source: z.enum(["manual", "employer_portal", "email_confirmation", "ats_confirmation"]),
        evidence: z.string().trim().min(8).max(5000),
        confirmationUrl: safeHttpUrl.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await confirmApplicationSubmission(input, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to confirm submission.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),
    recordResponse: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        responseType: z.enum(["viewed", "rejection", "interview_invite", "offer", "employer_question", "other"]),
        source: z.enum(["email", "employer_portal", "linkedin", "phone", "other"]),
        sourceReference: z.string().trim().min(3).max(320).optional(),
        summary: z.string().trim().min(8).max(5000),
        receivedAt: z.string().datetime().transform((s) => new Date(s)).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await recordEmployerResponse(input, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to record employer response.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),
    ingestInboxResponse: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        provider: z.enum(["gmail", "outlook"]),
        messageId: z.string().trim().min(3).max(280).regex(/^\S+$/, "Message ID cannot contain whitespace."),
        responseType: z.enum(["viewed", "rejection", "interview_invite", "offer", "employer_question", "other"]),
        summary: z.string().trim().min(8).max(5000),
        receivedAt: z.string().datetime().transform((value) => new Date(value)).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { listUserConnectorAccounts, createAuditEvent } = await import("./db");
        const account = (await listUserConnectorAccounts(ctx.user.id))
          .find((item) => item.provider === input.provider);
        const requiredScope = input.provider === "gmail"
          ? "email.messages.read_recruiting"
          : "mail.messages.read_recruiting";
        let scopes: string[] = [];
        try {
          const parsed = account?.consentScopes ? JSON.parse(account.consentScopes) : [];
          scopes = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
        } catch {
          scopes = [];
        }
        if (account?.status !== "connected" || !scopes.includes(requiredScope)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `${input.provider === "gmail" ? "Gmail" : "Outlook"} must be connected with recruiting-message read consent before inbox responses can be ingested.`,
          });
        }

        try {
          const result = await recordEmployerResponse({
            applicationId: input.applicationId,
            responseType: input.responseType,
            source: "email",
            sourceReference: `${input.provider}:${input.messageId}`,
            summary: input.summary,
            receivedAt: input.receivedAt,
          }, ctx.user.id);
          if (!result.existing) {
            await createAuditEvent({
              userId: ctx.user.id,
              entityType: "application",
              entityId: input.applicationId,
              action: "inbox_response_ingested",
              actor: "system",
              source: "applications.ingestInboxResponse",
              afterState: JSON.stringify({
                provider: input.provider,
                messageId: input.messageId,
                responseId: result.responseId,
                existing: false,
                responseType: input.responseType,
              }),
              riskLevel: input.responseType === "offer" ? "high" : input.responseType === "interview_invite" ? "medium" : "low",
            });
          }
          return { ...result, provider: input.provider };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to ingest inbox response.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),

    // Application Notes
    addNote: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        noteType: z.enum(["general", "interview", "followup", "research", "feedback"]),
        content: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await addApplicationNote(input, ctx.user.id);
      }),

    getNotes: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getApplicationNotes(input.applicationId, ctx.user.id);
      }),

    updateNote: protectedProcedure
      .input(z.object({ noteId: z.number(), content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await updateApplicationNote(input.noteId, input.content, ctx.user.id);
      }),

    deleteNote: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await deleteApplicationNote(input.noteId, ctx.user.id);
      }),

    // Interview Scheduling
    scheduleInterview: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        interviewType: z.enum(["phone", "video", "onsite", "technical", "behavioral", "panel"]),
        scheduledAt: z.string().datetime().transform((s) => new Date(s)),
        duration: z.number().int().min(5).max(480).optional(),
        location: z.string().trim().max(500).optional(),
        meetingLink: safeHttpUrl.optional(),
        interviewerName: z.string().trim().max(255).optional(),
        interviewerTitle: z.string().trim().max(255).optional(),
        notes: z.string().max(10_000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await scheduleInterview(input, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to schedule interview.";
          throw new TRPCError({
            code: message === "Application not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),

    getInterviews: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getInterviewSchedules(input.applicationId, ctx.user.id);
      }),

    getUpcomingInterviews: protectedProcedure
      .query(async ({ ctx }) => {
        return await getUpcomingInterviews(ctx.user.id);
      }),

    updateInterviewStatus: protectedProcedure
      .input(z.object({
        interviewId: z.number(),
        status: z.enum(["scheduled", "completed", "cancelled", "rescheduled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await updateInterviewStatus(input.interviewId, input.status, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to update interview.";
          throw new TRPCError({
            code: message === "Interview not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),

    recordInterviewOutcome: protectedProcedure
      .input(z.object({
        interviewId: z.number(),
        outcome: z.enum(["next_round", "offer", "rejection", "no_response", "other"]),
        source: z.enum(["email", "employer_portal", "linkedin", "phone", "other"]),
        summary: z.string().trim().min(8).max(5000),
        receivedAt: z.string().datetime().transform((s) => new Date(s)).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await recordInterviewOutcome(input, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to record interview outcome.";
          throw new TRPCError({
            code: message === "Interview not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),

    rescheduleInterview: protectedProcedure
      .input(z.object({
        interviewId: z.number(),
        newDate: z.string().datetime().transform((s) => new Date(s)),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await rescheduleInterview(input.interviewId, input.newDate, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to reschedule interview.";
          throw new TRPCError({
            code: message === "Interview not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),

    // Follow-ups
    createFollowUp: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        message: z.string().trim().min(1).max(MAX_FOLLOW_UP_MESSAGE_CHARS),
        purpose: z.enum(["routine_follow_up", "employer_reply"]).optional(),
        sourceResponseId: z.number().optional(),
      }).strict())
      .mutation(async ({ ctx, input }) => {
        try {
          return await createFollowUp(input, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to save follow-up.";
          throw new TRPCError({ code: "CONFLICT", message });
        }
      }),

    getFollowUps: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getFollowUps(input.applicationId, ctx.user.id);
      }),

    markFollowUpSent: protectedProcedure
      .input(z.object({ followUpId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await markFollowUpSent(input.followUpId, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to update follow-up.";
          throw new TRPCError({
            code: message === "Follow-up not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),

    markFollowUpResponse: protectedProcedure
      .input(z.object({ followUpId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await markFollowUpResponseReceived(input.followUpId, ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to update follow-up.";
          throw new TRPCError({
            code: message === "Follow-up not found." ? "NOT_FOUND" : "CONFLICT",
            message,
          });
        }
      }),

    generateFollowUpEmail: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        type: z.enum(["initial", "reminder", "thank_you", "status_check"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const email = await generateFollowUpEmail(input.applicationId, input.type, ctx.user.id);
        return { email };
      }),

    generateEmployerReplyEmail: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        responseId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await generateEmployerReplyEmail(input.applicationId, ctx.user.id, input.responseId);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to generate employer reply.";
          throw new TRPCError({
            code: message === "Application not found." || message === "Employer response not found."
              ? "NOT_FOUND"
              : "CONFLICT",
            message,
          });
        }
      }),
  }),

  // AI Matching
  matching: router({
    calculateMatch: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getUserProfile, getJobById } = await import("./db");
        const { calculateJobMatch } = await import("./aiMatching");
        const { createJobMatch } = await import("./db");

        const profile = await getUserProfile(ctx.user.id);
        if (!profile) {
          throw new Error("User profile not found. Please complete your profile first.");
        }

        const job = await getJobById(input.jobId);
        if (!job) {
          throw new Error("Job not found");
        }

        const match = await calculateJobMatch(profile, job);

        // Save the match to database
        await createJobMatch({
          userId: ctx.user.id,
          jobId: input.jobId,
          matchScore: match.matchScore,
          matchReasons: match.matchReasons,
          skillsMatch: match.skillsMatch,
          experienceMatch: match.experienceMatch,
          locationMatch: match.locationMatch,
          salaryMatch: match.salaryMatch,
        });

        return match;
      }),
    getMatches: protectedProcedure
      .input(z.object({ minScore: z.number().optional().default(70) }))
      .query(async ({ ctx, input }) => {
        const { getUserJobMatches } = await import("./db");
        return await getUserJobMatches(ctx.user.id, input.minScore);
      }),
  }),

  // AI-Powered Features
  ai: router({
    generateCoverLetter: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getUserProfile, getJobById } = await import("./db");
        const { generateCoverLetter } = await import("./aiMatching");

        const profile = await getUserProfile(ctx.user.id);
        if (!profile) {
          throw new Error("User profile not found");
        }

        const job = await getJobById(input.jobId);
        if (!job) {
          throw new Error("Job not found");
        }

        const coverLetter = await generateCoverLetter(profile, job);
        return { coverLetter };
      }),
    identifyDecisionMakers: protectedProcedure
      .input(z.object({ company: z.string(), jobTitle: z.string() }))
      .mutation(async ({ input }) => {
        const { identifyDecisionMakers } = await import("./aiMatching");
        return await identifyDecisionMakers(input.company, input.jobTitle);
      }),
    generateInterviewPrep: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        const { getJobById } = await import("./db");
        const { generateInterviewPreparation } = await import("./aiMatching");

        const job = await getJobById(input.jobId);
        if (!job) {
          throw new Error("Job not found");
        }

        return await generateInterviewPreparation(job);
      }),
  }),

  // Resume Management
  resume: router({
    upload: protectedProcedure
      .input(
        z.object({
          fileKey: z.string(),
          fileUrl: z.string(),
          fileName: z.string(),
          fileType: z.string(),
        })
      )
      .mutation(async () => {
        // A URL/key pair alone cannot be verified or linked to a resume ledger record.
        // Keep the legacy route registered, but require callers to use a versioned upload.
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Resume metadata-only uploads are no longer supported. Upload resume bytes with resume.uploadWithHistory or import the file with resume.parseFile.",
        });
      }),
    parse: protectedProcedure
      .input(z.object({ resumeText: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { parseResumeText, resumeToProfileData } = await import("./resumeParser");
        const { upsertUserProfile } = await import("./db");

        // Parse the resume text
        const parsed = await parseResumeText(input.resumeText);

        // Convert to profile format
        const profileData = resumeToProfileData(parsed);

        // Update user profile with parsed data
        await upsertUserProfile({
          userId: ctx.user.id,
          ...profileData,
        });

        return { success: true, parsed, profileData };
      }),

    // Parse resume from file (base64 encoded PDF/DOCX)
    parseFile: protectedProcedure
      .input(z.object({
        fileData: z.string(), // Base64 encoded file data
        mimeType: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { parseResumeFromFile, resumeToProfileData } = await import("./resumeParser");
        const { upsertUserProfile } = await import("./db");
        const { RESUME_MIME_TYPES, validateUploadedFile } = await import("./uploadValidation");
        
        // Decode base64 to buffer
        const buffer = Buffer.from(input.fileData, "base64");
        const validation = validateUploadedFile({
          data: buffer,
          fileName: input.filename,
          mimeType: input.mimeType,
          allowedMimeTypes: RESUME_MIME_TYPES,
        });
        
        // Parse the resume
        const parsed = await parseResumeFromFile(buffer, input.mimeType);
        
        // Convert to profile format
        const profileData = resumeToProfileData(parsed);
        
        // Store the parsed file through the versioned resume service so active profile metadata
        // and the resume used by application preparation always point to the same artifact.
        const resume = await uploadResume(
          ctx.user.id,
          buffer,
          validation.fileName,
          input.mimeType
        );

        // Update user profile with parsed data and file info
        await upsertUserProfile({
          userId: ctx.user.id,
          resumeUrl: resume.fileUrl,
          resumeFileKey: resume.fileKey,
          ...profileData,
        });
        
        return {
          success: true,
          parsed,
          profileData,
          resume,
          fileUrl: resume.fileUrl,
          fileKey: resume.fileKey,
        };
      }),

    // Upload resume with version history
    uploadWithHistory: protectedProcedure
      .input(z.object({
        fileData: z.string(), // Base64 encoded
        fileName: z.string(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        const resume = await uploadResume(ctx.user.id, buffer, input.fileName, input.mimeType);
        const { upsertUserProfile } = await import("./db");
        await upsertUserProfile({
          userId: ctx.user.id,
          resumeUrl: resume.fileUrl,
          resumeFileKey: resume.fileKey,
        });
        return resume;
      }),

    // Get active resume
    getActive: protectedProcedure
      .query(async ({ ctx }) => getActiveResume(ctx.user.id)),

    // Get all versions
    getVersions: protectedProcedure
      .query(async ({ ctx }) => getResumeVersions(ctx.user.id)),

    // Set active version
    setActiveVersion: protectedProcedure
      .input(z.object({ version: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const success = await setActiveVersion(ctx.user.id, input.version);
        if (success) {
          const resume = await getActiveResume(ctx.user.id);
          const { upsertUserProfile } = await import("./db");
          await upsertUserProfile({
            userId: ctx.user.id,
            resumeUrl: resume?.fileUrl ?? null,
            resumeFileKey: resume?.fileKey ?? null,
          });
        }
        return { success };
      }),

    // Delete a version
    deleteVersion: protectedProcedure
      .input(z.object({ version: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const success = await deleteResumeVersion(ctx.user.id, input.version);
        if (success) {
          const resume = await getActiveResume(ctx.user.id);
          const { upsertUserProfile } = await import("./db");
          await upsertUserProfile({
            userId: ctx.user.id,
            resumeUrl: resume?.fileUrl ?? null,
            resumeFileKey: resume?.fileKey ?? null,
          });
        }
        return { success };
      }),

    // Get resume stats
    getStats: protectedProcedure
      .query(async ({ ctx }) => getResumeStats(ctx.user.id)),

    // Get download URL
    getDownloadUrl: protectedProcedure
      .input(z.object({ version: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const url = await getResumeDownloadUrl(ctx.user.id, input.version);
        return { url };
      }),
  }),

  // Job Scraping (Admin only)
  scraping: router({
    listScrapers: adminProcedure.query(async () => {
      const { getSupportedPlatforms } = await import("./scrapers/index");
      return getSupportedPlatforms();
    }),
    scrapePlatform: adminProcedure
      .input(z.object({
        platform: z.string(),
        keywords: z.string().optional(),
        location: z.string().optional(),
        limit: z.number().int().min(1).max(1000).optional(),
      }))
      .mutation(async ({ input }) => {
        const { getScraperManager } = await import("./scrapers/scraperManager");
        const manager = await getScraperManager();
        const result = await manager.scrapePlatform(input.platform, {
          keywords: input.keywords,
          location: input.location,
          limit: input.limit,
        });
        const saveResult = await manager.saveJobs(result.jobs);
        return { ...result, saved: saveResult.saved, duplicates: saveResult.duplicates };
      }),
    scrapeAll: adminProcedure
      .input(z.object({
        keywords: z.string().optional(),
        location: z.string().optional(),
        limit: z.number().int().min(1).max(1000).optional(),
      }).optional())
      .mutation(async ({ input }) => {
        const { getScraperManager } = await import("./scrapers/scraperManager");
        const manager = await getScraperManager();
        return await manager.runScrapingCycle(input);
      }),
    runScrape: adminProcedure
      .input(
        z.object({
          platform: z.string().optional(),
          keywords: z.string().optional(),
          limit: z.number().int().min(1).max(1000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { getScraperManager } = await import("./scrapers/scraperManager");
        const manager = await getScraperManager();

        if (input.platform) {
          // Scrape specific platform
          const result = await manager.scrapePlatform(input.platform, {
            keywords: input.keywords,
            limit: input.limit,
          });

          // Save jobs
          const saveResult = await manager.saveJobs(result.jobs);

          return {
            platform: input.platform,
            scraped: result.jobs.length,
            saved: saveResult.saved,
            duplicates: saveResult.duplicates,
            errors: result.errors,
          };
        } else {
          // Scrape all platforms
          const result = await manager.runScrapingCycle({
            keywords: input.keywords,
            limit: input.limit,
          });

          return result;
        }
      }),
    status: adminProcedure.query(async () => {
      const { getScraperManager } = await import("./scrapers/scraperManager");
      const { getSupportedPlatforms } = await import("./scrapers/index");
      const { getScheduler } = await import("./scrapers/scheduler");
      const { getAllJobPlatforms } = await import("./db");
      const manager = await getScraperManager();
      const supportedPlatforms = getSupportedPlatforms();
      const scheduler = getScheduler();
      const schedulerStatus = scheduler.getStatus();
      const configuredPlatforms = await getAllJobPlatforms();
      const configuredSupportedPlatforms = configuredPlatforms
        .filter((platform) => supportedPlatforms.includes(platform.name))
      const initializedPlatformNames = new Set(manager.getInitializedPlatforms());
      const platforms = configuredSupportedPlatforms
        .filter((platform) => platform.isActive === 1)
        .map((platform) => ({
          id: platform.id,
          name: platform.name,
          category: platform.category,
          tier: platform.tier,
          isActive: platform.isActive === 1,
          lastScraped: platform.lastScraped,
          readiness: initializedPlatformNames.has(platform.name) ? "ready" : "unavailable",
          initializationError: manager.getInitializationError(platform.name),
        }));
      const inactiveConfiguredSources = configuredSupportedPlatforms.filter((platform) => platform.isActive !== 1);
      const unconfiguredSources = supportedPlatforms.filter(
        (platformName) => !configuredPlatforms.some((platform) => platform.name === platformName)
      );
      const unsupportedConfiguredSources = configuredPlatforms
        .filter((platform) => !supportedPlatforms.includes(platform.name))
        .map((platform) => platform.name);
      const readySources = platforms.filter((platform) => platform.readiness === "ready");

      return {
        initialized: true,
        availableScrapers: readySources.length,
        registeredScrapers: supportedPlatforms.length,
        supportedPlatforms,
        platforms,
        coverage: {
          registeredSources: supportedPlatforms.length,
          configuredActiveSources: platforms.length,
          readySources: readySources.length,
          unavailableConfiguredSources: platforms.filter((platform) => platform.readiness === "unavailable").length,
          unconfiguredSources: unconfiguredSources.length,
          inactiveConfiguredSources: inactiveConfiguredSources.length,
          unsupportedConfiguredSources,
        },
        scheduler: schedulerStatus,
        message: `${readySources.length} configured source${readySources.length === 1 ? " is" : "s are"} ready for discovery. ${unconfiguredSources.length} registered source${unconfiguredSources.length === 1 ? " is" : "s are"} not configured.`,
      };
    }),

    // Start the scheduler
    startScheduler: adminProcedure
      .input(z.object({
        intervalMinutes: z.number().min(5).max(1440).optional(),
        maxJobsPerRun: z.number().min(10).max(1000).optional(),
        enabledPlatforms: z.array(z.string().trim().min(1).max(255)).max(100).optional(),
      }).optional())
      .mutation(async ({ input }) => {
        const { getScheduler } = await import("./scrapers/scheduler");
        const { getScraperManager } = await import("./scrapers/scraperManager");
        const manager = await getScraperManager();
        const readyPlatforms = new Set(manager.getInitializedPlatforms());
        if (readyPlatforms.size === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No configured, ready scraper sources are available to schedule.",
          });
        }
        const currentScheduler = getScheduler();
        const requestedPlatforms = input?.enabledPlatforms ?? currentScheduler.getStatus().enabledPlatforms;
        const unsupportedPlatforms = requestedPlatforms?.filter(
          (platformName) => !readyPlatforms.has(platformName)
        ) ?? [];
        if (unsupportedPlatforms.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No configured, ready scraper is available for: ${unsupportedPlatforms.join(", ")}`,
          });
        }
        const scheduler = input ? getScheduler({
          intervalMinutes: input.intervalMinutes || 60,
          maxJobsPerRun: input.maxJobsPerRun || 100,
          enabledPlatforms: input.enabledPlatforms ?? null,
        }) : currentScheduler;
        
        scheduler.start();
        return { success: true, message: "Scheduler started", scheduler: scheduler.getStatus() };
      }),

    // Stop the scheduler
    stopScheduler: adminProcedure.mutation(async () => {
      const { getScheduler } = await import("./scrapers/scheduler");
      const scheduler = getScheduler();
      scheduler.stop();
      return { success: true, message: "Scheduler stopped", scheduler: scheduler.getStatus() };
    }),

    // Run scraping manually
    runNow: adminProcedure.mutation(async () => {
      const { getScheduler } = await import("./scrapers/scheduler");
      const scheduler = getScheduler();
      await scheduler.runScraping();
      return { success: true, message: "Scraping run completed", scheduler: scheduler.getStatus() };
    }),
  }),

  // Diversity & Inclusion Support
  diversity: router({
    analyzeCompanyDI: protectedProcedure
      .input(z.object({
        company: z.string(),
        userDIProfile: z.object({
          categories: z.array(z.string()),
          accommodationsNeeded: z.array(z.string()),
          preferredWorkStyle: z.enum(["remote", "hybrid", "onsite", "flexible"]),
          accessibilityRequirements: z.array(z.string()),
          disclosurePreference: z.enum(["always", "when_relevant", "never"]),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const { analyzeCompanyDI } = await import("./diversitySupport");
        return await analyzeCompanyDI(input.company, input.userDIProfile as any);
      }),

    analyzeVisaSponsorship: protectedProcedure
      .input(z.object({
        company: z.string(),
        jobTitle: z.string(),
        visaProfile: z.object({
          currentStatus: z.string(),
          needsSponsorship: z.boolean(),
          sponsorshipType: z.array(z.string()).optional(),
          country: z.string(),
          optStemEligible: z.boolean().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const { analyzeVisaSponsorship } = await import("./diversitySupport");
        return await analyzeVisaSponsorship(input.company, input.jobTitle, input.visaProfile as any);
      }),

    getAccommodationRecommendations: protectedProcedure
      .input(z.object({
        category: z.string(),
        specificNeeds: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        const { generateAccommodationRecommendations } = await import("./diversitySupport");
        return await generateAccommodationRecommendations(input.category as any, input.specificNeeds);
      }),

    getDIPlatforms: publicProcedure
      .input(z.object({
        categories: z.array(z.string()),
      }))
      .query(async ({ input }) => {
        const { getDIPlatforms } = await import("./diversitySupport");
        return getDIPlatforms(input.categories as any);
      }),

    analyzeRelocation: protectedProcedure
      .input(z.object({
        fromLocation: z.string(),
        toLocation: z.string(),
        salary: z.number(),
        familySize: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { analyzeRelocation } = await import("./diversitySupport");
        return await analyzeRelocation(
          input.fromLocation,
          input.toLocation,
          input.salary,
          input.familySize
        );
      }),
  }),

  // Career Intelligence
  career: router({
    analyzeSalary: protectedProcedure
      .input(z.object({
        jobTitle: z.string(),
        company: z.string(),
        location: z.string(),
        yearsExperience: z.number(),
        skills: z.array(z.string()),
        currentSalary: z.number().optional(),
        offeredSalary: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { analyzeSalary } = await import("./careerIntelligence");
        return await analyzeSalary(
          input.jobTitle,
          input.company,
          input.location,
          input.yearsExperience,
          input.skills,
          input.currentSalary,
          input.offeredSalary
        );
      }),

    analyzeCompanyCulture: protectedProcedure
      .input(z.object({
        company: z.string(),
        jobTitle: z.string(),
        jobDescription: z.string(),
        userPreferences: z.object({
          workStyle: z.string().optional(),
          values: z.array(z.string()).optional(),
          priorities: z.array(z.string()).optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const { analyzeCompanyCulture } = await import("./careerIntelligence");
        return await analyzeCompanyCulture(
          input.company,
          input.jobTitle,
          input.jobDescription,
          input.userPreferences
        );
      }),

    generateNetworkingStrategy: protectedProcedure
      .input(z.object({
        targetCompany: z.string(),
        targetRole: z.string(),
        userBackground: z.string(),
        existingConnections: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { generateNetworkingStrategy } = await import("./careerIntelligence");
        return await generateNetworkingStrategy(
          input.targetCompany,
          input.targetRole,
          input.userBackground,
          input.existingConnections
        );
      }),

    generateCareerPlan: protectedProcedure
      .input(z.object({
        currentRole: z.string(),
        targetRole: z.string(),
        yearsExperience: z.number(),
        skills: z.array(z.string()),
        interests: z.array(z.string()),
        constraints: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { generateCareerPlan } = await import("./careerIntelligence");
        return await generateCareerPlan(
          input.currentRole,
          input.targetRole,
          input.yearsExperience,
          input.skills,
          input.interests,
          input.constraints
        );
      }),

    analyzeSkillGap: protectedProcedure
      .input(z.object({
        jobRequirements: z.string(),
        userSkills: z.array(z.string()),
        userExperience: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { analyzeSkillGap } = await import("./careerIntelligence");
        return await analyzeSkillGap(
          input.jobRequirements,
          input.userSkills,
          input.userExperience
        );
      }),
  }),

  // Social Connections
  social: router({
    validateUrl: publicProcedure
      .input(z.object({
        url: z.string().trim().min(1).max(1000),
        type: z.enum(["linkedin", "github", "portfolio"]),
      }))
      .query(async ({ input }) => {
        const { validateLinkedInUrl, validateGitHubUrl, validatePortfolioUrl } = await import("./socialConnections");
        
        let isValid = false;
        switch (input.type) {
          case "linkedin":
            isValid = validateLinkedInUrl(input.url);
            break;
          case "github":
            isValid = validateGitHubUrl(input.url);
            break;
          case "portfolio":
            isValid = validatePortfolioUrl(input.url);
            break;
        }
        
        return { isValid, type: input.type, url: input.url };
      }),

    connect: protectedProcedure
      .input(z.object({
        linkedinUrl: safeHttpUrl.optional(),
        githubUrl: safeHttpUrl.optional(),
        portfolioUrl: safeHttpUrl.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { validateLinkedInUrl, validateGitHubUrl, validatePortfolioUrl } = await import("./socialConnections");
        const { upsertUserProfile } = await import("./db");

        const invalidConnection =
          (input.linkedinUrl && !validateLinkedInUrl(input.linkedinUrl)) ||
          (input.githubUrl && !validateGitHubUrl(input.githubUrl)) ||
          (input.portfolioUrl && !validatePortfolioUrl(input.portfolioUrl));
        if (invalidConnection) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more social profile URLs are invalid.",
          });
        }

        await upsertUserProfile({
          userId: ctx.user.id,
          linkedinUrl: input.linkedinUrl,
          githubUrl: input.githubUrl,
          portfolioUrl: input.portfolioUrl,
        });
        
        return { success: true };
      }),
    disconnect: protectedProcedure
      .input(z.object({
        type: z.enum(["linkedin", "github", "portfolio"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getUserProfile, upsertUserProfile } = await import("./db");
        const profile = await getUserProfile(ctx.user.id);
        await upsertUserProfile({
          userId: ctx.user.id,
          linkedinUrl: input.type === "linkedin" ? null : profile?.linkedinUrl,
          githubUrl: input.type === "github" ? null : profile?.githubUrl,
          portfolioUrl: input.type === "portfolio" ? null : profile?.portfolioUrl,
        });
        return { success: true };
      }),
    getConnections: protectedProcedure.query(async ({ ctx }) => {
      const { getUserProfile } = await import("./db");
      const profile = await getUserProfile(ctx.user.id);
      return [
        { type: "linkedin", url: profile?.linkedinUrl || null, connected: Boolean(profile?.linkedinUrl) },
        { type: "github", url: profile?.githubUrl || null, connected: Boolean(profile?.githubUrl) },
        { type: "portfolio", url: profile?.portfolioUrl || null, connected: Boolean(profile?.portfolioUrl) },
      ];
    }),

    analyzeLinkedIn: protectedProcedure
      .input(z.object({ profileText: socialProfileText }))
      .mutation(async ({ input }) => {
        const { analyzeLinkedInProfile } = await import("./socialConnections");
        return await analyzeLinkedInProfile(input.profileText);
      }),

    analyzeGitHub: protectedProcedure
      .input(z.object({ profileText: socialProfileText }))
      .mutation(async ({ input }) => {
        const { analyzeGitHubProfile } = await import("./socialConnections");
        return await analyzeGitHubProfile(input.profileText);
      }),

    analyzePortfolio: protectedProcedure
      .input(z.object({ portfolioText: socialProfileText }))
      .mutation(async ({ input }) => {
        const { analyzePortfolio } = await import("./socialConnections");
        return await analyzePortfolio(input.portfolioText);
      }),
  }),

  // Automated Application
  automation: router({
    detectATS: publicProcedure
      .input(z.object({ url: z.string().trim().min(1).max(1000) }))
      .query(async ({ input }) => {
        const { isAutomationSupported } = await import("./applicationAutomation");
        const support = isAutomationSupported(input.url);

        return support;
      }),
    getATSSupport: publicProcedure.query(async () => {
      return {
        submissionSupported: [],
        preparationSupported: ["greenhouse", "lever"],
        guarded: ["workday", "taleo", "smartrecruiters"],
        manualReviewRequired: ["unknown"],
        notes: "No ATS is currently enabled for unattended final submission. Greenhouse and Lever forms can be prepared for review.",
      };
    }),
    plan: protectedProcedure
      .input(z.object({
        mode: z.enum(["review_first", "auto_apply"]).optional(),
        minMatchScore: z.number().min(0).max(100).optional(),
        dailyApplicationLimit: z.number().min(1).max(25).optional(),
        remoteOnly: z.boolean().optional(),
        requireHumanReview: z.boolean().optional(),
        allowUnsupportedATS: z.boolean().optional(),
        createFollowUps: z.boolean().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getActiveJobs, getUserProfile, getUserApplications } = await import("./db");
        const { buildAutonomousPlan, parseAutonomousPreferences } = await import("./autonomousOrchestrator");
        const { getAutonomousEvidenceContext } = await import("./autonomousEvidence");
        const [jobList, profile, applications] = await Promise.all([
          getActiveJobs(250, 0),
          getUserProfile(ctx.user.id),
          getUserApplications(ctx.user.id),
        ]);
        const resolvedPreferences = {
          ...parseAutonomousPreferences(profile?.preferences),
          ...(input || {}),
        };

        const evidenceContext = await getAutonomousEvidenceContext(ctx.user.id, {
          profile,
          applications,
        });
        const plan = buildAutonomousPlan(
          jobList,
          profile,
          applications as any,
          resolvedPreferences,
          evidenceContext.readiness.signals.hasResume
        );

        return {
          ...plan,
          profileEvidence: evidenceContext.profileEvidence,
          connectorReadiness: evidenceContext.connectorReadiness,
          evidenceGates: evidenceContext.evidenceGates,
        };
      }),
    run: protectedProcedure
      .input(z.object({
        mode: z.enum(["review_first", "auto_apply"]).optional(),
        minMatchScore: z.number().min(0).max(100).optional(),
        dailyApplicationLimit: z.number().min(1).max(25).optional(),
        remoteOnly: z.boolean().optional(),
        requireHumanReview: z.boolean().optional(),
        allowUnsupportedATS: z.boolean().optional(),
        createFollowUps: z.boolean().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const { runAutonomousForUser } = await import("./autonomousService");
        return await runAutonomousForUser(ctx.user.id, input || {});
      }),
    schedulerStatus: protectedProcedure.query(async ({ ctx }) => {
      const { getAutonomousScheduler } = await import("./autonomousScheduler");
      const { getAutonomousRunState, getUserProfile } = await import("./db");
      const { parseAutonomousPreferences } = await import("./autonomousOrchestrator");
      const scheduler = getAutonomousScheduler();
      const status = scheduler.getStatus();
      const userStatus = scheduler.getUserStatus(ctx.user.id);
      const persistedRunState = await getAutonomousRunState(ctx.user.id);
      const persistedSummary = persistedRunState?.lastStatus === "completed"
        ? persistedRunState.lastRunSummary
        : null;
      const persistedRunAt = persistedRunState?.lastStatus === "completed"
        ? persistedRunState.lastCompletedAt || persistedRunState.lastStartedAt
        : persistedRunState?.lastStartedAt || null;
      const profile = await getUserProfile(ctx.user.id);
      const preferences = parseAutonomousPreferences(profile?.preferences);
      return {
        isStarted: status.isStarted,
        isRunning: status.isRunning,
        userEnabled: preferences.autonomousEnabled === true,
        lastCycleAt: persistedRunAt || userStatus?.lastRunAt || null,
        lastStatus: persistedRunState?.lastStatus || null,
        lastError: persistedRunState?.lastError || null,
        nextCycleAt: status.nextCycleAt,
        usersRun: persistedRunState?.lastStatus === "completed" || (!persistedRunState && userStatus) ? 1 : 0,
        jobsQueued: (persistedSummary
          ? persistedSummary.queuedApplicationRecords + persistedSummary.queuedReviewRecords + persistedSummary.queuedManualRecords
          : undefined) ?? userStatus?.jobsQueued ?? 0,
        followUpDraftsQueued: persistedSummary?.queuedFollowUps ?? userStatus?.followUpDraftsQueued ?? 0,
        duplicateFollowUpsSkipped: persistedSummary?.skippedDuplicateFollowUps ?? userStatus?.duplicateFollowUpsSkipped ?? 0,
        resumeEvidenceBlockedActions: persistedSummary?.skippedResumeEvidenceActions ?? userStatus?.resumeEvidenceBlockedActions ?? 0,
        profileReadinessBlockedActions: persistedSummary?.skippedProfileReadinessActions ?? userStatus?.profileReadinessBlockedActions ?? 0,
        evidenceGatedActions: persistedSummary?.skippedEvidenceGatedActions ?? userStatus?.evidenceGatedActions ?? 0,
        failedActions: persistedSummary?.failedActions ?? userStatus?.failedActions ?? 0,
        errorCount: persistedRunState?.lastStatus === "failed" ? 1 : userStatus?.errorCount || 0,
      };
    }),
    applyToJob: protectedProcedure
      .input(
        z.object({
          jobId: z.number(),
          coverLetter: z.string().trim().max(50_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const {
          getJobById,
          getUserProfile,
          createApplication,
          createApplicationMaterial,
          createApplicationAttempt,
          createAuditEvent,
          createAdminReviewItem,
          createApplicationApproval,
        } = await import("./db");
        const {
          applyToJob,
          getVerifiedApplicationSubmissionEvidence,
          prepareApplicationData,
          validateApplicationData,
        } = await import(
          "./applicationAutomation"
        );

        // Get job details
        const job = await getJobById(input.jobId);
        if (!job) {
          throw new Error("Job not found");
        }

        if (!job.applicationUrl) {
          throw new Error("Job does not have an application URL");
        }

        // Get user profile
        const profile = await getUserProfile(ctx.user.id);
        if (!profile) {
          throw new Error("User profile not found. Please complete your profile first.");
        }

        // The versioned resume record is the source of truth for prepared application
        // material. Profile URL fields alone cannot prove that a resumable upload exists.
        const activeResume = await getActiveResume(ctx.user.id);
        if (!activeResume) {
          throw new Error("An active versioned resume is required before Hire.AI can prepare an application. Upload or select a resume on your profile first.");
        }
        const {
          applicationPreparationBlockMessage,
          getApplicationPreparationSafety,
        } = await import("./applicationPreparationSafety");
        const preparationSafety = await getApplicationPreparationSafety(ctx.user.id);
        if (!preparationSafety.allowed) {
          throw new Error(applicationPreparationBlockMessage(preparationSafety));
        }
        const profileForApplication = {
          ...profile,
          resumeUrl: activeResume.fileUrl,
          resumeFileKey: activeResume.fileKey,
        };

        // Prepare application data
        const applicationData = prepareApplicationData(ctx.user, profileForApplication, input.coverLetter);
        if (!applicationData) {
          throw new Error("Unable to prepare application data. Please ensure your profile is complete.");
        }

        // Validate application data
        const validation = validateApplicationData(applicationData);
        if (!validation.valid) {
          throw new Error(`Invalid application data: ${validation.errors.join(", ")}`);
        }

        // Attempt automated application
        const result = await applyToJob(job.applicationUrl, applicationData);

        // A preparation result never becomes an applied record without explicit proof.
        const submissionEvidence = getVerifiedApplicationSubmissionEvidence(result);
        const submissionRecorded = submissionEvidence !== null;

        // Create application record
        const applicationRecord = await createApplication({
          userId: ctx.user.id,
          jobId: input.jobId,
          status: submissionRecorded ? "applied" : "pending",
          appliedDate: submissionRecorded ? new Date() : undefined,
          coverLetter: input.coverLetter,
          notes: result.message,
          isAutoApplied: submissionRecorded ? 1 : 0,
        });
        const applicationRecordId = Number(applicationRecord.insertId);
        await createApplicationMaterial({
          applicationId: applicationRecordId,
          resumeId: activeResume.id,
          coverLetter: input.coverLetter,
          customAnswers: applicationData.answers ? JSON.stringify(applicationData.answers) : undefined,
          sourceProfileSnapshot: profileSnapshotForApplication(ctx.user, profileForApplication),
        });
        await createApplicationAttempt({
          applicationId: applicationRecordId,
          userId: ctx.user.id,
          jobId: input.jobId,
          platformId: job.platformId,
          attemptType: "prepare",
          status: submissionRecorded
            ? "submitted"
            : result.reviewRequired
              ? "review_required"
              : result.prepared
                ? "prepared"
                : "failed",
          startedAt: new Date(),
          finishedAt: new Date(),
          errorMessage: result.error,
          confirmationText: submissionEvidence?.noteContent ?? (result.confirmationId
            ? `${result.message} Confirmation: ${result.confirmationId}`
            : result.message),
          confirmationUrl: submissionEvidence?.confirmationUrl ?? undefined,
          retryCount: 0,
        });
        await createAuditEvent({
          userId: ctx.user.id,
          entityType: "application",
          entityId: applicationRecordId,
          action: submissionRecorded ? "application_submitted_by_automation" : "application_prepared_by_automation",
          actor: "system",
          source: "automation.applyToJob",
          afterState: JSON.stringify({
            jobId: input.jobId,
            atsType: result.atsType,
            prepared: result.prepared,
            submissionAttempted: result.submissionAttempted,
            reviewRequired: result.reviewRequired,
            externalSubmissionPerformed: submissionRecorded,
            status: submissionRecorded ? "applied" : "pending",
            resume: {
              id: activeResume.id,
              version: activeResume.version,
              fileName: activeResume.fileName,
              fileKey: activeResume.fileKey,
            },
          }),
          riskLevel: submissionRecorded ? "high" : result.reviewRequired ? "medium" : "low",
        });
        if (!submissionRecorded) {
          await createAdminReviewItem({
            userId: ctx.user.id,
            entityType: "application",
            entityId: applicationRecordId,
            category: "application_review",
            priority: result.reviewRequired ? "high" : "medium",
            title: "Automation prepared application for review",
            description: result.message,
          });
          await createApplicationApproval({
            userId: ctx.user.id,
            applicationId: applicationRecordId,
            entityType: "application",
            entityId: applicationRecordId,
            approvalType: "application_submission",
            status: "pending",
            riskLevel: result.reviewRequired ? "high" : "medium",
            requestedBy: "system",
            title: "Approve automation-prepared submission",
            description: result.message,
            payload: JSON.stringify({
              jobId: input.jobId,
              atsType: result.atsType,
              prepared: result.prepared,
              submissionAttempted: result.submissionAttempted,
              resumeId: activeResume.id,
              resumeVersion: activeResume.version,
              source: "automation.applyToJob",
            }),
          });
        }

        return {
          ...result,
          applicationRecordId,
          applicationUrl: job.applicationUrl,
        };
      }),
  }),

  // Job Normalization
  normalization: router({
    normalizeSalary: publicProcedure
      .input(z.object({ salary: z.string().max(500) }))
      .query(({ input }) => normalizeSalary(input.salary)),

    normalizeLocation: publicProcedure
      .input(z.object({ location: z.string().max(500) }))
      .query(({ input }) => normalizeLocation(input.location)),

    normalizeJobType: publicProcedure
      .input(z.object({ jobType: z.string().max(200) }))
      .query(({ input }) => normalizeJobType(input.jobType)),

    normalizeExperienceLevel: publicProcedure
      .input(z.object({ text: z.string().max(5000) }))
      .query(({ input }) => normalizeExperienceLevel(input.text)),

    extractSkills: publicProcedure
      .input(z.object({ description: z.string().max(50_000) }))
      .query(({ input }) => extractSkills(input.description)),

    extractBenefits: publicProcedure
      .input(z.object({ description: z.string().max(50_000) }))
      .query(({ input }) => extractBenefits(input.description)),

    checkDuplicate: protectedProcedure
      .input(z.object({ text: z.string(), threshold: z.number().optional() }))
      .query(({ input }) => {
        const deduplicator = getDeduplicator();
        return deduplicator.isDuplicate(input.text, input.threshold || 0.85);
      }),

    addToCorpus: protectedProcedure
      .input(z.object({ id: z.number(), text: z.string() }))
      .mutation(({ input }) => {
        const deduplicator = getDeduplicator();
        deduplicator.addDocument(input.id, input.text);
        return { success: true, stats: deduplicator.getStats() };
      }),
  }),

  // Real-Time Job Discovery
  discovery: router({
    getRecentJobs: publicProcedure
      .input(z.object({
        limit: boundedPageSize.optional(),
        offset: boundedOffset.optional(),
        keywords: z.array(boundedFilterText).max(20).optional(),
        locations: z.array(boundedFilterText).max(20).optional(),
        platformIds: z.array(z.number().int().positive()).max(100).optional(),
        minSalary: z.number().int().min(0).max(10_000_000).optional(),
        jobTypes: z.array(z.enum(["full-time", "part-time", "contract", "temporary"])).max(4).optional(),
      }))
      .query(async ({ input }) => getRecentJobs(input)),

    searchJobs: publicProcedure
      .input(z.object({
        query: z.string().trim().min(1).max(500),
        limit: boundedPageSize.optional(),
        offset: boundedOffset.optional(),
      }))
      .query(async ({ input }) => searchJobs(input.query, { limit: input.limit, offset: input.offset })),

    getStats: publicProcedure
      .query(async () => getDiscoveryStats()),

    subscribe: protectedProcedure
      .input(z.object({
        keywords: z.array(z.string()).optional(),
        locations: z.array(z.string()).optional(),
        platformIds: z.array(z.number()).optional(),
        minSalary: z.number().optional(),
        jobTypes: z.array(z.enum(["full-time", "part-time", "contract", "temporary"])).max(4).optional(),
      }))
      .mutation(({ ctx, input }) => {
        const manager = getSubscriptionManager();
        manager.subscribe({
          userId: ctx.user.id,
          filters: input,
          callback: (event) => console.log(`[Discovery] Event for user ${ctx.user.id}:`, event.type),
        });
        return { success: true, message: "Subscribed to job updates" };
      }),

    unsubscribe: protectedProcedure
      .mutation(({ ctx }) => {
        const manager = getSubscriptionManager();
        manager.unsubscribe(ctx.user.id);
        return { success: true, message: "Unsubscribed from job updates" };
      }),

    triggerCheck: protectedProcedure
      .mutation(async () => {
        const manager = getSubscriptionManager();
        const jobs = await manager.triggerCheck();
        return { jobs, count: jobs.length };
      }),
  }),

  // Job Alerts
  alerts: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        keywords: z.string().optional(),
        locations: z.string().optional(),
        platforms: z.string().optional(),
        minSalary: z.number().optional(),
        jobTypes: z.string().optional(),
        frequency: z.enum(["instant", "daily", "weekly"]),
      }))
      .mutation(async ({ ctx, input }) => {
        return await createJobAlert({
          userId: ctx.user.id,
          ...input,
        });
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await getJobAlerts(ctx.user.id);
      }),

    update: protectedProcedure
      .input(z.object({
        alertId: z.number(),
        name: z.string().optional(),
        keywords: z.string().optional(),
        locations: z.string().optional(),
        platforms: z.string().optional(),
        minSalary: z.number().optional(),
        jobTypes: z.string().optional(),
        frequency: z.enum(["instant", "daily", "weekly"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { alertId, ...updates } = input;
        return await updateJobAlert(ctx.user.id, alertId, updates);
      }),

    toggle: protectedProcedure
      .input(z.object({ alertId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return await toggleJobAlert(ctx.user.id, input.alertId, input.isActive);
      }),

    delete: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await deleteJobAlert(ctx.user.id, input.alertId);
      }),
  }),

  // Interview Preparation
  interviewPrep: router({
    generateQuestions: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        return await generateInterviewQuestions(input.jobId);
      }),

    mockInterview: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        userResponse: z.string(),
        questionIndex: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await conductMockInterview(input.jobId, input.userResponse, input.questionIndex);
      }),

    videoTips: protectedProcedure
      .input(z.object({ jobTitle: z.string() }))
      .query(async ({ input }) => {
        return await getVideoInterviewTips(input.jobTitle);
      }),
  }),
  successFees: successFeesRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
