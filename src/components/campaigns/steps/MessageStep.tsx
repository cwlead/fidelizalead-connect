import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Music, Video } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import type { CampaignDraft } from '../CampaignWizard';

interface MessageStepProps {
  draft: CampaignDraft;
  onDraftChange: (updates: Partial<CampaignDraft>) => void;
  onNext: () => void;
}

export function MessageStep({ draft, onDraftChange, onNext }: MessageStepProps) {
  const [templates, setTemplates] = useState<any>({ text: [], audio: [], video: [] });
  const [messageType, setMessageType] = useState<'text' | 'audio' | 'video'>('text');

  useState(() => {
    campaignsApi.templates().then(setTemplates).catch(console.error);
  });

  const handleTemplateSelect = (template: any) => {
    if (messageType === 'text') {
      onDraftChange({
        message: {
          type: 'text',
          template_id: template.id,
          body: template.body,
          variables: template.variables?.reduce((acc: any, v: string) => ({ ...acc, [v]: '' }), {})
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
      message: { ...draft.message, type: 'text', body }
    });
  };

  const handleVariableChange = (key: string, value: string) => {
    onDraftChange({
      message: {
        ...draft.message,
        variables: { ...draft.message?.variables, [key]: value }
      }
    });
  };

  const canProceed = () => {
    if (!draft.message) return false;
    if (draft.message.type === 'text') {
      return (draft.message.body && draft.message.body.length >= 5) || draft.message.template_id;
    }
    return !!draft.message.media_url;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Configure a Mensagem</h3>
        <p className="text-sm text-muted-foreground">
          Variáveis suportadas: {'{first_name}'}, {'{group_name}'}, {'{coupon}'}...
        </p>
      </div>

      <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
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
              value={draft.message?.body || ''}
              onChange={(e) => handleBodyChange(e.target.value)}
              rows={6}
            />
          </div>

          {draft.message?.variables && Object.keys(draft.message.variables).length > 0 && (
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
        <Button onClick={onNext} disabled={!canProceed()}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
