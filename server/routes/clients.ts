import { Request, Response } from 'express';
import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import { clients, clientAccess } from '@shared/schema';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';

const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  created: true,
  lastUpdated: true,
});

// Get all clients for MSP user
export async function getClients(req: Request, res: Response) {
  try {
    // TODO: Add proper authentication check for MSP users
    // For now, return all clients
    
    const allClients = await db.select().from(clients).orderBy(clients.name);
    
    // TODO: Add user count and last activity data
    const clientsWithStats = allClients.map(client => ({
      ...client,
      userCount: 0, // Placeholder - implement user counting
      lastActivity: "2 days ago", // Placeholder - implement activity tracking
    }));

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

    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
}

// Create new client
export async function createClient(req: Request, res: Response) {
  try {
    // TODO: Add proper MSP user authentication
    
    const validation = insertClientSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid client data', 
        details: validation.error.errors 
      });
    }

    const [newClient] = await db.insert(clients)
      .values({
        ...validation.data,
        created: new Date(),
        lastUpdated: new Date(),
      })
      .returning();

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

    const validation = insertClientSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid client data', 
        details: validation.error.errors 
      });
    }

    const [updatedClient] = await db.update(clients)
      .set({
        ...validation.data,
        lastUpdated: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning();

    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
}

// Delete client
export async function deleteClient(req: Request, res: Response) {
  try {
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // TODO: Add validation to ensure client can be safely deleted
    // (no active integrations, users, etc.)
    
    const [deletedClient] = await db.delete(clients)
      .where(eq(clients.id, clientId))
      .returning();

    if (!deletedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
}

// Get client access for a user
export async function getUserClientAccess(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const accessList = await db
      .select({
        client: clients,
        access: clientAccess
      })
      .from(clientAccess)
      .innerJoin(clients, eq(clientAccess.clientId, clients.id))
      .where(eq(clientAccess.userId, userId));

    res.json(accessList);
  } catch (error) {
    console.error('Error fetching user client access:', error);
    res.status(500).json({ error: 'Failed to fetch client access' });
  }
}

// Grant client access to user
export async function grantClientAccess(req: Request, res: Response) {
  try {
    const { userId, clientId, accessLevel } = req.body;
    
    if (!userId || !clientId || !accessLevel) {
      return res.status(400).json({ error: 'userId, clientId, and accessLevel are required' });
    }

    const [access] = await db.insert(clientAccess)
      .values({
        userId: parseInt(userId),
        clientId: parseInt(clientId),
        accessLevel,
        created: new Date(),
      })
      .returning();

    res.status(201).json(access);
  } catch (error) {
    console.error('Error granting client access:', error);
    res.status(500).json({ error: 'Failed to grant client access' });
  }
}

// Revoke client access from user
export async function revokeClientAccess(req: Request, res: Response) {
  try {
    const { userId, clientId } = req.params;
    
    const [revokedAccess] = await db.delete(clientAccess)
      .where(and(
        eq(clientAccess.userId, parseInt(userId)),
        eq(clientAccess.clientId, parseInt(clientId))
      ))
      .returning();

    if (!revokedAccess) {
      return res.status(404).json({ error: 'Client access not found' });
    }

    res.json({ message: 'Client access revoked successfully' });
  } catch (error) {
    console.error('Error revoking client access:', error);
    res.status(500).json({ error: 'Failed to revoke client access' });
  }
}