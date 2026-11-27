import { createClient, isSupabaseConfigured } from "./client";
import { AuthUser, Organization, UserRole } from "./types";

const LOCAL_STORAGE_SESSION_KEY = "lume_auth_session";
const LOCAL_STORAGE_ORGS_KEY = "lume_mock_organizations";

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Network timeout")), ms)
    ),
  ]);
}

/**
 * Universal Login for both Super Admin and Organizations with RBAC
 * Signs into Supabase Auth and updates Last Sign In.
 */
export async function loginUser(email: string, password: string): Promise<{
  user: AuthUser | null;
  error: string | null;
  redirectUrl: string;
}> {
  const trimmedEmail = email.trim();

  if (!trimmedEmail || !password) {
    return { user: null, error: "Please enter both Email and Password", redirectUrl: "" };
  }

  if (password.length < 6) {
    return { user: null, error: "Password must be at least 6 characters", redirectUrl: "" };
  }

  // 1. Call server API endpoint to authenticate and store in Supabase
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });

    const json = await res.json();
    if (res.ok && json.success && json.user) {
      const authUser = json.user as AuthUser;
      setSessionCookies(authUser);
      return {
        user: authUser,
        error: null,
        redirectUrl:
          json.redirectUrl ||
          (authUser.role === "organization"
            ? "/organization/dashboard"
            : "/superadmin/add-organization"),
      };
    }

    if (
      res.status === 400 ||
      res.status === 401 ||
      res.status === 403 ||
      (json.error && !json.error.includes("Internal"))
    ) {
      return { user: null, error: json.error || "Invalid email or password", redirectUrl: "" };
    }

    if (isSupabaseConfigured()) {
      return {
        user: null,
        error: json.error || "Invalid email or password",
        redirectUrl: "",
      };
    }
  } catch (apiErr) {
    console.warn("[loginUser] API login route exception:", apiErr);
    if (isSupabaseConfigured()) {
      return {
        user: null,
        error: "Unable to verify credentials with authentication server. Please try again.",
        redirectUrl: "",
      };
    }
  }

  // 2. Direct client Supabase Auth Fallback

  // 2. Check organizations table in Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const remoteOrgCheck = async () => {
        const { data } = await supabase
          .from("organizations")
          .select("*")
          .ilike("email", trimmedEmail)
          .eq("password", password)
          .maybeSingle();

        if (data) {
          return {
            id: data.id,
            email: data.email,
            role: "organization" as UserRole,
            name: data.name,
            org_id: data.id,
          };
        }
        return null;
      };

      const remoteOrg = await withTimeout(remoteOrgCheck(), 2000).catch(() => null);
      if (remoteOrg) {
        setSessionCookies(remoteOrg);
        return { user: remoteOrg, error: null, redirectUrl: "/organization/dashboard" };
      }
    } catch {
      // ignore
    }
  }

  // 3. Check local registered organizations
  const localOrgs = getStoredOrganizations();
  const localMatch = localOrgs.find(
    (o) => o.email.toLowerCase() === trimmedEmail.toLowerCase() && o.password === password
  );

  if (localMatch) {
    const orgUser: AuthUser = {
      id: localMatch.id,
      email: localMatch.email,
      role: "organization",
      name: localMatch.name,
      org_id: localMatch.id,
    };
    setSessionCookies(orgUser);
    return { user: orgUser, error: null, redirectUrl: "/organization/dashboard" };
  }

  // 4. Default Super Admin fallback
  if (
    trimmedEmail.toLowerCase() === "admin@lumeconnect.com" &&
    password === "admin123"
  ) {
    const superAdmin: AuthUser = {
      id: "superadmin-default",
      email: trimmedEmail,
      role: "super_admin",
      name: "Super Admin",
    };
    setSessionCookies(superAdmin);
    return { user: superAdmin, error: null, redirectUrl: "/superadmin/add-organization" };
  }

  return {
    user: null,
    error: "Invalid email or password. Please verify your credentials.",
    redirectUrl: "",
  };
}

export async function loginSuperAdmin(email: string, password: string) {
  const res = await loginUser(email, password);
  return {
    user: res.user,
    error: res.error,
    isDemoMode: false,
  };
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      await withTimeout(supabase.auth.signOut(), 1500).catch(() => {});
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    document.cookie = "lume_auth_session=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "lume_user_role=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "lume_superadmin_session=; path=/; max-age=0; SameSite=Lax";
  }
}

export const logoutSuperAdmin = logoutUser;

export async function getVerifiedSession(): Promise<{
  authenticated: boolean;
  isVerifiedSuperAdmin: boolean;
  user: AuthUser | null;
}> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) {
      return { authenticated: false, isVerifiedSuperAdmin: false, user: null };
    }
    const json = await res.json();
    return {
      authenticated: Boolean(json.authenticated),
      isVerifiedSuperAdmin: Boolean(json.isVerifiedSuperAdmin),
      user: (json.user as AuthUser | null) ?? null,
    };
  } catch {
    return { authenticated: false, isVerifiedSuperAdmin: false, user: null };
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  // Check local session first
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const getUserPromise = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const userRole: UserRole =
            user.user_metadata?.role === "organization" ? "organization" : "super_admin";
          return {
            id: user.id,
            email: user.email || "",
            role: userRole,
            name: user.user_metadata?.org_name,
          };
        }
        return null;
      };

      return await withTimeout(getUserPromise(), 1500).catch(() => null);
    } catch {
      // ignore
    }
  }

  return null;
}

export const getCurrentAdmin = getCurrentUser;

/**
 * Super Admin adds an organization with Name, Email, and Password
 */
export async function addOrganization(
  name: string,
  email: string,
  password?: string
): Promise<{
  data: Organization | null;
  error: string | null;
}> {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const orgPassword = password?.trim() || "OrgPass123!";

  if (!trimmedName) {
    return { data: null, error: "Organization Name is required" };
  }
  if (!trimmedEmail) {
    return { data: null, error: "Organization Email is required" };
  }
  if (!orgPassword || orgPassword.length < 6) {
    return { data: null, error: "Password must be at least 6 characters" };
  }

  // 1. Call server API endpoint to save directly into Supabase
  try {
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        password: orgPassword,
      }),
    });

    const json = await res.json();
    if (res.ok && json.data) {
      const savedOrg = json.data as Organization;
      storeLocalOrganization(savedOrg);
      return { data: savedOrg, error: null };
    }

    return {
      data: null,
      error: json.error || "Failed to save organization to database.",
    };
  } catch (apiErr) {
    console.warn("API route exception, falling back:", apiErr);
  }

  // Fallback local save if offline
  const newOrg: Organization = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `org-${Date.now()}`,
    name: trimmedName,
    email: trimmedEmail,
    password: orgPassword,
    role: "organization",
    created_at: new Date().toISOString(),
  };

  storeLocalOrganization(newOrg);
  return { data: newOrg, error: null };
}

/**
 * Super Admin deletes a tenant organization via the server-verified DELETE endpoint.
 */
export async function deleteOrganization(id: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  const orgId = id?.trim();
  if (!orgId) {
    return { success: false, error: "Organization ID is required." };
  }

  try {
    const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}`, {
      method: "DELETE",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      return {
        success: false,
        error: json.error || `Failed to delete organization (HTTP ${res.status}).`,
      };
    }

    removeLocalOrganization(orgId, json.email);
    return { success: true, error: null };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Network error deleting organization.";
    return { success: false, error: msg };
  }
}

function removeLocalOrganization(id: string, email?: string) {
  if (typeof window !== "undefined") {
    const existing = getStoredOrganizations();
    const targetEmail = email?.trim().toLowerCase();
    const updated = existing.filter(
      (o) => o.id !== id && (!targetEmail || o.email.toLowerCase() !== targetEmail)
    );
    localStorage.setItem(LOCAL_STORAGE_ORGS_KEY, JSON.stringify(updated));
  }
}

function setSessionCookies(user: AuthUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
    const cookieOptions = "path=/; max-age=86400; SameSite=Lax";
    document.cookie = `lume_auth_session=${encodeURIComponent(JSON.stringify(user))}; ${cookieOptions}`;
    document.cookie = `lume_user_role=${user.role}; ${cookieOptions}`;
    document.cookie = `lume_superadmin_session=${encodeURIComponent(user.email)}; ${cookieOptions}`;
  }
}

function storeLocalOrganization(newOrg: Organization) {
  if (typeof window !== "undefined") {
    const existing = getStoredOrganizations();
    const filtered = existing.filter((o) => o.id !== newOrg.id && o.email !== newOrg.email);
    const updated = [newOrg, ...filtered];
    localStorage.setItem(LOCAL_STORAGE_ORGS_KEY, JSON.stringify(updated));
  }
}

export async function listOrganizations(): Promise<Organization[]> {
  // 1. Fetch real organizations directly from Supabase via server API
  try {
    const res = await fetch("/api/organizations");
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data)) {
        return json.data as Organization[];
      }
    }
  } catch {
    // ignore
  }

  // 2. Direct client query to Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as Organization[];
      }
    } catch {
      // ignore
    }
  }

  return [];
}

function getStoredOrganizations(): Organization[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LOCAL_STORAGE_ORGS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
