import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { User, Message, ChatWithDetails, Presence, ReactionMap } from '../types';
import Avatar from '../components/Avatar';
import ChatBubble from '../components/ChatBubble';
import InputBar from '../components/InputBar';
import ReplyPreview from '../components/ReplyPreview';
import ContextMenu from '../components/ContextMenu';
import MediaViewer from '../components/MediaViewer';
import { ArrowLeft, Phone, MoreVertical, Video, Send, X, Shield, Pin, Copy, Trash, Edit, Languages, Search, Slash, CheckSquare, Square, Loader2 } from 'lucide-react';
import { db, storage } from '../firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { compressImage } from '../utils/media';
import { useDebouncedCallback } from 'use-debounce';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatScreenProps {
  chat: ChatWithDetails;
  onBack: () => void;
  currentUser: User;
  onStartCall: (type: 'audio' | 'video', user: User) => void;
  onViewProfile: () => void;
  userCache: { [uid: string]: User };
  setUserCache: React.Dispatch<React.SetStateAction<{ [uid: string]: User }>>;
  chatBackgroundImageUrl?: string;
}

let audioContext: AudioContext | null = null;
const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
};

const playSound = (type: 'incoming' | 'outgoing') => {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Use a softer volume and sine wave for a more pleasant sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.01);
    oscillator.type = 'sine';

    if (type === 'incoming') {
        oscillator.frequency.value = 880; // A5 note
    } else {
        oscillator.frequency.value = 659; // E5 note
    }

    // Shorter, softer sound
    oscillator.start(audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.15);
    oscillator.stop(audioContext.currentTime + 0.15);
};

const ChatScreen: React.FC<ChatScreenProps> = ({ chat, onBack, currentUser, onStartCall, onViewProfile, userCache, setUserCache, chatBackgroundImageUrl }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [otherUserPresence, setOtherUserPresence] = useState<Presence | null>(null);
  const [realtimeOtherParticipant, setRealtimeOtherParticipant] = useState<User>(chat.otherParticipant);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [isChatSearchVisible, setIsChatSearchVisible] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [viewingMedia, setViewingMedia] = useState<Message | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = db.collection('chats').doc(chat.id).collection('messages');
  const chatRef = db.collection('chats').doc(chat.id);
  
  useEffect(() => {
    const userRef = db.collection('users').doc(chat.otherParticipant.uid);
    const unsubscribe = userRef.onSnapshot(doc => {
        if (doc.exists) {
            setRealtimeOtherParticipant({ uid: doc.id, ...doc.data() } as User);
        }
    });
    return () => unsubscribe();
  }, [chat.otherParticipant.uid]);

  useEffect(() => {
    if(!isChatSearchVisible && !selectionMode) { 
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isChatSearchVisible, selectionMode]);
  
  // Messages listener
  useEffect(() => {
    const q = chatMessagesRef.orderBy('timestamp', 'asc');
    const unsubscribe = q.onSnapshot((querySnapshot) => {
        querySnapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const newMessage = { id: change.doc.id, ...change.doc.data() } as Message;
                if (newMessage.senderId === realtimeOtherParticipant.uid && newMessage.timestamp) {
                    const messageTime = newMessage.timestamp.toDate();
                    if ((new Date().getTime() - messageTime.getTime()) < 5000) { 
                         playSound('incoming');
                    }
                }
            }
        });

        const msgs = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Message))
            .filter(msg => !msg.deletedFor || !msg.deletedFor.includes(currentUser.uid));
        setMessages(msgs);
    });
    return () => unsubscribe();
  }, [chat.id, realtimeOtherParticipant.uid, currentUser.uid]);

  // Presence, Typing, and Pinned Message listener
  useEffect(() => {
    const presenceUnsubscribe = db.collection('presence').doc(realtimeOtherParticipant.uid)
        .onSnapshot(doc => setOtherUserPresence(doc.data() as Presence));
    
    const chatUnsubscribe = chatRef.onSnapshot(async (doc) => {
        const data = doc.data();
        if (data?.typing) setIsOtherUserTyping(data.typing[realtimeOtherParticipant.uid] || false);

        if (data?.pinnedMessageId) {
            if (pinnedMessage?.id !== data.pinnedMessageId) {
                const pinnedMsgDoc = await chatMessagesRef.doc(data.pinnedMessageId).get();
                if (pinnedMsgDoc.exists) {
                    const pinnedMsgData = { id: pinnedMsgDoc.id, ...pinnedMsgDoc.data() } as Message;
                    if (!pinnedMsgData.deletedFor?.includes(currentUser.uid)) {
                        setPinnedMessage(pinnedMsgData);
                    } else {
                        setPinnedMessage(null);
                    }
                } else {
                    setPinnedMessage(null);
                    chatRef.update({ pinnedMessageId: firebase.firestore.FieldValue.delete() });
                }
            }
        } else {
            setPinnedMessage(null);
        }
    });

    return () => {
        presenceUnsubscribe();
        chatUnsubscribe();
    };
  }, [chat.id, realtimeOtherParticipant.uid, pinnedMessage?.id, currentUser.uid]);

  // Reset unread count and mark messages as read
  useEffect(() => {
    const markMessagesAsRead = () => {
        if (messages.length > 0 && document.visibilityState === 'visible') {
            chatRef.update({ [`unreadCount.${currentUser.uid}`]: 0 });
            const batch = db.batch();
            messages.forEach(msg => {
                if (msg.senderId === realtimeOtherParticipant.uid && !msg.readBy.includes(currentUser.uid)) {
                    batch.update(chatMessagesRef.doc(msg.id), { readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
                }
            });
            batch.commit().catch(console.error);
        }
    }
    markMessagesAsRead();
    document.addEventListener('visibilitychange', markMessagesAsRead);
    return () => document.removeEventListener('visibilitychange', markMessagesAsRead);
  }, [messages, chat.id, currentUser.uid, realtimeOtherParticipant.uid]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const newMessageData: Omit<Message, 'id' | 'timestamp'> & { timestamp: any } = {
        text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderId: currentUser.uid,
        readBy: [currentUser.uid],
    };

    if (replyingTo) {
        newMessageData.replyTo = {
            messageId: replyingTo.id,
            text: replyingTo.text,
            senderName: replyingTo.senderId === currentUser.uid ? currentUser.name : (currentUser.nicknames?.[realtimeOtherParticipant.uid] || realtimeOtherParticipant.name),
        };
        setReplyingTo(null);
    }
    
    const addedMessageRef = await chatMessagesRef.add(newMessageData);
    
    const finalMessageDoc = await addedMessageRef.get();
    const finalMessage = { id: finalMessageDoc.id, ...finalMessageDoc.data() } as Message;

    await chatRef.update({
        lastMessage: finalMessage,
        [`unreadCount.${realtimeOtherParticipant.uid}`]: firebase.firestore.FieldValue.increment(1)
    });
    playSound('outgoing');
  };

  const handleSendMedia = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
        alert("Unsupported file type.");
        return;
    }
    
    setIsUploadingMedia(true);
    try {
        const fileToUpload = isImage ? await compressImage(file) : file;
        
        const messageRef = chatMessagesRef.doc();
        const storageRef = storage.ref(`media/${chat.id}/${messageRef.id}-${file.name}`);
        
        const uploadTask = await storageRef.put(fileToUpload);
        const downloadURL = await uploadTask.ref.getDownloadURL();

        const messageText = isImage ? "📷 Image" : "📹 Video";

        const newMessageData: Omit<Message, 'id'|'timestamp'> & { timestamp: any } = {
            text: messageText,
            mediaType: isImage ? 'image' : 'video',
            mediaUrl: downloadURL,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            senderId: currentUser.uid,
            readBy: [currentUser.uid],
        };
        
        await messageRef.set(newMessageData);
        
        const finalMessageDoc = await messageRef.get();
        const finalMessage = { id: finalMessageDoc.id, ...finalMessageDoc.data() } as Message;

        await chatRef.update({
            lastMessage: finalMessage,
            [`unreadCount.${realtimeOtherParticipant.uid}`]: firebase.firestore.FieldValue.increment(1)
        });
        playSound('outgoing');
    } catch (error) {
        console.error("Error sending media message:", error);
        alert("Could not send media. Please check your Firebase Storage rules and try again.");
    } finally {
        setIsUploadingMedia(false);
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    const messageRef = chatMessagesRef.doc();
    const storageRef = storage.ref(`audio/${chat.id}/${messageRef.id}.webm`);
    
    setIsUploadingMedia(true);
    try {
        const uploadTask = await storageRef.put(audioBlob);
        const downloadURL = await uploadTask.ref.getDownloadURL();

        const newMessageData: Omit<Message, 'id'|'timestamp'> & { timestamp: any } = {
            text: "🎤 Voice Message",
            mediaType: 'audio',
            mediaUrl: downloadURL,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            senderId: currentUser.uid,
            readBy: [currentUser.uid],
        };
        
        await messageRef.set(newMessageData);
        
        const finalMessageDoc = await messageRef.get();
        const finalMessage = { id: finalMessageDoc.id, ...finalMessageDoc.data() } as Message;

        await chatRef.update({
            lastMessage: finalMessage,
            [`unreadCount.${realtimeOtherParticipant.uid}`]: firebase.firestore.FieldValue.increment(1)
        });
        playSound('outgoing');
    } catch (error) {
        console.error("Error sending audio message:", error);
        alert("Could not send voice message. Please check your Firebase Storage rules and try again.");
    } finally {
        setIsUploadingMedia(false);
    }
  };

  const setTypingStatus = useDebouncedCallback((isTyping: boolean) => {
    chatRef.update({ [`typing.${currentUser.uid}`]: isTyping });
  }, 300);

  const handleUpdateMessage = async () => {
    if (!editingMessage || !editText.trim()) return;
    await chatMessagesRef.doc(editingMessage.id).update({ text: editText, isEdited: true });
    setEditingMessage(null);
    setEditText("");
  };

  const handleDeleteMessage = async (message: Message) => {
    const messageRef = chatMessagesRef.doc(message.id);
    await messageRef.update({
        deletedFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
  };

  const handleToggleMessageSelection = (messageId: string) => {
    setSelectedMessages(prev => 
        prev.includes(messageId) 
        ? prev.filter(id => id !== messageId) 
        : [...prev, messageId]
    );
  };
  
  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessages([]);
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedMessages.length} message(s) for you?`)) {
      const batch = db.batch();
      selectedMessages.forEach(id => {
        const ref = chatMessagesRef.doc(id);
        batch.update(ref, { deletedFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
      });
      await batch.commit();
      handleCancelSelection();
    }
  };

  const handleSelectAll = () => {
    setSelectedMessages(messages.map(m => m.id));
  };
  
  const handleMainContextMenu = (e: React.MouseEvent) => {
    if (e.target === messagesContainerRef.current) {
      e.preventDefault();
      setSelectionMode(true);
      setSelectedMessages([]);
    }
  };


  const handleContextMenu = (message: Message) => {
      setContextMenuMessage(message);
  };
  
  const handleAddReaction = (message: Message, emoji: string) => {
    setMessages(prevMessages => prevMessages.map(msg => {
      if (msg.id === message.id) {
        const newReactions: ReactionMap = { ...(msg.reactions || {}) };
        
        let userPreviousReaction: string | null = null;
        for (const e in newReactions) {
          if (newReactions[e].includes(currentUser.uid)) {
            userPreviousReaction = e;
            break;
          }
        }

        if (userPreviousReaction) {
          newReactions[userPreviousReaction] = newReactions[userPreviousReaction].filter(uid => uid !== currentUser.uid);
          if (newReactions[userPreviousReaction].length === 0) {
            delete newReactions[userPreviousReaction];
          }
        }

        if (userPreviousReaction !== emoji) {
            if (!newReactions[emoji]) {
                newReactions[emoji] = [];
            }
            newReactions[emoji].push(currentUser.uid);
        }

        return { ...msg, reactions: newReactions };
      }
      return msg;
    }));

    const messageRef = chatMessagesRef.doc(message.id);
    db.runTransaction(async (transaction) => {
        const doc = await transaction.get(messageRef);
        if (!doc.exists) return;

        const reactions = (doc.data()?.reactions || {}) as ReactionMap;

        let previousReaction: string | null = null;
        for (const key in reactions) {
            if (reactions[key].includes(currentUser.uid)) {
                previousReaction = key;
                break;
            }
        }

        if (previousReaction === emoji) {
            reactions[previousReaction] = reactions[previousReaction].filter(uid => uid !== currentUser.uid);
        } else {
            if (previousReaction) {
                reactions[previousReaction] = reactions[previousReaction].filter(uid => uid !== currentUser.uid);
            }
            if (!reactions[emoji]) reactions[emoji] = [];
            reactions[emoji].push(currentUser.uid);
        }
        
        transaction.update(messageRef, { reactions });
    }).catch(console.error);
  };

  const handleReportUser = () => {
    setHeaderMenuOpen(false);
    const displayName = currentUser.nicknames?.[realtimeOtherParticipant.uid] || realtimeOtherParticipant.name;
    if(window.confirm(`Are you sure you want to report ${displayName}? This action cannot be undone.`)) {
        db.collection('reports').add({
            reportedUserId: realtimeOtherParticipant.uid, reportedBy: currentUser.uid, reason: "Reported from chat menu", chatId: chat.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => alert(`${displayName} has been reported successfully.`)).catch(() => alert('Failed to submit report. Please try again.'))
          .finally(() => handleBlockUser(false));
    }
  };

  const handleBlockUser = async (confirm = true) => {
    setHeaderMenuOpen(false);
    const displayName = currentUser.nicknames?.[realtimeOtherParticipant.uid] || realtimeOtherParticipant.name;
    const blockAction = async () => {
        await db.collection('users').doc(currentUser.uid).update({
            blockedUsers: firebase.firestore.FieldValue.arrayUnion(realtimeOtherParticipant.uid)
        });
        alert(`${displayName} has been blocked.`);
        onBack();
    };

    if (confirm) {
        if (window.confirm(`Are you sure you want to block ${displayName}? You will no longer see their messages or chats, and they won't be able to contact you.`)) {
            await blockAction();
        }
    } else {
        await blockAction();
    }
  };

  const handleTogglePin = async (message: Message) => {
    const chatDoc = await chatRef.get();
    const currentPinnedId = chatDoc.data()?.pinnedMessageId;
    if (currentPinnedId === message.id) {
        await chatRef.update({ pinnedMessageId: firebase.firestore.FieldValue.delete() });
    } else {
        await chatRef.update({ pinnedMessageId: message.id });
    }
  };
  
  const handleScrollToPinned = () => {
    if (pinnedMessage && messagesContainerRef.current) {
      const element = messagesContainerRef.current.querySelector(`#msg-${pinnedMessage.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-accent-brand', 'rounded-2xl', 'transition-all', 'duration-300', 'p-1', '-m-1');
        setTimeout(() => element.classList.remove('ring-2', 'ring-accent-brand', 'rounded-2xl', 'p-1', '-m-1'), 2000);
      }
    }
  };
  
  const handleHeaderMenuToggle = () => {
    if (!headerMenuOpen) {
      setContextMenuMessage(null); // Close message context menu first
    }
    setHeaderMenuOpen(!headerMenuOpen);
  };


  const contextMenuOptions = useMemo(() => contextMenuMessage ? [
        contextMenuMessage.mediaType !== 'audio' && { label: 'Copy', icon: Copy, onClick: () => navigator.clipboard.writeText(contextMenuMessage.text) },
        contextMenuMessage.senderId === currentUser.uid && !contextMenuMessage.mediaType && { label: 'Edit', icon: Edit, onClick: () => { setEditingMessage(contextMenuMessage); setEditText(contextMenuMessage.text); }},
        { label: pinnedMessage?.id === contextMenuMessage.id ? 'Unpin' : 'Pin', icon: Pin, onClick: () => handleTogglePin(contextMenuMessage) },
        { label: 'Delete for me', icon: Trash, onClick: () => handleDeleteMessage(contextMenuMessage), isDestructive: true },
    ].filter(Boolean) as any[] : [], [contextMenuMessage, currentUser.uid, pinnedMessage]);

  const displayName = currentUser.nicknames?.[realtimeOtherParticipant.uid] || realtimeOtherParticipant.name;

  const filteredMessages = useMemo(() => {
    if (!isChatSearchVisible || !chatSearchQuery) return messages;
    return messages.filter(msg => msg.text.toLowerCase().includes(chatSearchQuery.toLowerCase()));
  }, [messages, isChatSearchVisible, chatSearchQuery]);

  const renderHeader = () => {
    if (selectionMode) {
      return (
        <header className="p-3 flex items-center justify-between bg-secondary-cream/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
          <button onClick={handleCancelSelection} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1"><X size={24} /></button>
          <span className="font-bold text-lg text-text-primary dark:text-gray-100">{selectedMessages.length} selected</span>
          <button onClick={handleSelectAll} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
             {selectedMessages.length === messages.length ? <CheckSquare size={24} /> : <Square size={24} /> }
          </button>
        </header>
      )
    }

    let statusText = otherUserPresence?.lastSeen ? `Last seen: ${new Date(otherUserPresence.lastSeen.toDate()).toLocaleString()}` : 'Offline';
    let statusColor = 'text-text-primary/70 dark:text-gray-400';
    if (otherUserPresence?.isOnline) {
        statusText = 'Online';
        statusColor = 'text-accent-green';
    }
    if (isOtherUserTyping) {
        statusText = 'typing...';
        statusColor = 'text-accent-green animate-pulse';
    }

    if (isChatSearchVisible) {
        return (
             <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                <Search size={22} className="text-text-primary/50 dark:text-gray-500 flex-shrink-0" />
                <input
                    type="text"
                    placeholder={`Search in chat with ${displayName}`}
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-text-primary dark:text-gray-100 placeholder:text-text-primary/50 dark:placeholder:text-gray-500 text-lg"
                    autoFocus
                />
                <button onClick={() => setIsChatSearchVisible(false)} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1"><X size={24} /></button>
            </header>
        )
    }

    return (
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white"><ArrowLeft size={24} /></button>
        <button onClick={onViewProfile} className="flex items-center gap-3 flex-1">
            <Avatar src={realtimeOtherParticipant.avatarUrl || `https://picsum.photos/seed/${realtimeOtherParticipant.uid}/100/100`} alt={displayName} isOnline={otherUserPresence?.isOnline} size="sm" />
            <div className="flex-1 text-left">
              <h2 className="font-bold text-lg text-text-primary dark:text-gray-100">{displayName}</h2>
              <p className={`text-sm font-semibold ${statusColor}`}>{statusText}</p>
            </div>
        </button>
        <div className="flex items-center gap-4">
          <button onClick={() => onStartCall('audio', realtimeOtherParticipant)} className="text-accent-brand hover:opacity-80"><Phone size={22} /></button>
          <button onClick={() => onStartCall('video', realtimeOtherParticipant)} className="text-accent-brand hover:opacity-80"><Video size={22} /></button>
          <div className="relative">
            <button onClick={handleHeaderMenuToggle} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white"><MoreVertical size={22} /></button>
            {headerMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-secondary-cream dark:bg-gray-800 rounded-xl shadow-lg z-30 py-1" onMouseLeave={() => setHeaderMenuOpen(false)}>
                    <button onClick={() => { setIsChatSearchVisible(true); setHeaderMenuOpen(false); }} className="w-full text-left px-4 py-2 text-text-primary dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3"><Search size={16}/> Search</button>
                    <button onClick={() => handleBlockUser()} className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-500/10 flex items-center gap-3"><Slash size={16}/> Block User</button>
                    <button onClick={handleReportUser} className="w-full text-left px-4 py-2 text-text-primary dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3"><Shield size={16}/> Report User</button>
                </div>
            )}
          </div>
        </div>
      </header>
    );
  };

  const renderPinnedMessage = () => {
      if (!pinnedMessage) return null;
      const senderName = pinnedMessage.senderId === currentUser.uid ? 'You' : displayName;
      return (
          <div className="p-2 bg-secondary-cream/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-base-tan/50 dark:border-gray-700/50 sticky top-[68px] z-10">
              <div
                  className="p-2 rounded-lg flex items-center gap-2 cursor-pointer"
                  onClick={handleScrollToPinned}
              >
                  <Pin size={16} className="text-accent-brand flex-shrink-0" />
                  <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-accent-brand text-sm">Pinned: {senderName}</p>
                      <p className="text-text-primary/80 dark:text-gray-300 truncate text-base">{pinnedMessage.text}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleTogglePin(pinnedMessage); }} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                      <X size={16} className="text-text-primary/70 dark:text-gray-400" />
                  </button>
              </div>
          </div>
      );
  };

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900" style={{
        backgroundImage: chatBackgroundImageUrl ? `url(${chatBackgroundImageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    }}>
      {renderHeader()}
      {renderPinnedMessage()}
      
      <main 
        ref={messagesContainerRef} 
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-2 flex flex-col" 
        onClick={() => { if(headerMenuOpen) setHeaderMenuOpen(false); }}
        onContextMenu={handleMainContextMenu}
      >
        {filteredMessages.map(msg => (
          <ChatBubble 
            key={msg.id} message={msg} currentUser={currentUser} otherParticipant={realtimeOtherParticipant}
            onContextMenu={handleContextMenu}
            onAddReaction={handleAddReaction}
            onReply={setReplyingTo}
            onMediaClick={setViewingMedia}
            onToggleSelection={handleToggleMessageSelection}
            selectionMode={selectionMode}
            isSelected={selectedMessages.includes(msg.id)}
            userCache={userCache}
            id={`msg-${msg.id}`}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {viewingMedia && <MediaViewer message={viewingMedia} onClose={() => setViewingMedia(null)} />}

      {editingMessage ? (
        <div className="p-2 bg-secondary-cream dark:bg-gray-800 border-t border-base-tan/50 dark:border-gray-700 flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-base-tan/50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-bold text-accent-brand">Editing Message</p>
                <input 
                    type="text" value={editText} onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateMessage()}
                    className="w-full bg-transparent outline-none text-text-primary dark:text-gray-100 text-lg" autoFocus
                />
            </div>
            <button onClick={handleUpdateMessage} className="p-2 w-10 h-10 flex items-center justify-center bg-accent-brand text-white rounded-full"><Send size={20} /></button>
            <button onClick={() => setEditingMessage(null)} className="p-2 w-10 h-10 flex items-center justify-center bg-text-primary/50 text-white rounded-full"><X size={20} /></button>
        </div>
      ) : (
        <>
            <AnimatePresence>
            {selectionMode && (
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="p-2 bg-secondary-cream dark:bg-gray-800 border-t border-base-tan/50 dark:border-gray-700 flex items-center justify-end"
              >
                  <button 
                    onClick={handleDeleteSelected}
                    disabled={selectedMessages.length === 0}
                    className="p-3 bg-red-500 text-white rounded-full disabled:bg-red-500/50"
                  >
                    <Trash size={24} />
                  </button>
              </motion.div>
            )}
            </AnimatePresence>
            
            {!selectionMode && (
              <>
                {replyingTo && <ReplyPreview message={replyingTo} currentUser={currentUser} otherParticipant={realtimeOtherParticipant} onCancel={() => setReplyingTo(null)} />}
                <InputBar 
                    onSendMessage={handleSendMessage} 
                    onSendAudio={handleSendAudio} 
                    onSendMedia={handleSendMedia} 
                    onTyping={setTypingStatus}
                    disabled={isUploadingMedia} 
                />
              </>
            )}
        </>
      )}

      {isUploadingMedia && (
        <div className="p-2 bg-base-tan dark:bg-gray-900 text-center text-sm font-semibold text-text-primary/70 dark:text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span>Sending media...</span>
        </div>
      )}

      {contextMenuMessage && !selectionMode && (
        <ContextMenu
          options={contextMenuOptions}
          onClose={() => setContextMenuMessage(null)}
          onEmojiSelect={(emoji) => handleAddReaction(contextMenuMessage, emoji)}
        />
      )}
    </div>
  );
};

export default ChatScreen;