import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../firebase';
import { ArrowLeft, UserX } from 'lucide-react';
import Avatar from '../components/Avatar';

interface BlockedUsersScreenProps {
  currentUser: User;
  onBack: () => void;
}

const BlockedUsersScreen: React.FC<BlockedUsersScreenProps> = ({ currentUser, onBack }) => {
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userRef = db.ref(`users/${currentUser.uid}`);
    const listener = userRef.on('value', async (snapshot) => {
        const userData = snapshot.val() as User;
        const blockedIds = userData.blockedUsers ? Object.keys(userData.blockedUsers) : [];
        setLoading(true);

        if (blockedIds.length === 0) {
            setBlockedUsers([]);
            setLoading(false);
            return;
        }

        try {
            const userPromises = blockedIds.map(id => 
                db.ref(`users/${id}`).once('value').then(snap => 
                    snap.exists() ? { uid: snap.key, ...snap.val() } as User : null
                )
            );
            const users = (await Promise.all(userPromises)).filter(Boolean) as User[];
            setBlockedUsers(users);
        } catch (error) {
            console.error("RTDB Error: Failed to fetch blocked users:", error);
        } finally {
            setLoading(false);
        }
    }, error => {
        console.error("RTDB Error: Failed to listen for current user's blocked list.", error);
        setLoading(false);
    });

    return () => userRef.off('value', listener);
  }, [currentUser.uid]);

  const handleUnblock = async (userIdToUnblock: string) => {
    if (window.confirm("Are you sure you want to unblock this user?")) {
        try {
          await db.ref(`users/${currentUser.uid}/blockedUsers/${userIdToUnblock}`).remove();
        } catch (error) {
          console.error("Error unblocking user:", error);
          alert("Failed to unblock user. Please try again.");
        }
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">Blocked Users</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <p className="p-8 text-center text-text-primary/60 dark:text-gray-400">Loading...</p>
        ) : blockedUsers.length > 0 ? (
          <div className="p-2 space-y-2">
            {blockedUsers.map(user => (
              <div key={user.uid} className="flex items-center justify-between p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Avatar src={user.avatarUrl || `https://picsum.photos/seed/${user.uid}/100/100`} alt={user.name} size="md" />
                  <span className="font-semibold text-text-primary dark:text-gray-200 truncate">{user.name}</span>
                </div>
                <button 
                  onClick={() => handleUnblock(user.uid)}
                  className="px-4 py-2 bg-accent-brand text-white text-sm font-semibold rounded-lg shadow-sm transform transition-transform active:scale-95 flex-shrink-0"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-text-primary/60 dark:text-gray-400 flex flex-col items-center justify-center h-full">
            <UserX size={48} className="mb-4 text-text-primary/30 dark:text-gray-600" />
            <p className="font-semibold text-lg">No Blocked Users</p>
            <p className="mt-1">When you block someone, they will appear here.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default BlockedUsersScreen;