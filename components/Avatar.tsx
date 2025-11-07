
import React from 'react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
  gender?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', isOnline, gender }) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-24 h-24',
  };

  const onlineDotClasses = isOnline ? 'bg-accent-green' : 'bg-gray-700';

  const genderRingClasses: { [key: string]: string } = {
    Male: 'ring-2 ring-blue-400',
    Female: 'ring-2 ring-pink-400',
  };
  const ringClass = gender ? (genderRingClasses[gender] || '') : '';

  return (
    <div className={`relative flex-shrink-0 ${sizeClasses[size]}`}>
      <img
        src={src}
        alt={alt}
        className={`w-full h-full rounded-full object-cover ${ringClass} ${ringClass ? 'ring-offset-2 ring-offset-secondary-cream dark:ring-offset-gray-900' : ''}`}
      />
      {typeof isOnline !== 'undefined' && (
        <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 ${onlineDotClasses} rounded-full border-2 border-secondary-cream dark:border-gray-900`}></div>
      )}
    </div>
  );
};

export default Avatar;