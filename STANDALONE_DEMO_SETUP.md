# Security Dashboard Demo - Standalone Setup Guide

This guide will help you create a completely separate standalone demo version of the Enterprise Security Management Dashboard.

## Step 1: Create New Replit Project

1. Go to Replit.com and create a new project
2. Choose "Node.js" template
3. Name it "security-dashboard-demo"

## Step 2: Project Structure

Create the following directory structure:

```
security-dashboard-demo/
├── server/
│   ├── index.ts
│   ├── routes.ts
│   ├── storage.ts
│   └── vite.ts
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
│   ├── index.html
│   └── public/
├── shared/
│   └── schema.ts
├── components.json
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── postcss.config.js
└── README.md
```

## Step 3: Package Configuration

The demo uses a simplified dependency list focusing only on UI and core functionality:

### Core Dependencies:
- React 18 with TypeScript
- Express.js for backend
- Tailwind CSS + Radix UI components
- In-memory storage (no database)
- Wouter for routing
- React Query for state management

### Removed Dependencies:
- All OKTA integration packages
- Database packages (Drizzle ORM, PostgreSQL)
- KnowBe4 integration
- Passport authentication
- WebSocket dependencies

## Step 4: Demo Features

### Authentication
- Simple demo login: username: `demo-admin`, password: `demo123`
- No external authentication required
- Session stored in memory

### User Management
- Pre-populated with 25+ realistic users
- Add/edit/delete functionality works with local storage
- No external API calls

### Dashboard Features
- Employee type distribution charts
- Department breakdowns
- Security training status (mock data)
- User search and filtering
- Dark/light theme toggle

### Sample Data Structure
```typescript
interface DemoUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  login: string;
  department: string;
  title: string;
  employeeType: 'EMPLOYEE' | 'CONTRACTOR' | 'INTERN' | 'PART_TIME';
  status: 'ACTIVE' | 'SUSPENDED' | 'DEPROVISIONED';
  manager: string;
  lastLogin: Date;
  created: Date;
}
```

## Step 5: Deployment

The standalone demo can be deployed to:
- Replit hosting (automatic)
- Vercel
- Netlify
- Any Node.js hosting platform

## Step 6: Customization

Easy to customize for different demo scenarios:
- Modify sample data in `server/storage.ts`
- Adjust branding in `client/src/components/`
- Change authentication credentials
- Add/remove dashboard features

## Benefits of Standalone Demo

1. **No External Dependencies**: Works without any API keys or external services
2. **Quick Setup**: Ready to run in minutes
3. **Portable**: Can be easily shared and deployed anywhere
4. **Customizable**: Easy to modify for different demo scenarios
5. **Performance**: Fast loading with no external API calls
6. **Reliable**: No network dependencies means consistent demo experience

## Use Cases

- Sales demonstrations
- Client presentations
- Training sessions
- Feature showcases
- Development testing
- Conference demos