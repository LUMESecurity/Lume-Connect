"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser, getCurrentUser } from "@/lib/supabase/service";
import { TravlumeBrand } from "@/components/TravlumeBrand";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function verifyExistingSession() {
      try {
        const user = await getCurrentUser();
        if (user) {
          if (user.role === "organization") {
            router.replace("/organization/dashboard");
          } else {
            router.replace("/superadmin/add-organization");
          }
        }
      } catch (err) {
        console.error("Session verification error:", err);
      }
    }

    verifyExistingSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg("Please enter your Email ID");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your Password");
      return;
    }

    setLoading(true);

    try {
      const { user, error, redirectUrl } = await loginUser(trimmedEmail, password);

      if (error || !user) {
        setErrorMsg(error || "Invalid login credentials. Please try again.");
        setLoading(false);
        return;
      }

      // Role-Based Access Control Redirection
      const destination =
        redirectUrl ||
        (user.role === "organization"
          ? "/organization/dashboard"
          : "/superadmin/add-organization");

      // Immediate redirect without router delay
      window.location.href = destination;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900 font-sans">
      {/* ========================================================= */}
      {/* LEFT: Enterprise Showcase (TravLume Navy & Gold Theme)    */}
      {/* ========================================================= */}
      <div
        className="relative hidden lg:flex lg:w-1/2 bg-[#242D53] text-white flex-col justify-between p-12 xl:p-16 overflow-hidden"
        style={{ backgroundColor: "#242D53", color: "#ffffff" }}
      >
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-[#D2B68D]/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Top: Brand Header */}
        <div className="relative z-10">
          <TravlumeBrand variant="dark" />
        </div>

        {/* Center: Value Proposition */}
        <div className="relative z-10 my-auto max-w-lg space-y-8 py-12">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#D2B68D]/20 text-[#D2B68D] border border-[#D2B68D]/30 backdrop-blur-sm"
            style={{ backgroundColor: "rgba(210, 182, 141, 0.2)", color: "#D2B68D", borderColor: "rgba(210, 182, 141, 0.3)" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>TravLume Tech Enterprise Platform</span>
          </div>

          <h1
            className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight"
            style={{ color: "#ffffff" }}
          >
            Role-Based Access <br />
            <span className="text-[#D2B68D]" style={{ color: "#D2B68D" }}>Enterprise Portal</span>
          </h1>

          <p className="text-sm xl:text-base text-slate-300 leading-relaxed" style={{ color: "#cbd5e1" }}>
            Universal authenticated gateway with automatic role-based routing for
            both platform <strong>Super Administrators</strong> and onboarded <strong>Organizations</strong>.
          </p>

          {/* Enterprise Capabilities */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5">
              <div
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#D2B68D] flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", color: "#D2B68D" }}
              >
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white" style={{ color: "#ffffff" }}>Role-Based Access Control (RBAC)</h4>
                <p className="text-xs text-slate-300" style={{ color: "#cbd5e1" }}>
                  Super Admins manage tenant provisioning; Organizations securely access their dedicated tenant space.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#D2B68D] flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", color: "#D2B68D" }}
              >
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white" style={{ color: "#ffffff" }}>PostgreSQL &amp; Supabase Integration</h4>
                <p className="text-xs text-slate-300" style={{ color: "#cbd5e1" }}>
                  Tenant records, credentials, and contact identities persisted directly in your Supabase schema.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#D2B68D] flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", color: "#D2B68D" }}
              >
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white" style={{ color: "#ffffff" }}>Instant Single Sign-In</h4>
                <p className="text-xs text-slate-300" style={{ color: "#cbd5e1" }}>
                  Automatic role detection routes you to your authorized administrative or organization dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Legal / Status Footer */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400" style={{ borderColor: "rgba(255, 255, 255, 0.1)", color: "#94a3b8" }}>
          <span>&copy; {new Date().getFullYear()} TravLume Tech Private Limited</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            RBAC Active
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT: Production Sign-In Form                            */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12 bg-white">
        <div className="w-full max-w-md mx-auto space-y-8">
          {/* Mobile Header (Brand visible on small screens) */}
          <div className="lg:hidden">
            <TravlumeBrand />
          </div>

          {/* Form Header */}
          <div className="space-y-2">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider uppercase bg-[#242D53]/10 text-[#242D53] border border-[#242D53]/20"
              style={{ backgroundColor: "rgba(36, 45, 83, 0.08)", color: "#242D53", borderColor: "rgba(36, 45, 83, 0.15)" }}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#242D53]" style={{ color: "#242D53" }} />
              <span>Identity &amp; Access Gateway</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#242D53]" style={{ color: "#242D53" }}>
              Sign in to your account
            </h2>
            <p className="text-sm text-slate-500">
              Sign in as a <strong>Super Admin</strong> or with your <strong>Organization credentials</strong>.
            </p>
          </div>

          {/* Error Message Callout */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs sm:text-sm font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
              >
                Email ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@lumeconnect.com or organization@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl border border-slate-200 focus:border-[#242D53] focus:outline-none focus:ring-4 focus:ring-[#242D53]/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Password <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl border border-slate-200 focus:border-[#242D53] focus:outline-none focus:ring-4 focus:ring-[#242D53]/10 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Privacy */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-[#242D53] focus:ring-[#242D53]"
                />
                <span>Remember session</span>
              </label>
              <span className="text-[11px] text-slate-400">Automatic RBAC Routing</span>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-[#242D53] hover:bg-[#1B2240] active:bg-[#161C36] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[#242D53]/20 hover:shadow-lg hover:shadow-[#242D53]/25 transition-all cursor-pointer group"
                style={{ backgroundColor: "#242D53", color: "#ffffff" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#D2B68D]" style={{ color: "#D2B68D" }} />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 text-[#D2B68D] group-hover:translate-x-0.5 transition-transform" style={{ color: "#D2B68D" }} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Enterprise Compliance Notice */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Role-Based Access &bull; Powered by TravLume &amp; Supabase</span>
          </div>
        </div>
      </div>
    </div>
  );
}
