import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  SUPER_ADMIN_EMAIL,
} from "@/lib/supabase/server";

function withTimeout<T>(promise: PromiseLike<T>, ms = 2000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

/**
 * Strict password verifier supporting plaintext, SHA-256 hex, and salted hashes
 */
function verifyPassword(inputPassword: string, storedPassword?: string | null): boolean {
  if (!storedPassword || !inputPassword) return false;

  // 1. Plaintext direct match
  if (storedPassword === inputPassword) {
    return true;
  }

  // 2. Standard SHA-256 hex digest
  const sha256 = crypto.createHash("sha256").update(inputPassword).digest("hex");
  if (storedPassword.toLowerCase() === sha256.toLowerCase()) {
    return true;
  }

  // 3. Salted hash format "salt:sha256"
  if (storedPassword.includes(":")) {
    const [salt, storedHash] = storedPassword.split(":");
    if (salt && storedHash) {
      const saltedHash = crypto.createHash("sha256").update(salt + inputPassword).digest("hex");
      try {
        if (crypto.timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(saltedHash, "hex"))) {
          return true;
        }
      } catch {
        if (storedHash.toLowerCase() === saltedHash.toLowerCase()) {
          return true;
        }
      }
    }
  }

  return false;
}

async function syncLoginCredentials(
  db: SupabaseClient,
  email: string,
  role: string,
  name: string
) {
  try {
    await db.from("login_credentials").upsert(
      [
        {
          email,
          role,
          name,
          last_login: new Date().toISOString(),
        },
      ],
      { onConflict: "email" }
    );
  } catch {
    // Graceful fallback if table is not yet created in Supabase
  }
}

async function ensureSupabaseAuthSession(
  supabaseSSR: SupabaseClient,
  supabaseAdmin: SupabaseClient | null,
  email: string,
  password: string,
  role: "super_admin" | "organization",
  orgName: string
): Promise<boolean> {
  try {
    const authPromise = supabaseSSR.auth.signInWithPassword({ email, password });
    const { data: signInData, error: signInError } = await withTimeout(authPromise, 2000);

    if (!signInError && signInData?.user) {
      const existingMetaRole = signInData.user.user_metadata?.role;
      if (supabaseAdmin && existingMetaRole !== role) {
        await supabaseAdmin.auth.admin.updateUserById(signInData.user.id, {
          user_metadata: {
            ...signInData.user.user_metadata,
            role,
            org_name: orgName,
          },
        }).catch(() => null);
      }
      return true;
    }
  } catch {
    // Timeout or network exception during remote Auth session check
  }
  return false;
}

function createAuthenticatedResponse(
  user: { id: string; email: string; role: string; name?: string; org_id?: string },
  redirectUrl: string,
  message: string
) {
  const response = NextResponse.json({
    success: true,
    message,
    user,
    redirectUrl,
  });

  const cookieOptions = {
    path: "/",
    httpOnly: false,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };

  response.cookies.set("lume_user_role", user.role, cookieOptions);
  response.cookies.set("lume_auth_session", JSON.stringify(user), cookieOptions);

  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    const trimmedEmail = email?.trim()?.toLowerCase();
    const rawPassword = password?.trim();

    if (!trimmedEmail || !rawPassword) {
      return NextResponse.json(
        { error: "Please enter both Email ID and Password." },
        { status: 400 }
      );
    }

    if (rawPassword.length < 6) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    let supabaseSSR: SupabaseClient | null = null;
    let supabaseAdmin: SupabaseClient | null = null;

    try {
      supabaseSSR = await createSupabaseServerClient();
      supabaseAdmin = createSupabaseAdminClient();
    } catch {
      // Offline / fallback mode
    }

    const db = supabaseAdmin ?? supabaseSSR;

    let existingOrg: {
      id: string;
      email: string;
      password?: string;
      role?: string;
      name?: string;
      status?: string;
    } | null = null;

    let credRow: {
      id: string;
      email: string;
      password?: string;
      role?: string;
      name?: string;
      status?: string;
    } | null = null;

    if (db) {
      try {
        const orgPromise = db
          .from("organizations")
          .select("*")
          .ilike("email", trimmedEmail)
          .maybeSingle();
        const { data: orgData } = await withTimeout(orgPromise, 1800);
        existingOrg = orgData;
      } catch {
        // DB lookup fallback
      }

      try {
        const credPromise = db
          .from("login_credentials")
          .select("*")
          .ilike("email", trimmedEmail)
          .maybeSingle();
        const { data: credData } = await withTimeout(credPromise, 1800);
        credRow = credData;
      } catch {
        // DB lookup fallback
      }
    }

    // =========================================================================
    // CASE A: Super Admin Login (admin@lumeconnect.com or role === "super_admin")
    // =========================================================================
    const isSuperAdminAccount =
      trimmedEmail === SUPER_ADMIN_EMAIL || existingOrg?.role === "super_admin";

    if (isSuperAdminAccount) {
      const adminDisplayName =
        existingOrg?.name || credRow?.name || "TravLume Super Admin";

      // 1. Check seeded Super Admin password ("admin123" or SHA-256 hash)
      const isSeededAdminPassword =
        rawPassword === "admin123" ||
        verifyPassword(rawPassword, "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9");

      // 2. Check stored DB password if present
      const dbPasswordMatches =
        (existingOrg?.password ? verifyPassword(rawPassword, existingOrg.password) : false) ||
        (credRow?.password ? verifyPassword(rawPassword, credRow.password) : false);

      let verifiedSuperAdmin = isSeededAdminPassword || dbPasswordMatches;

      // 3. If SSR client available, also test Supabase Auth (auth.users)
      if (supabaseSSR && !verifiedSuperAdmin) {
        try {
          const authSignIn = await withTimeout(
            supabaseSSR.auth.signInWithPassword({
              email: trimmedEmail,
              password: rawPassword,
            }),
            1800
          );
          if (!authSignIn.error && authSignIn.data?.user) {
            verifiedSuperAdmin = true;
          }
        } catch {
          // Auth check timeout
        }
      }

      // FAIL CLOSED: If credentials do not match, reject with 401
      if (!verifiedSuperAdmin) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      // Establish Supabase SSR session in background if possible
      if (supabaseSSR) {
        await ensureSupabaseAuthSession(
          supabaseSSR,
          supabaseAdmin,
          trimmedEmail,
          rawPassword,
          "super_admin",
          adminDisplayName
        ).catch(() => null);
      }

      if (db) {
        await syncLoginCredentials(db, trimmedEmail, "super_admin", adminDisplayName).catch(() => null);
      }

      const adminUser = {
        id: existingOrg?.id || "superadmin-default",
        email: existingOrg?.email || trimmedEmail,
        role: "super_admin",
        name: existingOrg?.name || adminDisplayName,
      };

      return createAuthenticatedResponse(
        adminUser,
        "/superadmin/add-organization",
        "Super Admin authenticated successfully."
      );
    }

    // =========================================================================
    // CASE B: Organization Login
    // =========================================================================
    if (existingOrg && existingOrg.role === "organization") {
      // 1. Enforce account suspension check
      const isSuspended =
        existingOrg.status === "suspended" || credRow?.status === "suspended";

      if (isSuspended) {
        return NextResponse.json(
          { error: "This organization account has been suspended. Please contact the Super Administrator." },
          { status: 403 }
        );
      }

      // 2. Strict password verification
      let authenticated =
        verifyPassword(rawPassword, existingOrg.password) ||
        (credRow?.password ? verifyPassword(rawPassword, credRow.password) : false);

      if (!authenticated && supabaseSSR) {
        try {
          const { data: authCheck } = await withTimeout(
            supabaseSSR.auth.signInWithPassword({
              email: trimmedEmail,
              password: rawPassword,
            }),
            1800
          );
          authenticated = Boolean(authCheck?.user);
        } catch {
          // Auth timeout
        }
      }

      // FAIL CLOSED: If password does not match, return 401
      if (!authenticated) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      // Update audit timestamp
      if (db) {
        try {
          await db
            .from("organizations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", existingOrg.id);
        } catch {
          // ignore
        }

        try {
          await syncLoginCredentials(
            db,
            trimmedEmail,
            "organization",
            existingOrg.name || trimmedEmail.split("@")[0]
          );
        } catch {
          // ignore
        }
      }

      if (supabaseSSR) {
        await ensureSupabaseAuthSession(
          supabaseSSR,
          supabaseAdmin,
          trimmedEmail,
          rawPassword,
          "organization",
          existingOrg.name || "Organization"
        ).catch(() => null);
      }

      const orgUser = {
        id: existingOrg.id,
        email: existingOrg.email,
        role: "organization",
        name: existingOrg.name,
        org_id: existingOrg.id,
      };

      return createAuthenticatedResponse(
        orgUser,
        "/organization/dashboard",
        "Organization authenticated successfully."
      );
    }

    // =========================================================================
    // CASE C: Unknown or Unregistered Account -> FAIL CLOSED
    // =========================================================================
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal authentication error";
    console.error("[API /api/auth/login] Exception:", msg);
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
}
