// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '@/lib/api';
import type { User, Organization } from '@/types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// habilita modo demo só se explicitamente setado
const DEMO_ENABLED = import.meta.env.VITE_ENABLE_DEMO === 'true';
const DEMO_EMAIL = 'teste@fidelizalead.com';
const DEMO_PASS  = 'teste123';
const DEMO_TOKEN = 'mock_token_123';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // hidrata do localStorage
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    // se token demo e modo demo ligado, popula mock
    if (DEMO_ENABLED && token === DEMO_TOKEN) {
      const mockUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        org_id: '223e4567-e89b-12d3-a456-426614174000',
        email: DEMO_EMAIL,
        name: 'Usuário Teste',
        role: 'admin',
        created_at: new Date().toISOString(),
      };
      const mockOrg: Organization = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Loja Demo',
        segmento: 'Varejo',
        features: {},
        created_at: new Date().toISOString(),
      };
      setUser(mockUser);
      setOrganization(mockOrg);
      setLoading(false);
      return;
    }

    // fluxo real
    authApi
      .me()
      .then(({ user, organization }) => {
        setUser(user);
        setOrganization(organization);
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    // modo demo opcional
    if (DEMO_ENABLED && email === DEMO_EMAIL && password === DEMO_PASS) {
      localStorage.setItem('auth_token', DEMO_TOKEN);
      toast.success('Login realizado com sucesso! (Demo)');
      // popula estado com mock
      const mockUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        org_id: '223e4567-e89b-12d3-a456-426614174000',
        email: DEMO_EMAIL,
        name: 'Usuário Teste',
        role: 'admin',
        created_at: new Date().toISOString(),
      };
      const mockOrg: Organization = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Loja Demo',
        segmento: 'Varejo',
        features: {},
        created_at: new Date().toISOString(),
      };
      setUser(mockUser);
      setOrganization(mockOrg);
      return;
    }

    // fluxo real: login -> salva token -> me() -> set estado
    try {
      const { token } = await authApi.login(email, password); // backend responde { token }
      localStorage.setItem('auth_token', token);
      const { user, organization } = await authApi.me();       // popula contexto ANTES de retornar
      setUser(user);
      setOrganization(organization);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      // nosso backend manda { error: 'Invalid credentials' }
      const msg = error?.response?.data?.error || error?.response?.data?.message || 'Erro ao fazer login';
      toast.error(msg);
      localStorage.removeItem('auth_token');
      setUser(null);
      setOrganization(null);
      throw error;
    }
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('auth_token');
    setUser(null);
    setOrganization(null);
    toast.success('Logout realizado com sucesso!');
  };

  return (
    <AuthContext.Provider value={{ user, organization, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
