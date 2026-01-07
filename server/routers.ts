import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

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
    list: publicProcedure
      .input(
        z.object({
          limit: z.number().optional().default(50),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input }) => {
        const { getActiveJobs } = await import("./db");
        return await getActiveJobs(input.limit, input.offset);
      }),
    search: publicProcedure
      .input(
        z.object({
          title: z.string().optional(),
          company: z.string().optional(),
          location: z.string().optional(),
          skills: z.string().optional(),
          limit: z.number().optional().default(50),
          offset: z.number().optional().default(0),
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
  }),

  // User Profile
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { getUserProfile } = await import("./db");
      return await getUserProfile(ctx.user.id);
    }),
    update: protectedProcedure
      .input(
        z.object({
          skills: z.string().optional(),
          experience: z.string().optional(),
          education: z.string().optional(),
          preferences: z.string().optional(),
          desiredJobTypes: z.string().optional(),
          desiredLocations: z.string().optional(),
          salaryExpectationMin: z.number().optional(),
          salaryExpectationMax: z.number().optional(),
          resumeUrl: z.string().optional(),
          resumeFileKey: z.string().optional(),
          linkedinUrl: z.string().optional(),
          githubUrl: z.string().optional(),
          portfolioUrl: z.string().optional(),
          diversityGroup: z.string().optional(),
          needsVisaSponsorship: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { upsertUserProfile } = await import("./db");
        await upsertUserProfile({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
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
        const { createApplication } = await import("./db");
        await createApplication({
          userId: ctx.user.id,
          jobId: input.jobId,
          coverLetter: input.coverLetter,
          customResume: input.customResume,
          notes: input.notes,
          status: "pending",
          appliedDate: new Date(),
        });
        return { success: true };
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          applicationId: z.number(),
          status: z.enum(["pending", "applied", "viewed", "interview", "offer", "rejected", "accepted", "withdrawn"]),
        })
      )
      .mutation(async ({ input }) => {
        const { updateApplicationStatus } = await import("./db");
        await updateApplicationStatus(input.applicationId, input.status);
        return { success: true };
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
      .mutation(async ({ ctx, input }) => {
        const { upsertUserProfile } = await import("./db");
        
        // Save resume file info to user profile
        await upsertUserProfile({
          userId: ctx.user.id,
          resumeUrl: input.fileUrl,
          resumeFileKey: input.fileKey,
        });

        return { success: true, fileUrl: input.fileUrl };
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
  }),

  // Job Scraping (Admin only)
  scraping: router({
    runScrape: protectedProcedure
      .input(
        z.object({
          platform: z.string().optional(),
          keywords: z.string().optional(),
          limit: z.number().optional(),
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
    status: protectedProcedure.query(async () => {
      const { getScraperManager } = await import("./scrapers/scraperManager");
      const manager = await getScraperManager();

      return {
        initialized: true,
        availableScrapers: 1, // Only RemoteOK for now
        message: "Scraper system ready. Currently supporting RemoteOK platform.",
      };
    }),
  }),

  // Automated Application
  automation: router({
    detectATS: publicProcedure
      .input(z.object({ url: z.string() }))
      .query(async ({ input }) => {
        const { isAutomationSupported } = await import("./applicationAutomation");
        const support = isAutomationSupported(input.url);

        return support;
      }),
    applyToJob: protectedProcedure
      .input(
        z.object({
          jobId: z.number(),
          coverLetter: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { getJobById, getUserProfile, createApplication } = await import("./db");
        const { applyToJob, prepareApplicationData, validateApplicationData } = await import(
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

        // Prepare application data
        const applicationData = prepareApplicationData(ctx.user, profile, input.coverLetter);
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

        // Create application record
        await createApplication({
          userId: ctx.user.id,
          jobId: input.jobId,
          status: result.success ? "applied" : "pending",
          appliedDate: result.success ? new Date() : undefined,
          coverLetter: input.coverLetter,
          notes: result.message,
        });

        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
