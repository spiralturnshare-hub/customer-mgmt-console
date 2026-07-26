/**
 * AuthContext - Supabase認証状態管理
 * customer-mgmt-console用
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, getCurrentUser } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  organizationId: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const fetchOrgId = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('system_members')
        .select('organization_id')
        .eq('auth_user_id', userId)
        .single();
      if (!error && data?.organization_id) {
        setOrganizationId(data.organization_id);
      }
    } catch {
      // organization_idカラムが存在しない場合は無視
    }
  };

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      if (u) fetchOrgId(u.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchOrgId(u.id);
      } else {
        setOrganizationId(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, organizationId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
