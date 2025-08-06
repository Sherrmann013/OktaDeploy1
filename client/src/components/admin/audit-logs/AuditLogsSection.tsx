import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  // Fetch audit logs from database
  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery<{logs: AuditLog[], pagination: any}>({
    queryKey: ["/api/audit-logs"],
    staleTime: 5 * 60 * 1000, // 5 minutes - logs don't change frequently
    refetchOnWindowFocus: false,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Track all administrative actions and system changes with detailed audit logging.
        </p>
        {auditLogsLoading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading audit logs...</div>
          </div>
        ) : auditLogsData?.logs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">No audit logs found</div>
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
                {auditLogsData?.logs.map((log) => (
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
            
            {auditLogsData?.pagination && auditLogsData.pagination.total > 50 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Showing latest {auditLogsData.logs.length} of {auditLogsData.pagination.total} audit logs
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}