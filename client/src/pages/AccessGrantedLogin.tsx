/**
 * Access Granted Login — Restricted Access
 * 
 * Invitation-only login portal for registered users.
 * Requires the admin secret key in URL params (?key=...) to even see the login form.
 * Without a valid key, shows a convincing fake 404 page.
 * 
 * Includes a serious disclaimer about responsibilities and platform usage.
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Shield,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Lock,
  AlertTriangle,
  Radio,
} from "lucide-react";

// ─── Fake 404 Page ────────────────────────────────────────────────────────────
function Fake404() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-700 font-mono">404</h1>
        <p className="mt-4 text-gray-500 text-sm font-mono">Page not found</p>
        <p className="mt-2 text-gray-600 text-xs font-mono">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-6 inline-block text-xs text-gray-500 hover:text-gray-400 font-mono underline underline-offset-4"
        >
          Return home
        </a>
      </div>
    </div>
  );
}

// ─── Disclaimer Section ───────────────────────────────────────────────────────
function Disclaimer() {
  return (
    <div className="mt-6 p-4 bg-[#0d0d14] border border-amber-900/30 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">
            CRITICAL ACCESS NOTICE
          </h3>
          <div className="text-[11px] text-gray-400 font-mono leading-relaxed space-y-2">
            <p>
              This is an <span className="text-amber-300">invitation-only</span> intelligence platform.
              Access is granted exclusively to vetted analysts and researchers.
            </p>
            <p>
              Content published through this platform is potentially visible to{" "}
              <span className="text-red-400 font-bold">millions of viewers</span>. 
              Exercise extreme caution and responsibility.
            </p>
            <div className="pt-1 border-t border-amber-900/20">
              <p className="text-amber-300/80 font-bold mb-1">YOUR RESPONSIBILITIES:</p>
              <ul className="space-y-1 text-gray-500">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-600 mt-0.5">▸</span>
                  <span>Verify all sources before publishing — accuracy is non-negotiable</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-600 mt-0.5">▸</span>
                  <span>Respect crawling quotas and rate limits — resources are shared</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-600 mt-0.5">▸</span>
                  <span>Protect sensitive findings and sources from unauthorized disclosure</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-600 mt-0.5">▸</span>
                  <span>Use facilities responsibly — every action is logged and auditable</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-600 mt-0.5">▸</span>
                  <span>Be mindful of your LLM quota — usage is tracked per-user</span>
                </li>
              </ul>
            </div>
            <p className="text-red-400/70 text-[10px] pt-1">
              Misuse of this platform will result in immediate access revocation without notice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function AccessGrantedLogin() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const key = params.get("key");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [keyChecking, setKeyChecking] = useState(true);

  // Validate the key on mount
  useEffect(() => {
    if (!key) {
      setKeyChecking(false);
      setKeyValid(false);
      return;
    }

    const validateKey = async () => {
      try {
        const res = await fetch("/api/auth/validate-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        const data = await res.json();
        setKeyValid(data.valid === true);
      } catch {
        setKeyValid(false);
      } finally {
        setKeyChecking(false);
      }
    };

    validateKey();
  }, [key]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed. Check your credentials.");
        return;
      }

      setSuccess("Access granted. Redirecting to command center...");
      setTimeout(() => {
        setLocation("/");
      }, 1200);
    } catch {
      setError("Network error. Secure connection required.");
    } finally {
      setLoading(false);
    }
  }, [email, password, setLocation]);

  // Show fake 404 while checking key or if key is invalid
  if (keyChecking) {
    return <Fake404 />;
  }

  if (!keyValid) {
    return <Fake404 />;
  }

  // ─── Render Login Form ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-900/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-900/3 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,0,0,0.03),transparent_70%)]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/20 border border-red-800/30 mb-4">
            <Radio className="w-8 h-8 text-red-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white font-mono tracking-wider">
            REDROOM
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1 tracking-widest uppercase">
            Secure Analyst Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0c0c14] border border-red-900/30 rounded-xl shadow-2xl shadow-red-900/10 overflow-hidden">
          {/* Card Header */}
          <div className="px-6 pt-6 pb-4 border-b border-red-900/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-900/20 border border-red-800/40 flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white font-mono tracking-wide">
                  AUTHENTICATE
                </h2>
                <p className="text-[10px] text-gray-500 font-mono">
                  INVITATION ONLY · MONITORED ACCESS
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase tracking-widest">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@domain.com"
                required
                className="w-full px-3 py-2.5 bg-[#111118] border border-gray-800/80 rounded-lg text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60 focus:ring-1 focus:ring-red-900/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 pr-10 bg-[#111118] border border-gray-800/80 rounded-lg text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60 focus:ring-1 focus:ring-red-900/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Status Messages */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-900/15 border border-red-800/30 rounded-lg text-red-300 text-xs font-mono">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-green-900/15 border border-green-800/30 rounded-lg text-green-300 text-xs font-mono">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-900/50 hover:bg-red-800/60 border border-red-700/40 rounded-lg text-white font-mono text-sm font-bold tracking-wider uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  ACCESS PLATFORM
                </>
              )}
            </button>
          </form>

          {/* Security notice */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 text-[10px] text-gray-600 font-mono">
              <Lock className="w-3 h-3" />
              <span>End-to-end encrypted · All sessions monitored · IP logged</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <Disclaimer />

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-[10px] text-gray-600 font-mono">
            This platform is intended for legitimate intelligence research only.
          </p>
          <p className="text-[10px] text-gray-700 font-mono mt-1">
            Unauthorized access attempts are prosecuted.
          </p>
        </div>
      </div>
    </div>
  );
}
