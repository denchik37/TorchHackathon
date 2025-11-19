'use client';

import { gql, useQuery } from '@apollo/client';

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import { cn, formatTinybarsToHbar } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { KDEChartModal } from './kde-chart-modal';

interface KDEChartProps {
  className?: string;
  currentPrice: number;
  enableZoom?: boolean;
  onZoomChange?: (transform: d3.ZoomTransform) => void;
  initialTransform?: d3.ZoomTransform;
  showControls?: boolean;
}

export interface KDEChartRef {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
}

const GET_BETS = gql`
  query {
    bets(first: 100, orderBy: timestamp, orderDirection: desc) {
      targetTimestamp
      weight
      priceMin
      priceMax
      payout
    }
  }
`;

// Enhanced KDE calculation with adaptive bandwidth
function calculateAdaptiveBandwidth(data: any[], xScale: d3.ScaleTime<number, number>, yScale: d3.ScaleLinear<number, number>) {
  const n = data.length;
  if (n < 2) return 35; // Default bandwidth
  
  // Calculate local density for adaptive bandwidth
  const localDensities = data.map((d, i) => {
    const distances = data.map((other, j) => {
      if (i === j) return Infinity;
      const dx = xScale(d.time) - xScale(other.time);
      const dy = yScale(d.price) - yScale(other.price);
      return Math.sqrt(dx * dx + dy * dy);
    });
    return Math.min(...distances);
  });
  
  // Use median of local densities for adaptive bandwidth
  const medianDistance = d3.median(localDensities) || 35;
  const adaptiveBandwidth = Math.max(20, Math.min(60, medianDistance * 0.8));
  
  return adaptiveBandwidth;
}

// Improved weight scaling function
function calculateWeightScale(weights: number[]) {
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const medianWeight = d3.median(weights) || 0;
  
  // Use log scale for better distribution of weights
  const logWeights = weights.map(w => Math.log(w + 1));
  const logMin = Math.log(minWeight + 1);
  const logMax = Math.log(maxWeight + 1);
  
  return weights.map(w => {
    const logW = Math.log(w + 1);
    // Normalize to 0-1 range with emphasis on higher weights
    return Math.pow((logW - logMin) / (logMax - logMin), 0.7);
  });
}

export const KDEChart = forwardRef<KDEChartRef, KDEChartProps>(({ 
  className, 
  currentPrice, 
  enableZoom = false, 
  onZoomChange,
  initialTransform,
  showControls = true
}, ref) => {
  const { data } = useQuery(GET_BETS);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const d3Container = useRef({ initialized: false }).current;
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform | undefined>(initialTransform || undefined);
  const [isPanning, setIsPanning] = useState(false);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (chartContainerRef.current) {
      const svg = d3.select(chartContainerRef.current).select('svg') as any;
      const zoom = d3.zoom().on('zoom', (event) => {
        setZoomTransform(event.transform);
        onZoomChange?.(event.transform);
      });
      svg.call(zoom.scaleBy, 1.5);
    }
  }, [onZoomChange]);

  const handleZoomOut = useCallback(() => {
    if (chartContainerRef.current) {
      const svg = d3.select(chartContainerRef.current).select('svg') as any;
      const zoom = d3.zoom().on('zoom', (event) => {
        setZoomTransform(event.transform);
        onZoomChange?.(event.transform);
      });
      svg.call(zoom.scaleBy, 1 / 1.5);
    }
  }, [onZoomChange]);

  const handleResetZoom = useCallback(() => {
    if (chartContainerRef.current) {
      const svg = d3.select(chartContainerRef.current).select('svg') as any;
      const zoom = d3.zoom().on('zoom', (event) => {
        setZoomTransform(event.transform);
        onZoomChange?.(event.transform);
      });
      svg.call(zoom.transform, d3.zoomIdentity);
    }
  }, [onZoomChange]);

  const togglePan = useCallback(() => {
    if (chartContainerRef.current) {
      const svg = d3.select(chartContainerRef.current).select('svg') as any;
      const zoom = d3.zoom().on('zoom', (event) => {
        setZoomTransform(event.transform);
        onZoomChange?.(event.transform);
      });
      
      if (isPanning) {
        svg.call(zoom.on('mousedown.zoom', null));
        setIsPanning(false);
      } else {
        svg.call(zoom.on('mousedown.zoom', (event) => {
          event.preventDefault();
          event.stopPropagation();
        }));
        setIsPanning(true);
      }
    }
  }, [isPanning, onZoomChange]);

  useImperativeHandle(ref, () => ({
    handleZoomIn,
    handleZoomOut,
    handleResetZoom
  }), [handleZoomIn, handleZoomOut, handleResetZoom]);

  useEffect(() => {
    if (!chartContainerRef.current || !data?.bets || data?.bets?.length === 0) {
      return;
    }

    const processData = (rawData: any[]) => {
      const now = new Date();
      const processed = rawData
        .map((d) => {
          const originalWeight = parseInt(d.weight);
          const minPrice = formatTinybarsToHbar(d.priceMin);
          const maxPrice = formatTinybarsToHbar(d.priceMax);
          
          return {
            time: new Date(parseInt(d.targetTimestamp) * 1000),
            price: (Number(minPrice) + Number(maxPrice)) / 2,
            stake: originalWeight,
            originalWeight: originalWeight,
            priceRange: Number(maxPrice) - Number(minPrice)
          };
        })
        .filter((d) => d.time > now);

      // Remove outliers using IQR method
      const prices = processed.map(d => d.price);
      const sortedPrices = prices.sort((a, b) => a - b);
      const q1 = sortedPrices[Math.floor(sortedPrices.length * 0.25)];
      const q3 = sortedPrices[Math.floor(sortedPrices.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      return processed.filter(d => d.price >= lowerBound && d.price <= upperBound);
    };

    const dataset = processData(data.bets);
    if (dataset.length === 0) return;

    const container = chartContainerRef.current;
    const margin = { top: 15, right: 25, bottom: 35, left: 45 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    d3.select(container).selectAll('*').remove();

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const defs = svg.append('defs');

    // Enhanced clip path
    const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
    defs.append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('width', width)
      .attr('height', height);

    // Enhanced glow filter
    const filterId = `glow-${Math.random().toString(36).substr(2, 9)}`;
    const filter = defs.append('filter').attr('id', filterId);
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Add gradient definitions for better color schemes
    const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'rgba(59, 130, 246, 0.1)');
    gradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', 'rgba(59, 130, 246, 0.4)');
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'rgba(59, 130, 246, 0.8)');

    const chartArea = svg.append('g').attr('clip-path', `url(#${clipId})`);

    // Enhanced domain calculation with better padding
    const timeExtent = d3.extent(dataset, (d) => d.time);
    const priceExtent = d3.extent(dataset, (d) => d.price);
    const stakeExtent = d3.extent(dataset, (d) => d.stake);

    if (!timeExtent[0] || !timeExtent[1] || !priceExtent[0] || !priceExtent[1] || !stakeExtent[0] || !stakeExtent[1]) {
      return;
    }

    const [minTime, maxTime] = timeExtent;
    const timePadding = (maxTime.getTime() - minTime.getTime()) * 0.15;

    const [minPrice, maxPrice] = priceExtent;
    const pricePadding = (maxPrice - minPrice) * 0.15;

    const x = d3
      .scaleTime()
      .domain([new Date(minTime.getTime() - timePadding), new Date(maxTime.getTime() + timePadding)])
      .range([0, width]);

    const y = d3
      .scaleLinear()
      .domain([minPrice - pricePadding, maxPrice + pricePadding])
      .range([height, 0]);

    // Enhanced opacity scale with better weight distribution
    const weightScale = calculateWeightScale(dataset.map(d => d.stake));
    const opacityScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0.3, 1.0]);

    // Enhanced zoom functionality
    if (enableZoom) {
      const zoom = d3.zoom()
        .scaleExtent([0.1, 25])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .wheelDelta((event) => {
          return -event.deltaY * (event.deltaMode ? 120 : 1) / 400;
        })
        .on('zoom', (event) => {
          const { transform } = event;
          setZoomTransform(transform);
          onZoomChange?.(transform);
          
          chartArea.attr('transform', transform);
          
          (svg.select('.x-axis') as any).call(
            d3.axisBottom(x).scale(transform.rescaleX(x))
          );
          (svg.select('.y-axis') as any).call(
            d3.axisLeft(y).scale(transform.rescaleY(y))
          );
          
          (svg.select('.grid-x') as any).call(
            d3.axisBottom(x).scale(transform.rescaleX(x)).tickSize(-height).tickFormat(() => '')
          );
          (svg.select('.grid-y') as any).call(
            d3.axisLeft(y).scale(transform.rescaleY(y)).tickSize(-width).tickFormat(() => '')
          );
        });

      (svg as any).call(zoom);
      
      if (initialTransform) {
        (svg as any).call(zoom.transform, initialTransform);
      }

      svg.on('dblclick.zoom', null);
      svg.on('dblclick', () => {
        (svg as any).call(zoom.transform, d3.zoomIdentity);
      });
    }

    // Enhanced grid with better styling
    svg
      .append('g')
      .attr('class', 'axis grid-x')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .tickSize(-height)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#374151')
      .attr('stroke-opacity', 0.2)
      .attr('stroke-width', 0.5);
    
    svg
      .append('g')
      .attr('class', 'axis grid-y')
      .call(
        d3
          .axisLeft(y)
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#374151')
      .attr('stroke-opacity', 0.2)
      .attr('stroke-width', 0.5);

    // Enhanced axes with better formatting
    svg
      .append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(width / 80)
          .tickFormat((d: any) => d3.timeFormat('%b %d')(d))
          .tickSizeOuter(0)
      )
      .selectAll('text')
      .attr('fill', '#9CA3AF')
      .attr('font-size', '11px')
      .attr('font-weight', '500');
    
    svg
      .append('g')
      .attr('class', 'axis y-axis')
      .call(
        d3
          .axisLeft(y)
          .ticks(height / 40)
          .tickFormat((d: any) => d3.format('$.3f')(d))
      )
      .selectAll('text')
      .attr('fill', '#9CA3AF')
      .attr('font-size', '11px')
      .attr('font-weight', '500');

    // Enhanced axis labels
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 8)
      .text('Resolution time')
      .attr('fill', '#9CA3AF')
      .attr('font-size', '12px')
      .attr('font-weight', '600');
    
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 18)
      .text('HBAR price')
      .attr('fill', '#9CA3AF')
      .attr('font-size', '12px')
      .attr('font-weight', '600');

    // Enhanced KDE calculation with adaptive bandwidth
    const adaptiveBandwidth = calculateAdaptiveBandwidth(dataset, x, y);
    
    const densityData = d3
      .contourDensity()
      .x((d: any) => x(d.time))
      .y((d: any) => y(d.price))
      .size([width, height])
      .bandwidth(adaptiveBandwidth)
      .weight((d: any) => {
        const index = dataset.indexOf(d);
        return weightScale[index] || 0;
      })(dataset as any);

    // Enhanced color scheme with multiple levels
    const maxDensityValue = d3.max(densityData, (d) => d.value);
    if (!maxDensityValue) return;
    
    // Create multiple color scales for different density levels
    const lowDensityColor = d3.scaleSequential(d3.interpolateRgb('rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.3)'))
      .domain([0, maxDensityValue * 0.3]);
    
    const mediumDensityColor = d3.scaleSequential(d3.interpolateRgb('rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.6)'))
      .domain([maxDensityValue * 0.3, maxDensityValue * 0.7]);
    
    const highDensityColor = d3.scaleSequential(d3.interpolateRgb('rgba(59, 130, 246, 0.6)', 'rgba(59, 130, 246, 0.9)'))
      .domain([maxDensityValue * 0.7, maxDensityValue]);

    // Enhanced density visualization with multiple layers
    chartArea
      .append('g')
      .attr('filter', `url(#${filterId})`)
      .selectAll('path')
      .data(densityData)
      .enter()
      .append('path')
      .attr('d', d3.geoPath())
      .attr('fill', (d) => {
        if (d.value <= maxDensityValue * 0.3) return lowDensityColor(d.value);
        if (d.value <= maxDensityValue * 0.7) return mediumDensityColor(d.value);
        return highDensityColor(d.value);
      })
      .attr('fill-opacity', 0.95);

    // Enhanced confidence contours with multiple levels
    const confidenceLevels = [0.25, 0.5, 0.75];
    const contourColors = ['rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.5)', 'rgba(16, 185, 129, 0.7)'];
    const contourStrokes = ['rgb(5, 150, 105)', 'rgb(4, 120, 87)', 'rgb(6, 95, 70)'];

    confidenceLevels.forEach((level, i) => {
      const threshold = maxDensityValue * level;
      const contours = densityData.filter((d) => d.value > threshold);
      
      chartArea
        .append('g')
        .selectAll(`path.confidence-${i}`)
        .data(contours)
        .enter()
        .append('path')
        .attr('d', d3.geoPath())
        .attr('fill', contourColors[i])
        .attr('stroke', contourStrokes[i])
        .attr('stroke-linejoin', 'round')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.8);
    });

    // Enhanced tooltip
    const tooltip = d3
      .select(container)
      .append('div')
      .attr(
        'class',
        'absolute z-10 p-3 text-sm text-white bg-neutral-900/95 backdrop-blur-sm rounded-lg border border-neutral-700 shadow-xl pointer-events-none transition-opacity duration-200'
      )
      .style('opacity', 0);

    // Enhanced bet markers with better styling
    chartArea
      .append('g')
      .selectAll('circle')
      .data(dataset)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.time))
      .attr('cy', (d) => y(d.price))
      .attr('r', (d) => {
        const index = dataset.indexOf(d);
        return Math.max(2, Math.min(6, weightScale[index] * 4));
      })
      .attr('fill', '#ef4444')
      .attr('stroke', '#dc2626')
      .attr('stroke-width', 1)
      .attr('opacity', (d) => {
        const index = dataset.indexOf(d);
        return opacityScale(weightScale[index]);
      })
      .on('mouseover', (event, d) => {
        const timeFormat = d3.timeFormat('%b %d, %Y at %I:%M %p');
        const weightIndex = dataset.indexOf(d);
        tooltip
          .style('opacity', 1)
          .html(`
            <div class="font-semibold text-red-400 mb-2">Bet Details</div>
            <div class="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
              <span class="font-medium text-neutral-400">Price:</span> 
              <span class="text-right font-mono">$${d.price.toFixed(4)}</span>
              <span class="font-medium text-neutral-400">Date:</span> 
              <span class="text-right">${timeFormat(d.time)}</span>
              <span class="font-medium text-neutral-400">Weight:</span> 
              <span class="text-right font-mono">${d.originalWeight.toLocaleString()}</span>
              <span class="font-medium text-neutral-400">Range:</span> 
              <span class="text-right font-mono">±$${d.priceRange.toFixed(4)}</span>
            </div>
          `)
          .style('left', `${event.pageX + 15}px`)
          .style('top', `${event.pageY - 15}px`);
      })
      .on('mouseout', () => tooltip.style('opacity', 0));

    // Enhanced crosshair
    const focus = svg.append('g').attr('class', 'focus').style('display', 'none');
    focus
      .append('line')
      .attr('class', 'crosshair')
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');
    focus
      .append('line')
      .attr('class', 'crosshair')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Enhanced metrics panel
    const metricsPanel = d3
      .select(container)
      .append('div')
      .attr(
        'class',
        'absolute top-3 right-3 p-3 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-lg text-sm text-neutral-300 pointer-events-none transition-opacity duration-300 shadow-xl'
      )
      .style('opacity', 0);

    // Enhanced zoom info panel
    if (enableZoom && showControls) {
      const zoomInfoPanel = d3
        .select(container)
        .append('div')
        .attr(
          'class',
          'absolute top-3 left-3 p-3 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-lg text-sm text-neutral-300 shadow-xl'
        );
      
      zoomInfoPanel.html(`
        <div class="font-semibold text-neutral-200 mb-2">Interactive Controls</div>
        <div class="text-neutral-400 text-xs space-y-1">
          <div>🖱️ Scroll: Zoom in/out</div>
          <div>🖱️ Drag: Pan around</div>
          <div>🖱️ Double-click: Reset view</div>
        </div>
      `);
    }

    // Enhanced mouse interaction
    svg
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .on('mouseover', () => {
        focus.style('display', null);
        metricsPanel.style('opacity', 1);
      })
      .on('mouseout', () => {
        focus.style('display', 'none');
        metricsPanel.style('opacity', 0);
      })
      .on('mousemove', mousemove);

    function mousemove(event: any) {
      const [pointerX, pointerY] = d3.pointer(event, event.currentTarget);
      focus.selectAll('.crosshair').style('display', 'block');
      focus.select("line.crosshair[y1='0']").attr('x1', pointerX).attr('x2', pointerX);
      focus.select("line.crosshair[x1='0']").attr('y1', pointerY).attr('y2', pointerY);

      const currentX = zoomTransform ? zoomTransform.rescaleX(x) : x;
      const currentY = zoomTransform ? zoomTransform.rescaleY(y) : y;

      const timeVal = currentX.invert(pointerX);
      const priceVal = currentY.invert(pointerY);

      const timeFormat = d3.timeFormat('%b %d, %Y at %I:%M %p');
      let metricsHtml = `<div class="font-semibold text-neutral-200 mb-3">Predicted probability</div>`;
      metricsHtml += `<div class="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
        <span class="font-medium text-neutral-400">Date:</span> 
        <span class="text-right font-mono">${timeFormat(timeVal)}</span>
        <span class="font-medium text-neutral-400">Price:</span> 
        <span class="text-right font-mono">$${priceVal.toFixed(4)}</span>
      </div>`;
      
      metricsPanel.html(metricsHtml);
    }
  }, [data, enableZoom, onZoomChange, initialTransform, zoomTransform, showControls]);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-neutral-400 font-medium">
          HBAR price × time probability
        </div>
        <div className="flex items-center gap-2">
          {enableZoom && showControls && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                className="text-xs h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                className="text-xs h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
                className="text-xs h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button
                variant={isPanning ? "default" : "outline"}
                size="sm"
                onClick={togglePan}
                className="text-xs h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500"
              >
                <Move className="h-3 w-3" />
              </Button>
            </div>
          )}
          {showControls && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="text-xs h-8 px-3 text-neutral-400 hover:text-neutral-200 border-neutral-600 hover:border-neutral-500"
            >
              <Maximize2 className="h-3 w-3 mr-1" />
              Expand
            </Button>
          )}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-full relative" />

      {showControls && (
        <KDEChartModal
          currentPrice={currentPrice}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
});

KDEChart.displayName = 'KDEChart';
