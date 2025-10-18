import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Smartphone } from 'lucide-react';

export default function WhatsApp() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">WhatsApp</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas integrações de envio (BotConversa e Evolution)
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nova Integração
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Smartphone className="w-5 h-5 text-success" />
                </div>
                <div>
                  <CardTitle>BotConversa</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Integração para envio de mensagens
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Não configurado</Badge>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Configurar
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Evolution API</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Para grupos e mensagens
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Não configurado</Badge>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Configurar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
