import { and, desc, eq, gte, like, or, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  jobPlatforms,
  jobs,
  userProfiles,
  applications,
  jobMatches,
  decisionMakers,
  workExperiences,
  educationEntries,
  userSkills,
  userProjects,
  type Job,
  type UserProfile,
  type Application,
  type JobMatch,
  type DecisionMaker,
  type WorkExperience,
  type EducationEntry,
  type UserSkill,
  type UserProject,
} from "../drizzle/schema";
import type { InferInsertModel } from "drizzle-orm";
import { ENV } from "./_core/env";

type InsertJob = InferInsertModel<typeof jobs>;
type InsertUserProfile = InferInsertModel<typeof userProfiles>;
type InsertApplication = InferInsertModel<typeof applications>;
type InsertJobMatch = InferInsertModel<typeof jobMatches>;
type InsertDecisionMaker = InferInsertModel<typeof decisionMakers>;
type InsertWorkExperience = InferInsertModel<typeof workExperiences>;
type InsertEducationEntry = InferInsertModel<typeof educationEntries>;
type InsertUserSkill = InferInsertModel<typeof userSkills>;
type InsertUserProject = InferInsertModel<typeof userProjects>;

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Job Platforms
export async function getAllJobPlatforms() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(jobPlatforms);
}

export async function getActiveJobPlatforms() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(jobPlatforms).where(eq(jobPlatforms.isActive, 1));
}

export async function updatePlatformLastScraped(platformId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobPlatforms).set({ lastScraped: new Date() }).where(eq(jobPlatforms.id, platformId));
}

// Jobs
export async function createJob(job: InsertJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(jobs).values(job);
}

export async function getActiveJobs(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(jobs)
    .where(eq(jobs.isActive, 1))
    .limit(Math.min(Math.max(limit, 1), 100))
    .offset(Math.max(offset, 0));
}

export async function getJobById(jobId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

const searchTerm = (value: string) => `%${value.trim().replace(/[%_]/g, "\\$&")}%`;

export async function searchJobs(filters: {
  title?: string;
  company?: string;
  location?: string;
  skills?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [eq(jobs.isActive, 1)];

  if (filters.title?.trim()) {
    conditions.push(like(jobs.title, searchTerm(filters.title)));
  }
  if (filters.company?.trim()) {
    conditions.push(like(jobs.company, searchTerm(filters.company)));
  }
  if (filters.location?.trim()) {
    conditions.push(like(jobs.location, searchTerm(filters.location)));
  }
  if (filters.skills?.trim()) {
    const term = searchTerm(filters.skills);
    const skillCondition = or(
      like(jobs.skills, term),
      like(jobs.description, term),
      like(jobs.requirements, term)
    );
    if (skillCondition) conditions.push(skillCondition);
  }

  return await db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .limit(Math.min(Math.max(filters.limit || 50, 1), 100))
    .offset(Math.max(filters.offset || 0, 0));
}

// User Profiles
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserProfile(profile: InsertUserProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserProfile(profile.userId);

  if (existing) {
    await db.update(userProfiles).set(profile).where(eq(userProfiles.userId, profile.userId));
  } else {
    await db.insert(userProfiles).values(profile);
  }
}

// Applications
export async function createApplication(application: InsertApplication) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(applications).values(application);
}

export async function getUserApplications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(applications).where(eq(applications.userId, userId));
}

export async function updateApplicationStatus(
  applicationId: number,
  status: "pending" | "applied" | "viewed" | "interview" | "offer" | "rejected" | "accepted" | "withdrawn",
  userId?: number
) {
  const db = await getDb();
  if (!db) return;

  const conditions = userId === undefined
    ? eq(applications.id, applicationId)
    : and(eq(applications.id, applicationId), eq(applications.userId, userId));

  await db.update(applications).set({ status, lastActivity: new Date() }).where(conditions);
}

// Job Matches
export async function createJobMatch(match: InsertJobMatch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(jobMatches).values(match);
}

export async function getUserJobMatches(userId: number, minScore = 70) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(jobMatches)
    .where(and(eq(jobMatches.userId, userId), gte(jobMatches.matchScore, minScore)))
    .orderBy(desc(jobMatches.matchScore));
}

// Decision Makers
export async function getDecisionMakerByCompany(company: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(decisionMakers).where(eq(decisionMakers.company, company));
}

export async function createDecisionMaker(decisionMaker: InsertDecisionMaker) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(decisionMakers).values(decisionMaker);
}

// Work Experiences
export async function getWorkExperiences(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(workExperiences)
    .where(eq(workExperiences.userId, userId))
    .orderBy(desc(workExperiences.startDate));
}

export async function createWorkExperience(experience: InsertWorkExperience) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(workExperiences).values(experience);
}

export async function updateWorkExperience(id: number, userId: number, experience: Partial<InsertWorkExperience>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(workExperiences)
    .set({ ...experience, updatedAt: new Date() })
    .where(and(eq(workExperiences.id, id), eq(workExperiences.userId, userId)));
}

export async function deleteWorkExperience(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(workExperiences).where(and(eq(workExperiences.id, id), eq(workExperiences.userId, userId)));
}

// Education Entries
export async function getEducationEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(educationEntries)
    .where(eq(educationEntries.userId, userId))
    .orderBy(desc(educationEntries.endDate));
}

export async function createEducationEntry(education: InsertEducationEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(educationEntries).values(education);
}

export async function updateEducationEntry(id: number, userId: number, education: Partial<InsertEducationEntry>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(educationEntries)
    .set({ ...education, updatedAt: new Date() })
    .where(and(eq(educationEntries.id, id), eq(educationEntries.userId, userId)));
}

export async function deleteEducationEntry(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(educationEntries).where(and(eq(educationEntries.id, id), eq(educationEntries.userId, userId)));
}

// User Skills
export async function getUserSkills(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(userSkills)
    .where(eq(userSkills.userId, userId))
    .orderBy(userSkills.sortOrder);
}

export async function createUserSkill(skill: InsertUserSkill) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(userSkills).values(skill);
}

export async function updateUserSkill(id: number, userId: number, skill: Partial<InsertUserSkill>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(userSkills)
    .set(skill)
    .where(and(eq(userSkills.id, id), eq(userSkills.userId, userId)));
}

export async function deleteUserSkill(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userSkills).where(and(eq(userSkills.id, id), eq(userSkills.userId, userId)));
}

// User Projects
export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(userProjects)
    .where(eq(userProjects.userId, userId))
    .orderBy(userProjects.sortOrder);
}

export async function createUserProject(project: InsertUserProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(userProjects).values(project);
}

export async function updateUserProject(id: number, userId: number, project: Partial<InsertUserProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(userProjects)
    .set({ ...project, updatedAt: new Date() })
    .where(and(eq(userProjects.id, id), eq(userProjects.userId, userId)));
}

export async function deleteUserProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userProjects).where(and(eq(userProjects.id, id), eq(userProjects.userId, userId)));
}

export type {
  Job,
  UserProfile,
  Application,
  JobMatch,
  DecisionMaker,
  WorkExperience,
  EducationEntry,
  UserSkill,
  UserProject,
};
