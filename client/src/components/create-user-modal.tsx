import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema, type InsertUser, type User } from "@shared/schema";
import { X, Check, RefreshCw } from "lucide-react";

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

  const availableManagers = usersData?.users || [];

  // Filter managers based on search input
  const filteredManagers = useMemo(() => {
    if (!managerSearch || managerSearch.length < 1) return [];
    
    const searchTerm = managerSearch.toLowerCase().trim();
    
    return availableManagers
      .filter(user => {
        const firstName = user.firstName?.toLowerCase() || '';
        const lastName = user.lastName?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        const title = user.title?.toLowerCase() || '';
        const department = user.department?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`;
        
        // Search in multiple fields - prioritize first name matching
        return firstName.startsWith(searchTerm) ||
               firstName.includes(searchTerm) ||
               lastName.startsWith(searchTerm) ||
               fullName.includes(searchTerm) ||
               email.includes(searchTerm) ||
               title.includes(searchTerm) ||
               department.includes(searchTerm);
      })
      .sort((a, b) => {
        // Sort by relevance - first name exact matches get highest priority
        const aFirstName = a.firstName?.toLowerCase() || '';
        const aLastName = a.lastName?.toLowerCase() || '';
        const bFirstName = b.firstName?.toLowerCase() || '';
        const bLastName = b.lastName?.toLowerCase() || '';
        const aFullName = `${aFirstName} ${aLastName}`;
        const bFullName = `${bFirstName} ${bLastName}`;
        
        // First name exact start match gets highest priority
        const aFirstStartsWithSearch = aFirstName.startsWith(searchTerm);
        const bFirstStartsWithSearch = bFirstName.startsWith(searchTerm);
        
        if (aFirstStartsWithSearch && !bFirstStartsWithSearch) return -1;
        if (bFirstStartsWithSearch && !aFirstStartsWithSearch) return 1;
        
        // If both or neither start with search term, check first name contains
        const aFirstContainsSearch = aFirstName.includes(searchTerm);
        const bFirstContainsSearch = bFirstName.includes(searchTerm);
        
        if (aFirstContainsSearch && !bFirstContainsSearch) return -1;
        if (bFirstContainsSearch && !aFirstContainsSearch) return 1;
        
        // Last name start match gets next priority
        if (aLastName.startsWith(searchTerm) && !bLastName.startsWith(searchTerm)) return -1;
        if (bLastName.startsWith(searchTerm) && !aLastName.startsWith(searchTerm)) return 1;
        
        // Full name match gets lower priority
        if (aFullName.startsWith(searchTerm) && !bFullName.startsWith(searchTerm)) return -1;
        if (bFullName.startsWith(searchTerm) && !aFullName.startsWith(searchTerm)) return 1;
        
        // Sort alphabetically as fallback
        return aFullName.localeCompare(bFullName);
      })
      .slice(0, 15);
  }, [availableManagers, managerSearch]);


  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      login: "",
      password: "",
      department: "",
      title: "",
      employeeType: "",
      managerId: undefined,
      status: "ACTIVE",
      groups: [],
      applications: [],
      sendActivationEmail: true,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      return apiRequest("POST", "/api/users", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User created successfully",
      });
      form.reset();
      setSelectedGroups([]);
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertUser) => {
    createUserMutation.mutate({
      ...data,
      password,
      selectedApps,
      selectedGroups,
      groups: selectedGroups,
      applications: selectedApps,
    });
  };

  const handleGroupToggle = (groupName: string, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, groupName]);
    } else {
      setSelectedGroups(selectedGroups.filter(g => g !== groupName));
    }
  };

  const handleAppToggle = (appName: string, checked: boolean) => {
    if (checked) {
      setSelectedApps([...selectedApps, appName]);
    } else {
      setSelectedApps(selectedApps.filter(a => a !== appName));
    }
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
    
    // Generate exactly 2 words to fit 12 characters total
    let attempts = 0;
    let generatedPassword = '';
    
    while (attempts < 20) {
      // Select 2 unique words
      const selectedWords = [];
      const usedIndices = new Set();
      
      for (let i = 0; i < 2; i++) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * words.length);
        } while (usedIndices.has(randomIndex));
        
        usedIndices.add(randomIndex);
        selectedWords.push(words[randomIndex]);
      }
      
      // Capitalize first letter of each word
      const capitalizedWords = selectedWords.map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      );
      
      // Add one symbol
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      
      // Add exactly two numbers
      const randomNumbers = [
        numbers[Math.floor(Math.random() * numbers.length)],
        numbers[Math.floor(Math.random() * numbers.length)]
      ];
      
      // Combine all parts
      const testPassword = capitalizedWords.join('') + randomSymbol + randomNumbers.join('');
      
      // Check if exactly 12 characters
      if (testPassword.length === 12) {
        generatedPassword = testPassword;
        break;
      }
      
      attempts++;
    }
    
    // Fallback: force exactly 12 characters with 2 words + symbol + 2 numbers
    if (!generatedPassword) {
      // Use words that together make exactly 9 characters (12 - 1 symbol - 2 numbers)
      const targetWordLength = 9;
      const word1 = words[Math.floor(Math.random() * words.length)];
      const word2 = words[Math.floor(Math.random() * words.length)];
      
      let cap1 = word1.charAt(0).toUpperCase() + word1.slice(1);
      let cap2 = word2.charAt(0).toUpperCase() + word2.slice(1);
      
      // Adjust word lengths to reach exactly 9 characters total
      const currentWordLength = cap1.length + cap2.length;
      if (currentWordLength > targetWordLength) {
        // Trim words to fit
        const excess = currentWordLength - targetWordLength;
        if (cap2.length > excess) {
          cap2 = cap2.substring(0, cap2.length - excess);
        } else {
          cap2 = cap2.substring(0, 1); // Keep at least first letter
          const remaining = excess - (cap2.length - 1);
          cap1 = cap1.substring(0, Math.max(1, cap1.length - remaining));
        }
      } else if (currentWordLength < targetWordLength) {
        // Pad with additional letters from word pool
        const needed = targetWordLength - currentWordLength;
        const extraLetters = 'abcdefghijklmnopqrstuvwxyz';
        for (let i = 0; i < needed; i++) {
          cap2 += extraLetters[Math.floor(Math.random() * extraLetters.length)];
        }
      }
      
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const num1 = numbers[Math.floor(Math.random() * numbers.length)];
      const num2 = numbers[Math.floor(Math.random() * numbers.length)];
      
      generatedPassword = cap1 + cap2 + symbol + num1 + num2;
    }
    
    setPassword(generatedPassword);
    form.setValue('password', generatedPassword);
  };

  const handleClose = () => {
    form.reset();
    setSelectedGroups([]);
    setSelectedApps([]);
    setManagerSearch("");
    setShowManagerDropdown(false);
    setPassword("");
    onClose();
  };

  const availableGroups = [
    "R&D@mazetx.com",
    "Labusers@mazetx.com", 
    "finfacit@mazetx.com",
    "HR@mazetx.com",
    "GXP@mazetx.com",
    "MTXCW-SG-ZOOM-PRO"
  ];

  const availableApps = [
    "Microsoft",
    "Slack",
    "Zoom"
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
            Create New User
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
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
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Username *</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <Input 
                          placeholder="username" 
                          value={field.value ? field.value.replace('@mazetx.com', '') : ''}
                          onChange={(e) => {
                            const username = e.target.value;
                            const fullEmail = username ? `${username}@mazetx.com` : '';
                            field.onChange(fullEmail);
                            // Auto-update login field
                            form.setValue('login', fullEmail);
                          }}
                          className="rounded-r-none"
                        />
                        <div className="flex items-center px-3 bg-gray-50 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md text-sm text-gray-500 dark:text-gray-300">
                          @mazetx.com
                        </div>
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
                    <FormLabel>Password *</FormLabel>
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
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={generatePassword}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
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
                    <FormLabel>Department</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Auto-check groups based on department selection
                        let newGroups = [...selectedGroups];
                        
                        // Remove department-specific groups first
                        newGroups = newGroups.filter(group => 
                          group !== "HR@mazetx.com" && group !== "finfacit@mazetx.com"
                        );
                        
                        // Add appropriate group based on selection
                        if (value === "HR") {
                          newGroups.push("HR@mazetx.com");
                        } else if (value === "Finance") {
                          newGroups.push("finfacit@mazetx.com");
                        }
                        
                        setSelectedGroups(newGroups);
                      }} 
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="HR">Human Resources</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          value={managerSearch}
                          onChange={(e) => {
                            const value = e.target.value;
                            setManagerSearch(value);
                            setShowManagerDropdown(value.length > 0);
                            // Clear the field value when typing
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
                                  // Set the manager ID for form submission
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
                    <FormLabel>Employee Type</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Auto-check groups based on employee type selection
                        let newGroups = [...selectedGroups];
                        
                        // Remove employee type-specific groups first
                        newGroups = newGroups.filter(group => 
                          group !== "MTXCW-ET-EMPLOYEE" && group !== "MTXCW-ET-CONTRACTOR"
                        );
                        
                        // Add appropriate group based on selection
                        if (value === "Employee") {
                          newGroups.push("MTXCW-ET-EMPLOYEE");
                        } else if (value === "Contractor") {
                          newGroups.push("MTXCW-ET-CONTRACTOR");
                        }
                        
                        setSelectedGroups(newGroups);
                      }}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder="Select Employee Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        <SelectItem value="Employee">Employee</SelectItem>
                        <SelectItem value="Contractor">Contractor</SelectItem>
                        <SelectItem value="Intern">Intern</SelectItem>
                        <SelectItem value="Part Time">Part Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Groups</Label>
                <div className="space-y-2">
                  {availableGroups.map((group) => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${group}`}
                        checked={selectedGroups.includes(group)}
                        onCheckedChange={(checked) => handleGroupToggle(group, checked as boolean)}
                      />
                      <Label htmlFor={`group-${group}`} className="text-sm text-gray-700 dark:text-gray-300">
                        {group}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Apps</Label>
                <div className="space-y-2">
                  {availableApps.map((app) => (
                    <div key={app} className="flex items-center space-x-2">
                      <Checkbox
                        id={`app-${app}`}
                        checked={selectedApps.includes(app)}
                        onCheckedChange={(checked) => handleAppToggle(app, checked as boolean)}
                      />
                      <Label htmlFor={`app-${app}`} className="text-sm text-gray-700 dark:text-gray-300">
                        {app}
                      </Label>
                    </div>
                  ))}

                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="sendActivationEmail"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Send activation email to manager</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
