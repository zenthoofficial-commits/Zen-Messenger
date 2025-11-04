import React from 'react';
import { ArrowLeft, Wallet, Send, Download } from 'lucide-react';

interface WalletScreenProps {
  onBack: () => void;
}

const WalletScreen: React.FC<WalletScreenProps> = ({ onBack }) => {
  const handleAction = () => {
    alert('This feature is currently under development and not yet available.');
  };

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">My Wallet</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm bg-secondary-cream dark:bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col items-center">
            <div className="p-4 bg-accent-brand/10 rounded-full mb-4">
                <Wallet size={32} className="text-accent-brand" />
            </div>
            <p className="text-sm text-text-primary/70 dark:text-gray-400">Total Balance</p>
            <p className="text-4xl font-bold text-text-primary dark:text-gray-100 mt-1">
                0.00 <span className="text-2xl font-semibold text-text-primary/50 dark:text-gray-500">USDT</span>
            </p>
            
            <div className="w-full h-px bg-base-tan dark:bg-gray-700 my-6"></div>

            <p className="text-sm text-text-primary/80 dark:text-gray-300 text-center mb-4">
                Seamlessly send USDT gifts to your friends on ZenChat.
            </p>

            <div className="flex w-full gap-4">
                <button onClick={handleAction} className="flex-1 bg-accent-brand/20 text-accent-brand font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-accent-brand/30 transition-colors disabled:opacity-50">
                    <Send size={18} />
                    <span>Send</span>
                </button>
                 <button onClick={handleAction} className="flex-1 bg-accent-brand/20 text-accent-brand font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-accent-brand/30 transition-colors disabled:opacity-50">
                    <Download size={18} />
                    <span>Receive</span>
                </button>
            </div>
             <p className="text-xs text-text-primary/50 dark:text-gray-500 text-center mt-6">
                Wallet functionality is a conceptual feature. Real transactions are not supported.
             </p>
        </div>
      </main>
    </div>
  );
};

export default WalletScreen;
