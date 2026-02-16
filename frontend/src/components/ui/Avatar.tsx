import React from 'react';
import classNames from 'classnames';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'busy' | 'away';
  onClick?: () => void;
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const statusColorMap = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  status,
  onClick,
}) => {
  return (
    <div
      className={classNames(
        'relative inline-flex items-center justify-center rounded-full font-semibold text-white',
        sizeMap[size],
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
      style={{
        backgroundColor: src ? undefined : stringToColor(name),
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        getInitials(name)
      )}

      {status && (
        <div
          className={classNames(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            sizeMap[size] === 'w-8 h-8' && 'w-3 h-3',
            sizeMap[size] === 'w-10 h-10' && 'w-3.5 h-3.5',
            sizeMap[size] === 'w-12 h-12' && 'w-4 h-4',
            statusColorMap[status]
          )}
        />
      )}
    </div>
  );
};

export default Avatar;
