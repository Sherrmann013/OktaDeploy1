import React, { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CustomSelect, 
  CustomSelectTrigger, 
  CustomSelectValue, 
  CustomSelectContent, 
  CustomSelectItem 
} from "@/components/ui/custom-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema, type InsertUser, type User } from "@shared/schema";
import { z } from "zod";
import { X, Check, RefreshCw } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId?: number; // CLIENT-AWARE - Optional since we also detect from URL
}

export default function CreateUserModal({ open, onClose, onSuccess, clientId }: CreateUserModalProps) {
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Detect current client context from URL or use provided clientId - CLIENT-AWARE
  const currentClientId = clientId ?? (location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1);
  
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [managerSearch, setManagerSearch] = useState("");
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const [password, setPassword] = useState("");
  const [sendActivationEmail, setSendActivationEmail] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  // Fetch app mappings for dynamic app dropdown - CLIENT-AWARE
  const { data: appMappingsData = [], isLoading: appMappingsLoading } = useQuery({
    queryKey: [`/api/client/${currentClientId}/app-mappings`],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const { data: departmentAppMappingsData = [], isLoading: deptAppMappingsLoading } = useQuery({
    queryKey: [`/api/client/${currentClientId}/department-app-mappings`],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const { data: employeeTypeAppMappingsData = [], isLoading: empTypeAppMappingsLoading } = useQuery({
    queryKey: [`/api/client/${currentClientId}/employee-type-app-mappings`],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const { data: departmentGroupMappingsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/department-group-mappings`],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const { data: employeeTypeGroupMappingsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/employee-type-group-mappings`],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Fetch all field settings from client-specific admin layout - CLIENT-AWARE
  const { data: fieldSettings } = useQuery({
    queryKey: [`/api/client/${currentClientId}/layout-settings`, "all-fields"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    queryFn: async () => {
      try {
        // Fetch from client-specific endpoints for proper multi-tenant isolation
        const settingsQueries = [
          fetch(`/api/client/${currentClientId}/layout-settings/firstName`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/lastName`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/emailUsername`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/password`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/title`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/manager`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/department`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/employeeType`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/apps`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/groups`, { credentials: 'include' }),
          fetch(`/api/client/${currentClientId}/layout-settings/sendActivationEmail`, { credentials: 'include' })
        ];
        

        
        const responses = await Promise.all(settingsQueries);
        const settings = {
          firstName: { required: true },
          lastName: { required: true },
          emailUsername: { required: true, domains: [] },
          password: { 
            required: true, 
            showGenerateButton: true,
            components: [
              { type: 'words', count: 1 },
              { type: 'numbers', count: 2 },
              { type: 'symbols', count: 1 }
            ],
            targetLength: 10
          },
          title: { required: false },
          manager: { required: false },
          department: { required: false, useList: false, options: [], linkApps: false, linkGroups: false },
          employeeType: { required: false, useList: true, options: [], linkApps: false, linkGroups: false },
          apps: { required: false, hideField: false },
          groups: { required: false, useList: true, options: [], hideField: false },
          sendActivationEmail: { required: false, hideField: false }
        };
        
        // Parse individual setting responses
        const fieldNames = ['firstName', 'lastName', 'emailUsername', 'password', 'title', 'manager', 'department', 'employeeType', 'apps', 'groups', 'sendActivationEmail'];
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          const fieldName = fieldNames[i];
          
          if (response.ok) {
            const data = await response.json();
            try {
              const parsedValue = JSON.parse(data.settingValue || '{}');
              settings[fieldName as keyof typeof settings] = parsedValue;

            } catch (e) {
              // Failed to parse settings, using defaults
            }
          } else {

          }
        }
        
        return settings;
      } catch (error) {
        return {
          firstName: { required: true },
          lastName: { required: true },
          emailUsername: { required: true, domains: [] },
          password: { 
            required: true, 
            showGenerateButton: true,
            components: [
              { type: 'words', count: 1 },
              { type: 'numbers', count: 2 },
              { type: 'symbols', count: 1 }
            ],
            targetLength: 10
          },
          title: { required: false },
          manager: { required: false },
          department: { required: false, useList: false, options: [], linkApps: false, linkGroups: false },
          employeeType: { required: false, useList: true, options: [], linkApps: false, linkGroups: false },
          apps: { required: false, hideField: false },
          groups: { required: false, useList: true, options: [], hideField: false },
          sendActivationEmail: { required: false, hideField: false }
        };
      }
    },
    enabled: open,
  });

  // Remove duplicate query since it's already defined above

  // Fetch existing users for manager dropdown - only when manager search is active
  const { data: usersData } = useQuery({
    queryKey: [`/api/client/${currentClientId}/users`, "all"],
    queryFn: async () => {
      const response = await fetch(`/api/client/${currentClientId}/users?limit=1000`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users for manager selection');
      }
      
      return response.json();
    },
    enabled: open && managerSearch.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch email domain configuration from client-specific settings - CLIENT-AWARE
  const { data: emailDomainConfig } = useQuery({
    queryKey: [`/api/client/${currentClientId}/layout-settings`, "emailUsername"],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/client/${currentClientId}/layout-settings/emailUsername`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          // Return empty default configuration if not found - no hardcoded domains
          return { domains: [] };
        }
        
        const data = await response.json();
        return JSON.parse(data.settingValue || '{"domains":[]}');
      } catch (error) {
        // Return empty default configuration on error - no hardcoded domains
        return { domains: [] };
      }
    },
    enabled: open,
  });



  // Extract password config for backward compatibility
  const passwordConfig = fieldSettings?.password;

  const availableManagers = usersData?.users || [];
  const emailDomains = (emailDomainConfig?.domains || []).filter((domain: string) => domain && domain.trim() !== '');
  const hasMultipleDomains = emailDomains.length > 1;

  // Field configuration loaded silently

  // Set default domain when modal opens or domains change
  React.useEffect(() => {
    if (emailDomains.length > 0 && (!selectedDomain || !emailDomains.includes(selectedDomain))) {
      setSelectedDomain(emailDomains[0]);
    }
  }, [emailDomains, selectedDomain]);

  // Filter managers based on search input
  const filteredManagers = useMemo(() => {
    if (!managerSearch || managerSearch.length < 1) return [];
    
    const searchTerm = managerSearch.toLowerCase().trim();
    
    return availableManagers
      .filter((user: User) => {
        const firstName = user.firstName?.toLowerCase() || '';
        const lastName = user.lastName?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        const title = user.title?.toLowerCase() || '';
        const department = user.department?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`;
        
        return firstName.startsWith(searchTerm) ||
               firstName.includes(searchTerm) ||
               lastName.startsWith(searchTerm) ||
               fullName.includes(searchTerm) ||
               email.includes(searchTerm) ||
               title.includes(searchTerm) ||
               department.includes(searchTerm);
      })
      .sort((a: User, b: User) => {
        const aFirstName = a.firstName?.toLowerCase() || '';
        const aLastName = a.lastName?.toLowerCase() || '';
        const bFirstName = b.firstName?.toLowerCase() || '';
        const bLastName = b.lastName?.toLowerCase() || '';
        const aFullName = `${aFirstName} ${aLastName}`;
        const bFullName = `${bFirstName} ${bLastName}`;
        
        const aFirstStartsWithSearch = aFirstName.startsWith(searchTerm);
        const bFirstStartsWithSearch = bFirstName.startsWith(searchTerm);
        
        if (aFirstStartsWithSearch && !bFirstStartsWithSearch) return -1;
        if (bFirstStartsWithSearch && !aFirstStartsWithSearch) return 1;
        
        return aFullName.localeCompare(bFullName);
      })
      .slice(0, 15);
  }, [availableManagers, managerSearch]);

  // Create dynamic validation schema based on admin settings
  const validationSchema = useMemo(() => {
    if (!fieldSettings) return insertUserSchema;
    
    // Create a fresh schema to avoid extend() conflicts with required base fields
    return z.object({
      firstName: fieldSettings.firstName?.required 
        ? z.string().min(1, "First name is required")
        : z.string().optional(),
      lastName: fieldSettings.lastName?.required 
        ? z.string().min(1, "Last name is required") 
        : z.string().optional(),
      email: fieldSettings.emailUsername?.required 
        ? z.string().min(1).email("Invalid email address")
        : z.string().email("Invalid email address").optional().or(z.literal("")),
      login: z.string().optional(), // Server will handle login generation
      password: fieldSettings.password?.required 
        ? z.string().min(1, "Password is required")
        : z.string().optional(),
      title: fieldSettings.title?.required 
        ? z.string().min(1, "Title is required")
        : z.string().optional(),
      manager: fieldSettings.manager?.required 
        ? z.string().min(1, "Manager is required")
        : z.string().optional(),
      department: fieldSettings.department?.required 
        ? z.string().min(1, "Department is required")
        : z.string().optional(),
      employeeType: fieldSettings.employeeType?.required 
        ? z.string().min(1, "Employee type is required")
        : z.string().optional(),
      mobilePhone: z.string().optional(),
      managerId: z.number().optional(),
      status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).default("ACTIVE"),
      groups: z.array(z.string()).default([]),
      applications: z.array(z.string()).default([]),
    });
  }, [fieldSettings]);

  const form = useForm<InsertUser>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      login: "",
      password: "",

      title: "",
      department: "",
      employeeType: "",
      managerId: undefined,
      status: "ACTIVE",
      groups: [],
      applications: [],
      manager: "",
    },
  });

  // Reset form and all state when modal closes
  React.useEffect(() => {
    if (!open) {
      // Reset form to default values
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        login: "",
        password: "",
        title: "",
        manager: "",
        department: "",
        employeeType: "",
        managerId: undefined,
        status: "ACTIVE",
        groups: [],
        applications: [],
      });
      
      // Reset all state variables
      setPassword("");
      setSelectedApps([]);
      setSelectedGroups([]);
      setManuallySelectedApps([]);
      setManuallySelectedGroups([]);
      setManagerSearch("");
      setShowManagerDropdown(false);
      setSendActivationEmail(true);
      
      // Reset to default domain
      if (emailDomains.length > 0) {
        setSelectedDomain(emailDomains[0]);
      }
    }
  }, [open, form, emailDomains]);

  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const response = await apiRequest("POST", `/api/client/${currentClientId}/users`, {
        ...userData,
        groups: selectedGroups,
        applications: selectedApps,
        sendActivationEmail,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/users`] });
      toast({
        title: "Success",
        description: "User created successfully",
      });
      form.reset();
      setSelectedGroups([]);
      setSelectedApps([]);
      setManagerSearch("");
      setSendActivationEmail(true);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertUser) => {
    createUserMutation.mutate(data);
  };

  const availableGroups = fieldSettings?.groups?.options || [];

  // Dynamic apps from database with debug logging
  const availableApps = Array.isArray(appMappingsData) 
    ? appMappingsData.map((app: any) => {
        return app.appName;
      }).filter((name: string) => {
        const isValid = name && name.trim() !== '';
        return isValid;
      })
    : [];
  

  // Process department app mappings
  const departmentAppMappings: Record<string, string[]> = {};
  if (Array.isArray(departmentAppMappingsData) && departmentAppMappingsData.length > 0) {
    departmentAppMappingsData.forEach((mapping: any) => {
      if (!departmentAppMappings[mapping.departmentName]) {
        departmentAppMappings[mapping.departmentName] = [];
      }
      departmentAppMappings[mapping.departmentName].push(mapping.appName);
    });
  }

  // Process employee type app mappings
  const employeeTypeAppMappings: Record<string, string[]> = {};
  if (Array.isArray(employeeTypeAppMappingsData) && employeeTypeAppMappingsData.length > 0) {
    employeeTypeAppMappingsData.forEach((mapping: any) => {
      if (!employeeTypeAppMappings[mapping.employeeType]) {
        employeeTypeAppMappings[mapping.employeeType] = [];
      }
      employeeTypeAppMappings[mapping.employeeType].push(mapping.appName);
    });
  }

  // Process department group mappings
  const departmentGroupMappings: Record<string, string[]> = {};
  if (Array.isArray(departmentGroupMappingsData) && departmentGroupMappingsData.length > 0) {
    departmentGroupMappingsData.forEach((mapping: any) => {
      if (!departmentGroupMappings[mapping.departmentName]) {
        departmentGroupMappings[mapping.departmentName] = [];
      }
      departmentGroupMappings[mapping.departmentName].push(mapping.groupName);
    });
  }

  // Process employee type group mappings
  const employeeTypeGroupMappings: Record<string, string[]> = {};
  if (Array.isArray(employeeTypeGroupMappingsData) && employeeTypeGroupMappingsData.length > 0) {
    employeeTypeGroupMappingsData.forEach((mapping: any) => {
      if (!employeeTypeGroupMappings[mapping.employeeType]) {
        employeeTypeGroupMappings[mapping.employeeType] = [];
      }
      employeeTypeGroupMappings[mapping.employeeType].push(mapping.groupName);
    });
  }

  // Track manually selected apps and groups (excluding those from department/employee type linking)
  const [manuallySelectedApps, setManuallySelectedApps] = useState<string[]>([]);
  const [manuallySelectedGroups, setManuallySelectedGroups] = useState<string[]>([]);

  // Handle department selection and auto-populate linked apps/groups
  const handleDepartmentChange = (department: string, fieldOnChange: (value: string) => void) => {
    fieldOnChange(department);
    
    // Get current employee type
    const currentEmployeeType = form.getValues("employeeType");
    
    // Calculate new linked apps and groups
    const departmentLinkedApps = fieldSettings?.department?.linkApps && departmentAppMappings[department] ? departmentAppMappings[department] : [];
    const employeeTypeLinkedApps = fieldSettings?.employeeType?.linkApps && currentEmployeeType && employeeTypeAppMappings[currentEmployeeType] ? employeeTypeAppMappings[currentEmployeeType] : [];
    const departmentLinkedGroups = fieldSettings?.department?.linkGroups && departmentGroupMappings[department] ? departmentGroupMappings[department] : [];
    const employeeTypeLinkedGroups = fieldSettings?.employeeType?.linkGroups && currentEmployeeType && employeeTypeGroupMappings[currentEmployeeType] ? employeeTypeGroupMappings[currentEmployeeType] : [];
    
    // Combine manually selected with newly linked apps/groups (replace department-linked, keep employee type and manual)
    const newApps = Array.from(new Set([...manuallySelectedApps, ...employeeTypeLinkedApps, ...departmentLinkedApps]));
    const newGroups = Array.from(new Set([...manuallySelectedGroups, ...employeeTypeLinkedGroups, ...departmentLinkedGroups]));
    
    setSelectedApps(newApps);
    setSelectedGroups(newGroups);
  };

  // Handle employee type selection and auto-populate linked apps/groups
  const handleEmployeeTypeChange = (employeeType: string, fieldOnChange: (value: string) => void) => {
    fieldOnChange(employeeType);
    
    // Get current department
    const currentDepartment = form.getValues("department");
    
    // Calculate new linked apps and groups
    const departmentLinkedApps = fieldSettings?.department?.linkApps && currentDepartment && departmentAppMappings[currentDepartment] ? departmentAppMappings[currentDepartment] : [];
    const employeeTypeLinkedApps = fieldSettings?.employeeType?.linkApps && employeeTypeAppMappings[employeeType] ? employeeTypeAppMappings[employeeType] : [];
    const departmentLinkedGroups = fieldSettings?.department?.linkGroups && currentDepartment && departmentGroupMappings[currentDepartment] ? departmentGroupMappings[currentDepartment] : [];
    const employeeTypeLinkedGroups = fieldSettings?.employeeType?.linkGroups && employeeTypeGroupMappings[employeeType] ? employeeTypeGroupMappings[employeeType] : [];
    
    // Combine manually selected with newly linked apps/groups (replace employee type-linked, keep department and manual)
    const newApps = Array.from(new Set([...manuallySelectedApps, ...departmentLinkedApps, ...employeeTypeLinkedApps]));
    const newGroups = Array.from(new Set([...manuallySelectedGroups, ...departmentLinkedGroups, ...employeeTypeLinkedGroups]));
    
    setSelectedApps(newApps);
    setSelectedGroups(newGroups);
  };

  const handleGroupToggle = (group: string) => {
    setSelectedGroups(prev => {
      const newGroups = prev.includes(group)
        ? prev.filter(g => g !== group)
        : [...prev, group];
      
      // Update manually selected groups list
      const currentDepartment = form.getValues("department");
      const currentEmployeeType = form.getValues("employeeType");
      const departmentLinkedGroups = fieldSettings?.department?.linkGroups && currentDepartment && departmentGroupMappings[currentDepartment] ? departmentGroupMappings[currentDepartment] : [];
      const employeeTypeLinkedGroups = fieldSettings?.employeeType?.linkGroups && currentEmployeeType && employeeTypeGroupMappings[currentEmployeeType] ? employeeTypeGroupMappings[currentEmployeeType] : [];
      const linkedGroups = [...departmentLinkedGroups, ...employeeTypeLinkedGroups];
      
      setManuallySelectedGroups(newGroups.filter(g => !linkedGroups.includes(g)));
      
      return newGroups;
    });
  };

  const handleAppToggle = (app: string) => {
    setSelectedApps(prev => {
      const newApps = prev.includes(app)
        ? prev.filter(a => a !== app)
        : [...prev, app];
      
      // Update manually selected apps list
      const currentDepartment = form.getValues("department");
      const currentEmployeeType = form.getValues("employeeType");
      const departmentLinkedApps = fieldSettings?.department?.linkApps && currentDepartment && departmentAppMappings[currentDepartment] ? departmentAppMappings[currentDepartment] : [];
      const employeeTypeLinkedApps = fieldSettings?.employeeType?.linkApps && currentEmployeeType && employeeTypeAppMappings[currentEmployeeType] ? employeeTypeAppMappings[currentEmployeeType] : [];
      const linkedApps = [...departmentLinkedApps, ...employeeTypeLinkedApps];
      
      setManuallySelectedApps(newApps.filter(a => !linkedApps.includes(a)));
      
      return newApps;
    });
  };

  const generatePassword = () => {
    const words = [
      'blue', 'red', 'green', 'cat', 'dog', 'sun', 'moon', 'star', 'tree', 'bird',
      'fish', 'car', 'book', 'key', 'box', 'cup', 'pen', 'hat', 'bag', 'run',
      'jump', 'fast', 'slow', 'big', 'small', 'hot', 'cold', 'new', 'old', 'good',
      'bad', 'easy', 'hard', 'soft', 'loud', 'quiet', 'dark', 'light', 'win', 'lose',
      'open', 'close', 'start', 'stop', 'home', 'work', 'play', 'rest', 'love', 'hope'
    ];
    
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*'];
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    // Generate exactly 12 characters: 2 words + 1 symbol + 2 numbers
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const num1 = numbers[Math.floor(Math.random() * numbers.length)];
    const num2 = numbers[Math.floor(Math.random() * numbers.length)];
    
    // Capitalize first letter of each word
    const cap1 = word1.charAt(0).toUpperCase() + word1.slice(1);
    const cap2 = word2.charAt(0).toUpperCase() + word2.slice(1);
    
    const generatedPassword = cap1 + cap2 + symbol + num1 + num2;
    setPassword(generatedPassword);
    form.setValue('password', generatedPassword);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name {fieldSettings?.firstName?.required ? '*' : ''}</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name {fieldSettings?.lastName?.required ? '*' : ''}</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Email and Password Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Username {fieldSettings?.emailUsername?.required ? '*' : ''}</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <Input 
                          placeholder="username" 
                          value={String(field.value || '').split('@')[0] || ''}
                          onChange={(e) => {
                            const username = e.target.value;
                            const domain = selectedDomain || emailDomains[0] || '';
                            const email = `${username}${domain}`;
                            field.onChange(email);
                            // Don't set login separately - let server use email as login
                          }}
                          className="rounded-r-none border-r-0"
                        />
                        {hasMultipleDomains ? (
                          <CustomSelect
                            value={selectedDomain}
                            onValueChange={(value: string) => {
                              setSelectedDomain(value);
                              const username = String(field.value || '').split('@')[0] || '';
                              const email = `${username}${value}`;
                              field.onChange(email);
                            }}
                          >
                            <CustomSelectTrigger className="rounded-l-none border-l-0 min-w-[140px]">
                              <CustomSelectValue />
                            </CustomSelectTrigger>
                            <CustomSelectContent>
                              {emailDomains.filter((domain: string) => {
                                const isValid = domain && domain.trim() !== '';
                                return isValid;
                              }).map((domain: string) => {
                                return (
                                  <CustomSelectItem key={domain} value={domain}>
                                    {domain}
                                  </CustomSelectItem>
                                );
                              })}
                            </CustomSelectContent>
                          </CustomSelect>
                        ) : (
                          <div className="bg-gray-100 dark:bg-gray-800 border border-l-0 rounded-r-md px-3 py-2 text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            {emailDomains[0] || ''}
                          </div>
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password {fieldSettings?.password?.required ? '*' : ''}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="text" 
                          placeholder="Enter password" 
                          value={field.value || ""}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            field.onChange(e.target.value);
                          }}
                        />
                        {passwordConfig?.showGenerateButton && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={generatePassword}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Job Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title {fieldSettings?.title?.required ? '*' : ''}</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter job title" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department {fieldSettings?.department?.required ? '*' : ''}</FormLabel>
                    <FormControl>
                      {(() => {
                        const hasOptions = fieldSettings?.department?.options && 
                                         Array.isArray(fieldSettings.department.options) && 
                                         fieldSettings.department.options.length > 0;
                        
                        return hasOptions ? (
                          <Select
                            value={field.value || undefined}
                            onValueChange={(value) => handleDepartmentChange(value, field.onChange)}
                          >
                            <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                              {fieldSettings.department.options.filter((option: string) => option && option.trim() !== '').map((option: string) => (
                                <SelectItem key={option} value={option} className="bg-white dark:bg-gray-800">
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input placeholder="Enter department" {...field} value={field.value || ""} />
                        );
                      })()}
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Manager and Employee Type */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager {fieldSettings?.manager?.required ? '*' : ''}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          value={managerSearch}
                          onChange={(e) => {
                            const value = e.target.value;
                            setManagerSearch(value);
                            setShowManagerDropdown(value.length > 0);
                            if (value !== field.value) {
                              field.onChange("");
                            }
                          }}
                          placeholder="Type to search for manager..."
                        />
                        {managerSearch && filteredManagers.length > 0 && showManagerDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredManagers.map((manager: User) => (
                              <div
                                key={manager.id}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                onClick={() => {
                                  const fullName = `${manager.firstName} ${manager.lastName}`;
                                  field.onChange(fullName);
                                  setManagerSearch(fullName);
                                  setShowManagerDropdown(false);
                                  form.setValue('managerId', manager.id);
                                }}
                              >
                                <div className="font-medium text-gray-900 dark:text-white">{manager.firstName} {manager.lastName}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{manager.email}</div>
                                {manager.title && (
                                  <div className="text-sm text-gray-400 dark:text-gray-500">{manager.title}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Type {fieldSettings?.employeeType?.required ? '*' : ''}</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || undefined}
                        onValueChange={(value) => handleEmployeeTypeChange(value, field.onChange)}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder="Select employee type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          {fieldSettings?.employeeType?.options?.filter((option: string) => option && option.trim() !== '').map((option: string) => (
                            <SelectItem key={option} value={option} className="bg-white dark:bg-gray-800">
                              {option}
                            </SelectItem>
                          )) || []}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />

            </div>

            {/* Groups and Apps */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`space-y-2 ${fieldSettings?.groups?.hideField ? 'invisible' : ''}`}>
                <Label>Email Groups {fieldSettings?.groups?.required ? '*' : ''}</Label>
                <div className="space-y-2">
                  {availableGroups.map((group) => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox
                        id={group}
                        checked={selectedGroups.includes(group)}
                        onCheckedChange={() => handleGroupToggle(group)}
                        disabled={fieldSettings?.groups?.hideField}
                      />
                      <Label htmlFor={group} className="text-sm font-normal">
                        {group}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`space-y-3 ${fieldSettings?.apps?.hideField ? 'invisible' : ''}`}>
                <Label>Apps {fieldSettings?.apps?.required ? '*' : ''}</Label>
                
                {/* Add app dropdown at top */}
                <Select
                  onValueChange={(value) => {
                    if (value && !selectedApps.includes(value)) {
                      setSelectedApps([...selectedApps, value]);
                    }
                  }}
                  disabled={fieldSettings?.apps?.hideField}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    <div className="flex items-center">
                      <span className="text-blue-500 mr-2">+</span>
                      <SelectValue placeholder="Add app" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    {availableApps
                      .filter((app: string) => {
                        const isValid = app && app.trim() !== '' && !selectedApps.includes(app);
                        return isValid;
                      })
                      .map((app: string) => {
                        if (!app || app.trim() === '') {
                          return null;
                        }
                        return (
                          <SelectItem key={app} value={app} className="bg-white dark:bg-gray-800">
                            {app}
                          </SelectItem>
                        );
                      }).filter(Boolean)}
                  </SelectContent>
                </Select>

                {/* Selected apps using exact Employee Type format */}
                <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-w-48">
                  {selectedApps.map((appName, index) => (
                    <div key={index} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span className="flex-1 text-gray-900 dark:text-gray-100 text-sm uppercase">
                        {appName}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedApps(selectedApps.filter(app => app !== appName));
                        }}
                        className="h-4 w-4 p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-1"
                        disabled={fieldSettings?.apps?.hideField}
                      >
                        {'×'}
                      </Button>
                    </div>
                  ))}
                  {selectedApps.length === 0 && (
                    <div className="flex items-center px-3 py-4 text-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-full">No apps selected</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Send Activation Email */}
            <div className={`flex items-center space-x-2 ${fieldSettings?.sendActivationEmail?.hideField ? 'invisible' : ''}`}>
              <Checkbox
                id="sendActivationEmail"
                checked={sendActivationEmail}
                onCheckedChange={(checked) => setSendActivationEmail(checked === true)}
                disabled={fieldSettings?.sendActivationEmail?.hideField}
              />
              <Label htmlFor="sendActivationEmail" className="text-sm font-normal">
                Send activation email to manager {fieldSettings?.sendActivationEmail?.required ? '*' : ''}
              </Label>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}