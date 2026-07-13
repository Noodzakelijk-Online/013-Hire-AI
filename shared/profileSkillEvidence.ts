export interface ProfileSkillEvidence {
  skillName?: string | null;
}

type ProfileWithSkills = {
  skills?: string | null;
};

function splitSkills(value?: string | null): string[] {
  return (value || "")
    .split(/[,;\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
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

export function resolveProfileSkillEvidence<T extends ProfileWithSkills>(
  profile: T | null | undefined,
  structuredSkills: ProfileSkillEvidence[] = []
): T | null | undefined {
  if (!profile) return profile;

  const skills = mergeProfileSkillEvidence(profile.skills, structuredSkills);
  return skills === profile.skills ? profile : { ...profile, skills };
}
