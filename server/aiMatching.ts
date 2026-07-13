import { invokeLLM } from "./_core/llm";
import type { Job, UserProfile } from "../drizzle/schema";
import { buildEvidenceBoundApplicationDraft } from "./applicationMaterialDraft";

/**
 * AI-powered job matching service
 * Uses LLM to analyze job requirements and user profiles to generate match scores
 */

export interface JobMatchResult {
  jobId: number;
  matchScore: number;
  matchReasons: string;
  skillsMatch: number;
  experienceMatch: number;
  locationMatch: number;
  salaryMatch: number;
}

/**
 * Calculate match score between a user profile and a job
 */
export async function calculateJobMatch(
  userProfile: UserProfile,
  job: Job
): Promise<JobMatchResult> {
  try {
    const prompt = `You are an expert job matching AI. Analyze the following user profile and job posting to determine how well they match.

User Profile:
- Skills: ${userProfile.skills || "Not specified"}
- Experience: ${userProfile.experience || "Not specified"}
- Education: ${userProfile.education || "Not specified"}
- Desired Job Types: ${userProfile.desiredJobTypes || "Any"}
- Desired Locations: ${userProfile.desiredLocations || "Any"}
- Salary Expectation: $${userProfile.salaryExpectationMin || 0} - $${userProfile.salaryExpectationMax || 0}
- Needs Visa Sponsorship: ${userProfile.needsVisaSponsorship ? "Yes" : "No"}
- Diversity Group: ${userProfile.diversityGroup || "Not specified"}

Job Posting:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Remote"}
- Job Type: ${job.jobType || "Not specified"}
- Skills Required: ${job.skills || "Not specified"}
- Requirements: ${job.requirements || "Not specified"}
- Salary Range: $${job.salaryMin || 0} - $${job.salaryMax || 0} ${job.salaryCurrency || "USD"}
- Visa Sponsorship: ${job.visaSponsorshipAvailable ? "Available" : "Not available"}
- Diversity Friendly: ${job.diversityFriendly ? "Yes" : "No"}

Provide a detailed match analysis with:
1. Overall match score (0-100)
2. Skills match score (0-100)
3. Experience match score (0-100)
4. Location match score (0-100)
5. Salary match score (0-100)
6. Detailed reasons for the match score

Return the analysis in JSON format.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert job matching AI that analyzes job postings and candidate profiles to determine compatibility.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "job_match_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              matchScore: {
                type: "integer",
                description: "Overall match score from 0-100",
              },
              skillsMatch: {
                type: "integer",
                description: "Skills compatibility score from 0-100",
              },
              experienceMatch: {
                type: "integer",
                description: "Experience level match score from 0-100",
              },
              locationMatch: {
                type: "integer",
                description: "Location preference match score from 0-100",
              },
              salaryMatch: {
                type: "integer",
                description: "Salary expectation match score from 0-100",
              },
              matchReasons: {
                type: "string",
                description: "Detailed explanation of why this is a good or poor match",
              },
            },
            required: [
              "matchScore",
              "skillsMatch",
              "experienceMatch",
              "locationMatch",
              "salaryMatch",
              "matchReasons",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    const analysis = JSON.parse(content);

    return {
      jobId: job.id,
      matchScore: analysis.matchScore,
      matchReasons: analysis.matchReasons,
      skillsMatch: analysis.skillsMatch,
      experienceMatch: analysis.experienceMatch,
      locationMatch: analysis.locationMatch,
      salaryMatch: analysis.salaryMatch,
    };
  } catch (error) {
    console.error("Error calculating job match:", error);
    // Return a default low score if AI matching fails
    return {
      jobId: job.id,
      matchScore: 0,
      matchReasons: "Unable to calculate match score",
      skillsMatch: 0,
      experienceMatch: 0,
      locationMatch: 0,
      salaryMatch: 0,
    };
  }
}

/**
 * Generate a personalized cover letter for a job application
 */
export async function generateCoverLetter(
  userProfile: UserProfile,
  job: Job
): Promise<string> {
  return buildEvidenceBoundApplicationDraft(userProfile, job).coverLetter;
}

/**
 * Identify decision makers for a company
 */
export async function identifyDecisionMakers(
  company: string,
  jobTitle: string
): Promise<{
  suggestions: Array<{
    title: string;
    department: string;
    reasoning: string;
  }>;
}> {
  try {
    const prompt = `For a ${jobTitle} position at ${company}, identify the most likely decision makers who would be involved in the hiring process.

Consider:
1. The typical hiring hierarchy for this role
2. Common job titles of hiring managers
3. Relevant departments

Provide 3-5 potential decision maker roles with their likely titles and departments.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert in corporate hiring structures and know how to identify key decision makers in the hiring process.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "decision_makers",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Job title of the decision maker",
                    },
                    department: {
                      type: "string",
                      description: "Department they work in",
                    },
                    reasoning: {
                      type: "string",
                      description: "Why this person would be involved in hiring",
                    },
                  },
                  required: ["title", "department", "reasoning"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Error identifying decision makers:", error);
    return {
      suggestions: [],
    };
  }
}

/**
 * Generate interview preparation questions and tips
 */
export async function generateInterviewPreparation(
  job: Job
): Promise<{
  questions: string[];
  tips: string[];
  companyInsights: string;
}> {
  try {
    const prompt = `Generate interview preparation materials for a ${job.title} position at ${job.company}.

Job Description:
${job.description || "Not provided"}

Requirements:
${job.requirements || "Not provided"}

Provide:
1. 10 likely interview questions (mix of technical and behavioral)
2. 5 key preparation tips
3. Insights about the company and role`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert interview coach who helps candidates prepare for job interviews.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interview_prep",
          strict: true,
          schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: { type: "string" },
                description: "List of likely interview questions",
              },
              tips: {
                type: "array",
                items: { type: "string" },
                description: "Key preparation tips",
              },
              companyInsights: {
                type: "string",
                description: "Insights about the company and role",
              },
            },
            required: ["questions", "tips", "companyInsights"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Error generating interview preparation:", error);
    return {
      questions: [],
      tips: [],
      companyInsights: "Unable to generate insights at this time.",
    };
  }
}
