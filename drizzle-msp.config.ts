import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/msp-schema.ts',
  out: './msp-migrations',
  dbCredentials: {
    url: process.env.MSP_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/msp_db',
  },
});