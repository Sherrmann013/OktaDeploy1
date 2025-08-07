import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AddDashboardCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  integrationsData?: any[];
}

export function AddDashboardCardModal({ isOpen, onClose, integrationsData = [] }: AddDashboardCardModalProps) {
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Detect current client context from URL
  const currentClientId = location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1;
  
  const [cardName, setCardName] = useState("");
  const [cardType, setCardType] = useState("");
  const [cardDescription, setCardDescription] = useState("");

  // Available card types based on integrations plus custom
  const cardTypes = [
    { value: "custom", label: "Custom Card" },
    ...integrationsData.map((integration: any) => ({
      value: integration.name,
      label: integration.displayName || integration.name
    }))
  ];

  const createCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const endpoint = `/api/client/${currentClientId}/dashboard-cards`;
      const response = await apiRequest("POST", endpoint, cardData);
      if (!response.ok) {
        throw new Error("Failed to create dashboard card");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/dashboard-cards`] });
      toast({
        title: "Success",
        description: "Dashboard card added successfully",
      });
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add dashboard card",
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
      description: cardDescription.trim() || `${cardName} dashboard card`,
      enabled: true,
      clientId: currentClientId,
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
          <DialogTitle>Add Dashboard Card</DialogTitle>
          <DialogDescription>
            Add a new card to your dashboard to display integration data or custom information.
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
            <Label htmlFor="cardType">Card Type *</Label>
            <Select value={cardType} onValueChange={setCardType}>
              <SelectTrigger className="bg-white dark:bg-gray-700">
                <SelectValue placeholder="Select card type" />
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createCardMutation.isPending ? "Adding..." : "Add Card"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}