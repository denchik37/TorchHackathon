'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BetPlacingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BetPlacingModal({ isOpen, onClose, onViewExplorer }: BetPlacingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-dark-slate rounded-lg p-6 w-96 max-w-[90vw] relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Loading Indicator */}
        <div className="flex justify-center mb-4">
          <Loader2 className="w-8 h-8 text-vibrant-purple animate-spin" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-2">Bet in progress</h3>

        {/* Description */}
        <div className="text-center text-gray-300 mb-6 space-y-1">
          <p>Your bet is being processed.</p>
          <p>It takes a couple of minutes to complete.</p>
        </div>

      </div>
    </div>
  );
}
