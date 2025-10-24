
import React from 'react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', isOnline }) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-24 h-24',
  };

  const onlineDotClasses = isOnline ? 'bg-accent-green' : 'bg-gray-700';

  return (
    <div className={`relative flex-shrink-0 ${sizeClasses[size]}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full rounded-full object-cover"
      />
      {typeof isOnline !== 'undefined' && (
        <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 ${onlineDotClasses} rounded-full border-2 border-secondary-cream`}></div>
      )}
    </div>
  );
};

export default Avatar;