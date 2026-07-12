import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { getApplicationDeepLink } from "@/lib/applicationDeepLinks";
import { getApprovalEvidenceGateSummary } from "@/lib/applicationEvidenceGates";
import {
  formatApplicationDecision,
  formatApprovalType,
  getApprovalDecisionNote,
  getOperatingReviewQueueCounts,
  getReviewQueueActionSummary,
  getReviewQueueControlSummary,
  getReviewDecisionResolutionCopy,
  getReviewRiskBadgeClass,
  type ReviewQueueActionKind,
  type ReviewQueueActionSummary,
  type ReviewDecisionResolution,
} from "@/lib/operatingReviewQueue";
import { toast } from "sonner";
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  DollarSign,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  Shield,
  User,
  XCircle,
} from "lucide-react";

export default function ReviewQueue() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const {
    data: operatingLedger,
    isLoading,
    refetch,
  } = trpc.applications.getOperatingLedger.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const {
    data: auditTrail,
    refetch: refetchAuditTrail,
  } = trpc.audit.getForUser.useQuery(
    { limit: 8 },
    { enabled: Boolean(user) }
  );
  const resolveApproval = trpc.applications.resolveApproval.useMutation({
    onSuccess: async (_, variables) => {
      toast.success(variables.status === "approved" ? "Approval recorded" : "Approval rejected");
      await Promise.all([refetch(), refetchAuditTrail()]);
    },
    onError: (error) => {
      toast.error(error.message || "Unable to resolve approval");
    },
  });
  const resolveDecision = trpc.applications.decide.useMutation({
    onSuccess: async (_, variables) => {
      toast.success(
        variables.decision === "save"
          ? "Job saved for later review"
          : "Job ignored from the queue"
      );
      await Promise.all([refetch(), refetchAuditTrail()]);
    },
    onError: (error) => {
      toast.error(error.message || "Unable to resolve job decision");
    },
  });
  const generateInterviewPreparation = trpc.applications.generateInterviewPreparation.useMutation({
    onSuccess: async (result) => {
      toast.success(result.existing ? "Interview preparation already exists" : "Interview preparation generated");
      await Promise.all([refetch(), refetchAuditTrail()]);
    },
    onError: (error) => {
      toast.error(error.message || "Unable to generate interview preparation");
    },
  });
  const markFollowUpSent = trpc.applications.markFollowUpSent.useMutation({
    onSuccess: async () => {
      toast.success("Follow-up send handoff recorded");
      await Promise.all([refetch(), refetchAuditTrail()]);
    },
    onError: (error) => {
      toast.error(error.message || "Unable to record follow-up send handoff");
    },
  });

  const counts = useMemo(
    () => getOperatingReviewQueueCounts(operatingLedger),
    [operatingLedger]
  );
  const queueControl = useMemo(
    () => getReviewQueueControlSummary(operatingLedger),
    [operatingLedger]
  );
  const canReviewAdminItems = operatingLedger?.canReviewAdminItems === true;
  const summaryItems = [
    ["Approvals", counts.pendingApprovals],
    ["Job decisions", counts.reviewDecisions],
    ["Interviews", counts.interviewScheduling],
    ["Interview prep", counts.interviewPreparationNeeded],
    ["Evidence gates", counts.evidenceGates],
    ["Connectors", counts.connectorReadiness],
    ["Employer replies", counts.employerResponsesNeedingReply],
    ["Follow-ups", counts.followUpsDue],
    ["Send handoffs", counts.approvedFollowUpsReadyToSend],
    ["Success fees", counts.successFeeCompliance],
    ["Profile blockers", counts.profileBlockers],
    ["Profile warnings", counts.profileWarnings],
    ...(canReviewAdminItems ? [["Admin reviews", counts.adminReviews]] : []),
  ];

  const handleResolveApproval = (
    approval: { id: number; approvalType?: string | null },
    status: "approved" | "rejected"
  ) => {
    resolveApproval.mutate({
      approvalId: approval.id,
      status,
      decisionNote: getApprovalDecisionNote(approval.approvalType, status),
    });
  };

  const handleResolveDecision = (
    decision: {
      jobId: number;
      decision?: string | null;
      decisionReason?: string | null;
      reviewReason?: string | null;
      matchScore?: number | null;
    },
    resolution: ReviewDecisionResolution
  ) => {
    resolveDecision.mutate({
      jobId: decision.jobId,
      decision: resolution,
      decisionReason: getReviewDecisionResolutionCopy(decision, resolution),
      matchScore: decision.matchScore ?? undefined,
      riskLevel: "low",
      reviewRequired: false,
    });
  };

  const getQueueAction = (kind: ReviewQueueActionKind, item: unknown) =>
    getReviewQueueActionSummary(kind, item as Record<string, unknown>);

  const scrollToQueueSection = (section: string) => {
    const target = document.getElementById(`review-queue-section-${section}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setLocation(queueControl.route);
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardCheck className="h-4 w-4" />
              Application operating ledger
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review Queue</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Resolve the decisions that should not run silently: external submissions, follow-ups,
              offer attribution, profile blockers{canReviewAdminItems ? ", and admin operating reviews." : "."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              <Shield className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="outline" onClick={() => setLocation("/applications")}>
              <Briefcase className="mr-2 h-4 w-4" />
              Application Ledger
            </Button>
          </div>
        </div>

        <Card data-testid="review-queue-control">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={getReviewRiskBadgeClass(queueControl.risk)}>
                    {queueControl.label}
                  </Badge>
                  <Badge variant="outline">
                    {queueControl.count} item{queueControl.count === 1 ? "" : "s"}
                  </Badge>
                  {queueControl.approvalGated && (
                    <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                      Approval gated
                    </Badge>
                  )}
                  {queueControl.externalAction === "manual_handoff" && (
                    <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                      Manual handoff
                    </Badge>
                  )}
                  {queueControl.externalAction === "blocked_until_evidence" && (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                      Evidence gated
                    </Badge>
                  )}
                </div>
                <h2 className="text-xl font-semibold tracking-tight">Review Queue Control</h2>
                <p className="mt-1 text-sm text-muted-foreground">{queueControl.headline}</p>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{queueControl.detail}</p>
              </div>
              <Button
                data-testid="review-queue-primary"
                className="lg:w-56"
                disabled={queueControl.status === "clear" && counts.total === 0}
                onClick={() => scrollToQueueSection(queueControl.section)}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                {queueControl.cta}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {summaryItems.map(([label, value]) => (
            <div key={label} className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        {counts.total === 0 ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              No review queue items need attention.
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <div className="space-y-6">
              <section id="review-queue-section-approvals" data-testid="review-queue-section-approvals" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">User Approval Gates</h2>
                  <Badge variant="outline">{counts.pendingApprovals}</Badge>
                </div>
                {operatingLedger?.queues.pendingApprovals.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.pendingApprovals.map((approval) => {
                      const evidenceGate = getApprovalEvidenceGateSummary(
                        approval,
                        operatingLedger.queues.evidenceGates
                      );
                      const evidenceBlocked = evidenceGate.count > 0;

                      return (
                      <Card key={approval.id}>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <CardTitle className="text-base">{approval.title}</CardTitle>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatApprovalType(approval.approvalType)}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={getReviewRiskBadgeClass(approval.riskLevel)}
                            >
                              {approval.riskLevel}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {approval.description && (
                            <p className="text-sm text-muted-foreground">{approval.description}</p>
                          )}
                          <QueueActionStrip
                            summary={getQueueAction("approval", approval)}
                            onOpen={setLocation}
                          />
                          {evidenceBlocked && (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
                              {evidenceGate.detail}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              data-testid="approval-approve"
                              data-approval-type={approval.approvalType}
                              disabled={resolveApproval.isPending || evidenceBlocked}
                              title={evidenceBlocked ? evidenceGate.detail : undefined}
                              onClick={() => handleResolveApproval(approval, "approved")}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid="approval-reject"
                              data-approval-type={approval.approvalType}
                              className="border-destructive/50 text-destructive"
                              disabled={resolveApproval.isPending}
                              onClick={() => handleResolveApproval(approval, "rejected")}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                            {evidenceBlocked && (
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`approval-resolve-evidence-${approval.id}`}
                                onClick={() => setLocation(evidenceGate.route)}
                              >
                                <User className="mr-2 h-4 w-4" />
                                Resolve Evidence
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyQueueLine label="No pending user approvals." />
                )}
              </section>

              <section id="review-queue-section-send-handoffs" data-testid="review-queue-section-send-handoffs" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Approved Send Handoffs</h2>
                  <Badge variant="outline">{counts.approvedFollowUpsReadyToSend}</Badge>
                </div>
                {operatingLedger?.queues.approvedFollowUpsReadyToSend.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.approvedFollowUpsReadyToSend.map((item) => (
                      <Card key={item.followUpId}>
                        <CardContent className="space-y-4 pt-6">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {item.job?.title || `Application #${item.applicationId}`}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.job?.company || "Employer"}
                                {item.job?.location ? ` - ${item.job.location}` : ""}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={getReviewRiskBadgeClass(item.riskLevel)}
                            >
                              {item.purpose === "employer_reply" ? "Employer reply" : "Follow-up"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            This draft has been approved. Send it through the intended external channel,
                            then mark it sent in the application ledger so Hire.AI can track responses.
                          </p>
                          {item.messagePreview && (
                            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                              {item.messagePreview}
                            </p>
                          )}
                          <QueueActionStrip
                            summary={getQueueAction("send_handoff", item)}
                            onOpen={setLocation}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              data-testid="mark-follow-up-sent"
                              disabled={markFollowUpSent.isPending}
                              onClick={() => markFollowUpSent.mutate({ followUpId: item.followUpId })}
                            >
                              {markFollowUpSent.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                              )}
                              Mark Sent
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(getApplicationDeepLink(item.applicationId, "send-follow-up"))}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Open Application
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No approved follow-up drafts are waiting for send handoff." />
                )}
              </section>

              <section id="review-queue-section-evidence-gates" data-testid="review-queue-section-evidence-gates" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Autonomous Evidence Gates</h2>
                  <Badge variant="outline">{counts.evidenceGates}</Badge>
                </div>
                {operatingLedger?.queues.evidenceGates.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.evidenceGates.map((item) => (
                      <Card key={item.id} data-testid={`review-evidence-gate-${item.id}`}>
                        <CardContent className="space-y-4 pt-6">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">{item.label}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {(item.blocks || []).map((block) => String(block).replace(/_/g, " ")).join(", ") || "External work"}
                                {typeof item.affectedApplications === "number"
                                  ? ` - ${item.affectedApplications} active application${item.affectedApplications === 1 ? "" : "s"}`
                                  : ""}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={getReviewRiskBadgeClass(item.severity)}
                            >
                              {item.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.detail}</p>
                          <QueueActionStrip
                            summary={getQueueAction("evidence_gate", item)}
                            onOpen={setLocation}
                          />
                          <Button variant="outline" size="sm" onClick={() => setLocation(item.route || "/profile")}>
                            <User className="mr-2 h-4 w-4" />
                            Resolve Evidence
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No autonomous evidence gates are blocking external work." />
                )}
              </section>

              <section id="review-queue-section-connector-readiness" data-testid="review-queue-section-connector-readiness" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Connector Readiness</h2>
                  <Badge variant="outline">{counts.connectorReadiness}</Badge>
                </div>
                {operatingLedger?.queues.connectorReadiness.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.connectorReadiness.map((item) => (
                      <Card key={item.id} data-testid={`review-connector-readiness-${item.id}`}>
                        <CardContent className="space-y-4 pt-6">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">{item.label}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.providerIds?.join(", ") || "Connector setup"}
                                {typeof item.affectedApplications === "number"
                                  ? ` - ${item.affectedApplications} active application${item.affectedApplications === 1 ? "" : "s"}`
                                  : ""}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={getReviewRiskBadgeClass(item.riskLevel)}
                            >
                              {String(item.status).replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.detail}</p>
                          <QueueActionStrip
                            summary={getQueueAction("connector_readiness", item)}
                            onOpen={setLocation}
                          />
                          <Button variant="outline" size="sm" onClick={() => setLocation("/profile")}>
                            <User className="mr-2 h-4 w-4" />
                            Open Profile Evidence
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No connector setup items need attention." />
                )}
              </section>

              <section id="review-queue-section-job-decisions" data-testid="review-queue-section-job-decisions" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Job Decisions</h2>
                  <Badge variant="outline">{counts.reviewDecisions}</Badge>
                </div>
                {operatingLedger?.queues.reviewDecisions.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.reviewDecisions.map((decision) => {
                      const actionSummary = getQueueAction("job_decision", decision);
                      const jobTitle = decision.job?.title || `Job #${decision.jobId}`;
                      const company = decision.job?.company ? ` at ${decision.job.company}` : "";

                      return (
                        <Card key={decision.id} data-testid="review-decision-card">
                          <CardContent className="space-y-4 pt-6">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-medium">{jobTitle}{company} needs review</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {formatApplicationDecision(decision.decision)}
                                  {decision.matchScore != null ? ` - ${decision.matchScore}% match` : ""}
                                  {decision.applicationId ? ` - Application #${decision.applicationId}` : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 sm:justify-end">
                                <Badge
                                  variant="outline"
                                  className={getReviewRiskBadgeClass(decision.riskLevel)}
                                >
                                  {decision.riskLevel}
                                </Badge>
                                {actionSummary.approvalGated && (
                                  <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                                    Review blocks execution
                                  </Badge>
                                )}
                                {actionSummary.externalAction === "manual_handoff" && (
                                  <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                                    Manual ATS handoff
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {decision.reviewReason || decision.decisionReason || "Review this decision before application execution."}
                            </p>
                            <QueueActionStrip
                              summary={actionSummary}
                              onOpen={setLocation}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                data-testid="review-decision-save"
                                disabled={resolveDecision.isPending}
                                onClick={() => handleResolveDecision(decision, "save")}
                              >
                                <Briefcase className="mr-2 h-4 w-4" />
                                Save for Later
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid="review-decision-ignore"
                                className="border-destructive/50 text-destructive"
                                disabled={resolveDecision.isPending}
                                onClick={() => handleResolveDecision(decision, "ignore")}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Ignore
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setLocation(actionSummary.route)}>
                                <Search className="mr-2 h-4 w-4" />
                                {actionSummary.cta}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyQueueLine label="No saved job decisions need review." />
                )}
              </section>

              <section id="review-queue-section-interview-scheduling" data-testid="review-queue-section-interview-scheduling" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Interview Scheduling</h2>
                  <Badge variant="outline">{counts.interviewScheduling}</Badge>
                </div>
                {operatingLedger?.queues.interviewScheduling.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.interviewScheduling.map((item) => (
                      <Card key={item.applicationId}>
                        <CardContent className="space-y-4 pt-6">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {item.job?.title || `Application #${item.applicationId}`}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.job?.company || "Employer"}
                                {item.job?.location ? ` - ${item.job.location}` : ""}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                              Interview invite
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            This employer response has moved to interview status, but no interview time, channel,
                            or interviewer context has been recorded yet.
                          </p>
                          <QueueActionStrip
                            summary={getQueueAction("interview_scheduling", item)}
                            onOpen={setLocation}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(getApplicationDeepLink(item.applicationId, "schedule-interview"))}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule in Ledger
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No interview invites need scheduling." />
                )}
              </section>

              <section id="review-queue-section-interview-preparation" data-testid="review-queue-section-interview-preparation" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Interview Preparation</h2>
                  <Badge variant="outline">{counts.interviewPreparationNeeded}</Badge>
                </div>
                {operatingLedger?.queues.interviewPreparationNeeded.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.interviewPreparationNeeded.map((item) => (
                      <Card key={item.interviewId}>
                        <CardContent className="space-y-4 pt-6">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {item.job?.title || `Application #${item.applicationId}`}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.job?.company || "Employer"}
                                {item.scheduledAt ? ` - ${new Date(item.scheduledAt).toLocaleString()}` : ""}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-violet-500/40 text-violet-300">
                              {String(item.interviewType || "interview").replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Generate saved preparation questions, coaching tips, and company context from the job ledger
                            before this scheduled interview.
                          </p>
                          <QueueActionStrip
                            summary={getQueueAction("interview_preparation", item)}
                            onOpen={setLocation}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={generateInterviewPreparation.isPending}
                              onClick={() => generateInterviewPreparation.mutate({ applicationId: item.applicationId })}
                            >
                              {generateInterviewPreparation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <ClipboardCheck className="mr-2 h-4 w-4" />
                              )}
                              Generate Prep
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(getApplicationDeepLink(item.applicationId, "view"))}
                            >
                              <Briefcase className="mr-2 h-4 w-4" />
                              Open Application
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No scheduled interviews need preparation." />
                )}
              </section>

              <section id="review-queue-section-employer-replies" data-testid="review-queue-section-employer-replies" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Employer Replies</h2>
                  <Badge variant="outline">{counts.employerResponsesNeedingReply}</Badge>
                </div>
                {operatingLedger?.queues.employerResponsesNeedingReply.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.employerResponsesNeedingReply.map((item) => (
                      <Card key={item.responseId}>
                        <CardContent className="space-y-4 pt-6">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {item.job?.title || `Application #${item.applicationId}`}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.job?.company || "Employer"}
                                {item.job?.location ? ` - ${item.job.location}` : ""}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                              {String(item.responseType || "response").replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.summary || "Review this employer response before drafting any follow-up."}
                          </p>
                          <QueueActionStrip
                            summary={getQueueAction("employer_reply", item)}
                            onOpen={setLocation}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(getApplicationDeepLink(item.applicationId, "employer-response"))}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Open Employer Response
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No employer questions need replies." />
                )}
              </section>

              <section id="review-queue-section-follow-ups" data-testid="review-queue-section-follow-ups" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Follow-up Drafting</h2>
                  <Badge variant="outline">{counts.followUpsDue}</Badge>
                </div>
                {operatingLedger?.queues.followUpsDue.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.followUpsDue.map((item) => (
                      <Card key={item.applicationId}>
                        <CardContent className="space-y-4 pt-6">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {item.job?.title || `Application #${item.applicationId}`}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.job?.company || "Employer"}
                                {item.job?.location ? ` - ${item.job.location}` : ""}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                              {String(item.messageType || "follow-up").replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.reason || "This application has been quiet long enough for a follow-up draft."}
                            {typeof item.daysSinceActivity === "number"
                              ? ` Last activity was ${item.daysSinceActivity} days ago.`
                              : ""}
                          </p>
                          <QueueActionStrip
                            summary={getQueueAction("follow_up", item)}
                            onOpen={setLocation}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(getApplicationDeepLink(item.applicationId, "follow-up"))}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Open Follow-up
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No follow-up drafts are due." />
                )}
              </section>

              <section id="review-queue-section-success-fees" data-testid="review-queue-section-success-fees" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Success-fee Compliance</h2>
                  <Badge variant="outline">{counts.successFeeCompliance}</Badge>
                </div>
                {operatingLedger?.queues.successFeeCompliance.length ? (
                  <div className="space-y-3">
                    {operatingLedger.queues.successFeeCompliance.map((item, index) => (
                      <Card key={`${item.type}-${item.successFeeId || item.approvalId || index}`}>
                        <CardContent className="space-y-4 pt-6">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {item.employerName || "Success-fee review"}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.jobTitle || item.action}
                                {item.nextVerificationDue
                                  ? ` - due ${new Date(item.nextVerificationDue).toLocaleDateString()}`
                                  : ""}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={getReviewRiskBadgeClass(item.priority)}
                            >
                              {String(item.type).replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.action}
                            {typeof item.daysUntilDue === "number"
                              ? ` ${item.daysUntilDue < 0
                                  ? `${Math.abs(item.daysUntilDue)} day${Math.abs(item.daysUntilDue) === 1 ? "" : "s"} overdue.`
                                  : `${item.daysUntilDue} day${item.daysUntilDue === 1 ? "" : "s"} remaining.`}`
                              : ""}
                          </p>
                          {item.responseSummary && (
                            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                              {item.responseSummary}
                            </p>
                          )}
                          <QueueActionStrip
                            summary={getQueueAction("success_fee", item)}
                            onOpen={setLocation}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (item.applicationId) {
                                setLocation(getApplicationDeepLink(item.applicationId, "view"));
                                return;
                              }
                              setLocation("/billing");
                            }}
                          >
                            <DollarSign className="mr-2 h-4 w-4" />
                            {item.type === "offer_attribution" ? "Open Offer Review" : "Open Billing"}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No success-fee compliance work needs review." />
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section id="review-queue-section-profile-readiness" data-testid="review-queue-section-profile-readiness" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Profile Readiness</h2>
                  <Badge variant="outline">
                    {counts.profileBlockers + counts.profileWarnings}
                  </Badge>
                </div>
                <div className="rounded-md border bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Readiness score</span>
                    <span className="font-medium">{operatingLedger?.readiness.score ?? 0}%</span>
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    {operatingLedger?.readiness.blockers.map((gap) => (
                      <ReadinessGap key={gap.key} tone="blocker" label={gap.label} text={gap.recommendation} />
                    ))}
                    {operatingLedger?.readiness.warnings.map((gap) => (
                      <ReadinessGap key={gap.key} tone="warning" label={gap.label} text={gap.recommendation} />
                    ))}
                    {!counts.profileBlockers && !counts.profileWarnings && (
                      <EmptyQueueLine label="Profile readiness has no open blockers or warnings." />
                    )}
                  </div>
                  {(counts.profileBlockers > 0 || counts.profileWarnings > 0) && (
                    <QueueActionStrip
                      summary={getQueueAction("profile_gap", {})}
                      onOpen={setLocation}
                      className="mt-4"
                    />
                  )}
                  {(counts.profileBlockers > 0 || counts.profileWarnings > 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => setLocation("/profile")}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Improve Profile
                    </Button>
                  )}
                </div>
              </section>

              {canReviewAdminItems && (
                <section id="review-queue-section-admin-reviews" data-testid="review-queue-section-admin-reviews" className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Admin Operating Reviews</h2>
                    <Badge variant="outline">{counts.adminReviews}</Badge>
                  </div>
                  {operatingLedger?.queues.adminReviews.length ? (
                    <div className="space-y-3">
                      {operatingLedger.queues.adminReviews.map((review) => (
                        <Card key={review.id}>
                          <CardContent className="space-y-4 pt-6">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{review.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{review.category}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={getReviewRiskBadgeClass(review.priority)}
                              >
                                {review.priority}
                              </Badge>
                            </div>
                            {review.description && (
                              <p className="text-sm text-muted-foreground">{review.description}</p>
                            )}
                            <QueueActionStrip
                              summary={getQueueAction("admin_review", review)}
                              onOpen={setLocation}
                            />
                            <Button variant="outline" size="sm" onClick={() => setLocation("/admin")}>
                              <Shield className="mr-2 h-4 w-4" />
                              Open Admin Panel
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <EmptyQueueLine label="No admin operating reviews are open for this account." />
                  )}
                </section>
              )}

              <section id="review-queue-section-audit" data-testid="review-queue-section-audit" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <History className="h-4 w-4" />
                    Recent Audit Trail
                  </h2>
                  <Badge variant="outline">{auditTrail?.length ?? 0}</Badge>
                </div>
                {auditTrail?.length ? (
                  <div className="space-y-3">
                    {auditTrail.map((event) => (
                      <Card key={event.id}>
                        <CardContent className="space-y-3 pt-6">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{formatAuditAction(event.action)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {event.entityType} #{event.entityId} - {event.actor}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={getReviewRiskBadgeClass(event.riskLevel)}
                            >
                              {event.riskLevel}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.createdAt).toLocaleString()}
                            {event.source ? ` - ${event.source}` : ""}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyQueueLine label="No audit events have been recorded for this account yet." />
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
function formatAuditAction(action: string) {
  return action
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function QueueActionStrip({
  summary,
  onOpen,
  className = "",
}: {
  summary: ReviewQueueActionSummary;
  onOpen: (route: string) => void;
  className?: string;
}) {
  const externalLabel = summary.externalAction === "manual_handoff"
    ? "Manual handoff"
    : summary.externalAction === "blocked_until_approved"
      ? "Blocked until approved"
      : "Internal";

  return (
    <div
      data-testid="review-queue-action"
      data-action-label={summary.label}
      className={`rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-cyan-200">{summary.label}</p>
            <Badge variant="outline" className={getReviewRiskBadgeClass(summary.risk)}>
              {summary.risk}
            </Badge>
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              {summary.approvalGated ? "Approval-gated" : externalLabel}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{summary.detail}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onOpen(summary.route)}
        >
          <ClipboardCheck className="mr-2 h-4 w-4" />
          {summary.cta}
        </Button>
      </div>
    </div>
  );
}

function EmptyQueueLine({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function ReadinessGap({
  tone,
  label,
  text,
}: {
  tone: "blocker" | "warning";
  label: string;
  text: string;
}) {
  const toneClass = tone === "blocker"
    ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
    : "border-slate-700 bg-background text-muted-foreground";

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-sm">{text}</p>
        </div>
      </div>
    </div>
  );
}
