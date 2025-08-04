import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Link, Unlink } from "lucide-react";
import { SelectConfig, FieldKey } from "../types";
import { useToast } from "@/hooks/use-toast";

interface SelectFieldConfigProps {
  config: SelectConfig;
  onUpdate: (newConfig: SelectConfig) => void;
  fieldType: FieldKey;
}

export function SelectFieldConfig({ config, onUpdate, fieldType }: SelectFieldConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [departmentAppMappings, setDepartmentAppMappings] = useState<Record<string, string[]>>({});
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  // Fetch available apps
  const { data: appMappingsData = [] } = useQuery({
    queryKey: ["/api/app-mappings"],
    enabled: fieldType === 'department' && config.linkApps,
  });

  // Fetch department app mappings
  const { data: departmentAppMappingsData = [] } = useQuery({
    queryKey: ["/api/department-app-mappings"],
    enabled: fieldType === 'department' && config.linkApps,
  });

  // Create department app mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (data: { departmentName: string; appName: string }) => {
      const response = await fetch('/api/department-app-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/department-app-mappings"] });
      toast({ title: "App linked to department successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to link app", description: error.message, variant: "destructive" });
    }
  });

  // Delete department app mapping mutation
  const deleteMappingMutation = useMutation({
    mutationFn: async (data: { departmentName: string; appName: string }) => {
      const response = await fetch('/api/department-app-mappings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/department-app-mappings"] });
      toast({ title: "App unlinked from department successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to unlink app", description: error.message, variant: "destructive" });
    }
  });

  // Process department app mappings data
  useEffect(() => {
    if (Array.isArray(departmentAppMappingsData) && departmentAppMappingsData.length > 0) {
      const mappingsByDepartment: Record<string, string[]> = {};
      departmentAppMappingsData.forEach((mapping: any) => {
        if (!mappingsByDepartment[mapping.departmentName]) {
          mappingsByDepartment[mapping.departmentName] = [];
        }
        mappingsByDepartment[mapping.departmentName].push(mapping.appName);
      });
      setDepartmentAppMappings(mappingsByDepartment);
    }
  }, [departmentAppMappingsData]);

  // Get available apps
  const availableApps = Array.isArray(appMappingsData) ? 
    appMappingsData
      .filter((app: any) => app.status === 'active')
      .map((app: any) => app.appName) : [];
  const handleUseListChange = (checked: boolean) => {
    onUpdate({
      ...config,
      useList: checked
    });
  };

  const handleLinkAppsChange = (checked: boolean) => {
    onUpdate({
      ...config,
      linkApps: checked
    });
  };

  const handleLinkApp = (departmentName: string, appName: string) => {
    createMappingMutation.mutate({ departmentName, appName });
  };

  const handleUnlinkApp = (departmentName: string, appName: string) => {
    deleteMappingMutation.mutate({ departmentName, appName });
  };

  const handleOptionChange = (index: number, newValue: string) => {
    const newOptions = [...config.options];
    newOptions[index] = newValue;
    onUpdate({
      ...config,
      options: newOptions
    });
  };

  const addOption = () => {
    onUpdate({
      ...config,
      options: [...config.options, '']
    });
  };

  const removeOption = (index: number) => {
    const newOptions = config.options.filter((_, i) => i !== index);
    onUpdate({
      ...config,
      options: newOptions
    });
  };

  const getDefaultOptions = () => {
    if (fieldType === 'department') {
      return ['HR', 'Finance', 'Engineering', 'Marketing', 'Sales'];
    } else if (fieldType === 'employeeType') {
      return ['Employee', 'Contractor', 'Consultant', 'Intern', 'Service Account'];
    }
    return [];
  };

  const loadDefaultOptions = () => {
    onUpdate({
      ...config,
      options: getDefaultOptions()
    });
  };

  return (
    <div className="space-y-4">
      {/* Use Predefined List */}
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="use-list"
          checked={config.useList}
          onCheckedChange={handleUseListChange}
        />
        <Label htmlFor="use-list" className="text-sm">
          Use predefined list instead of free text input
        </Label>
      </div>

      {config.useList && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {fieldType === 'department' ? 'Department' : 'Employee Type'} Options
            </Label>
            {config.options.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadDefaultOptions}
                className="h-7 text-xs"
              >
                Load Defaults
              </Button>
            )}
          </div>
          
          {config.options.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-w-64">
              {config.options.map((option, index) => (
                <div key={index} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 text-sm border-0 bg-transparent focus:ring-0 p-0"
                    placeholder={fieldType === 'department' ? 'Department name' : 'Employee type'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(index)}
                    className="h-6 w-6 p-0 ml-2 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addOption}
                  className="h-6 w-6 p-0 mr-2 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  <Plus className="w-3 h-3" />
                </Button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Add {fieldType === 'department' ? 'department' : 'employee type'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              No options configured. Users will see a free text input.
            </div>
          )}
        </div>
      )}

      {!config.useList && (
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
          Users will see a free text input field for this option.
        </div>
      )}

      {/* Link Apps Section - Only for Department field */}
      {fieldType === 'department' && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="link-apps"
              checked={config.linkApps || false}
              onCheckedChange={handleLinkAppsChange}
            />
            <Label htmlFor="link-apps" className="text-sm font-medium">
              Link Apps to Departments
            </Label>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            When enabled, specific apps will be automatically assigned when a department is selected.
          </div>

          {config.linkApps && config.useList && config.options.length > 0 && (
            <div className="space-y-4">
              {/* Two-column layout: Department Selection + App Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column: Department Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Department to Configure</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="Choose a department..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                      {config.options.map((department) => (
                        <SelectItem key={department} value={department} className="bg-white dark:bg-gray-800">
                          <div className="flex items-center justify-between w-full">
                            <span>{department}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              {departmentAppMappings[department]?.length || 0} apps
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Right Column: App Selection (CreateUserModal style) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Apps</Label>
                  {selectedDepartment ? (
                    <>
                      {/* Add app dropdown at top */}
                      <Select
                        value=""
                        onValueChange={(appName) => handleLinkApp(selectedDepartment, appName)}
                        disabled={createMappingMutation.isPending}
                      >
                        <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          <div className="flex items-center">
                            <span className="text-blue-500 mr-2">+</span>
                            <SelectValue placeholder="Add app" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          {availableApps
                            .filter((app: string) => !departmentAppMappings[selectedDepartment]?.includes(app))
                            .map((app: string) => (
                              <SelectItem key={app} value={app} className="bg-white dark:bg-gray-800">
                                {app}
                              </SelectItem>
                            ))}
                          {availableApps.filter((app: string) => !departmentAppMappings[selectedDepartment]?.includes(app)).length === 0 && (
                            <SelectItem value="no-apps" disabled className="text-gray-500">
                              All apps already linked
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      {/* Selected apps using exact CreateUserModal format */}
                      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-w-48">
                        {departmentAppMappings[selectedDepartment] && departmentAppMappings[selectedDepartment].length > 0 ? (
                          departmentAppMappings[selectedDepartment].map((appName, index) => (
                            <div key={index} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <span className="flex-1 text-gray-900 dark:text-gray-100 text-sm uppercase">
                                {appName}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlinkApp(selectedDepartment, appName)}
                                className="h-4 w-4 p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-1"
                                disabled={deleteMappingMutation.isPending}
                              >
                                {'×'}
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center px-3 py-4 text-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400 w-full">No apps linked</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      Select a department to configure apps
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {config.linkApps && (!config.useList || config.options.length === 0) && (
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              Enable "Use predefined list" and add department options to configure app linking.
            </div>
          )}
        </div>
      )}
    </div>
  );
}