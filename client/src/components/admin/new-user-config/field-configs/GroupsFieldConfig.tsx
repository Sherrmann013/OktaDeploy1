import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import { useState } from "react";
import { GroupsConfig } from "../types";

interface GroupsFieldConfigProps {
  config: GroupsConfig;
  onUpdate: (config: GroupsConfig) => void;
}

export function GroupsFieldConfig({ config, onUpdate }: GroupsFieldConfigProps) {
  const [newGroup, setNewGroup] = useState("");

  const addGroup = () => {
    if (newGroup.trim() && !config.options.includes(newGroup.trim())) {
      onUpdate({
        ...config,
        options: [...config.options, newGroup.trim()]
      });
      setNewGroup("");
    }
  };

  const removeGroup = (groupToRemove: string) => {
    onUpdate({
      ...config,
      options: config.options.filter(group => group !== groupToRemove)
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addGroup();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="groups-required"
            checked={config.required}
            onCheckedChange={(checked) =>
              onUpdate({ ...config, required: checked === true })
            }
          />
          <Label htmlFor="groups-required">Required field</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="groups-hide-field"
            checked={config.hideField}
            onCheckedChange={(checked) =>
              onUpdate({ ...config, hideField: checked === true })
            }
          />
          <Label htmlFor="groups-hide-field">Hide field in user form</Label>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Group Options</Label>
        
        {/* List of existing groups */}
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-w-96">
          {config.options.map((group, index) => (
            <div key={index} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <span className="flex-1 text-gray-900 dark:text-gray-100 text-sm">
                {group}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeGroup(group)}
                className="h-4 w-4 p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          
          {/* Add new group row */}
          <div className="flex items-center px-3 py-2 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-2 flex-1">
              <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
              <Input
                placeholder="Add new group"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyPress={handleKeyPress}
                className="border-0 shadow-none p-0 h-auto bg-transparent text-sm focus-visible:ring-0 placeholder:text-green-600/70 dark:placeholder:text-green-400/70"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={addGroup}
              disabled={!newGroup.trim() || config.options.includes(newGroup.trim())}
              className="h-6 px-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 text-xs"
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}