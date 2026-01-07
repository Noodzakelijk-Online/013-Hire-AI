import { invokeLLM } from "./_core/llm";

/**
 * Career Intelligence Service
 * AI-powered features for salary negotiation, company culture analysis,
 * networking intelligence, and career progression planning
 */

// ============================================================================
// SALARY NEGOTIATION
// ============================================================================

export interface SalaryAnalysis {
  marketRate: {
    low: number;
    median: number;
    high: number;
    currency: string;
  };
  factors: Array<{
    factor: string;
    impact: "positive" | "negative" | "neutral";
    adjustment: number;
    explanation: string;
  }>;
  recommendedRange: {
    minimum: number;
    target: number;
    stretch: number;
  };
  negotiationTips: string[];
  counterOfferStrategy: string;
  redFlags: string[];
  benefits: {
    typical: string[];
    negotiable: string[];
    highValue: string[];
  };
}

export async function analyzeSalary(
  jobTitle: string,
  company: string,
  location: string,
  yearsExperience: number,
  skills: string[],
  currentSalary?: number,
  offeredSalary?: number
): Promise<SalaryAnalysis> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert salary negotiation consultant with deep knowledge of tech industry compensation. 
Provide detailed, actionable salary analysis and negotiation strategies.
Base your analysis on current market data and industry standards.
All salary figures should be in USD annual unless specified otherwise.`,
        },
        {
          role: "user",
          content: `Analyze salary and provide negotiation strategy for:
Job Title: ${jobTitle}
Company: ${company}
Location: ${location}
Years of Experience: ${yearsExperience}
Key Skills: ${skills.join(", ")}
${currentSalary ? `Current Salary: $${currentSalary}` : ""}
${offeredSalary ? `Offered Salary: $${offeredSalary}` : ""}

Provide comprehensive salary analysis including market rates, adjustment factors, recommended negotiation range, and specific tips.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "salary_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              marketRate: {
                type: "object",
                properties: {
                  low: { type: "number" },
                  median: { type: "number" },
                  high: { type: "number" },
                  currency: { type: "string" },
                },
                required: ["low", "median", "high", "currency"],
                additionalProperties: false,
              },
              factors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    factor: { type: "string" },
                    impact: { type: "string", enum: ["positive", "negative", "neutral"] },
                    adjustment: { type: "number" },
                    explanation: { type: "string" },
                  },
                  required: ["factor", "impact", "adjustment", "explanation"],
                  additionalProperties: false,
                },
              },
              recommendedRange: {
                type: "object",
                properties: {
                  minimum: { type: "number" },
                  target: { type: "number" },
                  stretch: { type: "number" },
                },
                required: ["minimum", "target", "stretch"],
                additionalProperties: false,
              },
              negotiationTips: { type: "array", items: { type: "string" } },
              counterOfferStrategy: { type: "string" },
              redFlags: { type: "array", items: { type: "string" } },
              benefits: {
                type: "object",
                properties: {
                  typical: { type: "array", items: { type: "string" } },
                  negotiable: { type: "array", items: { type: "string" } },
                  highValue: { type: "array", items: { type: "string" } },
                },
                required: ["typical", "negotiable", "highValue"],
                additionalProperties: false,
              },
            },
            required: ["marketRate", "factors", "recommendedRange", "negotiationTips", "counterOfferStrategy", "redFlags", "benefits"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as SalaryAnalysis;
  } catch (error) {
    console.error("[CareerIntelligence] Salary analysis failed:", error);
    throw new Error("Failed to analyze salary");
  }
}

// ============================================================================
// COMPANY CULTURE ANALYSIS
// ============================================================================

export interface CultureAnalysis {
  overallScore: number;
  dimensions: Array<{
    name: string;
    score: number;
    description: string;
    evidence: string[];
  }>;
  workLifeBalance: {
    score: number;
    indicators: string[];
    concerns: string[];
  };
  growthOpportunities: {
    score: number;
    paths: string[];
    limitations: string[];
  };
  diversity: {
    score: number;
    initiatives: string[];
    gaps: string[];
  };
  management: {
    style: string;
    strengths: string[];
    weaknesses: string[];
  };
  redFlags: string[];
  greenFlags: string[];
  fitAssessment: string;
  interviewQuestions: string[];
}

export async function analyzeCompanyCulture(
  company: string,
  jobTitle: string,
  jobDescription: string,
  userPreferences?: {
    workStyle?: string;
    values?: string[];
    priorities?: string[];
  }
): Promise<CultureAnalysis> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert in organizational psychology and company culture analysis.
Analyze companies based on available information and provide insights about their culture, work environment, and potential fit.
Be balanced and objective in your assessment.`,
        },
        {
          role: "user",
          content: `Analyze the company culture for:
Company: ${company}
Position: ${jobTitle}
Job Description: ${jobDescription}
${userPreferences ? `
User Preferences:
- Work Style: ${userPreferences.workStyle || "Not specified"}
- Values: ${userPreferences.values?.join(", ") || "Not specified"}
- Priorities: ${userPreferences.priorities?.join(", ") || "Not specified"}
` : ""}

Provide comprehensive culture analysis including scores, dimensions, and fit assessment.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "culture_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallScore: { type: "number" },
              dimensions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    score: { type: "number" },
                    description: { type: "string" },
                    evidence: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "score", "description", "evidence"],
                  additionalProperties: false,
                },
              },
              workLifeBalance: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  indicators: { type: "array", items: { type: "string" } },
                  concerns: { type: "array", items: { type: "string" } },
                },
                required: ["score", "indicators", "concerns"],
                additionalProperties: false,
              },
              growthOpportunities: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  paths: { type: "array", items: { type: "string" } },
                  limitations: { type: "array", items: { type: "string" } },
                },
                required: ["score", "paths", "limitations"],
                additionalProperties: false,
              },
              diversity: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  initiatives: { type: "array", items: { type: "string" } },
                  gaps: { type: "array", items: { type: "string" } },
                },
                required: ["score", "initiatives", "gaps"],
                additionalProperties: false,
              },
              management: {
                type: "object",
                properties: {
                  style: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  weaknesses: { type: "array", items: { type: "string" } },
                },
                required: ["style", "strengths", "weaknesses"],
                additionalProperties: false,
              },
              redFlags: { type: "array", items: { type: "string" } },
              greenFlags: { type: "array", items: { type: "string" } },
              fitAssessment: { type: "string" },
              interviewQuestions: { type: "array", items: { type: "string" } },
            },
            required: ["overallScore", "dimensions", "workLifeBalance", "growthOpportunities", "diversity", "management", "redFlags", "greenFlags", "fitAssessment", "interviewQuestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as CultureAnalysis;
  } catch (error) {
    console.error("[CareerIntelligence] Culture analysis failed:", error);
    throw new Error("Failed to analyze company culture");
  }
}

// ============================================================================
// NETWORKING INTELLIGENCE
// ============================================================================

export interface NetworkingStrategy {
  targetContacts: Array<{
    role: string;
    department: string;
    priority: "high" | "medium" | "low";
    reason: string;
    approachStrategy: string;
  }>;
  outreachTemplates: Array<{
    type: string;
    subject: string;
    body: string;
    followUpTiming: string;
  }>;
  conversationStarters: string[];
  informationalInterviewQuestions: string[];
  linkedInStrategy: {
    profileOptimizations: string[];
    connectionMessage: string;
    contentIdeas: string[];
  };
  referralStrategy: string;
  timingRecommendations: string[];
}

export async function generateNetworkingStrategy(
  targetCompany: string,
  targetRole: string,
  userBackground: string,
  existingConnections?: string[]
): Promise<NetworkingStrategy> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert career coach specializing in professional networking and job search strategies.
Provide actionable, personalized networking strategies that are professional and effective.`,
        },
        {
          role: "user",
          content: `Create a networking strategy for:
Target Company: ${targetCompany}
Target Role: ${targetRole}
User Background: ${userBackground}
${existingConnections?.length ? `Existing Connections: ${existingConnections.join(", ")}` : ""}

Provide comprehensive networking strategy with specific contacts to target, outreach templates, and LinkedIn optimization.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "networking_strategy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              targetContacts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    role: { type: "string" },
                    department: { type: "string" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    reason: { type: "string" },
                    approachStrategy: { type: "string" },
                  },
                  required: ["role", "department", "priority", "reason", "approachStrategy"],
                  additionalProperties: false,
                },
              },
              outreachTemplates: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    subject: { type: "string" },
                    body: { type: "string" },
                    followUpTiming: { type: "string" },
                  },
                  required: ["type", "subject", "body", "followUpTiming"],
                  additionalProperties: false,
                },
              },
              conversationStarters: { type: "array", items: { type: "string" } },
              informationalInterviewQuestions: { type: "array", items: { type: "string" } },
              linkedInStrategy: {
                type: "object",
                properties: {
                  profileOptimizations: { type: "array", items: { type: "string" } },
                  connectionMessage: { type: "string" },
                  contentIdeas: { type: "array", items: { type: "string" } },
                },
                required: ["profileOptimizations", "connectionMessage", "contentIdeas"],
                additionalProperties: false,
              },
              referralStrategy: { type: "string" },
              timingRecommendations: { type: "array", items: { type: "string" } },
            },
            required: ["targetContacts", "outreachTemplates", "conversationStarters", "informationalInterviewQuestions", "linkedInStrategy", "referralStrategy", "timingRecommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as NetworkingStrategy;
  } catch (error) {
    console.error("[CareerIntelligence] Networking strategy failed:", error);
    throw new Error("Failed to generate networking strategy");
  }
}

// ============================================================================
// CAREER PROGRESSION PLANNING
// ============================================================================

export interface CareerPlan {
  currentAssessment: {
    strengths: string[];
    gaps: string[];
    marketPosition: string;
  };
  shortTermGoals: Array<{
    goal: string;
    timeline: string;
    actions: string[];
    metrics: string[];
  }>;
  longTermGoals: Array<{
    goal: string;
    timeline: string;
    milestones: string[];
    requirements: string[];
  }>;
  skillDevelopment: Array<{
    skill: string;
    currentLevel: string;
    targetLevel: string;
    resources: string[];
    timeline: string;
  }>;
  certifications: Array<{
    name: string;
    provider: string;
    relevance: string;
    timeToComplete: string;
    cost: string;
  }>;
  careerPaths: Array<{
    path: string;
    roles: string[];
    timeline: string;
    probability: string;
    requirements: string[];
  }>;
  industryTrends: string[];
  recommendations: string[];
}

export async function generateCareerPlan(
  currentRole: string,
  targetRole: string,
  yearsExperience: number,
  skills: string[],
  interests: string[],
  constraints?: string[]
): Promise<CareerPlan> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert career counselor with deep knowledge of tech industry career paths, skill requirements, and market trends.
Provide detailed, actionable career plans that are realistic and achievable.`,
        },
        {
          role: "user",
          content: `Create a career progression plan for:
Current Role: ${currentRole}
Target Role: ${targetRole}
Years of Experience: ${yearsExperience}
Current Skills: ${skills.join(", ")}
Interests: ${interests.join(", ")}
${constraints?.length ? `Constraints: ${constraints.join(", ")}` : ""}

Provide comprehensive career plan with short-term and long-term goals, skill development roadmap, and multiple career paths.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "career_plan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              currentAssessment: {
                type: "object",
                properties: {
                  strengths: { type: "array", items: { type: "string" } },
                  gaps: { type: "array", items: { type: "string" } },
                  marketPosition: { type: "string" },
                },
                required: ["strengths", "gaps", "marketPosition"],
                additionalProperties: false,
              },
              shortTermGoals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    goal: { type: "string" },
                    timeline: { type: "string" },
                    actions: { type: "array", items: { type: "string" } },
                    metrics: { type: "array", items: { type: "string" } },
                  },
                  required: ["goal", "timeline", "actions", "metrics"],
                  additionalProperties: false,
                },
              },
              longTermGoals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    goal: { type: "string" },
                    timeline: { type: "string" },
                    milestones: { type: "array", items: { type: "string" } },
                    requirements: { type: "array", items: { type: "string" } },
                  },
                  required: ["goal", "timeline", "milestones", "requirements"],
                  additionalProperties: false,
                },
              },
              skillDevelopment: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    skill: { type: "string" },
                    currentLevel: { type: "string" },
                    targetLevel: { type: "string" },
                    resources: { type: "array", items: { type: "string" } },
                    timeline: { type: "string" },
                  },
                  required: ["skill", "currentLevel", "targetLevel", "resources", "timeline"],
                  additionalProperties: false,
                },
              },
              certifications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    provider: { type: "string" },
                    relevance: { type: "string" },
                    timeToComplete: { type: "string" },
                    cost: { type: "string" },
                  },
                  required: ["name", "provider", "relevance", "timeToComplete", "cost"],
                  additionalProperties: false,
                },
              },
              careerPaths: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    roles: { type: "array", items: { type: "string" } },
                    timeline: { type: "string" },
                    probability: { type: "string" },
                    requirements: { type: "array", items: { type: "string" } },
                  },
                  required: ["path", "roles", "timeline", "probability", "requirements"],
                  additionalProperties: false,
                },
              },
              industryTrends: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
            },
            required: ["currentAssessment", "shortTermGoals", "longTermGoals", "skillDevelopment", "certifications", "careerPaths", "industryTrends", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as CareerPlan;
  } catch (error) {
    console.error("[CareerIntelligence] Career plan failed:", error);
    throw new Error("Failed to generate career plan");
  }
}

// ============================================================================
// SKILL GAP ANALYSIS
// ============================================================================

export interface SkillGapAnalysis {
  matchPercentage: number;
  matchedSkills: Array<{
    skill: string;
    proficiencyRequired: string;
    yourLevel: string;
    status: "exceeds" | "meets" | "partial" | "missing";
  }>;
  missingSkills: Array<{
    skill: string;
    importance: "critical" | "important" | "nice-to-have";
    learningPath: string;
    timeToAcquire: string;
    resources: string[];
  }>;
  transferableSkills: Array<{
    skill: string;
    relevance: string;
    howToLeverage: string;
  }>;
  recommendations: string[];
  prioritizedActions: string[];
}

export async function analyzeSkillGap(
  jobRequirements: string,
  userSkills: string[],
  userExperience: string
): Promise<SkillGapAnalysis> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert at analyzing job requirements and candidate skills to identify gaps and provide actionable recommendations.
Be thorough but realistic in your assessment.`,
        },
        {
          role: "user",
          content: `Analyze skill gap between job requirements and candidate profile:

Job Requirements:
${jobRequirements}

Candidate Skills: ${userSkills.join(", ")}

Candidate Experience:
${userExperience}

Provide detailed skill gap analysis with matched skills, missing skills, transferable skills, and prioritized recommendations.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "skill_gap_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              matchPercentage: { type: "number" },
              matchedSkills: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    skill: { type: "string" },
                    proficiencyRequired: { type: "string" },
                    yourLevel: { type: "string" },
                    status: { type: "string", enum: ["exceeds", "meets", "partial", "missing"] },
                  },
                  required: ["skill", "proficiencyRequired", "yourLevel", "status"],
                  additionalProperties: false,
                },
              },
              missingSkills: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    skill: { type: "string" },
                    importance: { type: "string", enum: ["critical", "important", "nice-to-have"] },
                    learningPath: { type: "string" },
                    timeToAcquire: { type: "string" },
                    resources: { type: "array", items: { type: "string" } },
                  },
                  required: ["skill", "importance", "learningPath", "timeToAcquire", "resources"],
                  additionalProperties: false,
                },
              },
              transferableSkills: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    skill: { type: "string" },
                    relevance: { type: "string" },
                    howToLeverage: { type: "string" },
                  },
                  required: ["skill", "relevance", "howToLeverage"],
                  additionalProperties: false,
                },
              },
              recommendations: { type: "array", items: { type: "string" } },
              prioritizedActions: { type: "array", items: { type: "string" } },
            },
            required: ["matchPercentage", "matchedSkills", "missingSkills", "transferableSkills", "recommendations", "prioritizedActions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as SkillGapAnalysis;
  } catch (error) {
    console.error("[CareerIntelligence] Skill gap analysis failed:", error);
    throw new Error("Failed to analyze skill gap");
  }
}
