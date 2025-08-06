import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/client-schema.ts',
  out: './client-migrations',
  dbCredentials: {
    url: process.env.CLIENT_DATABASE_URL || 'postgresql://localhost:5432/client_template',
  },
});