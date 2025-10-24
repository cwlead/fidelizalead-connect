# Sistema de Campanhas WhatsApp - FidelizaGlow

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Configuração Inicial](#configuração-inicial)
4. [Estrutura de Dados](#estrutura-de-dados)
5. [Endpoints da API](#endpoints-da-api)
6. [Fluxos de Uso](#fluxos-de-uso)
7. [Integração com N8N](#integração-com-n8n)
8. [Interface do Usuário](#interface-do-usuário)

---

## 🎯 Visão Geral

Sistema completo de gestão de campanhas WhatsApp com:
- **Wizard em 5 etapas** para criação de campanhas
- **Controle de throttling** e segurança anti-ban
- **Monitoramento em tempo real** de envios
- **Gestão de grupos** WhatsApp com importação de contatos
- **Integração com N8N** para processamento assíncrono

### Tecnologias

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React + TypeScript + TailwindCSS
- **Integração**: N8N (workflows)
- **WhatsApp**: Evolution API

---

## 🏗️ Arquitetura

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│   Backend API   │◄────►│   PostgreSQL    │
│   (Express)     │      │   Database      │
└────────┬────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│      N8N        │◄────►│  Evolution API  │
│   (Workflows)   │      │   (WhatsApp)    │
└─────────────────┘      └─────────────────┘
```

---

## ⚙️ Configuração Inicial

### 1. Variáveis de Ambiente (backend/.env)

```bash
# PostgreSQL
PGHOST=127.0.0.1
PGPORT=55432
PGDATABASE=fidelizaglow
PGUSER=necropsyco
PGPASSWORD=@Necro1515
PGSSLMODE=disable
DATABASE_URL=postgresql://necropsyco:%40Necro1515@127.0.0.1:55432/fidelizaglow?sslmode=disable

# Evolution API
EVOLUTION_BASE_URL=https://aplicacoes-evolution-api.9akyvi.easypanel.host
EVOLUTION_AUTH_KEY=429683C4C977415CAAFCCE10F7D57E11
EVOLUTION_INSTANCE_PREFIX=fidelizaglow
EVOLUTION_DEFAULT_WEBHOOK_URL=http://80.190.82.217:4000/api/evolution/webhook
EVOLUTION_WEBHOOK_TOKEN=QWFWQGdhOiASDiUAIBASbQWDPQFi

# N8N Webhooks
N8N_CONTACT_SYNC_WEBHOOK_URL=https://n8n.automatizandotudo.com/webhook/58f945da-1d29-4582-b390-d6a40a8a8766
N8N_SINCRONIZAR_CONTATOS=https://n8n.automatizandotudo.com/webhook/74d9ef49-757f-47d1-8332-2baaeef5ae0d
N8N_CAMPAIGN_DISPATCH_URL=https://n8n.automatizandotudo.com/webhook/campaign-dispatch
N8N_AUDIENCE_ESTIMATE_URL=

# Campaign Defaults
DEFAULT_TEXT_MIN_DELAY_SEC=0
DEFAULT_TEXT_MAX_DELAY_SEC=30
DEFAULT_MEDIA_MIN_DELAY_SEC=30
DEFAULT_MEDIA_MAX_DELAY_SEC=60
DEFAULT_THROTTLE_PER_MINUTE=6
QUIET_HOURS_START=22:00
QUIET_HOURS_END=08:00

# JWT
JWT_SECRET=6a3cd84b6d802561a282702d2be0012e9100d09efaf0052f06f5918b4a506cd3

# Server
PORT=4000
CORS_ORIGINS=http://localhost:5173
```

### 2. Variáveis de Ambiente (frontend/.env)

```bash
VITE_API_BASE_URL=http://localhost:4000
```

### 3. Instalação

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd ..
npm install
npm run dev
```

---

## 📊 Estrutura de Dados

### Tabela: `comms_campaigns`

```sql
CREATE TABLE comms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES core_orgs(id),
  name TEXT NOT NULL,
  segment JSONB,                    -- audience config
  status TEXT NOT NULL,             -- 'draft', 'scheduled', 'running', etc.
  channel TEXT,                     -- 'whatsapp.evolution'
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Campos importantes:**
- `segment`: Configuração do público-alvo (tipo + parâmetros)
- `status`: Pode armazenar JSON com config de throttle quando = 'scheduled'

### Tabela: `comms_messages`

```sql
CREATE TABLE comms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  contact_id UUID,
  campaign_id UUID REFERENCES comms_campaigns(id),
  template TEXT,
  direction TEXT NOT NULL,          -- 'in' ou 'out'
  status TEXT NOT NULL,             -- 'queued', 'sending', 'sent', 'delivered', 'failed', 'skipped'
  provider_msg_id TEXT,
  payload JSONB,                    -- dados da mensagem
  ts TIMESTAMPTZ DEFAULT now()
);
```

### Tabela: `wpp_groups`

```sql
CREATE TABLE wpp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES core_orgs(id),
  wa_group_id TEXT NOT NULL,        -- ID do grupo no WhatsApp
  subject TEXT,                     -- nome do grupo
  picture_url TEXT,                 -- avatar do grupo
  created_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ
);
```

### Tabela: `wpp_group_members`

```sql
CREATE TABLE wpp_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES wpp_groups(id),
  contact_id UUID REFERENCES core_contacts(id),
  wa_user_id TEXT,                  -- ID do usuário no WhatsApp
  role TEXT,                        -- 'admin' ou 'member'
  is_member BOOLEAN DEFAULT true,
  first_join_at TIMESTAMPTZ,
  last_join_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela: `org_settings`

```sql
CREATE TABLE org_settings (
  org_id UUID PRIMARY KEY REFERENCES core_orgs(id),
  evolution_instance_name TEXT,
  evolution_connected BOOLEAN,      -- flag canônica de conexão
  evolution_webhook_url TEXT,
  -- outros campos...
);
```

---

## 🔌 Endpoints da API

### Campanhas

#### 1. GET `/api/campaigns/presets`
Retorna públicos-alvo prontos para uso.

**Resposta:**
```json
[
  {
    "key": "left_group_recent",
    "label": "Saíram do grupo (últimos N dias)",
    "params": { "group_id": "<WA_GROUP_ID>", "days": 7 }
  },
  {
    "key": "joined_group_recent",
    "label": "Entraram no grupo (últimos N dias)",
    "params": { "group_id": "<WA_GROUP_ID>", "days": 3 }
  }
  // ...
]
```

#### 2. GET `/api/campaigns/templates`
Retorna templates de mensagem (texto/áudio/vídeo).

**Resposta:**
```json
{
  "text": [
    {
      "id": "recuperacao_padrao_v1",
      "name": "Recuperação padrão",
      "body": "Oi {first_name}, sentimos sua falta...",
      "variables": ["first_name", "coupon"]
    }
  ],
  "audio": [...],
  "video": [...]
}
```

#### 3. POST `/api/campaigns`
Cria uma nova campanha em rascunho.

**Request:**
```json
{
  "org_id": "uuid",
  "name": "Minha Campanha",
  "channel": "whatsapp.evolution",
  "audience": {
    "type": "left_group_recent",
    "params": { "group_id": "xxx", "days": 7 }
  }
}
```

**Resposta:**
```json
{
  "ok": true,
  "id": "campaign-uuid",
  "status": "draft"
}
```

#### 4. POST `/api/campaigns/:id/estimate`
Calcula estimativa de contatos que serão atingidos.

**Request:**
```json
{
  "org_id": "uuid"
}
```

**Resposta:**
```json
{
  "ok": true,
  "estimated_count": 42
}
```

#### 5. POST `/api/campaigns/:id/schedule`
Salva configurações de throttling e segurança.

**Request:**
```json
{
  "org_id": "uuid",
  "throttle": {
    "text_delay": [0, 30],
    "media_delay": [30, 60],
    "per_minute": 6,
    "quiet_hours": ["22:00", "08:00"],
    "dry_run": true
  },
  "safeguards": {
    "frequency_cap_hours": 72
  }
}
```

**Resposta:**
```json
{
  "ok": true,
  "phase": "scheduled",
  "cfg": { /* config salva */ }
}
```

#### 6. POST `/api/campaigns/:id/run`
Inicia a execução da campanha (dispara para N8N).

**Request:**
```json
{
  "org_id": "uuid"
}
```

**Resposta:**
```json
{
  "ok": true,
  "run": { "accepted": true }
}
```

**Payload enviado ao N8N:**
```json
{
  "org_id": "uuid",
  "campaign_id": "uuid",
  "name": "Nome da Campanha",
  "channel": "whatsapp.evolution",
  "audience": { "type": "...", "params": {...} },
  "options": {
    "phase": "scheduled",
    "cfg": {
      "text_delay": [0, 30],
      "media_delay": [30, 60],
      "per_minute": 6,
      "quiet_hours": ["22:00", "08:00"],
      "dry_run": true,
      "safeguards": { "frequency_cap_hours": 72 }
    }
  }
}
```

#### 7. GET `/api/campaigns/runs/active`
Lista campanhas ativas/recentes com KPIs.

**Query Params:**
- `org_id`: UUID da organização

**Resposta:**
```json
{
  "ok": true,
  "data": [
    {
      "campaign_id": "uuid",
      "campaign_name": "Recuperar saídas",
      "total_processed": 100,
      "sent": 95,
      "delivered": 88,
      "failed": 7,
      "started_at": "2025-01-15T10:00:00Z",
      "last_event_at": "2025-01-15T10:15:00Z"
    }
  ]
}
```

#### 8. GET `/api/campaigns/runs/:run_id/progress` (SSE)
Stream de progresso em tempo real.

**Headers:**
- `Authorization: Bearer <token>`

**Response:** Server-Sent Events
```
event: ping
data: {"ts": "2025-01-15T10:00:00Z"}

event: progress
data: {"sent": 10, "delivered": 8, "failed": 1}
```

### Grupos WhatsApp

#### 9. GET `/api/org/connection/summary`
Retorna estado da conexão Evolution.

**Resposta:**
```json
{
  "org_id": "uuid",
  "evolution_connected": true,
  "evolution_state": "open"
}
```

**Estados possíveis:**
- `evolution_connected`: `true` | `false` | `null`
- `evolution_state`: `"open"` | `"connecting"` | `"close"` | `"closed"` | `null`

#### 10. GET `/api/wpp/groups`
Lista grupos WhatsApp da organização.

**Query Params:**
- `org_id`: UUID da organização

**Resposta:**
```json
[
  {
    "id": "uuid",
    "org_id": "uuid",
    "wa_group_id": "120363xxx@g.us",
    "subject": "Grupo VIP",
    "picture_url": "https://..."
  }
]
```

#### 11. POST `/api/wpp/groups/:group_id/register-members`
Importa/cadastra contatos do grupo.

**Request:**
```json
{
  "org_id": "uuid",
  "wa_group_id": "120363xxx@g.us",
  "subject": "Grupo VIP",
  "trigger": "register_group_contacts"
}
```

**Resposta:**
```json
{
  "ok": true
}
```

**Payload enviado ao N8N:**
```json
{
  "kind": "CONTACT_SYNC_START",
  "org_id": "uuid",
  "instance_name": "fidelizaglow_123",
  "evolution": {
    "base_url": "https://..."
  },
  "triggered_at": "2025-01-15T10:00:00Z"
}
```

---

## 🔄 Fluxos de Uso

### Fluxo 1: Gestão de Grupos WhatsApp

```
1. Usuário acessa /grupos
   └─→ Frontend chama GET /api/org/connection/summary
       ├─→ evolution_connected = null → UI neutra
       ├─→ evolution_connected = false → Banner de aviso
       └─→ evolution_connected = true → Prossegue

2. Se conectado, carrega grupos
   └─→ Frontend chama GET /api/wpp/groups?org_id=xxx
       └─→ Renderiza lista de grupos com cards

3. Usuário clica em "Ver grupo"
   └─→ Card expande, mostra sugestões e CTA

4. Usuário clica em "Importar contatos"
   └─→ Frontend chama POST /api/wpp/groups/:id/register-members
       └─→ Backend chama webhook N8N
           └─→ N8N processa importação assíncrona
```

### Fluxo 2: Criar Campanha (Wizard em 5 Etapas)

```
STEP 1: Escolher Canal
├─→ Usuário seleciona "WhatsApp"
└─→ Clica "Próximo"

STEP 2: Escolher Público
├─→ Frontend chama GET /api/campaigns/presets
├─→ Usuário seleciona preset (ex: "Saíram do grupo")
├─→ Frontend chama POST /api/campaigns
│   └─→ Cria campanha em draft, retorna ID
├─→ Usuário clica "Calcular"
│   └─→ Frontend chama POST /api/campaigns/:id/estimate
│       └─→ Retorna estimated_count
└─→ Clica "Continuar"

STEP 3: Configurar Mensagem
├─→ Frontend chama GET /api/campaigns/templates
├─→ Usuário escolhe template ou escreve texto
├─→ Preenche variáveis se necessário
└─→ Clica "Continuar"

STEP 4: Envio & Segurança
├─→ Usuário ajusta delays, quiet hours, dry_run
├─→ Clica "Aplicar e Continuar"
│   └─→ Frontend chama POST /api/campaigns/:id/schedule
│       └─→ Salva config de throttle
└─→ Vai para revisão

STEP 5: Revisão & Lançamento
├─→ Mostra resumo: canal, público, mensagem, config
├─→ Usuário aceita políticas anti-ban
├─→ Clica "Iniciar Campanha"
│   └─→ Frontend chama POST /api/campaigns/:id/run
│       └─→ Backend chama webhook N8N
│           └─→ N8N processa envios com throttle
└─→ Fecha wizard, mostra toast de sucesso
```

### Fluxo 3: Monitorar Campanhas Ativas

```
1. Página /campanhas carrega automaticamente
   └─→ Frontend chama GET /api/campaigns/runs/active
       └─→ Retorna lista de jobs com KPIs
       └─→ Renderiza tabela

2. Atualização automática a cada 15s
   └─→ Frontend repete chamada em intervalo

3. (Opcional) Stream de progresso em tempo real
   └─→ Frontend conecta SSE em /api/campaigns/runs/:id/progress
       └─→ Recebe eventos de progresso
       └─→ Atualiza UI em tempo real
```

---

## 🔗 Integração com N8N

### Webhook 1: Importação de Contatos

**URL:** `N8N_CONTACT_SYNC_WEBHOOK_URL`

**Trigger:** POST `/api/wpp/groups/:id/register-members`

**Payload:**
```json
{
  "kind": "CONTACT_SYNC_START",
  "org_id": "uuid",
  "instance_name": "fidelizaglow_123",
  "evolution": {
    "base_url": "https://aplicacoes-evolution-api.9akyvi.easypanel.host"
  },
  "triggered_at": "2025-01-15T10:00:00Z"
}
```

**Responsabilidade do N8N:**
1. Receber payload
2. Consultar Evolution API para obter membros do grupo
3. Processar e inserir contatos no banco (`core_contacts`)
4. Criar registros em `wpp_group_members`
5. (Opcional) Notificar conclusão via callback

### Webhook 2: Dispatch de Campanha

**URL:** `N8N_CAMPAIGN_DISPATCH_URL`

**Trigger:** POST `/api/campaigns/:id/run`

**Payload:**
```json
{
  "org_id": "uuid",
  "campaign_id": "uuid",
  "name": "Recuperar saídas (7 dias)",
  "channel": "whatsapp.evolution",
  "audience": {
    "type": "left_group_recent",
    "params": { "group_id": "xxx", "days": 7 }
  },
  "options": {
    "phase": "scheduled",
    "cfg": {
      "text_delay": [0, 30],
      "media_delay": [30, 60],
      "per_minute": 6,
      "quiet_hours": ["22:00", "08:00"],
      "dry_run": true,
      "safeguards": { "frequency_cap_hours": 72 }
    }
  }
}
```

**Responsabilidade do N8N:**
1. Receber payload
2. Resolver lista de contatos do `audience`
   - Consultar banco com filtros do `audience.type` e `params`
3. Enfileirar envios respeitando `cfg`:
   - Delays entre mensagens (`text_delay`, `media_delay`)
   - Limite de mensagens por minuto (`per_minute`)
   - Horários quietos (`quiet_hours`)
   - Frequency cap (não enviar para mesmo contato antes de X horas)
4. Para cada envio:
   - Gravar registro em `comms_messages` com status='queued'
   - Chamar Evolution API para enviar
   - Atualizar status: 'sending' → 'sent' → 'delivered' (via webhook)
   - Em caso de erro: status='failed'
5. Se `dry_run=true`: simular envios sem realmente enviar
6. (Opcional) Reportar progresso via SSE ou webhook

### Webhook 3: Estimativa de Público (Opcional)

**URL:** `N8N_AUDIENCE_ESTIMATE_URL`

**Trigger:** POST `/api/campaigns/:id/estimate`

**Payload:**
```json
{
  "org_id": "uuid",
  "campaign_id": "uuid",
  "audience": {
    "type": "left_group_recent",
    "params": { "group_id": "xxx", "days": 7 }
  }
}
```

**Resposta esperada:**
```json
{
  "estimated_count": 42
}
```

---

## 🎨 Interface do Usuário

### Página: Grupos (/grupos)

**Componentes:**
- `Groups.tsx`: Página principal
  - Lista de grupos em grid responsivo
  - Card por grupo com avatar, nome, wa_group_id
  - Badge de status de conexão
  - Modo focado (expand/collapse)
  
**Modo Focado:**
- Card selecionado expande
- Demais cards ficam com opacity reduzida e desabilitados
- Mostra 3 sugestões de uso
- CTA "Criar campanha para este grupo" → navega para /campanhas
- Botão "Importar contatos" → chama API

**Estados:**
- Loading (skeletons)
- Empty (sem grupos)
- Error (falha ao carregar)
- Conectado/Desconectado (banner condicional)

### Página: Campanhas (/campanhas)

**Componentes:**
- `Campaigns.tsx`: Página principal
  - Botão "Criar Campanha Plus" → abre wizard
  - `JobsActivePanel`: Tabela de jobs ativos
  
- `CampaignWizard.tsx`: Modal/Dialog com 5 steps
  - Progress bar no topo
  - Navegação: Voltar/Próximo
  - `ChannelSelectStep`: Escolher canal (WhatsApp)
  - `AudienceStep`: Escolher público + estimar
  - `MessageStep`: Configurar mensagem (texto/áudio/vídeo)
  - `ScheduleSafetyStep`: Ajustar throttling
  - `ReviewStep`: Revisão final + lançamento

**JobsActivePanel:**
- Atualização automática a cada 15s
- Colunas: Campanha | Enviados | Entregues | Falhas | Última atualização
- Badges coloridos para status
- Formato de data relativo (ex: "há 5 minutos")

---

## 🔐 Segurança & Anti-Ban

### Medidas Implementadas

1. **Text Delay**: 0-30s entre mensagens de texto
2. **Media Delay**: 30-60s entre mensagens de mídia
3. **Throttling**: Máximo 6 mensagens/minuto (padrão)
4. **Quiet Hours**: Não enviar entre 22:00-08:00
5. **Frequency Cap**: Não enviar para mesmo contato antes de 72h
6. **Dry Run**: Primeira execução sempre em modo teste

### Configuração via ENV

Todos os defaults podem ser ajustados nas variáveis:
```bash
DEFAULT_TEXT_MIN_DELAY_SEC=0
DEFAULT_TEXT_MAX_DELAY_SEC=30
DEFAULT_MEDIA_MIN_DELAY_SEC=30
DEFAULT_MEDIA_MAX_DELAY_SEC=60
DEFAULT_THROTTLE_PER_MINUTE=6
QUIET_HOURS_START=22:00
QUIET_HOURS_END=08:00
```

### Políticas de Uso

- Usuário deve aceitar termo no wizard (Step 5)
- Primeira campanha sempre roda em dry_run
- Backend valida delays mínimos
- N8N é responsável por aplicar as regras de throttle

---

## 📝 Próximos Passos

### Melhorias Sugeridas

1. **Segmentação Avançada**
   - Criar interface para salvar segmentos personalizados
   - Combinar múltiplos filtros (tags, compras, atividade)

2. **Templates Customizados**
   - Permitir usuário criar seus próprios templates
   - Editor WYSIWYG para mensagens

3. **Analytics Detalhado**
   - Dashboard com gráficos de performance
   - Taxa de abertura/resposta por campanha
   - Análise de horários de melhor performance

4. **A/B Testing**
   - Testar diferentes mensagens
   - Comparar resultados automaticamente

5. **Agendamento Avançado**
   - Campanhas recorrentes
   - Triggers automáticos (ex: novo membro no grupo)

6. **Notificações**
   - Alertas quando campanha finalizar
   - Avisos de taxa de falha alta

---

## 🐛 Troubleshooting

### Problema: "Evolution não conecta"

**Verificar:**
1. `org_settings.evolution_connected` está `true`?
2. `evolution_state` retorna "open"?
3. Variáveis de ambiente estão corretas?
   - `EVOLUTION_BASE_URL`
   - `EVOLUTION_AUTH_KEY`
   - `EVOLUTION_INSTANCE_PREFIX`

**Solução:**
```sql
-- Verificar config no banco
SELECT * FROM org_settings WHERE org_id = 'seu-org-id';

-- Forçar reconexão (se necessário)
UPDATE org_settings 
SET evolution_connected = true 
WHERE org_id = 'seu-org-id';
```

### Problema: "Campanha não inicia"

**Verificar:**
1. Webhook N8N está configurado?
   - `N8N_CAMPAIGN_DISPATCH_URL` no `.env`
2. Campanha foi agendada (schedule)?
3. Logs do backend mostram erro?

**Debug:**
```bash
# Ver logs do backend
cd backend
npm run dev

# Testar webhook manualmente
curl -X POST https://n8n.automatizandotudo.com/webhook/campaign-dispatch \
  -H "Content-Type: application/json" \
  -d '{"org_id":"xxx","campaign_id":"yyy",...}'
```

### Problema: "Estimativa sempre retorna 42"

**Causa:** Modo mock ativo (N8N_AUDIENCE_ESTIMATE_URL não configurado)

**Solução:**
1. Configurar webhook de estimativa no N8N
2. Adicionar URL no `.env`: `N8N_AUDIENCE_ESTIMATE_URL=...`
3. Reiniciar backend

### Problema: "Jobs não atualizam em tempo real"

**Verificar:**
1. Tabela `comms_messages` está sendo populada?
2. N8N está gravando status dos envios?
3. Intervalo de polling está ativo? (15s)

**Query de debug:**
```sql
-- Ver últimas mensagens
SELECT * FROM comms_messages 
WHERE campaign_id = 'seu-campaign-id' 
ORDER BY ts DESC 
LIMIT 20;

-- Contar por status
SELECT status, COUNT(*) 
FROM comms_messages 
WHERE campaign_id = 'seu-campaign-id' 
GROUP BY status;
```

---

## 📞 Suporte

- **Documentação Evolution API**: https://doc.evolution-api.com/
- **Documentação N8N**: https://docs.n8n.io/
- **Email**: suporte@fidelizaglow.com

---

## 📄 Licença

Propriedade de FidelizaGlow © 2025. Todos os direitos reservados.
