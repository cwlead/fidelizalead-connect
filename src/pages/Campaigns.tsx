import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CampaignWizard } from '@/components/campaigns/CampaignWizard';
import { JobsActivePanel } from '@/components/campaigns/JobsActivePanel';
import { useAuth } from '@/contexts/AuthContext';

export default function Campaigns() {
  const { user, organization } = useAuth();
  const [showWizard, setShowWizard] = useState(false);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campanhas</h1>
            <p className="text-muted-foreground mt-1">
              Crie e gerencie campanhas de WhatsApp
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Criar Campanha Plus
          </Button>
        </div>

        {organization?.id && <JobsActivePanel orgId={organization.id} />}

        {showWizard && organization?.id && (
          <CampaignWizard
            orgId={organization.id}
            onClose={() => setShowWizard(false)}
            onLaunched={() => {
              // Refresh jobs panel
              window.location.reload();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
