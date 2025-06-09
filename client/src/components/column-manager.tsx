import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Settings, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Available columns based on user profile fields
export const AVAILABLE_COLUMNS = [
  { id: 'name', label: 'Name', type: 'text', hasFilter: false },
  { id: 'title', label: 'Title', type: 'text', hasFilter: false },
  { id: 'department', label: 'Department', type: 'text', hasFilter: false },
  { id: 'employeeType', label: 'Employee Type', type: 'select', hasFilter: true, options: ['EMPLOYEE', 'CONTRACTOR', 'INTERN', 'PART_TIME', 'CONSULTANT'] },
  { id: 'manager', label: 'Manager', type: 'autocomplete', hasFilter: true },
  { id: 'mobilePhone', label: 'Mobile Phone', type: 'text', hasFilter: true },
  { id: 'status', label: 'Status', type: 'select', hasFilter: false, options: ['ACTIVE', 'SUSPENDED', 'DEPROVISIONED'] },
  { id: 'disabled', label: 'Disabled On', type: 'date', hasFilter: false },
  { id: 'activated', label: 'Account Created', type: 'date', hasFilter: true },
  { id: 'lastLogin', label: 'Last Login', type: 'date', hasFilter: true },
  { id: 'lastUpdated', label: 'Last Updated', type: 'date', hasFilter: true },
  { id: 'passwordChanged', label: 'Password Changed', type: 'date', hasFilter: true },
] as const;

export interface ColumnConfig {
  id: string;
  visible: boolean;
  width?: number;
  order: number;
}

interface ColumnManagerProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

export default function ColumnManager({ columns, onColumnsChange }: ColumnManagerProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const toggleColumn = (columnId: string) => {
    const updatedColumns = columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updatedColumns);
  };

  const handleDragStart = (columnId: string) => {
    setDraggedItem(columnId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetColumnId: string) => {
    if (!draggedItem || draggedItem === targetColumnId) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = columns.findIndex(col => col.id === draggedItem);
    const targetIndex = columns.findIndex(col => col.id === targetColumnId);
    
    const updatedColumns = [...columns];
    const [draggedColumn] = updatedColumns.splice(draggedIndex, 1);
    updatedColumns.splice(targetIndex, 0, draggedColumn);
    
    // Update order values
    const reorderedColumns = updatedColumns.map((col, index) => ({
      ...col,
      order: index
    }));
    
    onColumnsChange(reorderedColumns);
    setDraggedItem(null);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Columns
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Manage Columns</SheetTitle>
          <SheetDescription>
            Customize which columns are visible and drag to reorder them
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 mt-6">
          {/* Column Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Visible Columns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {columns
                .sort((a, b) => a.order - b.order)
                .map(columnConfig => {
                  const column = AVAILABLE_COLUMNS.find(c => c.id === columnConfig.id);
                  if (!column) return null;
                  
                  return (
                    <div 
                      key={columnConfig.id} 
                      className={`flex items-center space-x-2 p-2 rounded border cursor-grab ${
                        draggedItem === columnConfig.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                      }`}
                      draggable
                      onDragStart={() => handleDragStart(columnConfig.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(columnConfig.id)}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <Checkbox
                          id={columnConfig.id}
                          checked={columnConfig.visible}
                          onCheckedChange={() => toggleColumn(columnConfig.id)}
                        />
                        <Label htmlFor={columnConfig.id} className="text-sm cursor-pointer">
                          {column.label}
                        </Label>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ⋮⋮
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}