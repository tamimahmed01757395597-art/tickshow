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
import type { Database } from "../types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  inviteToken: string;
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
      void refresh();
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
    async ({ email, password, fullName, inviteToken }: SignUpInput) => {
      const client = requireSupabase();
      const token = inviteToken.trim();

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
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
      signOut,
      refresh,
    }),
    [loading, session, roles, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
