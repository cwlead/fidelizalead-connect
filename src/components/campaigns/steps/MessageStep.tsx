import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Music, Video } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import type { CampaignDraft } from '../CampaignWizard';
import { useToast } from '@/hooks/use-toast';

interface MessageStepProps {
  draft: CampaignDraft;
  onDraftChange: (updates: Partial<CampaignDraft>) => void;
  orgId: string;
  onNext: () => void;
}

export function MessageStep({ draft, onDraftChange, orgId, onNext }: MessageStepProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any>({ text: [], audio: [], video: [] });
  const [messageType, setMessageType] = useState<'text' | 'audio' | 'video'>(draft.message?.type ?? 'text');
  const [saving, setSaving] = useState(false);

  // Carrega templates
  useEffect(() => {
    let alive = true;
    campaignsApi.templates()
      .then((data) => { if (alive) setTemplates(data || { text: [], audio: [], video: [] }); })
      .catch(console.error);
    return () => { alive = false; };
  }, []);

  // Sempre que trocar a aba/tipo, garante que o draft tenha o type correto
  const handleChangeType = (v: string) => {
    const nextType = (v as 'text' | 'audio' | 'video');
    setMessageType(nextType);
    onDraftChange({
      message: {
        type: nextType,
        // preserva o resto se já existir
        ...(draft.message || {})
      }
    });
  };

  const handleTemplateSelect = (template: any) => {
    if (messageType === 'text') {
      onDraftChange({
        message: {
          type: 'text',
          template_id: template.id,
          body: template.body,
          variables: template.variables?.reduce((acc: any, v: string) => ({ ...acc, [v]: '' }), {}) ?? {}
        }
      });
    } else {
      onDraftChange({
        message: {
          type: messageType,
          template_id: template.id,
          media_url: template.url
        }
      });
    }
  };

  const handleBodyChange = (body: string) => {
    onDraftChange({
      message: { ...(draft.message || {}), type: 'text', body }
    });
  };

  const handleVariableChange = (key: string, value: string) => {
    onDraftChange({
      message: {
        ...(draft.message || { type: 'text' }),
        variables: { ...(draft.message?.variables || {}), [key]: value }
      }
    });
  };

  const canProceed = () => {
    if (!draft.message) return false;
    if (draft.message.type === 'text') {
      const hasBody = !!(draft.message.body && draft.message.body.trim().length >= 5);
      const hasTpl = !!draft.message.template_id;
      return hasBody || hasTpl;
    }
    return !!draft.message.media_url;
  };

  const handleContinue = async () => {
    if (!draft.id) {
      return toast({
        title: 'Campanha não criada',
        description: 'Defina o público no passo anterior antes de salvar a mensagem.',
        variant: 'destructive'
      });
    }
    if (!canProceed()) {
      return toast({
        title: 'Mensagem incompleta',
        description: 'Preencha o texto (mín. 5 caracteres) ou selecione um template / mídia.',
        variant: 'destructive'
      });
    }

    try {
      setSaving(true);
      await campaignsApi.saveMessage(draft.id, orgId, draft.message);
      toast({ title: 'Mensagem salva', description: 'Agora configure envio & segurança.' });
      onNext();
    } catch (e) {
      toast({ title: 'Erro ao salvar mensagem', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Configure a Mensagem</h3>
        <p className="text-sm text-muted-foreground">
          Variáveis suportadas: {'{first_name}'}, {'{group_name}'}, {'{coupon}'}...
        </p>
      </div>

      <Tabs value={messageType} onValueChange={handleChangeType}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="text">
            <FileText className="w-4 h-4 mr-2" />
            Texto
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Music className="w-4 h-4 mr-2" />
            Áudio
          </TabsTrigger>
          <TabsTrigger value="video">
            <Video className="w-4 h-4 mr-2" />
            Vídeo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-4">
          <div className="space-y-2">
            <Label>Templates Prontos</Label>
            <div className="grid gap-2">
              {templates.text.map((tpl: any) => (
                <Card
                  key={tpl.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => handleTemplateSelect(tpl)}
                >
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm">{tpl.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-muted-foreground">{tpl.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ou escreva sua mensagem</Label>
            <Textarea
              placeholder="Digite sua mensagem aqui..."
              value={draft.message?.type === 'text' ? (draft.message.body || '') : ''}
              onChange={(e) => handleBodyChange(e.target.value)}
              rows={6}
            />
          </div>

          {draft.message?.type === 'text' && draft.message?.variables && Object.keys(draft.message.variables).length > 0 && (
            <div className="space-y-2">
              <Label>Variáveis</Label>
              {Object.keys(draft.message.variables).map((varKey) => (
                <div key={varKey} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{varKey}</Label>
                  <Input
                    placeholder={`Valor para {${varKey}}`}
                    value={draft.message?.variables?.[varKey] || ''}
                    onChange={(e) => handleVariableChange(varKey, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audio" className="space-y-4">
          <div className="space-y-2">
            <Label>Templates de Áudio</Label>
            <div className="grid gap-2">
              {templates.audio.map((tpl: any) => (
                <Card
                  key={tpl.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => handleTemplateSelect(tpl)}
                >
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      {tpl.name}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="video" className="space-y-4">
          <div className="space-y-2">
            <Label>Templates de Vídeo</Label>
            <div className="grid gap-2">
              {templates.video.map((tpl: any) => (
                <Card
                  key={tpl.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => handleTemplateSelect(tpl)}
                >
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      {tpl.name}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleContinue} disabled={!canProceed() || saving}>
          {saving ? 'Salvando...' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}
