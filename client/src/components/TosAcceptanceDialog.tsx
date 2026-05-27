import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface TosAcceptanceDialogProps {
  open: boolean;
  onAccepted: () => void;
}

export default function TosAcceptanceDialog({ open, onAccepted }: TosAcceptanceDialogProps) {
  const [, setLocation] = useLocation();
  const [checked, setChecked] = useState(false);
  const utils = trpc.useUtils();

  const acceptTos = trpc.auth.acceptTos.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("Terms accepted. Welcome to Hire.AI!");
      onAccepted();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="bg-slate-900 border-slate-800 text-white max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-cyan-400" />
            Terms of Service — Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">
              Before using Hire.AI, you must accept our Terms of Service. These terms include a{" "}
              <strong>5% ongoing success fee</strong> on your monthly salary for any job you land
              through the platform.
            </p>
          </div>

          {/* Key terms summary */}
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-3 text-sm">
            <h3 className="font-semibold text-white">Key Terms Summary</h3>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold shrink-0">✓</span>
                <span><strong className="text-white">Free to use</strong> — no upfront costs or subscriptions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold shrink-0">✓</span>
                <span><strong className="text-white">5% monthly success fee</strong> — payable for the duration of employment at any job obtained through the platform</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold shrink-0">✓</span>
                <span><strong className="text-white">Mandatory reporting</strong> — you must report successful placements within 14 days of accepting an offer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold shrink-0">✓</span>
                <span><strong className="text-white">Quarterly verification</strong> — you must provide proof of continued employment every 90 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">!</span>
                <span><strong className="text-white">Legal enforcement</strong> — non-compliance may result in account suspension and legal action to recover unpaid fees</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 font-bold shrink-0">–</span>
                <span>Minimum salary threshold: <strong className="text-white">$300/month</strong> (positions below this are exempt)</span>
              </li>
            </ul>
          </div>

          {/* Full ToS scroll area */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Full Terms of Service (scroll to review):</p>
            <ScrollArea className="h-40 border border-slate-700 rounded-lg p-3 bg-slate-950/50">
              <div className="text-xs text-slate-400 space-y-3 pr-2">
                <p><strong className="text-slate-300">1. Introduction:</strong> By using Hire.AI, you agree to these Terms. These Terms constitute a legally binding agreement.</p>
                <p><strong className="text-slate-300">2. Service:</strong> Hire.AI automates job applications on your behalf across 50+ platforms. The service is free to use.</p>
                <p><strong className="text-slate-300">3. Success Fee:</strong> You agree to pay 5% of your gross monthly salary for each position obtained through the Platform, payable monthly for the entire duration of employment. Minimum salary threshold: $300/month.</p>
                <p><strong className="text-slate-300">4. Reporting Obligation:</strong> You must report successful placements within 14 calendar days of accepting an offer. Failure to report is a material breach.</p>
                <p><strong className="text-slate-300">5. Verification:</strong> You must provide an offer letter at placement and quarterly re-verification (paystub, employment letter, or equivalent) thereafter.</p>
                <p><strong className="text-slate-300">6. Payment:</strong> Success fees are collected via recurring monthly Stripe payments. You authorize Hire.AI to charge your payment method accordingly.</p>
                <p><strong className="text-slate-300">7. Non-Compliance:</strong> Non-payment, failure to report, or misrepresentation may result in account suspension and legal action. Deliberate non-disclosure triggers liquidated damages equal to 24 months of the applicable success fee.</p>
                <p><strong className="text-slate-300">8. Termination:</strong> Account termination does not extinguish existing fee obligations for active placements.</p>
                <p><strong className="text-slate-300">9. Governing Law:</strong> These Terms are governed by applicable law. Disputes may be resolved through binding arbitration.</p>
              </div>
            </ScrollArea>
          </div>

          {/* Full ToS link */}
          <p className="text-xs text-slate-500">
            Read the{" "}
            <button
              onClick={() => window.open("/terms", "_blank")}
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              full Terms of Service
            </button>{" "}
            before accepting.
          </p>

          {/* Checkbox */}
          <div className="flex items-start gap-3 bg-slate-800/30 rounded-lg p-3 border border-slate-700">
            <Checkbox
              id="tos-accept"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5 border-slate-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
            />
            <label htmlFor="tos-accept" className="text-sm text-slate-300 cursor-pointer leading-relaxed">
              I have read and understand the Terms of Service. I agree to pay a{" "}
              <strong className="text-white">5% monthly success fee</strong> for any job I obtain
              through Hire.AI, for the entire duration of my employment at that position. I understand
              that failure to comply may result in legal action.
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-1">
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => setLocation("/")}
            >
              Decline & Sign Out
            </Button>
            <Button
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              disabled={!checked || acceptTos.isPending}
              onClick={() => acceptTos.mutate()}
            >
              {acceptTos.isPending ? "Accepting..." : "Accept & Continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
