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
            <svg width="44" height="44" viewBox="0 0 44 44" className="mx-auto">
              {/* Purple background */}
              <rect width="44" height="44" fill="#7c3aed" rx="4"/>
              
              {/* MAZE logo - accurate recreation of the 2x2 grid design */}
              <g fill="#f97316">
                {/* M - top left quadrant */}
                <rect x="4" y="4" width="16" height="16" rx="1"/>
                <g fill="#7c3aed">
                  <rect x="6" y="8" width="2" height="8"/>
                  <rect x="10" y="8" width="2" height="8"/>
                  <rect x="14" y="8" width="2" height="8"/>
                  <rect x="8" y="10" width="2" height="3"/>
                  <rect x="12" y="10" width="2" height="3"/>
                </g>
                
                {/* A - top right quadrant */}
                <rect x="24" y="4" width="16" height="16" rx="1"/>
                <g fill="#7c3aed">
                  <rect x="26" y="10" width="2" height="6"/>
                  <rect x="36" y="10" width="2" height="6"/>
                  <rect x="28" y="8" width="8" height="2"/>
                  <rect x="30" y="12" width="4" height="2"/>
                </g>
                
                {/* Z - bottom left quadrant */}
                <rect x="4" y="24" width="16" height="16" rx="1"/>
                <g fill="#7c3aed">
                  <rect x="6" y="28" width="12" height="2"/>
                  <rect x="6" y="36" width="12" height="2"/>
                  <polygon points="14,30 16,30 8,34 6,34"/>
                </g>
                
                {/* E - bottom right quadrant */}
                <rect x="24" y="24" width="16" height="16" rx="1"/>
                <g fill="#7c3aed">
                  <rect x="26" y="28" width="2" height="10"/>
                  <rect x="28" y="28" width="8" height="2"/>
                  <rect x="28" y="32" width="6" height="2"/>
                  <rect x="28" y="36" width="8" height="2"/>
                </g>
              </g>
            </svg>
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
