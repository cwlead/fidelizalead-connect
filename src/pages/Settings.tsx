import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users } from 'lucide-react';

export default function Settings() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie sua organização e usuários
          </p>
        </div>

        <Tabs defaultValue="organization" className="space-y-4">
          <TabsList>
            <TabsTrigger value="organization">
              <Building2 className="w-4 h-4 mr-2" />
              Organização
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organization">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Dados da Organização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Em breve: edição dos dados da organização
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Usuários da Organização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Em breve: gestão de usuários
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
