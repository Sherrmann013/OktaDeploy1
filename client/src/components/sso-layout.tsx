import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";

interface SSOLayoutProps {
  children: React.ReactNode;
}

export default function SSOLayout({ children }: SSOLayoutProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}