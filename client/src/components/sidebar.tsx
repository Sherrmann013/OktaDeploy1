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
            <div className="relative w-12 h-12 mx-auto rounded bg-purple-600 flex items-center justify-center">
              <img 
                src="/maze-logo.png" 
                alt="MAZE Logo" 
                className="w-10 h-10"
                style={{
                  filter: 'brightness(0) saturate(100%) invert(54%) sepia(77%) saturate(1234%) hue-rotate(10deg) brightness(102%) contrast(101%)'
                }}
              />
            </div>
          </div>
          <div className="text-[10px] text-white/80 leading-tight">Powered by ClockWerk</div>
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
