import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Send,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Image as ImageIcon,
  FileAudio2,
  Video as VideoIcon,
  FileText,
  Upload as UploadIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

import { useAuth } from "@/contexts/AuthContext";
import { sequencesApi, uploadsApi } from "@/lib/api";

/** === Tipos básicos === */
type StepKind = "text" | "image" | "audio" | "video" | "document";

type Step = {
  idx: number;
  kind: StepKind;
  cfg: any; // { text?: string, fileId?: string, caption?: string, delayNextSeconds?: number }
};

type SequenceDto = {
  id: string;
  org_id: string;
  name: string;
  status: "draft" | "published";
  channel: string;
  active: boolean;
  steps: Step[];
};

/** Helpers de arquivo */
function resolveFileUrl(id?: string) {
  if (!id) return "";
  if (/^https?:\/\//i.test(id)) return id;   // já é URL completa (compatibilidade)
  return `/api/files/${id}`;                 // key -> proxy
}

function fileLabelFromId(id?: string) {
  if (!id) return "";
  try {
    const u = new URL(id);
    id = u.pathname; // "/bucket/.../arquivo.ext"
  } catch {}
  const p = id.lastIndexOf("/");
  return p >= 0 ? id.slice(p + 1) : id;
}

/** Preview amigável por tipo */
function StepPreview({ step }: { step: Step }) {
  if (step.kind === "text") {
    return (
      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
        {step.cfg?.text || "(vazio)"}
      </div>
    );
  }

  if (step.kind === "image") {
    const raw = step.cfg?.fileId || step.cfg?.url || "";
    const src = resolveFileUrl(raw);
    const label = fileLabelFromId(raw);

    return (
      <div className="flex items-center gap-3">
        <img
          src={src}
          alt="preview"
          className="h-16 w-16 rounded object-cover border bg-muted"
          onError={(e) => {
            e.currentTarget.alt = "sem preview";
            e.currentTarget.src =
              "data:image/svg+xml;charset=utf-8," +
              encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#eee"/></svg>');
          }}
        />
        <div className="text-xs break-all">{label || "(sem arquivo)"}</div>
      </div>
    );
  }

  // audio, video, document -> mostramos só o nome do arquivo (sem URL)
  const raw = step.cfg?.fileId || step.cfg?.url || "";
  const label = fileLabelFromId(raw);
  return <div className="text-xs break-all">{label || "(sem arquivo)"}</div>;
}

/** Reindexa idx=1..N */
function localReindex(steps: Step[]): Step[] {
  return steps
    .slice()
    .sort((a, b) => a.idx - b.idx)
    .map((s, i) => ({ ...s, idx: i + 1 }));
}

export default function SequenceEditor() {
  const { id } = useParams(); // sequenceId
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useAuth();
  const orgId = organization?.id || "";

  // Carregamento / Estado principal
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [sequence, setSequence] = useState<SequenceDto | null>(null);
  const [name, setName] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([]);

  // Composer (adicionar novo passo)
  const [newKind, setNewKind] = useState<StepKind>("text");
  const [textBody, setTextBody] = useState<string>("");
  const [fileId, setFileId] = useState<string>(""); // guarda a KEY curta (ou URL compat)
  const [caption, setCaption] = useState<string>("");
  const [delay, setDelay] = useState<string>(""); // em segundos (opcional)

  // Uploads locais
  const fileInputRef = useRef<HTMLInputElement | null>(null);   // imagem
  const audioInputRef = useRef<HTMLInputElement | null>(null);  // áudio
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    if (!id || !orgId) return;
    let ignore = false;
    setLoading(true);

    (async () => {
      try {
        const data = await sequencesApi.get(id, orgId);
        if (ignore) return;
        const seq: SequenceDto = data.sequence ?? data;
        setSequence(seq);
        setName(seq.name);
        setSteps(seq.steps || []);
      } catch (err: any) {
        toast({
          title: "Erro ao carregar sequência",
          description: err?.response?.data?.error || err.message,
          variant: "destructive",
        });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [id, orgId, toast]);

  const statusBadge = useMemo(() => {
    const s = sequence?.status || "draft";
    const map: Record<string, string> = {
      draft: "bg-amber-100 text-amber-700",
      published: "bg-emerald-100 text-emerald-700",
    };
    return <Badge className={map[s] || ""}>{s === "draft" ? "Rascunho" : "Publicado"}</Badge>;
  }, [sequence]);

  async function saveName() {
    if (!sequence) return;
    try {
      setSaving(true);
      const updated = await sequencesApi.update(sequence.id, orgId, { name });
      setSequence((prev) => (prev ? { ...prev, name: updated.name } : prev));
      toast({ title: "Nome salvo" });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar nome",
        description: err?.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function persistSteps(next: Step[]) {
    if (!sequence) return;
    try {
      const newSteps = localReindex(next);
      await sequencesApi.updateSteps(sequence.id, orgId, newSteps);
      setSteps(newSteps);
      toast({ title: "Passos atualizados" });
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar passos",
        description: err?.response?.data?.error || err.message,
        variant: "destructive",
      });
    }
  }

  function moveStepUp(idx: number) {
    const ix = steps.findIndex((s) => s.idx === idx);
    if (ix <= 0) return;
    const copy = steps.slice();
    const [a, b] = [copy[ix - 1], copy[ix]];
    copy[ix - 1] = { ...b, idx: a.idx };
    copy[ix] = { ...a, idx: b.idx };
    persistSteps(localReindex(copy));
  }

  function moveStepDown(idx: number) {
    const ix = steps.findIndex((s) => s.idx === idx);
    if (ix === -1 || ix >= steps.length - 1) return;
    const copy = steps.slice();
    const [a, b] = [copy[ix], copy[ix + 1]];
    copy[ix] = { ...b, idx: a.idx };
    copy[ix + 1] = { ...a, idx: b.idx };
    persistSteps(localReindex(copy));
  }

  function removeStep(idx: number) {
    const filtered = steps.filter((s) => s.idx !== idx);
    persistSteps(localReindex(filtered));
  }

  function resetComposer() {
    setNewKind("text");
    setTextBody("");
    setFileId("");
    setCaption("");
    setDelay("");
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  async function handleAddStep() {
    if (!sequence) return;

    let cfg: any = {};
    if (newKind === "text") {
      if (!textBody.trim()) {
        toast({ title: "Texto obrigatório", variant: "destructive" });
        return;
      }
      cfg.text = textBody.trim();
    } else {
      if (!fileId.trim()) {
        toast({ title: "Arquivo / URL obrigatório", variant: "destructive" });
        return;
      }
      cfg.fileId = fileId.trim();
      if (caption.trim() && newKind !== "audio") cfg.caption = caption.trim();
    }

    const d = parseInt(delay || "0", 10);
    if (!Number.isNaN(d) && d > 0) cfg.delayNextSeconds = d;

    const next = localReindex([
      ...steps,
      { idx: steps.length + 1, kind: newKind, cfg },
    ]);

    await persistSteps(next);
    resetComposer();
  }

  async function publish() {
    try {
      const updated = await sequencesApi.publish(sequence.id, orgId);

      // (opcional) atualiza estado local, caso você já faça isso, mantenha o seu:
      setSequence((prev) => (prev ? { ...prev, ...updated.sequence } : prev));

      toast({ title: 'Sequência publicada' });

      // volta para a listagem
      navigate('/sequencias'); // se sua rota for outra, ajuste aqui
    } catch (err: any) {
      toast({
        title: 'Erro ao publicar',
        description: err?.response?.data?.error || err?.message || String(err),
        variant: 'destructive',
      });
    }
  }

  /** Handlers: upload local (imagem e áudio) */
  function handlePickImage() {
    fileInputRef.current?.click();
  }
  function handlePickAudio() {
    audioInputRef.current?.click();
  }

  async function doUpload(file: File) {
    setUploading(true);
    try {
      // preview otimista local
      setPreviewUrl(URL.createObjectURL(file));

      // resposta do upload: não tem 'url', só key/fileId
      const up: { key?: string; fileId?: string } = await uploadsApi.upload(
        organization!.id,
        file
      );

      const key = up.key || up.fileId;
      if (!key) throw new Error("Upload concluído, mas a 'key' não veio na resposta.");

      // persistimos só a KEY
      setFileId(key);

      // preview definitivo (via proxy)
      setPreviewUrl(resolveFileUrl(key));
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    try {
      await doUpload(file);
    } catch (err: any) {
      toast({
        title: "Falha no upload",
        description: String(err?.response?.data?.error || err?.message || err),
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    try {
      await doUpload(file);
    } catch (err: any) {
      toast({
        title: "Falha no upload",
        description: String(err?.response?.data?.error || err?.message || err),
        variant: "destructive",
      });
    } finally {
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }

  /** Esconde URL no campo visible e normaliza quando o usuário cola uma URL */
  function prettyFileId(id: string) {
    if (!id) return "";
    try {
      if (/^https?:\/\//i.test(id)) {
        const u = new URL(id);
        const last = u.pathname.split("/").filter(Boolean).pop();
        return last || id;
      }
    } catch {}
    return id.split("/").filter(Boolean).pop() || id;
  }

  function extractKeyFromUrl(urlOrKey: string) {
    const s = urlOrKey.trim();
    if (!/^https?:\/\//i.test(s)) return s; // já é key
    try {
      const u = new URL(s);
      const parts = u.pathname.split("/").filter(Boolean);
      // URL pública do MinIO: /<bucket>/<key...>  → remove o bucket
      return parts.length > 1 ? parts.slice(1).join("/") : (parts[0] || "");
    } catch {
      return s;
    }
  }

  const fileIdDisplay = React.useMemo(() => prettyFileId(fileId), [fileId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Carregando sequência…</div>
      </div>
    );
  }

  if (!sequence) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Sequência não encontrada.</div>
        <Button variant="outline" className="mt-3" onClick={() => navigate("/sequencias")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/sequencias")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-[320px]"
              placeholder="Nome da sequência"
            />
            <Button onClick={saveName} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
            {statusBadge}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={publish}>
            <Send className="w-4 h-4 mr-2" />
            Publicar
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de passos */}
        <Card>
          <CardHeader>
            <CardTitle>Passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum passo ainda.</div>
            )}

            {steps
              .slice()
              .sort((a, b) => a.idx - b.idx)
              .map((s) => (
                <div
                  key={s.idx}
                  className="border rounded-lg p-3 flex items-center gap-3 justify-between"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="secondary" className="w-10 justify-center">
                      {s.idx}
                    </Badge>
                    <Badge className="capitalize">{s.kind}</Badge>
                    <div className="max-w-[460px]">
                      <StepPreview step={s} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => moveStepUp(s.idx)}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => moveStepDown(s.idx)}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => removeStep(s.idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Composer: adicionar novo passo */}
        <Card>
          <CardHeader>
            <CardTitle>Novo passo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={newKind} onValueChange={(v: string) => setNewKind(v as StepKind)}>
              <TabsList>
                <TabsTrigger value="text">
                  <FileText className="w-4 h-4 mr-1" /> Texto
                </TabsTrigger>
                <TabsTrigger value="image">
                  <ImageIcon className="w-4 h-4 mr-1" /> Imagem
                </TabsTrigger>
                <TabsTrigger value="audio">
                  <FileAudio2 className="w-4 h-4 mr-1" /> Áudio
                </TabsTrigger>
                <TabsTrigger value="video">
                  <VideoIcon className="w-4 h-4 mr-1" /> Vídeo
                </TabsTrigger>
                <TabsTrigger value="document">Documento</TabsTrigger>
              </TabsList>

              {/* Texto */}
              <TabsContent value="text" className="mt-4 space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Conteúdo</label>
                  <Textarea
                    rows={6}
                    value={textBody}
                    onChange={(e) => setTextBody(e.target.value)}
                    placeholder="Digite a mensagem de texto"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Delay (segundos, opcional)</label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={delay}
                    onChange={(e) => setDelay(e.target.value)}
                    placeholder="Ex.: 30"
                  />
                </div>
                <Button onClick={handleAddStep}>Adicionar passo</Button>
              </TabsContent>

              {/* Mídias */}
              {(["image", "audio", "video", "document"] as StepKind[]).map((k) => (
                <TabsContent key={k} value={k} className="mt-4 space-y-3">
                  {k === "image" ? (
                    <>
                      {/* input arquivo oculto (imagem) */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />

                      <div className="space-y-2">
                        <label className="text-sm font-medium">URL/ID da imagem</label>
                        <div className="flex gap-2">
                          <Input
                            value={fileIdDisplay}
                            onChange={(e) => {
                              const v = e.target.value;
                              const normalized = extractKeyFromUrl(v);
                              setFileId(normalized);
                            }}
                            placeholder="Cole uma URL ou selecione um arquivo"
                            title={fileId}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePickImage}
                            disabled={uploading}
                          >
                            <UploadIcon className="w-4 h-4 mr-2" />
                            {uploading ? "Enviando..." : "Upload"}
                          </Button>
                        </div>
                      </div>

                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt="preview"
                          className="h-28 w-28 object-cover rounded border"
                        />
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Legenda (opcional)</label>
                        <Input
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          placeholder="Legenda da imagem"
                        />
                      </div>
                    </>
                  ) : k === "audio" ? (
                    <>
                      {/* input arquivo oculto (áudio) */}
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioFileChange}
                      />

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Arquivo / ID do áudio</label>
                        <div className="flex gap-2">
                          <Input
                            value={fileIdDisplay}
                            onChange={(e) => {
                              const v = e.target.value;
                              const normalized = extractKeyFromUrl(v);
                              setFileId(normalized);
                            }}
                            placeholder="Cole uma URL/ID de áudio ou selecione um arquivo"
                            title={fileId}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePickAudio}
                            disabled={uploading}
                          >
                            <UploadIcon className="w-4 h-4 mr-2" />
                            {uploading ? "Enviando..." : "Upload"}
                          </Button>
                        </div>
                      </div>

                      {previewUrl && (
                        <audio
                          controls
                          src={previewUrl}
                          className="w-full max-w-sm"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Arquivo / URL</label>
                        <Input
                          value={fileId}
                          onChange={(e) => setFileId(e.target.value)}
                          placeholder={`Cole a URL/ID de ${k}`}
                        />
                      </div>

                      {(k === "video" || k === "document") && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Legenda (opcional)</label>
                          <Input
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Legenda para o envio"
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Delay (segundos, opcional) <b>(recomendado)</b>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={delay}
                      onChange={(e) => setDelay(e.target.value)}
                      placeholder="Ex.: 30"
                    />
                  </div>

                  <Button onClick={handleAddStep}>Adicionar passo</Button>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
