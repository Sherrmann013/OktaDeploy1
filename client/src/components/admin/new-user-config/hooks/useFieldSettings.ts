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
  department: { required: false, useList: false, options: [] },
  employeeType: { required: false, useList: true, options: [] }
};

export function useFieldSettings() {
  const { toast } = useToast();
  const [fieldSettings, setFieldSettings] = useState<FieldSettings>(DEFAULT_FIELD_SETTINGS);

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
        fetch('/api/layout-settings/employeeType', { credentials: 'include' })
      ];

      const responses = await Promise.all(settingsQueries);
      const settings = { ...DEFAULT_FIELD_SETTINGS };
      
      const fieldNames: FieldKey[] = [
        'firstName', 'lastName', 'emailUsername', 'password', 
        'title', 'manager', 'department', 'employeeType'
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

  const updateFieldSetting = async (fieldKey: FieldKey, newConfig: any) => {
    const newSettings = {
      ...fieldSettings,
      [fieldKey]: newConfig
    };
    
    setFieldSettings(newSettings);

    // Auto-save to backend
    try {
      const response = await fetch('/api/layout-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settingKey: fieldKey,
          settingValue: JSON.stringify(newConfig),
          settingType: 'user_config' as const,
          metadata: {}
        })
      });

      if (response.ok) {
        toast({ 
          title: "Success", 
          description: `${fieldKey} setting saved` 
        });
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      toast({ 
        title: "Error", 
        description: "Failed to save setting",
        variant: "destructive"
      });
      
      // Revert on error
      setFieldSettings(fieldSettings);
    }
  };

  return {
    fieldSettings,
    updateFieldSetting,
    isLoading,
    error
  };
}