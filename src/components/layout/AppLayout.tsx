import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  GitBranch,
  Award,
  MessageCircle,
  UsersRound,
  BarChart3,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Contatos', href: '/contatos', icon: Users },
  { name: 'Campanhas', href: '/campanhas', icon: Megaphone },
  { name: 'Sequências', href: '/sequencias', icon: GitBranch },
  { name: 'Fidelidade', href: '/fidelidade', icon: Award },
  { name: 'WhatsApp', href: '/whatsapp', icon: MessageCircle },
  { name: 'Grupos', href: '/grupos', icon: UsersRound },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, organization, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2 h-16 px-6 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-primary">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-sidebar-foreground">Fidelizalead</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-2 h-auto hover:bg-sidebar-accent"
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-sm">
                  <span className="font-medium text-sidebar-foreground">{user?.name || user?.email}</span>
                  <span className="text-xs text-muted-foreground">{organization?.name}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:pl-64">
        <main className="h-full overflow-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
