import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { FieldSettings, FieldKey } from "./types";

interface UserFormPreviewProps {
  fieldSettings: FieldSettings;
  selectedField: FieldKey | null;
  onFieldSelect: (field: FieldKey | null) => void;
  selectedApps: string[];
  setSelectedApps: (apps: string[]) => void;
  appMappingsData: any[];
}

export function UserFormPreview({
  fieldSettings,
  selectedField,
  onFieldSelect,
  selectedApps,
  setSelectedApps,
  appMappingsData
}: UserFormPreviewProps) {
  const getFieldClassName = (fieldKey: FieldKey) => {
    return `cursor-pointer transition-colors ${
      selectedField === fieldKey 
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' 
        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-700'
    }`;
  };

  const getWrapperClassName = (fieldKey: FieldKey) => {
    return `cursor-pointer transition-colors rounded ${
      selectedField === fieldKey 
        ? 'ring-2 ring-blue-300 dark:ring-blue-600' 
        : 'hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-700'
    }`;
  };

  const handleFieldClick = (fieldKey: FieldKey) => {
    onFieldSelect(selectedField === fieldKey ? null : fieldKey);
  };

  return (
    <div className="flex-1 max-w-lg border border-gray-200 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-700">
      <h5 className="text-md font-medium mb-4">Create New User</h5>
      
      <div className="space-y-4">
        {/* First Name & Last Name Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="preview-firstName" className="text-sm font-medium">
              First Name {fieldSettings.firstName.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="preview-firstName"
              placeholder="Enter first name"
              className={getFieldClassName('firstName')}
              onClick={() => handleFieldClick('firstName')}
              readOnly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-lastName" className="text-sm font-medium">
              Last Name {fieldSettings.lastName.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="preview-lastName"
              placeholder="Enter last name"
              className={getFieldClassName('lastName')}
              onClick={() => handleFieldClick('lastName')}
              readOnly
            />
          </div>
        </div>

        {/* Email Username & Password Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="preview-username" className="text-sm font-medium">
              Email Username {fieldSettings.emailUsername.required && <span className="text-red-500">*</span>}
            </Label>
            <div 
              className={`flex ${getWrapperClassName('emailUsername')}`}
              onClick={() => handleFieldClick('emailUsername')}
            >
              <Input
                id="preview-username"
                placeholder="username"
                className={`rounded-r-none border-r-0 cursor-pointer pointer-events-none ${getFieldClassName('emailUsername')}`}
                readOnly
              />
              <div 
                className={`px-3 py-2 border border-l-0 rounded-r text-sm cursor-pointer pointer-events-none flex items-center ${
                  selectedField === 'emailUsername' 
                    ? 'bg-blue-100 dark:bg-blue-800/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300' 
                    : 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {fieldSettings.emailUsername.domains[0]}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-password" className="text-sm font-medium">
              Password {fieldSettings.password.required && <span className="text-red-500">*</span>}
            </Label>
            <div 
              className={getWrapperClassName('password')}
              onClick={() => handleFieldClick('password')}
            >
              <Input
                id="preview-password"
                type="password"
                placeholder="Enter password"
                className={`pr-10 cursor-pointer ${getFieldClassName('password')}`}
                readOnly
              />
              {fieldSettings.password.showGenerateButton && (
                <button className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${
                  selectedField === 'password' 
                    ? 'text-blue-500 dark:text-blue-400' 
                    : 'text-gray-400'
                }`}>
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Job Title & Department Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="preview-title" className="text-sm font-medium">
              Job Title {fieldSettings.title.required && <span className="text-red-500">*</span>}
            </Label>
            <div className={getWrapperClassName('title')} onClick={() => handleFieldClick('title')}>
              <Input
                id="preview-title"
                placeholder="Enter job title"
                className={`cursor-pointer pointer-events-none ${getFieldClassName('title')}`}
                readOnly
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-department" className="text-sm font-medium">
              Department {fieldSettings.department.required && <span className="text-red-500">*</span>}
            </Label>
            <div className={getWrapperClassName('department')} onClick={() => handleFieldClick('department')}>
              <Input
                id="preview-department"
                placeholder="Select department"
                className={`cursor-pointer pointer-events-none ${getFieldClassName('department')}`}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Manager & Employee Type Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="preview-manager" className="text-sm font-medium">
              Manager {fieldSettings.manager.required && <span className="text-red-500">*</span>}
            </Label>
            <div className={getWrapperClassName('manager')} onClick={() => handleFieldClick('manager')}>
              <Input
                id="preview-manager"
                placeholder="Type to search for manager..."
                className={`cursor-pointer pointer-events-none ${getFieldClassName('manager')}`}
                readOnly
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-employeeType" className="text-sm font-medium">
              Employee Type {fieldSettings.employeeType.required && <span className="text-red-500">*</span>}
            </Label>
            <div className={getWrapperClassName('employeeType')} onClick={() => handleFieldClick('employeeType')}>
              <Input
                id="preview-employeeType"
                placeholder="Select employee type"
                className={`cursor-pointer pointer-events-none ${getFieldClassName('employeeType')}`}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Groups & Apps Sections */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="preview-groups" className="text-sm font-medium">
              Groups {fieldSettings.groups?.required && <span className="text-red-500">*</span>}
              {fieldSettings.groups?.hideField && <span className="text-xs text-orange-500 ml-2">(Hidden in user form)</span>}
            </Label>
            <div className={getWrapperClassName('groups')} onClick={() => handleFieldClick('groups')}>
              <div className="border border-gray-300 dark:border-gray-600 rounded p-3 bg-white dark:bg-gray-800 min-h-[120px] cursor-pointer">
                <div className="space-y-2">
                  {fieldSettings.groups?.options && fieldSettings.groups.options.length > 0 ? (
                    fieldSettings.groups.options.map((group, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Checkbox id={`preview-group${index + 1}`} disabled />
                        <Label htmlFor={`preview-group${index + 1}`} className="text-sm">{group}</Label>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <span className="text-sm text-gray-500 dark:text-gray-400">No groups configured</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="preview-apps" className="text-sm font-medium">
              Apps {fieldSettings.apps?.required && <span className="text-red-500">*</span>}
              {fieldSettings.apps?.hideField && <span className="text-xs text-orange-500 ml-2">(Hidden in user form)</span>}
            </Label>
            <div className={getWrapperClassName('apps')} onClick={() => handleFieldClick('apps')}>
              <div className="border border-gray-300 dark:border-gray-600 rounded p-3 bg-white dark:bg-gray-800 min-h-[120px] cursor-pointer">
                <div className="text-center py-8">
                  <span className="text-sm text-gray-500 dark:text-gray-400">No specific app configuration yet</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Send activation email checkbox */}
        <div 
          className={`flex items-center space-x-2 cursor-pointer border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-600 rounded-lg p-3 transition-colors ${
            selectedField === 'sendActivationEmail' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : ''
          }`}
          onClick={() => handleFieldClick('sendActivationEmail')}
        >
          <Checkbox id="preview-activation" disabled />
          <Label htmlFor="preview-activation" className="text-sm">
            Send activation email to manager {fieldSettings.sendActivationEmail?.required && <span className="text-red-500">*</span>}
            {fieldSettings.sendActivationEmail?.hideField && <span className="text-xs text-orange-500 ml-2">(Hidden in user form)</span>}
          </Label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
          <Button variant="outline" disabled>
            Cancel
          </Button>
          <Button disabled className="bg-blue-600 text-white">
            Create User
          </Button>
        </div>
      </div>
    </div>
  );
}