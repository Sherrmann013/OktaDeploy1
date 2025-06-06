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
  { id: 'firstName', label: 'First Name', type: 'text' },
  { id: 'lastName', label: 'Last Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'login', label: 'Login', type: 'text' },
  { id: 'title', label: 'Title', type: 'text' },
  { id: 'department', label: 'Department', type: 'text' },
  { id: 'employeeType', label: 'Employee Type', type: 'select', options: ['EMPLOYEE', 'CONTRACTOR', 'INTERN', 'PART_TIME', 'CONSULTANT'] },
  { id: 'manager', label: 'Manager', type: 'text' },
  { id: 'mobilePhone', label: 'Mobile Phone', type: 'text' },
  { id: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'SUSPENDED', 'DEPROVISIONED'] },
  { id: 'activated', label: 'Account Created', type: 'date' },
  { id: 'lastLogin', label: 'Last Login', type: 'date' },
  { id: 'lastUpdated', label: 'Last Updated', type: 'date' },
  { id: 'passwordChanged', label: 'Password Changed', type: 'date' },
] as const;

export interface ColumnConfig {
  id: string;
  visible: boolean;
  width?: number;
}

export interface FilterConfig {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'before' | 'after';
  value: string;
}

interface ColumnManagerProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  filters: FilterConfig[];
  onFiltersChange: (filters: FilterConfig[]) => void;
}

export default function ColumnManager({ columns, onColumnsChange, filters, onFiltersChange }: ColumnManagerProps) {
  const [newFilterField, setNewFilterField] = useState('');
  const [newFilterOperator, setNewFilterOperator] = useState<FilterConfig['operator']>('contains');
  const [newFilterValue, setNewFilterValue] = useState('');

  const toggleColumn = (columnId: string) => {
    const updatedColumns = columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updatedColumns);
  };

  const addFilter = () => {
    if (!newFilterField || !newFilterValue) return;
    
    const newFilter: FilterConfig = {
      id: Date.now().toString(),
      field: newFilterField,
      operator: newFilterOperator,
      value: newFilterValue
    };
    
    onFiltersChange([...filters, newFilter]);
    setNewFilterField('');
    setNewFilterValue('');
  };

  const removeFilter = (filterId: string) => {
    onFiltersChange(filters.filter(f => f.id !== filterId));
  };

  const getOperatorOptions = (fieldType: string) => {
    switch (fieldType) {
      case 'date':
        return [
          { value: 'before', label: 'Before' },
          { value: 'after', label: 'After' }
        ];
      case 'select':
        return [
          { value: 'equals', label: 'Equals' }
        ];
      default:
        return [
          { value: 'contains', label: 'Contains' },
          { value: 'equals', label: 'Equals' },
          { value: 'startsWith', label: 'Starts with' },
          { value: 'endsWith', label: 'Ends with' }
        ];
    }
  };

  const selectedField = AVAILABLE_COLUMNS.find(col => col.id === newFilterField);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Columns & Filters
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Manage Columns & Filters</SheetTitle>
          <SheetDescription>
            Customize which columns are visible and add filters to refine your view
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 mt-6">
          {/* Column Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Visible Columns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {AVAILABLE_COLUMNS.map(column => {
                const columnConfig = columns.find(c => c.id === column.id);
                const isVisible = columnConfig?.visible ?? false;
                
                return (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={column.id}
                      checked={isVisible}
                      onCheckedChange={() => toggleColumn(column.id)}
                    />
                    <Label htmlFor={column.id} className="text-sm">
                      {column.label}
                    </Label>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Filter Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Active Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Active Filters */}
              {filters.length > 0 && (
                <div className="space-y-2">
                  {filters.map(filter => {
                    const field = AVAILABLE_COLUMNS.find(col => col.id === filter.field);
                    return (
                      <Badge key={filter.id} variant="secondary" className="flex items-center gap-2 justify-between">
                        <span className="text-xs">
                          {field?.label} {filter.operator} "{filter.value}"
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFilter(filter.id)}
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Add New Filter */}
              <div className="space-y-3 pt-3 border-t">
                <div className="space-y-2">
                  <Label htmlFor="filter-field" className="text-xs">Field</Label>
                  <Select value={newFilterField} onValueChange={setNewFilterField}>
                    <SelectTrigger id="filter-field">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_COLUMNS.map(column => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newFilterField && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="filter-operator" className="text-xs">Condition</Label>
                      <Select value={newFilterOperator} onValueChange={(value: FilterConfig['operator']) => setNewFilterOperator(value)}>
                        <SelectTrigger id="filter-operator">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorOptions(selectedField?.type || 'text').map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="filter-value" className="text-xs">Value</Label>
                      {selectedField?.type === 'select' ? (
                        <Select value={newFilterValue} onValueChange={setNewFilterValue}>
                          <SelectTrigger id="filter-value">
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedField.options?.map(option => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="filter-value"
                          type={selectedField?.type === 'date' ? 'date' : 'text'}
                          value={newFilterValue}
                          onChange={(e) => setNewFilterValue(e.target.value)}
                          placeholder="Enter filter value"
                        />
                      )}
                    </div>

                    <Button onClick={addFilter} size="sm" className="w-full">
                      Add Filter
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}