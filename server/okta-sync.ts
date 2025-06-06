import { oktaService } from './okta-service';
import { storage } from './storage';
import type { InsertUser } from '@shared/schema';

export interface OktaUserProfile {
  id: string;
  status: string;
  created: string;
  activated: string;
  lastLogin: string;
  lastUpdated: string;
  passwordChanged: string | null;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    login: string;
    title?: string;
    department?: string;
    mobilePhone?: string;
    manager?: string;
    managerId?: string;
    displayName?: string;
  };
}

function transformOktaUserToInsertUser(oktaUser: OktaUserProfile): InsertUser & { oktaId: string } {
  return {
    oktaId: oktaUser.id,
    firstName: oktaUser.profile.firstName,
    lastName: oktaUser.profile.lastName,
    email: oktaUser.profile.email,
    login: oktaUser.profile.login,
    title: oktaUser.profile.title || null,
    department: oktaUser.profile.department || null,
    mobilePhone: oktaUser.profile.mobilePhone || null,
    manager: oktaUser.profile.manager || null, // Manager name from OKTA
    status: oktaUser.status,
    // Map OKTA status to our system
    activated: oktaUser.activated ? new Date(oktaUser.activated) : new Date(),
    created: new Date(oktaUser.created),
    lastUpdated: new Date(oktaUser.lastUpdated),
    lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
    passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null,
    // These will be set based on business logic later
    employeeType: null,
    managerId: null,
    groups: null,
    profileUrl: null,
    sendActivationEmail: false
  };
}

export async function syncSpecificUser(email: string): Promise<void> {
  try {
    console.log(`Syncing user: ${email}`);
    
    // Get user from OKTA
    const oktaUser = await oktaService.getUserByEmail(email);
    console.log('Retrieved OKTA user:', oktaUser.profile.firstName, oktaUser.profile.lastName);
    
    // Transform to our schema
    const insertUser = transformOktaUserToInsertUser(oktaUser);
    
    // Check if user already exists
    const existingUser = await storage.getUserByOktaId(oktaUser.id);
    
    if (existingUser) {
      console.log('User already exists, updating...');
      // Update existing user
      const updates = {
        firstName: insertUser.firstName,
        lastName: insertUser.lastName,
        email: insertUser.email,
        title: insertUser.title,
        department: insertUser.department,
        mobilePhone: insertUser.mobilePhone,
        status: insertUser.status,
        lastUpdated: insertUser.lastUpdated,
        lastLogin: insertUser.lastLogin
      };
      await storage.updateUser(existingUser.id, updates);
      console.log('User updated successfully');
    } else {
      console.log('Creating new user...');
      // Create new user
      const newUser = await storage.createUser(insertUser);
      console.log('User created successfully:', newUser.firstName, newUser.lastName);
    }
    
  } catch (error) {
    console.error('Error syncing user:', error);
    throw error;
  }
}