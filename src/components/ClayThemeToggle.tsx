import React from 'react';

interface ClayThemeToggleProps {
  isDarkMode: boolean;
  onToggle: () => void;
  className?: string;
}

export const ClayThemeToggle: React.FC<ClayThemeToggleProps> = ({
  isDarkMode,
  onToggle,
  className = ''
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDarkMode}
      aria-label={isDarkMode ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
      title={isDarkMode ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
      onClick={onToggle}
      className={`clay-theme-toggle ${className}`}
    >
      <span className="scene" aria-hidden="true">
        <span className="halo" />
        <span className="stars">
          <span className="star">✦</span>
          <span className="star">✦</span>
          <span className="star">✦</span>
          <span className="star">✦</span>
          <span className="star">✦</span>
          <span className="star">•</span>
          <span className="star">•</span>
          <span className="star">•</span>
        </span>
        <span className="orb">
          <span className="moon">
            <i className="crater" />
            <i className="crater" />
            <i className="crater" />
            <i className="crater" />
            <i className="crater" />
            <i className="crater" />
            <i className="crater" />
            <i className="crater" />
            <i className="crater" />
          </span>
        </span>
        <svg className="clouds" viewBox="0 0 420 200" preserveAspectRatio="none">
          <path
            fill="#a3c2e4"
            d="M80 200 Q85 170 110 179 Q115 145 150 156 Q157 119 192 134 Q211 78 252 98 Q250 52 297 54 Q287 4 340 -7 H430 V210Z"
          />
          <path
            fill="#d2e1f3"
            d="M112 210 Q112 179 143 186 Q150 159 179 168 Q190 133 223 150 Q232 113 268 122 Q273 77 313 86 Q316 39 356 40 Q371 6 430 16 V210Z"
          />
          <path
            fill="#f2f6fd"
            d="M148 210 Q149 179 179 188 Q190 160 218 177 Q228 148 258 169 Q265 139 301 149 Q307 111 344 119 Q342 72 380 70 Q384 45 430 50 V210Z"
          />
        </svg>
      </span>
    </button>
  );
};
