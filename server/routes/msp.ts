import { Request, Response } from 'express';
import { z } from 'zod';
import { mspStorage } from '../msp-storage';
import { dbManager } from '../multi-db';
import * as mspSchema from '../../shared/msp-schema';

// Get all clients for MSP dashboard
export async function getClients(req: Request, res: Response) {
  try {
    // TODO: Add proper MSP user authentication
    // For now, return all clients
    
    const allClients = await mspStorage.getAllClients();
    
    // Add additional metadata for each client
    const clientsWithStats = await Promise.all(
      allClients.map(async (client) => {
        // TODO: Get real user count and activity from client database
        // const clientStorage = createClientStorage(client.id);
        // const { total } = await clientStorage.getAllUsers({ limit: 1 });
        
        return {
          ...client,
          userCount: 0, // Placeholder - will implement after database setup
          lastActivity: "2 days ago", // Placeholder - will implement activity tracking
        };
      })
    );

    res.json(clientsWithStats);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
}

// Get single client
export async function getClient(req: Request, res: Response) {
  try {
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const client = await mspStorage.getClient(clientId);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
}

// Create new client with isolated database
export async function createClient(req: Request, res: Response) {
  try {
    // TODO: Add proper MSP user authentication
    
    const validation = mspSchema.insertClientSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid client data', 
        details: validation.error.errors 
      });
    }

    const clientData = validation.data;
    
    // Create isolated database for the client
    const { databaseName, databaseUrl } = await dbManager.createClientDatabase(clientData.name);
    
    // Create client record in MSP database
    const newClient = await mspStorage.createClient({
      ...clientData,
      databaseName,
      databaseUrl,
    });

    // Initialize the client's database with schema
    await dbManager.initializeClientDatabase(newClient.id);

    // Log the action in MSP audit log
    await mspStorage.logMspAudit({
      mspUserId: null, // TODO: Get from authenticated MSP user
      mspUserEmail: 'system@msp.local', // TODO: Get from authenticated MSP user
      action: 'CREATE',
      resourceType: 'CLIENT',
      resourceId: newClient.id.toString(),
      resourceName: newClient.name,
      details: JSON.stringify({ 
        action: 'Created new client with isolated database',
        databaseName,
        clientName: newClient.name 
      }),
    });

    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
}

// Update client
export async function updateClient(req: Request, res: Response) {
  try {
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const validation = mspSchema.insertClientSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid client data', 
        details: validation.error.errors 
      });
    }

    const updatedClient = await mspStorage.updateClient(clientId, validation.data);

    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Log the action
    await mspStorage.logMspAudit({
      mspUserId: null, // TODO: Get from authenticated MSP user
      mspUserEmail: 'system@msp.local', // TODO: Get from authenticated MSP user
      action: 'UPDATE',
      resourceType: 'CLIENT',
      resourceId: clientId.toString(),
      resourceName: updatedClient.name,
      details: JSON.stringify({ action: 'Updated client information' }),
      clientId,
    });

    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
}

// Delete client (and its database)
export async function deleteClient(req: Request, res: Response) {
  try {
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Get client info before deletion
    const client = await mspStorage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // TODO: Add validation to ensure client can be safely deleted
    // TODO: Implement database deletion (requires careful consideration)
    
    const deleted = await mspStorage.deleteClient(clientId);

    if (!deleted) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Log the action
    await mspStorage.logMspAudit({
      mspUserId: null, // TODO: Get from authenticated MSP user
      mspUserEmail: 'system@msp.local', // TODO: Get from authenticated MSP user
      action: 'DELETE',
      resourceType: 'CLIENT',
      resourceId: clientId.toString(),
      resourceName: client.name,
      details: JSON.stringify({ 
        action: 'Deleted client and database',
        databaseName: client.databaseName 
      }),
    });

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
}

// Get client access for MSP user
export async function getMspUserClientAccess(req: Request, res: Response) {
  try {
    const mspUserId = parseInt(req.params.mspUserId);
    if (isNaN(mspUserId)) {
      return res.status(400).json({ error: 'Invalid MSP user ID' });
    }

    const clientsWithAccess = await mspStorage.getUserClientAccess(mspUserId);
    res.json(clientsWithAccess);
  } catch (error) {
    console.error('Error fetching MSP user client access:', error);
    res.status(500).json({ error: 'Failed to fetch client access' });
  }
}

// Grant client access to MSP user
export async function grantClientAccess(req: Request, res: Response) {
  try {
    const { mspUserId, clientId, accessLevel } = req.body;
    
    if (!mspUserId || !clientId || !accessLevel) {
      return res.status(400).json({ error: 'mspUserId, clientId, and accessLevel are required' });
    }

    const validation = mspSchema.insertClientAccessSchema.safeParse({
      mspUserId: parseInt(mspUserId),
      clientId: parseInt(clientId),
      accessLevel,
    });

    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid access data', 
        details: validation.error.errors 
      });
    }

    const access = await mspStorage.grantClientAccess(validation.data);

    // Log the action
    await mspStorage.logMspAudit({
      mspUserId: validation.data.mspUserId,
      mspUserEmail: 'system@msp.local', // TODO: Get from authenticated MSP user
      action: 'CREATE',
      resourceType: 'CLIENT_ACCESS',
      resourceId: access.id.toString(),
      resourceName: `Access for user ${mspUserId} to client ${clientId}`,
      details: JSON.stringify({ 
        action: 'Granted client access',
        accessLevel,
        mspUserId,
        clientId 
      }),
      clientId: validation.data.clientId,
    });

    res.status(201).json(access);
  } catch (error) {
    console.error('Error granting client access:', error);
    res.status(500).json({ error: 'Failed to grant client access' });
  }
}

// Revoke client access from MSP user
export async function revokeClientAccess(req: Request, res: Response) {
  try {
    const { mspUserId, clientId } = req.params;
    
    const success = await mspStorage.revokeClientAccess(
      parseInt(mspUserId), 
      parseInt(clientId)
    );

    if (!success) {
      return res.status(404).json({ error: 'Client access not found' });
    }

    // Log the action
    await mspStorage.logMspAudit({
      mspUserId: parseInt(mspUserId),
      mspUserEmail: 'system@msp.local', // TODO: Get from authenticated MSP user
      action: 'DELETE',
      resourceType: 'CLIENT_ACCESS',
      resourceId: `${mspUserId}-${clientId}`,
      resourceName: `Access for user ${mspUserId} to client ${clientId}`,
      details: JSON.stringify({ 
        action: 'Revoked client access',
        mspUserId,
        clientId 
      }),
      clientId: parseInt(clientId),
    });

    res.json({ message: 'Client access revoked successfully' });
  } catch (error) {
    console.error('Error revoking client access:', error);
    res.status(500).json({ error: 'Failed to revoke client access' });
  }
}