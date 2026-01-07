import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Job Platforms Configuration
 * Stores information about the 50+ remote job platforms we aggregate from
 */
export const jobPlatforms = mysqlTable("job_platforms", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  tier: mysqlEnum("tier", ["tier1", "tier2", "tier3", "tier4"]).notNull(),
  category: varchar("category", { length: 100 }),
  isActive: int("is_active").default(1).notNull(),
  lastScraped: timestamp("last_scraped"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Jobs Table
 * Stores aggregated job listings from all platforms
 */
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("external_id", { length: 255 }),
  title: varchar("title", { length: 500 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  description: text("description"),
  requirements: text("requirements"),
  responsibilities: text("responsibilities"),
  benefits: text("benefits"),
  location: varchar("location", { length: 255 }),
  jobType: mysqlEnum("job_type", ["full-time", "part-time", "contract", "temporary"]),
  salaryMin: int("salary_min"),
  salaryMax: int("salary_max"),
  salaryCurrency: varchar("salary_currency", { length: 10 }),
  skills: text("skills"),
  applicationUrl: varchar("application_url", { length: 1000 }),
  applicationEmail: varchar("application_email", { length: 320 }),
  applicationProcess: varchar("application_process", { length: 100 }),
  platformId: int("platform_id").notNull(),
  sourceUrl: varchar("source_url", { length: 1000 }),
  postedDate: timestamp("posted_date"),
  expiryDate: timestamp("expiry_date"),
  isActive: int("is_active").default(1).notNull(),
  visaSponsorshipAvailable: int("visa_sponsorship_available").default(0),
  openHiringSupport: int("open_hiring_support").default(0),
  diversityFriendly: int("diversity_friendly").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Job Duplicates Tracking
 * Tracks which jobs are duplicates of each other across platforms
 */
export const jobDuplicates = mysqlTable("job_duplicates", {
  id: int("id").autoincrement().primaryKey(),
  primaryJobId: int("primary_job_id").notNull(),
  duplicateJobId: int("duplicate_job_id").notNull(),
  similarityScore: int("similarity_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * User Profiles Extended
 * Additional profile information for job matching
 */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  skills: text("skills"),
  experience: text("experience"),
  education: text("education"),
  preferences: text("preferences"),
  desiredJobTypes: text("desired_job_types"),
  desiredLocations: text("desired_locations"),
  salaryExpectationMin: int("salary_expectation_min"),
  salaryExpectationMax: int("salary_expectation_max"),
  resumeUrl: varchar("resume_url", { length: 1000 }),
  resumeFileKey: varchar("resume_file_key", { length: 500 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  githubUrl: varchar("github_url", { length: 500 }),
  portfolioUrl: varchar("portfolio_url", { length: 500 }),
  diversityGroup: varchar("diversity_group", { length: 255 }),
  needsVisaSponsorship: int("needs_visa_sponsorship").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Social Media Profiles
 * Stores connected social media accounts for job discovery
 */
export const socialMediaProfiles = mysqlTable("social_media_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  platform: mysqlEnum("platform", ["facebook", "twitter", "linkedin"]).notNull(),
  profileUrl: varchar("profile_url", { length: 500 }),
  accessToken: text("access_token"),
  isActive: int("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Applications
 * Tracks job applications submitted through the platform
 */
export const applications = mysqlTable("applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  jobId: int("job_id").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "applied",
    "viewed",
    "interview",
    "offer",
    "rejected",
    "accepted",
    "withdrawn"
  ]).default("pending").notNull(),
  appliedDate: timestamp("applied_date"),
  lastActivity: timestamp("last_activity"),
  coverLetter: text("cover_letter"),
  customResume: text("custom_resume"),
  notes: text("notes"),
  isAutoApplied: int("is_auto_applied").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Decision Makers
 * Stores information about hiring managers and decision makers
 */
export const decisionMakers = mysqlTable("decision_makers", {
  id: int("id").autoincrement().primaryKey(),
  company: varchar("company", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  title: varchar("title", { length: 255 }),
  email: varchar("email", { length: 320 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  department: varchar("department", { length: 100 }),
  verificationSource: varchar("verification_source", { length: 100 }),
  isVerified: int("is_verified").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Job Matches
 * Stores AI-powered job matching scores
 */
export const jobMatches = mysqlTable("job_matches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  jobId: int("job_id").notNull(),
  matchScore: int("match_score").notNull(),
  matchReasons: text("match_reasons"),
  skillsMatch: int("skills_match"),
  experienceMatch: int("experience_match"),
  locationMatch: int("location_match"),
  salaryMatch: int("salary_match"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Interview Preparation
 * Stores AI-generated interview questions and coaching
 */
export const interviewPreparation = mysqlTable("interview_preparation", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  jobId: int("job_id").notNull(),
  questions: text("questions"),
  coachingTips: text("coaching_tips"),
  companyInsights: text("company_insights"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Follow-ups
 * Tracks automated follow-up messages
 */
export const followUps = mysqlTable("follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("application_id").notNull(),
  message: text("message"),
  sentDate: timestamp("sent_date"),
  responseReceived: int("response_received").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type JobPlatform = typeof jobPlatforms.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobDuplicate = typeof jobDuplicates.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type SocialMediaProfile = typeof socialMediaProfiles.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type DecisionMaker = typeof decisionMakers.$inferSelect;
export type JobMatch = typeof jobMatches.$inferSelect;
export type InterviewPreparation = typeof interviewPreparation.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;