// src/components/campaigns/steps/SequenceStep.tsx
import { useEffect, useMemo, useState } from 'react';
import { sequencesApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type Row = {
  id: string;
  name: string;
  version?: number;
  updated_at?: string;
  steps_count?: number;
  channel?: string;
};

function extractList(payload: any): Row[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Row[];
  const candidates = [
    payload.items,
    payload.data?.items,
    payload.data,
    payload.rows,
    payload.sequences,
    payload.list,
    payload.results,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c as Row[];
  return [];
}

function normalizeChannel(ch?: string) {
  if (!ch) return ch;
  // Ex.: 'whatsapp.evolution' -> 'whatsapp'
  if (ch.startsWith('whatsapp')) return 'whatsapp';
  return ch;
}

export default function SequenceStep({
  orgId,
  channel,
  value,
  onChange,
}: {
  orgId: string;
  channel: string;
  value?: string;
  onChange: (sequenceId: string) => void;
}): JSX.Element {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  // debounce 300ms para não “piscar” a cada tecla
  const debounced = useMemo(() => {
    let t: any;
    return (q: string, fn: (q: string) => void) => {
      clearTimeout(t);
      t = setTimeout(() => fn(q), 300);
    };
  }, []);

  // primeira carga e buscas
  useEffect(() => {
    let alive = true;
    setLoading(true);

    const q = search.trim();
    const ch = normalizeChannel(channel);

    const run = async () => {
      try {
        const data = await sequencesApi.list({
          orgId,
          status: 'published',
          channel: ch,
          q: q || undefined,
        });
        if (!alive) return;
        setRows(extractList(data));
      } catch (err) {
        console.error('[SequenceStep] list error', err);
        if (!alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    // com debounce apenas quando há texto
    if (q) debounced(q, () => run());
    else run();

    return () => {
      alive = false;
    };
  }, [orgId, channel, search, debounced]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Escolha a sequência</h3>
          <p className="text-sm text-muted-foreground">
            Mostrando sequências <b>publicadas</b> para o canal selecionado.
          </p>
        </div>
        <Input
          placeholder="Buscar por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          Nenhuma sequência publicada encontrada para este canal.
        </div>
      ) : (
        <RadioGroup
          value={value ?? ''}
          onValueChange={(val) => onChange(val)}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {rows.map((row) => (
            <Label
              key={row.id}
              htmlFor={`seq-${row.id}`}
              className={`border rounded-2xl p-4 cursor-pointer hover:bg-muted/40 ${
                value === row.id ? 'border-primary' : 'border-muted'
              }`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem id={`seq-${row.id}`} value={row.id} />
                <div className="space-y-1">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(row.steps_count ?? 0)} etapas
                    {typeof row.version === 'number' ? ` · v${row.version}` : ''}
                    {row.updated_at
                      ? ` · atualizado ${new Date(row.updated_at).toLocaleDateString()}`
                      : ''}
                  </div>
                </div>
              </div>
            </Label>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}
