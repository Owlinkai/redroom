import { useState, useCallback } from "react";
import { X, Shield, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultMode?: "login" | "register";
}

export function AuthModal({ isOpen, onClose, onSuccess, defaultMode = "register" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body: Record<string, string> = { email, password };
      if (mode === "register" && name.trim()) body.name = name.trim();

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(data.message || "Success!");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 800);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [mode, email, password, name, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-[#0a0a0f] border border-red-900/40 rounded-lg shadow-2xl shadow-red-900/20 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-red-900/30">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide font-mono">
                {mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
              </h2>
              <p className="text-xs text-gray-500 font-mono">REDROOM · SECURE ACCESS</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1.5 uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Analyst"
                className="w-full px-3 py-2.5 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60 focus:ring-1 focus:ring-red-900/30 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@domain.com"
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
                placeholder={mode === "register" ? "Min 8 characters" : "••••••••"}
                required
                minLength={mode === "register" ? 8 : undefined}
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

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-red-900/60 hover:bg-red-800/70 border border-red-700/50 rounded text-white font-mono text-sm font-bold tracking-wider uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                PROCESSING...
              </>
            ) : mode === "login" ? (
              "AUTHENTICATE"
            ) : (
              "CREATE ACCOUNT"
            )}
          </button>
        </form>

        {/* Footer: switch mode */}
        <div className="px-6 pb-5 pt-1">
          <div className="text-center text-xs font-mono text-gray-500">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                  className="text-red-400 hover:text-red-300 underline underline-offset-2"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="text-red-400 hover:text-red-300 underline underline-offset-2"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
          <p className="text-center text-[10px] text-gray-600 mt-3 font-mono">
            Your data is encrypted and stored securely. No third-party access.
          </p>
        </div>
      </div>
    </div>
  );
}
