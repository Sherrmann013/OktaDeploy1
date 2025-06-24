# COMPLETE EXACT CARBON COPY

## Instructions
1. Create new Replit Node.js project: "security-dashboard-demo"
2. Copy ALL files below EXACTLY
3. Run `npm install` then `npm run dev`
4. Login: `CW-Admin` / `YellowDr@g0nFly`

---

## FILE: shared/schema.ts
```typescript
import { z } from "zod";

export const demoUserSchema = z.object({
  id: z.number(),
  oktaId: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  login: z.string(),
  mobilePhone: z.string().nullable(),
  department: z.string().nullable(),
  title: z.string().nullable(),
  employeeType: z.enum(['EMPLOYEE', 'CONTRACTOR', 'INTERN', 'PART_TIME']).nullable(),
  profileImageUrl: z.string().nullable(),
  managerId: z.number().nullable(),
  manager: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEPROVISIONED']).default('ACTIVE'),
  groups: z.array(z.string()).default([]),
  applications: z.array(z.string()).default([]),
  created: z.date(),
  lastUpdated: z.date(),
  lastLogin: z.date().nullable(),
  passwordChanged: z.date().nullable(),
});

export const insertUserSchema = demoUserSchema.omit({
  id: true,
  oktaId: true,
  created: true,
  lastUpdated: true,
  lastLogin: true,
  passwordChanged: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  login: z.string().min(1, "Login is required"),
  password: z.string().length(12, "Password must be exactly 12 characters").optional(),
  sendActivationEmail: z.boolean().optional(),
  selectedApps: z.array(z.string()).optional(),
  selectedGroups: z.array(z.string()).optional(),
});

export const updateUserSchema = demoUserSchema.partial().omit({
  id: true,
  oktaId: true,
  sendActivationEmail: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = z.infer<typeof demoUserSchema>;
```

---

## FILE: client/index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## FILE: client/src/main.tsx
```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/hooks/use-theme";
import "./index.css";

localStorage.removeItem("ui-theme");

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
    <App />
  </ThemeProvider>
);
```

---

## FILE: client/src/index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 20 14.3% 4.1%;
  --muted: 60 4.8% 95.9%;
  --muted-foreground: 25 5.3% 44.7%;
  --popover: 0 0% 100%;
  --popover-foreground: 20 14.3% 4.1%;
  --card: 0 0% 100%;
  --card-foreground: 20 14.3% 4.1%;
  --border: 20 5.9% 90%;
  --input: 20 5.9% 90%;
  --primary: 207 90% 54%;
  --primary-foreground: 211 100% 99%;
  --secondary: 60 4.8% 95.9%;
  --secondary-foreground: 24 9.8% 10%;
  --accent: 60 4.8% 95.9%;
  --accent-foreground: 24 9.8% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 60 9.1% 97.8%;
  --ring: 20 14.3% 4.1%;
  --radius: 0.5rem;
  --success: 123 46% 35%;
  --warning: 35 91% 48%;
  --surface: 0 0% 100%;
  --surface-background: 210 20% 98%;
}

.table-row-light {
  background-color: #f8f9fa;
}

.table-row-light:hover {
  background-color: #f1f3f4;
}

.dark .table-row-light {
  background-color: hsl(215 22% 18%);
}

.dark .table-row-light:hover {
  background-color: hsl(215 20% 20%);
}

.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.1) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
  height: 6px;
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
  border: none;
  margin: 0;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  border: none;
  box-shadow: none;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.25);
}

.dark .scrollbar-thin {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.25);
}

.scrollbar-thin::-webkit-scrollbar-button {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}

.scrollbar-thin::-webkit-scrollbar-button:start:decrement,
.scrollbar-thin::-webkit-scrollbar-button:end:increment {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

.scrollbar-thin::-webkit-scrollbar-corner {
  background: transparent !important;
  display: none !important;
}

.dark {
  --background: 215 25% 16%;
  --foreground: 0 0% 98%;
  --muted: 215 20% 20%;
  --muted-foreground: 0 0% 85%;
  --popover: 215 25% 18%;
  --popover-foreground: 0 0% 98%;
  --card: 215 22% 18%;
  --card-foreground: 0 0% 98%;
  --border: 215 15% 25%;
  --input: 215 20% 16%;
  --primary: 207 90% 58%;
  --primary-foreground: 0 0% 100%;
  --secondary: 215 15% 25%;
  --secondary-foreground: 0 0% 98%;
  --accent: 215 15% 25%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 75% 55%;
  --destructive-foreground: 0 0% 98%;
  --ring: 207 90% 58%;
  --radius: 0.5rem;
  --success: 123 46% 45%;
  --warning: 35 91% 55%;
  --surface: 215 25% 16%;
  --surface-background: 215 22% 18%;
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
  }
}

.okta-primary {
  background-color: hsl(var(--primary));
}

.okta-primary-hover {
  background-color: hsl(207 90% 45%);
}

.okta-surface {
  background-color: hsl(var(--surface));
}

.status-active {
  @apply bg-green-100 text-green-800;
}

.status-suspended {
  @apply bg-yellow-100 text-yellow-800;
}

.status-deprovisioned {
  @apply bg-red-100 text-red-800;
}
```

---

## FILE: client/src/App.tsx
```tsx
import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import SSOLayout from "@/components/sso-layout";
import Login from "@/pages/login";
import Users from "@/pages/users";

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="*" component={Login} />
      </Switch>
    );
  }

  return (
    <SSOLayout>
      <Switch>
        <Route path="/" component={Users} />
        <Route path="/users" component={Users} />
      </Switch>
    </SSOLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
```

Continue to next message for the remaining exact files...