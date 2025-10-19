import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { onboardingApi, evolutionApi } from '@/lib/api';
import { Check, Loader2 } from 'lucide-react';

type OnboardingData = {
  primary_identifier: 'email' | 'phone' | 'cpf' | null;
  erp_slug: string | null;
  erp_base_url: string | null;
  botconversa_api_key: string | null;
  evolution_instance_name: string | null;
  evolution_webhook_url: string | null;
  evolution_connected: boolean;
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OnboardingData>({
    primary_identifier: null,
    erp_slug: null,
    erp_base_url: null,
    botconversa_api_key: null,
    evolution_instance_name: null,
    evolution_webhook_url: null,
    evolution_connected: false,
  });

  const [activeSection, setActiveSection] = useState<string>('identifier');
  const [saving, setSaving] = useState<string | null>(null);

  // Evolution state
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [evolutionInstance, setEvolutionInstance] = useState<string | null>(null);

  // Form states
  const [identifier, setIdentifier] = useState<'email' | 'phone' | 'cpf'>('email');
  const [erpSlug, setErpSlug] = useState('custom');
  const [erpUrl, setErpUrl] = useState('');
  const [botconversaKey, setBotconversaKey] = useState('');

  useEffect(() => {
    loadOnboarding();
  }, []);

  const loadOnboarding = async () => {
    try {
      const result = await onboardingApi.get();
      setData(result);
      
      if (result.primary_identifier) setIdentifier(result.primary_identifier);
      if (result.erp_slug) setErpSlug(result.erp_slug);
      if (result.erp_base_url) setErpUrl(result.erp_base_url);
      if (result.botconversa_api_key) setBotconversaKey(result.botconversa_api_key);
      if (result.evolution_instance_name) setEvolutionInstance(result.evolution_instance_name);

      // Abre primeira seção incompleta
      if (!result.primary_identifier) setActiveSection('identifier');
      else if (!result.erp_base_url) setActiveSection('erp');
      else if (!result.evolution_connected) setActiveSection('evolution');
      else if (!result.botconversa_api_key || result.botconversa_api_key.includes('••••')) setActiveSection('botconversa');
      else setActiveSection('summary');
    } catch (error) {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveIdentifier = async () => {
    setSaving('identifier');
    try {
      await onboardingApi.save({ primary_identifier: identifier });
      setData({ ...data, primary_identifier: identifier });
      toast({ title: 'Identificador salvo' });
      setActiveSection('erp');
    } catch (error) {
      toast({ title: 'Erro ao salvar identificador', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const saveErp = async () => {
    if (!erpUrl || !erpUrl.startsWith('https://')) {
      toast({ title: 'URL deve começar com https://', variant: 'destructive' });
      return;
    }

    setSaving('erp');
    try {
      await onboardingApi.save({ erp_slug: erpSlug, erp_base_url: erpUrl });
      setData({ ...data, erp_slug: erpSlug, erp_base_url: erpUrl });
      toast({ title: 'ERP salvo' });
      setActiveSection('evolution');
    } catch (error) {
      toast({ title: 'Erro ao salvar ERP', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const generateQR = async () => {
    setEvolutionLoading(true);
    try {
      const result = await evolutionApi.connect();
      
      if (!result.ok) {
        const errorMsg = result.error?.response?.message || result.error?.message || 'Erro ao gerar QR';
        toast({ title: errorMsg, variant: 'destructive' });
        setEvolutionLoading(false);
        return;
      }

      setEvolutionInstance(result.instance);
      
      if (result.qrBase64) {
        const qr = result.qrBase64.startsWith('data:') 
          ? result.qrBase64 
          : `data:image/png;base64,${result.qrBase64}`;
        setQrCode(qr);
      } else {
        toast({ title: 'QR não disponível ainda', description: 'Tente novamente em alguns segundos' });
        setTimeout(generateQR, 3000);
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error?.message || error?.message || 'Erro ao conectar Evolution';
      toast({ title: errorMsg, variant: 'destructive' });
    } finally {
      setEvolutionLoading(false);
    }
  };

  const markEvolutionConnected = async () => {
    if (!evolutionInstance) {
      toast({ title: 'Gere o QR primeiro', variant: 'destructive' });
      return;
    }

    setSaving('evolution');
    try {
      await onboardingApi.save({
        evolution_instance_name: evolutionInstance,
        evolution_connected: true,
      });
      setData({ ...data, evolution_instance_name: evolutionInstance, evolution_connected: true });
      toast({ title: 'WhatsApp conectado' });
      setActiveSection('botconversa');
    } catch (error) {
      toast({ title: 'Erro ao salvar conexão', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const saveBotconversa = async () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(botconversaKey)) {
      toast({ title: 'API-KEY deve ser um UUID v4 válido', variant: 'destructive' });
      return;
    }

    setSaving('botconversa');
    try {
      await onboardingApi.save({ botconversa_api_key: botconversaKey });
      toast({ title: 'BotConversa configurado' });
      setActiveSection('summary');
      loadOnboarding(); // reload para pegar key mascarada
    } catch (error) {
      toast({ title: 'Erro ao salvar BotConversa', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const isCompleted = (section: string) => {
    switch (section) {
      case 'identifier': return !!data.primary_identifier;
      case 'erp': return !!data.erp_base_url;
      case 'evolution': return data.evolution_connected;
      case 'botconversa': return !!data.botconversa_api_key && !data.botconversa_api_key.includes('••••');
      default: return false;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuração inicial</h1>
          <p className="text-muted-foreground mt-2">
            Complete as etapas abaixo para começar a usar o sistema
          </p>
        </div>

        <Accordion type="single" value={activeSection} onValueChange={setActiveSection} collapsible>
          {/* 1. Identificador principal */}
          <AccordionItem value="identifier">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                {isCompleted('identifier') && <Check className="h-5 w-5 text-green-600" />}
                <span>1. Identificador principal</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Escolha como seus clientes serão identificados de forma única.
                </p>
                <RadioGroup value={identifier} onValueChange={(v: any) => setIdentifier(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="email" id="email" />
                    <Label htmlFor="email">Email</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="phone" id="phone" />
                    <Label htmlFor="phone">Telefone</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cpf" id="cpf" />
                    <Label htmlFor="cpf">CPF</Label>
                  </div>
                </RadioGroup>
                <Button onClick={saveIdentifier} disabled={saving === 'identifier'}>
                  {saving === 'identifier' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar identificador
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 2. ERP principal */}
          <AccordionItem value="erp">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                {isCompleted('erp') && <Check className="h-5 w-5 text-green-600" />}
                <span>2. ERP principal</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Informe o endpoint onde validaremos Pedidos e NFs.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="erp-slug">Sistema ERP</Label>
                  <Select value={erpSlug} onValueChange={setErpSlug}>
                    <SelectTrigger id="erp-slug">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="erp-url">Base URL *</Label>
                  <Input
                    id="erp-url"
                    placeholder="https://api.meuerp.com"
                    value={erpUrl}
                    onChange={(e) => setErpUrl(e.target.value)}
                  />
                </div>
                <Button onClick={saveErp} disabled={saving === 'erp' || !erpUrl}>
                  {saving === 'erp' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar ERP
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 3. Evolution API */}
          <AccordionItem value="evolution">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                {isCompleted('evolution') && <Check className="h-5 w-5 text-green-600" />}
                <span>3. WhatsApp (Evolution)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Escaneie o QR pelo WhatsApp do aparelho que ficará conectado.
                </p>
                
                {!qrCode && (
                  <Button onClick={generateQR} disabled={evolutionLoading}>
                    {evolutionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {evolutionLoading ? 'Gerando QR...' : 'Gerar QR'}
                  </Button>
                )}

                {qrCode && (
                  <div className="space-y-4">
                    <div className="flex justify-center p-4 bg-white rounded-lg">
                      <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={generateQR}>
                        Recarregar QR
                      </Button>
                      <Button onClick={markEvolutionConnected} disabled={saving === 'evolution'}>
                        {saving === 'evolution' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Marcar como conectado
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 4. BotConversa */}
          <AccordionItem value="botconversa">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                {isCompleted('botconversa') && <Check className="h-5 w-5 text-green-600" />}
                <span>4. BotConversa</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Cole a API-KEY da sua conta para futuras integrações.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="botconversa-key">API-KEY *</Label>
                  <Input
                    id="botconversa-key"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={botconversaKey}
                    onChange={(e) => setBotconversaKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    <a 
                      href="https://app.botconversa.com.br/115695/settings/integrations" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Onde encontrar minha API-KEY?
                    </a>
                  </p>
                </div>
                <Button onClick={saveBotconversa} disabled={saving === 'botconversa' || !botconversaKey}>
                  {saving === 'botconversa' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar API-KEY
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 5. Resumo */}
          <AccordionItem value="summary">
            <AccordionTrigger>
              <span>5. Resumo</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm font-medium">Identificador principal</div>
                    <div className="text-sm text-muted-foreground">
                      {data.primary_identifier || 'Não configurado'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">ERP Base URL</div>
                    <div className="text-sm text-muted-foreground">
                      {data.erp_base_url || 'Não configurado'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Evolution (WhatsApp)</div>
                    <div className="text-sm text-muted-foreground">
                      {data.evolution_connected ? `✓ Conectado (${data.evolution_instance_name})` : 'Não conectado'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">BotConversa API-KEY</div>
                    <div className="text-sm text-muted-foreground">
                      {data.botconversa_api_key || 'Não configurado'}
                    </div>
                  </div>
                </div>
                <Button onClick={() => navigate('/dashboard')}>
                  Concluir e ir para Dashboard
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </AppLayout>
  );
}
