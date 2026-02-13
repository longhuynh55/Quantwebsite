"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number | [number, number];
  onChange?: (value: number | [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      value = 0,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      label,
      showValue = false,
      formatValue,
      ...props
    },
    ref
  ) => {
    const isRange = Array.isArray(value);
    const sliderRef = React.useRef<HTMLInputElement>(null);

    const getPercentage = (val: number) => ((val - min) / (max - min)) * 100;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      if (isRange) {
        // For range slider, this is a simplified implementation
        // In a full implementation, you'd handle both thumbs
        onChange?.([newValue, (value as [number, number])[1]]);
      } else {
        onChange?.(newValue);
      }
    };

    const displayValue = formatValue
      ? formatValue(isRange ? value[0] : (value as number))
      : isRange ? `${value[0]} - ${value[1]}` : value;

    return (
      <div className={cn("w-full", className)}>
        {(label || showValue) && (
          <div className="flex justify-between items-center mb-2">
            {label && (
              <label className="text-sm font-medium text-gray-700">{label}</label>
            )}
            {showValue && (
              <span className="text-sm font-medium text-gray-500">{displayValue}</span>
            )}
          </div>
        )}
        <div
          className="relative w-full h-2"
        >
          {/* Track */}
          <div className="absolute w-full h-2 bg-gray-200 rounded-full" />

          {/* Fill */}
          <div
            className="absolute h-2 bg-blue-600 rounded-full transition-all duration-100"
            style={{
              width: `${getPercentage(isRange ? value[0] : (value as number))}%`,
            }}
          />

          {/* Input */}
          <input
            ref={(node) => {
              // Handle both refs
              (sliderRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            type="range"
            min={min}
            max={max}
            step={step}
            value={isRange ? value[0] : (value as number)}
            onChange={handleChange}
            className={cn(
              "absolute w-full h-2 appearance-none bg-transparent cursor-pointer",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
              "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
              "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600",
              "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab",
              "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150",
              "[&::-webkit-slider-thumb]:hover:scale-110",
              "[&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:active:scale-95",
              "[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5",
              "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white",
              "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-600",
              "[&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab"
            )}
            {...props}
          />
        </div>

        {/* Min/Max labels */}
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{formatValue ? formatValue(min) : min}</span>
          <span className="text-xs text-gray-400">{formatValue ? formatValue(max) : max}</span>
        </div>
      </div>
    );
  }
);
Slider.displayName = "Slider";

// Range Slider with two handles
interface RangeSliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: [number, number];
  onChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

const RangeSlider = React.forwardRef<HTMLDivElement, RangeSliderProps>(
  (
    {
      className,
      value,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      label,
      showValue = false,
      formatValue,
      ...props
    },
    ref
  ) => {
    const [minVal, maxVal] = value;
    const minPercent = ((minVal - min) / (max - min)) * 100;
    const maxPercent = ((maxVal - min) / (max - min)) * 100;

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMin = Math.min(parseFloat(e.target.value), maxVal - step);
      onChange([newMin, maxVal]);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMax = Math.max(parseFloat(e.target.value), minVal + step);
      onChange([minVal, newMax]);
    };

    return (
      <div className={cn("w-full", className)} ref={ref} {...props}>
        {(label || showValue) && (
          <div className="flex justify-between items-center mb-2">
            {label && (
              <label className="text-sm font-medium text-gray-700">{label}</label>
            )}
            {showValue && (
              <span className="text-sm font-medium text-gray-500">
                {formatValue ? `${formatValue(minVal)} - ${formatValue(maxVal)}` : `${minVal} - ${maxVal}`}
              </span>
            )}
          </div>
        )}
        <div className="relative w-full h-2">
          {/* Track */}
          <div className="absolute w-full h-2 bg-gray-200 rounded-full" />

          {/* Fill */}
          <div
            className="absolute h-2 bg-blue-600 rounded-full"
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
            }}
          />

          {/* Min input */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={minVal}
            onChange={handleMinChange}
            className={cn(
              "absolute w-full h-2 appearance-none bg-transparent pointer-events-none",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
              "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
              "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600",
              "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab",
              "[&::-webkit-slider-thumb]:pointer-events-auto"
            )}
          />

          {/* Max input */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={maxVal}
            onChange={handleMaxChange}
            className={cn(
              "absolute w-full h-2 appearance-none bg-transparent pointer-events-none",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
              "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
              "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600",
              "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab",
              "[&::-webkit-slider-thumb]:pointer-events-auto"
            )}
          />
        </div>

        {/* Min/Max labels */}
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{formatValue ? formatValue(min) : min}</span>
          <span className="text-xs text-gray-400">{formatValue ? formatValue(max) : max}</span>
        </div>
      </div>
    );
  }
);
RangeSlider.displayName = "RangeSlider";

export { Slider, RangeSlider };
