import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Rocket } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { campaignsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { CampaignDraft } from '../CampaignWizard';

interface ReviewStepProps {
  draft: CampaignDraft;
  orgId: string;
  onLaunch?: (runInfo: any) => void;
  onClose: () => void;
}

export function ReviewStep({ draft, orgId, onLaunch, onClose }: ReviewStepProps) {
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const handleLaunch = async () => {
    if (!draft.id) return;
    setLaunching(true);
    try {
      // ✅ agora usa o endpoint que materializa e inicia o run
      const result = await campaignsApi.materializeAndRun(draft.id, orgId);

      toast({
        title: 'Campanha iniciada',
        description: draft.throttle?.dry_run ? 'Rodando em modo dry-run primeiro' : 'Enviando agora'
      });

      onLaunch?.(result);
      onClose();
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao iniciar campanha', variant: 'destructive' });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Revisão Final</h3>
        <p className="text-sm text-muted-foreground">
          Confira os detalhes antes de lançar
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Canal & Público</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Canal:</span>
              <Badge variant="secondary">{draft.channel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Público:</span>
              <Badge>{draft.audience?.type || 'N/A'}</Badge>
            </div>
            {draft.estimatedCount !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimativa:</span>
                <span className="font-semibold text-primary">{draft.estimatedCount} contatos</span>
              </div>
            )}
            {draft.estimatedCount === undefined && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Recomenda-se estimar público antes de iniciar.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo:</span>
              <Badge variant="outline">{draft.message?.type || 'N/A'}</Badge>
            </div>
            {draft.message?.body && (
              <div className="p-3 bg-muted rounded text-sm">
                {draft.message.body}
              </div>
            )}
            {draft.message?.template_id && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Template:</span>
                <Badge variant="secondary">{draft.message.template_id}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurações de Envio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Delay texto:</span>
                <span className="ml-2 font-medium">
                  {draft.throttle?.text_delay?.[0]}-{draft.throttle?.text_delay?.[1]}s
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Delay mídia:</span>
                <span className="ml-2 font-medium">
                  {draft.throttle?.media_delay?.[0]}-{draft.throttle?.media_delay?.[1]}s
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Por minuto:</span>
                <span className="ml-2 font-medium">{draft.throttle?.per_minute}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Horário quieto:</span>
                <span className="ml-2 font-medium">
                  {draft.throttle?.quiet_hours?.[0]}-{draft.throttle?.quiet_hours?.[1]}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted rounded">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm">
                {draft.throttle?.dry_run ? 'Dry Run ativado' : 'Envio real'}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
          <Checkbox
            id="policies"
            checked={acceptedPolicies}
            onCheckedChange={(checked) => setAcceptedPolicies(checked as boolean)}
          />
          <Label htmlFor="policies" className="text-sm cursor-pointer">
            Entendo e aceito as políticas anti-ban (quiet hours, frequency cap)
          </Label>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={handleLaunch}
          disabled={!acceptedPolicies || !draft.id || launching}
          size="lg"
        >
          <Rocket className="w-4 h-4 mr-2" />
          {launching ? 'Iniciando...' : 'Iniciar Campanha'}
        </Button>
      </div>
    </div>
  );
}
