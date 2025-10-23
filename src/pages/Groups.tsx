import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Users, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { orgConnectionApi, whatsappGroupsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ConnectionSummary {
  org_id: string;
  evolution_connected: boolean | null;
  evolution_state: string | null;
}

interface WhatsAppGroup {
  id: string;
  org_id: string;
  wa_group_id: string;
  subject: string | null;
  picture_url: string | null;
  created_at?: string;
  last_sync_at?: string;
}

export default function Groups() {
  const { organization } = useAuth();
  const [connectionSummary, setConnectionSummary] = useState<ConnectionSummary | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registeringGroups, setRegisteringGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [organization?.id]);

  const loadData = async () => {
    if (!organization?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Verificar conexão
      const summary = await orgConnectionApi.getSummary();
      setConnectionSummary(summary);

      // Se conectado, carregar grupos
      if (summary.evolution_connected === true) {
        const groupsData = await whatsappGroupsApi.list(organization.id);
        setGroups(groupsData);
      }
    } catch (err: any) {
      console.error('Error loading groups:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterMembers = async (group: WhatsAppGroup) => {
    if (!organization?.id) return;

    setRegisteringGroups(prev => new Set(prev).add(group.id));

    try {
      await whatsappGroupsApi.registerMembers(group.id, {
        org_id: organization.id,
        wa_group_id: group.wa_group_id,
        subject: group.subject,
        trigger: 'register_group_contacts',
      });

      toast.success(`Cadastro de contatos iniciado para ${group.subject || 'grupo'}`);
    } catch (err: any) {
      console.error('Error registering members:', err);
      toast.error(err?.response?.data?.error || 'Erro ao cadastrar contatos');
    } finally {
      setRegisteringGroups(prev => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
    }
  };

  const getConnectionBadge = () => {
    if (!connectionSummary) return null;

    const { evolution_connected, evolution_state } = connectionSummary;

    if (evolution_connected === true && evolution_state === 'open') {
      return <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">Conectado</Badge>;
    }

    if (evolution_state === 'connecting' || evolution_state === 'close' || evolution_state === 'closed') {
      return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Conexão instável</Badge>;
    }

    return null;
  };

  const getInitials = (text: string | null) => {
    if (!text) return 'GP';
    return text
      .split(' ')
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Grupos (WhatsApp)</h1>
              <p className="text-muted-foreground mt-1">Gerencie grupos e membros</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Grupos (WhatsApp)</h1>
            <p className="text-muted-foreground mt-1">Gerencie grupos e membros</p>
          </div>
          {getConnectionBadge()}
        </div>

        {connectionSummary?.evolution_connected === false && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Conexão com problemas</AlertTitle>
            <AlertDescription>
              Parece que há algo errado com a sua conexão.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={loadData}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {connectionSummary?.evolution_connected === true && (
          <>
            {groups.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhum grupo encontrado para esta organização.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(group => {
                  const isRegistering = registeringGroups.has(group.id);
                  
                  return (
                    <Card key={group.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <Avatar className="w-12 h-12">
                            {group.picture_url && (
                              <AvatarImage src={group.picture_url} alt={group.subject || 'Grupo'} />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(group.subject)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate">
                              {group.subject || 'Sem nome'}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {group.wa_group_id}
                            </p>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => handleRegisterMembers(group)}
                          disabled={isRegistering}
                          className="w-full"
                          size="sm"
                        >
                          {isRegistering ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Cadastrando...
                            </>
                          ) : (
                            'Cadastrar contatos'
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
