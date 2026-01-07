/**
 * Application Features Service
 * Handles saved jobs, application notes, interview scheduling, and follow-up emails
 */

import { eq, and, desc, asc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { savedJobs, applicationNotes, interviewSchedules, followUps, applications, jobs, jobAlerts } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

// ==================== SAVED JOBS ====================

export interface SaveJobInput {
  userId: number;
  jobId: number;
  notes?: string;
  tags?: string;
  priority?: "low" | "medium" | "high";
}

export async function saveJob(input: SaveJobInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already saved
  const existing = await db
    .select()
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, input.userId), eq(savedJobs.jobId, input.jobId)))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(savedJobs)
      .set({
        notes: input.notes,
        tags: input.tags,
        priority: input.priority,
      })
      .where(eq(savedJobs.id, existing[0].id));
    return { id: existing[0].id, updated: true };
  }

  // Insert new
  const result = await db.insert(savedJobs).values({
    userId: input.userId,
    jobId: input.jobId,
    notes: input.notes || null,
    tags: input.tags || null,
    priority: input.priority || "medium",
  });

  return { id: Number(result[0].insertId), updated: false };
}

export async function unsaveJob(userId: number, jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)));

  return { success: true };
}

export async function getSavedJobs(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: savedJobs.id,
      jobId: savedJobs.jobId,
      notes: savedJobs.notes,
      tags: savedJobs.tags,
      priority: savedJobs.priority,
      createdAt: savedJobs.createdAt,
      job: {
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        salaryMin: jobs.salaryMin,
        salaryMax: jobs.salaryMax,
        jobType: jobs.jobType,
        applicationUrl: jobs.applicationUrl,
      },
    })
    .from(savedJobs)
    .leftJoin(jobs, eq(savedJobs.jobId, jobs.id))
    .where(eq(savedJobs.userId, userId))
    .orderBy(desc(savedJobs.createdAt));

  return result;
}

export async function updateSavedJobNotes(
  userId: number,
  jobId: number,
  notes: string,
  tags?: string,
  priority?: "low" | "medium" | "high"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, unknown> = { notes };
  if (tags !== undefined) updateData.tags = tags;
  if (priority !== undefined) updateData.priority = priority;

  await db
    .update(savedJobs)
    .set(updateData)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)));

  return { success: true };
}

// ==================== APPLICATION NOTES ====================

export interface AddNoteInput {
  applicationId: number;
  noteType: "general" | "interview" | "followup" | "research" | "feedback";
  content: string;
}

export async function addApplicationNote(input: AddNoteInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(applicationNotes).values({
    applicationId: input.applicationId,
    noteType: input.noteType,
    content: input.content,
  });

  return { id: Number(result[0].insertId) };
}

export async function getApplicationNotes(applicationId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(applicationNotes)
    .where(eq(applicationNotes.applicationId, applicationId))
    .orderBy(desc(applicationNotes.createdAt));
}

export async function updateApplicationNote(noteId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(applicationNotes)
    .set({ content })
    .where(eq(applicationNotes.id, noteId));

  return { success: true };
}

export async function deleteApplicationNote(noteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(applicationNotes).where(eq(applicationNotes.id, noteId));
  return { success: true };
}

// ==================== INTERVIEW SCHEDULING ====================

export interface ScheduleInterviewInput {
  applicationId: number;
  interviewType: "phone" | "video" | "onsite" | "technical" | "behavioral" | "panel";
  scheduledAt: Date;
  duration?: number;
  location?: string;
  meetingLink?: string;
  interviewerName?: string;
  interviewerTitle?: string;
  notes?: string;
}

export async function scheduleInterview(input: ScheduleInterviewInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(interviewSchedules).values({
    applicationId: input.applicationId,
    interviewType: input.interviewType,
    scheduledAt: input.scheduledAt,
    duration: input.duration || 60,
    location: input.location || null,
    meetingLink: input.meetingLink || null,
    interviewerName: input.interviewerName || null,
    interviewerTitle: input.interviewerTitle || null,
    notes: input.notes || null,
    status: "scheduled",
  });

  // Update application status
  await db
    .update(applications)
    .set({ status: "interview" })
    .where(eq(applications.id, input.applicationId));

  return { id: Number(result[0].insertId) };
}

export async function getInterviewSchedules(applicationId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(interviewSchedules)
    .where(eq(interviewSchedules.applicationId, applicationId))
    .orderBy(asc(interviewSchedules.scheduledAt));
}

export async function getUpcomingInterviews(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  
  const result = await db
    .select({
      interview: interviewSchedules,
      application: {
        id: applications.id,
        jobId: applications.jobId,
      },
      job: {
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
      },
    })
    .from(interviewSchedules)
    .innerJoin(applications, eq(interviewSchedules.applicationId, applications.id))
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(
      and(
        eq(applications.userId, userId),
        eq(interviewSchedules.status, "scheduled"),
        sql`${interviewSchedules.scheduledAt} >= ${now}`
      )
    )
    .orderBy(asc(interviewSchedules.scheduledAt))
    .limit(10);

  return result;
}

export async function updateInterviewStatus(
  interviewId: number,
  status: "scheduled" | "completed" | "cancelled" | "rescheduled"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(interviewSchedules)
    .set({ status })
    .where(eq(interviewSchedules.id, interviewId));

  return { success: true };
}

export async function rescheduleInterview(interviewId: number, newDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(interviewSchedules)
    .set({
      scheduledAt: newDate,
      status: "rescheduled",
    })
    .where(eq(interviewSchedules.id, interviewId));

  return { success: true };
}

// ==================== FOLLOW-UP EMAILS ====================

export interface FollowUpInput {
  applicationId: number;
  message: string;
  sendDate?: Date;
}

export async function createFollowUp(input: FollowUpInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(followUps).values({
    applicationId: input.applicationId,
    message: input.message,
    sentDate: input.sendDate || null,
    responseReceived: 0,
  });

  return { id: Number(result[0].insertId) };
}

export async function getFollowUps(applicationId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(followUps)
    .where(eq(followUps.applicationId, applicationId))
    .orderBy(desc(followUps.createdAt));
}

export async function markFollowUpSent(followUpId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(followUps)
    .set({ sentDate: new Date() })
    .where(eq(followUps.id, followUpId));

  return { success: true };
}

export async function markFollowUpResponseReceived(followUpId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(followUps)
    .set({ responseReceived: 1 })
    .where(eq(followUps.id, followUpId));

  return { success: true };
}

// AI-Generated Follow-Up Email
export async function generateFollowUpEmail(
  applicationId: number,
  followUpType: "initial" | "reminder" | "thank_you" | "status_check"
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get application and job details
  const appResult = await db
    .select({
      application: applications,
      job: jobs,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.id, applicationId))
    .limit(1);

  if (appResult.length === 0) {
    throw new Error("Application not found");
  }

  const { application, job } = appResult[0];

  const prompts: Record<string, string> = {
    initial: `Write a professional follow-up email for a job application. The candidate applied for ${job.title} at ${job.company}. This is the initial follow-up after submitting the application. Keep it brief, professional, and express continued interest.`,
    reminder: `Write a polite reminder email for a job application. The candidate applied for ${job.title} at ${job.company} and hasn't heard back. Keep it professional and not pushy.`,
    thank_you: `Write a thank you email after an interview for the ${job.title} position at ${job.company}. Express gratitude, reiterate interest, and mention something specific about the conversation.`,
    status_check: `Write a professional email to check on the status of a job application for ${job.title} at ${job.company}. Be polite and express continued interest.`,
  };

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a professional career coach helping job seekers write effective follow-up emails. Write concise, professional emails that are personalized and impactful.",
      },
      {
        role: "user",
        content: prompts[followUpType] || prompts.initial,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return typeof content === "string" ? content : "Unable to generate email";
}

// ==================== JOB ALERTS ====================

export interface CreateAlertInput {
  userId: number;
  name: string;
  keywords?: string;
  locations?: string;
  platforms?: string;
  minSalary?: number;
  jobTypes?: string;
  frequency: "instant" | "daily" | "weekly";
}

export async function createJobAlert(input: CreateAlertInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(jobAlerts).values({
    userId: input.userId,
    name: input.name,
    keywords: input.keywords || null,
    locations: input.locations || null,
    platforms: input.platforms || null,
    minSalary: input.minSalary || null,
    jobTypes: input.jobTypes || null,
    frequency: input.frequency,
    isActive: 1,
  });

  return { id: Number(result[0].insertId) };
}

export async function getJobAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(jobAlerts)
    .where(eq(jobAlerts.userId, userId))
    .orderBy(desc(jobAlerts.createdAt));
}

export async function updateJobAlert(
  alertId: number,
  updates: Partial<Omit<CreateAlertInput, "userId">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(jobAlerts)
    .set(updates)
    .where(eq(jobAlerts.id, alertId));

  return { success: true };
}

export async function toggleJobAlert(alertId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(jobAlerts)
    .set({ isActive: isActive ? 1 : 0 })
    .where(eq(jobAlerts.id, alertId));

  return { success: true };
}

export async function deleteJobAlert(alertId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(jobAlerts).where(eq(jobAlerts.id, alertId));
  return { success: true };
}

// Process job alerts and send notifications
export async function processJobAlerts() {
  const db = await getDb();
  if (!db) return { processed: 0 };

  // Get all active alerts
  const alerts = await db
    .select()
    .from(jobAlerts)
    .where(eq(jobAlerts.isActive, 1));

  let processed = 0;

  for (const alert of alerts) {
    // Check if it's time to process this alert
    const lastTriggered = alert.lastTriggered ? new Date(alert.lastTriggered) : null;
    const now = new Date();

    let shouldProcess = false;
    if (!lastTriggered) {
      shouldProcess = true;
    } else {
      const hoursSince = (now.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60);
      switch (alert.frequency) {
        case "instant":
          shouldProcess = hoursSince >= 1;
          break;
        case "daily":
          shouldProcess = hoursSince >= 24;
          break;
        case "weekly":
          shouldProcess = hoursSince >= 168;
          break;
      }
    }

    if (shouldProcess) {
      // Find matching jobs
      let query = db.select().from(jobs).where(eq(jobs.isActive, 1));

      // This is a simplified matching - in production, you'd want more sophisticated filtering
      const matchingJobs = await query.limit(10);

      if (matchingJobs.length > 0) {
        // Send notification (using owner notification for now)
        await notifyOwner({
          title: `Job Alert: ${alert.name}`,
          content: `Found ${matchingJobs.length} new jobs matching your alert "${alert.name}"`,
        });

        // Update last triggered
        await db
          .update(jobAlerts)
          .set({ lastTriggered: now })
          .where(eq(jobAlerts.id, alert.id));

        processed++;
      }
    }
  }

  return { processed };
}

// ==================== INTERVIEW PREPARATION ====================

export async function generateInterviewQuestions(jobId: number): Promise<{
  behavioral: string[];
  technical: string[];
  situational: string[];
  questions_to_ask: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const jobResult = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (jobResult.length === 0) {
    throw new Error("Job not found");
  }

  const job = jobResult[0];

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert interview coach. Generate comprehensive interview preparation questions.",
      },
      {
        role: "user",
        content: `Generate interview questions for a ${job.title} position at ${job.company}. 
        
Job Description: ${job.description || "Not available"}
Required Skills: ${job.skills || "Not specified"}

Provide questions in these categories:
1. Behavioral questions (5)
2. Technical questions (5)
3. Situational questions (3)
4. Questions the candidate should ask (3)

Format as JSON with keys: behavioral, technical, situational, questions_to_ask (each an array of strings)`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "interview_questions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            behavioral: {
              type: "array",
              items: { type: "string" },
            },
            technical: {
              type: "array",
              items: { type: "string" },
            },
            situational: {
              type: "array",
              items: { type: "string" },
            },
            questions_to_ask: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["behavioral", "technical", "situational", "questions_to_ask"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content === "string") {
    return JSON.parse(content);
  }

  return {
    behavioral: [],
    technical: [],
    situational: [],
    questions_to_ask: [],
  };
}

// Mock interview simulation
export async function conductMockInterview(
  jobId: number,
  userResponse: string,
  questionIndex: number
): Promise<{
  feedback: string;
  score: number;
  suggestions: string[];
  nextQuestion?: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const jobResult = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (jobResult.length === 0) {
    throw new Error("Job not found");
  }

  const job = jobResult[0];

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert interviewer conducting a mock interview for a ${job.title} position. Evaluate the candidate's response and provide constructive feedback.`,
      },
      {
        role: "user",
        content: `The candidate's response to interview question ${questionIndex + 1}:

"${userResponse}"

Evaluate this response and provide:
1. Detailed feedback on the response
2. A score from 1-10
3. 2-3 specific suggestions for improvement
4. A follow-up question if appropriate

Format as JSON with keys: feedback, score, suggestions (array), nextQuestion (optional string)`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "interview_feedback",
        strict: true,
        schema: {
          type: "object",
          properties: {
            feedback: { type: "string" },
            score: { type: "number" },
            suggestions: {
              type: "array",
              items: { type: "string" },
            },
            nextQuestion: { type: "string" },
          },
          required: ["feedback", "score", "suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content === "string") {
    return JSON.parse(content);
  }

  return {
    feedback: "Unable to evaluate response",
    score: 5,
    suggestions: ["Try to be more specific", "Use the STAR method"],
  };
}

// Video interview tips
export async function getVideoInterviewTips(jobTitle: string): Promise<{
  technical_setup: string[];
  presentation: string[];
  common_mistakes: string[];
  platform_specific: Record<string, string[]>;
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert career coach specializing in video interviews.",
      },
      {
        role: "user",
        content: `Provide comprehensive video interview tips for a ${jobTitle} position.

Include:
1. Technical setup tips (5)
2. Presentation/appearance tips (5)
3. Common mistakes to avoid (5)
4. Platform-specific tips for Zoom, Teams, and Google Meet (3 each)

Format as JSON with keys: technical_setup, presentation, common_mistakes, platform_specific (object with zoom, teams, google_meet arrays)`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "video_interview_tips",
        strict: true,
        schema: {
          type: "object",
          properties: {
            technical_setup: {
              type: "array",
              items: { type: "string" },
            },
            presentation: {
              type: "array",
              items: { type: "string" },
            },
            common_mistakes: {
              type: "array",
              items: { type: "string" },
            },
            platform_specific: {
              type: "object",
              properties: {
                zoom: { type: "array", items: { type: "string" } },
                teams: { type: "array", items: { type: "string" } },
                google_meet: { type: "array", items: { type: "string" } },
              },
              required: ["zoom", "teams", "google_meet"],
              additionalProperties: false,
            },
          },
          required: ["technical_setup", "presentation", "common_mistakes", "platform_specific"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content === "string") {
    return JSON.parse(content);
  }

  return {
    technical_setup: [],
    presentation: [],
    common_mistakes: [],
    platform_specific: { zoom: [], teams: [], google_meet: [] },
  };
}
