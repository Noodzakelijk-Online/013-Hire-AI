import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Activity, Brain, Heart, TrendingUp, Zap, Shield, Users, Target } from "lucide-react";
import { useLocation } from "wouter";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="h-8 w-8 text-cyan-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Hire.AI
            </span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Features
            </Button>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Platforms
            </Button>
            <Button
              variant="outline"
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
              <span className="text-white">Your Job Search</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Health Monitor
              </span>
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed">
              Hire.AI aggregates jobs from 50+ remote platforms, eliminates duplicates, 
              and automatically applies to positions that match your profile—all while 
              monitoring the health of your job search journey.
            </p>
            <div className="flex gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8"
                onClick={() => window.location.href = getLoginUrl()}
              >
                Get Started
                <Zap className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Learn More
              </Button>
            </div>
          </div>

          {/* Health Monitor Visual */}
          <div className="relative">
            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Job Search Health</span>
                  <Heart className="h-6 w-6 text-red-400 animate-pulse" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Application Rate</span>
                      <span className="text-cyan-400 font-semibold">92%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full w-[92%] bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Response Rate</span>
                      <span className="text-green-400 font-semibold">78%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full w-[78%] bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Interview Rate</span>
                      <span className="text-purple-400 font-semibold">45%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full w-[45%] bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span>Your job search health is improving</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Powered by AI, Built for You</h2>
          <p className="text-xl text-slate-400">Everything you need to land your dream remote job</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-cyan-500/50 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">50+ Platforms</h3>
            <p className="text-slate-400 text-sm">
              Aggregate jobs from FlexJobs, We Work Remotely, Remote.co, and 47 more platforms
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-blue-500/50 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
              <Brain className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">AI Matching</h3>
            <p className="text-slate-400 text-sm">
              Smart algorithms match you with jobs that fit your skills, experience, and preferences
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-purple-500/50 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Auto-Apply</h3>
            <p className="text-slate-400 text-sm">
              Automatically apply to matching jobs with customized resumes and cover letters
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-green-500/50 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Duplicates</h3>
            <p className="text-slate-400 text-sm">
              Advanced deduplication ensures you never see the same job twice across platforms
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-slate-800/50 rounded-2xl p-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
                50+
              </div>
              <div className="text-slate-400">Job Platforms</div>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
                10K+
              </div>
              <div className="text-slate-400">Active Jobs</div>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2">
                &lt;1min
              </div>
              <div className="text-slate-400">Job Discovery Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center space-y-6">
          <h2 className="text-4xl font-bold text-white">Ready to Transform Your Job Search?</h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Join thousands of job seekers who are using Hire.AI to find their dream remote positions
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-12 py-6 text-lg"
            onClick={() => window.location.href = getLoginUrl()}
          >
            Get Started Free
            <Zap className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-cyan-400" />
              <span className="text-lg font-semibold text-slate-300">Hire.AI</span>
            </div>
            <div className="text-sm text-slate-500">
              © 2026 Hire.AI. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
