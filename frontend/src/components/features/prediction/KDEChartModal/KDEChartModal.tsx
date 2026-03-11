'use client';

import React, { useState, useCallback, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KDEChart, KDEChartRef } from '../KDEChart';
import * as d3 from 'd3';
import { kdeChartModalStyles } from './KDEChartModal.styles';

export interface KDEChartModalProps {
  currentPrice: number;
  isOpen: boolean;
  onClose: () => void;
}

export function KDEChartModal({ currentPrice, isOpen, onClose }: KDEChartModalProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [currentTransform, setCurrentTransform] = useState<d3.ZoomTransform | undefined>(undefined);
  const chartRef = useRef<KDEChartRef>(null);

  const handleZoomIn = useCallback(() => chartRef.current?.handleZoomIn(), []);
  const handleZoomOut = useCallback(() => chartRef.current?.handleZoomOut(), []);
  const handleResetZoom = useCallback(() => {
    chartRef.current?.handleResetZoom();
    setCurrentTransform(undefined);
  }, []);
  const handleZoomChange = useCallback((transform: d3.ZoomTransform) => setCurrentTransform(transform), []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0">
      <div className={kdeChartModalStyles.backdrop} onClick={onClose} aria-hidden />
      <div className={kdeChartModalStyles.modal}>
        <div className={kdeChartModalStyles.header}>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h2 className={kdeChartModalStyles.headerTitle}>HBAR price × time probability</h2>
              <p className={kdeChartModalStyles.headerSubtitle}>Aggregated market expectations.</p>
            </div>
            <div className={kdeChartModalStyles.headerMeta}>
              <span>Current: ${currentPrice.toFixed(4)}</span>
              {currentTransform && <span>Zoom: {Math.round(currentTransform.k * 100)}%</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={kdeChartModalStyles.zoomGroup}>
              <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={currentTransform ? currentTransform.k <= 0.1 : false} className={kdeChartModalStyles.zoomButton} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className={kdeChartModalStyles.zoomLabel}>{currentTransform ? Math.round(currentTransform.k * 100) : 100}%</span>
              <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={currentTransform ? currentTransform.k >= 20 : false} className={kdeChartModalStyles.zoomButton} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetZoom} className={kdeChartModalStyles.zoomButton} title="Reset Zoom">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <Button variant={showInfo ? 'default' : 'outline'} size="sm" onClick={() => setShowInfo(!showInfo)} className={kdeChartModalStyles.zoomButton} title="Show Info">
              <Info className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className={kdeChartModalStyles.closeButton} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {showInfo && (
          <div className={kdeChartModalStyles.infoPanel}>
            <div className={kdeChartModalStyles.infoGrid}>
              <div>
                <h3 className={kdeChartModalStyles.infoSectionTitle}>Chart Controls</h3>
                <ul className={kdeChartModalStyles.infoList}>
                  <li>• Mouse wheel: Zoom in/out</li>
                  <li>• Click and drag: Pan around</li>
                  <li>• Double-click: Reset zoom</li>
                  <li>• Hover: Show data points</li>
                </ul>
              </div>
              <div>
                <h3 className={kdeChartModalStyles.infoSectionTitle}>Visualization</h3>
                <ul className={kdeChartModalStyles.infoList}>
                  <li>• Blue density: Bet concentration</li>
                  <li>• Green contours: High confidence areas</li>
                  <li>• Red markers: Individual bets</li>
                  <li>• Opacity: Bet weight/size</li>
                </ul>
              </div>
              <div>
                <h3 className={kdeChartModalStyles.infoSectionTitle}>Data Insights</h3>
                <ul className={kdeChartModalStyles.infoList}>
                  <li>• Shows future price predictions</li>
                  <li>• Density indicates market sentiment</li>
                  <li>• Higher opacity = larger bets</li>
                  <li>• Confidence areas show consensus</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        <div className={kdeChartModalStyles.chartArea}>
          <div className="w-full h-full min-h-[320px]">
            <KDEChart
              ref={chartRef}
              currentPrice={currentPrice}
              className="w-full h-full"
              enableZoom
              onZoomChange={handleZoomChange}
              initialTransform={currentTransform}
              showControls={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
