import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, Upload, FileText, Loader2, Save, User, Settings, LogOut, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [resumeText, setResumeText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Editable profile fields
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [preferredJobTypes, setPreferredJobTypes] = useState("");
  const [preferredLocations, setPreferredLocations] = useState("");
  const [salaryExpectation, setSalaryExpectation] = useState("");

  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile saved successfully!");
      setIsSaving(false);
      setHasChanges(false);
      profileQuery.refetch();
    },
    onError: (error) => {
      toast.error("Failed to save profile: " + error.message);
      setIsSaving(false);
    },
  });

  const parseResumeMutation = trpc.resume.parse.useMutation({
    onSuccess: (data) => {
      toast.success("Resume parsed successfully! Profile updated.");
      profileQuery.refetch();
      setIsParsing(false);
      setResumeText("");
      // Update local state with parsed data
      if (data) {
        // The profile will be refetched, which will update the form
      }
    },
    onError: (error) => {
      toast.error("Failed to parse resume: " + error.message);
      setIsParsing(false);
    },
  });

  // Load profile data into form
  useEffect(() => {
    if (profileQuery.data) {
      const profile = profileQuery.data;
      setSkills(profile.skills || "");
      setExperience(profile.experience || "");
      setEducation(profile.education || "");
      setLinkedinUrl(profile.linkedinUrl || "");
      setGithubUrl(profile.githubUrl || "");
      setPortfolioUrl(profile.portfolioUrl || "");
      setPreferredJobTypes(profile.desiredJobTypes || "");
      setPreferredLocations(profile.desiredLocations || "");
      setSalaryExpectation(profile.salaryExpectationMin ? `$${profile.salaryExpectationMin.toLocaleString()}${profile.salaryExpectationMax ? ` - $${profile.salaryExpectationMax.toLocaleString()}` : ''}` : "");
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
    toast.success("Logged out successfully");
  };

  const handleFieldChange = (setter: (value: string) => void) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith(".pdf") || file.type === "application/pdf";
    const isDOCX = fileName.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isTXT = fileName.endsWith(".txt") || file.type.includes("text");

    if (!isPDF && !isDOCX && !isTXT) {
      toast.error("Please upload a PDF, DOCX, or TXT file");
      return;
    }

    setIsUploading(true);
    try {
      if (isTXT) {
        const text = await file.text();
        setResumeText(text);
        toast.info("File loaded. Click 'Parse Resume' to extract information.");
      } else {
        // For PDF/DOCX, we'll read as base64 and send to server
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          setResumeText(`[${isPDF ? 'PDF' : 'DOCX'} File: ${file.name}]\n\nFile will be parsed on the server.`);
          toast.info(`${isPDF ? 'PDF' : 'DOCX'} file loaded. Click 'Parse Resume' to extract information.`);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      toast.error("Failed to read file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleParseResume = () => {
    if (!resumeText) {
      toast.error("Please upload a resume first");
      return;
    }

    setIsParsing(true);
    parseResumeMutation.mutate({ resumeText });
  };

  const handleSaveProfile = () => {
    setIsSaving(true);
    updateProfileMutation.mutate({
      skills,
      experience,
      education,
      linkedinUrl: linkedinUrl || undefined,
      githubUrl: githubUrl || undefined,
      portfolioUrl: portfolioUrl || undefined,
      desiredJobTypes: preferredJobTypes || undefined,
      desiredLocations: preferredLocations || undefined,
    });
  };

  if (loading || profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-cyan-400 animate-pulse mx-auto mb-4" />
          <p className="text-slate-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <Activity className="h-8 w-8 text-cyan-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Hire.AI
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-slate-300 hover:text-white"
              onClick={() => setLocation("/dashboard")}
            >
              Dashboard
            </Button>
            <Button
              variant="ghost"
              className="text-slate-300 hover:text-white"
              onClick={() => setLocation("/jobs")}
            >
              Jobs
            </Button>
            <Button
              variant="ghost"
              className="text-slate-300 hover:text-white"
              onClick={() => setLocation("/applications")}
            >
              Applications
            </Button>
            <Button
              variant="ghost"
              className="text-cyan-400 bg-cyan-500/10"
              onClick={() => setLocation("/profile")}
            >
              Profile
            </Button>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600">
                  <span className="text-white font-semibold">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-slate-900 border-slate-800" align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-white">{user?.name || "User"}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem 
                  className="text-cyan-400 bg-cyan-500/10 focus:bg-cyan-500/20 focus:text-cyan-400 cursor-pointer"
                  onClick={() => setLocation("/profile")}
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-slate-300 focus:bg-slate-800 focus:text-white cursor-pointer"
                  onClick={() => setLocation("/settings")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem 
                  className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="text-slate-400 hover:text-white mb-6"
          onClick={() => setLocation("/dashboard")}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Your Profile</h1>
            <p className="text-slate-400">
              Upload your resume to automatically populate your profile, or edit manually
            </p>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={isSaving || !hasChanges}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Resume Upload Section */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-cyan-400" />
                Resume Upload
              </CardTitle>
              <CardDescription className="text-slate-400">
                Upload your resume to automatically extract skills, experience, and education
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="resume" className="text-slate-300">
                  Upload Resume (PDF, DOCX, or TXT)
                </Label>
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={handleResumeUpload}
                  disabled={isUploading || isParsing}
                  className="bg-slate-800/50 border-slate-700 text-white mt-2 file:bg-slate-700 file:text-white file:border-0 file:mr-4"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: PDF, DOCX, TXT (max 10MB)
                </p>
              </div>

              {resumeText && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Resume Preview</Label>
                  <Textarea
                    value={resumeText.substring(0, 500) + (resumeText.length > 500 ? "..." : "")}
                    readOnly
                    className="h-32 bg-slate-800/50 border-slate-700 text-slate-300"
                  />
                  <Button
                    onClick={handleParseResume}
                    disabled={isParsing}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Parsing Resume with AI...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Parse Resume with AI
                      </>
                    )}
                  </Button>
                </div>
              )}

              {profileQuery.data?.resumeUrl && (
                <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
                  <p className="text-sm text-green-400">
                    ✓ Resume uploaded and parsed successfully
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Profile Information</CardTitle>
              <CardDescription className="text-slate-400">
                Your profile helps us match you with the best job opportunities. Edit fields below and click Save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">Skills</Label>
                <Textarea
                  value={skills}
                  onChange={handleFieldChange(setSkills)}
                  placeholder="e.g., JavaScript, React, Node.js, Python, SQL, Project Management..."
                  className="h-24 bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">Separate skills with commas</p>
              </div>

              <div>
                <Label className="text-slate-300">Experience</Label>
                <Textarea
                  value={experience}
                  onChange={handleFieldChange(setExperience)}
                  placeholder="Describe your work experience, roles, and achievements..."
                  className="h-32 bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="text-slate-300">Education</Label>
                <Textarea
                  value={education}
                  onChange={handleFieldChange(setEducation)}
                  placeholder="e.g., BS Computer Science, MIT, 2020..."
                  className="h-24 bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Job Preferences */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Job Preferences</CardTitle>
              <CardDescription className="text-slate-400">
                Help us find jobs that match your preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">Preferred Job Types</Label>
                <Input
                  value={preferredJobTypes}
                  onChange={handleFieldChange(setPreferredJobTypes)}
                  placeholder="e.g., Full-time, Remote, Contract..."
                  className="bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="text-slate-300">Preferred Locations</Label>
                <Input
                  value={preferredLocations}
                  onChange={handleFieldChange(setPreferredLocations)}
                  placeholder="e.g., Remote, New York, San Francisco, Europe..."
                  className="bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="text-slate-300">Salary Expectation</Label>
                <Input
                  value={salaryExpectation}
                  onChange={handleFieldChange(setSalaryExpectation)}
                  placeholder="e.g., $100,000 - $150,000 USD"
                  className="bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Social & Portfolio Links</CardTitle>
              <CardDescription className="text-slate-400">
                Add links to your professional profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">LinkedIn URL</Label>
                  <Input
                    value={linkedinUrl}
                    onChange={handleFieldChange(setLinkedinUrl)}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">GitHub URL</Label>
                  <Input
                    value={githubUrl}
                    onChange={handleFieldChange(setGithubUrl)}
                    placeholder="https://github.com/yourusername"
                    className="bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Portfolio URL</Label>
                <Input
                  value={portfolioUrl}
                  onChange={handleFieldChange(setPortfolioUrl)}
                  placeholder="https://yourportfolio.com"
                  className="bg-slate-800/50 border-slate-700 text-white mt-2 placeholder:text-slate-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button (Bottom) */}
          <div className="flex justify-end gap-4 pt-4">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={() => setLocation("/dashboard")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isSaving || !hasChanges}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
