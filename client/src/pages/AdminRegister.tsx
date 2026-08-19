/**
 * Admin Registration — Restricted Access
 * Shows a convincing fake 404 to visitors without a valid key.
 * With a valid key: shows admin registration form.
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";

import {
  Shield, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, Home, Key, Clock, UserPlus
} from "lucide-react";

const CMS_PATH = import.meta.env.VITE_CMS_PATH || "/none-of-your-business";

// ─── Fake 404 (identical to the real NotFound page) ─────────────────────────
function Fake404() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm rounded-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
            <AlertCircle className="relative h-16 w-16 text-red-500" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 mb-4">Page Not Found</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Sorry, the page you are looking for doesn't exist.<br />
          It may have been moved or deleted.
        </p>
        <button
          onClick={() => setLocation("/")}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Home className="w-4 h-4" />
          Go Home
        </button>
      </div>
    </div>
  );
}

export default function AdminRegister() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  // Parse key from URL params
  const params = new URLSearchParams(searchString);
  const urlKey = params.get("key") || "";

  const [keyValid, setKeyValid] = useState<boolean | null>(null); // null = checking
  const [manualKey, setManualKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Validate key on mount
  useEffect(() => {
    if (!urlKey) {
      setKeyValid(false);
      return;
    }
    validateKey(urlKey);
  }, [urlKey]);

  const [keyExpired, setKeyExpired] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const validateKey = useCallback(async (key: string) => {
    try {
      const res = await fetch("/api/auth/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        const data = await res.json();
        setKeyValid(data.valid === true);
        setKeyExpired(false);
      } else if (res.status === 410) {
        setKeyValid(false);
        setKeyExpired(true);
      } else {
        setKeyValid(false);
      }
    } catch {
      setKeyValid(false);
    }
  }, []);

  const handleManualKeySubmit = useCallback(async () => {
    if (manualKey.length < 4) return;
    await validateKey(manualKey);
  }, [manualKey, validateKey]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const secretKey = urlKey || manualKey;
      const res = await fetch("/api/auth/admin-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name.trim() || undefined, secretKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          setError("Invalid registration key.");
        } else {
          setError(data.error || "Registration failed. Please try again.");
        }
        return;
      }

      if (data.pending) {
        setPendingApproval(true);
        setSuccess(data.message || "Your request has been submitted. Awaiting approval.");
      } else {
        setSuccess(data.message || "Admin account created successfully!");
        setTimeout(() => {
          setLocation(CMS_PATH);
        }, 1500);
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [email, password, name, urlKey, manualKey, setLocation]);

  // Still validating
  if (keyValid === null && urlKey) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
      </div>
    );
  }

  // Key expired → show expired message
  if (keyExpired) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0a0a0f] border border-red-900/40 rounded-lg shadow-2xl shadow-red-900/20 p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center">
              <Clock className="w-7 h-7 text-red-400" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-white font-mono mb-2">REGISTRATION KEY EXPIRED</h2>
          <p className="text-sm font-mono text-gray-400 mb-4">
            This registration link has expired. Contact the platform owner for a new key.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-300 font-mono text-xs hover:bg-gray-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Pending approval confirmation
  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0a0a0f] border border-yellow-900/40 rounded-lg shadow-2xl shadow-yellow-900/20 p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-yellow-900/30 border border-yellow-700/50 flex items-center justify-center">
              <UserPlus className="w-7 h-7 text-yellow-400" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-white font-mono mb-2">REQUEST SUBMITTED</h2>
          <p className="text-sm font-mono text-gray-400 mb-2">
            Your admin access request has been submitted successfully.
          </p>
          <p className="text-xs font-mono text-yellow-400/80 mb-6">
            The platform owner will review your request. You will receive access once approved.
          </p>
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-900/20 border border-yellow-800/40 rounded mb-4">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-mono text-yellow-300">Pending owner approval</span>
          </div>
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-300 font-mono text-xs hover:bg-gray-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // No key or invalid key → show fake 404 (with hidden key input option)
  if (!keyValid) {
    if (showKeyInput) {
      // Secret: if someone knows to click 5 times on the 404 text, show key input
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0a0f] border border-red-900/40 rounded-lg shadow-2xl shadow-red-900/20 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center">
                <Key className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide font-mono">ACCESS KEY</h2>
                <p className="text-xs text-gray-500 font-mono">ENTER AUTHORIZATION KEY</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="Enter secret key..."
                className="flex-1 px-3 py-2.5 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60"
                onKeyDown={(e) => e.key === "Enter" && handleManualKeySubmit()}
              />
              <button
                onClick={handleManualKeySubmit}
                disabled={manualKey.length < 4}
                className="px-4 py-2.5 bg-red-900/30 border border-red-800/40 rounded text-red-400 font-mono text-xs uppercase hover:bg-red-900/50 disabled:opacity-30"
              >
                VERIFY
              </button>
            </div>
            <button
              onClick={() => setShowKeyInput(false)}
              className="mt-4 text-xs font-mono text-gray-600 hover:text-gray-400"
            >
              ← Back
            </button>
          </div>
        </div>
      );
    }

    // Render the fake 404 but with a hidden trigger
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm rounded-xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>
          <h1
            className="text-4xl font-bold text-slate-900 mb-2 select-none"
            onDoubleClick={() => setShowKeyInput(true)}
          >
            404
          </h1>
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Page Not Found</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.<br />
            It may have been moved or deleted.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Valid key → show registration form
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0a0a0f] border border-red-900/40 rounded-lg shadow-2xl shadow-red-900/20 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-red-900/30">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide font-mono">ADMIN REGISTRATION</h2>
              <p className="text-xs text-gray-500 font-mono">REDROOM V2.4 · ELEVATED ACCESS · OWLINK.AI</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-800/40 rounded">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-xs font-mono text-green-300">Authorization key verified</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1.5 uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Admin"
              className="w-full px-3 py-2.5 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60 focus:ring-1 focus:ring-red-900/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@domain.com"
              required
              className="w-full px-3 py-2.5 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60 focus:ring-1 focus:ring-red-900/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
                className="w-full px-3 py-2.5 pr-10 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60 focus:ring-1 focus:ring-red-900/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error/Success messages */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-800/40 rounded text-red-300 text-xs font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-800/40 rounded text-green-300 text-xs font-mono">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 bg-red-900/40 border border-red-700/50 rounded text-red-300 font-mono text-sm font-bold uppercase tracking-wider hover:bg-red-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                CREATING ACCOUNT...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                CREATE ADMIN ACCOUNT
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 pb-5 text-center">
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-900/10 border border-yellow-800/30 rounded mb-2">
            <Clock className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-mono text-yellow-400/80">Requires owner approval after submission</span>
          </div>
          <p className="text-xs font-mono text-gray-600">
            Your request will be reviewed by the platform owner.
          </p>
        </div>
      </div>
    </div>
  );
}
