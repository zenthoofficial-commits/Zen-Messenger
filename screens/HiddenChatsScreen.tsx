import React, { useState, useEffect, useCallback } from 'react';
import { User, Chat, ChatWithDetails } from '../types';
import { db } from '../firebase';
import { ArrowLeft, Eye } from 'lucide-react';
import ChatListItem from '../components/ChatListItem';

interface HiddenChatsScreenProps {
  currentUser: User;
  onBack: () => void;
  onSelectChat: (chat: ChatWithDetails) => void;
  userCache: { [uid: string]: User };
  setUserCache: React.Dispatch<React.SetStateAction<{ [uid: string]: User }>>;
}

const HiddenChatsScreen: React.FC<HiddenChatsScreenProps> = ({ currentUser, onBack, onSelectChat, userCache, setUserCache }) => {
  const [hiddenChats, setHiddenChats] = useState<ChatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserDetails = useCallback(async (uid: string): Promise<User | null> => {
    if (userCache[uid]) return userCache[uid];
    try {
        const userSnap = await db.ref(`users/${uid}`).once('value');
        if (userSnap.exists()) {
            const userData = { uid: userSnap.key, ...userSnap.val() } as User;
            setUserCache(prev => ({ ...prev, [uid]: userData }));
            return userData;
        }
    } catch (error) {
        console.error("RTDB Error: Failed to fetch user details in HiddenChatsScreen.", error);
    }
    return null;
  }, [userCache, setUserCache]);

  useEffect(() => {
    const chatsRef = db.ref('chats');
    const q = chatsRef
      .orderByChild(`hiddenBy/${currentUser.uid}`)
      .equalTo(true);
    
    const listener = q.on('value', async (querySnapshot) => {
        setLoading(true);
        if (!querySnapshot.exists()) {
            setHiddenChats([]);
            setLoading(false);
            return;
        }
        try {
            const chatsData: Chat[] = [];
            querySnapshot.forEach(snap => {
                chatsData.push({ id: snap.key, ...snap.val() } as Chat)
            });
            
            const chatsWithDetailsPromises = chatsData.map(async (chat) => {
                const otherId = Object.keys(chat.participants).find(p => p !== currentUser.uid);
                if(otherId) {
                    const otherUser = await fetchUserDetails(otherId);
                    if (otherUser) {
                        return { ...chat, otherParticipant: otherUser, otherParticipantPresence: { isOnline: false, lastSeen: null } } as ChatWithDetails;
                    }
                }
                return null;
            });

            const resolvedChats = (await Promise.all(chatsWithDetailsPromises)).filter(Boolean) as ChatWithDetails[];
            setHiddenChats(resolvedChats);
        } catch (error) {
            console.error("RTDB Error: Failed to process hidden chats.", error);
        } finally {
            setLoading(false);
        }
    }, error => {
        console.error("RTDB Error: Failed to listen for hidden chats.", error);
        setLoading(false);
    });

    return () => q.off('value', listener);
  }, [currentUser.uid, fetchUserDetails]);

  const handleUnhide = async (chatId: string) => {
    try {
      await db.ref(`chats/${chatId}/hiddenBy/${currentUser.uid}`).remove();
    } catch (error) {
      console.error("Error unhiding chat:", error);
      alert("Failed to unhide chat. Please try again.");
    }
  };

  const handleSelectAndUnhide = (chat: ChatWithDetails) => {
    handleUnhide(chat.id);
    onSelectChat(chat);
  }

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">Hidden Chats</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <p className="p-8 text-center text-text-primary/60 dark:text-gray-400">Loading...</p>
        ) : hiddenChats.length > 0 ? (
          <div className="p-2 space-y-2">
            {hiddenChats.map(chat => (
              <div key={chat.id} className="group relative rounded-xl overflow-hidden bg-secondary-cream dark:bg-gray-800">
                <ChatListItem 
                  chat={chat} 
                  currentUserId={currentUser.uid}
                  onClick={() => handleSelectAndUnhide(chat)} 
                  onContextMenu={(e) => e.preventDefault()}
                  isPinned={false}
                />
                <div className="absolute inset-0 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm flex items-center justify-end px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button 
                        onClick={() => handleUnhide(chat.id)}
                        className="px-5 py-2 bg-accent-green text-white font-semibold rounded-lg shadow-md transform transition-transform active:scale-95 flex items-center gap-2"
                    >
                        <Eye size={16}/>
                        Unhide
                    </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-text-primary/60 dark:text-gray-400 flex flex-col items-center justify-center h-full">
            <Eye size={48} className="mb-4 text-text-primary/30 dark:text-gray-600" />
            <p className="font-semibold text-lg">No Hidden Chats</p>
            <p className="mt-1">Long-press on a chat in your chat list to hide it.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default HiddenChatsScreen;