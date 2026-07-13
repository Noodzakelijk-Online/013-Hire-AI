import type { Job, UserProfile } from "../drizzle/schema";

type ProfileEvidence = Pick<UserProfile, "skills" | "experience" | "education"> | null | undefined;
type JobEvidence = Pick<Job, "title" | "company" | "skills" | "requirements" | "responsibilities">;

export interface EvidenceBoundApplicationDraft {
  coverLetter: string;
  customAnswers: string;
  claimsMade: string;
}

function splitEvidence(value?: string | null) {
  return Array.from(new Set(
    (value || "")
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  ));
}

function includesEvidence(haystack: string, value: string) {
  return haystack.toLocaleLowerCase().includes(value.toLocaleLowerCase());
}

/**
 * Produces a review-only draft from claims already recorded in the candidate
 * profile. It does not infer years, credentials, work authorization, salary,
 * or any experience details that are not directly represented in that data.
 */
export function buildEvidenceBoundApplicationDraft(
  profile: ProfileEvidence,
  job: JobEvidence
): EvidenceBoundApplicationDraft {
  const profileSkills = splitEvidence(profile?.skills).slice(0, 12);
  const jobText = [job.skills, job.requirements, job.responsibilities, job.title]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const matchedSkills = profileSkills.filter((skill) => includesEvidence(jobText, skill)).slice(0, 6);
  const listedSkills = (matchedSkills.length > 0 ? matchedSkills : profileSkills.slice(0, 4));
  const skillSentence = listedSkills.length > 0
    ? `My profile lists ${listedSkills.join(", ")}; this draft references only those recorded skills.`
    : "My profile does not yet contain verified skill evidence, so this draft makes no qualification claims.";
  const roleContext = job.requirements?.trim() || job.responsibilities?.trim() || job.skills?.trim();
  const roleSentence = roleContext
    ? `I have reviewed the role context, including: ${roleContext.replace(/\s+/g, " ").slice(0, 260)}${roleContext.replace(/\s+/g, " ").length > 260 ? "..." : ""}`
    : "I would review the full role requirements before adding any further detail.";

  const coverLetter = [
    "Dear Hiring Team,",
    "",
    `I am interested in the ${job.title} role at ${job.company}.`,
    skillSentence,
    "",
    roleSentence,
    "",
    "I will review this draft and provide any role-specific context before submitting an application. It does not assert unverified qualifications, credentials, work authorization, salary history, or employment status.",
    "",
    "Thank you for your consideration.",
  ].join("\n");

  return {
    coverLetter,
    customAnswers: JSON.stringify({
      source: "evidence_bound_application_draft",
      draftType: "profile_grounded",
      automationNotes: [
        "Draft references only skills explicitly recorded in the candidate profile.",
        "User review is required before any external application submission.",
      ],
    }),
    claimsMade: JSON.stringify({
      supportedClaimsOnly: true,
      supportedSkills: listedSkills,
      matchedSkills,
      note: "This review-only draft names only skills recorded in the candidate profile. It makes no claims about qualifications, credentials, work authorization, salary history, or employment status.",
    }),
  };
}
