import React from 'react';
import { ArrowLeft, ChevronRight, EyeOff, UserX, ShieldQuestion } from 'lucide-react';

interface PrivacySecurityScreenProps {
  onBack: () => void;
  onNavigate: (title: string) => void;
}

const PrivacySecurityScreen: React.FC<PrivacySecurityScreenProps> = ({ onBack, onNavigate }) => {

  const menuItems = [
    { 
      label: 'Blocked Users',
      description: 'Manage users you have blocked',
      icon: UserX,
      onClick: () => onNavigate('Blocked Users')
    },
    {
      label: 'Hidden Chats',
      description: 'View and manage hidden conversations',
      icon: EyeOff,
      onClick: () => onNavigate('Hidden Chats')
    },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">Privacy & Security</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide p-4">
         <div className="p-4 bg-accent-orange/10 dark:bg-accent-orange/20 rounded-2xl mb-4 flex items-start gap-4">
            <ShieldQuestion size={24} className="text-accent-orange flex-shrink-0 mt-1" />
            <div>
                <h3 className="font-bold text-text-primary dark:text-gray-100">Your Privacy Matters</h3>
                <p className="text-sm text-text-primary/80 dark:text-gray-300 mt-1">
                    Control who can interact with you and what you see. Use these tools to tailor your ZenChat experience to your comfort level.
                </p>
            </div>
         </div>

         <div className="space-y-2">
            {menuItems.map(item => (
            <button key={item.label} onClick={item.onClick} className="w-full flex items-center p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200">
                <div className="w-10 h-10 flex items-center justify-center bg-base-tan dark:bg-gray-700 rounded-lg mr-4">
                <item.icon size={22} className="text-text-primary/80 dark:text-gray-300" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-text-primary dark:text-gray-200">{item.label}</p>
                    <p className="text-sm text-text-primary/60 dark:text-gray-400">{item.description}</p>
                </div>
                <ChevronRight size={20} className="text-text-primary/40 dark:text-gray-500" />
            </button>
            ))}
        </div>
      </main>
    </div>
  );
};

export default PrivacySecurityScreen;