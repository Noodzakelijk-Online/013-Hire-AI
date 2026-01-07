import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { getLoginUrl } from "@/const";

export default function Applications() {
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
          <p className="text-slate-400">Loading applications...</p>
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Applications</h1>
          <p className="text-slate-400">
            Track all your job applications in one place
          </p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">Coming Soon</CardTitle>
            <CardDescription className="text-slate-400">
              Application tracking functionality will be available soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">
              This feature is currently under development. You'll be able to track all your applications and their statuses here.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
