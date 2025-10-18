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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Modo demo com usuario mock
      if (token === 'mock_token_123') {
        const mockUser: User = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          org_id: '223e4567-e89b-12d3-a456-426614174000',
          email: 'teste@fidelizalead.com',
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

      authApi
        .me()
        .then(({ user, organization }) => {
          setUser(user);
          setOrganization(organization);
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    // Usuario de teste
    if (email === 'teste@fidelizalead.com' && password === 'teste123') {
      const mockUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        org_id: '223e4567-e89b-12d3-a456-426614174000',
        email: 'teste@fidelizalead.com',
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
      localStorage.setItem('auth_token', 'mock_token_123');
      setUser(mockUser);
      setOrganization(mockOrg);
      toast.success('Login realizado com sucesso! (Modo Demo)');
      return;
    }

    try {
      const response = await authApi.login(email, password);
      localStorage.setItem('auth_token', response.token);
      setUser(response.user);
      setOrganization(response.organization);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao fazer login');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      setOrganization(null);
      toast.success('Logout realizado com sucesso!');
    }
  };

  return (
    <AuthContext.Provider value={{ user, organization, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
