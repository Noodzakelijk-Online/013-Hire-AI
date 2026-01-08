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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={LandingPage} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/ai-preferences"} component={AIPreferences} />
      <Route path={"/saved"} component={SavedJobs} />
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
