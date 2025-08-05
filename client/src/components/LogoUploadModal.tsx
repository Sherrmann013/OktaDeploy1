import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface LogoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogoUploadModal({ isOpen, onClose }: LogoUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all logos
  const { data: allLogos = [] } = useQuery({
    queryKey: ['/api/company-logos'],
    enabled: isOpen,
  });

  // Get active logo
  const { data: activeLogo } = useQuery({
    queryKey: ['/api/company-logos/active'],
    enabled: isOpen,
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const response = await apiRequest('POST', '/api/company-logos', {
        logoData: base64,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        isActive: allLogos.length === 0, // Make active if it's the first logo
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company-logos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company-logos/active'] });
      onClose();
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (logoId: number) => {
      const response = await apiRequest('DELETE', `/api/company-logos/${logoId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company-logos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company-logos/active'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove logo",
        variant: "destructive",
      });
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: async (logoId: number) => {
      const response = await apiRequest('PUT', `/api/company-logos/${logoId}/activate`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo activated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company-logos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company-logos/active'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to activate logo",
        variant: "destructive",
      });
    },
  });

  const validateAndProcessFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return false;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return false;
    }

    setSelectedFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      validateAndProcessFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleRemove = () => {
    // This function is no longer used as individual logos can be deleted through the grid
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Company Logos</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Existing Logos */}
          {allLogos.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Saved Logos ({allLogos.length}/3)</h3>
              <div className="grid grid-cols-3 gap-4">
                {allLogos.map((logo: any) => (
                  <div 
                    key={logo.id} 
                    className={`border rounded-lg p-3 text-center transition-all ${
                      logo.isActive 
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <img 
                      src={logo.logoData} 
                      alt={logo.fileName} 
                      className="h-16 w-full object-contain mb-2"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-2">
                      {logo.fileName}
                    </p>
                    <div className="flex flex-col gap-1">
                      {!logo.isActive ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setActiveMutation.mutate(logo.id)}
                          disabled={setActiveMutation.isPending}
                          className="text-xs h-7"
                        >
                          {setActiveMutation.isPending ? "Setting..." : "Set Active"}
                        </Button>
                      ) : (
                        <div className="text-xs text-orange-600 dark:text-orange-400 font-medium py-1">
                          Active
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => deleteMutation.mutate(logo.id)}
                        disabled={deleteMutation.isPending}
                        className="text-xs h-7 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload New Logo Section */}
          {allLogos.length < 3 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Upload New Logo</h3>
              <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full border-dashed border-2 h-24 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                    isDragOver 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {isDragOver ? 'Drop image here' : 'Click to select image or drag & drop'}
                  </span>
                  <span className="text-xs text-gray-500">
                    PNG, JPG up to 5MB
                  </span>
                </div>

                {/* Preview Selected Image */}
                {previewUrl && (
                  <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={previewUrl} 
                          alt="Preview" 
                          className="max-h-16 w-auto object-contain"
                        />
                        <div>
                          <p className="text-sm font-medium">{selectedFile?.name}</p>
                          <p className="text-xs text-gray-500">
                            {selectedFile && (selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Upload Button for selected file */}
              {selectedFile && (
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploadMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </div>
              )}
            </div>
            </div>
          )}

          {/* Info message when at limit */}
          {allLogos.length >= 3 && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              Maximum of 3 logos allowed. Delete a logo to upload a new one.
            </div>
          )}
        </div>
        
        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}