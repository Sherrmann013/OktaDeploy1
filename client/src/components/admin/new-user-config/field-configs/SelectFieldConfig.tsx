import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Link, Unlink } from "lucide-react";
import { SelectConfig, FieldKey } from "../types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SelectFieldConfigProps {
  config: SelectConfig;
  onUpdate: (newConfig: SelectConfig) => void;
  fieldType: FieldKey;
  setDepartmentAppSaveFunction?: (fn: (() => Promise<boolean>) | null) => void;
  setEmployeeTypeAppSaveFunction?: (fn: (() => Promise<boolean>) | null) => void;
  setDepartmentGroupSaveFunction?: (fn: (() => Promise<boolean>) | null) => void;
  setEmployeeTypeGroupSaveFunction?: (fn: (() => Promise<boolean>) | null) => void;
  groupsFieldConfig?: any; // Groups field configuration to access group options
}

export function SelectFieldConfig({ config, onUpdate, fieldType, setDepartmentAppSaveFunction, setEmployeeTypeAppSaveFunction, setDepartmentGroupSaveFunction, setEmployeeTypeGroupSaveFunction, groupsFieldConfig }: SelectFieldConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  // Detect current client context from URL
  const currentClientId = location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1;

  // Fetch client information for generating group names - CLIENT-AWARE
  const { data: clientInfo } = useQuery({
    queryKey: [`/api/clients/${currentClientId}`],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${currentClientId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch client information');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
  const [departmentAppMappings, setDepartmentAppMappings] = useState<Record<string, string[]>>({});
  const [localDepartmentAppMappings, setLocalDepartmentAppMappings] = useState<Record<string, string[]>>({});
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [employeeTypeAppMappings, setEmployeeTypeAppMappings] = useState<Record<string, string[]>>({});
  const [localEmployeeTypeAppMappings, setLocalEmployeeTypeAppMappings] = useState<Record<string, string[]>>({});
  const [selectedEmployeeType, setSelectedEmployeeType] = useState<string>('');
  const [hasDepartmentUnsavedChanges, setHasDepartmentUnsavedChanges] = useState(false);
  const [hasEmployeeTypeUnsavedChanges, setHasEmployeeTypeUnsavedChanges] = useState(false);
  const [departmentSaveInProgress, setDepartmentSaveInProgress] = useState(false);
  const [employeeTypeSaveInProgress, setEmployeeTypeSaveInProgress] = useState(false);

  // Group mapping state
  const [departmentGroupMappings, setDepartmentGroupMappings] = useState<Record<string, string[]>>({});
  const [localDepartmentGroupMappings, setLocalDepartmentGroupMappings] = useState<Record<string, string[]>>({});
  const [employeeTypeGroupMappings, setEmployeeTypeGroupMappings] = useState<Record<string, string[]>>({});
  const [localEmployeeTypeGroupMappings, setLocalEmployeeTypeGroupMappings] = useState<Record<string, string[]>>({});
  const [hasDepartmentGroupUnsavedChanges, setHasDepartmentGroupUnsavedChanges] = useState(false);
  const [hasEmployeeTypeGroupUnsavedChanges, setHasEmployeeTypeGroupUnsavedChanges] = useState(false);
  const [departmentGroupSaveInProgress, setDepartmentGroupSaveInProgress] = useState(false);
  const [employeeTypeGroupSaveInProgress, setEmployeeTypeGroupSaveInProgress] = useState(false);

  // Employee type group creation dialog state
  const [showEmployeeTypeGroupDialog, setShowEmployeeTypeGroupDialog] = useState(false);
  const [pendingEmployeeTypeName, setPendingEmployeeTypeName] = useState('');
  const [employeeTypeDisplayName, setEmployeeTypeDisplayName] = useState('');
  const [employeeTypeGroupSuffix, setEmployeeTypeGroupSuffix] = useState('');



  // Fetch available apps - CLIENT-AWARE
  const { data: appMappingsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/app-mappings`],
    enabled: (fieldType === 'department' || fieldType === 'employeeType') && config.linkApps,
  });

  // Fetch department app mappings - CLIENT-AWARE
  const { data: departmentAppMappingsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/department-app-mappings`],
    enabled: fieldType === 'department' && config.linkApps,
  });

  // Fetch employee type app mappings - CLIENT-AWARE
  const { data: employeeTypeAppMappingsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/employee-type-app-mappings`],
    enabled: fieldType === 'employeeType' && config.linkApps,
  });

  // Fetch department group mappings - CLIENT-AWARE
  const { data: departmentGroupMappingsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/department-group-mappings`],
    enabled: fieldType === 'department' && config.linkGroups,
  });

  // Fetch employee type group mappings - CLIENT-AWARE
  const { data: employeeTypeGroupMappingsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/employee-type-group-mappings`],
    enabled: fieldType === 'employeeType' && config.linkGroups,
  });

  // Local functions for managing department-app mappings (no auto-save)
  const handleLinkApp = (department: string, appName: string) => {
    setLocalDepartmentAppMappings(prev => {
      const updated = { ...prev };
      if (!updated[department]) {
        updated[department] = [];
      }
      if (!updated[department].includes(appName)) {
        updated[department] = [...updated[department], appName];
      }
      return updated;
    });
    setHasDepartmentUnsavedChanges(true);
  };

  const handleUnlinkApp = (department: string, appName: string) => {
    setLocalDepartmentAppMappings(prev => {
      const updated = { ...prev };
      if (updated[department]) {
        updated[department] = updated[department].filter(app => app !== appName);
        if (updated[department].length === 0) {
          delete updated[department];
        }
      }
      return updated;
    });
    setHasDepartmentUnsavedChanges(true);
  };

  // Local functions for managing employee type-app mappings (no auto-save)
  const handleLinkEmployeeTypeApp = (employeeType: string, appName: string) => {
    setLocalEmployeeTypeAppMappings(prev => {
      const updated = { ...prev };
      if (!updated[employeeType]) {
        updated[employeeType] = [];
      }
      if (!updated[employeeType].includes(appName)) {
        updated[employeeType] = [...updated[employeeType], appName];
      }
      return updated;
    });
    setHasEmployeeTypeUnsavedChanges(true);
  };

  const handleUnlinkEmployeeTypeApp = (employeeType: string, appName: string) => {
    setLocalEmployeeTypeAppMappings(prev => {
      const updated = { ...prev };
      if (updated[employeeType]) {
        updated[employeeType] = updated[employeeType].filter(app => app !== appName);
        if (updated[employeeType].length === 0) {
          delete updated[employeeType];
        }
      }
      return updated;
    });
    setHasEmployeeTypeUnsavedChanges(true);
  };

  // Department group management functions
  const handleLinkDepartmentGroup = (department: string, groupName: string) => {
    setLocalDepartmentGroupMappings(prev => {
      const updated = { ...prev };
      if (!updated[department]) {
        updated[department] = [];
      }
      if (!updated[department].includes(groupName)) {
        updated[department] = [...updated[department], groupName];
      }
      return updated;
    });
    setHasDepartmentGroupUnsavedChanges(true);
  };

  const handleUnlinkDepartmentGroup = (department: string, groupName: string) => {
    setLocalDepartmentGroupMappings(prev => {
      const updated = { ...prev };
      if (updated[department]) {
        updated[department] = updated[department].filter(group => group !== groupName);
        if (updated[department].length === 0) {
          delete updated[department];
        }
      }
      return updated;
    });
    setHasDepartmentGroupUnsavedChanges(true);
  };

  // Employee type group management functions
  const handleLinkEmployeeTypeGroup = (employeeType: string, groupName: string) => {
    setLocalEmployeeTypeGroupMappings(prev => {
      const updated = { ...prev };
      if (!updated[employeeType]) {
        updated[employeeType] = [];
      }
      if (!updated[employeeType].includes(groupName)) {
        updated[employeeType] = [...updated[employeeType], groupName];
      }
      return updated;
    });
    setHasEmployeeTypeGroupUnsavedChanges(true);
  };

  const handleUnlinkEmployeeTypeGroup = (employeeType: string, groupName: string) => {
    setLocalEmployeeTypeGroupMappings(prev => {
      const updated = { ...prev };
      if (updated[employeeType]) {
        updated[employeeType] = updated[employeeType].filter(group => group !== groupName);
        if (updated[employeeType].length === 0) {
          delete updated[employeeType];
        }
      }
      return updated;
    });
    setHasEmployeeTypeGroupUnsavedChanges(true);
  };

  // Save department app mappings to database (MANUAL SAVE ONLY)
  const saveDepartmentAppMappings = useCallback(async (manualSave = false) => {
    // Prevent auto-save - only allow manual saves
    if (!manualSave) {
      console.log('⚠️ Auto-save blocked - department mappings require manual save');
      return false;
    }
    
    if (departmentSaveInProgress) return false;
    setDepartmentSaveInProgress(true);
    
    try {
      // Calculate changes needed
      const currentMappings = departmentAppMappings;
      const newMappings = localDepartmentAppMappings;
      
      // Remove mappings that no longer exist
      for (const department in currentMappings) {
        for (const app of currentMappings[department]) {
          if (!newMappings[department]?.includes(app)) {
            await fetch(`/api/client/${currentClientId}/department-app-mappings`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ departmentName: department, appName: app })
            });
          }
        }
      }
      
      // Add new mappings (with duplicate prevention)
      for (const department in newMappings) {
        for (const app of newMappings[department]) {
          if (!currentMappings[department]?.includes(app)) {
            const response = await fetch(`/api/client/${currentClientId}/department-app-mappings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ departmentName: department, appName: app })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              if (errorData.error !== "Mapping already exists") {
                throw new Error(`Failed to add mapping: ${errorData.error}`);
              }
              // If mapping already exists, just continue (avoid throwing error)
            }
          }
        }
      }
      
      // Update saved state and clear unsaved changes
      setDepartmentAppMappings(localDepartmentAppMappings);
      setHasDepartmentUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/department-app-mappings`] });
      
      return true;
    } catch (error) {
      return false;
    } finally {
      setDepartmentSaveInProgress(false);
    }
  }, [departmentAppMappings, localDepartmentAppMappings, currentClientId, queryClient]);

  // Save employee type app mappings to database
  const saveEmployeeTypeAppMappings = useCallback(async (manualSave = false) => {
    // Prevent auto-save - only allow manual saves
    if (!manualSave) {
      console.log('⚠️ Auto-save blocked - employee type mappings require manual save');
      return false;
    }
    
    if (employeeTypeSaveInProgress) return false;
    setEmployeeTypeSaveInProgress(true);
    
    try {
      // Calculate changes needed
      const currentMappings = employeeTypeAppMappings;
      const newMappings = localEmployeeTypeAppMappings;
      
      // Remove mappings that no longer exist
      for (const employeeType in currentMappings) {
        for (const app of currentMappings[employeeType]) {
          if (!newMappings[employeeType]?.includes(app)) {
            await fetch(`/api/client/${currentClientId}/employee-type-app-mappings`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ employeeType: employeeType, appName: app })
            });
          }
        }
      }
      
      // Add new mappings (with duplicate prevention)
      for (const employeeType in newMappings) {
        for (const app of newMappings[employeeType]) {
          if (!currentMappings[employeeType]?.includes(app)) {
            const response = await fetch(`/api/client/${currentClientId}/employee-type-app-mappings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ employeeType: employeeType, appName: app })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              if (errorData.error !== "Mapping already exists") {
                throw new Error(`Failed to add mapping: ${errorData.error}`);
              }
              // If mapping already exists, just continue (avoid throwing error)
            }
          }
        }
      }
      
      // Update saved state and clear unsaved changes
      setEmployeeTypeAppMappings(localEmployeeTypeAppMappings);
      setHasEmployeeTypeUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/employee-type-app-mappings`] });
      
      return true;
    } catch (error) {
      return false;
    } finally {
      setEmployeeTypeSaveInProgress(false);
    }
  }, [employeeTypeAppMappings, localEmployeeTypeAppMappings, currentClientId, queryClient]);

  // Helper function to calculate differences for department mappings
  const calculateDifferences = (currentMappings: Record<string, string[]>, newMappings: Record<string, string[]>) => {
    const differences: { departmentName: string; added: string[]; removed: string[] }[] = [];
    
    // Get all unique department names
    const allDepartments = Array.from(new Set([...Object.keys(currentMappings), ...Object.keys(newMappings)]));
    
    for (const departmentName of allDepartments) {
      const current = currentMappings[departmentName] || [];
      const updated = newMappings[departmentName] || [];
      
      const added = updated.filter(group => !current.includes(group));
      const removed = current.filter(group => !updated.includes(group));
      
      if (added.length > 0 || removed.length > 0) {
        differences.push({ departmentName, added, removed });
      }
    }
    
    return differences;
  };

  // Helper function to calculate differences for employee type mappings
  const calculateEmployeeTypeDifferences = (currentMappings: Record<string, string[]>, newMappings: Record<string, string[]>) => {
    const differences: { employeeType: string; added: string[]; removed: string[] }[] = [];
    
    // Get all unique employee types
    const allEmployeeTypes = Array.from(new Set([...Object.keys(currentMappings), ...Object.keys(newMappings)]));
    
    for (const employeeType of allEmployeeTypes) {
      const current = currentMappings[employeeType] || [];
      const updated = newMappings[employeeType] || [];
      
      const added = updated.filter(group => !current.includes(group));
      const removed = current.filter(group => !updated.includes(group));
      
      if (added.length > 0 || removed.length > 0) {
        differences.push({ employeeType, added, removed });
      }
    }
    
    return differences;
  };

  // Department group save function
  const saveDepartmentGroupMappings = async (): Promise<boolean> => {
    if (!hasDepartmentGroupUnsavedChanges) return true;
    
    setDepartmentGroupSaveInProgress(true);
    try {
      // Calculate differences
      const differences = calculateDifferences(departmentGroupMappings, localDepartmentGroupMappings);
      
      // Apply changes
      for (const { departmentName, added, removed } of differences) {
        for (const groupName of added) {
          const response = await fetch(`/api/client/${currentClientId}/department-group-mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ departmentName, groupName })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            if (errorData.error !== "Mapping already exists") {
              // Don't throw error - just continue with next mapping
            }
            // If mapping already exists, just continue (avoid throwing error)
          }
        }
        
        for (const groupName of removed) {
          const response = await fetch(`/api/client/${currentClientId}/department-group-mappings`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ departmentName, groupName })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            // Don't throw error - just continue with next mapping
          }
        }
      }
      
      setDepartmentGroupMappings(localDepartmentGroupMappings);
      setHasDepartmentGroupUnsavedChanges(false);
      await queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/department-group-mappings`] });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save department group mappings",
        variant: "destructive"
      });
      return false;
    } finally {
      setDepartmentGroupSaveInProgress(false);
    }
  };

  // Employee type group save function
  const saveEmployeeTypeGroupMappings = async (): Promise<boolean> => {
    if (!hasEmployeeTypeGroupUnsavedChanges) return true;
    
    setEmployeeTypeGroupSaveInProgress(true);
    try {
      // Calculate differences
      const differences = calculateEmployeeTypeDifferences(employeeTypeGroupMappings, localEmployeeTypeGroupMappings);
      
      // Apply changes
      for (const { employeeType, added, removed } of differences) {
        for (const groupName of added) {
          const response = await fetch(`/api/client/${currentClientId}/employee-type-group-mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ employeeType, groupName })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            if (errorData.error !== "Mapping already exists") {
              // Silently continue if mapping creation fails - don't throw error to avoid popup
              // Don't throw error - just continue with next mapping
            }
            // If mapping already exists, just continue (avoid throwing error)
          }
        }
        
        for (const groupName of removed) {
          const response = await fetch(`/api/client/${currentClientId}/employee-type-group-mappings`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ employeeType, groupName })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            // Don't throw error - just continue with next mapping
          }
        }
      }
      
      setEmployeeTypeGroupMappings(localEmployeeTypeGroupMappings);
      setHasEmployeeTypeGroupUnsavedChanges(false);
      await queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/employee-type-group-mappings`] });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save employee type group mappings",
        variant: "destructive"
      });
      return false;
    } finally {
      setEmployeeTypeGroupSaveInProgress(false);
    }
  };

  // Register save function with parent when there are unsaved changes
  useEffect(() => {
    if (fieldType === 'department' && setDepartmentAppSaveFunction) {
      if (hasDepartmentUnsavedChanges) {
        // Register save function that requires manual trigger
        setDepartmentAppSaveFunction(() => saveDepartmentAppMappings(true));
      } else {
        setDepartmentAppSaveFunction(null);
      }
    }
  }, [hasDepartmentUnsavedChanges, saveDepartmentAppMappings, fieldType, setDepartmentAppSaveFunction]);

  useEffect(() => {
    if (fieldType === 'employeeType' && setEmployeeTypeAppSaveFunction) {
      if (hasEmployeeTypeUnsavedChanges) {
        // Register save function that requires manual trigger
        setEmployeeTypeAppSaveFunction(() => saveEmployeeTypeAppMappings(true));
      } else {
        setEmployeeTypeAppSaveFunction(null);
      }
    }
  }, [hasEmployeeTypeUnsavedChanges, saveEmployeeTypeAppMappings, fieldType, setEmployeeTypeAppSaveFunction]);

  // Hook save functions for group mappings
  useEffect(() => {
    if (fieldType === 'department' && setDepartmentGroupSaveFunction) {
      if (hasDepartmentGroupUnsavedChanges) {
        setDepartmentGroupSaveFunction(() => saveDepartmentGroupMappings());
      } else {
        setDepartmentGroupSaveFunction(null);
      }
    }
  }, [hasDepartmentGroupUnsavedChanges, saveDepartmentGroupMappings, fieldType, setDepartmentGroupSaveFunction]);

  useEffect(() => {
    if (fieldType === 'employeeType' && setEmployeeTypeGroupSaveFunction) {
      if (hasEmployeeTypeGroupUnsavedChanges) {
        setEmployeeTypeGroupSaveFunction(() => saveEmployeeTypeGroupMappings());
      } else {
        setEmployeeTypeGroupSaveFunction(null);
      }
    }
  }, [hasEmployeeTypeGroupUnsavedChanges, saveEmployeeTypeGroupMappings, fieldType, setEmployeeTypeGroupSaveFunction]);

  // Process department app mappings data - set both saved and local state
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
      setLocalDepartmentAppMappings(mappingsByDepartment);
      setHasDepartmentUnsavedChanges(false);
    }
  }, [departmentAppMappingsData]);

  // Process employee type app mappings data - set both saved and local state
  useEffect(() => {
    if (Array.isArray(employeeTypeAppMappingsData) && employeeTypeAppMappingsData.length > 0) {
      const mappingsByEmployeeType: Record<string, string[]> = {};
      employeeTypeAppMappingsData.forEach((mapping: any) => {
        if (!mappingsByEmployeeType[mapping.employeeType]) {
          mappingsByEmployeeType[mapping.employeeType] = [];
        }
        mappingsByEmployeeType[mapping.employeeType].push(mapping.appName);
      });
      setEmployeeTypeAppMappings(mappingsByEmployeeType);
      setLocalEmployeeTypeAppMappings(mappingsByEmployeeType);
      setHasEmployeeTypeUnsavedChanges(false);
    }
  }, [employeeTypeAppMappingsData]);

  // Process department group mappings data - set both saved and local state
  useEffect(() => {
    if (Array.isArray(departmentGroupMappingsData) && departmentGroupMappingsData.length > 0) {
      const mappingsByDepartment: Record<string, string[]> = {};
      departmentGroupMappingsData.forEach((mapping: any) => {
        if (!mappingsByDepartment[mapping.departmentName]) {
          mappingsByDepartment[mapping.departmentName] = [];
        }
        mappingsByDepartment[mapping.departmentName].push(mapping.groupName);
      });
      setDepartmentGroupMappings(mappingsByDepartment);
      setLocalDepartmentGroupMappings(mappingsByDepartment);
      setHasDepartmentGroupUnsavedChanges(false);
    }
  }, [departmentGroupMappingsData]);

  // Process employee type group mappings data - set both saved and local state
  useEffect(() => {
    if (Array.isArray(employeeTypeGroupMappingsData) && employeeTypeGroupMappingsData.length > 0) {
      const mappingsByEmployeeType: Record<string, string[]> = {};
      employeeTypeGroupMappingsData.forEach((mapping: any) => {
        if (!mappingsByEmployeeType[mapping.employeeType]) {
          mappingsByEmployeeType[mapping.employeeType] = [];
        }
        mappingsByEmployeeType[mapping.employeeType].push(mapping.groupName);
      });
      setEmployeeTypeGroupMappings(mappingsByEmployeeType);
      setLocalEmployeeTypeGroupMappings(mappingsByEmployeeType);
      setHasEmployeeTypeGroupUnsavedChanges(false);
    }
  }, [employeeTypeGroupMappingsData]);

  // Get available apps
  const availableApps = Array.isArray(appMappingsData) ? 
    appMappingsData
      .filter((app: any) => app.status === 'active')
      .map((app: any) => app.appName) : [];

  // Get available groups from the Groups field configuration, not from current field config
  const availableGroups = groupsFieldConfig?.options || [];
  
  // Helper function to derive company initials from client name
  const getCompanyInitials = (clientName: string): string => {
    if (!clientName) return 'CL'; // Default fallback
    
    // Use client's company initials if available, otherwise derive from name
    if (clientInfo?.companyInitials) {
      return clientInfo.companyInitials.toUpperCase();
    }
    
    // Split by spaces and capital letters, take first letter of each part
    const words = clientName.split(/[\s\-_]+/).filter(word => word.length > 0);
    if (words.length > 1) {
      return words.map(word => word.charAt(0).toUpperCase()).join('');
    } else {
      // For single words, take first letter and first uppercase letter after it
      const matches = clientName.match(/[A-Z]/g);
      if (matches && matches.length >= 2) {
        return matches.slice(0, 2).join('');
      } else {
        return clientName.substring(0, 2).toUpperCase();
      }
    }
  };
  
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

  const handleLinkGroupsChange = (checked: boolean) => {
    onUpdate({
      ...config,
      linkGroups: checked
    });
  };



  const handleOptionChange = async (index: number, newValue: string) => {
    console.log('🟡 handleOptionChange called:', { index, newValue, fieldType });
    const oldValue = config.options[index];
    const newOptions = [...config.options];
    newOptions[index] = newValue;
    
    console.log('🟡 About to call onUpdate - this will trigger parent state change');
    // Update the config first
    onUpdate({
      ...config,
      options: newOptions
    });
    console.log('🟡 onUpdate called successfully');

    // No automatic dialog anymore - users will use inline configuration
  };

  // Create group mutation for employee types
  const createGroupMutation = useMutation({
    mutationFn: async (groupName: string) => {
      const response = await apiRequest("POST", `/api/client/${currentClientId}/groups`, {
        name: groupName
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create group");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate layout settings cache to refresh groups field configuration
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/layout-settings`] });
      // Also invalidate any groups-related queries
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/groups`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create group: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Helper function to create group for employee type with user input
  const createEmployeeTypeGroupWithDialog = async (): Promise<void> => {
    if (!clientInfo?.name || !pendingEmployeeTypeName.trim() || !employeeTypeGroupSuffix.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    const initials = getCompanyInitials(clientInfo.name);
    const groupName = `${initials}-ET-${employeeTypeGroupSuffix.toUpperCase().replace(/\s+/g, '')}`;
    
    try {
      await createGroupMutation.mutateAsync(groupName);
      
      // Auto-map the employee type to the newly created group
      setLocalEmployeeTypeGroupMappings(prev => ({
        ...prev,
        [pendingEmployeeTypeName]: [...(prev[pendingEmployeeTypeName] || []), groupName]
      }));
      setHasEmployeeTypeGroupUnsavedChanges(true);
      
      toast({
        title: "Success",
        description: `Group '${groupName}' created and linked to employee type '${employeeTypeDisplayName}'`,
      });
      
      // Close dialog and reset state
      setShowEmployeeTypeGroupDialog(false);
      setPendingEmployeeTypeName('');
      setEmployeeTypeDisplayName('');
      setEmployeeTypeGroupSuffix('');
      
    } catch (error) {
      console.error('Failed to create employee type group:', error);
    }
  };

  // Handle dialog cancellation
  const handleEmployeeTypeGroupDialogCancel = () => {
    setShowEmployeeTypeGroupDialog(false);
    setPendingEmployeeTypeName('');
    setEmployeeTypeDisplayName('');
    setEmployeeTypeGroupSuffix('');
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
          <Label className="text-sm font-medium">
            {fieldType === 'department' ? 'Department' : 'Employee Type'} Options
          </Label>
          
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-w-64">
            {config.options.map((option, index) => (
              <div key={index}>
                <div className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
        </div>
      )}

      {!config.useList && (
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
          Users will see a free text input field for this option.
        </div>
      )}

      {/* Link Apps Section - Only for Department field */}
      {(fieldType === 'department' || fieldType === 'employeeType') && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="link-apps"
              checked={config.linkApps || false}
              onCheckedChange={handleLinkAppsChange}
            />
            <Label htmlFor="link-apps" className="text-sm font-medium">
              {fieldType === 'department' ? 'Link Apps to Departments' : 'Link Apps to Employee Types'}
            </Label>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {fieldType === 'department' 
              ? 'When enabled, specific apps will be automatically assigned when a department is selected.'
              : 'When enabled, specific apps will be automatically assigned when an employee type is selected.'}
          </div>

          {config.linkApps && config.useList && config.options.length > 0 && (
            <div className="space-y-4">
              {/* Two-column layout: Department Selection + App Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column: Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {fieldType === 'department' ? 'Select Department to Configure' : 'Select Employee Type to Configure'}
                  </Label>
                  <Select 
                    value={fieldType === 'department' ? selectedDepartment : selectedEmployeeType} 
                    onValueChange={fieldType === 'department' ? setSelectedDepartment : setSelectedEmployeeType}
                  >
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder={fieldType === 'department' ? 'Choose a department...' : 'Choose an employee type...'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                      {config.options.filter(option => option && option.trim() !== '').map((option) => (
                        <SelectItem key={option} value={option} className="bg-white dark:bg-gray-800">
                          <div className="flex items-center justify-between w-full">
                            <span>{option}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              {fieldType === 'department' 
                                ? (localDepartmentAppMappings[option]?.length || 0) 
                                : (localEmployeeTypeAppMappings[option]?.length || 0)} apps
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
                  {(fieldType === 'department' ? selectedDepartment : selectedEmployeeType) ? (
                    <>
                      {/* Add app dropdown at top */}
                      <Select
                        onValueChange={(appName) => {
                          if (fieldType === 'department') {
                            handleLinkApp(selectedDepartment, appName);
                          } else {
                            handleLinkEmployeeTypeApp(selectedEmployeeType, appName);
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
                            .filter((app: string) => {
                              if (!app || app.trim() === '') return false;
                              if (fieldType === 'department') {
                                return !localDepartmentAppMappings[selectedDepartment]?.includes(app);
                              } else {
                                return !localEmployeeTypeAppMappings[selectedEmployeeType]?.includes(app);
                              }
                            })
                            .map((app: string) => (
                              <SelectItem key={app} value={app} className="bg-white dark:bg-gray-800">
                                {app}
                              </SelectItem>
                            ))}
                          {availableApps.filter((app: string) => {
                            if (fieldType === 'department') {
                              return !localDepartmentAppMappings[selectedDepartment]?.includes(app);
                            } else {
                              return !localEmployeeTypeAppMappings[selectedEmployeeType]?.includes(app);
                            }
                          }).length === 0 && (
                            <SelectItem value="no-apps" disabled className="text-gray-500">
                              All apps already linked
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      {/* Selected apps using exact CreateUserModal format */}
                      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-w-48">
                        {(() => {
                          const currentSelection = fieldType === 'department' ? selectedDepartment : selectedEmployeeType;
                          const currentMappings = fieldType === 'department' 
                            ? localDepartmentAppMappings[currentSelection] 
                            : localEmployeeTypeAppMappings[currentSelection];
                          
                          return currentMappings && currentMappings.length > 0 ? (
                            currentMappings.map((appName, index) => (
                              <div key={index} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <span className="flex-1 text-gray-900 dark:text-gray-100 text-sm uppercase">
                                  {appName}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    console.log('🚨 UNLINK APP BUTTON CLICKED - WHO CLICKED THIS?', { fieldType, appName });
                                    console.trace('🚨 UNLINK APP STACK TRACE');
                                    if (fieldType === 'department') {
                                      handleUnlinkApp(selectedDepartment, appName);
                                    } else {
                                      handleUnlinkEmployeeTypeApp(selectedEmployeeType, appName);
                                    }
                                  }}
                                  className="h-4 w-4 p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-1"
                                >
                                  {'×'}
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center px-3 py-4 text-center">
                              <span className="text-sm text-gray-500 dark:text-gray-400 w-full">No apps linked</span>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      {fieldType === 'department' ? 'Select a department to configure apps' : 'Select an employee type to configure apps'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {config.linkApps && (!config.useList || config.options.length === 0) && (
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              {fieldType === 'department' 
                ? 'Enable "Use predefined list" and add department options to configure app linking.'
                : 'Enable "Use predefined list" and add employee type options to configure app linking.'}
            </div>
          )}
        </div>
      )}

      {/* Link Email Groups Section - For both Department and Employee Type fields */}
      {(fieldType === 'department' || fieldType === 'employeeType') && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="link-groups"
              checked={config.linkGroups || false}
              onCheckedChange={handleLinkGroupsChange}
            />
            <Label htmlFor="link-groups" className="text-sm font-medium">
              {fieldType === 'department' ? 'Link Email Groups to Departments' : 'Link Email Groups to Employee Types'}
            </Label>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {fieldType === 'department' 
              ? 'When enabled, specific email groups will be automatically assigned when a department is selected.'
              : 'When enabled, specific email groups will be automatically assigned when an employee type is selected (in addition to automatic OKTA security groups).'}
          </div>

          {config.linkGroups && config.useList && config.options.length > 0 && (
            <div className="space-y-4">
              {/* Email Group Configuration for Department/Employee Type */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column: Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {fieldType === 'department' ? 'Select Department to Configure' : 'Select Employee Type to Configure'}
                  </Label>
                  <Select 
                    value={fieldType === 'department' ? selectedDepartment : selectedEmployeeType} 
                    onValueChange={fieldType === 'department' ? setSelectedDepartment : setSelectedEmployeeType}
                  >
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder={fieldType === 'department' ? 'Choose a department...' : 'Choose an employee type...'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                      {config.options.filter(option => option && option.trim() !== '').map((option) => (
                        <SelectItem key={option} value={option} className="bg-white dark:bg-gray-800">
                          <div className="flex items-center justify-between w-full">
                            <span>{option}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              {fieldType === 'department' 
                                ? (localDepartmentGroupMappings[option]?.length || 0) 
                                : (localEmployeeTypeGroupMappings[option]?.length || 0)} email groups
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Right Column: Email Group Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Email Groups</Label>
                  {(fieldType === 'department' ? selectedDepartment : selectedEmployeeType) ? (
                    <>
                      {/* Add group dropdown */}
                      <Select
                        onValueChange={(groupName) => {
                          if (fieldType === 'department') {
                            handleLinkDepartmentGroup(selectedDepartment, groupName);
                          } else {
                            handleLinkEmployeeTypeGroup(selectedEmployeeType, groupName);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          <div className="flex items-center">
                            <span className="text-blue-500 mr-2">+</span>
                            <SelectValue placeholder="Add email group" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          {availableGroups
                            .filter((group: string) => {
                              if (!group || group.trim() === '') return false;
                              if (fieldType === 'department') {
                                return !localDepartmentGroupMappings[selectedDepartment]?.includes(group);
                              } else {
                                return !localEmployeeTypeGroupMappings[selectedEmployeeType]?.includes(group);
                              }
                            })
                            .map((group: string) => (
                              <SelectItem key={group} value={group} className="bg-white dark:bg-gray-800">
                                {group}
                              </SelectItem>
                            ))}
                          {availableGroups.filter((group: string) => {
                            if (fieldType === 'department') {
                              return !localDepartmentGroupMappings[selectedDepartment]?.includes(group);
                            } else {
                              return !localEmployeeTypeGroupMappings[selectedEmployeeType]?.includes(group);
                            }
                          }).length === 0 && (
                            <SelectItem value="no-groups" disabled className="text-gray-500">
                              All email groups already linked
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      {/* Selected email groups */}
                      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-w-48">
                        {(() => {
                          const currentSelection = fieldType === 'department' ? selectedDepartment : selectedEmployeeType;
                          const currentMappings = fieldType === 'department' 
                            ? localDepartmentGroupMappings[currentSelection] 
                            : localEmployeeTypeGroupMappings[currentSelection];
                          
                          return currentMappings && currentMappings.length > 0 ? (
                            currentMappings.map((groupName, index) => (
                              <div key={index} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <span className="flex-1 text-gray-900 dark:text-gray-100 text-sm uppercase">
                                  {groupName}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    console.log('🚨 UNLINK GROUP BUTTON CLICKED - WHO CLICKED THIS?', { fieldType, groupName });
                                    console.trace('🚨 UNLINK GROUP STACK TRACE');
                                    if (fieldType === 'department') {
                                      handleUnlinkDepartmentGroup(selectedDepartment, groupName);
                                    } else {
                                      handleUnlinkEmployeeTypeGroup(selectedEmployeeType, groupName);
                                    }
                                  }}
                                  className="h-4 w-4 p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-1"
                                >
                                  {'×'}
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center px-3 py-4 text-center">
                              <span className="text-sm text-gray-500 dark:text-gray-400 w-full">No email groups linked</span>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      {fieldType === 'department' ? 'Select a department to configure email groups' : 'Select an employee type to configure email groups'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {config.linkGroups && (!config.useList || config.options.length === 0) && (
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              {fieldType === 'department' 
                ? 'Enable "Use predefined list" and add department options to configure email group linking.'
                : 'Enable "Use predefined list" and add employee type options to configure email group linking.'}
            </div>
          )}
        </div>
      )}




    </div>
  );
}