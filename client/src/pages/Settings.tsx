import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Bell, Shield, Zap, Globe, Clock, Mail, Settings as SettingsIcon, LogOut, User, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Settings() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  // Settings state
  const [autoApply, setAutoApply] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(true);
  const [instantAlerts, setInstantAlerts] = useState(false);
  const [scanFrequency, setScanFrequency] = useState("daily");
  const [maxApplicationsPerDay, setMaxApplicationsPerDay] = useState("10");
  const [preferredTimezone, setPreferredTimezone] = useState("UTC");

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

  const handleSaveSettings = () => {
    toast.success("Settings saved successfully!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-cyan-400 animate-pulse mx-auto mb-4" />
          <p className="text-slate-400">Loading settings...</p>
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
                  className="text-cyan-400 bg-cyan-500/10 focus:bg-cyan-500/20 focus:text-cyan-400 cursor-pointer"
                  onClick={() => setLocation("/settings")}
                >
                  <SettingsIcon className="mr-2 h-4 w-4" />
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your job search preferences and notifications</p>
        </div>

        <div className="space-y-6">
          {/* Auto-Apply Settings */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-400" />
                Auto-Apply Settings
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure how Hire.AI automatically applies to jobs on your behalf
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Enable Auto-Apply</Label>
                  <p className="text-sm text-slate-400">
                    Automatically apply to jobs that match your profile
                  </p>
                </div>
                <Switch
                  checked={autoApply}
                  onCheckedChange={setAutoApply}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Max Applications Per Day</Label>
                <Select value={maxApplicationsPerDay} onValueChange={setMaxApplicationsPerDay}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="5" className="text-white">5 applications</SelectItem>
                    <SelectItem value="10" className="text-white">10 applications</SelectItem>
                    <SelectItem value="20" className="text-white">20 applications</SelectItem>
                    <SelectItem value="50" className="text-white">50 applications</SelectItem>
                    <SelectItem value="unlimited" className="text-white">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Limit auto-applications to avoid spam detection
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Job Scanning Settings */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                Job Scanning
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure how often we scan for new job opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-white">Scan Frequency</Label>
                <Select value={scanFrequency} onValueChange={setScanFrequency}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="hourly" className="text-white">Every hour</SelectItem>
                    <SelectItem value="every4hours" className="text-white">Every 4 hours</SelectItem>
                    <SelectItem value="daily" className="text-white">Once daily</SelectItem>
                    <SelectItem value="weekly" className="text-white">Once weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Timezone</Label>
                <Select value={preferredTimezone} onValueChange={setPreferredTimezone}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="UTC" className="text-white">UTC</SelectItem>
                    <SelectItem value="America/New_York" className="text-white">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Los_Angeles" className="text-white">Pacific Time (PT)</SelectItem>
                    <SelectItem value="Europe/London" className="text-white">London (GMT)</SelectItem>
                    <SelectItem value="Europe/Paris" className="text-white">Central European (CET)</SelectItem>
                    <SelectItem value="Asia/Tokyo" className="text-white">Japan (JST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-purple-400" />
                Notifications
              </CardTitle>
              <CardDescription className="text-slate-400">
                Choose how you want to be notified about job updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Email Notifications</Label>
                  <p className="text-sm text-slate-400">
                    Receive updates via email
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Daily Digest</Label>
                  <p className="text-sm text-slate-400">
                    Get a summary of new matches every morning
                  </p>
                </div>
                <Switch
                  checked={dailyDigest}
                  onCheckedChange={setDailyDigest}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Instant Alerts</Label>
                  <p className="text-sm text-slate-400">
                    Get notified immediately for high-match jobs
                  </p>
                </div>
                <Switch
                  checked={instantAlerts}
                  onCheckedChange={setInstantAlerts}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-400" />
                Privacy & Security
              </CardTitle>
              <CardDescription className="text-slate-400">
                Manage your data and account security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">Export Your Data</p>
                  <p className="text-sm text-slate-400">Download all your data in JSON format</p>
                </div>
                <Button variant="outline" className="border-slate-700 text-slate-300">
                  Export
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div>
                  <p className="text-red-400 font-medium">Delete Account</p>
                  <p className="text-sm text-slate-400">Permanently delete your account and all data</p>
                </div>
                <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={() => setLocation("/dashboard")}
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-cyan-500 to-blue-600"
              onClick={handleSaveSettings}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
