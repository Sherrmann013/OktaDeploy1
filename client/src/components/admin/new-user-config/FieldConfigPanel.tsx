import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BasicFieldConfig } from "./field-configs/BasicFieldConfig";
import { EmailFieldConfig } from "./field-configs/EmailFieldConfig";
import { PasswordFieldConfig } from "./field-configs/PasswordFieldConfig";
import { SelectFieldConfig } from "./field-configs/SelectFieldConfig";
import { AppsFieldConfig } from "./field-configs/AppsFieldConfig";
import { GroupsFieldConfig } from "./field-configs/GroupsFieldConfig";
import { SendActivationEmailFieldConfig } from "./field-configs/SendActivationEmailFieldConfig";
import { FieldSettings, FieldKey } from "./types";

interface FieldConfigPanelProps {
  selectedField: FieldKey | null;
  fieldSettings: FieldSettings;
  onUpdateField: (fieldKey: FieldKey, newConfig: any) => void;
  setDepartmentAppSaveFunction?: (fn: (() => Promise<boolean>) | null) => void;
  setEmployeeTypeAppSaveFunction?: (fn: (() => Promise<boolean>) | null) => void;
  setDepartmentGroupSaveFunction?: (fn: (() => Promise<boolean>) | null) => void;
  setEmployeeTypeGroupSaveFunction?: (fn: (() => Promise<boolean>) | null) => void;
}

export function FieldConfigPanel({
  selectedField,
  fieldSettings,
  onUpdateField,
  setDepartmentAppSaveFunction,
  setEmployeeTypeAppSaveFunction,
  setDepartmentGroupSaveFunction,
  setEmployeeTypeGroupSaveFunction
}: FieldConfigPanelProps) {
  if (!selectedField) {
    return (
      <div className="flex-1 space-y-6">
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            <div className="mb-2">👆 Click on a field in the preview</div>
            <div className="text-sm">to configure its settings</div>
          </div>
        </div>
      </div>
    );
  }

  const getFieldTitle = (field: FieldKey): string => {
    const titles: Record<FieldKey, string> = {
      firstName: 'First Name Options',
      lastName: 'Last Name Options',
      emailUsername: 'Email Username Options',
      password: 'Password Options',
      title: 'Job Title Options',
      manager: 'Manager Options',
      department: 'Department Options',
      employeeType: 'Employee Type Options',
      apps: 'Apps Options',
      groups: 'Groups Options',
      sendActivationEmail: 'Send Activation Email Options'
    };
    return titles[field];
  };

  const handleRequiredChange = (checked: boolean) => {
    const currentConfig = fieldSettings[selectedField];
    onUpdateField(selectedField, {
      ...currentConfig,
      required: checked
    });
  };

  const renderFieldSpecificConfig = () => {
    const currentConfig = fieldSettings[selectedField];

    switch (selectedField) {
      case 'emailUsername':
        return (
          <EmailFieldConfig
            config={currentConfig as any}
            onUpdate={(newConfig) => onUpdateField(selectedField, newConfig)}
          />
        );
      case 'password':
        return (
          <PasswordFieldConfig
            config={currentConfig as any}
            onUpdate={(newConfig) => onUpdateField(selectedField, newConfig)}
          />
        );
      case 'department':
      case 'employeeType':
        return (
          <SelectFieldConfig
            config={currentConfig as any}
            onUpdate={(newConfig) => onUpdateField(selectedField, newConfig)}
            fieldType={selectedField}
            setDepartmentAppSaveFunction={setDepartmentAppSaveFunction}
            setEmployeeTypeAppSaveFunction={setEmployeeTypeAppSaveFunction}
            setDepartmentGroupSaveFunction={setDepartmentGroupSaveFunction}
            setEmployeeTypeGroupSaveFunction={setEmployeeTypeGroupSaveFunction}
          />
        );
      case 'groups':
        return (
          <GroupsFieldConfig
            config={currentConfig as any}
            onUpdate={(newConfig) => onUpdateField(selectedField, newConfig)}
          />
        );
      case 'apps':
        return (
          <AppsFieldConfig
            config={currentConfig as any}
            onUpdate={(newConfig) => onUpdateField(selectedField, newConfig)}
          />
        );
      case 'sendActivationEmail':
        return (
          <SendActivationEmailFieldConfig
            config={currentConfig as any}
            onUpdate={(newConfig) => onUpdateField(selectedField, newConfig)}
          />
        );
      default:
        return (
          <BasicFieldConfig
            config={currentConfig as any}
            onUpdate={(newConfig) => onUpdateField(selectedField, newConfig)}
          />
        );
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <div>
        <h5 className="text-md font-medium mb-4">
          {getFieldTitle(selectedField)}
        </h5>
        
        <div className="space-y-4">
          {/* Required Checkbox - Universal for all fields except those with custom configs */}
          {!['groups', 'apps', 'sendActivationEmail'].includes(selectedField) && (
            <div className="flex items-center space-x-2">
              <Checkbox 
                id={`${selectedField}-required`}
                checked={fieldSettings[selectedField]?.required}
                onCheckedChange={handleRequiredChange}
              />
              <Label htmlFor={`${selectedField}-required`} className="text-sm">
                Required field
              </Label>
            </div>
          )}

          {/* Field-specific configuration */}
          {renderFieldSpecificConfig()}
        </div>
      </div>
    </div>
  );
}