import React, { useState } from "react";
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
  const { fieldSettings, updateFieldSetting, isLoading } = useFieldSettings();

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
          selectedField={selectedField}
          onFieldSelect={setSelectedField}
          selectedApps={selectedApps}
          setSelectedApps={setSelectedApps}
          appMappingsData={appMappingsData}
        />
        
        <FieldConfigPanel
          selectedField={selectedField}
          fieldSettings={fieldSettings}
          onUpdateField={updateFieldSetting}
        />
      </div>
    </div>
  );
}