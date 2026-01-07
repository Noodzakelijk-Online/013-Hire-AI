import { eq } from "drizzle-orm";
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
  type Job,
  type UserProfile,
  type Application,
  type JobMatch,
  type DecisionMaker
} from "../drizzle/schema";
import type { InferInsertModel } from "drizzle-orm";

type InsertJob = InferInsertModel<typeof jobs>;
type InsertUserProfile = InferInsertModel<typeof userProfiles>;
type InsertApplication = InferInsertModel<typeof applications>;
type InsertJobMatch = InferInsertModel<typeof jobMatches>;
type InsertDecisionMaker = InferInsertModel<typeof decisionMakers>;
import { ENV } from './_core/env';

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
      values.role = 'admin';
      updateSet.role = 'admin';
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
  const result = await db.insert(jobs).values(job);
  return result;
}

export async function getActiveJobs(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(jobs).where(eq(jobs.isActive, 1)).limit(limit).offset(offset);
}

export async function getJobById(jobId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

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
  
  let query = db.select().from(jobs).where(eq(jobs.isActive, 1));
  
  // Note: In production, you'd use proper SQL LIKE queries or full-text search
  // This is a simplified version
  
  return await query.limit(filters.limit || 50).offset(filters.offset || 0);
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
  status: "pending" | "applied" | "viewed" | "interview" | "offer" | "rejected" | "accepted" | "withdrawn"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(applications).set({ status, lastActivity: new Date() }).where(eq(applications.id, applicationId));
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
    .where(eq(jobMatches.userId, userId))
    .orderBy(jobMatches.matchScore);
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
