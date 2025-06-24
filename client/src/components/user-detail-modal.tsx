import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  Shield, 
  Edit3,
  Save,
  X,
  Eye,
  EyeOff
} from "lucide-react";
import type { User as UserType } from "@shared/schema";

interface UserDetailModalProps {
  open: boolean;
  onClose: () => void;
  userId: number | null;
}

export default function UserDetailModal({ open, onClose, userId }: UserDetailModalProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<UserType>>({});

  // Fetch user details
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await fetch(`/api/users/${userId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }
      
      return response.json();
    },
    enabled: open && !!userId,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (updatedData: Partial<UserType>) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}`, updatedData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "User details have been successfully updated",
      });
      setIsEditing(false);
      setEditedUser({});
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate user initials
  const getUserInitials = (user: UserType) => {
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'SUSPENDED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'DEPROVISIONED': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Get employee type badge color
  const getEmployeeTypeColor = (employeeType: string) => {
    switch (employeeType?.toUpperCase()) {
      case 'EMPLOYEE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'CONTRACTOR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'PART_TIME': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'INTERN': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const handleSave = () => {
    updateUserMutation.mutate(editedUser);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser({});
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    try {
      return format(new Date(date), 'MMM dd, yyyy HH:mm');
    } catch {
      return '—';
    }
  };

  if (!user && !isLoading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-xl font-semibold">
            User Details
          </DialogTitle>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : user ? (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              {/* User Header */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-6">
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="bg-blue-600 text-white text-xl">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h2 className="text-2xl font-bold">
                          {user.firstName} {user.lastName}
                        </h2>
                        <Badge className={getStatusBadgeColor(user.status || '')}>
                          {user.status}
                        </Badge>
                        <Badge className={getEmployeeTypeColor(user.employeeType || '')}>
                          {user.employeeType}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{user.title}</p>
                      <p className="text-sm text-muted-foreground">{user.department}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>First Name</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.firstName ?? user.firstName}
                          onChange={(e) => setEditedUser({...editedUser, firstName: e.target.value})}
                        />
                      ) : (
                        <p className="mt-1 text-sm">{user.firstName}</p>
                      )}
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.lastName ?? user.lastName}
                          onChange={(e) => setEditedUser({...editedUser, lastName: e.target.value})}
                        />
                      ) : (
                        <p className="mt-1 text-sm">{user.lastName}</p>
                      )}
                    </div>
                    <div>
                      <Label>Email</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{user.email}</span>
                      </div>
                    </div>
                    <div>
                      <Label>Login</Label>
                      <p className="mt-1 text-sm">{user.login}</p>
                    </div>
                    <div>
                      <Label>Job Title</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.title ?? user.title}
                          onChange={(e) => setEditedUser({...editedUser, title: e.target.value})}
                        />
                      ) : (
                        <p className="mt-1 text-sm">{user.title}</p>
                      )}
                    </div>
                    <div>
                      <Label>Department</Label>
                      {isEditing ? (
                        <Select 
                          value={editedUser.department ?? user.department}
                          onValueChange={(value) => setEditedUser({...editedUser, department: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IT Security">IT Security</SelectItem>
                            <SelectItem value="IT">IT</SelectItem>
                            <SelectItem value="HR">HR</SelectItem>
                            <SelectItem value="Legal">Legal</SelectItem>
                            <SelectItem value="Executive">Executive</SelectItem>
                            <SelectItem value="Engineering">Engineering</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Finance">Finance</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center space-x-2 mt-1">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{user.department}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Manager</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.manager ?? user.manager}
                          onChange={(e) => setEditedUser({...editedUser, manager: e.target.value})}
                        />
                      ) : (
                        <p className="mt-1 text-sm">{user.manager || '—'}</p>
                      )}
                    </div>
                    <div>
                      <Label>Mobile Phone</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.mobilePhone ?? user.mobilePhone}
                          onChange={(e) => setEditedUser({...editedUser, mobilePhone: e.target.value})}
                        />
                      ) : (
                        <div className="flex items-center space-x-2 mt-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{user.mobilePhone || '—'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>User ID</Label>
                      <p className="mt-1 text-sm font-mono">{user.id}</p>
                    </div>
                    <div>
                      <Label>OKTA ID</Label>
                      <p className="mt-1 text-sm font-mono">{user.oktaId || '—'}</p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Badge className={getStatusBadgeColor(user.status || '')}>
                        {user.status}
                      </Badge>
                    </div>
                    <div>
                      <Label>Employee Type</Label>
                      <Badge className={getEmployeeTypeColor(user.employeeType || '')}>
                        {user.employeeType}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Account Created</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(user.created)}</span>
                      </div>
                    </div>
                    <div>
                      <Label>Last Updated</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(user.lastUpdated)}</span>
                      </div>
                    </div>
                    <div>
                      <Label>Last Login</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(user.lastLogin)}</span>
                      </div>
                    </div>
                    <div>
                      <Label>Password Changed</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(user.passwordChanged)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}