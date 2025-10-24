import React from 'react';
import { Message, User } from '../types';
import { X } from 'lucide-react';

interface ReplyPreviewProps {
  message: Message;
  currentUser: User;
  otherParticipant: User;
  onCancel: () => void;
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, currentUser, otherParticipant, onCancel }) => {
  const senderName = message.senderId === currentUser.uid ? 'You' : otherParticipant.name;
  
  return (
    <div className="p-2 pt-0 bg-base-tan dark:bg-gray-900">
      <div className="bg-secondary-cream/80 dark:bg-gray-800/80 rounded-t-xl flex items-center p-2 shadow-sm gap-2 border-b border-base-tan/50 dark:border-gray-700/50">
         <div className="w-1 bg-accent-brand self-stretch rounded-full"></div>
         <div className="flex-1 overflow-hidden">
            <p className="font-bold text-accent-brand text-sm">{senderName}</p>
            <p className="text-text-primary/80 dark:text-gray-300 truncate text-base">{message.text}</p>
         </div>
         <button onClick={onCancel} className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-text-primary/70 dark:text-gray-300 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            <X size={20} />
         </button>
      </div>
    </div>
  );
};

export default ReplyPreview;