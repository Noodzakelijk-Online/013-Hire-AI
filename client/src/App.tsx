import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import AIPreferences from "./pages/AIPreferences";
import SavedJobs from "./pages/SavedJobs";
import Billing from "./pages/Billing";
import AdminPanel from "./pages/AdminPanel";
import TermsOfService from "./pages/TermsOfService";
import JobSearch from "./pages/JobSearch";
import Applications from "./pages/Applications";
import JobAlerts from "./pages/JobAlerts";
import ReviewQueue from "./pages/ReviewQueue";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={LandingPage} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/jobs"} component={JobSearch} />
      <Route path={"/applications"} component={Applications} />
      <Route path={"/review-queue"} component={ReviewQueue} />
      <Route path={"/alerts"} component={JobAlerts} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/ai-preferences"} component={AIPreferences} />
      <Route path={"/saved"} component={SavedJobs} />
      <Route path={"/billing"} component={Billing} />
      <Route path={"/admin"} component={AdminPanel} />
      <Route path={"/terms"} component={TermsOfService} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
