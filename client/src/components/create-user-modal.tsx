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
          fetch('/api/layout-settings/employeeType', { credentials: 'include' }),
          fetch('/api/layout-settings/apps', { credentials: 'include' }),
          fetch('/api/layout-settings/groups', { credentials: 'include' })
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
          employeeType: { required: false, useList: true, options: [] },
          apps: { required: false, hideField: false },
          groups: { required: false, useList: true, options: [] }
        };
        
        // Parse individual setting responses
        const fieldNames = ['firstName', 'lastName', 'emailUsername', 'password', 'title', 'manager', 'department', 'employeeType', 'apps', 'groups'];
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
          employeeType: { required: false, useList: true, options: [] },
          apps: { required: false, hideField: false },
          groups: { required: false, useList: true, options: [] }
        };
      }
    },
    enabled: open,
  });

  // Extract password config for backward compatibility
  const passwordConfig = fieldSettings?.password;

  const availableManagers = usersData?.users || [];
  const emailDomains = (emailDomainConfig?.domains || ['@mazetx.com']).filter((domain: string) => domain && domain.trim() !== '');
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
        ? z.string().min(1)
        : z.string().optional(),
      lastName: fieldSettings.lastName?.required 
        ? z.string().min(1) 
        : z.string().optional(),
      email: fieldSettings.emailUsername?.required 
        ? z.string().min(1).email()
        : z.string().email().optional().or(z.literal("")),
      password: fieldSettings.password?.required 
        ? z.string().min(1)
        : z.string().optional(),
      title: fieldSettings.title?.required 
        ? z.string().min(1)
        : z.string().optional(),
      manager: fieldSettings.manager?.required 
        ? z.string().min(1)
        : z.string().optional(),
      department: fieldSettings.department?.required 
        ? z.string().min(1)
        : z.string().optional(),
      employeeType: fieldSettings.employeeType?.required 
        ? z.string().min(1)
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

  const availableGroups = fieldSettings?.groups?.options || [
    "R&D@mazetx.com",
    "Labusers@mazetx.com", 
    "finfacit@mazetx.com",
    "HR@mazetx.com",
    "GXP@mazetx.com"
  ];

  // Dynamic apps from database
  const availableApps = (appMappingsData as any[]).map((app: any) => app.appName);

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
    
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '+', '=', '?'];
    const numbers = '0123456789';
    
    // Calculate exact space allocation
    const targetLength = passwordConfig.targetLength;
    const totalNumbers = passwordConfig.components.filter(c => c.type === 'numbers').reduce((sum, c) => sum + c.count, 0);
    const totalSymbols = passwordConfig.components.filter(c => c.type === 'symbols').reduce((sum, c) => sum + c.count, 0);
    const totalWords = passwordConfig.components.filter(c => c.type === 'words').reduce((sum, c) => sum + c.count, 0);
    
    // Calculate exact space available for words
    const spaceForWords = targetLength - totalNumbers - totalSymbols;
    const charsPerWord = totalWords > 0 ? Math.floor(spaceForWords / totalWords) : 0;
    
    // If we can't fit the components, adjust word length
    const minWordLength = Math.max(3, charsPerWord);
    
    let passwordParts: string[] = [];
    let currentWordIndex = 0;
    
    // Process each component according to admin configuration
    passwordConfig.components.forEach(component => {
      for (let i = 0; i < component.count; i++) {
        switch (component.type) {
          case 'words':
            try {
              // Generate words with exact length using random-words library
              const words = generate({
                min: minWordLength,
                max: minWordLength,
                exactly: 50 // Generate many words to find ones with exact length
              }) as string[];
              
              // Filter to get words of exact length
              const exactLengthWords = words.filter(word => word.length === minWordLength);
              
              if (exactLengthWords.length > 0) {
                const selectedWord = exactLengthWords[Math.floor(Math.random() * exactLengthWords.length)];
                passwordParts.push(selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1).toLowerCase());
              } else {
                // If no exact length words found, try generating with broader range and pick best fit
                const broaderWords = generate({
                  min: Math.max(3, minWordLength - 1),
                  max: minWordLength + 1,
                  exactly: 100
                }) as string[];
                
                const bestFit = broaderWords.find(word => word.length === minWordLength);
                if (bestFit) {
                  passwordParts.push(bestFit.charAt(0).toUpperCase() + bestFit.slice(1).toLowerCase());
                } else {
                  // Last resort: truncate a longer word to exact length
                  const longerWords = broaderWords.filter(word => word.length > minWordLength);
                  if (longerWords.length > 0) {
                    const selectedWord = longerWords[Math.floor(Math.random() * longerWords.length)]
                      .substring(0, minWordLength);
                    passwordParts.push(selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1).toLowerCase());
                  } else {
                    passwordParts.push('Word'.substring(0, minWordLength));
                  }
                }
              }
            } catch (error) {
              console.error('Word generation failed:', error);
              passwordParts.push('Word'.substring(0, minWordLength));
            }
            break;
          case 'numbers':
            const singleDigit = numbers[Math.floor(Math.random() * numbers.length)];
            passwordParts.push(singleDigit);
            break;
          case 'symbols':
            const selectedSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            passwordParts.push(selectedSymbol);
            break;
        }
      }
    });
    
    // Join all parts
    let password = passwordParts.join('');
    
    // CRITICAL: Ensure exact target length compliance
    if (password.length > targetLength) {
      password = password.substring(0, targetLength);
    } else if (password.length < targetLength) {
      // Pad with random numbers to reach exact target length
      const deficit = targetLength - password.length;
      for (let i = 0; i < deficit; i++) {
        password += numbers[Math.floor(Math.random() * numbers.length)];
      }
    }
    
    console.log('🔑 Generated password with components:', {
      components: passwordConfig.components,
      targetLength: passwordConfig.targetLength,
      generatedParts: passwordParts,
      finalPassword: password,
      finalLength: password.length,
      exactMatch: password.length === targetLength
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
                              {emailDomains.filter((domain: string) => domain && domain.trim() !== '').map((domain: string) => (
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
                            value={field.value || ""}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                              {fieldSettings.department.options.map((option: string) => (
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
                  </FormItem>
                )}
              />

            </div>

            {/* Groups and Apps */}
            <div className={`grid gap-4 ${
              (!fieldSettings?.groups?.hideField && !fieldSettings?.apps?.hideField) ? 'grid-cols-2' :
              (!fieldSettings?.groups?.hideField || !fieldSettings?.apps?.hideField) ? 'grid-cols-1' :
              'hidden'
            }`}>
              {!fieldSettings?.groups?.hideField && (
                <div className="space-y-2">
                  <Label>Groups {fieldSettings?.groups?.required ? '*' : ''}</Label>
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
              )}

              {!fieldSettings?.apps?.hideField && (
                <div className="space-y-3">
                  <Label>Apps {fieldSettings?.apps?.required ? '*' : ''}</Label>
                
                {/* Add app dropdown at top */}
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !selectedApps.includes(value)) {
                      setSelectedApps([...selectedApps, value]);
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    <div className="flex items-center">
                      <span className="text-blue-500 mr-2">+</span>
                      <SelectValue placeholder="Add app" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    {availableApps
                      .filter((app: string) => !selectedApps.includes(app))
                      .map((app: string) => (
                        <SelectItem key={app} value={app} className="bg-white dark:bg-gray-800">
                          {app}
                        </SelectItem>
                      ))}
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
              )}
            </div>

            {/* Send Activation Email */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendActivationEmail"
                checked={sendActivationEmail}
                onCheckedChange={(checked) => setSendActivationEmail(checked === true)}
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