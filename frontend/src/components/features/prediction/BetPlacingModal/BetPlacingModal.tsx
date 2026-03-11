'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { betPlacingModalStyles } from './BetPlacingModal.styles';

export interface BetPlacingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BetPlacingModal({ isOpen, onClose }: BetPlacingModalProps) {
  if (!isOpen) return null;

  return (
    <div className={betPlacingModalStyles.overlay}>
      <div className={betPlacingModalStyles.panel}>
        <button
          type="button"
          onClick={onClose}
          className={betPlacingModalStyles.closeButton}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex justify-center mb-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h3 className={betPlacingModalStyles.title}>Bet in progress</h3>
        <div className={betPlacingModalStyles.description}>
          <p>Your bet is being processed.</p>
          <p>It takes a couple of minutes to complete.</p>
        </div>
      </div>
    </div>
  );
}
