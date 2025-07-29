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
import { X, Check, RefreshCw, Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [sendActivationEmail, setSendActivationEmail] = useState(true);

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
      employeeType: "EMPLOYEE",
      managerId: undefined,
      status: "ACTIVE",
      groups: [],
      applications: [],
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

  const availableApps = [
    "Microsoft",
    "Slack", 
    "Zoom"
  ];

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

  // Generate a random 12-character password
  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setValue('password', password);
  };

  // Auto-generate login from email 
  const handleEmailChange = (email: string) => {
    form.setValue('email', email);
    const username = email.split('@')[0];
    form.setValue('login', username);
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

            {/* Email and Password Row */}
            <div className="grid grid-cols-2 gap-4">
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
                          value={field.value.split('@')[0]}
                          onChange={(e) => handleEmailChange(`${e.target.value}@mazetx.com`)}
                          className="rounded-r-none border-r-0"
                        />
                        <div className="bg-gray-100 dark:bg-gray-800 border border-l-0 rounded-r-md px-3 py-2 text-sm text-gray-600 dark:text-gray-400 flex items-center">
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
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter password" 
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={generatePassword}
                      className="mt-1"
                    >
                      Generate
                    </Button>
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
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Human Resources" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Human Resources">Human Resources</SelectItem>
                          <SelectItem value="IT Security">IT Security</SelectItem>
                          <SelectItem value="IT">IT</SelectItem>
                          <SelectItem value="Legal">Legal</SelectItem>
                          <SelectItem value="Executive">Executive</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Operations">Operations</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Manager and Employee Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Manager</Label>
                <Popover open={showManagerDropdown} onOpenChange={setShowManagerDropdown}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={showManagerDropdown}
                      className="w-full justify-between"
                    >
                      {managerSearch || "Type to search for manager..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Type to search for manager..." 
                        value={managerSearch}
                        onValueChange={setManagerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No managers found.</CommandEmpty>
                        <CommandGroup>
                          {filteredManagers.map((manager) => (
                            <CommandItem
                              key={manager.id}
                              value={`${manager.firstName} ${manager.lastName}`}
                              onSelect={() => {
                                setManagerSearch(`${manager.firstName} ${manager.lastName}`);
                                form.setValue('managerId', manager.id);
                                setShowManagerDropdown(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span>{manager.firstName} {manager.lastName}</span>
                                <span className="text-sm text-gray-500">{manager.title} - {manager.department}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <FormField
                control={form.control}
                name="employeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Employee</SelectItem>
                          <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                          <SelectItem value="INTERN">Intern</SelectItem>
                          <SelectItem value="PART_TIME">Part Time</SelectItem>
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
                <div className="space-y-2">
                  {availableApps.map((app) => (
                    <div key={app} className="flex items-center space-x-2">
                      <Checkbox
                        id={app}
                        checked={selectedApps.includes(app)}
                        onCheckedChange={() => handleAppToggle(app)}
                      />
                      <Label htmlFor={app} className="text-sm font-normal">
                        {app}
                      </Label>
                    </div>
                  ))}
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