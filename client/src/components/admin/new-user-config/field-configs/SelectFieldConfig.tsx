import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { SelectConfig, FieldKey } from "../types";

interface SelectFieldConfigProps {
  config: SelectConfig;
  onUpdate: (newConfig: SelectConfig) => void;
  fieldType: FieldKey;
}

export function SelectFieldConfig({ config, onUpdate, fieldType }: SelectFieldConfigProps) {
  const handleUseListChange = (checked: boolean) => {
    onUpdate({
      ...config,
      useList: checked
    });
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
    const defaultValue = fieldType === 'department' ? 'New Department' : 'New Employee Type';
    onUpdate({
      ...config,
      options: [...config.options, defaultValue]
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
            <div className="flex gap-2">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                className="h-7 px-2"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Option
              </Button>
            </div>
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
    </div>
  );
}