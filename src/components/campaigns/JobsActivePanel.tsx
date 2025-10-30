import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, RefreshCw, ChevronDown, ChevronRight, Phone } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';



// Mapeia PT -> EN para o "code" (apenas para visual e lógica de cor)
const PT_TO_EN: Record<string, string> = {
  'enviado': 'sent',
  'na fila': 'queued',
  'falhou': 'failed',
  'ignorado': 'skipped',
  'lida': 'read',
  'entregue': 'delivered',
  'cancelado': 'canceled',
  'cancelada': 'canceled',
  'pausado': 'paused',
  'pausada': 'paused',
  'agendada': 'scheduled',
  'executando': 'running',
};

function normalizeCode(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  return PT_TO_EN[s] ?? s; // se vier PT, converte; se vier EN, mantém
}

// Fallback de label PT quando o backend não envia status_label
function fallbackPtLabelFromCode(code: string): string {
  switch (code) {
    case 'sent': return 'Enviado';
    case 'delivered': return 'Entregue';
    case 'read': return 'Lida';
    case 'failed': return 'Falhou';
    case 'skipped': return 'Ignorado';
    case 'queued': return 'Na fila';
    case 'scheduled': return 'Agendada';
    case 'running': return 'Executando';
    case 'paused': return 'Pausada';
    case 'canceled': return 'Cancelada';
    default: return code || '—';
  }
}

interface JobsActivePanelProps {
  orgId: string;
}

type ActiveJob = {
  run_id?: string;
  campaign_id: string;
  campaign_name?: string;
  status?: 'scheduled' | 'running' | 'paused' | 'completed' | 'canceled';
  status_label?: string;             // NOVO: label amigável vindo do backend
  sent?: number;
  delivered?: number;
  failed?: number;
  last_event_at?: string | null;
};

type Recipient = {
  target_id: number;
  contact_id: string | null;
  name: string | null;
  phone_e164: string | null;
  wa_user_id: string | null;
  status_code: string;               // NOVO: 'sent' | 'failed' | 'queued' | ...
  status_label: string;              // NOVO: 'Enviado' | 'Falhou' | 'Na fila' | ...
  event_at: string | null;           // se null, é fallback (ninguém recebeu ainda)
};
// -------------------------
// Normalizadores (defensivos)
// -------------------------
function normalizeActiveJob(r: any): ActiveJob {
  const statusCodeRaw =
    r?.status ?? r?.last_run_status ?? r?.run_status ?? 'running';
  const statusCode = normalizeCode(statusCodeRaw);

  const statusLabel =
    r?.status_label ?? r?.last_run_status_label ?? r?.run_status_label ?? fallbackPtLabelFromCode(statusCode);

  return {
    run_id: r?.run_id ?? r?.id ?? r?.runId ?? undefined,
    campaign_id: String(r?.campaign_id ?? r?.campaignId ?? r?.campaign?.id ?? ''),
    campaign_name: r?.campaign_name ?? r?.campaign?.name ?? r?.name ?? '',
    status: statusCode as ActiveJob['status'],
    status_label: statusLabel,
    sent: Number(r?.sent ?? r?.counters?.sent ?? 0),
    delivered: Number(r?.delivered ?? r?.counters?.delivered ?? 0),
    failed: Number(r?.failed ?? r?.counters?.failed ?? 0),
    last_event_at: r?.last_event_at ?? r?.last_activity_at ?? r?.updated_at ?? null,
  };
}

function normalizeJobs(payload: any): ActiveJob[] {
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.runs)
        ? payload.runs
        : [];
  return arr.map(normalizeActiveJob);
}

function normalizeRecipient(r: any): Recipient {
  // PRIORIDADE do "code": status_code -> last_event_kind -> status
  const rawCode =
    r?.status_code ??
    r?.last_event_kind ??
    r?.status ??
    'queued';

  const code = normalizeCode(rawCode);

  // PRIORIDADE do "label": status_label -> last_event_kind_label -> fallback pelo code
  const label =
    (r?.status_label ?? r?.last_event_kind_label) ??
    fallbackPtLabelFromCode(code);

  return {
    target_id: Number(r?.target_id ?? r?.id ?? 0),
    contact_id: r?.contact_id ?? null,
    name: r?.name ?? null,
    phone_e164: r?.phone_e164 ?? null,
    wa_user_id: r?.wa_user_id ?? null,
    status_code: code,     // SEMPRE em EN (pra lógica/cores)
    status_label: String(label), // SEMPRE em PT (pra exibir)
    event_at: r?.event_at ?? r?.last_event_at ?? null,
  };
}

// Visual dos badges (recipients)
function recipientPillProps(code: string): { variant: 'outline' | 'secondary' | 'destructive'; className?: string } {
  switch (code) {
    case 'failed':
    case 'error':
      return { variant: 'destructive' };
    case 'sent':
    case 'delivered':
    case 'read':
    case 'clicked':
      return { variant: 'outline', className: 'bg-green-500/10 text-green-700 border-green-500/20' };
    case 'queued':
    case 'scheduled':
    case 'running':
    default:
      return { variant: 'secondary' };
  }
}

// Visual dos badges (jobs)
function jobStatusVariant(
  code?: ActiveJob['status'] | string
): { variant: 'outline' | 'secondary' | 'destructive'; className?: string } {
  const c = String(code ?? '').toLowerCase();
  switch (c) {
    case 'running':   // Ativo
    case 'completed':
      return { variant: 'outline', className: 'bg-green-500/10 text-green-700 border-green-500/20' };
    case 'canceled':
      return { variant: 'destructive' };
    case 'paused':
    case 'scheduled':
    default:
      return { variant: 'secondary' };
  }
}

export function JobsActivePanel({ orgId }: JobsActivePanelProps) {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(false);

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [recentsByRun, setRecentsByRun] = useState<Record<string, Recipient[]>>({});
  const [loadingRun, setLoadingRun] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const result = await campaignsApi.getActiveRuns(orgId);
      setJobs(normalizeJobs(result));
    } catch (error) {
      console.error('Failed to load active jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (runId?: string) => {
    if (!runId) return;
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);

    if (!recentsByRun[runId]) {
      setLoadingRun(runId);
      try {
        const raw = await campaignsApi.getRunRecentRecipients(runId, orgId);
        const rows: Recipient[] = Array.isArray(raw) ? raw.map(normalizeRecipient) : [];
        setRecentsByRun(prev => ({ ...prev, [runId]: rows }));
      } catch (e) {
        console.error('Failed to load recipients for run', runId, e);
        setRecentsByRun(prev => ({ ...prev, [runId]: [] }));
      } finally {
        setLoadingRun(null);
      }
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 15000); // refresh a cada 15s
    return () => clearInterval(interval);
  }, [orgId]);

  useEffect(() => {
    if (!expandedRunId) return;
    const tick = async () => {
      try {
        const raw = await campaignsApi.getRunRecentRecipients(expandedRunId, orgId);
        const rows: Recipient[] = Array.isArray(raw) ? raw.map(normalizeRecipient) : [];
        setRecentsByRun(prev => ({ ...prev, [expandedRunId]: rows }));
      } catch {}
    };
    const id = setInterval(tick, 10000);
    tick();
    return () => clearInterval(id);
  }, [expandedRunId, orgId]);

  const Row = ({ job }: { job: ActiveJob }) => {
    const isOpen = expandedRunId === job.run_id;
    const jobPill = jobStatusVariant(job.status);
    const jobText = (job.status_label ?? job.status ?? '').toString();
    return (
      <>
        <TableRow
          className="cursor-pointer hover:bg-muted/40"
          onClick={() => toggleExpand(job.run_id)}
        >
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {job.campaign_name || 'N/A'}
            </div>
          </TableCell>
          <TableCell>
            <Badge variant={jobPill.variant} className={jobPill.className}>
              {jobText ? jobText : (job.status ?? 'running').toUpperCase()}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <Badge variant="secondary">{job.sent ?? 0}</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
              {job.delivered ?? 0}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            {(job.failed ?? 0) > 0 ? (
              <Badge variant="destructive">{job.failed}</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {job.last_event_at
              ? formatDistanceToNow(new Date(job.last_event_at), { addSuffix: true, locale: ptBR })
              : 'N/A'}
          </TableCell>
        </TableRow>

        {isOpen && (
          <TableRow>
            <TableCell colSpan={6} className="bg-muted/30 p-0">
              <div className="p-4">
                <div className="text-xs text-muted-foreground mb-2">
                  {loadingRun === job.run_id
                    ? 'Carregando últimos 10 destinatários...'
                    : recentsByRun[job.run_id!]?.length
                      ? (recentsByRun[job.run_id!]!.every(r => !r.event_at)
                          ? 'Ninguém recebeu ainda — mostrando os 10 primeiros da fila.'
                          : 'Mostrando os 10 últimos que receberam (mais recentes primeiro).')
                      : 'Nenhum destinatário encontrado.'}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Clientes</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-1/4">Quando</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recentsByRun[job.run_id!] || []).map((r) => {
                      const pill = recipientPillProps(r.status_code);
                      const text =
                        (r.status_label || r.status_code || '').toString() || '—';
                      return (
                        <TableRow key={r.target_id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3 opacity-60" />
                              <span className="font-medium">
                                {r.name || r.wa_user_id || r.phone_e164 || 'Contato'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.phone_e164 || (r.wa_user_id ? `+${r.wa_user_id}` : '—')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={pill.variant} className={pill.className}>
                              {text}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.event_at
                              ? formatDistanceToNow(new Date(r.event_at), { addSuffix: true, locale: ptBR })
                              : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TableCell>
          </TableRow>
        )}
      </>
    );
  };

  if (!jobs.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Campanhas ativas
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadJobs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Nenhuma campanha rodando no momento
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Campanhas ativas
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadJobs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Contatos</TableHead>
              <TableHead className="text-right">Entregues</TableHead>
              <TableHead className="text-right">Falhas</TableHead>
              <TableHead>Última atualização</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => <Row key={job.run_id || job.campaign_id} job={job} />)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
