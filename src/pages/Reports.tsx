import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Reports() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Análise de campanhas e métricas de performance
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Relatório de Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              Em breve: relatórios detalhados de campanhas
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
