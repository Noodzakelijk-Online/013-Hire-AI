import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bell,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Search,
  MapPin,
  DollarSign,
  Briefcase,
  Clock,
  Mail,
  CheckCircle,
} from "lucide-react";

export default function JobAlerts() {
  const { user, loading: authLoading } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  
  // Form state
  const [alertName, setAlertName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [jobTypes, setJobTypes] = useState<string[]>(["full-time"]);
  const [frequency, setFrequency] = useState("daily");

  // Fetch alerts
  const { data: alerts, isLoading, refetch } = trpc.alerts.list.useQuery();

  // Mutations
  const createMutation = trpc.alerts.create.useMutation({
    onSuccess: () => {
      toast.success("Job alert created!");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: () => {
      toast.error("Failed to create alert");
    },
  });

  const deleteMutation = trpc.alerts.delete.useMutation({
    onSuccess: () => {
      toast.success("Alert deleted");
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete alert");
    },
  });

  const toggleMutation = trpc.alerts.toggle.useMutation({
    onSuccess: () => {
      toast.success("Alert updated");
      refetch();
    },
    onError: () => {
      toast.error("Failed to update alert");
    },
  });

  const resetForm = () => {
    setAlertName("");
    setKeywords("");
    setLocation("");
    setMinSalary("");
    setJobTypes(["full-time"]);
    setFrequency("daily");
    setEditingAlert(null);
  };

  const handleCreate = () => {
    if (!alertName || !keywords) {
      toast.error("Please fill in required fields");
      return;
    }

    createMutation.mutate({
      name: alertName,
      keywords,
      locations: location || undefined,
      minSalary: minSalary ? parseInt(minSalary) : undefined,
      jobTypes: jobTypes.join(","),
      frequency: frequency as "instant" | "daily" | "weekly",
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this alert?")) {
      deleteMutation.mutate({ alertId: id });
    }
  };

  const handleToggle = (id: number, isActive: boolean) => {
    toggleMutation.mutate({ alertId: id, isActive: !isActive });
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "instant": return "Instant";
      case "daily": return "Daily";
      case "weekly": return "Weekly";
      default: return freq;
    }
  };

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
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="h-6 w-6 text-cyan-400" />
              Job Alerts
            </h1>
            <p className="text-slate-400">Get notified when jobs matching your criteria are posted</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Create Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Job Alert</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Set up criteria to receive notifications for matching jobs
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Alert Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Senior React Developer"
                    value={alertName}
                    onChange={(e) => setAlertName(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords *</Label>
                  <Input
                    id="keywords"
                    placeholder="e.g., React, TypeScript, Node.js"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                  <p className="text-xs text-slate-500">Separate multiple keywords with commas</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location (optional)</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Remote, US, Europe"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salary">Minimum Salary (optional)</Label>
                  <Input
                    id="salary"
                    type="number"
                    placeholder="e.g., 100000"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Job Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {["full-time", "part-time", "contract", "temporary"].map((type) => (
                      <Badge
                        key={type}
                        variant={jobTypes.includes(type) ? "default" : "outline"}
                        className={`cursor-pointer ${
                          jobTypes.includes(type)
                            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                            : "border-slate-600 text-slate-400 hover:border-slate-500"
                        }`}
                        onClick={() => {
                          if (jobTypes.includes(type)) {
                            setJobTypes(jobTypes.filter((t) => t !== type));
                          } else {
                            setJobTypes([...jobTypes, type]);
                          }
                        }}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Notification Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="instant">Instant (as jobs are posted)</SelectItem>
                      <SelectItem value="daily">Daily digest</SelectItem>
                      <SelectItem value="weekly">Weekly summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-cyan-500 to-blue-600"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Create Alert
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="grid gap-4">
            {alerts.map((alert: any) => (
              <Card key={alert.id} className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white">{alert.name}</h3>
                        <Badge
                          variant="outline"
                          className={alert.isActive 
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                          }
                        >
                          {alert.isActive ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                          <Clock className="w-3 h-3 mr-1" />
                          {getFrequencyLabel(alert.frequency)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          {alert.keywords}
                        </span>
                        {alert.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {alert.location}
                          </span>
                        )}
                        {alert.minSalary && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${(alert.minSalary / 1000).toFixed(0)}k+
                          </span>
                        )}
                        {alert.jobTypes && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {alert.jobTypes}
                          </span>
                        )}
                      </div>

                      {alert.lastTriggered && (
                        <p className="text-xs text-slate-500 mt-2">
                          Last triggered: {new Date(alert.lastTriggered).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.isActive}
                        onCheckedChange={() => handleToggle(alert.id, alert.isActive)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDelete(alert.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Bell className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No job alerts yet</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Create your first job alert to get notified when new jobs matching your criteria are posted.
              </p>
              <Button
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Alert
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tips Card */}
        <Card className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Mail className="h-5 w-5 text-cyan-400" />
              Pro Tips for Job Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-2">
            <p>• Use specific keywords to get more relevant matches</p>
            <p>• Set up multiple alerts for different job types or locations</p>
            <p>• Choose "Instant" frequency for competitive roles to apply early</p>
            <p>• Review and update your alerts regularly as your preferences change</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
