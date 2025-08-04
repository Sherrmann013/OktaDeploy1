import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { EmailConfig } from "../types";

interface EmailFieldConfigProps {
  config: EmailConfig;
  onUpdate: (newConfig: EmailConfig) => void;
}

export function EmailFieldConfig({ config, onUpdate }: EmailFieldConfigProps) {
  const handleDomainChange = (index: number, newValue: string) => {
    const newDomains = [...config.domains];
    newDomains[index] = newValue;
    onUpdate({
      ...config,
      domains: newDomains
    });
  };

  const addDomain = () => {
    onUpdate({
      ...config,
      domains: [...config.domains, ""]
    });
  };

  const removeDomain = (index: number) => {
    if (config.domains.length > 1) {
      const newDomains = config.domains.filter((_, i) => i !== index);
      onUpdate({
        ...config,
        domains: newDomains
      });
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Email Domains</Label>
      
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-w-64">
        {config.domains.map((domain, index) => (
          <div key={index} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <Input
              value={domain}
              onChange={(e) => handleDomainChange(index, e.target.value)}
              className="flex-1 text-sm border-0 bg-transparent focus:ring-0 p-0"
              placeholder="@domain.com"
            />
            {config.domains.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeDomain(index)}
                className="h-6 w-6 p-0 ml-2 text-gray-400 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
        <div className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addDomain}
            className="h-6 w-6 p-0 mr-2 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
          >
            <Plus className="w-3 h-3" />
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Add domain
          </span>
        </div>
      </div>
    </div>
  );
}