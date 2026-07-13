import type {
  EducationEntry,
  UserProfile,
  UserSkill,
  WorkExperience,
} from "../drizzle/schema";

export type ReadinessSeverity = "blocker" | "warning" | "info";

export interface ProfileReadinessGap {
  key: string;
  label: string;
  severity: ReadinessSeverity;
  recommendation: string;
}

export interface ProfileReadinessResult {
  score: number;
  level: "not_ready" | "basic" | "ready" | "strong";
  autoApplyEligible: boolean;
  blockers: ProfileReadinessGap[];
  warnings: ProfileReadinessGap[];
  strengths: string[];
  nextActions: string[];
  signals: {
    hasResume: boolean;
    hasSkills: boolean;
    hasExperience: boolean;
    hasWorkHistory: boolean;
    hasEducation: boolean;
    hasTargetRoles: boolean;
    hasLocations: boolean;
    hasSalaryRange: boolean;
    hasProfessionalLinks: boolean;
  };
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAnyStructuredSkill(skills: Pick<UserSkill, "skillName">[]): boolean {
  return skills.some((skill) => hasText(skill.skillName));
}

function hasAnyWorkHistorySkill(workExperiences: Pick<WorkExperience, "skills">[]): boolean {
  return workExperiences.some((experience) => hasText(experience.skills));
}

export function calculateProfileReadiness(input: {
  profile?: Pick<
    UserProfile,
    | "skills"
    | "experience"
    | "education"
    | "desiredJobTypes"
    | "desiredLocations"
    | "salaryExpectationMin"
    | "salaryExpectationMax"
    | "resumeUrl"
    | "resumeFileKey"
    | "linkedinUrl"
    | "githubUrl"
    | "portfolioUrl"
  >;
  workExperiences?: Pick<WorkExperience, "jobTitle" | "company" | "description" | "skills">[];
  educationEntries?: Pick<EducationEntry, "degree" | "institution">[];
  skills?: Pick<UserSkill, "skillName">[];
  /**
   * When present, this is the authoritative result from the versioned resume
   * ledger. It prevents profile metadata from being mistaken for an upload.
   */
  hasActiveResumeArtifact?: boolean;
}): ProfileReadinessResult {
  const profile = input.profile;
  const workExperiences = input.workExperiences || [];
  const educationEntries = input.educationEntries || [];
  const skills = input.skills || [];

  const signals = {
    // A display URL is not enough to support a repeatable application handoff.
    // Require the storage key as well so the active resume is a durable artifact.
    hasResume: input.hasActiveResumeArtifact ?? Boolean(
      hasText(profile?.resumeUrl) && hasText(profile?.resumeFileKey)
    ),
    hasSkills: Boolean(
      hasText(profile?.skills) ||
      hasAnyStructuredSkill(skills) ||
      hasAnyWorkHistorySkill(workExperiences)
    ),
    hasExperience: Boolean(hasText(profile?.experience)),
    hasWorkHistory: workExperiences.some((item) => hasText(item.jobTitle) && hasText(item.company)),
    hasEducation: Boolean(hasText(profile?.education) || educationEntries.some((item) => hasText(item.degree) && hasText(item.institution))),
    hasTargetRoles: hasText(profile?.desiredJobTypes),
    hasLocations: hasText(profile?.desiredLocations),
    hasSalaryRange: typeof profile?.salaryExpectationMin === "number" || typeof profile?.salaryExpectationMax === "number",
    hasProfessionalLinks: Boolean(hasText(profile?.linkedinUrl) || hasText(profile?.githubUrl) || hasText(profile?.portfolioUrl)),
  };

  const weightedSignals: Array<[keyof typeof signals, number]> = [
    ["hasResume", 20],
    ["hasSkills", 18],
    ["hasExperience", 15],
    ["hasWorkHistory", 12],
    ["hasTargetRoles", 12],
    ["hasLocations", 8],
    ["hasSalaryRange", 6],
    ["hasEducation", 5],
    ["hasProfessionalLinks", 4],
  ];

  const score = weightedSignals.reduce((total, [key, weight]) => {
    return total + (signals[key] ? weight : 0);
  }, 0);

  const blockers: ProfileReadinessGap[] = [];
  const warnings: ProfileReadinessGap[] = [];
  const strengths: string[] = [];

  const addGap = (
    key: string,
    label: string,
    severity: ReadinessSeverity,
    recommendation: string
  ) => {
    const gap = { key, label, severity, recommendation };
    if (severity === "blocker") blockers.push(gap);
    else warnings.push(gap);
  };

  if (!signals.hasResume) {
    addGap("resume", "Active resume artifact missing", "blocker", "Upload and select a versioned resume before Hire.AI prepares applications.");
  } else {
    strengths.push("Active resume artifact available");
  }

  if (!signals.hasSkills) {
    addGap("skills", "Skills missing", "blocker", "Add core skills or parse them from a resume so matching can be trusted.");
  } else {
    strengths.push("Skills available for matching");
  }

  if (!signals.hasExperience && !signals.hasWorkHistory) {
    addGap("experience", "Experience missing", "blocker", "Add work history or a concise experience summary before application materials are generated.");
  } else {
    strengths.push("Experience evidence available");
  }

  if (!signals.hasTargetRoles) {
    addGap("target_roles", "Target roles missing", "blocker", "Set desired job titles or role categories so the autonomous agent knows what to pursue.");
  } else {
    strengths.push("Target roles defined");
  }

  if (!signals.hasLocations) {
    addGap("locations", "Location preference missing", "warning", "Add remote/location constraints to prevent irrelevant job recommendations.");
  }
  if (!signals.hasSalaryRange) {
    addGap("salary", "Salary range missing", "warning", "Add compensation expectations so low-fit roles can be filtered earlier.");
  }
  if (!signals.hasEducation) {
    addGap("education", "Education not recorded", "info", "Add education where it supports role eligibility or screening questions.");
  }
  if (!signals.hasProfessionalLinks) {
    addGap("links", "Professional links missing", "info", "Connect LinkedIn, GitHub, or a portfolio to strengthen evidence for claims.");
  }

  const level =
    score >= 85 && blockers.length === 0 ? "strong" :
      score >= 70 && blockers.length === 0 ? "ready" :
        score >= 45 ? "basic" :
          "not_ready";
  const autoApplyEligible = blockers.length === 0 && score >= 75;
  const nextActions = [...blockers, ...warnings]
    .slice(0, 4)
    .map((gap) => gap.recommendation);

  return {
    score,
    level,
    autoApplyEligible,
    blockers,
    warnings,
    strengths,
    nextActions,
    signals,
  };
}
