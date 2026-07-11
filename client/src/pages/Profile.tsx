import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Upload, 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  Linkedin, 
  Github,
  Briefcase,
  GraduationCap,
  Code,
  FolderGit2,
  Globe,
  Target,
  ShieldCheck,
  LockKeyhole,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  getProfileEvidenceControlSummary,
  type ProfileEvidenceControlStatus,
  type ProfileEvidenceProvider,
  type ProfileEvidenceProviderId,
  type ProfileEvidenceProviderStatus,
} from "@/lib/profileEvidenceControl";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Profile() {
  const { loading, isAuthenticated } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  
  // Dialog states
  const [workExpDialogOpen, setWorkExpDialogOpen] = useState(false);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  
  // Editing states
  const [editingWorkExp, setEditingWorkExp] = useState<any>(null);
  const [editingEducation, setEditingEducation] = useState<any>(null);
  const [editingSkill, setEditingSkill] = useState<any>(null);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [targetRoles, setTargetRoles] = useState("");
  const [targetLocations, setTargetLocations] = useState("");
  const [salaryMinimum, setSalaryMinimum] = useState("");
  const [salaryMaximum, setSalaryMaximum] = useState("");
  const [needsVisaSponsorship, setNeedsVisaSponsorship] = useState(false);

  // Queries
  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const evidenceReadinessQuery = trpc.profile.getEvidenceReadiness.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const workExperiencesQuery = trpc.profile.getWorkExperiences.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const educationQuery = trpc.profile.getEducation.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const skillsQuery = trpc.profile.getSkills.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const projectsQuery = trpc.profile.getProjects.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const activeResumeQuery = trpc.resume.getActive.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const resumeVersionsQuery = trpc.resume.getVersions.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile evidence saved");
      profileQuery.refetch();
      evidenceReadinessQuery.refetch();
    },
    onError: (error) => toast.error(error.message || "Failed to save profile evidence"),
  });
  const requestConnectorConnection = trpc.connectors.requestConnection.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      evidenceReadinessQuery.refetch();
    },
    onError: (error) => toast.error(error.message || "Failed to record connector request"),
  });
  const parseResumeFile = trpc.resume.parseFile.useMutation({
    onSuccess: async ({ resume }) => {
      toast.success(`Resume imported as version ${resume.version}. Profile details were refreshed for review.`);
      await Promise.all([
        profileQuery.refetch(),
        evidenceReadinessQuery.refetch(),
        activeResumeQuery.refetch(),
        resumeVersionsQuery.refetch(),
      ]);
    },
    onError: (error) => toast.error(error.message || "Unable to import this resume"),
  });
  const setActiveResume = trpc.resume.setActiveVersion.useMutation({
    onSuccess: async ({ success }) => {
      if (!success) {
        toast.error("Unable to activate that resume version");
        return;
      }
      toast.success("Active resume updated");
      await Promise.all([
        profileQuery.refetch(),
        evidenceReadinessQuery.refetch(),
        activeResumeQuery.refetch(),
        resumeVersionsQuery.refetch(),
      ]);
    },
    onError: (error) => toast.error(error.message || "Unable to activate that resume version"),
  });
  const deleteResumeVersion = trpc.resume.deleteVersion.useMutation({
    onSuccess: async ({ success }) => {
      if (!success) {
        toast.error("Unable to delete that resume version");
        return;
      }
      toast.success("Resume version deleted");
      await Promise.all([
        profileQuery.refetch(),
        evidenceReadinessQuery.refetch(),
        activeResumeQuery.refetch(),
        resumeVersionsQuery.refetch(),
      ]);
    },
    onError: (error) => toast.error(error.message || "Unable to delete that resume version"),
  });
  const deleteWorkExperience = trpc.profile.deleteWorkExperience.useMutation({
    onSuccess: async () => {
      toast.success("Work experience deleted");
      await Promise.all([workExperiencesQuery.refetch(), evidenceReadinessQuery.refetch()]);
    },
    onError: (error) => toast.error(error.message || "Unable to delete work experience"),
  });
  const deleteEducation = trpc.profile.deleteEducation.useMutation({
    onSuccess: async () => {
      toast.success("Education entry deleted");
      await Promise.all([educationQuery.refetch(), evidenceReadinessQuery.refetch()]);
    },
    onError: (error) => toast.error(error.message || "Unable to delete education entry"),
  });
  const deleteSkill = trpc.profile.deleteSkill.useMutation({
    onSuccess: async () => {
      toast.success("Skill removed");
      await Promise.all([skillsQuery.refetch(), evidenceReadinessQuery.refetch()]);
    },
    onError: (error) => toast.error(error.message || "Unable to remove skill"),
  });
  const deleteProject = trpc.profile.deleteProject.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      projectsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || "Unable to delete project"),
  });
  const evidenceControl = useMemo(
    () => evidenceReadinessQuery.data ?? getProfileEvidenceControlSummary({
      profile: profileQuery.data,
    }),
    [evidenceReadinessQuery.data, profileQuery.data]
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    setLinkedinUrl(profileQuery.data?.linkedinUrl || "");
    setGithubUrl(profileQuery.data?.githubUrl || "");
    setPortfolioUrl(profileQuery.data?.portfolioUrl || "");
  }, [profileQuery.data?.linkedinUrl, profileQuery.data?.githubUrl, profileQuery.data?.portfolioUrl]);

  useEffect(() => {
    setTargetRoles(profileQuery.data?.desiredJobTypes || "");
    setTargetLocations(profileQuery.data?.desiredLocations || "");
    setSalaryMinimum(profileQuery.data?.salaryExpectationMin?.toString() || "");
    setSalaryMaximum(profileQuery.data?.salaryExpectationMax?.toString() || "");
    setNeedsVisaSponsorship(Boolean(profileQuery.data?.needsVisaSponsorship));
  }, [
    profileQuery.data?.desiredJobTypes,
    profileQuery.data?.desiredLocations,
    profileQuery.data?.salaryExpectationMin,
    profileQuery.data?.salaryExpectationMax,
    profileQuery.data?.needsVisaSponsorship,
  ]);

  const scrollToProfileSection = (section: string) => {
    document
      .getElementById(`profile-section-${section}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mimeType = getResumeMimeType(file);
    if (!mimeType) {
      toast.error("Choose a PDF, DOC, DOCX, TXT, or RTF resume.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Resume files must be 10MB or smaller.");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      await parseResumeFile.mutateAsync({
        fileData: await fileToBase64(file),
        mimeType,
        filename: file.name,
      });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRequestConnectorConnection = (provider: ConnectorProviderId) => {
    requestConnectorConnection.mutate({ provider });
  };

  const handleLinkedInConnect = () => handleRequestConnectorConnection("linkedin");

  const handleGitHubConnect = () => handleRequestConnectorConnection("github");

  const handleSaveSocialLinks = () => {
    updateProfile.mutate({
      linkedinUrl: linkedinUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      portfolioUrl: portfolioUrl.trim() || undefined,
    });
  };

  const handleSaveSearchPreferences = () => {
    const minimum = parseOptionalSalary(salaryMinimum);
    const maximum = parseOptionalSalary(salaryMaximum);
    if (minimum === undefined || maximum === undefined) {
      toast.error("Salary expectations must be whole, non-negative numbers.");
      return;
    }
    if (minimum !== null && maximum !== null && minimum > maximum) {
      toast.error("Maximum salary must be at least the minimum salary.");
      return;
    }

    updateProfile.mutate({
      desiredJobTypes: targetRoles.trim() || null,
      desiredLocations: targetLocations.trim() || null,
      salaryExpectationMin: minimum,
      salaryExpectationMax: maximum,
      needsVisaSponsorship: needsVisaSponsorship ? 1 : 0,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <AppHeader currentPage="profile" />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AppHeader currentPage="profile" />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Profile</h1>
          <p className="text-slate-400">
            Build your professional profile to help our AI find the perfect job matches
          </p>
        </div>

        {/* Evidence Control */}
        <Card data-testid="profile-evidence-control" className="mb-6 bg-slate-900/60 border-slate-700/60">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  Profile Evidence Control
                </CardTitle>
                <CardDescription className="mt-2">
                  {evidenceControl.headline}
                </CardDescription>
              </div>
              <Badge className={getEvidenceStatusClass(evidenceControl.status)}>
                {evidenceControl.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-300">Readiness score</span>
                  <span className="text-sm font-semibold text-white">{evidenceControl.score}%</span>
                </div>
                <Progress value={evidenceControl.score} className="h-2" />
                <p className="text-sm text-slate-400">{evidenceControl.detail}</p>
              </div>
              <Button
                data-testid="profile-evidence-primary"
                onClick={() => scrollToProfileSection(evidenceControl.primarySection)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                {evidenceControl.cta}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <EvidenceMetric label="Connected" value={evidenceControl.connectedCount} />
              <EvidenceMetric label="Missing" value={evidenceControl.missingCount} />
              <EvidenceMetric label="Consent gated" value={evidenceControl.consentRequiredCount} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {evidenceControl.providers.map((provider) => (
                <EvidenceProviderRow
                  key={provider.id}
                  provider={provider}
                  isRequesting={requestConnectorConnection.isPending}
                  onRequestConnection={
                    canRequestProviderConnector(provider)
                      ? handleRequestConnectorConnection
                      : undefined
                  }
                />
              ))}
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                External inbox and cloud access requires explicit consent. Hire.AI should not read Gmail, Drive, Dropbox, or Outlook data until a real connector is approved.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Import Profile Card */}
        <Card id="profile-section-import" data-testid="profile-section-import" className="mb-6 bg-slate-900/50 border-slate-700/50 scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" />
              Import Your Profile
            </CardTitle>
            <CardDescription>
              Quickly populate your profile by connecting your accounts or uploading your resume
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-slate-700 hover:border-cyan-500 hover:bg-cyan-500/10"
                onClick={handleLinkedInConnect}
                disabled={requestConnectorConnection.isPending}
              >
                <Linkedin className="w-6 h-6 text-blue-500" />
                <span className="text-white">Connect LinkedIn</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-slate-700 hover:border-cyan-500 hover:bg-cyan-500/10"
                onClick={handleGitHubConnect}
                disabled={requestConnectorConnection.isPending}
              >
                <Github className="w-6 h-6 text-white" />
                <span className="text-white">Connect GitHub</span>
              </Button>
              
              <label>
                <Button
                  variant="outline"
                  className="h-24 w-full flex-col gap-2 border-slate-700 hover:border-cyan-500 hover:bg-cyan-500/10 cursor-pointer"
                  disabled={isUploading}
                  asChild
                >
                  <div>
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    ) : (
                      <Upload className="w-6 h-6 text-cyan-400" />
                    )}
                    <span className="text-white">Upload Resume</span>
                  </div>
                </Button>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.rtf"
                  className="hidden"
                  onChange={handleResumeUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
            <div className="mt-4 rounded-md border border-slate-700/60 bg-slate-950/40 p-3">
              {activeResumeQuery.data ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{activeResumeQuery.data.fileName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Active version {activeResumeQuery.data.version} used for application preparation
                    </p>
                  </div>
                  <a
                    href={activeResumeQuery.data.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    View resume
                  </a>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No active resume yet. Importing a resume creates the version used for future application preparation.</p>
              )}
              {resumeVersionsQuery.data && resumeVersionsQuery.data.length > 1 ? (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Resume versions</p>
                  <div className="space-y-2">
                    {resumeVersionsQuery.data.map((resume) => (
                      <div key={resume.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-slate-300">v{resume.version} - {resume.fileName}</span>
                        <div className="flex items-center gap-2">
                          {resume.isActive ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">Active</Badge> : null}
                          {!resume.isActive ? (
                            <Button size="sm" variant="outline" onClick={() => setActiveResume.mutate({ version: resume.version })} disabled={setActiveResume.isPending}>
                              Use this version
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-300 hover:text-red-200"
                            onClick={() => {
                              if (confirm(`Delete resume version ${resume.version}?`)) deleteResumeVersion.mutate({ version: resume.version });
                            }}
                            disabled={deleteResumeVersion.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Social Media & Portfolio Links */}
        <Card id="profile-section-social" data-testid="profile-section-social" className="mb-6 bg-slate-900/50 border-slate-700/50 scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Social Media & Portfolio
            </CardTitle>
            <CardDescription>
              Add links to your professional profiles and portfolio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  LinkedIn URL
                </label>
                <Input
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  GitHub URL
                </label>
                <Input
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  placeholder="https://github.com/yourusername"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  Portfolio URL
                </label>
                <Input
                  value={portfolioUrl}
                  onChange={(event) => setPortfolioUrl(event.target.value)}
                  placeholder="https://yourportfolio.com"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="rounded-md border border-slate-700/60 bg-slate-950/40 p-3">
                <p className="text-sm font-medium text-slate-300">Additional social connectors</p>
                <p className="mt-2 text-sm text-slate-400">
                  Other social media sources should be added through explicit consent-based connectors before Hire.AI imports or analyzes them.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleSaveSocialLinks}
                disabled={updateProfile.isPending}
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Links
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="profile-section-preferences" data-testid="profile-section-preferences" className="mb-6 bg-slate-900/50 border-slate-700/50 scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" />
              Job Search Targets
            </CardTitle>
            <CardDescription>
              Define the role, location, compensation, and work-authorization constraints used to rank autonomous preparation work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="profile-target-roles" className="mb-2 block text-sm font-medium text-slate-300">
                  Target roles or employment types
                </label>
                <Input
                  id="profile-target-roles"
                  data-testid="profile-target-roles"
                  value={targetRoles}
                  onChange={(event) => setTargetRoles(event.target.value)}
                  placeholder="Frontend Engineer, full-time"
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <p className="mt-1 text-xs text-slate-500">Use commas to list role titles, categories, or employment types.</p>
              </div>
              <div>
                <label htmlFor="profile-target-locations" className="mb-2 block text-sm font-medium text-slate-300">
                  Target locations
                </label>
                <Input
                  id="profile-target-locations"
                  data-testid="profile-target-locations"
                  value={targetLocations}
                  onChange={(event) => setTargetLocations(event.target.value)}
                  placeholder="Remote, Netherlands, Europe"
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <p className="mt-1 text-xs text-slate-500">Use commas to list acceptable remote, country, or regional locations.</p>
              </div>
              <div>
                <label htmlFor="profile-salary-minimum" className="mb-2 block text-sm font-medium text-slate-300">
                  Minimum annual salary
                </label>
                <Input
                  id="profile-salary-minimum"
                  data-testid="profile-salary-minimum"
                  inputMode="numeric"
                  value={salaryMinimum}
                  onChange={(event) => setSalaryMinimum(event.target.value)}
                  placeholder="90000"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label htmlFor="profile-salary-maximum" className="mb-2 block text-sm font-medium text-slate-300">
                  Maximum annual salary
                </label>
                <Input
                  id="profile-salary-maximum"
                  data-testid="profile-salary-maximum"
                  inputMode="numeric"
                  value={salaryMaximum}
                  onChange={(event) => setSalaryMaximum(event.target.value)}
                  placeholder="130000"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-slate-700/60 bg-slate-950/40 p-3">
              <Checkbox
                id="profile-needs-visa"
                checked={needsVisaSponsorship}
                onCheckedChange={(checked) => setNeedsVisaSponsorship(checked === true)}
              />
              <div>
                <label htmlFor="profile-needs-visa" className="text-sm font-medium text-slate-200">
                  I require visa sponsorship
                </label>
                <p className="mt-1 text-xs text-slate-500">Roles without a sponsorship signal stay out of the autonomous preparation queue.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                data-testid="profile-save-search-preferences"
                onClick={handleSaveSearchPreferences}
                disabled={updateProfile.isPending}
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Search Targets
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Work Experience Section */}
        <Card id="profile-section-work-experience" data-testid="profile-section-work-experience" className="mb-6 bg-slate-900/50 border-slate-700/50 scroll-mt-24">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Work Experience</CardTitle>
              </div>
              <WorkExperienceDialog
                open={workExpDialogOpen}
                onOpenChange={(isOpen: boolean) => {
                  setWorkExpDialogOpen(isOpen);
                  if (!isOpen) setEditingWorkExp(null);
                }}
                editing={editingWorkExp}
                onSuccess={async () => {
                  await Promise.all([workExperiencesQuery.refetch(), evidenceReadinessQuery.refetch()]);
                  setWorkExpDialogOpen(false);
                  setEditingWorkExp(null);
                }}
              />
            </div>
            <CardDescription>
              Add your professional work history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workExperiencesQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : workExperiencesQuery.data && workExperiencesQuery.data.length > 0 ? (
              <div className="space-y-4">
                {workExperiencesQuery.data.map((exp: any) => (
                  <WorkExperienceCard
                    key={exp.id}
                    experience={exp}
                    onEdit={() => {
                      setEditingWorkExp(exp);
                      setWorkExpDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm("Are you sure you want to delete this work experience?")) {
                        deleteWorkExperience.mutate({ id: exp.id });
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">No work experience added yet</p>
                <Button
                  onClick={() => setWorkExpDialogOpen(true)}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Work Experience
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Education Section */}
        <Card className="mb-6 bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Education</CardTitle>
              </div>
              <EducationDialog
                open={educationDialogOpen}
                onOpenChange={(isOpen: boolean) => {
                  setEducationDialogOpen(isOpen);
                  if (!isOpen) setEditingEducation(null);
                }}
                editing={editingEducation}
                onSuccess={async () => {
                  await Promise.all([educationQuery.refetch(), evidenceReadinessQuery.refetch()]);
                  setEducationDialogOpen(false);
                  setEditingEducation(null);
                }}
              />
            </div>
            <CardDescription>
              Add your educational background
            </CardDescription>
          </CardHeader>
          <CardContent>
            {educationQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : educationQuery.data && educationQuery.data.length > 0 ? (
              <div className="space-y-4">
                {educationQuery.data.map((edu: any) => (
                  <EducationCard
                    key={edu.id}
                    education={edu}
                    onEdit={() => {
                      setEditingEducation(edu);
                      setEducationDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm("Are you sure you want to delete this education entry?")) {
                        deleteEducation.mutate({ id: edu.id });
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No education added yet</p>
                <p className="text-xs text-slate-500 mt-1">Click "Add Education" above to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skills Section */}
        <Card id="profile-section-skills" data-testid="profile-section-skills" className="mb-6 bg-slate-900/50 border-slate-700/50 scroll-mt-24">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Skills</CardTitle>
              </div>
              <SkillDialog
                open={skillDialogOpen}
                onOpenChange={(isOpen: boolean) => {
                  setSkillDialogOpen(isOpen);
                  if (!isOpen) setEditingSkill(null);
                }}
                editing={editingSkill}
                onSuccess={async () => {
                  await Promise.all([skillsQuery.refetch(), evidenceReadinessQuery.refetch()]);
                  setSkillDialogOpen(false);
                  setEditingSkill(null);
                }}
              />
            </div>
            <CardDescription>
              Add your technical and professional skills
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skillsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : skillsQuery.data && skillsQuery.data.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skillsQuery.data.map((skill: any) => (
                  <SkillBadge
                    key={skill.id}
                    skill={skill}
                    onEdit={() => {
                      setEditingSkill(skill);
                      setSkillDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm(`Remove ${skill.skillName}?`)) {
                        deleteSkill.mutate({ id: skill.id });
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Code className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No skills added yet</p>
                <p className="text-xs text-slate-500 mt-1">Click "Add Skill" above to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projects Section (Optional) */}
        <Card className="mb-6 bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Projects</CardTitle>
              </div>
              <ProjectDialog
                open={projectDialogOpen}
                onOpenChange={(isOpen: boolean) => {
                  setProjectDialogOpen(isOpen);
                  if (!isOpen) setEditingProject(null);
                }}
                editing={editingProject}
                onSuccess={async () => {
                  await Promise.all([projectsQuery.refetch(), evidenceReadinessQuery.refetch()]);
                  setProjectDialogOpen(false);
                  setEditingProject(null);
                }}
              />
            </div>
            <CardDescription>
              Showcase your portfolio and side projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : projectsQuery.data && projectsQuery.data.length > 0 ? (
              <div className="space-y-4">
                {projectsQuery.data.map((project: any) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={() => {
                      setEditingProject(project);
                      setProjectDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm("Are you sure you want to delete this project?")) {
                        deleteProject.mutate({ id: project.id });
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderGit2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No projects added yet</p>
                <p className="text-xs text-slate-500 mt-1">Click "Add Project" above to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function parseOptionalSalary(value: string): number | null | undefined {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000_000) return undefined;
  return parsed;
}

function getEvidenceStatusClass(status: ProfileEvidenceControlStatus) {
  switch (status) {
    case "blocked":
      return "bg-red-500/15 text-red-200 border-red-500/30";
    case "limited":
      return "bg-amber-500/15 text-amber-200 border-amber-500/30";
    case "ready":
      return "bg-emerald-500/15 text-emerald-200 border-emerald-500/30";
  }
}

function getProviderStatusClass(status: ProfileEvidenceProviderStatus) {
  switch (status) {
    case "connected":
      return "text-emerald-300";
    case "missing":
      return "text-red-300";
    case "consent_required":
      return "text-amber-300";
  }
}

function getProviderStatusLabel(status: ProfileEvidenceProviderStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "missing":
      return "Missing";
    case "consent_required":
      return "Consent required";
  }
}

type ConnectorProviderId = Exclude<ProfileEvidenceProviderId, "resume">;

function canRequestProviderConnector(provider: ProfileEvidenceProvider): provider is ProfileEvidenceProvider & { id: ConnectorProviderId } {
  return provider.id !== "resume";
}

function EvidenceMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-950/40 p-3">
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function EvidenceProviderRow({
  provider,
  isRequesting = false,
  onRequestConnection,
}: {
  provider: ProfileEvidenceProvider;
  isRequesting?: boolean;
  onRequestConnection?: (provider: ConnectorProviderId) => void;
}) {
  const Icon = provider.status === "connected"
    ? CheckCircle2
    : provider.status === "missing"
      ? AlertTriangle
      : LockKeyhole;
  const connectorAlreadyRequested = provider.connectionStatus === "connection_requested";
  const connectorActionAvailable = onRequestConnection && provider.status !== "connected";

  return (
    <div
      data-testid={`profile-evidence-provider-${provider.id}`}
      className="rounded-md border border-slate-700/60 bg-slate-950/40 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 shrink-0 ${getProviderStatusClass(provider.status)}`} />
            <p className="truncate text-sm font-medium text-white">{provider.label}</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">{provider.detail}</p>
          {provider.consentScopes && provider.consentScopes.length > 0 ? (
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
              Scopes: {provider.consentScopes.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`text-xs font-medium ${getProviderStatusClass(provider.status)}`}>
            {getProviderStatusLabel(provider.status)}
          </span>
          {connectorActionAvailable ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid={`profile-evidence-request-${provider.id}`}
              className="h-7 border-slate-700 px-2 text-xs text-slate-100 hover:border-cyan-500 hover:bg-cyan-500/10"
              disabled={isRequesting || connectorAlreadyRequested}
              onClick={() => onRequestConnection(provider.id as ConnectorProviderId)}
            >
              {connectorAlreadyRequested ? "Requested" : "Request"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WorkExperienceDialog({ open, onOpenChange, editing, onSuccess }: any) {
  const [form, setForm] = useState(emptyWorkExperience());
  const addExperience = trpc.profile.addWorkExperience.useMutation({
    onSuccess: () => {
      toast.success("Work experience saved");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Unable to save work experience"),
  });
  const updateExperience = trpc.profile.updateWorkExperience.useMutation({
    onSuccess: () => {
      toast.success("Work experience updated");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Unable to update work experience"),
  });

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      jobTitle: editing.jobTitle || "",
      company: editing.company || "",
      location: editing.location || "",
      startDate: dateForInput(editing.startDate),
      endDate: dateForInput(editing.endDate),
      isCurrent: Boolean(editing.isCurrent),
      description: editing.description || "",
      achievements: editing.achievements || "",
      skills: editing.skills || "",
    } : emptyWorkExperience());
  }, [editing, open]);

  const isSaving = addExperience.isPending || updateExperience.isPending;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.jobTitle.trim() || !form.company.trim() || !form.startDate) {
      toast.error("Job title, company, and start date are required.");
      return;
    }
    const payload = {
      jobTitle: form.jobTitle.trim(),
      company: form.company.trim(),
      location: optionalText(form.location),
      startDate: form.startDate,
      endDate: form.isCurrent ? undefined : optionalText(form.endDate),
      isCurrent: form.isCurrent ? 1 : 0,
      description: optionalText(form.description),
      achievements: optionalText(form.achievements),
      skills: optionalText(form.skills),
    };
    if (editing) updateExperience.mutate({ id: editing.id, ...payload });
    else addExperience.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Experience
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Work Experience" : "Add Work Experience"}
          </DialogTitle>
          <DialogDescription>
            Add details about your professional experience
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Job title" required><Input value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} /></FormField>
            <FormField label="Company" required><Input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></FormField>
            <FormField label="Location"><Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></FormField>
            <FormField label="Start date" required><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></FormField>
            <FormField label="End date"><Input type="date" value={form.endDate} disabled={form.isCurrent} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></FormField>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox id="work-current" checked={form.isCurrent} onCheckedChange={(checked) => setForm({ ...form, isCurrent: Boolean(checked) })} />
                <label htmlFor="work-current" className="text-sm text-slate-300">I currently work here</label>
              </div>
            </div>
          </div>
          <FormField label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField>
          <FormField label="Key achievements"><Textarea value={form.achievements} onChange={(event) => setForm({ ...form, achievements: event.target.value })} /></FormField>
          <FormField label="Skills used"><Input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} placeholder="React, stakeholder management, SQL" /></FormField>
          <DialogActions isSaving={isSaving} label={editing ? "Save changes" : "Add experience"} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EducationDialog({ open, onOpenChange, editing, onSuccess }: any) {
  const [form, setForm] = useState(emptyEducation());
  const addEducation = trpc.profile.addEducation.useMutation({
    onSuccess: () => {
      toast.success("Education saved");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Unable to save education"),
  });
  const updateEducation = trpc.profile.updateEducation.useMutation({
    onSuccess: () => {
      toast.success("Education updated");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Unable to update education"),
  });

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      degree: editing.degree || "",
      fieldOfStudy: editing.fieldOfStudy || "",
      institution: editing.institution || "",
      location: editing.location || "",
      startDate: dateForInput(editing.startDate),
      endDate: dateForInput(editing.endDate),
      isCurrent: Boolean(editing.isCurrent),
      gpa: editing.gpa || "",
      achievements: editing.achievements || "",
    } : emptyEducation());
  }, [editing, open]);

  const isSaving = addEducation.isPending || updateEducation.isPending;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.degree.trim() || !form.institution.trim()) {
      toast.error("Degree and institution are required.");
      return;
    }
    const payload = {
      degree: form.degree.trim(),
      institution: form.institution.trim(),
      fieldOfStudy: optionalText(form.fieldOfStudy),
      location: optionalText(form.location),
      startDate: optionalText(form.startDate),
      endDate: form.isCurrent ? undefined : optionalText(form.endDate),
      isCurrent: form.isCurrent ? 1 : 0,
      gpa: optionalText(form.gpa),
      achievements: optionalText(form.achievements),
    };
    if (editing) updateEducation.mutate({ id: editing.id, ...payload });
    else addEducation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Education
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Education" : "Add Education"}
          </DialogTitle>
          <DialogDescription>
            Add details about your educational background
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Degree" required><Input value={form.degree} onChange={(event) => setForm({ ...form, degree: event.target.value })} /></FormField>
            <FormField label="Institution" required><Input value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} /></FormField>
            <FormField label="Field of study"><Input value={form.fieldOfStudy} onChange={(event) => setForm({ ...form, fieldOfStudy: event.target.value })} /></FormField>
            <FormField label="Location"><Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></FormField>
            <FormField label="Start date"><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></FormField>
            <FormField label="End date"><Input type="date" value={form.endDate} disabled={form.isCurrent} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></FormField>
            <FormField label="GPA"><Input value={form.gpa} onChange={(event) => setForm({ ...form, gpa: event.target.value })} /></FormField>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox id="education-current" checked={form.isCurrent} onCheckedChange={(checked) => setForm({ ...form, isCurrent: Boolean(checked) })} />
                <label htmlFor="education-current" className="text-sm text-slate-300">Currently studying</label>
              </div>
            </div>
          </div>
          <FormField label="Achievements"><Textarea value={form.achievements} onChange={(event) => setForm({ ...form, achievements: event.target.value })} /></FormField>
          <DialogActions isSaving={isSaving} label={editing ? "Save changes" : "Add education"} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SkillDialog({ open, onOpenChange, editing, onSuccess }: any) {
  const [form, setForm] = useState(emptySkill());
  const addSkill = trpc.profile.addSkill.useMutation({
    onSuccess: () => {
      toast.success("Skill saved");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Unable to save skill"),
  });
  const updateSkill = trpc.profile.updateSkill.useMutation({
    onSuccess: () => {
      toast.success("Skill updated");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Unable to update skill"),
  });

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      skillName: editing.skillName || "",
      category: editing.category || "",
      proficiency: editing.proficiency || "intermediate",
      yearsOfExperience: editing.yearsOfExperience?.toString() || "",
    } : emptySkill());
  }, [editing, open]);

  const isSaving = addSkill.isPending || updateSkill.isPending;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.skillName.trim()) {
      toast.error("Skill name is required.");
      return;
    }
    const yearsOfExperience = form.yearsOfExperience.trim() ? Number(form.yearsOfExperience) : undefined;
    if (yearsOfExperience !== undefined && (!Number.isInteger(yearsOfExperience) || yearsOfExperience < 0 || yearsOfExperience > 80)) {
      toast.error("Years of experience must be a whole number between 0 and 80.");
      return;
    }
    const payload = {
      skillName: form.skillName.trim(),
      category: optionalText(form.category),
      proficiency: form.proficiency,
      yearsOfExperience,
    };
    if (editing) updateSkill.mutate({ id: editing.id, ...payload });
    else addSkill.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Skill
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Skill" : "Add Skill"}
          </DialogTitle>
          <DialogDescription>
            Add a technical or professional skill
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Skill" required><Input value={form.skillName} onChange={(event) => setForm({ ...form, skillName: event.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Technical, leadership, language" /></FormField>
            <FormField label="Proficiency">
              <select className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-white" value={form.proficiency} onChange={(event) => setForm({ ...form, proficiency: event.target.value as SkillProficiency })}>
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option>
              </select>
            </FormField>
          </div>
          <FormField label="Years of experience"><Input type="number" min="0" max="80" value={form.yearsOfExperience} onChange={(event) => setForm({ ...form, yearsOfExperience: event.target.value })} /></FormField>
          <DialogActions isSaving={isSaving} label={editing ? "Save changes" : "Add skill"} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({ open, onOpenChange, editing, onSuccess }: any) {
  const [form, setForm] = useState(emptyProject());
  const addProject = trpc.profile.addProject.useMutation({
    onSuccess: () => {
      toast.success("Project saved");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Unable to save project"),
  });
  const updateProject = trpc.profile.updateProject.useMutation({
    onSuccess: () => {
      toast.success("Project updated");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Unable to update project"),
  });

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      title: editing.title || "",
      description: editing.description || "",
      url: editing.url || "",
      technologies: editing.technologies || "",
      startDate: dateForInput(editing.startDate),
      endDate: dateForInput(editing.endDate),
    } : emptyProject());
  }, [editing, open]);

  const isSaving = addProject.isPending || updateProject.isPending;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Project title is required.");
      return;
    }
    const url = optionalText(form.url);
    if (url && !isHttpUrl(url)) {
      toast.error("Project URL must start with http:// or https://.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: optionalText(form.description),
      url,
      technologies: optionalText(form.technologies),
      startDate: optionalText(form.startDate),
      endDate: optionalText(form.endDate),
    };
    if (editing) updateProject.mutate({ id: editing.id, ...payload });
    else addProject.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Project" : "Add Project"}
          </DialogTitle>
          <DialogDescription>
            Showcase a portfolio project or side project
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Project title" required><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></FormField>
          <FormField label="Project URL"><Input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://..." /></FormField>
          <FormField label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField>
          <FormField label="Technologies"><Input value={form.technologies} onChange={(event) => setForm({ ...form, technologies: event.target.value })} placeholder="React, TypeScript, MySQL" /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start date"><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></FormField>
            <FormField label="End date"><Input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></FormField>
          </div>
          <DialogActions isSaving={isSaving} label={editing ? "Save changes" : "Add project"} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SkillProficiency = "beginner" | "intermediate" | "advanced" | "expert";

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-300">
      <span>{label}{required ? <span className="ml-1 text-red-300">*</span> : null}</span>
      {children}
    </label>
  );
}

function DialogActions({ isSaving, label, onCancel }: { isSaving: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
      <Button type="submit" className="bg-gradient-to-r from-cyan-500 to-blue-600" disabled={isSaving}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}

function emptyWorkExperience() {
  return { jobTitle: "", company: "", location: "", startDate: "", endDate: "", isCurrent: false, description: "", achievements: "", skills: "" };
}

function emptyEducation() {
  return { degree: "", fieldOfStudy: "", institution: "", location: "", startDate: "", endDate: "", isCurrent: false, gpa: "", achievements: "" };
}

function emptySkill(): { skillName: string; category: string; proficiency: SkillProficiency; yearsOfExperience: string } {
  return { skillName: "", category: "", proficiency: "intermediate", yearsOfExperience: "" };
}

function emptyProject() {
  return { title: "", description: "", url: "", technologies: "", startDate: "", endDate: "" };
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function dateForInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getResumeMimeType(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeTypeByExtension: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    rtf: "text/rtf",
  };
  if (extension && mimeTypeByExtension[extension]) return mimeTypeByExtension[extension];
  return file.type || null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read the selected file"));
        return;
      }
      resolve(result.split(",", 2)[1] || "");
    };
    reader.readAsDataURL(file);
  });
}

function WorkExperienceCard({ experience, onEdit, onDelete }: any) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-semibold">{experience.jobTitle}</h3>
          <p className="text-slate-400">{experience.company}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-2">
        {new Date(experience.startDate).toLocaleDateString()} - {experience.isCurrent ? "Present" : new Date(experience.endDate).toLocaleDateString()}
      </p>
      {experience.description && (
        <p className="text-slate-400 text-sm">{experience.description}</p>
      )}
    </div>
  );
}

function EducationCard({ education, onEdit, onDelete }: any) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-semibold">{education.degree}</h3>
          <p className="text-slate-400">{education.institution}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {education.fieldOfStudy && (
        <p className="text-slate-400 text-sm mb-1">{education.fieldOfStudy}</p>
      )}
      <p className="text-sm text-slate-500">
        {education.endDate ? new Date(education.endDate).getFullYear() : "In Progress"}
      </p>
    </div>
  );
}

function SkillBadge({ skill, onEdit, onDelete }: any) {
  const proficiencyColors = {
    beginner: "bg-slate-700 text-slate-300",
    intermediate: "bg-blue-900/30 text-blue-400 border-blue-500/30",
    advanced: "bg-purple-900/30 text-purple-400 border-purple-500/30",
    expert: "bg-cyan-900/30 text-cyan-400 border-cyan-500/30",
  };

  return (
    <div className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${proficiencyColors[skill.proficiency as keyof typeof proficiencyColors] || proficiencyColors.intermediate}`}>
      <span className="text-sm font-medium">{skill.skillName}</span>
      <div className="hidden group-hover:flex absolute -top-8 right-0 gap-1 bg-slate-800 border border-slate-700 rounded-md p-1">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function ProjectCard({ project, onEdit, onDelete }: any) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-semibold">{project.title}</h3>
          {project.url && (
            <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-sm hover:underline">
              View Project →
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {project.description && (
        <p className="text-slate-400 text-sm mb-2">{project.description}</p>
      )}
      {project.technologies && (
        <p className="text-slate-500 text-xs">Technologies: {project.technologies}</p>
      )}
    </div>
  );
}
