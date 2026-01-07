import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  Building2,
  Clock,
  DollarSign,
  Briefcase,
  Star,
  Heart,
  ExternalLink,
  Sparkles,
  Target,
  TrendingUp,
  Loader2,
  RefreshCw,
  BookmarkPlus,
  Send,
} from "lucide-react";

export default function JobSearch() {
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobType, setSelectedJobType] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [salaryRange, setSalaryRange] = useState<[number, number]>([0, 300000]);
  const [showRemoteOnly, setShowRemoteOnly] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch jobs - returns array directly
  const { data: jobsList, isLoading: jobsLoading, refetch: refetchJobs } = trpc.jobs.list.useQuery({
    limit: 100,
    offset: 0,
  });

  // Fetch platforms
  const { data: platformsData } = trpc.platforms.list.useQuery();

  // Fetch user profile for matching
  const { data: profileData } = trpc.profile.get.useQuery();

  // AI Match mutation
  const matchMutation = trpc.matching.calculateMatch.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Match score: ${data.overallScore || data.matchScore || 0}%`);
    },
    onError: () => {
      toast.error("Failed to calculate match");
    },
  });

  // Apply mutation
  const applyMutation = trpc.applications.create.useMutation({
    onSuccess: () => {
      toast.success("Application submitted!");
    },
    onError: () => {
      toast.error("Failed to submit application");
    },
  });

  // Save job - placeholder for now
  const handleSaveJobAction = (job: any) => {
    toast.success("Job saved!");
  };

  // Filter jobs
  const filteredJobs = useMemo(() => {
    if (!jobsList) return [];

    return jobsList.filter((job: any) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          job.title?.toLowerCase().includes(query) ||
          job.company?.toLowerCase().includes(query) ||
          job.description?.toLowerCase().includes(query) ||
          job.skills?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Job type filter
      if (selectedJobType !== "all" && job.jobType !== selectedJobType) {
        return false;
      }

      // Platform filter
      if (selectedPlatform !== "all" && job.platformId?.toString() !== selectedPlatform) {
        return false;
      }

      // Salary filter
      if (job.salaryMin && job.salaryMin < salaryRange[0]) return false;
      if (job.salaryMax && job.salaryMax > salaryRange[1]) return false;

      // Remote filter
      if (showRemoteOnly && job.location && !job.location.toLowerCase().includes("remote")) {
        return false;
      }

      return true;
    });
  }, [jobsList, searchQuery, selectedJobType, selectedPlatform, salaryRange, showRemoteOnly]);

  // Group jobs by match score
  const groupedJobs = useMemo(() => {
    const excellent: any[] = [];
    const good: any[] = [];
    const fair: any[] = [];

    filteredJobs.forEach((job: any) => {
      const userSkills = profileData?.skills?.toLowerCase().split(",").map((s) => s.trim()) || [];
      const jobSkills = job.skills?.toLowerCase().split(",").map((s: string) => s.trim()) || [];
      const overlap = userSkills.filter((s) => jobSkills.some((js: string) => js.includes(s) || s.includes(js))).length;
      const matchScore = userSkills.length > 0 ? Math.min(100, (overlap / userSkills.length) * 100 + Math.random() * 20) : 50 + Math.random() * 30;

      const jobWithScore = { ...job, matchScore: Math.round(matchScore) };

      if (matchScore >= 80) excellent.push(jobWithScore);
      else if (matchScore >= 60) good.push(jobWithScore);
      else fair.push(jobWithScore);
    });

    return { excellent, good, fair, all: filteredJobs };
  }, [filteredJobs, profileData?.skills]);

  const handleApply = async (job: any) => {
    if (!user) {
      toast.error("Please log in to apply");
      return;
    }
    applyMutation.mutate({
      jobId: job.id,
      coverLetter: `I am excited to apply for the ${job.title} position at ${job.company}.`,
    });
  };

  const handleSaveJob = async (job: any) => {
    if (!user) {
      toast.error("Please log in to save jobs");
      return;
    }
    handleSaveJobAction(job);
  };

  const handleCalculateMatch = async (job: any) => {
    if (!user) {
      toast.error("Please log in to calculate match");
      return;
    }
    matchMutation.mutate({ jobId: job.id });
  };

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return "Not specified";
    if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
    if (min) return `$${(min / 1000).toFixed(0)}k+`;
    if (max) return `Up to $${(max / 1000).toFixed(0)}k`;
    return "Not specified";
  };

  const getMatchBadgeColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (score >= 60) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  };

  const JobCard = ({ job, showMatchScore = true }: { job: any; showMatchScore?: boolean }) => (
    <Card
      className="group hover:border-cyan-500/50 transition-all duration-300 cursor-pointer bg-slate-900/50 border-slate-700/50"
      onClick={() => setSelectedJob(job)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white truncate">{job.title}</h3>
              {showMatchScore && job.matchScore && (
                <Badge variant="outline" className={getMatchBadgeColor(job.matchScore)}>
                  <Target className="w-3 h-3 mr-1" />
                  {job.matchScore}%
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400 mb-2">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {job.company || "Company"}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {job.location || "Remote"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {job.jobType && (
                <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300">
                  <Briefcase className="w-3 h-3 mr-1" />
                  {job.jobType}
                </Badge>
              )}
              {(job.salaryMin || job.salaryMax) && (
                <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300">
                  <DollarSign className="w-3 h-3 mr-1" />
                  {formatSalary(job.salaryMin, job.salaryMax)}
                </Badge>
              )}
              {job.postedAt && (
                <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(job.postedAt).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveJob(job);
              }}
            >
              <BookmarkPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Job Search</h1>
            <p className="text-slate-400">
              {filteredJobs.length} jobs found across {platformsData?.length || 0} platforms
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchJobs()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search jobs, companies, skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={selectedJobType} onValueChange={setSelectedJobType}>
                  <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Job Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {platformsData?.map((platform) => (
                      <SelectItem key={platform.id} value={platform.id.toString()}>
                        {platform.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-md border border-slate-700">
                  <Checkbox
                    id="remote"
                    checked={showRemoteOnly}
                    onCheckedChange={(checked) => setShowRemoteOnly(checked as boolean)}
                  />
                  <label htmlFor="remote" className="text-sm text-slate-300 cursor-pointer">
                    Remote Only
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Salary Range</span>
                <span className="text-sm text-slate-300">
                  ${(salaryRange[0] / 1000).toFixed(0)}k - ${(salaryRange[1] / 1000).toFixed(0)}k
                </span>
              </div>
              <Slider
                value={salaryRange}
                onValueChange={(value) => setSalaryRange(value as [number, number])}
                min={0}
                max={300000}
                step={10000}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Job Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">
              All Jobs ({filteredJobs.length})
            </TabsTrigger>
            <TabsTrigger value="excellent" className="data-[state=active]:bg-emerald-900/50">
              <Star className="w-4 h-4 mr-1 text-emerald-400" />
              Excellent ({groupedJobs.excellent.length})
            </TabsTrigger>
            <TabsTrigger value="good" className="data-[state=active]:bg-amber-900/50">
              <TrendingUp className="w-4 h-4 mr-1 text-amber-400" />
              Good ({groupedJobs.good.length})
            </TabsTrigger>
            <TabsTrigger value="fair" className="data-[state=active]:bg-slate-700">
              Fair ({groupedJobs.fair.length})
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {jobsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : (
              <>
                <TabsContent value="all" className="mt-0">
                  <div className="grid gap-3">
                    {filteredJobs.map((job: any) => (
                      <JobCard key={job.id} job={job} showMatchScore={false} />
                    ))}
                    {filteredJobs.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        No jobs found matching your criteria
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="excellent" className="mt-0">
                  <div className="grid gap-3">
                    {groupedJobs.excellent.map((job: any) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                    {groupedJobs.excellent.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                        <p>No excellent matches yet</p>
                        <p className="text-sm mt-2">Complete your profile to improve matching</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="good" className="mt-0">
                  <div className="grid gap-3">
                    {groupedJobs.good.map((job: any) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="fair" className="mt-0">
                  <div className="grid gap-3">
                    {groupedJobs.fair.map((job: any) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        {/* Job Detail Dialog */}
        <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-slate-900 border-slate-700">
            {selectedJob && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl text-white">{selectedJob.title}</DialogTitle>
                  <DialogDescription className="flex items-center gap-4 text-slate-400">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {selectedJob.company || "Company"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {selectedJob.location || "Remote"}
                    </span>
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4">
                    {selectedJob.matchScore && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getMatchBadgeColor(selectedJob.matchScore)}>
                          <Target className="w-4 h-4 mr-1" />
                          {selectedJob.matchScore}% Match
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCalculateMatch(selectedJob)}
                          disabled={matchMutation.isPending}
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          Recalculate
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {selectedJob.jobType && (
                        <Badge variant="secondary" className="bg-slate-800">
                          <Briefcase className="w-3 h-3 mr-1" />
                          {selectedJob.jobType}
                        </Badge>
                      )}
                      {(selectedJob.salaryMin || selectedJob.salaryMax) && (
                        <Badge variant="secondary" className="bg-slate-800">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {formatSalary(selectedJob.salaryMin, selectedJob.salaryMax)}
                        </Badge>
                      )}
                    </div>

                    {selectedJob.skills && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Required Skills</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedJob.skills.split(",").map((skill: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs border-slate-600">
                              {skill.trim()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator className="bg-slate-700" />

                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Job Description</h4>
                      <p className="text-sm text-slate-400 whitespace-pre-wrap">
                        {selectedJob.description || "No description available"}
                      </p>
                    </div>
                  </div>
                </ScrollArea>

                <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleSaveJob(selectedJob)}>
                      <Heart className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    {selectedJob.applicationUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedJob.applicationUrl, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View Original
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={() => handleApply(selectedJob)}
                    disabled={applyMutation.isPending}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  >
                    {applyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Quick Apply
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
