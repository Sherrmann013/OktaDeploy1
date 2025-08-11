import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { FieldSettings, FieldKey } from "../types";

const DEFAULT_FIELD_SETTINGS: FieldSettings = {
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
  department: { required: false, useList: false, options: [], linkApps: false },
  employeeType: { required: false, useList: true, options: [] },
  apps: { required: false, hideField: false },
  groups: { required: false, useList: true, options: [], hideField: false },
  sendActivationEmail: { 
    required: false, 
    hideField: false, 
    emailTemplate: "Hello {{manager}},\n\nA new user has been created:\n\nName: {{firstName}} {{lastName}}\nEmail: {{email}}\nDepartment: {{department}}\nEmployee Type: {{employeeType}}\n\nPlease reach out to welcome them to the team!\n\nBest regards,\nIT Team"
  }
};

export function useFieldSettings() {
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Detect current client context from URL - CLIENT-AWARE
  const currentClientId = location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1;
  
  const [fieldSettings, setFieldSettings] = useState<FieldSettings>(DEFAULT_FIELD_SETTINGS);
  const [unsavedChanges, setUnsavedChanges] = useState<Partial<FieldSettings>>({});
  const [departmentAppSaveFunction, setDepartmentAppSaveFunction] = useState<(() => Promise<boolean>) | null>(null);
  const [employeeTypeAppSaveFunction, setEmployeeTypeAppSaveFunction] = useState<(() => Promise<boolean>) | null>(null);
  const [departmentGroupSaveFunction, setDepartmentGroupSaveFunction] = useState<(() => Promise<boolean>) | null>(null);
  const [employeeTypeGroupSaveFunction, setEmployeeTypeGroupSaveFunction] = useState<(() => Promise<boolean>) | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Direct state tracking for mapping changes (since auto-registration is disabled)
  const [hasDepartmentMappingChanges, setHasDepartmentMappingChanges] = useState(false);
  const [hasEmployeeTypeMappingChanges, setHasEmployeeTypeMappingChanges] = useState(false);

  // Fetch all field settings - CLIENT-AWARE
  const { data: fetchedSettings, isLoading, error } = useQuery({
    queryKey: [`/api/client/${currentClientId}/layout-settings`, "all-fields"],
    queryFn: async () => {
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
      const settings = { ...DEFAULT_FIELD_SETTINGS };
      
      const fieldNames: FieldKey[] = [
        'firstName', 'lastName', 'emailUsername', 'password', 
        'title', 'manager', 'department', 'employeeType', 'apps', 'groups', 'sendActivationEmail'
      ];
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const fieldName = fieldNames[i];
        
        if (response.ok) {
          const data = await response.json();
          try {
            const parsedValue = JSON.parse(data.settingValue || '{}');
            (settings as any)[fieldName] = parsedValue;
          } catch (e) {
            // Failed to parse settings, using defaults
          }
        }
      }
      
      return settings;
    },
  });

  // Update local state when fetch completes
  useEffect(() => {
    if (fetchedSettings) {
      setFieldSettings(fetchedSettings);
    }
  }, [fetchedSettings]);

  const updateFieldSetting = (fieldKey: FieldKey, newConfig: any) => {
    console.log('🔵 updateFieldSetting called:', { fieldKey, hasChanges: fieldKey in unsavedChanges });
    // Update only in unsaved changes, not in the main settings
    setUnsavedChanges(prev => ({
      ...prev,
      [fieldKey]: newConfig
    }));
    console.log('🔵 unsavedChanges updated for', fieldKey);
  };

  // Get the current state for a field (including unsaved changes)
  const getCurrentFieldConfig = (fieldKey: FieldKey) => {
    return unsavedChanges[fieldKey] || fieldSettings[fieldKey];
  };

  // Discard unsaved changes for a field
  const discardFieldChanges = (fieldKey: FieldKey) => {
    setUnsavedChanges(prev => {
      const newChanges = { ...prev };
      delete newChanges[fieldKey];
      return newChanges;
    });
  };

  // Save only the current field's changes
  const saveCurrentFieldChanges = async (fieldKey: FieldKey) => {
    console.log('🔴 saveCurrentFieldChanges called for:', fieldKey);
    console.trace('🔴 SAVE STACK TRACE - WHO CALLED THIS?');
    // Check if there are any changes to save (including mapping functions)
    const hasRegularChanges = !!unsavedChanges[fieldKey];
    const hasDepartmentAppChanges = fieldKey === 'department' && departmentAppSaveFunction !== null;
    const hasEmployeeTypeAppChanges = fieldKey === 'employeeType' && employeeTypeAppSaveFunction !== null;
    const hasDepartmentGroupChanges = fieldKey === 'department' && departmentGroupSaveFunction !== null;
    const hasEmployeeTypeGroupChanges = fieldKey === 'employeeType' && employeeTypeGroupSaveFunction !== null;
    
    const hasAnyChanges = hasRegularChanges || hasDepartmentAppChanges || hasEmployeeTypeAppChanges || hasDepartmentGroupChanges || hasEmployeeTypeGroupChanges;
    
    if (!hasAnyChanges) {
      toast({ 
        title: "No Changes", 
        description: "No unsaved changes to save for this field" 
      });
      return true;
    }

    setIsSaving(true);
    
    try {
      let allSuccessful = true;
      
      // Save regular field changes
      if (hasRegularChanges) {
        const success = await saveFieldSetting(fieldKey, unsavedChanges[fieldKey]);
        if (success) {
          // Move unsaved changes to saved settings
          setFieldSettings(prev => ({
            ...prev,
            [fieldKey]: unsavedChanges[fieldKey]
          }));
          
          // Clear unsaved changes for this field
          discardFieldChanges(fieldKey);
        }
        allSuccessful = allSuccessful && success;
      }
      
      // Save department/employee type app mappings
      if (hasDepartmentAppChanges && departmentAppSaveFunction) {
        const success = await departmentAppSaveFunction();
        allSuccessful = allSuccessful && success;
      }
      
      if (hasEmployeeTypeAppChanges && employeeTypeAppSaveFunction) {
        const success = await employeeTypeAppSaveFunction();
        allSuccessful = allSuccessful && success;
      }
      
      // Save department/employee type group mappings
      if (hasDepartmentGroupChanges && departmentGroupSaveFunction) {
        const success = await departmentGroupSaveFunction();
        allSuccessful = allSuccessful && success;
      }
      
      if (hasEmployeeTypeGroupChanges && employeeTypeGroupSaveFunction) {
        const success = await employeeTypeGroupSaveFunction();
        allSuccessful = allSuccessful && success;
      }
      
      if (allSuccessful) {
        toast({ 
          title: "Success", 
          description: `${getFieldDisplayName(fieldKey)} settings saved` 
        });
      } else {
        toast({ 
          title: "Partial Success", 
          description: "Some settings may not have saved properly", 
          variant: "destructive" 
        });
      }
      
      return allSuccessful;
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to save settings", 
        variant: "destructive" 
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to get display name for fields
  const getFieldDisplayName = (fieldKey: FieldKey): string => {
    const displayNames: Record<FieldKey, string> = {
      firstName: 'First Name',
      lastName: 'Last Name',
      emailUsername: 'Email Username',
      password: 'Password',
      title: 'Job Title',
      manager: 'Manager',
      department: 'Department',
      employeeType: 'Employee Type',
      apps: 'Apps',
      groups: 'Groups',
      sendActivationEmail: 'Send Activation Email'
    };
    return displayNames[fieldKey];
  };

  // Check if a field has unsaved changes (including app/group mappings)
  const hasUnsavedChanges = (fieldKey: FieldKey) => {
    // Check regular field settings
    const hasRegularChanges = fieldKey in unsavedChanges;
    
    // Check department/employee type specific mappings using direct state tracking
    if (fieldKey === 'department') {
      console.log('🔍 CHECKING DEPARTMENT CHANGES:', { hasRegularChanges, hasDepartmentMappingChanges });
      return hasRegularChanges || hasDepartmentMappingChanges;
    }
    if (fieldKey === 'employeeType') {
      console.log('🔍 CHECKING EMPLOYEE TYPE CHANGES:', { hasRegularChanges, hasEmployeeTypeMappingChanges });
      return hasRegularChanges || hasEmployeeTypeMappingChanges;
    }
    
    return hasRegularChanges;
  };

  const saveFieldSetting = async (fieldKey: FieldKey, config: any) => {
    console.log('🔴 DETAILED SAVE LOGGING - WHAT IS BEING SAVED:', {
      fieldKey,
      config,
      configStringified: JSON.stringify(config),
      currentClientId,
      configOptions: config?.options,
      configOptionsLength: config?.options?.length
    });
    
    try {
      const payload = {
        settingKey: fieldKey,
        settingValue: JSON.stringify(config),
        settingType: 'user_config' as const,
        clientId: currentClientId,
        metadata: {}
      };
      
      console.log('🔴 PAYLOAD BEING SENT TO SERVER:', payload);
      
      const response = await fetch(`/api/client/${currentClientId}/layout-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast({ 
          title: "Success", 
          description: `${fieldKey} setting saved` 
        });
        return true;
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to save settings", 
        variant: "destructive" 
      });
      return false;
    }
  };

  const saveAllSettings = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      // Save field settings
      const savePromises = Object.entries(fieldSettings).map(([fieldKey, config]) => 
        saveFieldSetting(fieldKey as FieldKey, config)
      );
      
      const results = await Promise.all(savePromises);
      let allSuccessful = results.every(result => result === true);
      
      // Note: Department/Employee Type app mappings and Group mappings are NOT auto-saved with global "Save Changes"
      // They require manual save using their individual Save buttons
      // This maintains manual save control as requested by the user
      
      if (allSuccessful) {
        toast({ 
          title: "Success", 
          description: "All settings saved successfully" 
        });
      }
      
      return allSuccessful;
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to save some settings", 
        variant: "destructive" 
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    fieldSettings: fieldSettings,
    getCurrentFieldConfig,
    updateFieldSetting,
    saveCurrentFieldChanges,
    discardFieldChanges,
    hasUnsavedChanges,
    saveFieldSetting,
    saveAllSettings,
    setDepartmentAppSaveFunction,
    setEmployeeTypeAppSaveFunction,
    setDepartmentGroupSaveFunction,
    setEmployeeTypeGroupSaveFunction,
    setHasDepartmentMappingChanges,
    setHasEmployeeTypeMappingChanges,
    isLoading,
    isSaving,
    error
  };
}