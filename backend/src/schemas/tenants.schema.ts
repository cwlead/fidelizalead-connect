import { z } from 'zod';

export const CreateTenantSchema = z.object({
  name: z.string().min(2)
});

export const SaveBotConversaKeySchema = z.object({
  apiKey: z.string().min(10)
});
