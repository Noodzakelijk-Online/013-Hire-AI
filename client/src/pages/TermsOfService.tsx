import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            <span className="font-semibold text-white">Terms of Service</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Hire.AI Terms of Service</h1>
          <p className="text-slate-400 text-sm">
            Effective Date: January 1, 2025 &nbsp;·&nbsp; Last Updated: January 1, 2025
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-300 leading-relaxed">

          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction and Acceptance</h2>
            <p>
              Welcome to Hire.AI ("the Platform," "we," "us," or "our"). By creating an account, accessing, or using the Hire.AI job-search operating tools, you ("User," "you") agree to be legally bound by these Terms of Service ("Terms"). If you do not agree to these Terms in their entirety, you must not use the Platform.
            </p>
            <p className="mt-3">
              These Terms constitute a legally binding agreement between you and Hire.AI. They govern your use of the Platform and, critically, your financial obligations to Hire.AI upon successful employment placement. Please read these Terms carefully before proceeding.
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              Hire.AI is a job-search operating platform that can discover listings from configured supported sources, prepare application materials, and maintain a reviewable application ledger. External application and follow-up delivery require explicit user approval and confirmation. Source availability and workflow support vary by configuration. The Platform is provided subject to the success fee obligations described in Section 4.
            </p>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Eligibility</h2>
            <p>
              You must be at least 18 years of age and legally capable of entering into binding contracts to use the Platform. By using the Platform, you represent and warrant that you meet these requirements and that all information you provide is accurate, complete, and current.
            </p>
          </section>

          {/* Success Fee — CRITICAL SECTION */}
          <section className="border border-cyan-500/30 rounded-xl p-6 bg-cyan-500/5">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="bg-cyan-500 text-black text-xs font-bold px-2 py-0.5 rounded">IMPORTANT</span>
              4. Success Fee Obligation
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-cyan-400 mb-2">4.1 Success Fee Structure</h3>
                <p>
                  In consideration for the free use of the Platform, you agree to pay Hire.AI a <strong className="text-white">success fee of five percent (5%) of your gross monthly salary or compensation</strong> for each position of employment that you obtain through or as a result of the Platform's services. This fee is payable monthly, on an ongoing basis, for the entire duration of your employment at the placed position.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-cyan-400 mb-2">4.2 Triggering Event</h3>
                <p>
                  The success fee obligation is triggered when: (a) you receive and accept an offer of employment attributable to a Hire.AI application record that you completed through the employer's channel; (b) you commence employment at that position; and (c) your gross monthly compensation equals or exceeds <strong className="text-white">three hundred US dollars (USD $300)</strong> per month. Positions with compensation below this threshold are exempt from the success fee.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-cyan-400 mb-2">4.3 Duration of Obligation</h3>
                <p>
                  The success fee obligation continues for the entire duration of your employment at the placed position, including any promotions, role changes, or compensation adjustments within the same employer. The obligation ceases upon the verified termination of your employment at that specific position.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-cyan-400 mb-2">4.4 Mandatory Reporting</h3>
                <p>
                  You are <strong className="text-white">required to report</strong> any successful employment placement obtained through the Platform within <strong className="text-white">fourteen (14) calendar days</strong> of accepting the offer of employment. Failure to report within this period constitutes a material breach of these Terms.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-cyan-400 mb-2">4.5 Verification Requirements</h3>
                <p>
                  Upon reporting a successful placement, you must provide: (a) a copy of your offer letter or employment contract; (b) documentation confirming your gross monthly salary. Additionally, you must provide quarterly re-verification of continued employment and current compensation, by submitting a recent paystub, employment letter, or equivalent documentation. Failure to provide required verification within the specified grace period may result in account suspension.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-cyan-400 mb-2">4.6 Payment Method</h3>
                <p>
                  Success fees are collected via recurring monthly payments through Stripe, our third-party payment processor. By reporting a successful placement, you authorize Hire.AI to charge your designated payment method the applicable success fee amount each month. You are responsible for maintaining a valid payment method on file.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-cyan-400 mb-2">4.7 Salary Adjustments</h3>
                <p>
                  You are obligated to notify Hire.AI of any material changes to your compensation (increases or decreases exceeding 10%) within thirty (30) days of such change taking effect. The monthly success fee will be adjusted accordingly.
                </p>
              </div>
            </div>
          </section>

          {/* Enforcement */}
          <section className="border border-red-500/30 rounded-xl p-6 bg-red-500/5">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">ENFORCEMENT</span>
              5. Non-Compliance and Legal Enforcement
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-red-400 mb-2">5.1 Breach of Terms</h3>
                <p>
                  Failure to report a successful placement, failure to pay the success fee, providing false or misleading information regarding employment status or compensation, or failure to provide required verification documentation constitutes a material breach of these Terms.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-red-400 mb-2">5.2 Account Suspension</h3>
                <p>
                  Hire.AI reserves the right to suspend your account immediately upon detection of non-compliance, including but not limited to: missed payments, failure to provide verification, or suspected misreporting of employment status or compensation.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-red-400 mb-2">5.3 Legal Action</h3>
                <p>
                  In the event of material breach, Hire.AI reserves the right to pursue all available legal remedies, including but not limited to: civil litigation for breach of contract; recovery of all unpaid success fees, including retroactive fees from the date of placement; recovery of legal costs, attorney's fees, and court costs; and referral to debt collection agencies. You acknowledge that the success fee obligation is a material term of this agreement and that breach thereof causes quantifiable financial harm to Hire.AI.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-red-400 mb-2">5.4 Liquidated Damages</h3>
                <p>
                  In cases of deliberate non-disclosure of employment, you agree to pay liquidated damages equal to twenty-four (24) months of the applicable success fee, representing a reasonable pre-estimate of the harm caused by such non-disclosure.
                </p>
              </div>
            </div>
          </section>

          {/* User Obligations */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. User Obligations</h2>
            <p>You agree to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Provide accurate and complete profile information to enable effective job matching</li>
              <li>Promptly report any successful employment placement obtained through the Platform</li>
              <li>Maintain a valid payment method for success fee collection</li>
              <li>Notify Hire.AI of employment termination within 14 days</li>
              <li>Notify Hire.AI of material compensation changes within 30 days</li>
              <li>Provide quarterly verification of continued employment as requested</li>
              <li>Not misrepresent your employment status, compensation, or identity</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p>
              The Platform, including its software, algorithms, design, and content, is the exclusive property of Hire.AI and is protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Platform solely for your personal job search purposes.
            </p>
          </section>

          {/* Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Privacy and Data</h2>
            <p>
              By using the Platform, you consent to the collection, processing, and use of your personal data, including your resume, employment history, and compensation information, for the purpose of providing the Platform's services. Your data is processed in accordance with our Privacy Policy. Hire.AI prepares and records application materials, but does not submit your resume or profile information to third-party employers. You control what is shared through each employer's channel.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              Hire.AI does not guarantee employment placement. The Platform is provided "as is" without warranty of any kind. Hire.AI's liability to you for any claims arising from use of the Platform is limited to the total success fees paid by you in the twelve (12) months preceding the claim. Hire.AI is not liable for any indirect, incidental, or consequential damages.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Termination</h2>
            <p>
              You may terminate your account at any time. However, termination of your account does not extinguish any existing success fee obligations. You remain liable for all success fees accrued prior to termination and for ongoing fees for active placements until the relevant employment relationship ends.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Governing Law and Dispute Resolution</h2>
            <p>
              These Terms are governed by and construed in accordance with applicable law. Any disputes arising from these Terms shall be resolved through binding arbitration, except that Hire.AI may seek injunctive or other equitable relief in any court of competent jurisdiction to protect its intellectual property rights or to enforce the success fee obligation.
            </p>
          </section>

          {/* Amendments */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Amendments</h2>
            <p>
              Hire.AI reserves the right to modify these Terms at any time. Material changes will be communicated via email or in-platform notification. Continued use of the Platform after such notification constitutes acceptance of the amended Terms.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Contact</h2>
            <p>
              For questions regarding these Terms, success fee obligations, or to report employment status changes, please contact us through the Platform's support channels.
            </p>
          </section>

          {/* Acknowledgment */}
          <section className="border border-slate-700 rounded-xl p-6 bg-slate-900/40 mt-8">
            <p className="text-sm text-slate-400">
              By creating an account or using the Hire.AI Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service, including the success fee obligation set out in Section 4. You acknowledge that this constitutes a legally binding contract.
            </p>
          </section>
        </div>

        {/* Back Button */}
        <div className="mt-10 flex gap-3">
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
            className="border-slate-700 text-slate-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
