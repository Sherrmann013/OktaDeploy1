import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  sendActivationEmail: { required: false, hideField: false }
};

export function useFieldSettings() {
  const { toast } = useToast();
  const [fieldSettings, setFieldSettings] = useState<FieldSettings>(DEFAULT_FIELD_SETTINGS);
  const [departmentAppSaveFunction, setDepartmentAppSaveFunction] = useState<(() => Promise<boolean>) | null>(null);
  const [employeeTypeAppSaveFunction, setEmployeeTypeAppSaveFunction] = useState<(() => Promise<boolean>) | null>(null);
  const [departmentGroupSaveFunction, setDepartmentGroupSaveFunction] = useState<(() => Promise<boolean>) | null>(null);
  const [employeeTypeGroupSaveFunction, setEmployeeTypeGroupSaveFunction] = useState<(() => Promise<boolean>) | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all field settings
  const { data: fetchedSettings, isLoading, error } = useQuery({
    queryKey: ["/api/layout-settings", "all-fields"],
    queryFn: async () => {
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
        fetch('/api/layout-settings/groups', { credentials: 'include' }),
        fetch('/api/layout-settings/sendActivationEmail', { credentials: 'include' })
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
            console.warn(`Failed to parse ${fieldName} settings:`, e);
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
    const newSettings = {
      ...fieldSettings,
      [fieldKey]: newConfig
    };
    
    setFieldSettings(newSettings);
  };

  const saveFieldSetting = async (fieldKey: FieldKey, config: any) => {
    try {
      const response = await fetch('/api/layout-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settingKey: fieldKey,
          settingValue: JSON.stringify(config),
          settingType: 'user_config' as const,
          metadata: {}
        })
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
      console.error('Save error:', error);
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
      
      // Save department app mappings if function is available
      if (departmentAppSaveFunction) {
        const departmentAppResult = await departmentAppSaveFunction();
        allSuccessful = allSuccessful && departmentAppResult;
      }

      // Save employee type app mappings if function is available
      if (employeeTypeAppSaveFunction) {
        const employeeTypeAppResult = await employeeTypeAppSaveFunction();
        allSuccessful = allSuccessful && employeeTypeAppResult;
      }

      // Save department group mappings if function is available
      if (departmentGroupSaveFunction) {
        const departmentGroupResult = await departmentGroupSaveFunction();
        allSuccessful = allSuccessful && departmentGroupResult;
      }

      // Save employee type group mappings if function is available
      if (employeeTypeGroupSaveFunction) {
        const employeeTypeGroupResult = await employeeTypeGroupSaveFunction();
        allSuccessful = allSuccessful && employeeTypeGroupResult;
      }
      
      if (allSuccessful) {
        toast({ 
          title: "Success", 
          description: "All settings saved successfully" 
        });
      }
      
      return allSuccessful;
    } catch (error) {
      console.error('Save all error:', error);
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
    fieldSettings,
    updateFieldSetting,
    saveFieldSetting,
    saveAllSettings,
    setDepartmentAppSaveFunction,
    setEmployeeTypeAppSaveFunction,
    setDepartmentGroupSaveFunction,
    setEmployeeTypeGroupSaveFunction,
    isLoading,
    isSaving,
    error
  };
}