import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
            
            <div className="space-y-2">
              {config.components.map((component, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <span className="text-sm font-medium">{getComponentLabel(component.type)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleComponentCountChange(index, component.count - 1)}
                      disabled={component.count <= 1}
                      className="h-7 w-7 p-0"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    
                    <span className="w-8 text-center text-sm font-medium">
                      {component.count}
                    </span>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleComponentCountChange(index, component.count + 1)}
                      disabled={component.count >= 10}
                      className="h-7 w-7 p-0"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  {config.components.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeComponent(index)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Component Buttons */}
            <div className="flex gap-2">
              {(['words', 'numbers', 'symbols'] as const).map((type) => {
                const hasComponent = config.components.some(c => c.type === type);
                if (hasComponent) return null;
                
                return (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addComponent(type)}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add {getComponentLabel(type)}
                  </Button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}