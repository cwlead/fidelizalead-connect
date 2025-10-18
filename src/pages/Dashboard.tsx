import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { reportsApi } from '@/lib/api';
import { Users, Send, Gift, TrendingUp, MessageCircle, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi
      .dashboard()
      .then((data) => setStats(data))
      .catch((error) => {
        // Modo demo: dados mock
        const token = localStorage.getItem('auth_token');
        if (token === 'mock_token_123') {
          setStats({
            active_contacts: 1247,
            messages_24h: 423,
            vouchers_redeemed: 89,
            attributed_revenue: 12450.50,
            active_campaigns: 5,
            reactivated_30d: 156,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    {
      title: 'Base Ativa',
      value: stats?.active_contacts || 0,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Envios (24h)',
      value: stats?.messages_24h || 0,
      icon: Send,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Vouchers Resgatados',
      value: stats?.vouchers_redeemed || 0,
      icon: Gift,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Receita Atribuída',
      value: `R$ ${(stats?.attributed_revenue || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: TrendingUp,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Campanhas Ativas',
      value: stats?.active_campaigns || 0,
      icon: MessageCircle,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Reativação (30d)',
      value: stats?.reactivated_30d || 0,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral das suas métricas de fidelização</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-10 w-10 bg-muted rounded-lg" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-20 mb-2" />
                  <div className="h-3 bg-muted rounded w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => (
              <Card key={kpi.title} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">Atualizado agora</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              Nenhuma atividade recente para exibir
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
