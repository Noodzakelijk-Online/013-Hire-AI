import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Activity, Brain, Zap, Shield, Target, Rocket, Clock, CheckCircle2, ArrowRight, Search, FileText, Send, Star, Quote } from "lucide-react";
import { useLocation } from "wouter";
import { useRef } from "react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const featuresRef = useRef<HTMLElement>(null);
  const platformsRef = useRef<HTMLElement>(null);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToPlatforms = () => {
    platformsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <Activity className="h-8 w-8 text-cyan-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Hire.AI
            </span>
          </div>
          <div className="flex gap-4">
            <Button 
              variant="ghost" 
              className="text-slate-300 hover:text-white"
              onClick={scrollToFeatures}
            >
              Features
            </Button>
            <Button 
              variant="ghost" 
              className="text-slate-300 hover:text-white"
              onClick={scrollToPlatforms}
            >
              Platforms
            </Button>
            {isAuthenticated ? (
              <Button
                variant="outline"
                className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                onClick={() => setLocation("/dashboard")}
              >
                Dashboard
              </Button>
            ) : (
              <Button
                variant="outline"
                className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                onClick={() => window.location.href = getLoginUrl()}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - Captivating Copy */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Apply to 100 Jobs While You Sleep.
              </span>
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed">
              Stop scrolling through endless job boards. Hire.AI scans 50+ platforms, 
              matches you with perfect opportunities, and applies automatically—while you sleep.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 text-lg"
                onClick={handleGetStarted}
              >
                {isAuthenticated ? "Go to Dashboard" : "Start Getting Hired"}
                <Rocket className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={scrollToFeatures}
              >
                See How It Works
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            
            {/* Social Proof */}
            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`w-10 h-10 rounded-full border-2 border-slate-900 bg-gradient-to-br ${
                    i === 1 ? 'from-cyan-400 to-blue-500' :
                    i === 2 ? 'from-purple-400 to-pink-500' :
                    i === 3 ? 'from-green-400 to-emerald-500' :
                    i === 4 ? 'from-orange-400 to-red-500' :
                    'from-blue-400 to-indigo-500'
                  }`} />
                ))}
              </div>
              <div className="text-sm text-slate-400">
                <span className="text-white font-semibold">2,500+</span> job seekers already hired
              </div>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-xl" />
            <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-white font-semibold">Live Activity</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400 text-sm">Active now</span>
                  </div>
                </div>
                
                {/* Activity Items */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">JM</div>
                    <div className="flex-1">
                      <p className="text-slate-200 text-sm">Applied to <span className="text-cyan-400">Senior Developer</span> at Stripe</p>
                      <p className="text-slate-500 text-xs">2 seconds ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold">SK</div>
                    <div className="flex-1">
                      <p className="text-slate-200 text-sm">Got interview at <span className="text-green-400">Shopify</span></p>
                      <p className="text-slate-500 text-xs">5 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">AR</div>
                    <div className="flex-1">
                      <p className="text-slate-200 text-sm">Matched with <span className="text-cyan-400">47 new jobs</span></p>
                      <p className="text-slate-500 text-xs">12 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold">LT</div>
                    <div className="flex-1">
                      <p className="text-slate-200 text-sm">Received offer from <span className="text-green-400">Notion</span> 🎉</p>
                      <p className="text-slate-500 text-xs">1 hour ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section - Real Names with Faces */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">What Our Users Say</h2>
          <p className="text-xl text-slate-400">Real stories from real job seekers</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" 
                alt="Marcus Johnson"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="text-white font-semibold">Marcus Johnson</p>
                <p className="text-slate-400 text-sm">Software Engineer</p>
              </div>
            </div>
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
            </div>
            <Quote className="h-6 w-6 text-cyan-400/50 mb-2" />
            <p className="text-slate-300">
              "I used to spend 4 hours daily searching job boards. Now Hire.AI does it for me while I focus on interview prep. Landed my dream job at a FAANG company!"
            </p>
          </div>
          
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face" 
                alt="Sarah Kim"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="text-white font-semibold">Sarah Kim</p>
                <p className="text-slate-400 text-sm">Product Designer</p>
              </div>
            </div>
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
            </div>
            <Quote className="h-6 w-6 text-green-400/50 mb-2" />
            <p className="text-slate-300">
              "The auto-apply feature is a game changer. I went from 2 interviews a month to 6 in my first week! The AI matching is scary accurate."
            </p>
          </div>
          
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <img 
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face" 
                alt="David Chen"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="text-white font-semibold">David Chen</p>
                <p className="text-slate-400 text-sm">Data Scientist</p>
              </div>
            </div>
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
            </div>
            <Quote className="h-6 w-6 text-purple-400/50 mb-2" />
            <p className="text-slate-300">
              "Every job suggestion feels like it was written for me. Got 3 offers in 2 weeks after struggling for months on my own. Absolutely worth it!"
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section - With 50+ Platforms Integrated */}
      <section className="container mx-auto px-4 py-20" ref={featuresRef}>
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-xl text-slate-400">Three simple steps to your dream job</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold text-xl">1</div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-8 pt-12 h-full">
              <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
                <FileText className="h-8 w-8 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Upload Your Resume</h3>
              <p className="text-slate-400">
                Our AI extracts your skills, experience, and preferences to understand exactly what you're looking for.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">2</div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-8 pt-12 h-full">
              <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                <Search className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">AI Scans 50+ Platforms</h3>
              <p className="text-slate-400 mb-4">
                We continuously scan FlexJobs, LinkedIn, Remote.co, We Work Remotely, Indeed, and 45+ more platforms.
              </p>
              {/* Platform logos inline */}
              <div className="flex flex-wrap gap-2">
                {["FlexJobs", "LinkedIn", "Indeed", "Remote.co", "+45"].map((p) => (
                  <span key={p} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">{p}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xl">3</div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-8 pt-12 h-full">
              <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                <Send className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Auto-Apply While You Sleep</h3>
              <p className="text-slate-400">
                Hire.AI automatically applies with tailored resumes and cover letters. Wake up to interview invites!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20" ref={platformsRef}>
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Powered by AI, Built for You</h2>
          <p className="text-xl text-slate-400">Everything you need to land your dream remote job</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-cyan-500/50 transition-all hover:transform hover:scale-105">
            <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">50+ Platforms</h3>
            <p className="text-slate-400 text-sm">
              Aggregate jobs from FlexJobs, We Work Remotely, Remote.co, and 47 more platforms
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-blue-500/50 transition-all hover:transform hover:scale-105">
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
              <Brain className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">AI Matching</h3>
            <p className="text-slate-400 text-sm">
              Smart algorithms match you with jobs that fit your skills, experience, and preferences
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:transform hover:scale-105">
            <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Auto-Apply</h3>
            <p className="text-slate-400 text-sm">
              Automatically apply to matching jobs with customized resumes and cover letters
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-green-500/50 transition-all hover:transform hover:scale-105">
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

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center space-y-6">
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            Ready to Let Jobs Find You?
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Join thousands of job seekers who wake up to interview invites instead of endless scrolling
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-12 py-6 text-lg"
            onClick={handleGetStarted}
          >
            {isAuthenticated ? "Go to Dashboard" : "Start Getting Hired — It's Free"}
            <Rocket className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-sm text-slate-500">No credit card required. Set up in 2 minutes.</p>
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
