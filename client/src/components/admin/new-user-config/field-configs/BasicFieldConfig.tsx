import React from "react";
import { BasicFieldConfig as BasicFieldConfigType } from "../types";

interface BasicFieldConfigProps {
  config: BasicFieldConfigType;
  onUpdate: (newConfig: BasicFieldConfigType) => void;
}

export function BasicFieldConfig({ config, onUpdate }: BasicFieldConfigProps) {
  return (
    <div className="text-sm text-gray-600 dark:text-gray-400">
      No additional configuration options for this field.
    </div>
  );
}