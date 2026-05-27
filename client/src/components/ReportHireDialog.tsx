import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle, Briefcase, DollarSign, Calendar } from "lucide-react";

interface ReportHireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId?: number;
  onSuccess?: () => void;
}

export function ReportHireDialog({ open, onOpenChange, applicationId, onSuccess }: ReportHireDialogProps) {
  const [step, setStep] = useState<"form" | "terms" | "payment" | "success">("form");
  const [formData, setFormData] = useState({
    employerName: "",
    jobTitle: "",
    monthlySalary: "",
    currency: "USD",
    startDate: new Date().toISOString().split("T")[0],
  });
  const [offerLetter, setOfferLetter] = useState<File | null>(null);
  const [offerLetterBase64, setOfferLetterBase64] = useState<string>("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reportHire = trpc.successFees.reportHire.useMutation({
    onSuccess: (data) => {
      if (data.clientSecret) {
        // Redirect to Stripe payment setup
        window.open(`https://checkout.stripe.com/pay/${data.clientSecret}`, "_blank");
      }
      setStep("success");
      onSuccess?.();
      toast.success("Hire reported successfully! Your success fee subscription has been set up.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to report hire. Please try again.");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB");
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF or image file");
      return;
    }

    setOfferLetter(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      setOfferLetterBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!formData.employerName || !formData.jobTitle || !formData.monthlySalary) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!offerLetter || !offerLetterBase64) {
      toast.error("Please upload your offer letter");
      return;
    }
    if (parseFloat(formData.monthlySalary) < 300) {
      toast.error("Minimum monthly salary is $300");
      return;
    }
    setStep("terms");
  };

  const handleConfirm = () => {
    if (!termsAccepted) {
      toast.error("Please accept the terms to continue");
      return;
    }

    reportHire.mutate({
      employerName: formData.employerName,
      jobTitle: formData.jobTitle,
      monthlySalary: parseFloat(formData.monthlySalary),
      currency: formData.currency,
      startDate: formData.startDate,
      applicationId,
      offerLetterBase64,
      offerLetterMimeType: offerLetter!.type,
      offerLetterFileName: offerLetter!.name,
      termsAccepted: true,
    });
  };

  const monthlyFee = formData.monthlySalary ? (parseFloat(formData.monthlySalary) * 0.05).toFixed(2) : "0.00";

  const handleClose = () => {
    if (step !== "success") {
      setStep("form");
      setFormData({
        employerName: "",
        jobTitle: "",
        monthlySalary: "",
        currency: "USD",
        startDate: new Date().toISOString().split("T")[0],
      });
      setOfferLetter(null);
      setOfferLetterBase64("");
      setTermsAccepted(false);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-[#0d1117] border-[#21262d] text-white">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span>🎉</span> Congratulations! You Got Hired!
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Tell us about your new job so we can set up your success fee arrangement.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-gray-300 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Employer Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="e.g. Acme Corporation"
                  value={formData.employerName}
                  onChange={e => setFormData(p => ({ ...p, employerName: e.target.value }))}
                  className="bg-[#161b22] border-[#30363d] text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-300 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Job Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="e.g. Senior Software Engineer"
                  value={formData.jobTitle}
                  onChange={e => setFormData(p => ({ ...p, jobTitle: e.target.value }))}
                  className="bg-[#161b22] border-[#30363d] text-white placeholder:text-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" /> Monthly Salary <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 5000"
                    min={300}
                    value={formData.monthlySalary}
                    onChange={e => setFormData(p => ({ ...p, monthlySalary: e.target.value }))}
                    className="bg-[#161b22] border-[#30363d] text-white placeholder:text-gray-500"
                  />
                  <p className="text-xs text-gray-500">Min. $300/month</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Start Date <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                    className="bg-[#161b22] border-[#30363d] text-white"
                  />
                </div>
              </div>

              {formData.monthlySalary && parseFloat(formData.monthlySalary) >= 300 && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                  <p className="text-cyan-400 text-sm font-medium">Monthly Success Fee</p>
                  <p className="text-2xl font-bold text-white mt-0.5">${monthlyFee} <span className="text-sm font-normal text-gray-400">/ month</span></p>
                  <p className="text-xs text-gray-500 mt-1">5% of ${parseFloat(formData.monthlySalary).toLocaleString()} monthly salary</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-gray-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Offer Letter <span className="text-red-400">*</span>
                </Label>
                <div
                  className="border-2 border-dashed border-[#30363d] rounded-lg p-4 text-center cursor-pointer hover:border-cyan-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {offerLetter ? (
                    <div className="flex items-center justify-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">{offerLetter.name}</span>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <Upload className="w-6 h-6 mx-auto mb-1" />
                      <p className="text-sm">Click to upload PDF or image</p>
                      <p className="text-xs mt-0.5">Max 10MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
                disabled={!formData.employerName || !formData.jobTitle || !formData.monthlySalary || !offerLetter}
              >
                Continue to Terms
              </Button>
            </div>
          </>
        )}

        {step === "terms" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Review & Accept Terms</DialogTitle>
              <DialogDescription className="text-gray-400">
                Please review the success fee agreement before proceeding.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Employer</span>
                  <span className="text-white font-medium">{formData.employerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Role</span>
                  <span className="text-white font-medium">{formData.jobTitle}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monthly Salary</span>
                  <span className="text-white font-medium">${parseFloat(formData.monthlySalary).toLocaleString()}</span>
                </div>
                <div className="border-t border-[#30363d] pt-2 flex justify-between text-sm">
                  <span className="text-gray-400">Monthly Fee (5%)</span>
                  <span className="text-cyan-400 font-bold">${monthlyFee}</span>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300 space-y-1.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Success Fee Agreement</p>
                    <ul className="mt-1 space-y-1 text-amber-200/80 list-disc list-inside text-xs">
                      <li>You agree to pay 5% of your monthly salary to Hire.AI for as long as you remain employed at {formData.employerName}</li>
                      <li>Payments are charged monthly via Stripe subscription</li>
                      <li>You must submit proof of continued employment every 90 days</li>
                      <li>Failure to verify employment or pay fees may result in account suspension and legal action</li>
                      <li>You must notify Hire.AI within 14 days if your employment ends</li>
                      <li>Misrepresenting employment status constitutes breach of contract</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="terms" className="text-sm text-gray-300 cursor-pointer leading-relaxed">
                  I have read and agree to the Hire.AI Success Fee Agreement. I understand that I am legally obligated to pay the monthly success fee for the duration of my employment at {formData.employerName}.
                </label>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("form")}
                  className="flex-1 border-[#30363d] text-gray-300 hover:bg-[#21262d]"
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!termsAccepted || reportHire.isPending}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
                >
                  {reportHire.isPending ? "Setting up..." : "Confirm & Set Up Payment"}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">All Set! 🎉</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-gray-300">Your success fee has been set up for</p>
                <p className="text-white font-semibold text-lg">{formData.jobTitle} at {formData.employerName}</p>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-sm">
                <p className="text-gray-400">Monthly fee: <span className="text-cyan-400 font-bold">${monthlyFee}</span></p>
                <p className="text-gray-400 mt-1">Next verification due in <span className="text-white">90 days</span></p>
              </div>
              <p className="text-xs text-gray-500">
                You'll receive a notification when your quarterly verification is due. Visit the Billing page to manage your fees and payment history.
              </p>
              <Button
                onClick={handleClose}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
