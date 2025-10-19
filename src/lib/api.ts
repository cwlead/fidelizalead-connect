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
  list: async (params?: any) => {
    const { data } = await api.get('/campaigns', { params });
    return data;
  },
  get: async (id: string) => {
    const { data } = await api.get(`/campaigns/${id}`);
    return data;
  },
  create: async (campaign: any) => {
    const { data } = await api.post('/campaigns', campaign);
    return data;
  },
  update: async (id: string, campaign: any) => {
    const { data } = await api.put(`/campaigns/${id}`, campaign);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/campaigns/${id}`);
  },
  send: async (id: string) => {
    const { data } = await api.post(`/campaigns/${id}/send`);
    return data;
  },
  results: async (id: string, params?: any) => {
    const { data } = await api.get(`/campaigns/${id}/results`, { params });
    return data;
  },
};

// Sequences
export const sequencesApi = {
  list: async (params?: any) => {
    const { data } = await api.get('/sequences', { params });
    return data;
  },
  get: async (id: string) => {
    const { data } = await api.get(`/sequences/${id}`);
    return data;
  },
  create: async (sequence: any) => {
    const { data } = await api.post('/sequences', sequence);
    return data;
  },
  update: async (id: string, sequence: any) => {
    const { data } = await api.put(`/sequences/${id}`, sequence);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/sequences/${id}`);
  },
  subscribe: async (id: string, contactIds: string[]) => {
    const { data } = await api.post(`/sequences/${id}/subscribe`, { contactIds });
    return data;
  },
  pause: async (id: string, contactId: string) => {
    const { data } = await api.post(`/sequences/${id}/pause`, { contactId });
    return data;
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

// WhatsApp Groups
export const whatsappGroupsApi = {
  list: async (params?: any) => {
    const { data } = await api.get('/whatsapp/groups', { params });
    return data;
  },
  get: async (id: string) => {
    const { data } = await api.get(`/whatsapp/groups/${id}`);
    return data;
  },
  members: async (id: string, params?: any) => {
    const { data } = await api.get(`/whatsapp/groups/${id}/members`, { params });
    return data;
  },
  broadcast: async (id: string, message: string) => {
    const { data } = await api.post(`/whatsapp/groups/${id}/broadcast`, { message });
    return data;
  },
  sendDM: async (id: string, contactId: string, message: string) => {
    const { data } = await api.post(`/whatsapp/groups/${id}/dm`, { contactId, message });
    return data;
  },
  reinvite: async (id: string, contactId: string) => {
    const { data } = await api.post(`/whatsapp/groups/${id}/reinvite`, { contactId });
    return data;
  },
  updateInviteLink: async (id: string) => {
    const { data } = await api.post(`/whatsapp/groups/${id}/invite-link`);
    return data;
  },
  exportMembers: async (id: string) => {
    const { data } = await api.get(`/whatsapp/groups/${id}/export`);
    return data;
  },
  sync: async (id: string) => {
    const { data } = await api.post(`/whatsapp/groups/${id}/sync`);
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
