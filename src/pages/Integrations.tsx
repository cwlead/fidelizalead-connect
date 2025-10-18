import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, Clock, Package, ShoppingBag, XCircle } from 'lucide-react';
import { integrationsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Integration {
  integration_id: string;
  status: 'connected' | 'disconnected' | 'error';
  shop_domain?: string;
  account_name?: string;
  scopes?: string[];
  connected_at?: string;
  token_expires_at?: string;
  last_sync_at?: string;
  last_error?: string | null;
}

export default function Integrations() {
  const [shopifyIntegration, setShopifyIntegration] = useState<Integration | null>(null);
  const [blingIntegration, setBlingIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [blingModalOpen, setBlingModalOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [shopifyScopes, setShopifyScopes] = useState('read_orders,read_customers,read_products');
  const [blingScopes, setBlingScopes] = useState('read:orders read:contacts read:products');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const integrations = await integrationsApi.list();
      const shopify = integrations.find((i: any) => i.kind === 'shopify');
      const bling = integrations.find((i: any) => i.kind === 'bling');
      
      if (shopify) setShopifyIntegration(shopify);
      if (bling) setBlingIntegration(bling);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar integrações',
        description: error.response?.data?.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShopifyConnect = async () => {
    if (!shopDomain) {
      toast({
        title: 'Domínio obrigatório',
        description: 'Informe o domínio da sua loja Shopify',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await integrationsApi.shopify.oauthStart({
        shop_domain: shopDomain,
        requested_scopes: shopifyScopes,
      });
      window.location.href = response.authorization_url;
    } catch (error: any) {
      toast({
        title: 'Erro ao conectar Shopify',
        description: error.response?.data?.message || 'Tente novamente',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const handleBlingConnect = async () => {
    setProcessing(true);
    try {
      const response = await integrationsApi.bling.oauthStart({
        requested_scopes: blingScopes,
      });
      window.location.href = response.authorization_url;
    } catch (error: any) {
      toast({
        title: 'Erro ao conectar Bling',
        description: error.response?.data?.message || 'Tente novamente',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const handleTest = async (integrationId: string, kind: 'shopify' | 'bling') => {
    setProcessing(true);
    try {
      const result = kind === 'shopify' 
        ? await integrationsApi.shopify.test(integrationId)
        : await integrationsApi.bling.test(integrationId);
      
      toast({
        title: 'Conexão testada com sucesso',
        description: result.ok ? 'A integração está funcionando corretamente' : 'Falha no teste',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao testar conexão',
        description: error.response?.data?.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSync = async (integrationId: string, kind: 'shopify' | 'bling') => {
    setProcessing(true);
    try {
      kind === 'shopify' 
        ? await integrationsApi.shopify.sync(integrationId)
        : await integrationsApi.bling.sync(integrationId);
      
      toast({
        title: 'Sincronização iniciada',
        description: 'Os dados estão sendo importados',
      });
      
      setTimeout(() => loadIntegrations(), 2000);
    } catch (error: any) {
      toast({
        title: 'Erro ao sincronizar',
        description: error.response?.data?.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Deseja realmente desconectar esta integração?')) return;
    
    setProcessing(true);
    try {
      await integrationsApi.delete(integrationId);
      toast({
        title: 'Integração desconectada',
        description: 'A integração foi removida com sucesso',
      });
      loadIntegrations();
    } catch (error: any) {
      toast({
        title: 'Erro ao desconectar',
        description: error.response?.data?.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string, lastError?: string | null) => {
    if (lastError) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Erro</Badge>;
    }
    
    switch (status) {
      case 'connected':
        return <Badge className="gap-1 bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3" /> Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Erro</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="w-3 h-3" /> Não configurado</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando integrações...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Integrações</h1>
          <p className="text-muted-foreground mt-1">
            Conecte suas plataformas de vendas para importar pedidos, clientes e produtos
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Shopify Card */}
          <Card className="shadow-lg border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Shopify</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Importar pedidos, clientes e produtos
                  </p>
                </div>
              </div>
              {getStatusBadge(shopifyIntegration?.status || 'disconnected', shopifyIntegration?.last_error)}
            </CardHeader>
            <CardContent className="space-y-4">
              {shopifyIntegration?.status === 'connected' ? (
                <>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loja:</span>
                      <span className="font-medium">{shopifyIntegration.shop_domain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conectado em:</span>
                      <span className="font-medium">{formatDate(shopifyIntegration.connected_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última sincronização:</span>
                      <span className="font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(shopifyIntegration.last_sync_at)}
                      </span>
                    </div>
                    {shopifyIntegration.scopes && (
                      <div className="pt-2">
                        <span className="text-muted-foreground">Escopos:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {shopifyIntegration.scopes.map((scope) => (
                            <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {shopifyIntegration.last_error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">{shopifyIntegration.last_error}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleTest(shopifyIntegration.integration_id, 'shopify')}
                      disabled={processing}
                    >
                      Testar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleSync(shopifyIntegration.integration_id, 'shopify')}
                      disabled={processing}
                    >
                      Sincronizar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnect(shopifyIntegration.integration_id)}
                      disabled={processing}
                    >
                      Desconectar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Conecte sua loja Shopify para importar pedidos, clientes e atribuir receita a vouchers.
                  </p>
                  <Button onClick={() => setShopifyModalOpen(true)} className="w-full">
                    Configurar Shopify
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Bling Card */}
          <Card className="shadow-lg border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Bling</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Importar pedidos, clientes e produtos
                  </p>
                </div>
              </div>
              {getStatusBadge(blingIntegration?.status || 'disconnected', blingIntegration?.last_error)}
            </CardHeader>
            <CardContent className="space-y-4">
              {blingIntegration?.status === 'connected' ? (
                <>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conta:</span>
                      <span className="font-medium">{blingIntegration.account_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conectado em:</span>
                      <span className="font-medium">{formatDate(blingIntegration.connected_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Token expira em:</span>
                      <span className="font-medium">{formatDate(blingIntegration.token_expires_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última sincronização:</span>
                      <span className="font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(blingIntegration.last_sync_at)}
                      </span>
                    </div>
                    {blingIntegration.scopes && (
                      <div className="pt-2">
                        <span className="text-muted-foreground">Escopos:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {blingIntegration.scopes.map((scope) => (
                            <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {blingIntegration.last_error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">{blingIntegration.last_error}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleTest(blingIntegration.integration_id, 'bling')}
                      disabled={processing}
                    >
                      Testar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleSync(blingIntegration.integration_id, 'bling')}
                      disabled={processing}
                    >
                      Sincronizar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnect(blingIntegration.integration_id)}
                      disabled={processing}
                    >
                      Desconectar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Conecte seu Bling para espelhar pedidos, clientes e alimentar o programa de fidelidade.
                  </p>
                  <Button onClick={() => setBlingModalOpen(true)} className="w-full">
                    Configurar Bling
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Shopify Config Modal */}
      <Dialog open={shopifyModalOpen} onOpenChange={setShopifyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar Shopify</DialogTitle>
            <DialogDescription>
              Informe os dados da sua loja para iniciar a conexão via OAuth
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shop_domain">Domínio da Loja *</Label>
              <Input
                id="shop_domain"
                placeholder="minhaloja.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopify_scopes">Escopos (separados por vírgula)</Label>
              <Input
                id="shopify_scopes"
                value={shopifyScopes}
                onChange={(e) => setShopifyScopes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShopifyModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleShopifyConnect} disabled={processing}>
              {processing ? 'Conectando...' : 'Conectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bling Config Modal */}
      <Dialog open={blingModalOpen} onOpenChange={setBlingModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar Bling</DialogTitle>
            <DialogDescription>
              Configure os escopos necessários e inicie a conexão via OAuth
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bling_scopes">Escopos (separados por espaço)</Label>
              <Input
                id="bling_scopes"
                value={blingScopes}
                onChange={(e) => setBlingScopes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlingModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBlingConnect} disabled={processing}>
              {processing ? 'Conectando...' : 'Conectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
