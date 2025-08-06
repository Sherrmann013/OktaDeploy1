import { mspStorage } from '../server/msp-storage';

async function createSampleClients() {
  console.log('Creating sample clients for MSP dashboard...');

  const sampleClients = [
    {
      name: 'TechCorp Solutions',
      description: 'Technology consulting and software development company',
      domain: 'techcorp.com',
      status: 'ACTIVE' as const,
      databaseName: 'client_techcorp_solutions_' + Date.now(),
      databaseUrl: 'postgresql://localhost:5432/client_techcorp_solutions_' + Date.now(),
      primaryContact: 'John Smith',
      contactEmail: 'john.smith@techcorp.com',
      contactPhone: '+1 (555) 123-4567',
      timezone: 'America/New_York',
    },
    {
      name: 'MedBridge Healthcare',
      description: 'Healthcare technology and patient management systems',
      domain: 'medbridge.health',
      status: 'ACTIVE' as const,
      databaseName: 'client_medbridge_healthcare_' + Date.now(),
      databaseUrl: 'postgresql://localhost:5432/client_medbridge_healthcare_' + Date.now(),
      primaryContact: 'Dr. Sarah Johnson',
      contactEmail: 'sarah.johnson@medbridge.health',
      contactPhone: '+1 (555) 987-6543',
      timezone: 'America/Chicago',
    },
    {
      name: 'RetailMax Group',
      description: 'Retail chain management and e-commerce platform',
      domain: 'retailmax.com',
      status: 'ACTIVE' as const,
      databaseName: 'client_retailmax_group_' + Date.now(),
      databaseUrl: 'postgresql://localhost:5432/client_retailmax_group_' + Date.now(),
      primaryContact: 'Mike Rodriguez',
      contactEmail: 'mike.rodriguez@retailmax.com',
      contactPhone: '+1 (555) 456-7890',
      timezone: 'America/Los_Angeles',
    },
    {
      name: 'StartupHub Inc',
      description: 'Innovation incubator and startup accelerator',
      domain: 'startuphub.io',
      status: 'ACTIVE' as const,
      databaseName: 'client_startuphub_inc_' + Date.now(),
      databaseUrl: 'postgresql://localhost:5432/client_startuphub_inc_' + Date.now(),
      primaryContact: 'Lisa Chen',
      contactEmail: 'lisa.chen@startuphub.io',
      contactPhone: '+1 (555) 321-0987',
      timezone: 'America/Denver',
    },
    {
      name: 'FinanceFirst Bank',
      description: 'Community bank with digital banking solutions',
      domain: 'financefirst.bank',
      status: 'ACTIVE' as const,
      databaseName: 'client_financefirst_bank_' + Date.now(),
      databaseUrl: 'postgresql://localhost:5432/client_financefirst_bank_' + Date.now(),
      primaryContact: 'Robert Williams',
      contactEmail: 'robert.williams@financefirst.bank',
      contactPhone: '+1 (555) 654-3210',
      timezone: 'America/New_York',
    },
  ];

  for (const clientData of sampleClients) {
    try {
      const client = await mspStorage.createClient(clientData);
      console.log(`Created client: ${client.name} (ID: ${client.id})`);
      
      // Log the creation in MSP audit logs
      await mspStorage.logMspAudit({
        mspUserId: null,
        mspUserEmail: 'system@msp.local',
        action: 'CREATE',
        resourceType: 'CLIENT',
        resourceId: client.id.toString(),
        resourceName: client.name,
        details: JSON.stringify({ 
          action: 'Sample client created during MSP setup',
          databaseName: client.databaseName,
          clientName: client.name 
        }),
      });
    } catch (error) {
      console.error(`Failed to create client ${clientData.name}:`, error);
    }
  }

  console.log('Sample clients creation completed.');
}

// Run if executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  createSampleClients().catch(console.error);
}

export default createSampleClients;