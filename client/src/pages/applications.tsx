import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Grid3x3, Settings, Eye, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Application {
  id: string;
  name: string;
  label: string;
  status: "ACTIVE" | "INACTIVE";
  signOnMode: "SAML_2_0" | "OPENID_CONNECT" | "SECURE_WEB_AUTHENTICATION" | "AUTO_LOGIN";
  userCount: number;
  created: string;
  lastUpdated: string;
  logo?: string;
}

export default function Applications() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user: currentUser } = useAuth();

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications", searchQuery],
    queryFn: async (): Promise<Application[]> => {
      return [
        {
          id: "0oa1abc2def3ghi4jkl5",
          name: "Microsoft 365",
          label: "Office 365",
          status: "ACTIVE" as const,
          signOnMode: "SAML_2_0" as const,
          userCount: 156,
          created: "2023-01-15T10:00:00Z",
          lastUpdated: "2024-11-28T15:30:00Z"
        },
        {
          id: "0oa2def3ghi4jkl5mno6",
          name: "Slack",
          label: "Slack Workspace",
          status: "ACTIVE" as const,
          signOnMode: "OPENID_CONNECT" as const,
          userCount: 89,
          created: "2023-02-01T09:00:00Z",
          lastUpdated: "2024-11-25T14:20:00Z"
        },
        {
          id: "0oa3ghi4jkl5mno6pqr7",
          name: "GitHub",
          label: "GitHub Enterprise",
          status: "ACTIVE" as const,
          signOnMode: "SAML_2_0" as const,
          userCount: 42,
          created: "2023-02-10T11:00:00Z",
          lastUpdated: "2024-11-20T16:45:00Z"
        },
        {
          id: "0oa4jkl5mno6pqr7stu8",
          name: "Zoom",
          label: "Zoom Meetings",
          status: "INACTIVE" as const,
          signOnMode: "AUTO_LOGIN" as const,
          userCount: 25,
          created: "2023-03-01T08:00:00Z",
          lastUpdated: "2024-10-15T12:30:00Z"
        }
      ].filter(app => 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "INACTIVE":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSignOnModeBadge = (mode: string) => {
    const modeMap = {
      "SAML_2_0": "SAML 2.0",
      "OPENID_CONNECT": "OpenID Connect",
      "SECURE_WEB_AUTHENTICATION": "SWA",
      "AUTO_LOGIN": "Auto Login"
    };
    return <Badge variant="outline">{modeMap[mode as keyof typeof modeMap] || mode}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const activeApps = applications.filter(app => app.status === "ACTIVE");
  const totalUsers = applications.reduce((sum, app) => sum + app.userCount, 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <nav className="flex text-sm text-gray-500 mb-1">
              <span>Directory</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 font-medium">Applications</span>
            </nav>
            <h2 className="text-2xl font-semibold text-gray-900">Application Management</h2>
          </div>
          <div className="flex items-center space-x-3">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Application
            </Button>
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg border">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
                </span>
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-900">{currentUser?.firstName} {currentUser?.lastName}</p>
                <p className="text-gray-500">{currentUser?.email}</p>
              </div>
            </div>
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
              placeholder="Search applications..."
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
                <Grid3x3 className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Applications</p>
                  <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Grid3x3 className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Apps</p>
                  <p className="text-2xl font-bold text-gray-900">{activeApps.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Grid3x3 className="w-8 h-8 text-gray-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Grid3x3 className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">SSO Apps</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {applications.filter(app => app.signOnMode === "SAML_2_0" || app.signOnMode === "OPENID_CONNECT").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Application
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sign-On Mode
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Grid3x3 className="w-6 h-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{app.name}</div>
                          <div className="text-sm text-gray-500">{app.label}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {getStatusBadge(app.status)}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {getSignOnModeBadge(app.signOnMode)}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-gray-900">
                      {app.userCount}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(app.lastUpdated)}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        >
                          <ExternalLink className="w-4 h-4" />
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
  );
}