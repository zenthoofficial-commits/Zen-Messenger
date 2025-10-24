import React from 'react';
import { ArrowLeft, Construction } from 'lucide-react';

interface SettingsDetailScreenProps {
  title: string;
  onBack: () => void;
}

const SettingsDetailScreen: React.FC<SettingsDetailScreenProps> = ({ title, onBack }) => {
  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">{title}</h1>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center text-center p-8 text-text-primary/60 dark:text-gray-400">
        <Construction size={48} className="mb-4 text-text-primary/30 dark:text-gray-600" />
        <h2 className="font-semibold text-lg">Feature Under Construction</h2>
        <p className="mt-1">The '{title}' feature is coming soon. Stay tuned!</p>
      </main>
    </div>
  );
};

export default SettingsDetailScreen;