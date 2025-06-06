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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema, type InsertUser, type User } from "@shared/schema";
import { X, Check } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const { toast } = useToast();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [managerSearch, setManagerSearch] = useState("");
  const [selectedManager, setSelectedManager] = useState<User | null>(null);
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);

  // Fetch existing users for manager dropdown
  const { data: usersData } = useQuery({
    queryKey: ["/api/users"],
    enabled: open,
  });

  const availableManagers = usersData?.users || [];
  
  // Filter managers based on search input
  const filteredManagers = useMemo(() => {
    if (!managerSearch || managerSearch.length < 2) return [];
    
    const searchTerm = managerSearch.toLowerCase().trim();
    
    return availableManagers
      .filter(user => {
        const firstName = user.firstName?.toLowerCase() || '';
        const lastName = user.lastName?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        const title = user.title?.toLowerCase() || '';
        const department = user.department?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`;
        
        return firstName.includes(searchTerm) ||
               lastName.includes(searchTerm) ||
               fullName.includes(searchTerm) ||
               email.includes(searchTerm) ||
               title.includes(searchTerm) ||
               department.includes(searchTerm);
      })
      .sort((a, b) => {
        // Sort by relevance - exact name matches first
        const aFullName = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bFullName = `${b.firstName} ${b.lastName}`.toLowerCase();
        const aFirstName = a.firstName?.toLowerCase() || '';
        const bFirstName = b.firstName?.toLowerCase() || '';
        const aLastName = a.lastName?.toLowerCase() || '';
        const bLastName = b.lastName?.toLowerCase() || '';
        
        // Exact first name match gets highest priority
        if (aFirstName.startsWith(searchTerm) && !bFirstName.startsWith(searchTerm)) return -1;
        if (bFirstName.startsWith(searchTerm) && !aFirstName.startsWith(searchTerm)) return 1;
        
        // Exact last name match gets second priority
        if (aLastName.startsWith(searchTerm) && !bLastName.startsWith(searchTerm)) return -1;
        if (bLastName.startsWith(searchTerm) && !aLastName.startsWith(searchTerm)) return 1;
        
        // Full name match gets third priority
        if (aFullName.startsWith(searchTerm) && !bFullName.startsWith(searchTerm)) return -1;
        if (bFullName.startsWith(searchTerm) && !aFullName.startsWith(searchTerm)) return 1;
        
        // Sort alphabetically as fallback
        return aFullName.localeCompare(bFullName);
      })
      .slice(0, 10); // Increased to 10 suggestions for better usability
  }, [availableManagers, managerSearch]);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      login: "",
      mobilePhone: "",
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
    // Automatically assign groups based on employee type (OKTA group mapping)
    const autoGroups: string[] = [];
    if (data.employeeType) {
      switch (data.employeeType) {
        case "Employee":
          autoGroups.push("MTX-ET-Employee");
          break;
        case "Contractor":
          autoGroups.push("MTX-ET-Contractor");
          break;
        case "Intern":
          autoGroups.push("MTX-ET-Intern");
          break;
        case "Part Time":
          autoGroups.push("MTX-ET-Part_Time");
          break;
      }
    }

    createUserMutation.mutate({
      ...data,
      managerId: selectedManager?.id || undefined,
      groups: [...autoGroups, ...selectedGroups],
    });
  };

  const handleGroupToggle = (groupName: string, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, groupName]);
    } else {
      setSelectedGroups(selectedGroups.filter(g => g !== groupName));
    }
  };

  const handleManagerSelect = (user: User) => {
    setSelectedManager(user);
    setManagerSearch(`${user.firstName} ${user.lastName}`);
    setShowManagerDropdown(false);
  };

  const handleManagerSearchChange = (value: string) => {
    setManagerSearch(value);
    setShowManagerDropdown(value.length > 0);
    if (value === "") {
      setSelectedManager(null);
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedGroups([]);
    setManagerSearch("");
    setSelectedManager(null);
    setShowManagerDropdown(false);
    onClose();
  };

  const availableGroups = [
    "All Employees",
    "Engineering Team",
    "Marketing Team",
    "Sales Team",
    "HR Team",
    "Finance Team",
    "Managers",
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Create New User
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
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

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter email address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter login username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mobilePhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="Enter mobile phone" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Select Department</SelectItem>
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
              name="employeeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Employee Type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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

            <div className="relative">
              <FormLabel className="text-sm font-medium text-gray-700">Manager</FormLabel>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Start typing manager name..."
                  value={managerSearch}
                  onChange={(e) => handleManagerSearchChange(e.target.value)}
                  onFocus={() => setShowManagerDropdown(managerSearch.length > 0)}
                  className="w-full"
                />
                {selectedManager && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                )}
                
                {showManagerDropdown && filteredManagers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredManagers.map((manager) => (
                      <div
                        key={manager.id}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                        onClick={() => handleManagerSelect(manager)}
                      >
                        <div className="font-medium text-sm text-gray-900">
                          {manager.firstName} {manager.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {manager.title} {manager.title && manager.department && "•"} {manager.department}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {showManagerDropdown && managerSearch.length > 0 && filteredManagers.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No managers found matching "{managerSearch}"
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Groups</Label>
              <div className="space-y-2">
                {availableGroups.map((group) => (
                  <div key={group} className="flex items-center space-x-2">
                    <Checkbox
                      id={`group-${group}`}
                      checked={selectedGroups.includes(group)}
                      onCheckedChange={(checked) => handleGroupToggle(group, checked as boolean)}
                    />
                    <Label htmlFor={`group-${group}`} className="text-sm text-gray-700">
                      {group}
                    </Label>
                  </div>
                ))}
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
                    <FormLabel>Send activation email to user</FormLabel>
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
