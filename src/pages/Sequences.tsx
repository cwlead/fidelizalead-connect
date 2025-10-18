import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Sequences() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sequências</h1>
            <p className="text-muted-foreground mt-1">
              Automatize o relacionamento com sequências temporais
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nova Sequência
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Suas Sequências</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              Em breve: criação e gestão de sequências
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
