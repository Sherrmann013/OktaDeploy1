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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current logo setting
  const { data: currentLogo } = useQuery({
    queryKey: ['/api/layout-settings/company_logo'],
    enabled: isOpen,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const response = await apiRequest('POST', '/api/layout-settings', {
        settingKey: 'company_logo',
        settingValue: base64,
        settingType: 'logo',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/layout-settings'] });
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
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/layout-settings/company_logo');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/layout-settings'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove logo",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleRemove = () => {
    deleteMutation.mutate();
  };

  const currentLogoUrl = currentLogo?.settingValue;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Company Logo</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current Logo Display */}
          <div>
            <Label className="text-sm font-medium">Current Logo</Label>
            <div className="mt-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
              {currentLogoUrl ? (
                <div className="flex items-center justify-between">
                  <img 
                    src={currentLogoUrl} 
                    alt="Current logo" 
                    className="max-h-16 w-auto object-contain"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemove}
                    disabled={deleteMutation.isPending}
                    className="ml-4 text-red-600 hover:text-red-700"
                  >
                    {deleteMutation.isPending ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <span className="text-sm">No logo uploaded</span>
                </div>
              )}
            </div>
          </div>

          {/* File Upload */}
          <div>
            <Label className="text-sm font-medium">Upload New Logo</Label>
            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-dashed border-2 h-24 flex flex-col items-center justify-center gap-2"
                >
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Click to select image
                  </span>
                  <span className="text-xs text-gray-500">
                    PNG, JPG up to 5MB
                  </span>
                </Button>

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
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Logo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}