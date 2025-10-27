import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, Users } from 'lucide-react';
import { campaignsApi, wppApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { CampaignDraft } from '../CampaignWizard';
import { useEffect, useMemo, useState } from 'react';

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

interface WppGroup {
  id: string;
  org_id: string;
  wa_group_id: string;
  subject: string | null;
  picture_url: string | null;
}

type AudienceSource = 'wpp_group' | 'all_contacts'; // futuras: 'store_1', 'store_2'

export function AudienceStep({ draft, orgId, onDraftChange, onNext }: AudienceStepProps) {
  const { toast } = useToast();

  // --- origem do público ---
  const [source, setSource] = useState<AudienceSource | null>(null);

  // --- grupos ---
  const [groups, setGroups] = useState<WppGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // --- presets (para origem = grupo) ---
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Carrega presets uma vez (usados só quando source === 'wpp_group')
  useEffect(() => {
    let alive = true;
    campaignsApi.presets()
      .then((data) => { if (alive) setPresets(data || []); })
      .catch(console.error);
    return () => { alive = false; };
  }, []);

  // Carrega grupos quando a origem selecionada for "grupo"
  useEffect(() => {
    if (source !== 'wpp_group') return;
    (async () => {
      try {
        setGroupsLoading(true);
        const data = await wppApi.groups(orgId);
        setGroups(data || []);
        if (!selectedGroupId && data?.length) setSelectedGroupId(data[0].wa_group_id);
      } catch (e) {
        console.error(e);
        toast({ title: 'Erro', description: 'Falha ao carregar grupos do WhatsApp', variant: 'destructive' });
      } finally {
        setGroupsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, orgId]);

  const selectedGroup = useMemo(
    () => groups.find(g => g.wa_group_id === selectedGroupId || g.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  // ===== handlers =====
  const handleSelectPresetForGroup = async (preset: Preset) => {
    if (!selectedGroup) {
      toast({ title: 'Selecione um grupo', description: 'Escolha um grupo antes de continuar.', variant: 'destructive' });
      return;
    }
    setSelectedPreset(preset.key);

    const audience = {
      type: preset.key, // ex: joined_group_recent
      params: {
        ...preset.params,
        group_id: selectedGroup.wa_group_id,
        group_subject: selectedGroup.subject || undefined,
      }
    };
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
      } catch {
        toast({ title: 'Erro', description: 'Falha ao criar campanha', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSelectAllContacts = async () => {
    // segmento simples, sem params
    const audience = { type: 'all_contacts', params: {} };
    onDraftChange({ audience });
    setSelectedPreset('all_contacts');

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
      } catch {
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
    } catch {
      toast({ title: 'Erro', description: 'Falha ao estimar público', variant: 'destructive' });
    } finally {
      setEstimating(false);
    }
  };

  // ===== render =====
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Escolha o Público</h3>
        <p className="text-sm text-muted-foreground">Escolha a origem do público e depois refine.</p>
      </div>

      {/* 1) Escolha da ORIGEM */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${source === 'wpp_group' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSource('wpp_group')}
        >
          <CardHeader><CardTitle>Grupo do WhatsApp</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Use membros de um grupo específico</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${source === 'all_contacts' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSource('all_contacts')}
        >
          <CardHeader><CardTitle>Todos os contatos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Toda a base de contatos</p>
          </CardContent>
        </Card>

        {/* Futuras: lojas integradas */}
        {/* <Card ...>Clientes da loja virtual 1</Card>
            <Card ...>Clientes da loja virtual 2</Card> */}
      </div>

      {/* 2) Configuração conforme origem */}
      {source === 'wpp_group' && (
        <>
          {/* SELECT DO GRUPO */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Grupo do WhatsApp</label>
            <div className="flex gap-2 items-center">
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                disabled={groupsLoading || !groups.length}
                value={selectedGroupId ?? ''}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                {groups.length === 0 && <option value="">Nenhum grupo disponível</option>}
                {groups.map(g => (
                  <option key={g.id} value={g.wa_group_id}>
                    {g.subject || g.wa_group_id}
                  </option>
                ))}
              </select>

              {selectedGroup?.subject && (
                <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                  {selectedGroup.subject}
                </span>
              )}
            </div>
          </div>

          {/* PRESETS do grupo */}
          <div className="grid gap-4 md:grid-cols-2">
            {presets.map((preset) => {
              const isDisabled = !selectedGroup;
              const isSelected = selectedPreset === preset.key;
              const days =
                preset.params?.days != null ? Number(preset.params.days) :
                preset.key === 'joined_group_recent' ? 3 : undefined;

              return (
                <Card
                  key={preset.key}
                  className={`transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => !isDisabled && handleSelectPresetForGroup(preset)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="w-5 h-5" />
                      {preset.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 items-center">
                      {typeof days === 'number' && (
                        <Badge variant="secondary" className="text-xs">
                          {`Dias: ${String(days).padStart(2,'0')}`}
                        </Badge>
                      )}
                      {selectedGroup?.subject && (
                        <span className="text-xs font-medium text-green-600">
                          {selectedGroup.subject}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {source === 'all_contacts' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className={`cursor-pointer transition-all hover:shadow-lg ${selectedPreset === 'all_contacts' ? 'ring-2 ring-primary' : ''}`}
            onClick={handleSelectAllContacts}
          >
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="w-5 h-5" />Todos os contatos</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Atinge toda a sua base de contatos (respeitando opt-out).</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ESTIMATE */}
      {draft.audience && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="flex-1">
            {estimating ? (
              <div className="h-6 w-40 bg-muted-foreground/20 animate-pulse rounded" />
            ) : draft.estimatedCount !== undefined ? (
              <p className="text-sm">
                <span className="font-semibold text-2xl text-primary">{draft.estimatedCount}</span>{' '}
                contatos serão atingidos
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Calcule quantos contatos serão atingidos
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleEstimate} disabled={!draft.id || estimating}>
            <Calculator className="w-4 h-4 mr-2" />
            {estimating ? 'Calculando...' : 'Calcular'}
          </Button>
        </div>
      )}

      {/* AÇÕES */}
      <div className="flex justify-end">
        <Button
          onClick={() => {
            // precisa ao menos ter audience (escolheu preset/segmento para a origem)
            if (!draft.audience) {
              toast({ title: 'Selecione um público', description: 'Escolha a origem e um preset/segmento.', variant: 'destructive' });
              return;
            }
            onNext();
          }}
          disabled={!draft.id || loading}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
