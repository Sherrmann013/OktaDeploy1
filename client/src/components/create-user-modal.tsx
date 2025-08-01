import React, { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { generate } from "random-words";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const { toast } = useToast();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [managerSearch, setManagerSearch] = useState("");
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const [password, setPassword] = useState("");
  const [sendActivationEmail, setSendActivationEmail] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  // Fetch app mappings for dynamic app dropdown
  const { data: appMappingsData = [] } = useQuery({
    queryKey: ['/api/app-mappings'],
    enabled: open,
  });

  // Fetch existing users for manager dropdown
  const { data: usersData } = useQuery({
    queryKey: ["/api/users", "all"],
    queryFn: async () => {
      const response = await fetch('/api/users?limit=1000', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users for manager selection');
      }
      
      return response.json();
    },
    enabled: open,
  });

  // Fetch email domain configuration from New User Layout settings
  const { data: emailDomainConfig } = useQuery({
    queryKey: ["/api/layout-settings", "emailUsername"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/layout-settings/emailUsername', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          // Return default configuration if not found
          return { domains: ['@mazetx.com'] };
        }
        
        const data = await response.json();
        return JSON.parse(data.settingValue || '{"domains":["@mazetx.com"]}');
      } catch (error) {
        // Return default configuration on error
        return { domains: ['@mazetx.com'] };
      }
    },
    enabled: open,
  });

  // Fetch all field settings from admin layout
  const { data: fieldSettings } = useQuery({
    queryKey: ["/api/layout-settings", "all-fields"],
    queryFn: async () => {
      try {
        console.log('🔍 CreateUserModal - Starting field settings fetch including Department and Employee Type');
        const settingsQueries = [
          fetch('/api/layout-settings/firstName', { credentials: 'include' }),
          fetch('/api/layout-settings/lastName', { credentials: 'include' }),
          fetch('/api/layout-settings/emailUsername', { credentials: 'include' }),
          fetch('/api/layout-settings/password', { credentials: 'include' }),
          fetch('/api/layout-settings/title', { credentials: 'include' }),
          fetch('/api/layout-settings/manager', { credentials: 'include' }),
          fetch('/api/layout-settings/department', { credentials: 'include' }),
          fetch('/api/layout-settings/employeeType', { credentials: 'include' })
        ];
        

        
        const responses = await Promise.all(settingsQueries);
        const settings = {
          firstName: { required: true },
          lastName: { required: true },
          emailUsername: { required: true, domains: ['@mazetx.com'] },
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
          department: { required: false, useList: false, options: [] },
          employeeType: { required: false, useList: true, options: [] }
        };
        
        // Parse individual setting responses
        const fieldNames = ['firstName', 'lastName', 'emailUsername', 'password', 'title', 'manager', 'department', 'employeeType'];
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          const fieldName = fieldNames[i];
          
          if (response.ok) {
            const data = await response.json();
            try {
              const parsedValue = JSON.parse(data.settingValue || '{}');
              settings[fieldName as keyof typeof settings] = parsedValue;
              console.log(`🔍 CreateUserModal - Loaded ${fieldName} config:`, parsedValue);
            } catch (e) {
              console.warn(`Failed to parse ${fieldName} settings:`, e);
            }
          } else {
            console.log(`🔍 CreateUserModal - No config found for ${fieldName}, using defaults`);
          }
        }
        
        return settings;
      } catch (error) {
        console.error('Error fetching field settings:', error);
        return {
          firstName: { required: true },
          lastName: { required: true },
          emailUsername: { required: true, domains: ['@mazetx.com'] },
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
          department: { required: false, useList: false, options: [] },
          employeeType: { required: false, useList: true, options: [] }
        };
      }
    },
    enabled: open,
  });

  // Extract password config for backward compatibility
  const passwordConfig = fieldSettings?.password;

  const availableManagers = usersData?.users || [];
  const emailDomains = emailDomainConfig?.domains || ['@mazetx.com'];
  const hasMultipleDomains = emailDomains.length > 1;

  // Debug logging for field configuration
  React.useEffect(() => {
    console.log('🔍 CreateUserModal - Field settings loaded:', fieldSettings);

    console.log('🔍 CreateUserModal - Email domain config loaded:', emailDomainConfig);
    console.log('🔍 CreateUserModal - Email domains:', emailDomains);
    console.log('🔍 CreateUserModal - Has multiple domains:', hasMultipleDomains);
  }, [fieldSettings, emailDomainConfig, emailDomains, hasMultipleDomains]);

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
    
    return insertUserSchema.extend({
      firstName: fieldSettings.firstName?.required 
        ? z.string().min(1, "First name is required")
        : z.string().optional(),
      lastName: fieldSettings.lastName?.required 
        ? z.string().min(1, "Last name is required") 
        : z.string().optional(),
      email: fieldSettings.emailUsername?.required 
        ? z.string().min(1, "Email is required").email("Invalid email format")
        : z.string().email("Invalid email format").optional().or(z.literal("")),
      password: fieldSettings.password?.required 
        ? z.string().min(1, "Password is required")
        : z.string().optional(),
      title: fieldSettings.title?.required 
        ? z.string().min(1, "Job title is required")
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

  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const response = await apiRequest("POST", "/api/users", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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

  const availableGroups = [
    "R&D@mazetx.com",
    "Labusers@mazetx.com", 
    "finfacit@mazetx.com",
    "HR@mazetx.com",
    "GXP@mazetx.com"
  ];

  // Dynamic apps from database
  const availableApps = appMappingsData.map((app: any) => app.appName);

  const handleGroupToggle = (group: string) => {
    setSelectedGroups(prev => 
      prev.includes(group)
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const handleAppToggle = (app: string) => {
    setSelectedApps(prev => 
      prev.includes(app)
        ? prev.filter(a => a !== app)
        : [...prev, app]
    );
  };

  // Generate password using admin-configured settings
  const generatePassword = () => {
    if (!passwordConfig) return;
    
    // Generate words dynamically using random-words library with length constraints
    const getWordsByLength = (targetLength: number, count: number = 10) => {
      try {
        const words = generate({ 
          min: Math.max(1, targetLength - 1), 
          max: targetLength + 1,
          exactly: count * 3 // Generate more to filter better matches
        }) as string[];
        
        // Filter to exact length preference and capitalize
        return words
          .filter(word => word.length >= targetLength - 1 && word.length <= targetLength + 1)
          .slice(0, count)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1));
      } catch (error) {
        console.warn('Random words generation failed, using fallback');
        // Fallback to a small set if library fails
        const fallback = ['Blue', 'Red', 'Green', 'Star', 'Moon', 'Tree', 'Bird', 'Fish', 'Book', 'Light'];
        return fallback.slice(0, count);
      }
    };
    
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '+', '=', '?'];
    const numbers = '0123456789';
    
    let passwordParts: string[] = [];
    
    // Calculate how much space we need for non-word components
    let nonWordLength = 0;
    passwordConfig.components.forEach(component => {
      if (component.type === 'numbers') {
        nonWordLength += component.count; // Each number is 1 digit
      } else if (component.type === 'symbols') {
        nonWordLength += component.count; // Each symbol is 1 character
      }
    });
    
    // Available space for words
    const availableWordSpace = passwordConfig.targetLength - nonWordLength;
    
    // Process each component according to admin configuration
    passwordConfig.components.forEach(component => {
      for (let i = 0; i < component.count; i++) {
        switch (component.type) {
          case 'words':
            // Calculate target word length based on available space
            const remainingWordCount = passwordConfig.components.find(c => c.type === 'words')?.count || 1;
            const targetWordLength = Math.floor(availableWordSpace / remainingWordCount);
            
            // Generate words dynamically with appropriate length
            const candidateWords = getWordsByLength(targetWordLength, 5);
            const selectedWord = candidateWords[Math.floor(Math.random() * candidateWords.length)];
            
            passwordParts.push(selectedWord);
            break;
          case 'numbers':
            // Generate a single digit (0-9) as one component
            const singleDigit = numbers[Math.floor(Math.random() * numbers.length)];
            passwordParts.push(singleDigit);
            break;
          case 'symbols':
            passwordParts.push(symbols[Math.floor(Math.random() * symbols.length)]);
            break;
        }
      }
    });
    
    // Keep components in the order they appear in the configuration
    let password = passwordParts.join('');
    
    // Trim to exact target length if needed (no padding)
    if (passwordConfig.targetLength && password.length > passwordConfig.targetLength) {
      password = password.substring(0, passwordConfig.targetLength);
    }
    
    console.log('🔑 Generated password with components:', {
      components: passwordConfig.components,
      targetLength: passwordConfig.targetLength,
      availableWordSpace,
      generatedParts: passwordParts,
      finalPassword: password,
      finalLength: password.length
    });
    
    setPassword(password);
    form.setValue('password', password);
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
                    <FormMessage />
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
                    <FormMessage />
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
                            const domain = selectedDomain || emailDomains[0] || '@mazetx.com';
                            const email = `${username}${domain}`;
                            field.onChange(email);
                            form.setValue('login', username);
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
                              {emailDomains.map((domain: string) => (
                                <CustomSelectItem key={domain} value={domain}>
                                  {domain}
                                </CustomSelectItem>
                              ))}
                            </CustomSelectContent>
                          </CustomSelect>
                        ) : (
                          <div className="bg-gray-100 dark:bg-gray-800 border border-l-0 rounded-r-md px-3 py-2 text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            {emailDomains[0] || '@mazetx.com'}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
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
                          value={password}
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

                    <FormMessage />
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
                      <Input placeholder="Enter job title" {...field} />
                    </FormControl>
                    <FormMessage />
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
                      {fieldSettings?.department?.options?.length > 0 ? (
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                            {fieldSettings?.department?.options?.map((option: string) => (
                              <SelectItem key={option} value={option} className="bg-white dark:bg-gray-800">
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input placeholder="Enter department" {...field} />
                      )}
                    </FormControl>
                    <FormMessage />
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
                    <FormMessage />
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
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder="Select employee type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          {fieldSettings?.employeeType?.options?.map((option: string) => (
                            <SelectItem key={option} value={option} className="bg-white dark:bg-gray-800">
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            {/* Groups and Apps */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Groups</Label>
                <div className="space-y-2">
                  {availableGroups.map((group) => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox
                        id={group}
                        checked={selectedGroups.includes(group)}
                        onCheckedChange={() => handleGroupToggle(group)}
                      />
                      <Label htmlFor={group} className="text-sm font-normal">
                        {group}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Apps</Label>
                <div className="border border-gray-300 dark:border-gray-600 rounded p-3 bg-white dark:bg-gray-800 min-h-[120px]">
                  <div className="space-y-3">
                    {/* Dropdown for adding apps */}
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value && !selectedApps.includes(value)) {
                          setSelectedApps([...selectedApps, value]);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                        <SelectValue placeholder="Select an app to add..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                        {availableApps
                          .filter(app => !selectedApps.includes(app))
                          .map((app) => (
                            <SelectItem key={app} value={app} className="bg-white dark:bg-gray-800">
                              {app}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Selected apps display */}
                    <div className="space-y-2">
                      {selectedApps.map((appName, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded border">
                          <span className="text-sm font-medium">{appName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedApps(selectedApps.filter(app => app !== appName));
                            }}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      {selectedApps.length === 0 && (
                        <div className="text-center py-4">
                          <span className="text-sm text-gray-500 dark:text-gray-400">No apps selected</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Send Activation Email */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendActivationEmail"
                checked={sendActivationEmail}
                onCheckedChange={setSendActivationEmail}
              />
              <Label htmlFor="sendActivationEmail" className="text-sm font-normal">
                Send activation email to manager
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