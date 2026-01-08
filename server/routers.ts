import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { normalizeSalary, normalizeLocation, normalizeJobType, normalizeExperienceLevel, extractSkills, extractBenefits, getDeduplicator } from "./jobNormalization";
import { getRecentJobs, searchJobs, getDiscoveryStats, getSubscriptionManager } from "./realTimeDiscovery";
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
  rescheduleInterview,
  createFollowUp,
  getFollowUps,
  markFollowUpSent,
  markFollowUpResponseReceived,
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

    // Application Notes
    addNote: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        noteType: z.enum(["general", "interview", "followup", "research", "feedback"]),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await addApplicationNote(input);
      }),

    getNotes: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ input }) => {
        return await getApplicationNotes(input.applicationId);
      }),

    updateNote: protectedProcedure
      .input(z.object({ noteId: z.number(), content: z.string() }))
      .mutation(async ({ input }) => {
        return await updateApplicationNote(input.noteId, input.content);
      }),

    deleteNote: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteApplicationNote(input.noteId);
      }),

    // Interview Scheduling
    scheduleInterview: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        interviewType: z.enum(["phone", "video", "onsite", "technical", "behavioral", "panel"]),
        scheduledAt: z.string().transform((s) => new Date(s)),
        duration: z.number().optional(),
        location: z.string().optional(),
        meetingLink: z.string().optional(),
        interviewerName: z.string().optional(),
        interviewerTitle: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await scheduleInterview(input);
      }),

    getInterviews: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ input }) => {
        return await getInterviewSchedules(input.applicationId);
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
      .mutation(async ({ input }) => {
        return await updateInterviewStatus(input.interviewId, input.status);
      }),

    rescheduleInterview: protectedProcedure
      .input(z.object({
        interviewId: z.number(),
        newDate: z.string().transform((s) => new Date(s)),
      }))
      .mutation(async ({ input }) => {
        return await rescheduleInterview(input.interviewId, input.newDate);
      }),

    // Follow-ups
    createFollowUp: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        message: z.string(),
        sendDate: z.string().transform((s) => new Date(s)).optional(),
      }))
      .mutation(async ({ input }) => {
        return await createFollowUp(input);
      }),

    getFollowUps: protectedProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ input }) => {
        return await getFollowUps(input.applicationId);
      }),

    markFollowUpSent: protectedProcedure
      .input(z.object({ followUpId: z.number() }))
      .mutation(async ({ input }) => {
        return await markFollowUpSent(input.followUpId);
      }),

    markFollowUpResponse: protectedProcedure
      .input(z.object({ followUpId: z.number() }))
      .mutation(async ({ input }) => {
        return await markFollowUpResponseReceived(input.followUpId);
      }),

    generateFollowUpEmail: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        type: z.enum(["initial", "reminder", "thank_you", "status_check"]),
      }))
      .mutation(async ({ input }) => {
        const email = await generateFollowUpEmail(input.applicationId, input.type);
        return { email };
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

    // Parse resume from file (base64 encoded PDF/DOCX)
    parseFile: protectedProcedure
      .input(z.object({
        fileData: z.string(), // Base64 encoded file data
        mimeType: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { parseResumeFromFile, uploadResumeToS3, resumeToProfileData } = await import("./resumeParser");
        const { upsertUserProfile } = await import("./db");
        
        // Decode base64 to buffer
        const buffer = Buffer.from(input.fileData, "base64");
        
        // Upload to S3
        const { url, key } = await uploadResumeToS3(
          buffer,
          input.filename,
          ctx.user.id,
          input.mimeType
        );
        
        // Parse the resume
        const parsed = await parseResumeFromFile(buffer, input.mimeType);
        
        // Convert to profile format
        const profileData = resumeToProfileData(parsed);
        
        // Update user profile with parsed data and file info
        await upsertUserProfile({
          userId: ctx.user.id,
          resumeUrl: url,
          resumeFileKey: key,
          ...profileData,
        });
        
        return {
          success: true,
          parsed,
          profileData,
          fileUrl: url,
          fileKey: key,
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
        return await uploadResume(ctx.user.id, buffer, input.fileName, input.mimeType);
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
        return { success };
      }),

    // Delete a version
    deleteVersion: protectedProcedure
      .input(z.object({ version: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const success = await deleteResumeVersion(ctx.user.id, input.version);
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
      const { getSupportedPlatforms } = await import("./scrapers/index");
      const { getScheduler } = await import("./scrapers/scheduler");
      const manager = await getScraperManager();
      const supportedPlatforms = getSupportedPlatforms();
      const scheduler = getScheduler();
      const schedulerStatus = scheduler.getStatus();

      return {
        initialized: true,
        availableScrapers: supportedPlatforms.length,
        supportedPlatforms,
        scheduler: schedulerStatus,
        message: `Scraper system ready. Supporting ${supportedPlatforms.length} platforms.`,
      };
    }),

    // Start the scheduler
    startScheduler: protectedProcedure
      .input(z.object({
        intervalMinutes: z.number().min(5).max(1440).optional(),
        maxJobsPerRun: z.number().min(10).max(1000).optional(),
      }).optional())
      .mutation(async ({ input }) => {
        const { getScheduler } = await import("./scrapers/scheduler");
        const scheduler = getScheduler(input ? {
          intervalMinutes: input.intervalMinutes || 60,
          maxJobsPerRun: input.maxJobsPerRun || 100,
        } : undefined);
        
        scheduler.start();
        return { success: true, message: "Scheduler started" };
      }),

    // Stop the scheduler
    stopScheduler: protectedProcedure.mutation(async () => {
      const { getScheduler } = await import("./scrapers/scheduler");
      const scheduler = getScheduler();
      scheduler.stop();
      return { success: true, message: "Scheduler stopped" };
    }),

    // Run scraping manually
    runNow: protectedProcedure.mutation(async () => {
      const { getScheduler } = await import("./scrapers/scheduler");
      const scheduler = getScheduler();
      await scheduler.runScraping();
      return { success: true, message: "Scraping run completed" };
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
        url: z.string(),
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
        linkedinUrl: z.string().optional(),
        githubUrl: z.string().optional(),
        portfolioUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { upsertUserProfile } = await import("./db");
        
        await upsertUserProfile({
          userId: ctx.user.id,
          linkedinUrl: input.linkedinUrl,
          githubUrl: input.githubUrl,
          portfolioUrl: input.portfolioUrl,
        });
        
        return { success: true };
      }),

    analyzeLinkedIn: protectedProcedure
      .input(z.object({ profileText: z.string() }))
      .mutation(async ({ input }) => {
        const { analyzeLinkedInProfile } = await import("./socialConnections");
        return await analyzeLinkedInProfile(input.profileText);
      }),

    analyzeGitHub: protectedProcedure
      .input(z.object({ profileText: z.string() }))
      .mutation(async ({ input }) => {
        const { analyzeGitHubProfile } = await import("./socialConnections");
        return await analyzeGitHubProfile(input.profileText);
      }),

    analyzePortfolio: protectedProcedure
      .input(z.object({ portfolioText: z.string() }))
      .mutation(async ({ input }) => {
        const { analyzePortfolio } = await import("./socialConnections");
        return await analyzePortfolio(input.portfolioText);
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

  // Job Normalization
  normalization: router({
    normalizeSalary: publicProcedure
      .input(z.object({ salary: z.string() }))
      .query(({ input }) => normalizeSalary(input.salary)),

    normalizeLocation: publicProcedure
      .input(z.object({ location: z.string() }))
      .query(({ input }) => normalizeLocation(input.location)),

    normalizeJobType: publicProcedure
      .input(z.object({ jobType: z.string() }))
      .query(({ input }) => normalizeJobType(input.jobType)),

    normalizeExperienceLevel: publicProcedure
      .input(z.object({ text: z.string() }))
      .query(({ input }) => normalizeExperienceLevel(input.text)),

    extractSkills: publicProcedure
      .input(z.object({ description: z.string() }))
      .query(({ input }) => extractSkills(input.description)),

    extractBenefits: publicProcedure
      .input(z.object({ description: z.string() }))
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
        limit: z.number().optional(),
        offset: z.number().optional(),
        keywords: z.array(z.string()).optional(),
        locations: z.array(z.string()).optional(),
        platformIds: z.array(z.number()).optional(),
        minSalary: z.number().optional(),
      }))
      .query(async ({ input }) => getRecentJobs(input)),

    searchJobs: publicProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional(),
        offset: z.number().optional(),
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
      .mutation(async ({ input }) => {
        const { alertId, ...updates } = input;
        return await updateJobAlert(alertId, updates);
      }),

    toggle: protectedProcedure
      .input(z.object({ alertId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        return await toggleJobAlert(input.alertId, input.isActive);
      }),

    delete: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteJobAlert(input.alertId);
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
});

export type AppRouter = typeof appRouter;
