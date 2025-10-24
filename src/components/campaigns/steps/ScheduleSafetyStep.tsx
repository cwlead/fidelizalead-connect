import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { CampaignDraft } from '../CampaignWizard';

interface ScheduleSafetyStepProps {
  draft: CampaignDraft;
  orgId: string;
  onDraftChange: (updates: Partial<CampaignDraft>) => void;
  onNext: () => void;
}

export function ScheduleSafetyStep({ draft, orgId, onDraftChange, onNext }: ScheduleSafetyStepProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    if (!draft.id) return;
    setSaving(true);
    try {
      await campaignsApi.schedule(draft.id, draft.throttle, orgId);
      toast({ title: 'Configurações salvas', description: 'Pronto para revisão final.' });
      onNext();
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar configurações', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateThrottle = (key: string, value: any) => {
    onDraftChange({
      throttle: { ...draft.throttle, [key]: value }
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Envio & Segurança</h3>
        <p className="text-sm text-muted-foreground">
          Delays maiores para mídia reduzem risco de bloqueio.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5" />
            Throttling & Delays
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Texto - Delay Min (s)</Label>
              <Input
                type="number"
                value={draft.throttle?.text_delay?.[0] || 0}
                onChange={(e) =>
                  updateThrottle('text_delay', [Number(e.target.value), draft.throttle?.text_delay?.[1] || 30])
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Texto - Delay Max (s)</Label>
              <Input
                type="number"
                value={draft.throttle?.text_delay?.[1] || 30}
                onChange={(e) =>
                  updateThrottle('text_delay', [draft.throttle?.text_delay?.[0] || 0, Number(e.target.value)])
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mídia - Delay Min (s)</Label>
              <Input
                type="number"
                value={draft.throttle?.media_delay?.[0] || 30}
                onChange={(e) =>
                  updateThrottle('media_delay', [Number(e.target.value), draft.throttle?.media_delay?.[1] || 60])
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Mídia - Delay Max (s)</Label>
              <Input
                type="number"
                value={draft.throttle?.media_delay?.[1] || 60}
                onChange={(e) =>
                  updateThrottle('media_delay', [draft.throttle?.media_delay?.[0] || 30, Number(e.target.value)])
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mensagens por minuto</Label>
            <Input
              type="number"
              value={draft.throttle?.per_minute || 6}
              onChange={(e) => updateThrottle('per_minute', Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horário silencioso - Início</Label>
              <Input
                type="time"
                value={draft.throttle?.quiet_hours?.[0] || '22:00'}
                onChange={(e) =>
                  updateThrottle('quiet_hours', [e.target.value, draft.throttle?.quiet_hours?.[1] || '08:00'])
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Horário silencioso - Fim</Label>
              <Input
                type="time"
                value={draft.throttle?.quiet_hours?.[1] || '08:00'}
                onChange={(e) =>
                  updateThrottle('quiet_hours', [draft.throttle?.quiet_hours?.[0] || '22:00', e.target.value])
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label>Dry Run (teste sem enviar)</Label>
              <p className="text-xs text-muted-foreground">Habilitado na primeira execução</p>
            </div>
            <Switch
              checked={draft.throttle?.dry_run ?? true}
              onCheckedChange={(checked) => updateThrottle('dry_run', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Frequency Cap (horas entre envios)</Label>
            <Input
              type="number"
              value={draft.throttle?.safeguards?.frequency_cap_hours || 72}
              onChange={(e) =>
                updateThrottle('safeguards', { frequency_cap_hours: Number(e.target.value) })
              }
            />
            <p className="text-xs text-muted-foreground">
              Não envia para o mesmo contato antes deste período
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleApply} disabled={!draft.id || saving}>
          {saving ? 'Salvando...' : 'Aplicar e Continuar'}
        </Button>
      </div>
    </div>
  );
}
