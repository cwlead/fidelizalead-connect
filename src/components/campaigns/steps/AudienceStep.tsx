import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, Users } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { CampaignDraft } from '../CampaignWizard';

interface AudienceStepProps {
  draft: CampaignDraft;
  orgId: string;
  onDraftChange: (updates: Partial<CampaignDraft>) => void;
  onNext: () => void;
}

interface Preset {
  key: string;
  label: string;
  params: any;
}

export function AudienceStep({ draft, orgId, onDraftChange, onNext }: AudienceStepProps) {
  const { toast } = useToast();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useState(() => {
    campaignsApi.presets().then(setPresets).catch(console.error);
  });

  const handleSelectPreset = async (preset: Preset) => {
    setSelectedPreset(preset.key);
    const audience = { type: preset.key, params: preset.params };
    onDraftChange({ audience });

    if (!draft.id) {
      setLoading(true);
      try {
        const result = await campaignsApi.create({
          org_id: orgId,
          name: draft.name,
          channel: draft.channel,
          audience
        });
        onDraftChange({ id: result.id });
        toast({ title: 'Campanha criada', description: 'Agora calcule a estimativa do público.' });
      } catch (error) {
        toast({ title: 'Erro', description: 'Falha ao criar campanha', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEstimate = async () => {
    if (!draft.id) return;
    setEstimating(true);
    try {
      const result = await campaignsApi.estimate(draft.id, orgId);
      onDraftChange({ estimatedCount: result.estimated_count });
      toast({ title: 'Estimativa pronta', description: `${result.estimated_count} contatos` });
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao estimar público', variant: 'destructive' });
    } finally {
      setEstimating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Escolha o Público</h3>
        <p className="text-sm text-muted-foreground">
          Mostrando presets prontos. Você pode salvar filtros como Segmento depois.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {presets.map((preset) => (
          <Card
            key={preset.key}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedPreset === preset.key ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleSelectPreset(preset)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5" />
                {preset.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.entries(preset.params).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {draft.audience && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="flex-1">
            {draft.estimatedCount !== undefined ? (
              <p className="text-sm">
                <span className="font-semibold text-2xl text-primary">{draft.estimatedCount}</span>
                {' '}contatos serão atingidos
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Calcule quantos contatos serão atingidos
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleEstimate}
            disabled={!draft.id || estimating}
          >
            <Calculator className="w-4 h-4 mr-2" />
            {estimating ? 'Calculando...' : 'Calcular'}
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!draft.id || loading}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
