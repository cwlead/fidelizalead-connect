# Sistema de Sequências (Playbooks)

## 📋 Visão Geral

Sistema completo de criação e gerenciamento de **Sequências** (playbooks de mensagens) para campanhas de WhatsApp. 

Uma **Sequência** é uma lista linear de passos (texto, imagem, áudio, vídeo, documento) com delays opcionais entre cada passo.

### ✅ O que foi implementado

**Backend:**
- ✅ 9 endpoints REST para CRUD completo de sequências
- ✅ Suporte a draft/published/archived
- ✅ Versionamento automático ao publicar
- ✅ Duplicação de sequências
- ✅ Teste de envio (integração N8N)
- ✅ Busca com unaccent (busca sem acentuação)

**Frontend:**
- ✅ Página de listagem (`/sequencias`) com busca, filtros e paginação
- ✅ Criação de novas sequências
- ✅ Ações: Editar, Duplicar, Arquivar
- ✅ TypeScript types completos
- ✅ Integração com API

---

## 🗄️ Banco de Dados

### Tabelas Existentes

```sql
-- Sequências (playbooks)
CREATE TABLE public.comms_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  runner_kind TEXT DEFAULT 'n8n',
  active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Passos da sequência
CREATE TABLE public.comms_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.comms_sequences(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL CHECK (idx >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'audio', 'video', 'document')),
  cfg JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Índices Recomendados

```sql
-- Performance para listagem e busca
CREATE INDEX IF NOT EXISTS ix_seq_org_status_updated 
  ON public.comms_sequences(org_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_seq_org_channel 
  ON public.comms_sequences(org_id, channel);

CREATE INDEX IF NOT EXISTS ix_seq_steps_sequence 
  ON public.comms_sequence_steps(sequence_id, idx);

-- Habilitar busca sem acentuação
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Estrutura do campo `cfg` (JSONB)

```typescript
// Para passos de TEXTO
{
  "text": "Oi {first_name}, tudo bem?",
  "delayNextSeconds": 5  // opcional
}

// Para passos de MÍDIA (image/audio/video/document)
{
  "fileId": "uuid-do-arquivo",
  "caption": "Legenda opcional",
  "filename": "documento.pdf",  // apenas para document
  "delayNextSeconds": 10
}
```

---

## 🔌 Backend - API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Headers obrigatórios
```
Authorization: Bearer <jwt_token>
X-Org-Id: <organization_uuid>
```

---

### 1. **Listar Sequências**
```http
GET /api/sequences?status=draft&channel=whatsapp&q=recuperacao&page=1&limit=20
```

**Query Params:**
- `status` (opcional): `draft` | `published` | `archived`
- `channel` (opcional): `whatsapp`
- `q` (opcional): busca no nome (sem acentuação)
- `page` (padrão: 1)
- `limit` (padrão: 20, máx: 100)

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "name": "Sequência de Recuperação",
      "channel": "whatsapp",
      "status": "published",
      "version": 2,
      "active": true,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-16T14:30:00Z",
      "steps_count": 3
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

### 2. **Criar Sequência (Draft)**
```http
POST /api/sequences
Content-Type: application/json

{
  "name": "Minha Nova Sequência",
  "channel": "whatsapp"
}
```

**Response 201:**
```json
{
  "sequence": {
    "id": "uuid",
    "org_id": "uuid",
    "name": "Minha Nova Sequência",
    "channel": "whatsapp",
    "status": "draft",
    "version": 1,
    "active": true,
    "created_at": "2025-01-17T10:00:00Z",
    "updated_at": "2025-01-17T10:00:00Z"
  }
}
```

---

### 3. **Ler Sequência + Passos**
```http
GET /api/sequences/:id
```

**Response 200:**
```json
{
  "sequence": {
    "id": "uuid",
    "name": "Recuperação VIP",
    "status": "published",
    "version": 2
  },
  "steps": [
    {
      "id": "step-uuid-1",
      "sequence_id": "uuid",
      "idx": 1,
      "kind": "text",
      "cfg": {
        "text": "Oi {first_name}, sentimos sua falta!",
        "delayNextSeconds": 5
      }
    },
    {
      "id": "step-uuid-2",
      "sequence_id": "uuid",
      "idx": 2,
      "kind": "image",
      "cfg": {
        "fileId": "image-uuid",
        "caption": "Veja essa oferta especial!",
        "delayNextSeconds": 10
      }
    }
  ]
}
```

---

### 4. **Atualizar Metadados (apenas Draft)**
```http
PUT /api/sequences/:id
Content-Type: application/json

{
  "name": "Novo Nome da Sequência",
  "active": true
}
```

**Response 200:**
```json
{
  "sequence": { /* sequência atualizada */ }
}
```

**Erro 404:** Sequência não encontrada ou não está em draft

---

### 5. **Salvar Passos (apenas Draft)**
```http
PUT /api/sequences/:id/steps
Content-Type: application/json

{
  "steps": [
    {
      "kind": "text",
      "cfg": {
        "text": "Olá {first_name}!",
        "delayNextSeconds": 3
      }
    },
    {
      "kind": "image",
      "cfg": {
        "fileId": "file-uuid-123",
        "caption": "Confira essa novidade"
      }
    }
  ]
}
```

**Validações:**
- `kind` deve ser: `text` | `image` | `audio` | `video` | `document`
- `text` step requer `cfg.text`
- Mídia steps requerem `cfg.fileId`
- `delayNextSeconds` deve ser >= 0 se presente

**Response 200:**
```json
{
  "steps": [
    {
      "id": "uuid",
      "sequence_id": "seq-uuid",
      "idx": 1,
      "kind": "text",
      "cfg": { "text": "Olá {first_name}!", "delayNextSeconds": 3 }
    }
  ]
}
```

---

### 6. **Publicar Sequência**
```http
POST /api/sequences/:id/publish
```

**Validações:**
- Deve ter pelo menos 1 passo
- Deve estar em status `draft`

**Response 200:**
```json
{
  "sequence": {
    "id": "uuid",
    "status": "published",
    "version": 2,  // incrementado
    "updated_at": "2025-01-17T10:30:00Z"
  }
}
```

**Efeitos:**
- `status` → `published`
- `version` incrementado (+1)
- Trava edição (não pode mais alterar passos)

---

### 7. **Duplicar Sequência**
```http
POST /api/sequences/:id/duplicate
```

**Response 201:**
```json
{
  "sequence": {
    "id": "new-uuid",
    "name": "Recuperação VIP (cópia)",
    "status": "draft",
    "version": 1
  },
  "steps": [ /* todos os passos copiados */ ]
}
```

**Permite:** Criar novo draft a partir de qualquer sequência (draft, published ou archived)

---

### 8. **Teste de Envio**
```http
POST /api/sequences/:id/test-send
Content-Type: application/json

{
  "wa_number": "5511999998888",
  "vars": {
    "first_name": "João",
    "coupon": "SAVE20"
  }
}
```

**Response 202:**
```json
{
  "ok": true,
  "test_run_id": "test-uuid-123"
}
```

**Integração:** Chama N8N webhook configurado em `N8N_SEQUENCE_TEST_URL`

---

### 9. **Arquivar Sequência**
```http
POST /api/sequences/:id/archive
```

**Validações:**
- Deve estar em status `published`

**Response 200:**
```json
{
  "sequence": {
    "id": "uuid",
    "status": "archived",
    "updated_at": "2025-01-17T11:00:00Z"
  }
}
```

---

## 🎨 Frontend - Estrutura

### Arquivos Criados/Modificados

```
src/
├── types/
│   └── sequences.ts                    # ✅ Types TypeScript
├── lib/
│   └── api.ts                          # ✅ sequencesApi adicionado
├── pages/
│   └── Sequences.tsx                   # ✅ Listagem principal
```

### Tipos TypeScript

```typescript
// src/types/sequences.ts
export type SequenceStatus = 'draft' | 'published' | 'archived';
export type StepKind = 'text' | 'image' | 'audio' | 'video' | 'document';

export type StepCfg =
  | { text: string; delayNextSeconds?: number }
  | { fileId: string; caption?: string; filename?: string; delayNextSeconds?: number };

export interface Sequence {
  id: string;
  org_id: string;
  name: string;
  channel: 'whatsapp';
  status: SequenceStatus;
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  steps_count?: number;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  idx: number;
  kind: StepKind;
  cfg: StepCfg;
}

export interface SequenceWithSteps {
  sequence: Sequence;
  steps: SequenceStep[];
}
```

### API Client

```typescript
// src/lib/api.ts - exemplo de uso
import { sequencesApi } from '@/lib/api';

// Listar
const { items, total } = await sequencesApi.list({
  status: 'published',
  q: 'recuperacao',
  page: 1,
  limit: 20
});

// Criar
const { sequence } = await sequencesApi.create({
  name: 'Nova Sequência',
  channel: 'whatsapp'
});

// Ler
const { sequence, steps } = await sequencesApi.getById(sequenceId);

// Publicar
await sequencesApi.publish(sequenceId);

// Duplicar
const { sequence: newSeq, steps: newSteps } = await sequencesApi.duplicate(sequenceId);
```

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente (Backend)

Adicione ao `backend/.env`:

```bash
# Webhook N8N para teste de envio de sequências
N8N_SEQUENCE_TEST_URL=https://n8n.seudominio.com/webhook/sequence-test

# Token interno para autenticar chamadas ao N8N (opcional)
INTERNAL_TOKEN=seu-token-secreto-aqui
```

### 2. Registrar Router no Backend

Já configurado em `backend/src/server.ts`:

```typescript
import { sequencesRouter } from './routes/sequences';

app.use('/api', sequencesRouter);
```

### 3. Executar Migrações (se necessário)

```bash
cd backend
npm run migrate  # ou seu comando de migração
```

**Ou execute manualmente:**

```sql
-- Criar tabelas (se não existirem)
CREATE TABLE IF NOT EXISTS public.comms_sequences ( /* ... */ );
CREATE TABLE IF NOT EXISTS public.comms_sequence_steps ( /* ... */ );

-- Criar índices
CREATE INDEX IF NOT EXISTS ix_seq_org_status_updated ON public.comms_sequences(org_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_seq_org_channel ON public.comms_sequences(org_id, channel);
CREATE INDEX IF NOT EXISTS ix_seq_steps_sequence ON public.comms_sequence_steps(sequence_id, idx);

-- Habilitar busca sem acentuação
CREATE EXTENSION IF NOT EXISTS unaccent;
```

---

## 🚀 Como Usar

### 1. Iniciar Backend
```bash
cd backend
npm install
npm run dev  # porta 3000
```

### 2. Iniciar Frontend
```bash
npm install
npm run dev  # porta 8080
```

### 3. Acessar Interface

Navegue para: `http://localhost:8080/sequencias`

**Fluxo:**
1. ✅ Ver lista de sequências existentes
2. ✅ Criar nova sequência (botão "Nova Sequência")
3. ✅ Duplicar sequências existentes
4. ✅ Filtrar por status (Draft, Published, Archived)
5. ✅ Buscar pelo nome

---

## 📝 Próximos Passos (Não Implementados)

### Editor/Visualizador de Sequências

**Falta criar:**
- `/sequencias/:id` - Página de edição/visualização
- Componentes:
  - `StepList.tsx` - Lista de passos com drag & drop
  - `StepCardText.tsx` - Editor de passo texto
  - `StepCardMedia.tsx` - Editor de mídia
  - `AddStepMenu.tsx` - Menu para adicionar novos passos
  - `PreviewWhats.tsx` - Preview estilo WhatsApp

**Funcionalidades necessárias:**
- ✏️ Adicionar/remover/reordenar passos
- 💾 Salvar mudanças (PUT /api/sequences/:id/steps)
- 📱 Preview em tempo real
- 🧪 Botão "Testar Envio" com modal
- 🔒 Modo read-only para published/archived
- ✅ Validações de formulário

### Integração com Campanhas

**No wizard de campanha existente:**
- Adicionar `SequenceSelectStep.tsx`
- Listar sequências publicadas
- Ao selecionar: PUT /api/campaigns/:id/sequence { sequence_id }
- Mostrar preview da sequência selecionada

---

## 🧪 Testando a API

### Via cURL

```bash
# 1. Obter token JWT (autenticação)
TOKEN="seu-jwt-token"
ORG_ID="seu-org-uuid"

# 2. Criar sequência
curl -X POST http://localhost:3000/api/sequences \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste API","channel":"whatsapp"}'

# 3. Listar sequências
curl -X GET "http://localhost:3000/api/sequences?status=draft" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG_ID"

# 4. Adicionar passos (use o ID retornado)
SEQUENCE_ID="uuid-da-sequencia"
curl -X PUT http://localhost:3000/api/sequences/$SEQUENCE_ID/steps \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      {
        "kind": "text",
        "cfg": {"text": "Olá {first_name}!", "delayNextSeconds": 5}
      }
    ]
  }'

# 5. Publicar
curl -X POST http://localhost:3000/api/sequences/$SEQUENCE_ID/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG_ID"
```

---

## 🐛 Troubleshooting

### Erro: "missing_org_id"
- Verifique se está enviando header `X-Org-Id`
- Confirme que o JWT contém `org_id` no payload

### Erro: "sequence_not_found"
- Confirme que o UUID está correto
- Verifique se a sequência pertence ao org_id informado

### Erro: "sequence_not_draft"
- Só é possível editar sequências em status `draft`
- Use "Duplicar" para criar uma cópia editável

### Busca não funciona corretamente
- Certifique-se de que a extensão `unaccent` está habilitada:
  ```sql
  CREATE EXTENSION IF NOT EXISTS unaccent;
  ```

### Erro ao publicar: "sequence_requires_at_least_one_step"
- Adicione pelo menos 1 passo antes de publicar
- Use PUT /api/sequences/:id/steps

---

## 📊 Status da Implementação

| Funcionalidade | Backend | Frontend | Status |
|----------------|---------|----------|--------|
| Listar sequências | ✅ | ✅ | **Completo** |
| Criar sequência | ✅ | ✅ | **Completo** |
| Duplicar sequência | ✅ | ✅ | **Completo** |
| Arquivar sequência | ✅ | ✅ | **Completo** |
| Filtros e busca | ✅ | ✅ | **Completo** |
| Editor de passos | ✅ | ❌ | **Pendente** |
| Preview WhatsApp | ✅ | ❌ | **Pendente** |
| Teste de envio | ✅ | ❌ | **Pendente** |
| Integração N8N | ✅ | N/A | **Completo** |
| Integração com Campanhas | ✅ | ❌ | **Pendente** |

---

## 🔗 Links Úteis

- [README Principal](./README.md)
- [README Campanhas](./README_CAMPANHAS.md)
- Banco de dados: PostgreSQL via `backend/src/db.ts`
- Autenticação: JWT via `backend/src/middlewares/auth.ts`

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do backend: `backend/src/logger.ts`
2. Inspecione a rede no DevTools (aba Network)
3. Confirme que todas as tabelas e índices foram criados
4. Valide que o N8N está configurado e respondendo

---

**Última atualização:** 2025-01-17
**Versão:** 1.0.0
