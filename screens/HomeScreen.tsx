import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Chat, ChatWithDetails, Presence } from '../types';
import ChatListItem from '../components/ChatListItem';
import Fab from '../components/Fab';
import ContextMenu from '../components/ContextMenu';
import Avatar from '../components/Avatar';
import { Search, Bell, Pin, EyeOff, Trash, ArrowLeft } from 'lucide-react';
import { db } from '../firebase';
import firebase from 'firebase/compat/app';

interface HomeScreenProps {
  onSelectChat: (chat: ChatWithDetails) => void;
  currentUser: User;
  onSearchClick: () => void;
  onProfileClick: () => void;
  onNotificationsClick: () => void;
  unreadNotifCount: number;
  userCache: { [uid: string]: User };
  setUserCache: React.Dispatch<React.SetStateAction<{ [uid: string]: User }>>;
  onFriendUidsUpdate: (uids: string[]) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectChat, currentUser, onSearchClick, onProfileClick, onNotificationsClick, unreadNotifCount, userCache, setUserCache, onFriendUidsUpdate }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [presence, setPresence] = useState<{ [uid: string]: Presence }>({});
    const [contextMenuChat, setContextMenuChat] = useState<ChatWithDetails | null>(null);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const chatListenersRef = useRef<{ [chatId: string]: { ref: firebase.database.Reference, listener: (s: firebase.database.DataSnapshot) => void } }>({});


    const fetchUserDetails = useCallback(async (uid: string): Promise<User | null> => {
        if (userCache[uid]) return userCache[uid];
        try {
            const userSnap = await db.ref(`users/${uid}`).once('value');
            if (userSnap.exists()) {
                const userData = { uid, ...userSnap.val() } as User;
                setUserCache(prev => ({ ...prev, [uid]: userData }));
                return userData;
            }
        } catch (error) {
            console.error(`RTDB Error: Failed to fetch user details for UID: ${uid}`, error);
        }
        return null;
    }, [userCache, setUserCache]);
    
    // This effect will fetch participant UIDs for the presence listener and for the search modal's friend list.
    useEffect(() => {
        const participantIds = chats
            .map(c => Object.keys(c.participants).find(p => p !== currentUser.uid))
            .filter(Boolean) as string[];
        onFriendUidsUpdate(participantIds);
    }, [chats, currentUser.uid, onFriendUidsUpdate]);
    
    // Main data fetching effect
    useEffect(() => {
        const userChatsRef = db.ref(`userChats/${currentUser.uid}`);

        const userChatsListener = userChatsRef.on('value', (snapshot) => {
            const currentChatIds = snapshot.exists() ? Object.keys(snapshot.val()) : [];
            const listeners = chatListenersRef.current;

            // Remove listeners for chats the user is no longer part of
            Object.keys(listeners).forEach(chatId => {
                if (!currentChatIds.includes(chatId)) {
                    listeners[chatId].ref.off('value', listeners[chatId].listener);
                    delete listeners[chatId];
                }
            });

            // Remove chats from state that are no longer in the user's chat list
            setChats(prev => prev.filter(c => currentChatIds.includes(c.id)));

            // Add listeners for new chats
            currentChatIds.forEach(chatId => {
                if (!listeners[chatId]) {
                    const chatRef = db.ref(`chats/${chatId}`);
                    const chatListener = async (chatSnapshot: firebase.database.DataSnapshot) => {
                        if (chatSnapshot.exists()) {
                            const chatData = { id: chatSnapshot.key, ...chatSnapshot.val() } as Chat;
                            
                            const otherId = Object.keys(chatData.participants).find(p => p !== currentUser.uid);
                            const isHidden = chatData.hiddenBy?.[currentUser.uid];
                            const isBlocked = otherId ? currentUser.blockedUsers?.[otherId] : false;

                            if (isHidden || isBlocked) {
                                setChats(prev => prev.filter(c => c.id !== chatData.id));
                                return;
                            }
                            
                            if (otherId && !userCache[otherId]) {
                               await fetchUserDetails(otherId);
                            }

                            setChats(prev => {
                                const index = prev.findIndex(c => c.id === chatData.id);
                                if (index > -1) {
                                    const newChats = [...prev];
                                    newChats[index] = chatData;
                                    return newChats;
                                }
                                return [...prev, chatData];
                            });
                        } else {
                            // Chat was deleted, remove from state and listener
                            setChats(prev => prev.filter(c => c.id !== chatId));
                             if (listeners[chatId]) {
                                listeners[chatId].ref.off('value', listeners[chatId].listener);
                                delete listeners[chatId];
                            }
                        }
                    };

                    chatRef.on('value', chatListener, error => {
                        console.error(`RTDB Error: Failed to listen for chat ${chatId}.`, error);
                    });
                    listeners[chatId] = { ref: chatRef, listener: chatListener };
                }
            });
        }, error => {
            console.error("RTDB Error: Failed to listen for user chats.", error);
        });

        return () => {
            userChatsRef.off('value', userChatsListener);
            Object.values(chatListenersRef.current).forEach(({ ref, listener }) => ref.off('value', listener));
            chatListenersRef.current = {};
        };
    }, [currentUser.uid, currentUser.blockedUsers, userCache, fetchUserDetails]);


    // Effect for presence
    useEffect(() => {
        const participantIds = chats.map(c => Object.keys(c.participants).find(p => p !== currentUser.uid)).filter(Boolean) as string[];
        if (participantIds.length === 0) return;
        
        const listeners: {ref: firebase.database.Reference, listener: (a: firebase.database.DataSnapshot) => any}[] = [];

        participantIds.forEach(uid => {
            const presenceRef = db.ref(`presence/${uid}`);
            const listener = presenceRef.on('value', (snapshot) => {
                 if (snapshot.exists()) {
                    setPresence(prev => ({...prev, [uid]: snapshot.val() as Presence}));
                 }
            }, error => {
                console.error(`RTDB Error: Failed to listen for presence of ${uid}.`, error);
            });
            listeners.push({ ref: presenceRef, listener });
        });
        
        return () => {
            listeners.forEach(({ref, listener}) => ref.off('value', listener));
        };
    }, [chats, currentUser.uid]);

    const enrichedChats = useMemo(() => {
       return chats
        .map(chat => {
            const otherId = Object.keys(chat.participants).find(p => p !== currentUser.uid);
            if (!otherId || !userCache[otherId]) return null;
            return {
                ...chat,
                otherParticipant: userCache[otherId],
                otherParticipantPresence: presence[otherId] || { isOnline: false, lastSeen: 0 }
            } as ChatWithDetails
        })
        .filter(Boolean) as ChatWithDetails[];
    }, [chats, userCache, presence, currentUser.uid]);


    const sortedChats = useMemo(() => {
        return [...enrichedChats]
            .sort((a, b) => {
                const isAPinned = a.pinnedBy && a.pinnedBy[currentUser.uid];
                const isBPinned = b.pinnedBy && b.pinnedBy[currentUser.uid];
                if (isAPinned && !isBPinned) return -1;
                if (!isAPinned && isBPinned) return 1;
                const timeA = a.lastMessage?.timestamp || a.createdAt || 0;
                const timeB = b.lastMessage?.timestamp || b.createdAt || 0;
                return timeB - timeA;
            });
    }, [enrichedChats, currentUser.uid]);

    const filteredChats = useMemo(() => {
        if (!searchQuery) return sortedChats;
        return sortedChats.filter(chat => {
            const displayName = currentUser.nicknames?.[chat.otherParticipant.uid] || chat.otherParticipant.name;
            return displayName.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [sortedChats, searchQuery, currentUser.nicknames]);


    const handleFabClick = (label: string) => {
        if (label === 'Search User') onSearchClick();
    };

    const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, chat: ChatWithDetails) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuChat(chat);
    };

    const handlePinChat = async (chat: ChatWithDetails) => {
        try {
            const pinRef = db.ref(`chats/${chat.id}/pinnedBy/${currentUser.uid}`);
            const isPinned = chat.pinnedBy && chat.pinnedBy[currentUser.uid];
            await pinRef.set(isPinned ? null : true);
        } catch (error) {
            console.error("RTDB Error: Failed to pin/unpin chat.", error);
            alert("Could not update pin status. Please try again.");
        }
    };

    const handleHideChat = async (chat: ChatWithDetails) => {
        try {
            await db.ref(`chats/${chat.id}/hiddenBy/${currentUser.uid}`).set(true);
        } catch (error) {
            console.error("RTDB Error: Failed to hide chat.", error);
            alert("Could not hide chat. Please try again.");
        }
    };

    const handleDeleteChat = async (chat: ChatWithDetails) => {
        const displayName = currentUser.nicknames?.[chat.otherParticipant.uid] || chat.otherParticipant.name;
        if(window.confirm(`Delete chat with ${displayName}? This cannot be undone.`)){
            try {
                const updates: { [key: string]: null } = {};
                updates[`/chats/${chat.id}`] = null;
                updates[`/messages/${chat.id}`] = null;
                Object.keys(chat.participants).forEach(uid => {
                    updates[`/userChats/${uid}/${chat.id}`] = null;
                });
                await db.ref().update(updates);
            } catch (error) {
                console.error("RTDB Error: Failed to delete chat.", error);
                alert("Could not delete chat. Please try again.");
            }
        }
    };

    const contextMenuOptions = contextMenuChat ? [
        { label: (contextMenuChat.pinnedBy && contextMenuChat.pinnedBy[currentUser.uid]) ? 'Unpin' : 'Pin', icon: Pin, onClick: () => handlePinChat(contextMenuChat) },
        { label: 'Hide', icon: EyeOff, onClick: () => handleHideChat(contextMenuChat) },
        { label: 'Delete', icon: Trash, onClick: () => handleDeleteChat(contextMenuChat), isDestructive: true },
    ] : [];

  return (
    <div className="w-full h-full flex flex-col bg-secondary-cream dark:bg-gray-900">
      <header className="p-4 flex items-center justify-between bg-secondary-cream/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-base-tan/50 dark:border-gray-700/50 sticky top-0 z-20">
        {isSearchVisible ? (
            <div className="flex items-center gap-2 w-full">
                <button onClick={() => { setIsSearchVisible(false); setSearchQuery(''); }} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
                    <ArrowLeft size={24} />
                </button>
                <input 
                    type="text" 
                    placeholder="Search chats..."
                    className="w-full bg-transparent outline-none text-xl font-bold text-text-primary dark:text-gray-100 placeholder:text-text-primary/50 dark:placeholder:text-gray-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus 
                />
            </div>
        ) : (
            <>
                <h1 className="text-2xl font-bold text-text-primary dark:text-gray-100">ZenChat</h1>
                <div className="flex items-center gap-4">
                <button onClick={() => setIsSearchVisible(true)} className="text-accent-brand hover:opacity-80"><Search size={24} /></button>
                <button onClick={onNotificationsClick} className="text-accent-brand hover:opacity-80 relative">
                    <Bell size={24} />
                    {unreadNotifCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unreadNotifCount}
                        </div>
                    )}
                </button>
                <button onClick={onProfileClick}>
                    <Avatar src={currentUser.avatarUrl || `https://picsum.photos/seed/${currentUser.uid}/100/100`} alt={currentUser.name} size="sm"/>
                </button>
                </div>
            </>
        )}
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredChats.length > 0 ? (
            filteredChats.map(chat => (
                <ChatListItem 
                    key={chat.id} chat={chat} currentUserId={currentUser.uid}
                    onClick={() => onSelectChat(chat)} 
                    onContextMenu={handleContextMenu}
                    isPinned={!!(chat.pinnedBy && chat.pinnedBy[currentUser.uid])}
                    nickname={currentUser.nicknames?.[chat.otherParticipant.uid]}
                />
            ))
        ) : (
            <div className="p-8 text-center text-text-primary/60 dark:text-gray-400">
                <p>{searchQuery ? 'No chats found.' : 'No chats yet.'}</p>
                {!searchQuery && <p>Click the green button to find someone to talk to!</p>}
            </div>
        )}
      </main>
      
      <Fab onMenuItemClick={handleFabClick} />

      {contextMenuChat && (
        <ContextMenu
          options={contextMenuOptions}
          onClose={() => setContextMenuChat(null)}
          onEmojiSelect={() => {}}
          showEmojis={false}
        />
      )}
    </div>
  );
};

export default HomeScreen;