import React, { useRef, useState, useEffect } from 'react';
import { Message, User } from '../types';
import { Check, CheckCheck, PlayCircle, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { motion, useAnimation } from 'framer-motion';

interface ChatBubbleProps {
  message: Message;
  currentUser: User;
  otherParticipant: User;
  onContextMenu: (message: Message) => void;
  onAddReaction: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onMediaClick: (message: Message) => void;
  onToggleSelection: (messageId: string) => void;
  selectionMode: boolean;
  isSelected: boolean;
  userCache: { [uid: string]: User };
  id: string;
}

const ReactionTooltip: React.FC<{ uids: string[], userCache: { [uid: string]: User } }> = ({ uids, userCache }) => {
    const names = uids.map(uid => userCache[uid]?.name || 'Someone').join(', ');
    return (
        <div className="absolute bottom-full mb-1 bg-secondary-cream/90 dark:bg-gray-700/90 text-text-primary dark:text-gray-200 text-xs font-semibold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap z-20">
            {names}
        </div>
    );
};


const ChatBubble: React.FC<ChatBubbleProps> = ({ message, currentUser, otherParticipant, onContextMenu, onAddReaction, onReply, onMediaClick, userCache, id, selectionMode, isSelected, onToggleSelection }) => {
  const isSent = message.senderId === currentUser.uid;
  const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);
  const controls = useAnimation();
  
  const bubbleContainerClasses = isSent ? 'justify-end pl-[10%]' : 'justify-start pr-[10%]';
  const bubbleClasses = isSent 
    ? 'bg-accent-green text-white rounded-br-lg' 
    : 'bg-secondary-cream dark:bg-gray-700 text-text-primary dark:text-gray-200 rounded-bl-lg';
  
  useEffect(() => {
    return () => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
        }
    };
  }, []);

  const isReadByOther = message.readBy?.includes(otherParticipant.uid);
  const readReceipt = isSent 
      ? isReadByOther
          ? <CheckCheck size={16} className="text-accent-brand" />
          : (message.readBy?.length > 1 ? <CheckCheck size={16} className="text-white/80 dark:text-gray-400" /> : <Check size={16} className="text-white/80 dark:text-gray-400" />)
      : null;

  const handleNativeContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectionMode) return;
    onContextMenu(message);
  };

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelection(message.id);
    }
  };
  
  const reactionEntries = message.reactions ? Object.entries(message.reactions).filter(([, uids]) => Array.isArray(uids) && uids.length > 0) : [];

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: any) => {
    if (selectionMode) return;
    const threshold = isSent ? -50 : 50;
    const isSwipe = isSent ? info.offset.x < threshold : info.offset.x > threshold;

    if (isSwipe) {
        onReply(message);
    }
    controls.start({ x: 0 });
  };
  
  const handleReactionPillClick = (emoji: string) => {
    if (selectionMode) return;
    onAddReaction(message, emoji);

    if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
    }
    setVisibleTooltip(emoji);
    tooltipTimeoutRef.current = window.setTimeout(() => {
        setVisibleTooltip(null);
    }, 2000);
  };

  const renderMessageContent = () => {
    switch (message.mediaType) {
        case 'image':
            return (
                <div className="relative cursor-pointer" onClick={() => !selectionMode && onMediaClick(message)}>
                    <img src={message.mediaUrl} alt={message.text} className="w-full max-w-[250px] rounded-lg" />
                </div>
            );
        case 'video':
            return (
                <div className="relative cursor-pointer" onClick={() => !selectionMode && onMediaClick(message)}>
                    <video src={message.mediaUrl} className="w-full max-w-[250px] rounded-lg bg-black" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                        <PlayCircle size={48} className="text-white/80" />
                    </div>
                </div>
            );
        case 'audio':
             return <audio controls src={message.mediaUrl} className="w-full max-w-[250px] h-10" />;
        default:
            return <p className="text-base whitespace-pre-wrap break-words">{message.text}</p>;
    }
  };


  return (
    <div 
        id={id}
        className={`w-full flex items-center gap-2 my-1 group relative transition-colors duration-200 rounded-lg ${isSelected ? 'bg-accent-brand/20' : ''}`}
        onContextMenu={(e) => handleNativeContextMenu(e)}
        onClick={handleClick}
    >
        {selectionMode && (
          <div className="flex-shrink-0 w-8 flex items-center justify-center">
            <CheckSquare size={24} className={`transition-colors ${isSelected ? 'text-accent-brand' : 'text-text-primary/20 dark:text-gray-600'}`} />
          </div>
        )}
        <motion.div
            drag={selectionMode ? false : "x"}
            dragConstraints={{ left: isSent ? -100 : 0, right: isSent ? 0 : 100 }}
            onDragEnd={handleDragEnd}
            animate={controls}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full flex items-end gap-2"
            style={{ touchAction: 'pan-y' }}
        >
          <div className={`w-full flex items-end gap-2 ${bubbleContainerClasses}`}>
              <div className="flex flex-col">
                <div className={`relative ${reactionEntries.length > 0 ? 'mb-4' : ''}`}>
                    <div
                        className={`relative max-w-xs sm:max-w-md p-2 px-3 rounded-2xl shadow-sm user-select-none ${bubbleClasses}`}
                    >
                        {message.replyTo && (
                        <div className="border-l-2 border-accent-brand/50 pl-2 mb-1 text-sm opacity-80">
                            <p className="font-bold">{message.replyTo.senderName}</p>
                            <p className="truncate">{message.replyTo.text}</p>
                        </div>
                        )}
                        
                        {renderMessageContent()}
                    </div>
                    
                    {reactionEntries.length > 0 && (
                      <div className={`absolute bottom-0 translate-y-1/2 flex items-center gap-1 z-10 ${isSent ? 'right-2' : 'left-2'}`}>
                        {reactionEntries.map(([emoji, uids]) => (
                          <div key={emoji} className="relative">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleReactionPillClick(emoji); }}
                                className="bg-secondary-cream/90 dark:bg-gray-600/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 shadow-md"
                            >
                                <span>{emoji}</span>
                                {(uids as string[]).length > 1 && <span className="font-semibold text-text-primary/80 dark:text-gray-200">{(uids as string[]).length}</span>}
                            </button>
                            {visibleTooltip === emoji && <ReactionTooltip uids={uids as string[]} userCache={userCache}/>}
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                <div className={`flex items-center gap-1.5 mt-1 px-1 ${isSent ? 'self-end' : 'self-start'}`}>
                    {message.isEdited && <span className="text-xs text-text-primary/50 dark:text-gray-500">(edited)</span>}
                    <span className="text-xs text-text-primary/50 dark:text-gray-500">{message.timestamp ? format(message.timestamp.toDate(), 'p') : '...'}</span>
                    {readReceipt}
                </div>
              </div>
          </div>
        </motion.div>
    </div>
  );
};

export default ChatBubble;
