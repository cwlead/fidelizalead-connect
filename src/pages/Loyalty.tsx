import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Gift, Award, Coins } from 'lucide-react';

export default function Loyalty() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fidelidade</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie pontos, vouchers e ranking dos clientes
          </p>
        </div>

        <Tabs defaultValue="points" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="points">
              <Coins className="w-4 h-4 mr-2" />
              Pontos
            </TabsTrigger>
            <TabsTrigger value="vouchers">
              <Gift className="w-4 h-4 mr-2" />
              Vouchers
            </TabsTrigger>
            <TabsTrigger value="rank">
              <Award className="w-4 h-4 mr-2" />
              Ranking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="points">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Pontos por Contato</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Em breve: visualização de pontos dos clientes
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vouchers">
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Vouchers</CardTitle>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Emitir Voucher
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Em breve: gestão de vouchers
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rank">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Tiers de Ranking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Em breve: configuração de tiers e membros
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
