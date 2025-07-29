import React from "react";
import { Link, useLocation } from "wouter";
import { Shield, Users, UsersRound, Grid3x3, Settings, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const navigation = [
  { name: "Users", href: "/users", icon: Users, current: true },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user: currentUser } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // OKTA sync mutation
  const oktaSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync-okta");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-type-counts"] });
      toast({
        title: "Success",
        description: "OKTA users synchronized successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to sync OKTA users: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return (
    <aside className="w-32 bg-white dark:bg-gray-800 shadow-md border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 sidebar-purple flex flex-col rounded-br-lg">
        <div className="text-center flex-1">
          <div className="relative inline-block mb-1">
            <div className="relative w-24 h-24 mx-auto rounded bg-purple-600 flex items-center justify-center">
              <div className="relative w-20 h-20">
                <img 
                  src="/maze-logo.png" 
                  alt="MAZE Logo" 
                  className="w-20 h-20 absolute inset-0 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-white/80 leading-none mt-auto whitespace-nowrap -ml-1">Powered by ClockWerk.it</div>
      </div>
      
      <nav className="p-4 flex-1">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href === "/" && location.startsWith("/users"));
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* User Profile and Controls at Bottom */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-3">
          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center p-0 hover:bg-blue-700"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <span className="text-white text-sm font-medium">
                {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
              </span>
            </Button>
            {showUserDropdown && (
              <div className="absolute bottom-10 left-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{currentUser?.firstName} {currentUser?.lastName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{currentUser?.email}</p>
                </div>
                <div className="p-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      oktaSyncMutation.mutate();
                      setShowUserDropdown(false);
                    }}
                    disabled={oktaSyncMutation.isPending}
                    className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <RotateCcw className={`w-4 h-4 mr-2 ${oktaSyncMutation.isPending ? 'animate-spin' : ''}`} />
                    Sync OKTA
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
