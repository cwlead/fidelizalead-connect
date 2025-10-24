import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, RefreshCw } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface JobsActivePanelProps {
  orgId: string;
}

export function JobsActivePanel({ orgId }: JobsActivePanelProps) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const result = await campaignsApi.getActiveRuns(orgId);
      setJobs(result.data || []);
    } catch (error) {
      console.error('Failed to load active jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [orgId]);

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Jobs Ativos
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadJobs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Nenhum job ativo no momento
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
            Jobs Ativos
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
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Entregues</TableHead>
              <TableHead className="text-right">Falhas</TableHead>
              <TableHead>Última atualização</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.campaign_id}>
                <TableCell className="font-medium">{job.campaign_name || 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{job.sent || 0}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                    {job.delivered || 0}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {job.failed > 0 ? (
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
