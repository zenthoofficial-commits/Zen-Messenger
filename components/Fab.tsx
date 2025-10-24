import React, { useState } from 'react';
import { Plus, Heart, Search, UserPlus } from 'lucide-react';

interface FabProps {
    onMenuItemClick: (label: string) => void;
}

const Fab: React.FC<FabProps> = ({ onMenuItemClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  const iconBaseClasses = "transition-transform duration-300 ease-in-out";

  const menuItems = [
    { icon: Heart, label: 'Blind Date', color: 'bg-accent-brand' },
    { icon: Search, label: 'Search User', color: 'bg-accent-green' },
    { icon: UserPlus, label: 'Invite Friend', color: 'bg-secondary-cream' },
  ];

  const handleItemClick = (label: string) => {
    setIsOpen(false);
    onMenuItemClick(label);
  };

  return (
    <div className="absolute bottom-6 right-6 z-30">
        {isOpen && (
             <div 
                className="fixed inset-0 bg-black/10 z-20"
                onClick={() => setIsOpen(false)}
            />
        )}
      <div className="relative flex flex-col items-end gap-4">
        {menuItems.map((item, index) => (
          <div
            key={item.label}
            className={`relative z-30 flex items-center gap-3 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
            style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }}
          >
             <span className="bg-secondary-cream/90 text-text-primary text-sm font-semibold px-3 py-1 rounded-full shadow-md">{item.label}</span>
            <button 
                onClick={() => handleItemClick(item.label)}
                className={`w-12 h-12 rounded-full ${item.color} text-white flex items-center justify-center shadow-lg transform transition-transform active:scale-95`}>
              <item.icon size={22} className={item.color === 'bg-secondary-cream' ? 'text-text-primary' : 'text-white'} />
            </button>
          </div>
        ))}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-16 h-16 bg-accent-brand rounded-full text-white flex items-center justify-center shadow-xl z-30 transform transition-transform hover:scale-105 active:scale-95"
        >
          <Plus size={32} className={`${iconBaseClasses} ${isOpen ? 'rotate-45' : 'rotate-0'}`} />
        </button>
      </div>
    </div>
  );
};

export default Fab;