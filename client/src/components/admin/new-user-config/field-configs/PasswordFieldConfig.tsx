import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { PasswordConfig, PasswordComponent } from "../types";

interface PasswordFieldConfigProps {
  config: PasswordConfig;
  onUpdate: (newConfig: PasswordConfig) => void;
}

export function PasswordFieldConfig({ config, onUpdate }: PasswordFieldConfigProps) {
  const handleShowGenerateButtonChange = (checked: boolean) => {
    onUpdate({
      ...config,
      showGenerateButton: checked
    });
  };

  const handleTargetLengthChange = (newLength: number) => {
    onUpdate({
      ...config,
      targetLength: Math.max(6, Math.min(50, newLength))
    });
  };

  const handleComponentCountChange = (index: number, newCount: number) => {
    const newComponents = [...config.components];
    newComponents[index] = {
      ...newComponents[index],
      count: Math.max(1, Math.min(10, newCount))
    };
    onUpdate({
      ...config,
      components: newComponents
    });
  };

  const addComponent = (type: PasswordComponent['type']) => {
    onUpdate({
      ...config,
      components: [...config.components, { type, count: 1 }]
    });
  };

  const removeComponent = (index: number) => {
    if (config.components.length > 1) {
      const newComponents = config.components.filter((_, i) => i !== index);
      onUpdate({
        ...config,
        components: newComponents
      });
    }
  };

  const getComponentLabel = (type: PasswordComponent['type']): string => {
    switch (type) {
      case 'words': return 'Words';
      case 'numbers': return 'Numbers';
      case 'symbols': return 'Symbols';
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      {/* Show Generate Button */}
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="show-generate-button"
          checked={config.showGenerateButton}
          onCheckedChange={handleShowGenerateButtonChange}
        />
        <Label htmlFor="show-generate-button" className="text-sm">
          Show password generation button
        </Label>
      </div>

      {config.showGenerateButton && (
        <>
          {/* Target Length */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Password Length</Label>
            <Input
              type="number"
              value={config.targetLength}
              onChange={(e) => handleTargetLengthChange(parseInt(e.target.value) || 10)}
              min="6"
              max="50"
              className="w-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
            />
          </div>

          {/* Password Components */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Password Components</Label>
            
            {/* Add Component Buttons - Always visible */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => addComponent('words')}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                + Words
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => addComponent('numbers')}
                className="text-xs bg-green-600 hover:bg-green-700 text-white border-0"
              >
                + Numbers
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => addComponent('symbols')}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white border-0"
              >
                + Symbols
              </Button>
            </div>
            
            {/* Components Container with + signs between */}
            <div className="p-4 bg-gray-600 dark:bg-gray-700 rounded-lg border border-gray-500 dark:border-gray-600">
              <div className="flex flex-wrap items-center gap-3">
                {config.components.map((component, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <span className="text-white text-sm font-medium">+</span>
                    )}
                    <div className="flex items-center space-x-2 bg-gray-500 dark:bg-gray-600 rounded-md px-3 py-2">
                      <Select
                        value={component.count.toString()}
                        onValueChange={(value) => handleComponentCountChange(index, parseInt(value))}
                      >
                        <SelectTrigger className="w-12 h-6 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-200">
                        {getComponentLabel(component.type)}
                      </span>
                      
                      {config.components.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeComponent(index)}
                          className="h-5 w-5 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}