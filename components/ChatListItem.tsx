

import React from 'react';
import { ChatWithDetails } from '../types';
import Avatar from './Avatar';
import { format } from 'date-fns';
import { Pin } from 'lucide-react';

interface ChatListItemProps {
  chat: ChatWithDetails;
  currentUserId: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent | React.TouchEvent, chat: ChatWithDetails) => void;
  isPinned: boolean;
  nickname?: string;
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat, currentUserId, onClick, onContextMenu, isPinned, nickname }) => {
  const { otherParticipant, lastMessage, otherParticipantPresence, unreadCount } = chat;

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return format(date, 'p'); // e.g., 9:42 PM
    }
    return format(date, 'MMM d'); // e.g., 'Jul 28'
  };

  const handleNativeContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e, chat);
  }

  const unreadMessages = unreadCount?.[currentUserId] || 0;
  const displayName = nickname || otherParticipant.name;

  return (
    <div
      className={`flex items-center p-3 transition-colors duration-200 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5`}
      onClick={onClick}
      onContextMenu={handleNativeContextMenu}
    >
      <Avatar src={otherParticipant.avatarUrl || `https://picsum.photos/seed/${otherParticipant.uid}/100/100`} alt={displayName} isOnline={otherParticipantPresence?.isOnline} size="md"/>
      <div className="flex-1 ml-4 overflow-hidden">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-text-primary dark:text-gray-100 truncate">{displayName}</h3>
            {isPinned && <Pin size={14} className="text-text-primary/50 dark:text-gray-500" />}
          </div>
          <span className="text-sm text-text-primary/60 dark:text-gray-400 flex-shrink-0">{formatTimestamp(lastMessage?.timestamp)}</span>
        </div>
        <div className="flex justify-between items-start mt-1">
          <p className="text-text-primary/70 dark:text-gray-300 text-base truncate pr-2">{lastMessage?.text || 'No messages yet'}</p>
          {unreadMessages > 0 && (
            <div className="bg-accent-brand text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
              {unreadMessages}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatListItem;