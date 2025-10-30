import axios from 'axios';
import type { AuthResponse, User, Organization } from '@/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor para adicionar token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


// Auth
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  logout: async () => {
    await api.post('/auth/logout');
  },
  me: async (): Promise<{ user: User; organization: Organization }> => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

// Contacts
export const contactsApi = {
  list: async (params?: any) => {
    const { data } = await api.get('/contacts', { params });
    return data;
  },
  get: async (id: string) => {
    const { data } = await api.get(`/contacts/${id}`);
    return data;
  },
  create: async (contact: any) => {
    const { data } = await api.post('/contacts', contact);
    return data;
  },
  update: async (id: string, contact: any) => {
    const { data } = await api.put(`/contacts/${id}`, contact);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/contacts/${id}`);
  },
  import: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/contacts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};


// Campaigns
export const campaignsApi = {
  presets: async () => {
    const { data } = await api.get('/campaigns/presets');
    return data;
  },
  templates: async () => {
    const { data } = await api.get('/campaigns/templates');
    return data;
  },
  create: async (campaign: any) => {
    const { data } = await api.post('/campaigns', campaign);
    return data;
  },
  estimate: async (id: string, orgId?: string) => {
    const { data } = await api.post(`/campaigns/${id}/estimate`, { org_id: orgId });
    return data;
  },
  schedule: async (id: string, throttle: any, orgId?: string) => {
    const { data } = await api.post(`/campaigns/${id}/schedule`, { throttle, org_id: orgId });
    return data;
  },

  // ✅ NOVO: chama o endpoint /campaigns/:id/materialize_and_run
  materializeAndRun: async (id: string, orgId?: string) => {
    const { data } = await api.post(`/campaigns/${id}/materialize_and_run`, { org_id: orgId });
    return data;
  },

  // 🔁 Compat: mantém campaignsApi.run funcionando, apontando para o novo endpoint
  run: async (id: string, orgId?: string) => {
    return campaignsApi.materializeAndRun(id, orgId);
  },
  getActiveRuns: async (orgId?: string) => {
    const { data } = await api.get('/campaigns/runs/active_v2', {
      params: { org_id: orgId, _t: Date.now() }, // cache-buster
      headers: { 'Cache-Control': 'no-cache' },
    });
    return data;
  },
  getRunProgress: (runId: string) => {
    const token = localStorage.getItem('auth_token');
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    return new EventSource(`${baseURL}/api/campaigns/runs/${runId}/progress?token=${token}`);
  },
  saveMessage: async (id: string, orgId: string | undefined, message: any) => {
    const { data } = await api.patch(`/campaigns/${id}/message`, { org_id: orgId, message });
    return data;
  },
  getRunRecentRecipients: async (runId: string, orgId?: string) => {
  const { data } = await api.get(`/campaigns/runs/${runId}/recent_recipients`, {
    params: { org_id: orgId, _t: Date.now() },  // cache-buster
    headers: { 'Cache-Control': 'no-cache' }
  });
  return data;
},
};

export const wppApi = {
  /** Lista grupos da organização */
  groups: async (orgId?: string) => {
    const { data } = await api.get('/wpp/groups', {
      params: { org_id: orgId }, // backend aceita pelo JWT ou por query
    });
    return data; // [{ id, org_id, wa_group_id, subject, picture_url, ... }]
  },
};
// Sequences
export const sequencesApi = {
  list: async (params: {
    orgId: string;
    status?: string;
    channel?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.channel) searchParams.set('channel', params.channel);
    if (params.q) searchParams.set('q', params.q);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());

    const { data } = await api.get(`/sequences?${searchParams.toString()}`, {
      headers: { 'X-Org-Id': params.orgId },
    });
    return data;
  },

  create: async (data: { orgId: string; name: string; channel?: string }) => {
    const { data: result } = await api.post(
      '/sequences',
      { name: data.name, channel: data.channel },
      { headers: { 'X-Org-Id': data.orgId } }
    );
    return result.sequence;
  },

  get: async (id: string, orgId: string) => {
    const { data } = await api.get(`/sequences/${id}`, {
      headers: { 'X-Org-Id': orgId },
    });
    return data;
  },

  update: async (id: string, orgId: string, data: { name?: string; active?: boolean }) => {
    const { data: result } = await api.put(
      `/sequences/${id}`,
      data,
      { headers: { 'X-Org-Id': orgId } }
    );
    return result.sequence;
  },

  updateSteps: async (
    id: string,
    orgId: string,
    steps: Array<{ idx: number; kind: string; cfg: any }>
  ) => {
    const { data } = await api.put(
      `/sequences/${id}/steps`,
      { steps },
      { headers: { 'X-Org-Id': orgId } }
    );
    return data.steps;
  },

  publish: async (id: string, orgId: string) => {
    const { data } = await api.post(
      `/sequences/${id}/publish`,
      {},
      { headers: { 'X-Org-Id': orgId } }
    );
    return data.sequence;
  },

  duplicate: async (id: string, orgId: string) => {
    const { data } = await api.post(
      `/sequences/${id}/duplicate`,
      {},
      { headers: { 'X-Org-Id': orgId } }
    );
    return data;
  },

  testSend: async (id: string, orgId: string, data: { wa_number: string; vars?: Record<string, any> }) => {
    const { data: result } = await api.post(
      `/sequences/${id}/test-send`,
      data,
      { headers: { 'X-Org-Id': orgId } }
    );
    return result;
  },

  archive: async (id: string, orgId: string) => {
    const { data } = await api.post(
      `/sequences/${id}/archive`,
      {},
      { headers: { 'X-Org-Id': orgId } }
    );
    return data.sequence;
  },
};

// Loyalty (Points, Vouchers, Rank)
export const loyaltyApi = {
  getPoints: async (contactId?: string) => {
    const { data } = await api.get('/loyalty/points', { params: { contactId } });
    return data;
  },
  vouchers: {
    list: async (params?: any) => {
      const { data } = await api.get('/loyalty/vouchers', { params });
      return data;
    },
    create: async (voucher: any) => {
      const { data } = await api.post('/loyalty/vouchers', voucher);
      return data;
    },
    redeem: async (code: string) => {
      const { data } = await api.post(`/loyalty/vouchers/${code}/redeem`);
      return data;
    },
  },
  rank: {
    tiers: async () => {
      const { data } = await api.get('/loyalty/rank/tiers');
      return data;
    },
    updateTier: async (code: string, tier: any) => {
      const { data } = await api.put(`/loyalty/rank/tiers/${code}`, tier);
      return data;
    },
    members: async (tierCode?: string) => {
      const { data } = await api.get('/loyalty/rank/members', { params: { tierCode } });
      return data;
    },
    preview: async (contactId: string) => {
      const { data } = await api.get(`/loyalty/rank/preview/${contactId}`);
      return data;
    },
  },
};

// Onboarding
export const onboardingApi = {
  save: async (data: any) => {
    const { data: result } = await api.post('/onboarding', data);
    return result;
  },
  get: async () => {
    const { data } = await api.get('/onboarding');
    return data;
  },
};

// Evolution
export const evolutionApi = {
  connect: async (data?: any) => {
    const { data: result } = await api.post('/evolution/connect', data || {});
    return result;
  },
};

// Integrations
export const integrationsApi = {
  list: async () => {
    const { data } = await api.get('/integrations');
    return data;
  },
  get: async (id: string) => {
    const { data } = await api.get(`/integrations/${id}`);
    return data;
  },
  create: async (integration: any) => {
    const { data } = await api.post('/integrations', integration);
    return data;
  },
  update: async (id: string, integration: any) => {
    const { data } = await api.put(`/integrations/${id}`, integration);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/integrations/${id}`);
  },
  connect: async (id: string) => {
    const { data } = await api.post(`/integrations/${id}/connect`);
    return data;
  },
  disconnect: async (id: string) => {
    const { data } = await api.post(`/integrations/${id}/disconnect`);
    return data;
  },
  sync: async (id: string) => {
    const { data } = await api.post(`/integrations/${id}/sync`);
    return data;
  },
  shopify: {
    oauthStart: async (params: { shop_domain: string; requested_scopes: string }) => {
      const { data } = await api.post('/integrations/shopify/oauth/start', params);
      return data;
    },
    test: async (integrationId: string) => {
      const { data } = await api.post('/integrations/shopify/test', { integration_id: integrationId });
      return data;
    },
    sync: async (integrationId: string) => {
      const { data } = await api.post('/integrations/shopify/sync', { integration_id: integrationId });
      return data;
    },
  },
  bling: {
    oauthStart: async (params: { requested_scopes: string }) => {
      const { data } = await api.post('/integrations/bling/oauth/start', params);
      return data;
    },
    test: async (integrationId: string) => {
      const { data } = await api.post('/integrations/bling/test', { integration_id: integrationId });
      return data;
    },
    sync: async (integrationId: string) => {
      const { data } = await api.post('/integrations/bling/sync', { integration_id: integrationId });
      return data;
    },
  },
};

// Organization Connection
export const orgConnectionApi = {
  getSummary: async () => {
    const { data } = await api.get('/org/connection/summary');
    return data;
  },
};

// WhatsApp Groups
export const whatsappGroupsApi = {
  list: async (orgId: string) => {
    const { data } = await api.get('/wpp/groups', { params: { org_id: orgId } });
    return data;
  },
  registerMembers: async (groupId: string, payload: any) => {
    const { data } = await api.post(`/wpp/groups/${groupId}/register-members`, payload);
    return data;
  },
};

// Reports
export const reportsApi = {
  campaigns: async (params?: any) => {
    const { data } = await api.get('/reports/campaigns', { params });
    return data;
  },
  dashboard: async () => {
    const { data } = await api.get('/reports/dashboard');
    return data;
  },
};

// Settings
export const settingsApi = {
  organization: {
    get: async () => {
      const { data } = await api.get('/settings/organization');
      return data;
    },
    update: async (org: any) => {
      const { data } = await api.put('/settings/organization', org);
      return data;
    },
  },
  users: {
    list: async () => {
      const { data } = await api.get('/settings/users');
      return data;
    },
    create: async (user: any) => {
      const { data } = await api.post('/settings/users', user);
      return data;
    },
    update: async (id: string, user: any) => {
      const { data } = await api.put(`/settings/users/${id}`, user);
      return data;
    },
    delete: async (id: string) => {
      await api.delete(`/settings/users/${id}`);
    },
  },
};

export default api;
