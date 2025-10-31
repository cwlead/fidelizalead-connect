import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Eye, Copy, Archive, Edit } from 'lucide-react';
import { sequencesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Sequence, SequenceStatus } from '@/types/sequences';
import { Skeleton } from '@/components/ui/skeleton';
import NewSequenceButton from "@/components/sequences/NewSequenceButton";


export default function Sequences() {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SequenceStatus | 'all'>('all');

  useEffect(() => {
    loadSequences();
  }, [statusFilter, searchQuery]);

  const loadSequences = async () => {
    if (!organization?.id) return;
    try {
      setLoading(true);
      const data = await sequencesApi.list({
        orgId: organization.id,
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: searchQuery || undefined,
      });
      setSequences(data.items);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar sequências',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const [isCreating, setIsCreating] = useState(false);
  const handleCreateNew = async () => {
    if (!organization?.id) return;

    const baseName = "Nova Sequência";
    const tryCreate = (name: string) =>
      sequencesApi.create({
        orgId: organization.id,
        name,
        channel: "whatsapp",
      });

    try {
      setIsCreating(true);

      let seq: any;
      try {
        seq = await tryCreate(baseName);
      } catch (err: any) {
        const msg = String(
          err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? ""
        ).toLowerCase();
        const isDup =
          msg.includes("duplicate key") ||
          msg.includes("ux_comms_sequences_org_name_version");

        if (!isDup) throw err;

        const suffix = Math.random().toString(36).slice(2, 7);
        seq = await tryCreate(`${baseName} - ${suffix}`);
      }

      navigate(`/sequencias/${seq.id}`);
    } catch (error: any) {
      toast({
        title: "Erro ao criar sequência",
        description: error?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };


  const handleDuplicate = async (id: string) => {
    if (!organization?.id) return;
    try {
      const duplicated = await sequencesApi.duplicate(id, organization.id);
      toast({ title: 'Sequência duplicada com sucesso' });
      navigate(`/sequencias/${duplicated.sequence.id}`);
    } catch (error: any) {
      toast({
        title: 'Erro ao duplicar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleArchive = async (id: string) => {
    if (!organization?.id) return;
    try {
      await sequencesApi.archive(id, organization.id);
      toast({ title: 'Sequência arquivada' });
      loadSequences();
    } catch (error: any) {
      toast({
        title: 'Erro ao arquivar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: SequenceStatus) => {
    const variants: Record<SequenceStatus, string> = {
      draft: 'secondary',
      published: 'default',
      archived: 'outline',
    };
    const labels: Record<SequenceStatus, string> = {
      draft: 'Rascunho',
      published: 'Publicada',
      archived: 'Arquivada',
    };
    return (
      <Badge variant={variants[status] as any}>
        {labels[status]}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sequências (Playbooks)</h1>
            <p className="text-muted-foreground mt-1">
              Crie sequências de mensagens automatizadas
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Sequência
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar sequências..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicadas</SelectItem>
                  <SelectItem value="archived">Arquivadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                  </div>
                ))}
              </div>
            ) : sequences.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">Nenhuma sequência encontrada</p>
                <p className="text-sm">Crie sua primeira sequência para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sequences.map((seq) => (
                  <div
                    key={seq.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-foreground">{seq.name}</h3>
                        {getStatusBadge(seq.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{seq.steps_count || 0} passos</span>
                        <span>v{seq.version}</span>
                        <span>
                          Atualizado em{' '}
                          {new Date(seq.updated_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/sequencias/${seq.id}`)}
                      >
                        {seq.status === 'draft' ? (
                          <>
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Visualizar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(seq.id)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {seq.status === 'published' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(seq.id)}
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
