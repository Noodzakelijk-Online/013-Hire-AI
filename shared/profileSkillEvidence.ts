export interface ProfileSkillEvidence {
  skillName?: string | null;
}

export interface ProfileWorkHistoryEvidence {
  jobTitle?: string | null;
  company?: string | null;
  skills?: string | null;
}

type ProfileWithCandidateEvidence = {
  skills?: string | null;
  experience?: string | null;
};

function splitSkills(value?: string | null): string[] {
  return (value || "")
    .split(/[,;\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function compactEvidenceText(value?: string | null, limit = 120): string {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

/**
 * Keeps the legacy profile summary and the normalized skills ledger in one
 * read-time view. Source records remain unchanged so imported and user-edited
 * evidence can still be audited independently.
 */
export function mergeProfileSkillEvidence(
  profileSkills?: string | null,
  structuredSkills: ProfileSkillEvidence[] = []
): string | null {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const skill of [
    ...splitSkills(profileSkills),
    ...structuredSkills.flatMap((skill) => splitSkills(skill.skillName)),
  ]) {
    const normalized = skill.toLocaleLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(skill);
  }

  return merged.length > 0 ? merged.join(", ") : null;
}

export function resolveProfileSkillEvidence<T extends ProfileWithCandidateEvidence | null | undefined>(
  profile: T,
  structuredSkills: ProfileSkillEvidence[] = []
): T {
  if (!profile) return profile;

  const skills = mergeProfileSkillEvidence(profile.skills, structuredSkills);
  return (skills === profile.skills ? profile : { ...profile, skills }) as T;
}

/**
 * Returns an auditable read-time candidate view for matching and material
 * preparation. Existing free-form experience remains authoritative; structured
 * history only fills an absent summary with recorded title and company pairs.
 */
export function summarizeProfileWorkHistory(
  structuredWorkHistory: ProfileWorkHistoryEvidence[] = []
): string | null {
  const records: string[] = [];
  const seen = new Set<string>();

  for (const entry of structuredWorkHistory) {
    const jobTitle = compactEvidenceText(entry.jobTitle);
    const company = compactEvidenceText(entry.company);
    if (!jobTitle || !company) continue;

    const record = `${jobTitle} at ${company}`;
    const normalized = record.toLocaleLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    records.push(record);
    if (records.length === 4) break;
  }

  return records.length > 0 ? `Recorded work history: ${records.join("; ")}.` : null;
}

export function resolveProfileCandidateEvidence<T extends ProfileWithCandidateEvidence | null | undefined>(
  profile: T,
  structuredSkills: ProfileSkillEvidence[] = [],
  structuredWorkHistory: ProfileWorkHistoryEvidence[] = []
): T {
  const workHistorySkills = structuredWorkHistory.map((entry) => ({
    skillName: entry.skills,
  }));
  const profileWithSkills = resolveProfileSkillEvidence(profile, [
    ...structuredSkills,
    ...workHistorySkills,
  ]);
  if (!profileWithSkills || compactEvidenceText(profileWithSkills.experience)) {
    return profileWithSkills;
  }

  const experience = summarizeProfileWorkHistory(structuredWorkHistory);
  return (experience ? { ...profileWithSkills, experience } : profileWithSkills) as T;
}
