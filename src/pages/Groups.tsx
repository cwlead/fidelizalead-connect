import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';

export default function Groups() {
  const navigate = useNavigate();
  const evolutionConnected = false; // TODO: Check real integration status

  if (!evolutionConnected) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Grupos de WhatsApp</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie grupos e membros via Evolution API
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Evolution API não conectado</AlertTitle>
            <AlertDescription>
              Para gerenciar grupos de WhatsApp, você precisa conectar a Evolution API primeiro.
            </AlertDescription>
          </Alert>

          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Conecte a Evolution API
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Configure a integração com Evolution API na página de WhatsApp para começar a
                  gerenciar seus grupos
                </p>
                <Button onClick={() => navigate('/whatsapp')}>Conectar Evolution agora</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Grupos de WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie grupos e membros via Evolution API
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Seus Grupos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              Em breve: listagem e gestão de grupos
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
