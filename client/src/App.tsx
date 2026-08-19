import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GlobalAuthOverlays } from "./components/GlobalAuthOverlays";
import IntelPlatform from "./pages/IntelPlatform";
import OrbitPage from "./pages/Orbit";
import SigintPage from "./pages/Sigint";
import SurveillancePage from "./pages/Surveillance";
import AdminCMS from "./pages/AdminCMS";
import AdminRegister from "./pages/AdminRegister";
import AccessGrantedLogin from "./pages/AccessGrantedLogin";
import DocsPage from "./pages/Docs";

// Secret route paths are read from env at build time so they never appear
// as plain strings in the compiled source or version-controlled files.
// Set VITE_CMS_PATH, VITE_REGISTER_PATH, and VITE_LOGIN_PATH in your .env.
const CMS_PATH      = import.meta.env.VITE_CMS_PATH      || "/none-of-your-business";
const REGISTER_PATH = import.meta.env.VITE_REGISTER_PATH || "/registerme-please";
const LOGIN_PATH    = import.meta.env.VITE_LOGIN_PATH    || "/access-granted-login";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={IntelPlatform} />
      <Route path={"/orbit"} component={OrbitPage} />
      <Route path={"/sigint"} component={SigintPage} />
      <Route path={"/sigint/svm"} component={SurveillancePage} />
      <Route path={"/surveillance"} component={SurveillancePage} />
      <Route path={"/docs"} component={DocsPage} />
      <Route path={CMS_PATH} component={AdminCMS} />
      <Route path={REGISTER_PATH} component={AdminRegister} />
      <Route path={LOGIN_PATH} component={AccessGrantedLogin} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <GlobalAuthOverlays />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
