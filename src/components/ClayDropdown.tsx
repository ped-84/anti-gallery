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
  buttonClassName?: string;
  menuClassName?: string;
  placeholder?: string;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
}

export const ClayDropdown: React.FC<ClayDropdownProps> = ({
  value,
  options,
  onChange,
  label,
  prefix,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  placeholder = 'انتخاب کنید',
  size = 'md',
  align = 'right'
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

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {label && (
        <label className="block text-xs sm:text-sm font-bold text-stone-600 dark:text-stone-400 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button: Claymorphic style matching Stickdazzle theme */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`clay-button clay-base text-stone-800 dark:text-white flex items-center justify-between gap-2 border border-[#E1E1E1] dark:border-stone-700 hover:border-[#3D5B99]/40 transition-all select-none focus:outline-none shadow-xs ${
          isSmall
            ? 'min-w-[130px] sm:min-w-[150px] min-h-[38px] sm:min-h-[40px] py-1.5 sm:py-2 pr-3 pl-8 text-xs font-bold rounded-xl'
            : 'w-full min-w-[150px] sm:min-w-[180px] min-h-[46px] sm:min-h-[48px] py-2.5 sm:py-3 pr-4 pl-10 text-xs sm:text-sm font-bold rounded-2xl'
        } ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          {prefix && <span className="text-[#3D5B99] dark:text-[#A3C2E4] shrink-0">{prefix}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={`rounded-md bg-[#3D5B99]/15 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0 font-medium ${
                isSmall ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        {/* ChevronDown */}
        <ChevronDown
          className={`${
            isSmall ? 'w-3.5 h-3.5 left-2.5' : 'w-4 h-4 sm:w-5 sm:h-5 left-3.5'
          } text-[#3D5B99] dark:text-[#A3C2E4] absolute top-1/2 -translate-y-1/2 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#F76B1C]' : ''
          }`}
        />
      </button>

      {/* Popover Menu with Clay Shadow & Smooth Styling */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 min-w-full sm:min-w-[200px] max-h-60 overflow-y-auto rounded-2xl bg-white/95 dark:bg-[#181d27]/95 backdrop-blur-md border border-[#E1E1E1] dark:border-stone-700 shadow-xl p-1.5 space-y-1 animate-in fade-in-0 zoom-in-95 duration-150 ${
            align === 'left' ? 'left-0 right-auto' : 'right-0 left-auto'
          } ${menuClassName}`}
        >
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
                className={`w-full text-right flex items-center justify-between gap-2 transition-all ${
                  isSmall ? 'py-1.5 px-2.5 text-xs rounded-lg' : 'py-2 px-3 text-xs sm:text-sm rounded-xl'
                } font-bold ${
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
                    <span
                      className={`rounded-md shrink-0 ${
                        isSmall ? 'text-[9px] px-1 py-0.2' : 'text-[10px] px-1.5 py-0.2'
                      } ${
                        isSelected
                          ? 'bg-[#3D5B99]/20 text-[#3D5B99] dark:text-[#A3C2E4]'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                      }`}
                    >
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
