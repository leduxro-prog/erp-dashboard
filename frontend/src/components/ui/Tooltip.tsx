import React, { useState } from 'react';
import classNames from 'classnames';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const positionMap = {
  top: 'bottom-full mb-2 -translate-x-1/2 left-1/2',
  bottom: 'top-full mt-2 -translate-x-1/2 left-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

const arrowMap = {
  top: 'top-full border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent',
  bottom:
    'bottom-full border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent',
  left: 'left-full border-l-gray-700 border-t-transparent border-b-transparent border-r-transparent',
  right:
    'right-full border-r-gray-700 border-t-transparent border-b-transparent border-l-transparent',
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block group">
      <div
        onMouseEnter={() => {
          const timer = setTimeout(() => setIsVisible(true), delay);
          return () => clearTimeout(timer);
        }}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>

      {isVisible && (
        <div
          className={classNames(
            'absolute z-50 px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-md whitespace-nowrap',
            positionMap[position]
          )}
        >
          {content}
          <div
            className={classNames(
              'absolute w-0 h-0 border-4',
              arrowMap[position]
            )}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
