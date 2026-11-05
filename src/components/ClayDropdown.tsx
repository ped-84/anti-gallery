import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface ClayDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  label?: string;
  prefix?: React.ReactNode;
  className?: string;
  placeholder?: string;
}

export const ClayDropdown: React.FC<ClayDropdownProps> = ({
  value,
  options,
  onChange,
  label,
  prefix,
  className = '',
  placeholder = 'انتخاب کنید'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {label && (
        <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button: Claymorphic style matching Stickdazzle theme (Taller, spacious, clearer) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="clay-button clay-base w-full min-w-[150px] sm:min-w-[180px] min-h-[46px] sm:min-h-[48px] py-2.5 sm:py-3 pr-4 pl-10 text-xs sm:text-sm font-bold text-[#1d2d4c] dark:text-white flex items-center justify-between gap-2.5 border border-[#E1E1E1] dark:border-stone-700 hover:border-[#3D5B99]/40 transition-all select-none focus:outline-none rounded-2xl"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 truncate">
          {prefix && <span className="text-[#3D5B99] dark:text-[#A3C2E4] shrink-0">{prefix}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#3D5B99]/15 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        {/* ChevronDown with generous padding away from border */}
        <ChevronDown
          className={`w-4 h-4 sm:w-5 sm:h-5 text-[#3D5B99] dark:text-[#A3C2E4] absolute left-3.5 top-1/2 -translate-y-1/2 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#F76B1C]' : ''
          }`}
        />
      </button>

      {/* Popover Menu with Clay Shadow & Smooth Styling */}
      {isOpen && (
        <div className="absolute top-full mt-1.5 right-0 z-50 min-w-full sm:min-w-[220px] max-h-64 overflow-y-auto rounded-2xl bg-white dark:bg-[#181d27] border border-[#E1E1E1] dark:border-stone-700 shadow-2xl p-1.5 space-y-1 animate-in fade-in-0 zoom-in-95 duration-150">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full py-2.5 px-3.5 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-between gap-2 transition-all text-right ${
                  isSelected
                    ? 'bg-[#3D5B99]/10 text-[#3D5B99] dark:bg-[#A3C2E4]/15 dark:text-[#A3C2E4]'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-[#f0f4fa] dark:hover:bg-stone-800'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                  {opt.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500 shrink-0">
                      {opt.badge}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0 mr-1" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
