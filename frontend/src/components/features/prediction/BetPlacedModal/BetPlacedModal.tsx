'use client';

import React from 'react';
import { X, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { betPlacedModalStyles } from './BetPlacedModal.styles';

export interface BetPlacedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewExplorer: () => void;
}

export function BetPlacedModal({ isOpen, onClose, onViewExplorer }: BetPlacedModalProps) {
  if (!isOpen) return null;

  return (
    <div className={betPlacedModalStyles.overlay}>
      <div className={betPlacedModalStyles.panel}>
        <button
          type="button"
          onClick={onClose}
          className={betPlacedModalStyles.closeButton}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex justify-center mb-4">
          <div className={betPlacedModalStyles.successIcon}>
            <Check className="w-6 h-6 text-destructive-foreground" />
          </div>
        </div>
        <h3 className={betPlacedModalStyles.title}>Bet placed</h3>
        <div className={betPlacedModalStyles.description}>
          <p>The transaction has been completed.</p>
          <p>You can close this window now.</p>
        </div>
        <Button onClick={onViewExplorer} className={betPlacedModalStyles.explorerButton}>
          <ExternalLink className="w-4 h-4 mr-2" />
          View in explorer
        </Button>
      </div>
    </div>
  );
}
