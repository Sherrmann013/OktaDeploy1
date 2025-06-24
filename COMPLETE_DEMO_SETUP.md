# Complete Standalone Demo Setup

## Quick Start Guide

1. **Create new Replit project**
   - Go to Replit.com → Create → Node.js template
   - Name: "security-dashboard-demo"

2. **Copy the demo files**
   - Replace `server/index.ts` with `demo-server-index.ts`
   - Replace `server/storage.ts` with `demo-storage.ts`  
   - Replace `server/routes.ts` with `demo-routes.ts`
   - Copy all client-side files from current project

3. **Install dependencies**
   ```bash
   npm install express express-session memorystore @types/express @types/express-session
   ```

4. **Demo credentials**
   - Username: `demo-admin`
   - Password: `demo123`

## Key Demo Features

### ✅ Pre-loaded Data
- 20+ realistic enterprise users
- Multiple departments (IT Security, IT, HR, Legal, Executive)
- Various employee types (Employee, Contractor, Intern, Part-time)
- Realistic names, emails, and organizational structure

### ✅ Fully Functional Dashboard
- User search and filtering
- Employee type distribution charts
- Department breakdowns
- User status tracking (Active, Suspended, Deprovisioned)
- Add/Edit/Delete users (local storage)

### ✅ Mock Security Training
- Simulated KnowBe4-style training data
- Completion rates and scores
- Multiple training campaigns per user

### ✅ No External Dependencies
- No OKTA integration needed
- No database setup required
- No API keys needed
- Works completely offline

## Demo User Examples

**Executive Level:**
- Sarah Johnson (CEO)
- Christopher Walker (CISO)

**IT Security Team:**
- Michael Chen (Security Engineer)
- Lisa Anderson (Security Analyst - Contractor)
- Alex Kim (Security Intern)
- Kevin Lee (Compliance Officer)

**Support Staff:**
- Emily Rodriguez (HR Director)
- David Thompson (IT Manager)
- James Wilson (Legal Counsel)

## Perfect For

- **Sales Demos**: Show full functionality without setup
- **Client Presentations**: Professional, realistic data
- **Training Sessions**: Safe environment for learning
- **Conference Demos**: Reliable, no internet dependencies
- **Development Testing**: Full feature testing

## Deployment Options

- **Replit Hosting**: Automatic deployment
- **Vercel**: `npm run build && npm run start`
- **Netlify**: Static build with serverless functions
- **Docker**: Ready for containerization

## Customization

**Easy to modify:**
```typescript
// Change demo credentials in demo-storage.ts
async authenticateAdmin(username: string, password: string): Promise<boolean> {
  return username === "your-demo-user" && password === "your-demo-pass";
}

// Add more demo users in seedDemoData()
// Modify departments, titles, employee types
// Adjust training completion rates
```

This standalone version maintains all the professional polish of the original while being completely self-contained and perfect for demonstrations.