import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface AddMonitoringCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  integrationsData?: any[];
}

export function AddMonitoringCardModal({ isOpen, onClose, integrationsData = [] }: AddMonitoringCardModalProps) {
  const { toast } = useToast();
  
  const [cardName, setCardName] = useState("");
  const [cardType, setCardType] = useState("");
  const [cardDescription, setCardDescription] = useState("");

  // Available card types for monitoring
  const cardTypes = [
    { value: "system_health", label: "System Health" },
    { value: "security_alerts", label: "Security Alerts" },
    { value: "performance", label: "Performance Monitor" },
    { value: "uptime", label: "Uptime Monitor" },
    { value: "backup_status", label: "Backup Status" },
    { value: "compliance", label: "Compliance Check" },
    { value: "custom", label: "Custom Monitor" },
    ...integrationsData.map((integration: any) => ({
      value: integration.name + "_monitor",
      label: `${integration.displayName || integration.name} Monitor`
    }))
  ];

  const createCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const response = await apiRequest("POST", "/api/monitoring-cards", cardData);
      if (!response.ok) {
        throw new Error("Failed to create monitoring card");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring-cards"] });
      toast({
        title: "Success",
        description: "Monitoring card added successfully",
      });
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add monitoring card",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCardName("");
    setCardType("");
    setCardDescription("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cardName.trim() || !cardType) {
      toast({
        title: "Error", 
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const cardData = {
      name: cardName.trim(),
      type: cardType,
      description: cardDescription.trim() || `${cardName} monitoring card`,
      enabled: true,
      position: 999 // Will be adjusted by backend
    };

    createCardMutation.mutate(cardData);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>Add Monitoring Card</DialogTitle>
          <DialogDescription>
            Add a new monitoring card to track system health, security alerts, or custom metrics.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="cardName">Card Name *</Label>
            <Input
              id="cardName"
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Enter card name"
              className="bg-white dark:bg-gray-700"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cardType">Monitor Type *</Label>
            <Select value={cardType} onValueChange={setCardType}>
              <SelectTrigger className="bg-white dark:bg-gray-700">
                <SelectValue placeholder="Select monitor type" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800">
                {cardTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cardDescription">Description</Label>
            <Input
              id="cardDescription"
              type="text"
              value={cardDescription}
              onChange={(e) => setCardDescription(e.target.value)}
              placeholder="Optional description"
              className="bg-white dark:bg-gray-700"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={createCardMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createCardMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {createCardMutation.isPending ? "Adding..." : "Add Card"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}