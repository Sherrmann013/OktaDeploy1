import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AppsConfig } from "../types";

interface AppsFieldConfigProps {
  config: AppsConfig;
  onUpdate: (newConfig: AppsConfig) => void;
}

export function AppsFieldConfig({ config, onUpdate }: AppsFieldConfigProps) {
  const handleRequiredChange = (checked: boolean) => {
    onUpdate({
      ...config,
      required: checked
    });
  };

  const handleHideFieldChange = (checked: boolean) => {
    onUpdate({
      ...config,
      hideField: checked
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="apps-required"
            checked={config.required || false}
            onCheckedChange={handleRequiredChange}
          />
          <Label htmlFor="apps-required" className="text-sm">
            Required field
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="apps-hide-field"
            checked={config.hideField || false}
            onCheckedChange={handleHideFieldChange}
          />
          <Label htmlFor="apps-hide-field" className="text-sm">
            Hide field from user creation form
          </Label>
        </div>
      </div>
      
      <div className="text-sm text-gray-600 dark:text-gray-400">
        When enabled, the Apps field will not appear in the Create User modal.
      </div>
    </div>
  );
}