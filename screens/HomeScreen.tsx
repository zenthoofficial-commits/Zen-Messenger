import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    const [chats, setChats] = useState<Omit<ChatWithDetails, 'otherParticipantPresence'>[]>([]);
    const [presence, setPresence] = useState<{ [uid: string]: Presence }>({});
    const [contextMenuChat, setContextMenuChat] = useState<ChatWithDetails | null>(null);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchUserDetails = useCallback(async (uid: string): Promise<User | null> => {
        if (userCache[uid]) return userCache[uid];
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const userData = { uid, ...userDoc.data() } as User;
            setUserCache(prev => ({ ...prev, [uid]: userData }));
            return userData;
        }
        return null;
    }, [userCache, setUserCache]);
    
    useEffect(() => {
        const q = db.collection("chats").where("participants", "array-contains", currentUser.uid);

        const unsubscribe = q.onSnapshot(async (querySnapshot) => {
            const chatsData: Chat[] = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Chat))
                .filter(chat => {
                    if (chat.hiddenBy && chat.hiddenBy[currentUser.uid]) return false;
                    const otherId = chat.participants.find(p => p !== currentUser.uid);
                    if (currentUser.blockedUsers?.includes(otherId || '')) return false;
                    return true;
                });
            
            const participantIds = [...new Set(chatsData.map(c => c.participants.find(p => p !== currentUser.uid)).filter(Boolean) as string[])];
            onFriendUidsUpdate(participantIds);
            
            const participantsToFetch = participantIds.filter(id => !userCache[id]);
            if (participantsToFetch.length > 0) {
                 const usersQuery = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', participantsToFetch).get();
                 usersQuery.forEach(doc => setUserCache(prev => ({...prev, [doc.id]: { uid: doc.id, ...doc.data()} as User })));
            }
            
            const chatsWithDetailsPromises = chatsData.map(async (chat) => {
                const otherId = chat.participants.find(p => p !== currentUser.uid);
                if(otherId) {
                    const otherUser = await fetchUserDetails(otherId);
                    if (otherUser) return { ...chat, otherParticipant: otherUser };
                }
                return null;
            });

            const resolvedChats = (await Promise.all(chatsWithDetailsPromises)).filter(Boolean);
            setChats(resolvedChats as Omit<ChatWithDetails, 'otherParticipantPresence'>[]);
        });

        return () => unsubscribe();
    }, [currentUser.uid, currentUser.blockedUsers, fetchUserDetails, userCache, setUserCache, onFriendUidsUpdate]);

    // Effect for presence
    useEffect(() => {
        const participantIds = chats.map(c => c.otherParticipant.uid);
        if (participantIds.length === 0) return;

        const presenceRef = db.collection('presence');
        const q = presenceRef.where(firebase.firestore.FieldPath.documentId(), 'in', [...new Set(participantIds)]);
        
        const unsubscribe = q.onSnapshot((snapshot) => {
            const presenceData: { [uid: string]: Presence } = {};
            snapshot.forEach(doc => {
                presenceData[doc.id] = doc.data() as Presence;
            });
            setPresence(prev => ({...prev, ...presenceData}));
        });
        
        return () => unsubscribe();
    }, [chats]);

    const sortedChats = useMemo(() => {
        return [...chats]
            .map(c => ({ ...c, otherParticipantPresence: presence[c.otherParticipant.uid] || { isOnline: false, lastSeen: null } }))
            .sort((a, b) => {
                const isAPinned = a.pinnedBy?.includes(currentUser.uid);
                const isBPinned = b.pinnedBy?.includes(currentUser.uid);
                if (isAPinned && !isBPinned) return -1;
                if (!isAPinned && isBPinned) return 1;
                const timeA = a.lastMessage?.timestamp?.toMillis() || a.createdAt?.toMillis() || 0;
                const timeB = b.lastMessage?.timestamp?.toMillis() || b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
    }, [chats, presence, currentUser.uid]);

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
        const chatRef = db.collection('chats').doc(chat.id);
        const isPinned = chat.pinnedBy?.includes(currentUser.uid);
        const updateAction = isPinned 
            ? firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            : firebase.firestore.FieldValue.arrayUnion(currentUser.uid);
        await chatRef.update({ pinnedBy: updateAction });
    };

    const handleHideChat = async (chat: ChatWithDetails) => {
        await db.collection('chats').doc(chat.id).update({ [`hiddenBy.${currentUser.uid}`]: true });
    };

    const handleDeleteChat = async (chat: ChatWithDetails) => {
        if(window.confirm(`Delete chat with ${chat.otherParticipant.name}?`)){
             await db.collection('chats').doc(chat.id).delete();
        }
    };

    const contextMenuOptions = contextMenuChat ? [
        { label: (contextMenuChat.pinnedBy?.includes(currentUser.uid)) ? 'Unpin' : 'Pin', icon: Pin, onClick: () => handlePinChat(contextMenuChat) },
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
                    isPinned={chat.pinnedBy?.includes(currentUser.uid) || false}
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