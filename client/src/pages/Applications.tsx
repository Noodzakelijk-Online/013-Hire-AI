import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Send,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Calendar,
  Building2,
  MapPin,
  DollarSign,
  FileText,
  ExternalLink,
  Loader2,
  RefreshCw,
  TrendingUp,
  Target,
  AlertCircle,
  Mail,
  User,
} from "lucide-react";

type ApplicationStatus = "pending" | "submitted" | "viewed" | "interviewing" | "offered" | "rejected" | "withdrawn";

export default function Applications() {
  const { user, loading: authLoading } = useAuth();
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch applications
  const { data: applications, isLoading, refetch } = trpc.applications.list.useQuery();

  // Update status mutation (for withdraw)
  const updateStatusMutation = trpc.applications.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Application updated");
      refetch();
    },
    onError: () => {
      toast.error("Failed to update application");
    },
  });

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case "pending":
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      case "submitted":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "viewed":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "interviewing":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "offered":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "rejected":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "withdrawn":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getStatusIcon = (status: ApplicationStatus) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "submitted":
        return <Send className="w-4 h-4" />;
      case "viewed":
        return <Target className="w-4 h-4" />;
      case "interviewing":
        return <MessageSquare className="w-4 h-4" />;
      case "offered":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <XCircle className="w-4 h-4" />;
      case "withdrawn":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return "Not specified";
    if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
    if (min) return `$${(min / 1000).toFixed(0)}k+`;
    if (max) return `Up to $${(max / 1000).toFixed(0)}k`;
    return "Not specified";
  };

  // Group applications by status
  const groupedApplications = {
    all: applications || [],
    active: (applications || []).filter((a: any) => 
      ["pending", "submitted", "viewed", "interviewing"].includes(a.status)
    ),
    interviewing: (applications || []).filter((a: any) => a.status === "interviewing"),
    offered: (applications || []).filter((a: any) => a.status === "offered"),
    closed: (applications || []).filter((a: any) => 
      ["rejected", "withdrawn"].includes(a.status)
    ),
  };

  // Calculate stats
  const stats = {
    total: applications?.length || 0,
    active: groupedApplications.active.length,
    responseRate: applications?.length 
      ? Math.round((applications.filter((a: any) => a.status !== "pending" && a.status !== "submitted").length / applications.length) * 100)
      : 0,
    interviewRate: applications?.length
      ? Math.round((applications.filter((a: any) => ["interviewing", "offered"].includes(a.status)).length / applications.length) * 100)
      : 0,
  };

  const ApplicationCard = ({ application }: { application: any }) => (
    <Card
      className="group hover:border-cyan-500/50 transition-all duration-300 cursor-pointer bg-slate-900/50 border-slate-700/50"
      onClick={() => setSelectedApplication(application)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white truncate">
                {application.job?.title || "Job Title"}
              </h3>
              <Badge variant="outline" className={getStatusColor(application.status)}>
                {getStatusIcon(application.status)}
                <span className="ml-1 capitalize">{application.status}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400 mb-2">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {application.job?.company || "Company"}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {application.job?.location || "Remote"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3 h-3" />
              Applied {new Date(application.appliedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <AppHeader currentPage="applications" />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AppHeader currentPage="applications" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Applications</h1>
            <p className="text-slate-400">Track and manage your job applications</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Applications</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <Send className="w-8 h-8 text-cyan-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active</p>
                  <p className="text-2xl font-bold text-white">{stats.active}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Response Rate</p>
                  <p className="text-2xl font-bold text-white">{stats.responseRate}%</p>
                </div>
                <Target className="w-8 h-8 text-purple-500/50" />
              </div>
              <Progress value={stats.responseRate} className="mt-2 h-1" />
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Interview Rate</p>
                  <p className="text-2xl font-bold text-white">{stats.interviewRate}%</p>
                </div>
                <MessageSquare className="w-8 h-8 text-amber-500/50" />
              </div>
              <Progress value={stats.interviewRate} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </div>

        {/* Application Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">
              All ({groupedApplications.all.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-blue-900/50">
              Active ({groupedApplications.active.length})
            </TabsTrigger>
            <TabsTrigger value="interviewing" className="data-[state=active]:bg-amber-900/50">
              Interviewing ({groupedApplications.interviewing.length})
            </TabsTrigger>
            <TabsTrigger value="offered" className="data-[state=active]:bg-emerald-900/50">
              Offered ({groupedApplications.offered.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="data-[state=active]:bg-slate-700">
              Closed ({groupedApplications.closed.length})
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : (
              <>
                {["all", "active", "interviewing", "offered", "closed"].map((tab) => (
                  <TabsContent key={tab} value={tab} className="mt-0">
                    <div className="grid gap-3">
                      {groupedApplications[tab as keyof typeof groupedApplications].map((app: any) => (
                        <ApplicationCard key={app.id} application={app} />
                      ))}
                      {groupedApplications[tab as keyof typeof groupedApplications].length === 0 && (
                        <div className="text-center py-16 px-4">
                          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                            <FileText className="w-10 h-10 text-cyan-400" />
                          </div>
                          {tab === 'all' ? (
                            <>
                              <h3 className="text-xl font-semibold text-white mb-2">No applications yet</h3>
                              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                                Start your job search journey! Browse available positions and let our AI help you find the perfect match.
                              </p>
                              <Button 
                                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                                onClick={() => window.location.href = '/jobs'}
                              >
                                Browse Jobs
                              </Button>
                            </>
                          ) : tab === 'interviewing' ? (
                            <>
                              <h3 className="text-xl font-semibold text-white mb-2">No interviews scheduled</h3>
                              <p className="text-slate-400 max-w-md mx-auto">
                                Keep applying! Interview invitations will appear here once employers respond to your applications.
                              </p>
                            </>
                          ) : tab === 'offered' ? (
                            <>
                              <h3 className="text-xl font-semibold text-white mb-2">No offers yet</h3>
                              <p className="text-slate-400 max-w-md mx-auto">
                                Job offers will appear here. Keep interviewing and stay positive!
                              </p>
                            </>
                          ) : (
                            <>
                              <h3 className="text-xl font-semibold text-white mb-2">No applications in this category</h3>
                              <p className="text-slate-400 max-w-md mx-auto">
                                Applications matching this filter will appear here.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </>
            )}
          </div>
        </Tabs>

        {/* Application Detail Dialog */}
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-slate-900 border-slate-700">
            {selectedApplication && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl text-white">
                    {selectedApplication.job?.title || "Application Details"}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-4 text-slate-400">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {selectedApplication.job?.company || "Company"}
                    </span>
                    <Badge variant="outline" className={getStatusColor(selectedApplication.status)}>
                      {getStatusIcon(selectedApplication.status)}
                      <span className="ml-1 capitalize">{selectedApplication.status}</span>
                    </Badge>
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-slate-800">
                        <Calendar className="w-3 h-3 mr-1" />
                        Applied {new Date(selectedApplication.appliedAt).toLocaleDateString()}
                      </Badge>
                      {selectedApplication.job?.salaryMin && (
                        <Badge variant="secondary" className="bg-slate-800">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {formatSalary(selectedApplication.job.salaryMin, selectedApplication.job.salaryMax)}
                        </Badge>
                      )}
                    </div>

                    {selectedApplication.coverLetter && (
                      <>
                        <Separator className="bg-slate-700" />
                        <div>
                          <h4 className="text-sm font-medium text-slate-300 mb-2">Cover Letter</h4>
                          <p className="text-sm text-slate-400 whitespace-pre-wrap bg-slate-800/50 p-3 rounded-md">
                            {selectedApplication.coverLetter}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>

                <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateStatusMutation.mutate({ applicationId: selectedApplication.id, status: "withdrawn" });
                      setSelectedApplication(null);
                    }}
                    disabled={updateStatusMutation.isPending || ["withdrawn", "rejected", "offered"].includes(selectedApplication.status)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Withdraw
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Mail className="w-4 h-4 mr-1" />
                      Follow Up
                    </Button>
                    <Button
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                      size="sm"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      View Job
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
