import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const EMOJI_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

interface ContextMenuProps {
  options: {
    label: string | React.ReactNode;
    icon?: React.ElementType;
    onClick: () => void;
    isDestructive?: boolean;
  }[];
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  showEmojis?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ options, onClose, onEmojiSelect, showEmojis = true }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <motion.div
        ref={menuRef}
        className="w-full max-w-sm"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <div className="flex flex-col items-center gap-3">
          {showEmojis && (
            <div className="flex p-1.5 rounded-full bg-secondary-cream shadow-lg ring-1 ring-black/5 items-center justify-center">
              {EMOJI_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { onEmojiSelect(emoji); onClose(); }}
                  className="p-2 rounded-full text-3xl hover:bg-black/10 transform transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <div className="flex p-2 rounded-full bg-secondary-cream shadow-lg ring-1 ring-black/5 items-center justify-center gap-2">
            {options.map((option, index) => {
              const Icon = option.icon;
              return (
                <div key={index} className="flex flex-col items-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); option.onClick(); onClose(); }}
                        className={`w-14 h-14 flex items-center justify-center rounded-full transition-colors
                        ${option.isDestructive ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-black/5 text-text-primary hover:bg-black/10'}`}
                    >
                        {Icon && <Icon size={24} />}
                    </button>
                    <span className={`mt-1 text-xs font-semibold ${option.isDestructive ? 'text-red-500' : 'text-text-primary'}`}>{option.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ContextMenu;