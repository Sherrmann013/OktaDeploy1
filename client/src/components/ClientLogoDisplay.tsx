import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

interface ClientLogoDisplayProps {
  clientId: number;
  clientName: string;
  className?: string;
}

interface ClientLogo {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  logoData: string;
  isActive: boolean;
  uploadedAt: string;
  uploadedBy?: number;
}

export function ClientLogoDisplay({ clientId, clientName, className = "w-16 h-16" }: ClientLogoDisplayProps) {
  const { data: activeLogo } = useQuery<ClientLogo>({
    queryKey: [`/api/client/${clientId}/company-logos/active`],
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: false, // Don't retry if no active logo
  });

  if (activeLogo?.logoData) {
    return (
      <img 
        src={activeLogo.logoData} 
        alt={`${clientName} logo`}
        className={`${className} object-contain rounded-lg`}
      />
    );
  }

  // Fallback to generic building icon
  return (
    <div className={`${className} bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center`}>
      <Building2 className="w-8 h-8 text-gray-400 dark:text-gray-500" />
    </div>
  );
}