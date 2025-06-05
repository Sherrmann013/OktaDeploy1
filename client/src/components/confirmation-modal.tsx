import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-1">
                {message}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={onConfirm}
            className={variant === "destructive" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
          >
            {confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
