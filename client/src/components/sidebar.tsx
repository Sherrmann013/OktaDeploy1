import { Link, useLocation } from "wouter";
import { Shield, Users, UsersRound, Grid3x3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  { name: "Users", href: "/users", icon: Users, current: true },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-32 bg-background shadow-md border-r border-border flex-shrink-0 flex flex-col">
      <div className="p-3 border-b border-border bg-purple-600 dark:bg-purple-700">
        <div className="text-center">
          <div className="relative inline-block mb-1">
            <svg width="64" height="32" viewBox="0 0 64 32" className="mx-auto">
              {/* Background */}
              <rect width="64" height="32" fill="#7c3aed" rx="3"/>
              
              {/* MAZE logo - recreating the block letter style */}
              <g fill="#f97316" stroke="#14b8a6" strokeWidth="0.8">
                {/* M */}
                <rect x="4" y="8" width="3" height="12"/>
                <rect x="4" y="8" width="8" height="3"/>
                <rect x="9" y="8" width="3" height="12"/>
                <rect x="6" y="12" width="3" height="3"/>
                
                {/* A */}
                <rect x="14" y="11" width="8" height="3"/>
                <rect x="14" y="8" width="3" height="12"/>
                <rect x="19" y="8" width="3" height="12"/>
                <rect x="14" y="8" width="8" height="3"/>
                <rect x="14" y="14" width="8" height="3"/>
                
                {/* Z */}
                <rect x="25" y="8" width="8" height="3"/>
                <rect x="25" y="17" width="8" height="3"/>
                <rect x="28" y="11" width="3" height="3"/>
                <rect x="30" y="14" width="3" height="3"/>
                
                {/* E */}
                <rect x="36" y="8" width="3" height="12"/>
                <rect x="36" y="8" width="8" height="3"/>
                <rect x="36" y="13" width="6" height="3"/>
                <rect x="36" y="17" width="8" height="3"/>
              </g>
            </svg>
          </div>
          <div className="text-xs text-white/80">Powered by ClockWerk</div>
        </div>
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
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
      
      {/* Theme Toggle at Bottom */}
      <div className="p-4 border-t border-border">
        <div className="flex justify-center">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
