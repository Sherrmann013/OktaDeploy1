import React, { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendActivationEmailConfig } from "../types";

interface SendActivationEmailFieldConfigProps {
  config: SendActivationEmailConfig;
  onUpdate: (newConfig: SendActivationEmailConfig) => void;
}

export function SendActivationEmailFieldConfig({ config, onUpdate }: SendActivationEmailFieldConfigProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleEmailTemplateChange = (value: string) => {
    onUpdate({
      ...config,
      emailTemplate: value
    });
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.emailTemplate || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + placeholder + after;
    
    handleEmailTemplateChange(newText);
    
    // Set cursor position after inserted placeholder
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendActivationEmail-required"
            checked={config.required || false}
            onCheckedChange={handleRequiredChange}
          />
          <Label htmlFor="sendActivationEmail-required" className="text-sm">
            Required field
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendActivationEmail-hide-field"
            checked={config.hideField || false}
            onCheckedChange={handleHideFieldChange}
          />
          <Label htmlFor="sendActivationEmail-hide-field" className="text-sm">
            Hide field from user creation form
          </Label>
        </div>
      </div>
      
      <div className="space-y-3">
        <Label htmlFor="email-template" className="text-sm font-medium">
          Email Template
        </Label>
        
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertPlaceholder('{{firstName}}')}
              className="text-xs"
            >
              First Name
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertPlaceholder('{{lastName}}')}
              className="text-xs"
            >
              Last Name
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertPlaceholder('{{firstName}} {{lastName}}')}
              className="text-xs"
            >
              Full Name
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertPlaceholder('{{manager}}')}
              className="text-xs"
            >
              Manager
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertPlaceholder('{{email}}')}
              className="text-xs"
            >
              Email
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertPlaceholder('{{department}}')}
              className="text-xs"
            >
              Department
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertPlaceholder('{{employeeType}}')}
              className="text-xs"
            >
              Employee Type
            </Button>
          </div>
          
          <Textarea
            ref={textareaRef}
            id="email-template"
            placeholder="Enter email template..."
            value={config.emailTemplate || ''}
            onChange={(e) => handleEmailTemplateChange(e.target.value)}
            rows={8}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
          />
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Use the buttons above to insert field placeholders like {'{'}firstName{'}'}, {'{'}lastName{'}'}, etc. These will be replaced with actual values when the email is sent.
        </div>
      </div>
      
      <div className="text-sm text-gray-600 dark:text-gray-400">
        When enabled, this field will not appear in the Create User modal.
      </div>
    </div>
  );
}