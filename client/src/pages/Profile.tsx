import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, Upload, FileText, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Profile() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [resumeText, setResumeText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const parseResumeMutation = trpc.resume.parse.useMutation({
    onSuccess: () => {
      toast.success("Resume parsed successfully! Profile updated.");
      profileQuery.refetch();
      setIsParsing(false);
      setResumeText("");
    },
    onError: (error) => {
      toast.error("Failed to parse resume: " + error.message);
      setIsParsing(false);
    },
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith(".txt") && !file.type.includes("text")) {
      toast.error("Please upload a text file (.txt) for now. PDF/DOCX support coming soon!");
      return;
    }

    setIsUploading(true);
    try {
      const text = await file.text();
      setResumeText(text);
      toast.info("File loaded. Click 'Parse Resume' to extract information.");
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

  const profile = profileQuery.data;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
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
              className="text-slate-300 hover:text-white"
              onClick={() => setLocation("/profile")}
            >
              Profile
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Profile</h1>
          <p className="text-slate-400">
            Upload your resume to automatically populate your profile with AI
          </p>
        </div>

        <div className="space-y-6 max-w-4xl">
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
                  Upload Resume (Text file for now)
                </Label>
                <Input
                  id="resume"
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleResumeUpload}
                  disabled={isUploading || isParsing}
                  className="bg-slate-800/50 border-slate-700 text-white mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  PDF and DOCX support coming soon. For now, please convert your resume to a .txt file.
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

              {profile?.resumeUrl && (
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
                Your profile helps us match you with the best job opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">Skills</Label>
                <Textarea
                  value={profile?.skills || ""}
                  placeholder="Upload a resume to auto-populate..."
                  className="h-24 bg-slate-800/50 border-slate-700 text-slate-300 mt-2"
                  readOnly
                />
              </div>

              <div>
                <Label className="text-slate-300">Experience</Label>
                <Textarea
                  value={profile?.experience || ""}
                  placeholder="Upload a resume to auto-populate..."
                  className="h-32 bg-slate-800/50 border-slate-700 text-slate-300 mt-2"
                  readOnly
                />
              </div>

              <div>
                <Label className="text-slate-300">Education</Label>
                <Textarea
                  value={profile?.education || ""}
                  placeholder="Upload a resume to auto-populate..."
                  className="h-24 bg-slate-800/50 border-slate-700 text-slate-300 mt-2"
                  readOnly
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">LinkedIn URL</Label>
                  <Input
                    value={profile?.linkedinUrl || ""}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="bg-slate-800/50 border-slate-700 text-slate-300 mt-2"
                    readOnly
                  />
                </div>
                <div>
                  <Label className="text-slate-300">GitHub URL</Label>
                  <Input
                    value={profile?.githubUrl || ""}
                    placeholder="https://github.com/yourusername"
                    className="bg-slate-800/50 border-slate-700 text-slate-300 mt-2"
                    readOnly
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
