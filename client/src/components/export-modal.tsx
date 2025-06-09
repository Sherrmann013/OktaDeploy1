import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { AVAILABLE_COLUMNS, ColumnConfig } from "./column-manager";
import { User } from "@shared/schema";

interface ExportModalProps {
  users: User[];
  currentColumns: ColumnConfig[];
  totalUsers: number;
  onExport: (columns: string[], exportType: 'current' | 'custom') => void;
}

export default function ExportModal({ users, currentColumns, totalUsers, onExport }: ExportModalProps) {
  const [open, setOpen] = useState(false);
  const [exportType, setExportType] = useState<'current' | 'custom'>('current');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => 
    currentColumns.filter(col => col.visible).map(col => col.id)
  );

  const handleExport = () => {
    if (exportType === 'current') {
      const visibleColumns = currentColumns.filter(col => col.visible).map(col => col.id);
      onExport(visibleColumns, 'current');
    } else {
      onExport(selectedColumns, 'custom');
    }
    setOpen(false);
  };

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Users</DialogTitle>
          <DialogDescription>
            Choose your export options and download user data as CSV
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Export Type Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Export Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="current-view"
                  checked={exportType === 'current'}
                  onCheckedChange={() => setExportType('current')}
                />
                <Label htmlFor="current-view" className="text-sm font-medium">
                  Export with current view ({currentColumns.filter(col => col.visible).length} columns)
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="custom-columns"
                  checked={exportType === 'custom'}
                  onCheckedChange={() => setExportType('custom')}
                />
                <Label htmlFor="custom-columns" className="text-sm font-medium">
                  Select columns to export
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Custom Column Selection */}
          {exportType === 'custom' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Select Columns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                {AVAILABLE_COLUMNS.map(column => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`export-${column.id}`}
                      checked={selectedColumns.includes(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`export-${column.id}`} className="text-sm font-medium flex-1">
                      {column.label}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Export Summary */}
          <div className="text-sm text-muted-foreground">
            {totalUsers} users will be exported with{' '}
            {exportType === 'current' 
              ? currentColumns.filter(col => col.visible).length
              : selectedColumns.length
            } columns
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleExport} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}