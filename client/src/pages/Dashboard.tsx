import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Heart, TrendingUp, Briefcase, Send, Eye, Calendar, Target } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { getLoginUrl } from "@/const";

export default function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.name || "Job Seeker"}!
          </h1>
          <p className="text-slate-400">
            Here's your job search health overview
          </p>
        </div>

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
              <div className="text-3xl font-bold text-white mb-1">85%</div>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +5% from last week
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
              <div className="text-3xl font-bold text-white mb-1">24</div>
              <p className="text-xs text-slate-400">
                Across 50+ platforms
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
              <div className="text-3xl font-bold text-white mb-1">7</div>
              <p className="text-xs text-purple-400 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                3 this week
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Profile Views
                </CardTitle>
                <Eye className="h-5 w-5 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">142</div>
              <p className="text-xs text-blue-400 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +18 today
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
                Real-time monitoring of your application performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Application Rate</span>
                  <span className="text-cyan-400 font-semibold">92%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-[92%] bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                </div>
                <p className="text-xs text-slate-500">Excellent application submission rate</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Response Rate</span>
                  <span className="text-green-400 font-semibold">78%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-[78%] bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" />
                </div>
                <p className="text-xs text-slate-500">Above average employer engagement</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Interview Conversion</span>
                  <span className="text-purple-400 font-semibold">45%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-[45%] bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                </div>
                <p className="text-xs text-slate-500">Strong interview invitation rate</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Offer Rate</span>
                  <span className="text-yellow-400 font-semibold">29%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-[29%] bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full" />
                </div>
                <p className="text-xs text-slate-500">Good job offer conversion</p>
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
                Latest updates on your applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-800/50">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">Interview scheduled</p>
                    <p className="text-xs text-slate-400 truncate">Senior Developer at TechCorp</p>
                    <p className="text-xs text-slate-500 mt-1">2 hours ago</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-slate-800/50">
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Eye className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">Application viewed</p>
                    <p className="text-xs text-slate-400 truncate">Full Stack Engineer at StartupX</p>
                    <p className="text-xs text-slate-500 mt-1">5 hours ago</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-slate-800/50">
                  <div className="h-8 w-8 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <Send className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">Auto-applied to 3 jobs</p>
                    <p className="text-xs text-slate-400 truncate">Matching your profile criteria</p>
                    <p className="text-xs text-slate-500 mt-1">1 day ago</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">New job matches found</p>
                    <p className="text-xs text-slate-400 truncate">12 positions match your skills</p>
                    <p className="text-xs text-slate-500 mt-1">2 days ago</p>
                  </div>
                </div>
              </div>
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
            <div className="grid md:grid-cols-4 gap-4">
              <Button
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                onClick={() => setLocation("/jobs")}
              >
                <Target className="mr-2 h-4 w-4" />
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
                <Activity className="mr-2 h-4 w-4" />
                Update Profile
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
