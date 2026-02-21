"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
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
      id,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const isRange = Array.isArray(value);
    const sliderRef = React.useRef<HTMLInputElement>(null);
    const generatedId = React.useId();
    const inputId = id || `slider-${generatedId}`;

    const getPercentage = (val: number) => ((val - min) / (max - min)) * 100;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      if (isRange) {
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
              <label htmlFor={inputId} className="text-sm font-medium text-gray-700">{label}</label>
            )}
            {showValue && (
              <span className="text-sm font-medium text-gray-500">{displayValue}</span>
            )}
          </div>
        )}
        <div
          className="relative w-full h-2"
        >
          <div className="absolute w-full h-2 bg-gray-200 rounded-full" />

          <div
            className="absolute h-2 bg-blue-600 rounded-full transition-all duration-100"
            style={{
              width: `${getPercentage(isRange ? value[0] : (value as number))}%`,
            }}
          />

          <input
            ref={(node) => {
              (sliderRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            id={inputId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={isRange ? value[0] : (value as number)}
            onChange={handleChange}
            aria-label={ariaLabel || (label ? undefined : "Slider")}
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

        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{formatValue ? formatValue(min) : min}</span>
          <span className="text-xs text-gray-400">{formatValue ? formatValue(max) : max}</span>
        </div>
      </div>
    );
  }
);
Slider.displayName = "Slider";

interface RangeSliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: [number, number];
  onChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  minAriaLabel?: string;
  maxAriaLabel?: string;
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
      minAriaLabel,
      maxAriaLabel,
      ...props
    },
    ref
  ) => {
    const [minVal, maxVal] = value;
    const minPercent = ((minVal - min) / (max - min)) * 100;
    const maxPercent = ((maxVal - min) / (max - min)) * 100;
    const generatedId = React.useId();
    const minInputId = `range-slider-min-${generatedId}`;
    const maxInputId = `range-slider-max-${generatedId}`;

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMin = Math.min(parseFloat(e.target.value), maxVal - step);
      onChange([newMin, maxVal]);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMax = Math.max(parseFloat(e.target.value), minVal + step);
      onChange([minVal, newMax]);
    };

    const minLabel = minAriaLabel || (label ? `${label} minimum` : "Minimum value");
    const maxLabel = maxAriaLabel || (label ? `${label} maximum` : "Maximum value");

    return (
      <div className={cn("w-full", className)} ref={ref} {...props}>
        {(label || showValue) && (
          <div className="flex justify-between items-center mb-2">
            {label && (
              <div className="text-sm font-medium text-gray-700">{label}</div>
            )}
            {showValue && (
              <span className="text-sm font-medium text-gray-500">
                {formatValue ? `${formatValue(minVal)} - ${formatValue(maxVal)}` : `${minVal} - ${maxVal}`}
              </span>
            )}
          </div>
        )}
        <div className="relative w-full h-2">
          <div className="absolute w-full h-2 bg-gray-200 rounded-full" />

          <div
            className="absolute h-2 bg-blue-600 rounded-full"
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
            }}
          />

          <label htmlFor={minInputId} className="sr-only">{minLabel}</label>
          <input
            id={minInputId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={minVal}
            onChange={handleMinChange}
            aria-label={minLabel}
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

          <label htmlFor={maxInputId} className="sr-only">{maxLabel}</label>
          <input
            id={maxInputId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={maxVal}
            onChange={handleMaxChange}
            aria-label={maxLabel}
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
