import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { X } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const { toast } = useToast();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

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
      groups: selectedGroups,
    });
  };

  const handleGroupToggle = (groupName: string, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, groupName]);
    } else {
      setSelectedGroups(selectedGroups.filter(g => g !== groupName));
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedGroups([]);
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
                        <SelectItem value="">Select Department</SelectItem>
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
