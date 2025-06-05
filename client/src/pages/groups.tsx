import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Users, Settings, Eye } from "lucide-react";

interface Group {
  id: string;
  name: string;
  description: string;
  type: "OKTA_GROUP" | "APP_GROUP" | "BUILT_IN";
  memberCount: number;
  created: string;
  lastUpdated: string;
}

export default function Groups() {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data for groups - in real implementation, this would come from OKTA API
  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups", searchQuery],
    queryFn: async (): Promise<Group[]> => {
      // Simulate API call
      return [
        {
          id: "00g1abc2def3ghi4jkl5",
          name: "All Employees",
          description: "Default group for all company employees",
          type: "BUILT_IN" as const,
          memberCount: 156,
          created: "2023-01-15T10:00:00Z",
          lastUpdated: "2024-11-28T15:30:00Z"
        },
        {
          id: "00g2def3ghi4jkl5mno6",
          name: "Engineering Team",
          description: "Software engineers and developers",
          type: "OKTA_GROUP" as const,
          memberCount: 42,
          created: "2023-02-01T09:00:00Z",
          lastUpdated: "2024-11-25T14:20:00Z"
        },
        {
          id: "00g3ghi4jkl5mno6pqr7",
          name: "Marketing Team",
          description: "Marketing and communications staff",
          type: "OKTA_GROUP" as const,
          memberCount: 18,
          created: "2023-02-01T09:00:00Z",
          lastUpdated: "2024-11-20T11:45:00Z"
        },
        {
          id: "00g4jkl5mno6pqr7stu8",
          name: "Managers",
          description: "Team leads and department managers",
          type: "OKTA_GROUP" as const,
          memberCount: 12,
          created: "2023-02-15T10:30:00Z",
          lastUpdated: "2024-11-15T16:10:00Z"
        },
        {
          id: "00g5mno6pqr7stu8vwx9",
          name: "Microsoft 365 Users",
          description: "Users with access to Microsoft 365 applications",
          type: "APP_GROUP" as const,
          memberCount: 145,
          created: "2023-03-01T08:00:00Z",
          lastUpdated: "2024-11-28T12:00:00Z"
        }
      ].filter(group => 
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    },
  });

  const getGroupTypeBadge = (type: string) => {
    switch (type) {
      case "BUILT_IN":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Built-in</Badge>;
      case "OKTA_GROUP":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">OKTA Group</Badge>;
      case "APP_GROUP":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">App Group</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex text-sm text-gray-500 mb-1">
                <span>Directory</span>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium">Groups</span>
              </nav>
              <h2 className="text-2xl font-semibold text-gray-900">Group Management</h2>
            </div>
            <div className="flex items-center space-x-3">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Group
              </Button>
            </div>
          </div>
        </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Groups</p>
                    <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">OKTA Groups</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {groups.filter(g => g.type === "OKTA_GROUP").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">App Groups</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {groups.filter(g => g.type === "APP_GROUP").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-gray-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Members</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {groups.reduce((sum, g) => sum + g.memberCount, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Groups Table */}
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Group Name
                    </TableHead>
                    <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </TableHead>
                    <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Members
                    </TableHead>
                    <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </TableHead>
                    <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id} className="hover:bg-gray-50">
                      <TableCell className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{group.name}</div>
                          <div className="text-sm text-gray-500">{group.description}</div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {getGroupTypeBadge(group.type)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-gray-900">
                        {group.memberCount}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(group.created)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}