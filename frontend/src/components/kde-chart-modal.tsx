'use client';

import React, { useState, useCallback, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Move, Eye, EyeOff, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KDEChart, KDEChartRef } from './kde-chart';
import * as d3 from 'd3';

interface KDEChartModalProps {
  currentPrice: number;
  isOpen: boolean;
  onClose: () => void;
}

export function KDEChartModal({ currentPrice, isOpen, onClose }: KDEChartModalProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showDensity, setShowDensity] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [currentTransform, setCurrentTransform] = useState<d3.ZoomTransform | undefined>(undefined);
  const chartRef = useRef<KDEChartRef>(null);

  const handleZoomIn = useCallback(() => {
    chartRef.current?.handleZoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    chartRef.current?.handleZoomOut();
  }, []);

  const handleResetZoom = useCallback(() => {
    chartRef.current?.handleResetZoom();
    setCurrentTransform(undefined);
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = document.querySelector('canvas') || document.querySelector('svg');
    if (canvas) {
      const dataURL = canvas instanceof HTMLCanvasElement 
        ? canvas.toDataURL('image/png')
        : new XMLSerializer().serializeToString(canvas);
      
      const link = document.createElement('a');
      link.download = 'kde-chart.png';
      link.href = dataURL;
      link.click();
    }
  }, []);

  const handleZoomChange = useCallback((transform: d3.ZoomTransform) => {
    setCurrentTransform(transform);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-[95vw] h-[90vh] max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700 bg-neutral-800/50">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-200">
                HBAR price × time probability
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Aggregated market expectations.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Current Price: ${currentPrice.toFixed(4)}</span>
              {currentTransform && (
                <span>Zoom: {Math.round(currentTransform.k * 100)}%</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={currentTransform ? currentTransform.k <= 0.1 : false}
                className="text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500 h-8 w-8 p-0"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-neutral-400 px-2">
                {currentTransform ? Math.round(currentTransform.k * 100) : 100}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={currentTransform ? currentTransform.k >= 20 : false}
                className="text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500 h-8 w-8 p-0"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
                className="text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500 h-8 w-8 p-0"
                title="Reset Zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant={showInfo ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInfo(!showInfo)}
                className="text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500 h-8 w-8 p-0"
                title="Show Info"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Info Panel */}
        {showInfo && (
          <div className="p-4 bg-neutral-800/50 border-b border-neutral-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-neutral-300">
              <div>
                <h3 className="font-semibold text-neutral-200 mb-2">Chart Controls</h3>
                <ul className="space-y-1 text-xs">
                  <li>• Mouse wheel: Zoom in/out</li>
                  <li>• Click and drag: Pan around</li>
                  <li>• Double-click: Reset zoom</li>
                  <li>• Hover: Show data points</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-200 mb-2">Visualization</h3>
                <ul className="space-y-1 text-xs">
                  <li>• Blue density: Bet concentration</li>
                  <li>• Green contours: High confidence areas</li>
                  <li>• Red markers: Individual bets</li>
                  <li>• Opacity: Bet weight/size</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-200 mb-2">Data Insights</h3>
                <ul className="space-y-1 text-xs">
                  <li>• Shows future price predictions</li>
                  <li>• Density indicates market sentiment</li>
                  <li>• Higher opacity = larger bets</li>
                  <li>• Confidence areas show consensus</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Chart Container */}
        <div className="p-4 h-full overflow-auto">
          <div className="w-full h-full">
            <KDEChart 
              ref={chartRef}
              currentPrice={currentPrice} 
              className="w-full h-full"
              enableZoom={true}
              onZoomChange={handleZoomChange}
              initialTransform={currentTransform}
              showControls={false} // Hide controls in modal to prevent duplicates
            />
          </div>
        </div>

        {/* Floating Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <div className="bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-lg p-2">
            <div className="text-xs text-neutral-400 mb-1">Quick Actions</div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInfo(!showInfo)}
                className="text-xs h-6 w-6 p-0 text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500"
                title="Toggle Info"
              >
                <Info className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
