import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Campaigns() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campanhas</h1>
            <p className="text-muted-foreground mt-1">
              Crie e gerencie campanhas de WhatsApp
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nova Campanha
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Suas Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              Em breve: listagem e gestão de campanhas
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
