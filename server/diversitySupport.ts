import { invokeLLM } from "./_core/llm";

/**
 * Diversity & Inclusion Support Service
 * Handles visa sponsorship, D&I job matching, and inclusive hiring support
 */

// ============================================================================
// D&I CATEGORIES
// ============================================================================

export type DICategory =
  | "disabilities"
  | "veterans"
  | "refugees"
  | "lgbtq"
  | "women_in_tech"
  | "age_diversity"
  | "racial_ethnic"
  | "neurodivergent"
  | "caregivers"
  | "first_generation"
  | "formerly_incarcerated"
  | "immigrants"
  | "religious_accommodations"
  | "socioeconomic"
  | "remote_accessibility";

export interface DIProfile {
  categories: DICategory[];
  accommodationsNeeded: string[];
  preferredWorkStyle: "remote" | "hybrid" | "onsite" | "flexible";
  accessibilityRequirements: string[];
  disclosurePreference: "always" | "when_relevant" | "never";
}

export interface DIJobMatch {
  jobId: number;
  company: string;
  diScore: number;
  matchedCategories: DICategory[];
  companyInitiatives: string[];
  accommodationsOffered: string[];
  employeeResourceGroups: string[];
  diversityStats?: {
    category: string;
    percentage?: number;
    description: string;
  }[];
  redFlags: string[];
  greenFlags: string[];
  recommendation: string;
}

// ============================================================================
// VISA SPONSORSHIP
// ============================================================================

export type VisaType =
  | "h1b"
  | "h1b1"
  | "l1"
  | "o1"
  | "tn"
  | "e2"
  | "eb1"
  | "eb2"
  | "eb3"
  | "opt"
  | "cpt"
  | "j1"
  | "green_card"
  | "other";

export interface VisaProfile {
  currentStatus: VisaType | "citizen" | "permanent_resident" | "none";
  needsSponsorship: boolean;
  sponsorshipType?: VisaType[];
  expirationDate?: Date;
  country: string;
  workAuthorizationExpiry?: Date;
  optStemEligible?: boolean;
}

export interface VisaSponsorshipInfo {
  company: string;
  sponsorsH1B: boolean;
  h1bApprovals?: {
    year: number;
    count: number;
  }[];
  averageProcessingTime?: string;
  sponsorshipNotes: string[];
  greenCardSponsorship: boolean;
  internationalOffices: string[];
  relocationSupport: boolean;
  immigrationLawyerProvided: boolean;
}

export interface VisaJobMatch {
  jobId: number;
  company: string;
  sponsorshipLikelihood: "high" | "medium" | "low" | "unknown";
  sponsorshipInfo: VisaSponsorshipInfo;
  applicationTips: string[];
  interviewQuestions: string[];
  negotiationPoints: string[];
  timeline: string;
  alternatives: string[];
}

// ============================================================================
// D&I COMPANY ANALYSIS
// ============================================================================

export interface DICompanyAnalysis {
  company: string;
  overallDIScore: number;
  categories: {
    category: DICategory;
    score: number;
    initiatives: string[];
    evidence: string[];
  }[];
  employeeResourceGroups: string[];
  leadershipDiversity: {
    area: string;
    representation: string;
    notes: string;
  }[];
  policies: {
    policy: string;
    description: string;
    strength: "strong" | "moderate" | "weak" | "unknown";
  }[];
  awards: string[];
  controversies: string[];
  recommendations: string[];
  interviewQuestions: string[];
}

/**
 * Analyze company's D&I practices
 */
export async function analyzeCompanyDI(
  company: string,
  userDIProfile?: DIProfile
): Promise<DICompanyAnalysis> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert in workplace diversity, equity, and inclusion (DEI).
Analyze companies for their D&I practices, policies, and culture.
Be balanced and evidence-based in your assessment.
Consider multiple dimensions of diversity including disability, veteran status, LGBTQ+, racial/ethnic diversity, gender, age, neurodiversity, and more.`,
        },
        {
          role: "user",
          content: `Analyze the diversity and inclusion practices of: ${company}
${userDIProfile ? `
User's D&I Profile:
- Categories of interest: ${userDIProfile.categories.join(", ")}
- Accommodations needed: ${userDIProfile.accommodationsNeeded.join(", ")}
- Preferred work style: ${userDIProfile.preferredWorkStyle}
` : ""}

Provide comprehensive D&I analysis including scores, initiatives, ERGs, policies, and recommendations.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "di_company_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              company: { type: "string" },
              overallDIScore: { type: "number" },
              categories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    score: { type: "number" },
                    initiatives: { type: "array", items: { type: "string" } },
                    evidence: { type: "array", items: { type: "string" } },
                  },
                  required: ["category", "score", "initiatives", "evidence"],
                  additionalProperties: false,
                },
              },
              employeeResourceGroups: { type: "array", items: { type: "string" } },
              leadershipDiversity: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    area: { type: "string" },
                    representation: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["area", "representation", "notes"],
                  additionalProperties: false,
                },
              },
              policies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    policy: { type: "string" },
                    description: { type: "string" },
                    strength: { type: "string", enum: ["strong", "moderate", "weak", "unknown"] },
                  },
                  required: ["policy", "description", "strength"],
                  additionalProperties: false,
                },
              },
              awards: { type: "array", items: { type: "string" } },
              controversies: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
              interviewQuestions: { type: "array", items: { type: "string" } },
            },
            required: ["company", "overallDIScore", "categories", "employeeResourceGroups", "leadershipDiversity", "policies", "awards", "controversies", "recommendations", "interviewQuestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as DICompanyAnalysis;
  } catch (error) {
    console.error("[DiversitySupport] Company D&I analysis failed:", error);
    throw new Error("Failed to analyze company D&I practices");
  }
}

// ============================================================================
// VISA SPONSORSHIP ANALYSIS
// ============================================================================

/**
 * Analyze company's visa sponsorship history and likelihood
 */
export async function analyzeVisaSponsorship(
  company: string,
  jobTitle: string,
  userVisaProfile: VisaProfile
): Promise<VisaJobMatch> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert in US immigration law and corporate visa sponsorship practices.
Analyze companies for their visa sponsorship history, likelihood, and provide actionable advice.
Be realistic about sponsorship chances and provide practical alternatives when needed.`,
        },
        {
          role: "user",
          content: `Analyze visa sponsorship for:
Company: ${company}
Position: ${jobTitle}

Candidate's Visa Profile:
- Current Status: ${userVisaProfile.currentStatus}
- Needs Sponsorship: ${userVisaProfile.needsSponsorship}
- Sponsorship Type Needed: ${userVisaProfile.sponsorshipType?.join(", ") || "H1B"}
- Country: ${userVisaProfile.country}
${userVisaProfile.optStemEligible ? "- OPT STEM eligible" : ""}

Provide comprehensive visa sponsorship analysis including likelihood, tips, and alternatives.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "visa_job_match",
          strict: true,
          schema: {
            type: "object",
            properties: {
              jobId: { type: "number" },
              company: { type: "string" },
              sponsorshipLikelihood: { type: "string", enum: ["high", "medium", "low", "unknown"] },
              sponsorshipInfo: {
                type: "object",
                properties: {
                  company: { type: "string" },
                  sponsorsH1B: { type: "boolean" },
                  averageProcessingTime: { type: "string" },
                  sponsorshipNotes: { type: "array", items: { type: "string" } },
                  greenCardSponsorship: { type: "boolean" },
                  internationalOffices: { type: "array", items: { type: "string" } },
                  relocationSupport: { type: "boolean" },
                  immigrationLawyerProvided: { type: "boolean" },
                },
                required: ["company", "sponsorsH1B", "sponsorshipNotes", "greenCardSponsorship", "internationalOffices", "relocationSupport", "immigrationLawyerProvided"],
                additionalProperties: false,
              },
              applicationTips: { type: "array", items: { type: "string" } },
              interviewQuestions: { type: "array", items: { type: "string" } },
              negotiationPoints: { type: "array", items: { type: "string" } },
              timeline: { type: "string" },
              alternatives: { type: "array", items: { type: "string" } },
            },
            required: ["jobId", "company", "sponsorshipLikelihood", "sponsorshipInfo", "applicationTips", "interviewQuestions", "negotiationPoints", "timeline", "alternatives"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as VisaJobMatch;
  } catch (error) {
    console.error("[DiversitySupport] Visa sponsorship analysis failed:", error);
    throw new Error("Failed to analyze visa sponsorship");
  }
}

// ============================================================================
// ACCOMMODATION RECOMMENDATIONS
// ============================================================================

export interface AccommodationRecommendation {
  category: DICategory;
  accommodations: Array<{
    type: string;
    description: string;
    howToRequest: string;
    legalProtection: string;
    commonChallenges: string[];
    tips: string[];
  }>;
  disclosureTiming: string;
  disclosureScript: string;
  interviewAccommodations: string[];
  onboardingConsiderations: string[];
  resources: Array<{
    name: string;
    url: string;
    description: string;
  }>;
}

/**
 * Generate accommodation recommendations
 */
export async function generateAccommodationRecommendations(
  category: DICategory,
  specificNeeds: string[]
): Promise<AccommodationRecommendation> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert in workplace accommodations and disability rights.
Provide practical, legally-informed guidance on requesting and implementing workplace accommodations.
Be supportive and empowering while being realistic about challenges.`,
        },
        {
          role: "user",
          content: `Generate accommodation recommendations for:
Category: ${category}
Specific Needs: ${specificNeeds.join(", ")}

Provide comprehensive accommodation guidance including types, how to request, legal protections, and resources.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "accommodation_recommendation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: { type: "string" },
              accommodations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    description: { type: "string" },
                    howToRequest: { type: "string" },
                    legalProtection: { type: "string" },
                    commonChallenges: { type: "array", items: { type: "string" } },
                    tips: { type: "array", items: { type: "string" } },
                  },
                  required: ["type", "description", "howToRequest", "legalProtection", "commonChallenges", "tips"],
                  additionalProperties: false,
                },
              },
              disclosureTiming: { type: "string" },
              disclosureScript: { type: "string" },
              interviewAccommodations: { type: "array", items: { type: "string" } },
              onboardingConsiderations: { type: "array", items: { type: "string" } },
              resources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    url: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["name", "url", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["category", "accommodations", "disclosureTiming", "disclosureScript", "interviewAccommodations", "onboardingConsiderations", "resources"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as AccommodationRecommendation;
  } catch (error) {
    console.error("[DiversitySupport] Accommodation recommendations failed:", error);
    throw new Error("Failed to generate accommodation recommendations");
  }
}

// ============================================================================
// D&I JOB PLATFORMS
// ============================================================================

export const DI_JOB_PLATFORMS = [
  // Disability-focused
  { name: "Inclusively", url: "https://inclusively.com", categories: ["disabilities", "neurodivergent"] },
  { name: "Disability:IN", url: "https://disabilityin.org/jobs", categories: ["disabilities"] },
  { name: "AbilityJOBS", url: "https://abilityjobs.com", categories: ["disabilities"] },
  { name: "Getting Hired", url: "https://gettinghired.com", categories: ["disabilities", "veterans"] },
  
  // Veterans
  { name: "Hire Heroes USA", url: "https://hireheroesusa.org", categories: ["veterans"] },
  { name: "Military.com", url: "https://military.com/veteran-jobs", categories: ["veterans"] },
  { name: "RecruitMilitary", url: "https://recruitmilitary.com", categories: ["veterans"] },
  { name: "Hire Our Heroes", url: "https://hireourheroes.org", categories: ["veterans"] },
  
  // Women in Tech
  { name: "PowerToFly", url: "https://powertofly.com", categories: ["women_in_tech", "lgbtq"] },
  { name: "Women Who Code", url: "https://womenwhocode.com/jobs", categories: ["women_in_tech"] },
  { name: "The Mom Project", url: "https://themomproject.com", categories: ["women_in_tech", "caregivers"] },
  { name: "Fairygodboss", url: "https://fairygodboss.com", categories: ["women_in_tech"] },
  
  // LGBTQ+
  { name: "Out & Equal", url: "https://outandequal.org/jobs", categories: ["lgbtq"] },
  { name: "myGwork", url: "https://mygwork.com", categories: ["lgbtq"] },
  { name: "Pink Jobs", url: "https://pinkjobs.com", categories: ["lgbtq"] },
  
  // Racial/Ethnic Diversity
  { name: "Jopwell", url: "https://jopwell.com", categories: ["racial_ethnic"] },
  { name: "Diversity Jobs", url: "https://diversityjobs.com", categories: ["racial_ethnic", "women_in_tech", "lgbtq", "veterans", "disabilities"] },
  { name: "Professional Diversity Network", url: "https://prodivnet.com", categories: ["racial_ethnic"] },
  
  // Age Diversity
  { name: "RetirementJobs", url: "https://retirementjobs.com", categories: ["age_diversity"] },
  { name: "Workforce50", url: "https://workforce50.com", categories: ["age_diversity"] },
  
  // Refugees & Immigrants
  { name: "Upwardly Global", url: "https://upwardlyglobal.org", categories: ["refugees", "immigrants"] },
  { name: "Tent Partnership", url: "https://tent.org", categories: ["refugees"] },
  
  // Neurodivergent
  { name: "Neurodiversity Hub", url: "https://neurodiversityhub.org", categories: ["neurodivergent"] },
  { name: "Autism Speaks", url: "https://autismspeaks.org/employment", categories: ["neurodivergent"] },
  
  // Formerly Incarcerated
  { name: "70 Million Jobs", url: "https://70millionjobs.com", categories: ["formerly_incarcerated"] },
  { name: "Honest Jobs", url: "https://honestjobs.co", categories: ["formerly_incarcerated"] },
];

/**
 * Get D&I job platforms for specific categories
 */
export function getDIPlatforms(categories: DICategory[]): typeof DI_JOB_PLATFORMS {
  if (categories.length === 0) return DI_JOB_PLATFORMS;
  
  return DI_JOB_PLATFORMS.filter((platform) =>
    platform.categories.some((cat) => categories.includes(cat as DICategory))
  );
}

// ============================================================================
// RELOCATION SUPPORT
// ============================================================================

export interface RelocationAnalysis {
  fromLocation: string;
  toLocation: string;
  costOfLivingDifference: number;
  salaryAdjustment: number;
  housingMarket: {
    averageRent: number;
    averageHomePricestring: number;
    trend: "rising" | "stable" | "falling";
  };
  qualityOfLife: {
    category: string;
    score: number;
    notes: string;
  }[];
  immigrationConsiderations: string[];
  taxImplications: string[];
  movingCostEstimate: {
    low: number;
    high: number;
    breakdown: { item: string; cost: number }[];
  };
  timeline: string;
  tips: string[];
  resources: string[];
}

/**
 * Analyze relocation requirements and costs
 */
export async function analyzeRelocation(
  fromLocation: string,
  toLocation: string,
  salary: number,
  familySize: number
): Promise<RelocationAnalysis> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert in relocation planning and cost of living analysis.
Provide detailed, practical relocation guidance including costs, quality of life, and logistics.
Be realistic about challenges and provide actionable advice.`,
        },
        {
          role: "user",
          content: `Analyze relocation from ${fromLocation} to ${toLocation}:
Current Salary: $${salary}
Family Size: ${familySize}

Provide comprehensive relocation analysis including cost of living, housing, quality of life, and moving costs.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "relocation_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fromLocation: { type: "string" },
              toLocation: { type: "string" },
              costOfLivingDifference: { type: "number" },
              salaryAdjustment: { type: "number" },
              housingMarket: {
                type: "object",
                properties: {
                  averageRent: { type: "number" },
                  averageHomePrice: { type: "number" },
                  trend: { type: "string", enum: ["rising", "stable", "falling"] },
                },
                required: ["averageRent", "averageHomePrice", "trend"],
                additionalProperties: false,
              },
              qualityOfLife: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    score: { type: "number" },
                    notes: { type: "string" },
                  },
                  required: ["category", "score", "notes"],
                  additionalProperties: false,
                },
              },
              immigrationConsiderations: { type: "array", items: { type: "string" } },
              taxImplications: { type: "array", items: { type: "string" } },
              movingCostEstimate: {
                type: "object",
                properties: {
                  low: { type: "number" },
                  high: { type: "number" },
                  breakdown: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        item: { type: "string" },
                        cost: { type: "number" },
                      },
                      required: ["item", "cost"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["low", "high", "breakdown"],
                additionalProperties: false,
              },
              timeline: { type: "string" },
              tips: { type: "array", items: { type: "string" } },
              resources: { type: "array", items: { type: "string" } },
            },
            required: ["fromLocation", "toLocation", "costOfLivingDifference", "salaryAdjustment", "housingMarket", "qualityOfLife", "immigrationConsiderations", "taxImplications", "movingCostEstimate", "timeline", "tips", "resources"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as RelocationAnalysis;
  } catch (error) {
    console.error("[DiversitySupport] Relocation analysis failed:", error);
    throw new Error("Failed to analyze relocation");
  }
}
