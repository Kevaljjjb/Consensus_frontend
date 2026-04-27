"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

type UserRole = string;

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface SignupPayload {
  email: string;
  password: string;
  role?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const REDIRECT_KEY = "consensus-auth-redirect";
const COOKIE_KEY = "auth_token";
const PUBLIC_PATHS = ["/login", "/signup"];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let supabaseSingleton: SupabaseClient | null = null;

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function getSupabaseClient() {
  if (supabaseSingleton) return supabaseSingleton;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  supabaseSingleton = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseSingleton;
}

function setAuthCookie(authenticated: boolean) {
  if (typeof document === "undefined") return;

  if (authenticated) {
    document.cookie = `${COOKIE_KEY}=authenticated; path=/; max-age=604800; samesite=lax`;
  } else {
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
  }
}

function resolveUserFromSession(
  session: Session | null,
): AuthUser | null {
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();

  if (!userId || !email) {
    setAuthCookie(false);
    return null;
  }

  // Use role from user_metadata (set during signup) — no extra API call needed
  const metadataRole = session.user.user_metadata?.role;
  const role =
    typeof metadataRole === "string" && metadataRole.trim()
      ? metadataRole
      : "user";

  setAuthCookie(true);

  return {
    id: userId,
    email,
    role,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncUser = useCallback((session: Session | null) => {
    const nextUser = resolveUserFromSession(session);
    setUser(nextUser);
    // Clear stale cookie when session is gone
    if (!nextUser) {
      setAuthCookie(false);
    }
    return nextUser;
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const client = getSupabaseClient();

        // Race getSession against a timeout — expired token refresh can hang
        const sessionResult = await Promise.race([
          client.auth.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);

        if (!mounted) return;

        const session =
          sessionResult && typeof sessionResult === "object" && "data" in sessionResult
            ? (sessionResult as { data: { session: Session | null } }).data.session
            : null;

        syncUser(session);
      } catch {
        if (!mounted) return;
        setUser(null);
        setAuthCookie(false);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void init();

    let subscription:
      | ReturnType<
          SupabaseClient["auth"]["onAuthStateChange"]
        >["data"]["subscription"]
      | null = null;

    try {
      const client = getSupabaseClient();
      const listener = client.auth.onAuthStateChange(
        async (_event: string, session: Session | null) => {
          if (!mounted) return;
          syncUser(session);
          router.refresh();
        },
      );

      subscription = listener.data.subscription;
    } catch {
      // handled by init and loading state
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [router, syncUser]);

  useEffect(() => {
    if (isLoading || !pathname) return;

    const authenticated = Boolean(user);

    if (!authenticated && !isPublicPath(pathname)) {
      if (typeof window !== "undefined") {
        const redirectTarget = `${window.location.pathname}${window.location.search}`;
        window.localStorage.setItem(REDIRECT_KEY, redirectTarget);
      }
      router.replace("/login");
      return;
    }

    if (authenticated && isPublicPath(pathname)) {
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;

      const redirectParam = params?.get("redirect");
      const storedRedirect =
        typeof window !== "undefined"
          ? window.localStorage.getItem(REDIRECT_KEY)
          : null;

      const nextPath = redirectParam || storedRedirect || "/";

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(REDIRECT_KEY);
      }

      router.replace(nextPath);
    }
  }, [isLoading, pathname, router, user]);

  const login = useCallback(
    async ({ email, password }: LoginPayload) => {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        throw new Error("Email is required.");
      }

      if (!password) {
        throw new Error("Password is required.");
      }

      const client = getSupabaseClient();

      const { data, error } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw new Error(error.message || "Login failed.");
      }

      const authenticatedUser = resolveUserFromSession(data.session);

      if (!authenticatedUser) {
        throw new Error("Unable to load authenticated user.");
      }

      setUser(authenticatedUser);

      const redirectTo =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect") ||
            window.localStorage.getItem(REDIRECT_KEY) ||
            "/"
          : "/";

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(REDIRECT_KEY);
      }

      router.replace(redirectTo);
      router.refresh();
    },
    [router],
  );

  const signup = useCallback(
    async ({ email, password, role = "user" }: SignupPayload) => {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        throw new Error("Email is required.");
      }

      if (!password) {
        throw new Error("Password is required.");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const client = getSupabaseClient();

      const { data, error } = await client.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { role },
        },
      });

      if (error) {
        throw new Error(error.message || "Sign up failed.");
      }

      if (!data.session) {
        throw new Error(
          "Account created! Please check your email to confirm your account before signing in.",
        );
      }

      const authenticatedUser = resolveUserFromSession(data.session);

      if (!authenticatedUser) {
        throw new Error("Unable to load user after sign up.");
      }

      setUser(authenticatedUser);
      router.replace("/");
      router.refresh();
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      const client = getSupabaseClient();
      await client.auth.signOut();
    } finally {
      setUser(null);
      setAuthCookie(false);

      if (
        typeof window !== "undefined" &&
        pathname &&
        !isPublicPath(pathname)
      ) {
        window.localStorage.setItem(REDIRECT_KEY, pathname);
      }

      router.replace("/login");
      router.refresh();
    }
  }, [pathname, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      signup,
      logout,
    }),
    [user, isLoading, login, signup, logout],
  );

  // Block rendering on protected routes while auth is loading — prevents flash
  if (isLoading && pathname && !isPublicPath(pathname)) {
    return (
      <AuthContext.Provider value={value}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fafaf7",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: "4px solid #e2e8f0",
                borderTopColor: "#1e293b",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ color: "#64748b", fontSize: 14 }}>Loading…</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
