import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Heart, TrendingUp, Briefcase, Send, Eye, Calendar, Target, Settings, LogOut, Search, FileText, Rocket, User, Bell, RefreshCw } from "lucide-react";
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

export default function Dashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Fetch real data from API
  const { data: applications, isLoading: appsLoading } = trpc.applications.list.useQuery();
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: jobs } = trpc.jobs.list.useQuery({ limit: 100 });

  // Calculate real stats
  const totalApplications = applications?.length || 0;
  const activeApplications = applications?.filter(a => 
    a.status === 'applied' || a.status === 'viewed' || a.status === 'interview'
  ).length || 0;
  const interviewInvites = applications?.filter(a => a.status === 'interview').length || 0;
  const offeredCount = applications?.filter(a => a.status === 'offer').length || 0;
  
  // Calculate rates
  const responseRate = totalApplications > 0 
    ? Math.round((applications?.filter(a => a.status !== 'applied').length || 0) / totalApplications * 100) 
    : 0;
  const interviewRate = totalApplications > 0 
    ? Math.round(interviewInvites / totalApplications * 100) 
    : 0;
  const offerRate = interviewInvites > 0 
    ? Math.round(offeredCount / interviewInvites * 100) 
    : 0;

  // Calculate health score
  const healthScore = Math.round((responseRate * 0.3 + interviewRate * 0.4 + offerRate * 0.3));

  // Check if user needs onboarding (no profile or resume)
  useEffect(() => {
    if (!loading && isAuthenticated && profile) {
      const hasProfile = profile.skills || profile.experience || profile.education;
      if (!hasProfile) {
        setShowOnboarding(true);
      }
    }
  }, [loading, isAuthenticated, profile]);

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

  const handleScanJobs = () => {
    toast.info("Job scan started! This may take a few minutes...");
    // In a real implementation, this would trigger the scraper
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-cyan-400 animate-pulse mx-auto mb-4" />
          <p className="text-slate-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isNewUser = totalApplications === 0 && !profile?.skills;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Onboarding Modal */}
      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Rocket className="h-6 w-6 text-cyan-400" />
              Welcome to Hire.AI!
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Let's get you set up to start receiving job matches automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Step 1: Upload Your Resume</h4>
                <p className="text-sm text-slate-400">Our AI will extract your skills and experience automatically.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Step 2: Set Your Preferences</h4>
                <p className="text-sm text-slate-400">Tell us what kind of jobs you're looking for.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Send className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Step 3: Relax & Get Hired</h4>
                <p className="text-sm text-slate-400">We'll find and apply to matching jobs automatically!</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300"
              onClick={() => setShowOnboarding(false)}
            >
              I'll do this later
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
              onClick={() => {
                setShowOnboarding(false);
                setLocation("/profile");
              }}
            >
              Get Started
              <Rocket className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              className="text-cyan-400 bg-cyan-500/10"
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
                  className="text-slate-300 focus:bg-slate-800 focus:text-white cursor-pointer"
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

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {user?.name?.split(' ')[0] || "Job Seeker"}!
            </h1>
            <p className="text-slate-400">
              {isNewUser 
                ? "Let's set up your profile to start finding your dream job"
                : "Here's your job search health overview"
              }
            </p>
          </div>
          <Button
            variant="outline"
            className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            onClick={handleScanJobs}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Scan for Jobs
          </Button>
        </div>

        {/* New User CTA */}
        {isNewUser && (
          <Card className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border-cyan-500/30 mb-8">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Rocket className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Complete Your Profile</h3>
                    <p className="text-slate-400">Upload your resume to start receiving personalized job matches</p>
                  </div>
                </div>
                <Button
                  className="bg-gradient-to-r from-cyan-500 to-blue-600"
                  onClick={() => setLocation("/profile")}
                >
                  Set Up Profile
                  <FileText className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Health Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Job Search Health
                </CardTitle>
                <Heart className="h-5 w-5 text-red-400 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {appsLoading ? "..." : `${healthScore || 0}%`}
              </div>
              <p className="text-xs text-slate-400">
                {healthScore > 50 ? (
                  <span className="text-green-400 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Looking healthy!
                  </span>
                ) : (
                  <span className="text-yellow-400">Complete your profile to improve</span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Active Applications
                </CardTitle>
                <Send className="h-5 w-5 text-cyan-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {appsLoading ? "..." : activeApplications}
              </div>
              <p className="text-xs text-slate-400">
                {totalApplications > 0 ? `${totalApplications} total sent` : "No applications yet"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Interview Invites
                </CardTitle>
                <Calendar className="h-5 w-5 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {appsLoading ? "..." : interviewInvites}
              </div>
              <p className="text-xs text-slate-400">
                {interviewInvites > 0 ? (
                  <span className="text-purple-400 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Great progress!
                  </span>
                ) : "Apply to get interviews"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Jobs Available
                </CardTitle>
                <Search className="h-5 w-5 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {jobs?.length || 0}
              </div>
              <p className="text-xs text-slate-400">
                Across 50+ platforms
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Vital Signs */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-400" />
                Job Search Vital Signs
              </CardTitle>
              <CardDescription className="text-slate-400">
                {totalApplications > 0 
                  ? "Real-time monitoring of your application performance"
                  : "Start applying to see your performance metrics"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Applications Sent</span>
                  <span className="text-cyan-400 font-semibold">{totalApplications}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(totalApplications * 2, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {totalApplications === 0 ? "Upload resume to start auto-applying" : "Keep applying to increase chances"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Response Rate</span>
                  <span className="text-green-400 font-semibold">{responseRate}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500" 
                    style={{ width: `${responseRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {responseRate > 50 ? "Above average employer engagement" : "Responses will come as you apply more"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Interview Conversion</span>
                  <span className="text-purple-400 font-semibold">{interviewRate}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" 
                    style={{ width: `${interviewRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {interviewRate > 30 ? "Strong interview invitation rate" : "Interviews will come with more applications"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Offer Rate</span>
                  <span className="text-yellow-400 font-semibold">{offerRate}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500" 
                    style={{ width: `${offerRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {offerRate > 20 ? "Good job offer conversion" : "Keep interviewing to get offers"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-400" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-slate-400">
                Latest updates on your job search
              </CardDescription>
            </CardHeader>
            <CardContent>
              {applications && applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.slice(0, 4).map((app, index) => (
                    <div key={app.id || index} className="flex items-start gap-3 pb-3 border-b border-slate-800/50 last:border-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        app.status === 'interview' ? 'bg-green-500/10' :
                        app.status === 'offer' ? 'bg-yellow-500/10' :
                        app.status === 'viewed' ? 'bg-blue-500/10' :
                        'bg-cyan-500/10'
                      }`}>
                        {app.status === 'interview' ? <Calendar className="h-4 w-4 text-green-400" /> :
                         app.status === 'offer' ? <Briefcase className="h-4 w-4 text-yellow-400" /> :
                         app.status === 'viewed' ? <Eye className="h-4 w-4 text-blue-400" /> :
                         <Send className="h-4 w-4 text-cyan-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium capitalize">{app.status}</p>
                        <p className="text-xs text-slate-400 truncate">Job ID: {app.jobId}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : 'Recently'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Briefcase className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 mb-2">No activity yet</p>
                  <p className="text-sm text-slate-500">Start applying to jobs to see your activity here</p>
                  <Button
                    variant="outline"
                    className="mt-4 border-slate-700 text-slate-300"
                    onClick={() => setLocation("/jobs")}
                  >
                    Browse Jobs
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-slate-900/50 border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-slate-400">
              Manage your job search efficiently
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-5 gap-4">
              <Button
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                onClick={() => setLocation("/jobs")}
              >
                <Search className="mr-2 h-4 w-4" />
                Browse Jobs
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setLocation("/applications")}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                My Applications
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setLocation("/profile")}
              >
                <User className="mr-2 h-4 w-4" />
                Update Profile
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setLocation("/settings")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setLocation("/alerts")}
              >
                <Bell className="mr-2 h-4 w-4" />
                Job Alerts
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
