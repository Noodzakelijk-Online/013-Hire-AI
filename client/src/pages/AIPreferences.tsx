import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Zap, 
  Globe, 
  Activity, 
  TrendingUp,
  Send,
  Eye,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";

export default function AIPreferences() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  // AI Settings State
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true);
  const [maxApplicationsPerDay, setMaxApplicationsPerDay] = useState("10");
  const [scanFrequency, setScanFrequency] = useState("daily");
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const handleSaveSettings = () => {
    toast.success("AI preferences saved successfully!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <AppHeader currentPage="ai-preferences" />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AppHeader currentPage="ai-preferences" />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AI Preferences</h1>
          <p className="text-slate-400">
            Configure how Hire.AI automatically finds and applies to jobs on your behalf
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Auto-Apply Settings */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  Auto-Apply Settings
                </CardTitle>
                <CardDescription>
                  Configure how Hire.AI automatically applies to jobs on your behalf
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-apply" className="text-white">
                      Enable Auto-Apply
                    </Label>
                    <p className="text-sm text-slate-400">
                      Automatically apply to jobs that match your profile
                    </p>
                  </div>
                  <Switch
                    id="auto-apply"
                    checked={autoApplyEnabled}
                    onCheckedChange={setAutoApplyEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-apps" className="text-white">
                    Max Applications Per Day
                  </Label>
                  <Select value={maxApplicationsPerDay} onValueChange={setMaxApplicationsPerDay}>
                    <SelectTrigger id="max-apps" className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="5">5 applications</SelectItem>
                      <SelectItem value="10">10 applications</SelectItem>
                      <SelectItem value="20">20 applications</SelectItem>
                      <SelectItem value="50">50 applications</SelectItem>
                      <SelectItem value="100">100 applications</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Limit auto-applications to avoid spam detection
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Job Scanning Settings */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Job Scanning
                </CardTitle>
                <CardDescription>
                  Configure how often we scan for new job opportunities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="scan-freq" className="text-white">
                    Scan Frequency
                  </Label>
                  <Select value={scanFrequency} onValueChange={setScanFrequency}>
                    <SelectTrigger id="scan-freq" className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="continuous">Continuous (Real-time)</SelectItem>
                      <SelectItem value="hourly">Every Hour</SelectItem>
                      <SelectItem value="daily">Once Daily</SelectItem>
                      <SelectItem value="twice-daily">Twice Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-white">
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone" className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* AI Activity Log */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  AI Activity Log
                </CardTitle>
                <CardDescription>
                  Recent actions taken by Hire.AI on your behalf
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <ActivityLogItem
                    icon={<Send className="w-4 h-4 text-cyan-400" />}
                    action="Applied to Senior Software Engineer at TechCorp"
                    time="2 hours ago"
                    status="success"
                  />
                  <ActivityLogItem
                    icon={<Eye className="w-4 h-4 text-blue-400" />}
                    action="Scanned 47 new jobs across 50+ platforms"
                    time="3 hours ago"
                    status="info"
                  />
                  <ActivityLogItem
                    icon={<Send className="w-4 h-4 text-cyan-400" />}
                    action="Applied to Full Stack Developer at StartupXYZ"
                    time="5 hours ago"
                    status="success"
                  />
                  <ActivityLogItem
                    icon={<XCircle className="w-4 h-4 text-slate-400" />}
                    action="Skipped Backend Engineer at LowPay Inc (salary below minimum)"
                    time="6 hours ago"
                    status="skipped"
                  />
                  <ActivityLogItem
                    icon={<Send className="w-4 h-4 text-cyan-400" />}
                    action="Applied to Remote React Developer at CloudCo"
                    time="8 hours ago"
                    status="success"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSaveSettings}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              Save AI Preferences
            </Button>
          </div>

          {/* Right Column - Metrics */}
          <div className="space-y-6">
            {/* AI Performance Metrics */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  AI Performance
                </CardTitle>
                <CardDescription>
                  Track how effectively the AI is working for you
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricCard
                  label="Jobs Scanned Today"
                  value="47"
                  icon={<Eye className="w-5 h-5 text-blue-400" />}
                  trend="+12 from yesterday"
                />
                <MetricCard
                  label="Applications Sent Today"
                  value="3"
                  icon={<Send className="w-5 h-5 text-cyan-400" />}
                  trend="7 remaining today"
                />
                <MetricCard
                  label="Response Rate"
                  value="0%"
                  icon={<MessageSquare className="w-5 h-5 text-purple-400" />}
                  trend="Start applying to see rate"
                />
                <MetricCard
                  label="Interview Conversion"
                  value="0%"
                  icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  trend="Interviews from applications"
                />
              </CardContent>
            </Card>

            {/* AI Status */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">AI Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Auto-Apply</span>
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Job Scanning</span>
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                    Running
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Next Scan</span>
                  <span className="text-white text-sm">
                    <Clock className="w-4 h-4 inline mr-1" />
                    in 4 hours
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start border-slate-700 text-white hover:bg-slate-800">
                  <Activity className="w-4 h-4 mr-2" />
                  Scan for Jobs Now
                </Button>
                <Button variant="outline" className="w-full justify-start border-slate-700 text-white hover:bg-slate-800">
                  <XCircle className="w-4 h-4 mr-2" />
                  Pause AI for 24h
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityLogItem({ icon, action, time, status }: any) {
  const statusColors: Record<string, string> = {
    success: "border-l-cyan-500",
    info: "border-l-blue-500",
    skipped: "border-l-slate-600",
    error: "border-l-red-500",
  };

  return (
    <div className={`border-l-2 ${statusColors[status]} pl-4 py-2`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1">
          <p className="text-white text-sm">{action}</p>
          <p className="text-slate-500 text-xs mt-1">{time}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, trend }: any) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-slate-500">{trend}</p>
    </div>
  );
}
