import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getApplicationEvidenceGateSummary } from "@/lib/applicationEvidenceGates";
import { buildJobPreparationDecisionInput } from "@/lib/jobDecisionActions";
import { getSafeExternalUrl, openExternalUrl } from "@/lib/externalUrl";
import { getJobMatchDecisionSummary } from "@/lib/jobMatchDecisionSummary";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Bookmark,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  ExternalLink,
  Trash2,
  Loader2,
  Send,
  AlertCircle,
  Briefcase,
} from "lucide-react";

export default function SavedJobs() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch saved jobs
  const { data: savedJobs, isLoading, refetch } = trpc.jobs.getSavedJobs.useQuery();
  const { data: profileData } = trpc.profile.get.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const { data: autonomousPlan } = trpc.automation.plan.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const preparationEvidenceGate = useMemo(() => {
    const summary = getApplicationEvidenceGateSummary(
      { status: "pending" },
      autonomousPlan?.evidenceGates || []
    );
    return summary.gates[0] || null;
  }, [autonomousPlan?.evidenceGates]);

  // Mutations
  const unsaveMutation = trpc.jobs.unsaveJob.useMutation({
    onSuccess: () => {
      toast.success("Job removed from saved");
      refetch();
    },
    onError: () => {
      toast.error("Failed to remove job");
    },
  });

  const decideMutation = trpc.applications.decide.useMutation({
    onSuccess: async (result) => {
      if (result.preparationBlocked) {
        toast.info("Resolve profile evidence before preparing an application.");
        setLocation(preparationEvidenceGate?.route || "/profile");
        return;
      }
      toast.success(result.existing ? "Review decision updated" : "Application queued for review");
      await refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record the application decision");
    },
  });

  const handleUnsave = (jobId: number) => {
    unsaveMutation.mutate({ jobId });
  };

  const handleApply = (job: any) => {
    if (!user) {
      toast.error("Please log in to queue an application review");
      return;
    }
    if (preparationEvidenceGate) {
      toast.info(preparationEvidenceGate.detail || "Resolve profile evidence before preparing an application.");
      setLocation(preparationEvidenceGate.route || "/profile");
      return;
    }
    const summary = getJobMatchDecisionSummary(job, profileData);
    decideMutation.mutate(buildJobPreparationDecisionInput(job, summary, "Saved Jobs"));
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;
    if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
    if (min) return `$${(min / 1000).toFixed(0)}k+`;
    if (max) return `Up to $${(max / 1000).toFixed(0)}k`;
    return null;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return d.toLocaleDateString();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <AppHeader currentPage="dashboard" />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AppHeader currentPage="dashboard" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bookmark className="h-6 w-6 text-cyan-400" />
              Saved Jobs
            </h1>
            <p className="text-slate-400">Jobs you've bookmarked for later</p>
          </div>
          <Button
            variant="outline"
            className="border-cyan-500/50 text-cyan-400"
            onClick={() => setLocation("/dashboard")}
          >
            <Briefcase className="w-4 h-4 mr-2" />
            View Dashboard
          </Button>
        </div>

        {/* Saved Jobs List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : savedJobs && savedJobs.length > 0 ? (
          <div className="grid gap-4">
            {savedJobs.map((savedJob: any) => {
              const job = savedJob.job || savedJob;
              return (
                <Card key={savedJob.id} className="bg-slate-900/50 border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-white text-lg">{job.title}</h3>
                          {job.jobType && (
                            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                              {job.jobType}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mb-3">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {job.company}
                          </span>
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {job.location}
                            </span>
                          )}
                          {formatSalary(job.salaryMin, job.salaryMax) && (
                            <span className="flex items-center gap-1 text-green-400">
                              <DollarSign className="w-4 h-4" />
                              {formatSalary(job.salaryMin, job.salaryMax)}
                            </span>
                          )}
                          {job.postedDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatDate(job.postedDate)}
                            </span>
                          )}
                        </div>

                        {job.description && (
                          <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                            {job.description}
                          </p>
                        )}

                        {job.skills && (
                          <div className="flex flex-wrap gap-1">
                            {job.skills.split(",").slice(0, 5).map((skill: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="bg-slate-800 text-slate-300 text-xs">
                                {skill.trim()}
                              </Badge>
                            ))}
                            {job.skills.split(",").length > 5 && (
                              <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-xs">
                                +{job.skills.split(",").length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-slate-500 mt-2">
                          Saved {formatDate(savedJob.savedAt || savedJob.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          data-testid={`saved-job-prepare-or-resolve-evidence-${job.id}`}
                          title={preparationEvidenceGate?.detail || "Queue a controlled application review"}
                          className={preparationEvidenceGate
                            ? "border border-amber-500/50 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                            : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"}
                          onClick={() => handleApply(job)}
                          disabled={decideMutation.isPending}
                        >
                          {decideMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : preparationEvidenceGate ? (
                            <AlertCircle className="w-4 h-4 mr-2" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          {preparationEvidenceGate ? "Resolve Evidence" : "Queue Review"}
                        </Button>
                        {getSafeExternalUrl(job.applicationUrl) && (
                          <Button
                            variant="outline"
                            className="border-slate-700"
                            onClick={() => openExternalUrl(job.applicationUrl)}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Job
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleUnsave(job.id)}
                          disabled={unsaveMutation.isPending || decideMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Bookmark className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No saved jobs yet</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Browse jobs and click the bookmark icon to save them for later. Saved jobs will appear here.
              </p>
              <Button
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
                onClick={() => setLocation("/profile")}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Complete Profile
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
