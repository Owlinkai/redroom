import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Streamdown } from 'streamdown';

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  // If theme is switchable in App.tsx, we can implement theme toggling like this:
  // const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      <main>
        {/* Example: lucide-react for icons */}
        <Loader2 className="animate-spin" />
        Example Page
        {/* Example: Streamdown for markdown rendering */}
        <Streamdown>Any **markdown** content</Streamdown>
        <Button variant="default">Example Button</Button>
      </main>
    </div>
  );
}
