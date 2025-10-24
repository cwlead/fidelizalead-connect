import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ChannelSelectStep } from './steps/ChannelSelectStep';
import { AudienceStep } from './steps/AudienceStep';
import { MessageStep } from './steps/MessageStep';
import { ScheduleSafetyStep } from './steps/ScheduleSafetyStep';
import { ReviewStep } from './steps/ReviewStep';
import { useToast } from '@/hooks/use-toast';

export interface CampaignDraft {
  id?: string;
  name: string;
  channel: string;
  audience?: any;
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
  { id: 3, label: 'Mensagem' },
  { id: 4, label: 'Envio & Segurança' },
  { id: 5, label: 'Revisão' },
];

export function CampaignWizard({ orgId, onClose, onLaunched }: CampaignWizardProps) {
  const { toast } = useToast();
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
      safeguards: { frequency_cap_hours: 72 }
    }
  });

  const handleDraftChange = (updates: Partial<CampaignDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Campanha Plus</DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            {STEPS.map((step) => (
              <span
                key={step.id}
                className={`${
                  step.id === currentStep
                    ? 'font-semibold text-primary'
                    : step.id < currentStep
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/50'
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps */}
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
            <MessageStep
              draft={draft}
              onDraftChange={handleDraftChange}
              onNext={handleNext}
            />
          )}
          {currentStep === 4 && (
            <ScheduleSafetyStep
              draft={draft}
              orgId={orgId}
              onDraftChange={handleDraftChange}
              onNext={handleNext}
            />
          )}
          {currentStep === 5 && (
            <ReviewStep
              draft={draft}
              orgId={orgId}
              onLaunch={onLaunched}
              onClose={onClose}
            />
          )}
        </div>

        {/* Navigation */}
        {currentStep < STEPS.length && (
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleNext}>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
