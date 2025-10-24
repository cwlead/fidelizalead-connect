import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Users, Loader2, ArrowLeft, Send, UserX, MessageSquare } from 'lucide-react';
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
  contatos_sincronizados?: boolean;
}

export default function Groups() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [connectionSummary, setConnectionSummary] = useState<ConnectionSummary | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registeringGroups, setRegisteringGroups] = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [organization?.id]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedGroupId) {
        setSelectedGroupId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId && selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedGroupId]);

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

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  const handleExitFocus = () => {
    setSelectedGroupId(null);
  };

  const handleGoToCampaigns = (group: WhatsAppGroup) => {
    navigate(`/campanhas?source=groups&groupId=${group.id}&groupName=${encodeURIComponent(group.subject || 'Grupo')}`);
  };

  const isFocusing = selectedGroupId !== null;
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

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
                  const isSelected = group.id === selectedGroupId;
                  const isFaded = isFocusing && !isSelected;
                  
                  return (
                    <Card 
                      key={group.id} 
                      ref={isSelected ? selectedCardRef : null}
                      className={`
                        transition-all duration-300
                        ${isSelected 
                          ? 'md:col-span-2 lg:col-span-3 shadow-2xl scale-100' 
                          : 'hover:shadow-lg scale-100'
                        }
                        ${isFaded 
                          ? 'opacity-40 scale-95 pointer-events-none' 
                          : ''
                        }
                      `}
                      aria-expanded={isSelected}
                    >
                      <CardContent className="p-6">
                        {isSelected && (
                          <div className="flex items-center justify-between mb-4 pb-4 border-b">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={handleExitFocus}
                              className="gap-2"
                            >
                              <ArrowLeft className="w-4 h-4" />
                              Voltar aos grupos
                            </Button>
                            {getConnectionBadge()}
                          </div>
                        )}

                        <div 
                          className={`flex items-start gap-4 mb-4 ${!isSelected ? 'cursor-pointer' : ''}`}
                          onClick={() => !isSelected && handleSelectGroup(group.id)}
                        >
                          <Avatar className="w-12 h-12">
                            {group.picture_url && (
                              <AvatarImage 
                                src={group.picture_url} 
                                alt={group.subject || 'Grupo'}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
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

                        {isSelected && (
                          <div className="space-y-6 mt-6 animate-fade-in">
                            <div>
                              <h4 className="text-lg font-semibold mb-4">Sugestões para este grupo</h4>
                              
                              <div className="space-y-3">
                                <Card className="bg-secondary/20 border-secondary/40">
                                  <CardContent className="p-4">
                                    <div className="flex gap-3">
                                      <Send className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                      <div>
                                        <h5 className="font-medium mb-1">Que tal enviar mensagem individual para cada membro</h5>
                                        <p className="text-sm text-muted-foreground">Aumenta a taxa de resposta e cria proximidade.</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card className="bg-secondary/20 border-secondary/40">
                                  <CardContent className="p-4">
                                    <div className="flex gap-3">
                                      <UserX className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                      <div>
                                        <h5 className="font-medium mb-1">Que tal enviar mensagem automática quando alguém sair do grupo</h5>
                                        <p className="text-sm text-muted-foreground">Melhora a relação e convida para outro grupo</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card className="bg-secondary/20 border-secondary/40">
                                  <CardContent className="p-4">
                                    <div className="flex gap-3">
                                      <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                      <div>
                                        <h5 className="font-medium mb-1">Os clientes não estão acompanhando o grupo?</h5>
                                        <p className="text-sm text-muted-foreground">Envie uma mensagem individual perguntando o motivo e se conecte novamente</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <Button
                                onClick={() => handleGoToCampaigns(group)}
                                className="flex-1"
                                size="lg"
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Criar campanha para este grupo
                              </Button>
                              
                              <Button
                                onClick={() => handleRegisterMembers(group)}
                                disabled={isRegistering || group.contatos_sincronizados}
                                variant={group.contatos_sincronizados ? "secondary" : "outline"}
                                className={group.contatos_sincronizados ? "bg-green-200 text-green-700 border-green-400 hover:bg-green-300" : ""}
                                size="lg"
                              >
                                {isRegistering ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Sincronizando aguarde...
                                  </>
                                ) : group.contatos_sincronizados ? (
                                  <>
                                    Contatos sincronizados
                                  </>
                                ) : (
                                  'Importar contatos'
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {!isSelected && (
                          <Button
                            onClick={() => handleSelectGroup(group.id)}
                            className="w-full"
                            size="sm"
                          >
                            {isRegistering ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Cadastrando...
                              </>
                            ) : (
                              'Ver grupo'
                            )}
                          </Button>
                        )}
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
