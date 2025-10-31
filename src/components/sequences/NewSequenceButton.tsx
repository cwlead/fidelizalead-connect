// src/components/sequences/NewSequenceButton.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, sequencesApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StepKind = "blank" | "text" | "image" | "audio" | "video" | "document";

export default function NewSequenceButton() {
  const navigate = useNavigate();

  // modal
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // org
  const [orgId, setOrgId] = useState<string>("");

  // form
  const [name, setName] = useState("Nova Sequência");
  const [kind, setKind] = useState<StepKind>("blank");

  // campos do 1º passo (opcional)
  const [text, setText] = useState("");
  const [fileId, setFileId] = useState("");
  const [caption, setCaption] = useState("");
  const [filename, setFilename] = useState("");
  const [delay, setDelay] = useState("");

  // pega org da sessão usando seu authApi existente
  useEffect(() => {
    (async () => {
      try {
        const me = await authApi.me(); // { user, organization }
        const id = (me as any)?.organization?.id;
        if (id) setOrgId(id);
      } catch (e) {
        console.error("auth.me failed", e);
      }
    })();
  }, []);

  function onlyDigits(s: string) {
    return s.replace(/\D+/g, "");
  }

  async function createUniqueSequence(baseName: string) {
    // tenta criar; se der erro de nome duplicado, adiciona sufixo
    try {
      return await sequencesApi.create({ orgId, name: baseName, channel: "whatsapp" });
    } catch (err: any) {
      const msg = String(err?.response?.data || err?.message || "");
      const dup =
        msg.includes("ux_comms_sequences_org_name_version") ||
        msg.toLowerCase().includes("duplicate key");
      if (!dup) throw err;
      const suffix = Math.random().toString(36).slice(2, 7);
      const altName = `${baseName} - ${suffix}`;
      return await sequencesApi.create({ orgId, name: altName, channel: "whatsapp" });
    }
  }

  async function onConfirm() {
    if (!orgId) {
      alert("Organização não encontrada. Recarregue a página e faça login novamente.");
      return;
    }

    try {
      setSubmitting(true);

      const seq = await createUniqueSequence(name.trim() || "Nova Sequência");

      // salva 1º passo opcional
      if (kind !== "blank") {
        const vDelay =
          delay.trim() === "" ? undefined : Math.max(0, parseInt(delay, 10) || 0);

        if (kind === "text") {
          if (!text.trim()) throw new Error("Informe o texto do primeiro passo.");
          await sequencesApi.updateSteps(seq.id, orgId, [
            { idx: 1, kind: "text", cfg: { text: text.trim(), delayNextSeconds: vDelay } },
          ]);
        } else {
          if (!fileId.trim()) throw new Error("Informe o fileId da mídia.");
          await sequencesApi.updateSteps(seq.id, orgId, [
            {
              idx: 1,
              kind,
              cfg: {
                fileId: fileId.trim(),
                caption: caption.trim() || undefined,
                filename: kind === "document" ? (filename.trim() || undefined) : undefined,
                delayNextSeconds: vDelay,
              },
            },
          ]);
        }
      }

      // vai para o editor da sequência
      navigate(`/sequencias/${seq.id}`);
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Falha ao criar a sequência.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Nova Sequência</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Criar nova sequência</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Nome */}
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Boas-vindas WhatsApp"
            />
          </div>

          {/* Escolha do primeiro passo (opcional) */}
          <div className="space-y-2">
            <Label>Primeiro passo (opcional)</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["blank", "text", "image", "audio", "video", "document"] as StepKind[]).map(
                (v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setKind(v)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      kind === v ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted"
                    }`}
                  >
                    {v === "blank" ? "Começar em branco" : v.toUpperCase()}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Campos do 1º passo */}
          {kind === "text" && (
            <div className="space-y-2">
              <Label>Texto</Label>
              <Textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Sua primeira mensagem…"
              />
            </div>
          )}

          {["image", "audio", "video", "document"].includes(kind) && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>fileId</Label>
                <Input
                  value={fileId}
                  onChange={(e) => setFileId(e.target.value)}
                  placeholder="ex.: s3://bucket/key ou drive://abc123"
                />
              </div>
              <div className="space-y-2">
                <Label>Legenda (opcional)</Label>
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Legenda a ser exibida"
                />
              </div>
              {kind === "document" && (
                <div className="space-y-2">
                  <Label>Filename (opcional)</Label>
                  <Input
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="ex.: proposta.pdf"
                  />
                </div>
              )}
            </div>
          )}

          {/* Delay opcional */}
          {kind !== "blank" && (
            <div className="space-y-2">
              <Label>Delay do 1º passo (segundos, opcional)</Label>
              <Input
                value={delay}
                onChange={(e) => setDelay(onlyDigits(e.target.value))}
                inputMode="numeric"
                placeholder="ex.: 5"
              />
              <p className="text-xs text-muted-foreground">
                Se informado, o worker pode aplicar este delay antes de enviar o passo.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={submitting || !orgId}>
            {submitting ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
