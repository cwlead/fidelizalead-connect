import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

interface ChannelSelectStepProps {
  value: string;
  onChange: (channel: string) => void;
  onNext: () => void;
}

export function ChannelSelectStep({ value, onChange }: ChannelSelectStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Escolha o Canal</h3>
        <p className="text-sm text-muted-foreground">
          Selecione por onde sua campanha será enviada
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            value === 'whatsapp.evolution' ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => onChange('whatsapp.evolution')}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-green-500" />
              <CardTitle>WhatsApp</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Envie mensagens via WhatsApp Evolution API
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
