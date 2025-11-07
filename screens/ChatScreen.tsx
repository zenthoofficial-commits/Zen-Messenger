import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { User, Message, ChatWithDetails, Presence, ReactionMap } from '../types';
import Avatar from '../components/Avatar';
import ChatBubble from '../components/ChatBubble';
import InputBar from '../components/InputBar';
import ReplyPreview from '../components/ReplyPreview';
import ContextMenu from '../components/ContextMenu';
import MediaViewer from '../components/MediaViewer';
import PermissionModal from '../components/PermissionModal';
import { ArrowLeft, Phone, MoreVertical, Video, Send, X, Shield, Pin, Copy, Trash, Edit, Languages, Search, Slash, CheckSquare, Square, Loader2 } from 'lucide-react';
import { db, storage } from '../firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import { compressImage } from '../utils/media';
import { useDebouncedCallback } from 'use-debounce';
import { motion, AnimatePresence } from 'framer-motion';
import { translateText } from '../utils/gemini';

interface ChatScreenProps {
  chat: ChatWithDetails;
  onBack: () => void;
  currentUser: User;
  onStartCall: (type: 'audio' | 'video', user: User, chatId: string) => void;
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
    // FIX: Cast audioContext to `any` to bypass a likely incorrect TypeScript definition for `createGain` which expects 1 argument.
    const gainNode = (audioContext as any).createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.01);
    oscillator.type = 'sine';

    if (type === 'incoming') {
        oscillator.frequency.value = 880; // A5 note
    } else {
        oscillator.frequency.value = 659; // E5 note
    }

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
  const [uploadState, setUploadState] = useState<{ progress: number; fileName: string; } | null>(null);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [permissionError, setPermissionError] = useState<{name: 'geolocation', feature: string} | null>(null);
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = db.ref(`messages/${chat.id}`);
  const chatRef = db.ref(`chats/${chat.id}`);
  const prevMessagesRef = useRef<Message[]>();
  
  useEffect(() => {
    const userRef = db.ref(`users/${chat.otherParticipant.uid}`);
    const listener = userRef.on('value', snapshot => {
        if (snapshot.exists()) {
            setRealtimeOtherParticipant({ uid: snapshot.key, ...snapshot.val() } as User);
        }
    }, error => console.error("RTDB Error: Failed to listen for other participant's profile.", error));
    return () => userRef.off('value', listener);
  }, [chat.otherParticipant.uid]);

  useEffect(() => {
    if(!isChatSearchVisible && !selectionMode) { 
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length, isChatSearchVisible, selectionMode]);
  
  useEffect(() => {
    const q = chatMessagesRef.orderByChild('timestamp');

    const listener = q.on('value', (snapshot) => {
        const loadedMessages: Message[] = [];
        if(snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const msg = { id: childSnapshot.key, ...childSnapshot.val() } as Message;
                if (!msg.deletedFor?.[currentUser.uid]) {
                    loadedMessages.push(msg);
                }
            });
        }
        setMessages(prev => {
            // Preserve existing translatedText on new messages load
            return loadedMessages.map(newMsg => {
                const existingMsg = prev.find(p => p.id === newMsg.id);
                return existingMsg?.translatedText ? { ...newMsg, translatedText: existingMsg.translatedText } : newMsg;
            });
        });
    });

    return () => {
        q.off('value', listener);
    };
  }, [chat.id, currentUser.uid]);

  useEffect(() => {
    if (prevMessagesRef.current && prevMessagesRef.current.length < messages.length) {
        const lastMessage = messages[messages.length-1];
        if (lastMessage.senderId !== currentUser.uid && lastMessage.timestamp > Date.now() - 5000) {
             playSound('incoming');
        }
    }
    prevMessagesRef.current = messages;
  }, [messages, currentUser.uid]);


  // Presence, Typing, and Pinned Message listener
  useEffect(() => {
    const presenceRef = db.ref(`presence/${realtimeOtherParticipant.uid}`);
    const presenceListener = presenceRef.on('value', snap => setOtherUserPresence(snap.val() as Presence), 
        error => console.error("RTDB Error: Failed to listen for presence.", error));
    
    const chatListener = chatRef.on('value', async (snapshot) => {
        try {
            const data = snapshot.val();
            if (data?.typing) setIsOtherUserTyping(data.typing[realtimeOtherParticipant.uid] || false);

            if (data?.pinnedMessageId) {
                if (pinnedMessage?.id !== data.pinnedMessageId) {
                    const pinnedMsgSnap = await chatMessagesRef.child(data.pinnedMessageId).once('value');
                    if (pinnedMsgSnap.exists()) {
                        const pinnedMsgData = { id: pinnedMsgSnap.key, ...pinnedMsgSnap.val() } as Message;
                        if (!pinnedMsgData.deletedFor?.[currentUser.uid]) {
                            setPinnedMessage(pinnedMsgData);
                        } else {
                            setPinnedMessage(null);
                        }
                    } else {
                        setPinnedMessage(null);
                        await chatRef.child('pinnedMessageId').remove();
                    }
                }
            } else {
                setPinnedMessage(null);
            }
        } catch (error) {
            console.error("RTDB Error: Failed to process chat updates.", error);
        }
    }, error => console.error("RTDB Error: Failed to listen for chat document.", error));

    return () => {
        presenceRef.off('value', presenceListener);
        chatRef.off('value', chatListener);
    };
  }, [chat.id, realtimeOtherParticipant.uid, pinnedMessage?.id, currentUser.uid]);

  // Mark messages as read
  useEffect(() => {
    const markMessagesAsRead = () => {
        if (document.visibilityState === 'visible') {
            const updates: { [key: string]: boolean } = {};
            messages.forEach(msg => {
                if (msg.senderId === realtimeOtherParticipant.uid && (!msg.readBy || !msg.readBy[currentUser.uid])) {
                    updates[`/messages/${chat.id}/${msg.id}/readBy/${currentUser.uid}`] = true;
                }
            });
            if (Object.keys(updates).length > 0) {
              db.ref().update(updates).catch(e => console.error("Error marking messages as read", e));
            }
        }
    }
    markMessagesAsRead();
    document.addEventListener('visibilitychange', markMessagesAsRead);
    return () => document.removeEventListener('visibilitychange', markMessagesAsRead);
  }, [messages, chat.id, currentUser.uid, realtimeOtherParticipant.uid]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    try {
        const newMessageRef = chatMessagesRef.push();
        const newMessageData: Omit<Message, 'id'> = {
            text,
            timestamp: firebase.database.ServerValue.TIMESTAMP as number,
            senderId: currentUser.uid,
            readBy: { [currentUser.uid]: true },
        };

        if (replyingTo) {
            newMessageData.replyTo = {
                messageId: replyingTo.id,
                text: replyingTo.text,
                senderName: replyingTo.senderId === currentUser.uid ? currentUser.name : (currentUser.nicknames?.[realtimeOtherParticipant.uid] || realtimeOtherParticipant.name),
            };
            setReplyingTo(null);
        }
        
        await newMessageRef.set(newMessageData);
        
        const finalMessage = { ...newMessageData, id: newMessageRef.key! } as Message;

        const updates = {
            lastMessage: finalMessage,
            [`unreadCount/${realtimeOtherParticipant.uid}`]: firebase.database.ServerValue.increment(1)
        };
        await chatRef.update(updates);

        playSound('outgoing');
    } catch (error) {
        console.error("RTDB Error: Failed to send message.", error);
        alert("Could not send message. Please try again.");
    }
  };

  const handleSendMedia = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
        alert("Unsupported file type.");
        return;
    }
    
    const fileToUpload = isImage ? await compressImage(file) : file;
    
    setUploadState({ progress: 0, fileName: file.name });
    
    const messageRef = chatMessagesRef.push();
    const storageRef = storage.ref(`media/${chat.id}/${messageRef.key}-${file.name}`);
    
    const uploadTask = storageRef.put(fileToUpload);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadState(prevState => prevState ? { ...prevState, progress } : { progress, fileName: file.name });
      },
      (error) => {
        console.error("Error sending media message:", error);
        alert("Could not send media. Please check your Firebase Storage rules and try again.");
        setUploadState(null);
      },
      async () => {
        try {
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();

            const messageText = isImage ? "📷 Image" : "📹 Video";

            const newMessageData: Omit<Message, 'id'> = {
                text: messageText,
                mediaType: isImage ? 'image' : 'video',
                mediaUrl: downloadURL,
                timestamp: firebase.database.ServerValue.TIMESTAMP as number,
                senderId: currentUser.uid,
                readBy: { [currentUser.uid]: true },
            };
            
            await messageRef.set(newMessageData);
            
            const finalMessage = { ...newMessageData, id: messageRef.key! } as Message;

            const updates = {
                lastMessage: finalMessage,
                [`unreadCount/${realtimeOtherParticipant.uid}`]: firebase.database.ServerValue.increment(1)
            };
            await chatRef.update(updates);
            playSound('outgoing');
        } catch (error) {
            console.error("Error saving media message to RTDB:", error);
            alert("Media uploaded, but failed to send message. Please try again.");
        } finally {
            setUploadState(null);
        }
      }
    );
  };

  const handleSendAudio = (audioBlob: Blob) => {
    const fileName = `Voice Message.webm`;
    const messageRef = chatMessagesRef.push();
    const storageRef = storage.ref(`audio/${chat.id}/${messageRef.key}.webm`);
    
    setUploadState({ progress: 0, fileName: fileName });
    
    const uploadTask = storageRef.put(audioBlob);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadState(prevState => prevState ? { ...prevState, progress } : { progress, fileName });
      },
      (error) => {
        console.error("Error sending audio message:", error);
        alert("Could not send voice message. Please check your Firebase Storage rules and try again.");
        setUploadState(null);
      },
      async () => {
        try {
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();

            const newMessageData: Omit<Message, 'id'> = {
                text: "🎤 Voice Message",
                mediaType: 'audio',
                mediaUrl: downloadURL,
                timestamp: firebase.database.ServerValue.TIMESTAMP as number,
                senderId: currentUser.uid,
                readBy: { [currentUser.uid]: true },
            };
            
            await messageRef.set(newMessageData);
            
            const finalMessage = { ...newMessageData, id: messageRef.key! } as Message;

            const updates = {
                lastMessage: finalMessage,
                [`unreadCount/${realtimeOtherParticipant.uid}`]: firebase.database.ServerValue.increment(1)
            };
            await chatRef.update(updates);
            playSound('outgoing');
        } catch (error) {
            console.error("Error saving audio message to RTDB:", error);
            alert("Audio uploaded, but failed to send message. Please try again.");
        } finally {
            setUploadState(null);
        }
      }
    );
  };

  const handleSendLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    try {
        if (navigator.permissions) {
            const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            if (permissionStatus.state === 'denied') {
                setPermissionError({ name: 'geolocation', feature: 'location sharing' });
                setIsPermissionModalOpen(true);
                return;
            }
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                handleSendMessage(`My current location: ${locationUrl}`);
            },
            (error) => {
                console.error(`Geolocation error: ${error.message}`);
                setPermissionError({ name: 'geolocation', feature: 'location sharing' });
                setIsPermissionModalOpen(true);
            }
        );
    } catch (err) {
        console.error("Error checking geolocation permission:", err);
        alert("Could not check location permissions. Please try again.");
    }
  };

  const setTypingStatus = useDebouncedCallback((isTyping: boolean) => {
    chatRef.child(`typing/${currentUser.uid}`).set(isTyping).catch(error => console.error("RTDB Error: Failed to update typing status.", error));
  }, 300);

  const handleUpdateMessage = async () => {
    if (!editingMessage || !editText.trim()) return;
    try {
      await chatMessagesRef.child(editingMessage.id).update({ text: editText, isEdited: true });
      setEditingMessage(null);
      setEditText("");
    } catch(error) {
      console.error("RTDB Error: Failed to update message.", error);
      alert("Could not edit message. Please try again.");
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    try {
      await chatMessagesRef.child(`${message.id}/deletedFor/${currentUser.uid}`).set(true);
    } catch(error) {
      console.error("RTDB Error: Failed to delete message.", error);
      alert("Could not delete message. Please try again.");
    }
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
        const updates: { [key: string]: boolean } = {};
        selectedMessages.forEach(id => {
            updates[`/messages/${chat.id}/${id}/deletedFor/${currentUser.uid}`] = true;
        });
      try {
        await db.ref().update(updates);
        handleCancelSelection();
      } catch (error) {
        console.error("RTDB Error: Failed to delete selected messages.", error);
        alert("Could not delete messages. Please try again.");
      }
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
    const reactionRef = chatMessagesRef.child(`${message.id}/reactions`);
    
    reactionRef.transaction(reactions => {
        if (reactions === null) {
            reactions = {};
        }
        
        let userPreviousReaction: string | null = null;
        for (const e in reactions) {
            if (reactions[e] && reactions[e][currentUser.uid]) {
                userPreviousReaction = e;
                break;
            }
        }
        
        if (userPreviousReaction) {
            reactions[userPreviousReaction][currentUser.uid] = null; // Remove previous reaction
            if(Object.keys(reactions[userPreviousReaction]).length === 0) {
              reactions[userPreviousReaction] = null;
            }
        }

        if (userPreviousReaction !== emoji) {
            if (!reactions[emoji]) {
                reactions[emoji] = {};
            }
            reactions[emoji][currentUser.uid] = true;
        }

        return reactions;
    }).catch(e => console.error("RTDB Error: Failed to update reaction.", e));
  };

  const handleTranslateMessage = async (messageToTranslate: Message) => {
      setTranslatingMessageId(messageToTranslate.id);
      try {
        const translation = await translateText(messageToTranslate.text);
        setMessages(prevMessages => prevMessages.map(msg => 
          msg.id === messageToTranslate.id ? { ...msg, translatedText: translation } : msg
        ));
      } catch (error) {
        console.error("Translation failed", error);
        alert("Could not translate message.");
      } finally {
        setTranslatingMessageId(null);
      }
    };

    const handleCancelTranslation = (messageId: string) => {
        setMessages(prevMessages => 
            prevMessages.map(msg => {
                if (msg.id === messageId) {
                    const { translatedText, ...rest } = msg;
                    return rest;
                }
                return msg;
            })
        );
    };

  const handleReportUser = () => {
    setHeaderMenuOpen(false);
    const displayName = currentUser.nicknames?.[realtimeOtherParticipant.uid] || realtimeOtherParticipant.name;
    if(window.confirm(`Are you sure you want to report ${displayName}? This action cannot be undone.`)) {
        db.ref('reports').push().set({
            reportedUserId: realtimeOtherParticipant.uid, reportedBy: currentUser.uid, reason: "Reported from chat menu", chatId: chat.id,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => alert(`${displayName} has been reported successfully.`)).catch(() => alert('Failed to submit report. Please try again.'))
          .finally(() => handleBlockUser(false));
    }
  };

  const handleBlockUser = async (confirm = true) => {
    setHeaderMenuOpen(false);
    const displayName = currentUser.nicknames?.[realtimeOtherParticipant.uid] || realtimeOtherParticipant.name;
    const blockAction = async () => {
      try {
        await db.ref(`users/${currentUser.uid}/blockedUsers/${realtimeOtherParticipant.uid}`).set(true);
        alert(`${displayName} has been blocked.`);
        onBack();
      } catch (error) {
        console.error("RTDB Error: Failed to block user.", error);
        alert("Could not block user. Please try again.");
      }
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
    try {
      const chatSnap = await chatRef.once('value');
      const currentPinnedId = chatSnap.val()?.pinnedMessageId;
      if (currentPinnedId === message.id) {
          await chatRef.child('pinnedMessageId').remove();
      } else {
          await chatRef.child('pinnedMessageId').set(message.id);
      }
    } catch(error) {
      console.error("RTDB Error: Failed to pin message.", error);
      alert("Could not pin message. Please try again.");
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
        contextMenuMessage.senderId !== currentUser.uid && !contextMenuMessage.mediaType && { label: 'Translate', icon: Languages, onClick: () => handleTranslateMessage(contextMenuMessage) },
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

    let statusText = otherUserPresence?.lastSeen ? `Last seen: ${new Date(otherUserPresence.lastSeen).toLocaleString()}` : 'Offline';
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
            <Avatar src={realtimeOtherParticipant.avatarUrl || `https://picsum.photos/seed/${realtimeOtherParticipant.uid}/100/100`} alt={displayName} isOnline={otherUserPresence?.isOnline} size="sm" gender={realtimeOtherParticipant.gender}/>
            <div className="flex-1 text-left">
              <h2 className="font-bold text-lg text-text-primary dark:text-gray-100">{displayName}</h2>
              <p className={`text-sm font-semibold ${statusColor}`}>{statusText}</p>
            </div>
        </button>
        <div className="flex items-center gap-4">
          <button onClick={() => onStartCall('audio', realtimeOtherParticipant, chat.id)} className="text-accent-brand hover:opacity-80"><Phone size={22} /></button>
          <button onClick={() => onStartCall('video', realtimeOtherParticipant, chat.id)} className="text-accent-brand hover:opacity-80"><Video size={22} /></button>
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
        <PermissionModal 
            isOpen={isPermissionModalOpen}
            onClose={() => setIsPermissionModalOpen(false)}
            permissionName={permissionError?.name || 'microphone'}
            featureName={permissionError?.feature || 'this feature'}
        />
        <>
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
                isTranslating={translatingMessageId === msg.id}
                onCancelTranslation={handleCancelTranslation}
            />
            ))}
            <div ref={messagesEndRef} />
        </>
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
                    onSendLocation={handleSendLocation}
                    disabled={!!uploadState} 
                />
              </>
            )}
        </>
      )}

      {uploadState && (
        <div className="p-2 bg-base-tan dark:bg-gray-900">
            <div className="text-sm text-text-primary/80 dark:text-gray-300">
                <div className="flex justify-between items-center mb-1 px-1">
                    <span className="font-semibold truncate pr-2">Uploading: {uploadState.fileName}</span>
                    <span className="font-semibold">{Math.round(uploadState.progress)}%</span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5">
                    <div className="bg-accent-brand h-1.5 rounded-full transition-all duration-150" style={{ width: `${uploadState.progress}%` }}></div>
                </div>
            </div>
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