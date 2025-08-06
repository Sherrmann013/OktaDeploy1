import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomSelect, CustomSelectContent, CustomSelectItem, CustomSelectTrigger, CustomSelectValue } from "@/components/ui/custom-select";
import { Search, X, Filter, Download } from "lucide-react";

interface AuditLog {
  id: number;
  userId: number | null;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  details: Record<string, any>;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

export function AuditLogsSection() {
  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [displayLimit, setDisplayLimit] = useState(50);

  // Fetch audit logs from database
  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery<{logs: AuditLog[], pagination: any}>({
    queryKey: ["/api/audit-logs"],
    staleTime: 5 * 60 * 1000, // 5 minutes - logs don't change frequently
    refetchOnWindowFocus: false,
  });

  // Sort logs newest first and apply filters
  const filteredAndSortedLogs = useMemo(() => {
    if (!auditLogsData?.logs) return [];
    
    let filtered = [...auditLogsData.logs];
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.userEmail.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.resourceType.toLowerCase().includes(term) ||
        (log.resourceName && log.resourceName.toLowerCase().includes(term)) ||
        JSON.stringify(log.details).toLowerCase().includes(term)
      );
    }
    
    // Apply action filter
    if (actionFilter !== "all") {
      filtered = filtered.filter(log => log.action.includes(actionFilter.toUpperCase()));
    }
    
    // Apply user filter
    if (userFilter) {
      filtered = filtered.filter(log => 
        log.userEmail.toLowerCase().includes(userFilter.toLowerCase())
      );
    }
    
    // Apply resource filter
    if (resourceFilter !== "all") {
      filtered = filtered.filter(log => log.resourceType === resourceFilter);
    }
    
    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "yesterday":
          filterDate.setDate(filterDate.getDate() - 1);
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(filterDate.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(filterDate.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        if (dateFilter === "yesterday") {
          const dayAfter = new Date(filterDate);
          dayAfter.setDate(dayAfter.getDate() + 1);
          return logDate >= filterDate && logDate < dayAfter;
        }
        return logDate >= filterDate;
      });
    }
    
    return filtered;
  }, [auditLogsData?.logs, searchTerm, actionFilter, userFilter, resourceFilter, dateFilter]);

  // Get unique values for filter dropdowns (remove duplicates and sort)
  const uniqueActions = useMemo(() => {
    if (!auditLogsData?.logs) return [];
    const actions = Array.from(new Set(auditLogsData.logs.map(log => log.action)));
    return actions.sort();
  }, [auditLogsData?.logs]);

  // Apply display limit to filtered results
  const displayedLogs = useMemo(() => {
    return filteredAndSortedLogs.slice(0, displayLimit);
  }, [filteredAndSortedLogs, displayLimit]);

  const uniqueResources = useMemo(() => {
    if (!auditLogsData?.logs) return [];
    const resources = Array.from(new Set(auditLogsData.logs.map(log => log.resourceType)));
    return resources.sort();
  }, [auditLogsData?.logs]);

  const clearFilters = () => {
    setSearchTerm("");
    setActionFilter("all");
    setUserFilter("");
    setResourceFilter("all");
    setDateFilter("all");
  };

  const hasActiveFilters = searchTerm || actionFilter !== "all" || userFilter || resourceFilter !== "all" || dateFilter !== "all";

  // Export functionality
  const exportLogs = (format: 'csv' | 'json') => {
    const logsToExport = filteredAndSortedLogs;
    
    if (format === 'csv') {
      const headers = ['Timestamp', 'User Email', 'Action', 'Resource Type', 'Resource Name', 'Details', 'IP Address', 'User Agent'];
      const csvContent = [
        headers.join(','),
        ...logsToExport.map(log => [
          `"${new Date(log.timestamp).toISOString()}"`,
          `"${log.userEmail}"`,
          `"${log.action}"`,
          `"${log.resourceType}"`,
          `"${log.resourceName || ''}"`,
          `"${JSON.stringify(log.details).replace(/"/g, '""')}"`,
          `"${log.ipAddress || ''}"`,
          `"${log.userAgent || ''}"`
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const jsonContent = JSON.stringify(logsToExport, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Audit Logs</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Track all administrative actions and system changes with detailed audit logging.
            </p>
          </div>
          <div className="flex gap-2">
            {/* Export Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportLogs('csv')}
              className="text-muted-foreground hover:text-foreground"
            >
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportLogs('json')}
              className="text-muted-foreground hover:text-foreground"
            >
              <Download className="w-4 h-4 mr-1" />
              JSON
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters Section */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-4">
            {/* Search Input */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search logs by user, action, resource, or details..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white dark:bg-gray-800"
                />
              </div>
            </div>
            
            {/* User Filter */}
            <div className="min-w-[180px]">
              <Input
                placeholder="Filter by user email..."
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="bg-white dark:bg-gray-800"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            {/* Action Filter */}
            <div className="min-w-[150px]">
              <CustomSelect value={actionFilter} onValueChange={setActionFilter}>
                <CustomSelectTrigger className="bg-white dark:bg-gray-800">
                  <CustomSelectValue placeholder="Action Type" />
                </CustomSelectTrigger>
                <CustomSelectContent>
                  <CustomSelectItem value="all">All Actions</CustomSelectItem>
                  {uniqueActions.map(action => (
                    <CustomSelectItem key={action} value={action}>{action}</CustomSelectItem>
                  ))}
                </CustomSelectContent>
              </CustomSelect>
            </div>
            
            {/* Resource Filter */}
            <div className="min-w-[150px]">
              <CustomSelect value={resourceFilter} onValueChange={setResourceFilter}>
                <CustomSelectTrigger className="bg-white dark:bg-gray-800">
                  <CustomSelectValue placeholder="Resource Type" />
                </CustomSelectTrigger>
                <CustomSelectContent>
                  <CustomSelectItem value="all">All Resources</CustomSelectItem>
                  {uniqueResources.map(resource => (
                    <CustomSelectItem key={resource} value={resource}>{resource}</CustomSelectItem>
                  ))}
                </CustomSelectContent>
              </CustomSelect>
            </div>
            
            {/* Date Filter */}
            <div className="min-w-[150px]">
              <CustomSelect value={dateFilter} onValueChange={setDateFilter}>
                <CustomSelectTrigger className="bg-white dark:bg-gray-800">
                  <CustomSelectValue placeholder="Time Period" />
                </CustomSelectTrigger>
                <CustomSelectContent>
                  <CustomSelectItem value="all">All Time</CustomSelectItem>
                  <CustomSelectItem value="today">Today</CustomSelectItem>
                  <CustomSelectItem value="yesterday">Yesterday</CustomSelectItem>
                  <CustomSelectItem value="week">Last 7 Days</CustomSelectItem>
                  <CustomSelectItem value="month">Last 30 Days</CustomSelectItem>
                </CustomSelectContent>
              </CustomSelect>
            </div>
          </div>
          
          {/* Display Limit and Results Summary */}
          {auditLogsData?.logs && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>
                  Showing {displayedLogs.length} of {filteredAndSortedLogs.length} filtered results
                  {auditLogsData.logs.length !== filteredAndSortedLogs.length && ` (${auditLogsData.logs.length} total)`}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Display:</span>
                  <CustomSelect value={displayLimit.toString()} onValueChange={(value) => setDisplayLimit(parseInt(value))}>
                    <CustomSelectTrigger className="w-20 h-7 text-xs bg-white dark:bg-gray-800">
                      <CustomSelectValue />
                    </CustomSelectTrigger>
                    <CustomSelectContent>
                      <CustomSelectItem value="50">50</CustomSelectItem>
                      <CustomSelectItem value="100">100</CustomSelectItem>
                      <CustomSelectItem value="200">200</CustomSelectItem>
                    </CustomSelectContent>
                  </CustomSelect>
                </div>
              </div>
              <span className="text-xs">Sorted by newest first</span>
            </div>
          )}
        </div>
        {auditLogsLoading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading audit logs...</div>
          </div>
        ) : auditLogsData?.logs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">No audit logs found</div>
          </div>
        ) : filteredAndSortedLogs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">No audit logs match your current filters</div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="mt-2"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {log.userEmail}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        log.action.includes('DELETE') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        log.action.includes('CREATE') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        log.action.includes('LOGIN') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <div className="font-medium">{log.resourceType}</div>
                        {log.resourceName && (
                          <div className="text-muted-foreground">{log.resourceName}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs">
                      <div className="truncate">
                        {log.details.action || Object.keys(log.details).map(key => 
                          `${key}: ${JSON.stringify(log.details[key])}`
                        ).join(', ')}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {auditLogsData?.pagination && auditLogsData.pagination.total > auditLogsData.logs.length && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Database contains {auditLogsData.pagination.total} total audit logs (showing latest {auditLogsData.logs.length})
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}