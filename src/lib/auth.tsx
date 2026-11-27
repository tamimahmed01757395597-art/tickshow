import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, requireSupabase, supabase } from "./supabase";
import { sha256Hex } from "./tokens";
import { clearBookings } from "../data/bookings";
import type { Database } from "../types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  inviteToken?: string;
  returnTo?: string;
};

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  requestPasswordReset: (email: string, returnTo?: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateProfileName: (fullName: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<AppRole[]>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return [];
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setSession(null);
      setRoles([]);
      setLoading(false);
      return [];
    }

    const current = data.session;
    setSession(current);

    if (!current) {
      setRoles([]);
      setLoading(false);
      return [];
    }

    // Check both the SECURITY DEFINER helper and the readable role tables.
    // Either source is enough: has_role sees assignments even when RLS is
    // restrictive, while direct reads cover older databases without that RPC.
    const [{ data: isAdminResult }, { data: assignments }, { data: availableRoles }] =
      await Promise.all([
        supabase.rpc("has_role", { p_role: "admin" }),
        supabase.from("user_roles").select("role_id").eq("user_id", current.user.id),
        supabase.from("roles").select("id, name"),
      ]);

    const roleNames = new Map((availableRoles ?? []).map((role) => [role.id, role.name]));
    const nextRoles = new Set<AppRole>(
      (assignments ?? [])
        .map((assignment) => roleNames.get(assignment.role_id))
        .filter((name): name is AppRole => Boolean(name)),
    );
    if (isAdminResult) nextRoles.add("admin");
    setRoles([...nextRoles]);
    setLoading(false);
    return [...nextRoles];
  }, []);

  useEffect(() => {
    void refresh();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refresh(), 0);
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = requireSupabase();
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const signUp = useCallback(
    async ({ email, password, fullName, inviteToken, returnTo }: SignUpInput) => {
      const client = requireSupabase();
      const token = inviteToken?.trim() ?? "";

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?flow=confirm${
            returnTo ? `&next=${encodeURIComponent(returnTo)}` : ""
          }`,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("The account could not be created.");

      if (token) {
        const tokenHash = await sha256Hex(token);
        const { error: invitationError } = await client.rpc("accept_admin_invitation", {
          p_user_id: data.user.id,
          p_token_hash: tokenHash,
        });
        if (invitationError) {
          throw new Error(`Account created, but the invitation failed: ${invitationError.message}`);
        }
      }

      await refresh();
      return { needsConfirmation: !data.session };
    },
    [refresh],
  );

  const requestPasswordReset = useCallback(async (email: string, returnTo?: string) => {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?flow=recovery${
        returnTo ? `&next=${encodeURIComponent(returnTo)}` : ""
      }`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const updateProfileName = useCallback(
    async (fullName: string) => {
      const currentUser = session?.user;
      if (!currentUser) throw new Error("Sign in to update your account.");
      const normalizedName = fullName.trim();
      if (!normalizedName || normalizedName.length > 160) {
        throw new Error("Enter a name between 1 and 160 characters.");
      }
      const { error } = await requireSupabase()
        .from("profiles")
        .update({ full_name: normalizedName })
        .eq("id", currentUser.id)
        .select("id")
        .single();
      if (error) throw error;
      await refresh();
    },
    [refresh, session],
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      const client = requireSupabase();
      const email = session?.user.email;
      if (!email) throw new Error("Your account email could not be verified.");
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const { error } = await client.rpc("delete_own_account");
      if (error) throw error;
      clearBookings();
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      setSession(null);
      setRoles([]);
    },
    [session],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setRoles([]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      roles,
      isAdmin: roles.includes("admin"),
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      updateProfileName,
      deleteAccount,
      signOut,
      refresh,
    }),
    [
      loading,
      session,
      roles,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      updateProfileName,
      deleteAccount,
      signOut,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
