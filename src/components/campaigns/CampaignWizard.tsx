import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ChannelSelectStep } from './steps/ChannelSelectStep';
import { AudienceStep } from './steps/AudienceStep';
import SequenceStep from './steps/SequenceStep';
import { ReviewStep } from './steps/ReviewStep';


export interface CampaignDraft {
  id?: string;
  name: string;
  channel: string;            // ex.: 'whatsapp.evolution'
  audience?: any;

  // NOVO: vínculo com a sequência escolhida
  sequence_id?: string;

  // Mantidos só por compatibilidade com backend antigo (não usados no wizard novo)
  message?: {
    type: 'text' | 'audio' | 'video';
    template_id?: string;
    body?: string;
    variables?: Record<string, string>;
    media_url?: string;
  };
  throttle?: any;

  estimatedCount?: number;
}

interface CampaignWizardProps {
  orgId: string;
  onClose: () => void;
  onLaunched?: (runInfo: any) => void;
}

const STEPS = [
  { id: 1, label: 'Canal' },
  { id: 2, label: 'Público' },
  { id: 3, label: 'Sequência' },   // ⬅️ trocamos “Mensagem” por “Sequência”
  { id: 4, label: 'Revisão' },     // ⬅️ removemos “Envio & Segurança”
];

export function CampaignWizard({ orgId, onClose, onLaunched }: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [draft, setDraft] = useState<CampaignDraft>({
    name: 'Campanha (draft)',
    channel: 'whatsapp.evolution',
    throttle: {
      text_delay: [0, 30],
      media_delay: [30, 60],
      per_minute: 6,
      quiet_hours: ['22:00', '08:00'],
      dry_run: true,
      safeguards: { frequency_cap_hours: 72 },
    },
  });

  const handleDraftChange = (updates: Partial<CampaignDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) setCurrentStep(s => s + 1);
  };
  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1);
  };

  const progress = (currentStep / STEPS.length) * 100;

  // Desabilita “Próximo” enquanto não escolher a sequência (passo 3)
  const canGoNext =
    currentStep !== 3 || Boolean(draft.sequence_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Campanha Plus</DialogTitle>
        </DialogHeader>

        {/* Barra de passos */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            {STEPS.map(step => (
              <span
                key={step.id}
                className={
                  step.id === currentStep
                    ? 'font-semibold text-primary'
                    : step.id < currentStep
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/50'
                }
              >
                {step.label}
              </span>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Etapas */}
        <div className="py-6">
          {currentStep === 1 && (
            <ChannelSelectStep
              value={draft.channel}
              onChange={(channel) => handleDraftChange({ channel })}
              onNext={handleNext}
            />
          )}

          {currentStep === 2 && (
            <AudienceStep
              draft={draft}
              orgId={orgId}
              onDraftChange={handleDraftChange}
              onNext={handleNext}
            />
          )}

          {currentStep === 3 && (
            <SequenceStep
              orgId={orgId}
              channel={draft.channel}              // 'whatsapp.evolution' ok — api normaliza
              value={(draft as any).sequence_id}
              onChange={(sequenceId) => {
                handleDraftChange({ sequence_id: sequenceId } as any);
                handleNext();
              }}
            />
          )}

          {currentStep === 4 && (
            <ReviewStep
              draft={draft}
              orgId={orgId}
              onLaunch={onLaunched}
              onClose={onClose}
            />
          )}
        </div>

        {/* Navegação */}
        {currentStep < STEPS.length && (
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext}>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
