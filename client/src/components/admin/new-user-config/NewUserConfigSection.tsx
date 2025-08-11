import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserFormPreview } from "./UserFormPreview";
import { FieldConfigPanel } from "./FieldConfigPanel";
import { useFieldSettings } from "./hooks/useFieldSettings";
import { FieldKey } from "./types";

interface NewUserConfigSectionProps {
  selectedApps: string[];
  setSelectedApps: (apps: string[]) => void;
  appMappingsData: any[];
}

export function NewUserConfigSection({ 
  selectedApps, 
  setSelectedApps, 
  appMappingsData 
}: NewUserConfigSectionProps) {
  const [selectedField, setSelectedField] = useState<FieldKey | null>(null);
  const { 
    fieldSettings,
    getCurrentFieldConfig,
    updateFieldSetting,
    saveCurrentFieldChanges,
    discardFieldChanges,
    hasUnsavedChanges,
    saveAllSettings, 
    setDepartmentAppSaveFunction, 
    setEmployeeTypeAppSaveFunction,
    setDepartmentGroupSaveFunction,
    setEmployeeTypeGroupSaveFunction,
    setHasDepartmentMappingChanges,
    setHasEmployeeTypeMappingChanges,
    isLoading,
    isSaving 
  } = useFieldSettings();

  // Handle field selection and discard unsaved changes when switching
  const handleFieldSelect = (fieldKey: FieldKey | null) => {
    // If we're switching away from a field with unsaved changes, discard them
    if (selectedField && selectedField !== fieldKey && hasUnsavedChanges(selectedField)) {
      discardFieldChanges(selectedField);
    }
    setSelectedField(fieldKey);
  };

  if (isLoading || !fieldSettings) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-500">Loading field settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
      <div className="flex gap-6">
        <UserFormPreview
          fieldSettings={fieldSettings}
          getCurrentFieldConfig={getCurrentFieldConfig}
          selectedField={selectedField}
          onFieldSelect={handleFieldSelect}
          selectedApps={selectedApps}
          setSelectedApps={setSelectedApps}
          appMappingsData={appMappingsData}
        />
        
        <div className="flex-1">
          <FieldConfigPanel
            selectedField={selectedField}
            fieldSettings={fieldSettings}
            getCurrentFieldConfig={getCurrentFieldConfig}
            onUpdateField={updateFieldSetting}
            saveCurrentFieldChanges={saveCurrentFieldChanges}
            hasUnsavedChanges={hasUnsavedChanges}
            setDepartmentAppSaveFunction={setDepartmentAppSaveFunction}
            setEmployeeTypeAppSaveFunction={setEmployeeTypeAppSaveFunction}
            setDepartmentGroupSaveFunction={setDepartmentGroupSaveFunction}
            setEmployeeTypeGroupSaveFunction={setEmployeeTypeGroupSaveFunction}
            setHasDepartmentMappingChanges={setHasDepartmentMappingChanges}
            setHasEmployeeTypeMappingChanges={setHasEmployeeTypeMappingChanges}
          />
        </div>
      </div>
    </div>
  );
}