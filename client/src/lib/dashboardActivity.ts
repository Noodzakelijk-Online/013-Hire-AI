export interface DashboardActivityJob {
  title?: string | null;
  company?: string | null;
}

export function formatDashboardActivityTarget(job?: DashboardActivityJob | null): string {
  const title = job?.title?.trim() || "";
  const company = job?.company?.trim() || "";

  if (title && company) return `${title} at ${company}`;
  return title || company || "Job details unavailable";
}
