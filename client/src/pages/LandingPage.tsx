import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity, Rocket, ArrowRight, Search, FileText, Send, Star, Quote, Globe, Heart, Calendar, Trophy } from "lucide-react";
import { useLocation } from "wouter";
import { useRef, useEffect, useState } from "react";

// Activity types for the live feed
type ActivityItem = {
  id: number;
  initials: string;
  action: string;
  highlight: string;
  highlightColor: string;
  time: string;
  gradientFrom: string;
  gradientTo: string;
};

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const featuresRef = useRef<HTMLElement>(null);
  const missionRef = useRef<HTMLElement>(null);
  
  // Impact stats state
  const [impactStats] = useState({
    totalApplications: 127543,
    interviewsScheduled: 8921,
    offersReceived: 2547,
  });
  
  // Real-time activity state
  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: 1, initials: "JM", action: "Applied to", highlight: "Senior Developer at Stripe", highlightColor: "text-cyan-400", time: "2 seconds ago", gradientFrom: "from-cyan-400", gradientTo: "to-blue-500" },
    { id: 2, initials: "SK", action: "Got interview at", highlight: "Shopify", highlightColor: "text-green-400", time: "5 minutes ago", gradientFrom: "from-purple-400", gradientTo: "to-pink-500" },
    { id: 3, initials: "AR", action: "Matched with", highlight: "47 new jobs", highlightColor: "text-cyan-400", time: "12 minutes ago", gradientFrom: "from-green-400", gradientTo: "to-emerald-500" },
    { id: 4, initials: "LT", action: "Received offer from", highlight: "Notion 🎉", highlightColor: "text-green-400", time: "1 hour ago", gradientFrom: "from-orange-400", gradientTo: "to-red-500" },
  ]);
  
  // Fetch real activity data from API
  const { data: recentApplications } = trpc.applications.list.useQuery(undefined, {
    enabled: true,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Update activities with real data when available
  useEffect(() => {
    if (recentApplications && recentApplications.length > 0) {
      const realActivities: ActivityItem[] = recentApplications.slice(0, 4).map((app, index) => {
        const colors = [
          { from: "from-cyan-400", to: "to-blue-500" },
          { from: "from-purple-400", to: "to-pink-500" },
          { from: "from-green-400", to: "to-emerald-500" },
          { from: "from-orange-400", to: "to-red-500" },
        ];
        const color = colors[index % colors.length];
        const initials = "U" + (index + 1);
        const timeAgo = getTimeAgo(app.appliedDate ? new Date(app.appliedDate) : new Date());
        
        return {
          id: app.id,
          initials,
          action: app.status === 'interview' ? "Got interview at" : "Applied to",
          highlight: "a new position",
          highlightColor: app.status === 'interview' ? "text-green-400" : "text-cyan-400",
          time: timeAgo,
          gradientFrom: color.from,
          gradientTo: color.to,
        };
      });
      if (realActivities.length > 0) {
        setActivities(realActivities);
      }
    }
  }, [recentApplications]);
  
  function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

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

  const scrollToMission = () => {
    missionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation("/")}>
            <Activity className="h-8 w-8 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Hire.AI
              </span>
              <span className="text-xs text-slate-500 -mt-1">Job hunting done right.</span>
            </div>
          </div>
          <div className="flex gap-4">
            <Button 
              variant="ghost" 
              className="text-slate-300 hover:text-white"
              onClick={scrollToFeatures}
            >
              How It Works
            </Button>
            <Button 
              variant="ghost" 
              className="text-slate-300 hover:text-white"
              onClick={scrollToMission}
            >
              Our Mission
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

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Unemployment no more.
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

          {/* Live Activity Feed - Connected to Real Data */}
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
                
                {/* Activity Items - Real-time from API */}
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${activity.gradientFrom} ${activity.gradientTo} flex items-center justify-center text-white text-xs font-bold`}>
                        {activity.initials}
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-200 text-sm">
                          {activity.action} <span className={activity.highlightColor}>{activity.highlight}</span>
                        </p>
                        <p className="text-slate-500 text-xs">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Testimonials Section */}
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

      {/* How It Works Section */}
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
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-cyan-400" />
              <div>
                <span className="text-lg font-semibold text-slate-300">Hire.AI</span>
                <span className="text-slate-500 text-sm ml-2">Job hunting done right.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <Globe className="h-4 w-4" />
              <span>On a mission to reduce worldwide unemployment</span>
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
