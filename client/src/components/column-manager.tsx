import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Settings, Filter, X, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Sortable column item component
function SortableColumnItem({ column, onToggle }: { column: ColumnConfig; onToggle: (columnId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const availableColumn = AVAILABLE_COLUMNS.find(col => col.id === column.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 border rounded-lg bg-card transition-all hover:shadow-md"
    >
      <div className="flex items-center space-x-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 hover:bg-muted/50 rounded transition-colors touch-none"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Checkbox
          checked={column.visible}
          onCheckedChange={() => onToggle(column.id)}
        />
        <Label className="text-sm font-medium">
          {availableColumn?.label || column.id}
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        {availableColumn?.hasFilter && (
          <Badge variant="secondary" className="text-xs">
            <Filter className="h-3 w-3 mr-1" />
            Filter
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function ColumnManager({ columns, onColumnsChange }: ColumnManagerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = columns.findIndex((column) => column.id === active.id);
      const newIndex = columns.findIndex((column) => column.id === over?.id);

      const newColumns = arrayMove(columns, oldIndex, newIndex).map((col, index) => ({
        ...col,
        order: index
      }));

      onColumnsChange(newColumns);
    }
  };

  const toggleColumn = (columnId: string) => {
    const updatedColumns = columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updatedColumns);
  };

  // Sort columns by order for display
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Columns
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[320px] sm:w-[380px]">
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
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={sortedColumns.map(col => col.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {sortedColumns.map(columnConfig => (
                      <SortableColumnItem
                        key={columnConfig.id}
                        column={columnConfig}
                        onToggle={toggleColumn}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}