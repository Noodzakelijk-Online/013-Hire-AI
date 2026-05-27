import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportHireDialog } from "@/components/ReportHireDialog";
import { toast } from "sonner";
import {
  DollarSign, FileText, CheckCircle, Clock, AlertTriangle,
  XCircle, Upload, ExternalLink, RefreshCw, Briefcase, Calendar
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending_verification: { label: "Pending Verification", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    active: { label: "Active", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    paused: { label: "Paused", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    ended: { label: "Ended", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    suspended: { label: "Suspended", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    disputed: { label: "Disputed", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-400" };
  return <Badge className={`text-xs border ${cfg.className}`}>{cfg.label}</Badge>;
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: "Paid", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    pending: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    failed: { label: "Failed", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    refunded: { label: "Refunded", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-400" };
  return <Badge className={`text-xs border ${cfg.className}`}>{cfg.label}</Badge>;
}

interface VerificationUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  successFeeId: number;
  onSuccess: () => void;
}

function VerificationUploadDialog({ open, onOpenChange, successFeeId, onSuccess }: VerificationUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [documentType, setDocumentType] = useState<"paystub" | "employment_letter" | "bank_statement" | "other">("paystub");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitVerification = trpc.successFees.submitVerification.useMutation({
    onSuccess: () => {
      toast.success("Verification document submitted successfully!");
      onSuccess();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message || "Failed to submit verification"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setFileBase64((ev.target?.result as string).split(",")[1]);
    reader.readAsDataURL(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0d1117] border-[#21262d] text-white">
        <DialogHeader>
          <DialogTitle>Submit Verification Document</DialogTitle>
          <DialogDescription className="text-gray-400">
            Upload proof of continued employment (paystub, employment letter, or bank statement).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-gray-300">Document Type</Label>
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as typeof documentType)}>
              <SelectTrigger className="bg-[#161b22] border-[#30363d] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#161b22] border-[#30363d]">
                <SelectItem value="paystub">Paystub</SelectItem>
                <SelectItem value="employment_letter">Employment Letter</SelectItem>
                <SelectItem value="bank_statement">Bank Statement</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="border-2 border-dashed border-[#30363d] rounded-lg p-4 text-center cursor-pointer hover:border-cyan-500/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">{file.name}</span>
              </div>
            ) : (
              <div className="text-gray-500">
                <Upload className="w-6 h-6 mx-auto mb-1" />
                <p className="text-sm">Click to upload PDF or image</p>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} className="hidden" />

          <Button
            onClick={() => submitVerification.mutate({ successFeeId, documentBase64: fileBase64, documentType, documentFileName: file?.name ?? "document.pdf", documentMimeType: file?.type ?? "application/pdf" })}
            disabled={!file || submitVerification.isPending}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
          >
            {submitVerification.isPending ? "Uploading..." : "Submit Verification"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Billing() {
  const { user, loading: authLoading } = useAuth();
  const [reportHireOpen, setReportHireOpen] = useState(false);
  const [verifyDialogFeeId, setVerifyDialogFeeId] = useState<number | null>(null);

  const { data: fees = [], refetch: refetchFees } = trpc.successFees.getMyFees.useQuery();
  const { data: payments = [] } = trpc.successFees.getPaymentHistory.useQuery();

  const reportEmploymentEnded = trpc.successFees.reportEmploymentEnded.useMutation({
    onSuccess: () => {
      toast.success("Employment end reported. Your subscription has been cancelled.");
      refetchFees();
    },
    onError: (err) => toast.error(err.message || "Failed to report employment end"),
  });

  const getBillingPortal = trpc.successFees.getBillingPortalUrl.useMutation({
    onSuccess: (data) => window.open(data.url, "_blank"),
    onError: (err) => toast.error(err.message || "Could not open billing portal"),
  });

  const activeFees = fees.filter(f => ["active", "pending_verification"].includes(f.status));
  const totalMonthlyFees = activeFees.reduce((sum, f) => sum + f.monthlyFeeAmount, 0);
  const totalPaid = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-white">
        <p>Please sign in to view billing.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Billing & Success Fees</h1>
            <p className="text-gray-400 mt-1">Manage your success fee arrangements and payment history</p>
          </div>
          <div className="flex gap-2">
            {fees.some(f => f.stripeSubscriptionId) && (
              <Button
                variant="outline"
                onClick={() => getBillingPortal.mutate()}
                disabled={getBillingPortal.isPending}
                className="border-[#30363d] text-gray-300 hover:bg-[#21262d] gap-1.5"
              >
                <ExternalLink className="w-4 h-4" /> Billing Portal
              </Button>
            )}
            <Button
              onClick={() => setReportHireOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold gap-1.5"
            >
              🎉 Report a Hire
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#161b22] border-[#21262d]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-400 text-sm">Active Fees</span>
              </div>
              <p className="text-2xl font-bold text-white">{activeFees.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#161b22] border-[#21262d]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-400 text-sm">Monthly Fees</span>
              </div>
              <p className="text-2xl font-bold text-white">${(totalMonthlyFees / 100).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#161b22] border-[#21262d]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-gray-400 text-sm">Total Paid</span>
              </div>
              <p className="text-2xl font-bold text-white">${(totalPaid / 100).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="bg-[#161b22] border-[#21262d] mb-6">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-cyan-400 mb-2">How Hire.AI Success Fees Work</p>
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
              <div className="flex flex-col gap-1">
                <span className="text-white font-medium">1. Free to Use</span>
                <span>Use Hire.AI to automate your job search at no upfront cost.</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-white font-medium">2. Land a Job</span>
                <span>Report your hire and upload your offer letter. We verify and set up a 5% monthly fee.</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-white font-medium">3. Ongoing Fee</span>
                <span>Pay 5% of your monthly salary while employed. Verify every 90 days. Stop when you leave.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Success Fees */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Success Fee Arrangements</h2>
          {fees.length === 0 ? (
            <Card className="bg-[#161b22] border-[#21262d]">
              <CardContent className="p-8 text-center">
                <Briefcase className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No success fees yet</p>
                <p className="text-gray-500 text-sm mt-1">When you land a job through Hire.AI, report it here to set up your success fee arrangement.</p>
                <Button
                  onClick={() => setReportHireOpen(true)}
                  className="mt-4 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
                >
                  🎉 I Got Hired!
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {fees.map(fee => {
                const isVerificationDue = fee.nextVerificationDue && new Date(fee.nextVerificationDue) < new Date();
                const daysUntilVerification = fee.nextVerificationDue
                  ? Math.ceil((new Date(fee.nextVerificationDue).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <Card key={fee.id} className="bg-[#161b22] border-[#21262d]">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-white">{fee.jobTitle}</p>
                            <StatusBadge status={fee.status} />
                          </div>
                          <p className="text-gray-400 text-sm">{fee.employerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-cyan-400 font-bold">${(fee.monthlyFeeAmount / 100).toFixed(2)}<span className="text-gray-500 text-xs font-normal">/mo</span></p>
                          <p className="text-gray-500 text-xs">{fee.feePercent}% of ${fee.monthlySalary.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Verification status */}
                      {fee.status === "active" && daysUntilVerification !== null && (
                        <div className={`flex items-center gap-2 text-xs p-2 rounded mb-3 ${isVerificationDue ? "bg-red-500/10 text-red-400 border border-red-500/20" : daysUntilVerification <= 14 ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" : "bg-[#0d1117] text-gray-500"}`}>
                          {isVerificationDue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {isVerificationDue
                            ? "Verification overdue! Submit proof of employment to avoid suspension."
                            : daysUntilVerification <= 14
                            ? `Verification due in ${daysUntilVerification} days`
                            : `Next verification: ${new Date(fee.nextVerificationDue!).toLocaleDateString()}`}
                        </div>
                      )}

                      {fee.status === "pending_verification" && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded mb-3 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          Offer letter under review. Your subscription will activate once verified.
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        <Calendar className="w-3.5 h-3.5" />
                        Started {new Date(fee.startDate).toLocaleDateString()}
                        {fee.offerLetterUrl && (
                          <>
                            <span className="text-gray-600">·</span>
                            <a href={fee.offerLetterUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline flex items-center gap-0.5">
                              <FileText className="w-3 h-3" /> Offer Letter
                            </a>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {(fee.status === "active" || isVerificationDue) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVerifyDialogFeeId(fee.id)}
                            className="border-[#30363d] text-gray-300 hover:bg-[#21262d] text-xs gap-1"
                          >
                            <Upload className="w-3 h-3" /> Submit Verification
                          </Button>
                        )}
                        {["active", "pending_verification"].includes(fee.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm("Are you sure you want to report that your employment has ended? This will cancel your success fee subscription.")) {
                                reportEmploymentEnded.mutate({ successFeeId: fee.id, endDate: new Date().toISOString() });
                              }
                            }}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1"
                          >
                            <XCircle className="w-3 h-3" /> Report Employment Ended
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment History */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Payment History</h2>
          {payments.length === 0 ? (
            <Card className="bg-[#161b22] border-[#21262d]">
              <CardContent className="p-6 text-center">
                <DollarSign className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No payments yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#161b22] border-[#21262d]">
              <CardContent className="p-0">
                <div className="divide-y divide-[#21262d]">
                  {payments.map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-white text-sm font-medium">
                          ${(payment.amount / 100).toFixed(2)} {payment.currency}
                        </p>
                        {payment.periodStart && payment.periodEnd && (
                          <p className="text-gray-500 text-xs mt-0.5">
                            {new Date(payment.periodStart).toLocaleDateString()} – {new Date(payment.periodEnd).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <PaymentStatusBadge status={payment.status} />
                        {payment.paidAt && (
                          <span className="text-gray-500 text-xs">{new Date(payment.paidAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <ReportHireDialog
        open={reportHireOpen}
        onOpenChange={setReportHireOpen}
        onSuccess={() => refetchFees()}
      />

      {verifyDialogFeeId !== null && (
        <VerificationUploadDialog
          open={true}
          onOpenChange={(open) => { if (!open) setVerifyDialogFeeId(null); }}
          successFeeId={verifyDialogFeeId}
          onSuccess={() => refetchFees()}
        />
      )}
    </div>
  );
}
