import React, { useState } from 'react';
import { User } from '../types';
import Avatar from '../components/Avatar';
import { ArrowLeft, Pencil, Copy, UserX } from 'lucide-react';
import { db } from '../firebase';
import firebase from 'firebase/compat/app';

interface UserProfileViewScreenProps {
  user: User;
  currentUser: User;
  onBack: () => void;
  onBlockUser: (userToBlock: User) => void;
}

const UserProfileViewScreen: React.FC<UserProfileViewScreenProps> = ({ user, currentUser, onBack, onBlockUser }) => {
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const handleSetNickname = async () => {
    const currentNickname = currentUser.nicknames?.[user.uid] || "";
    const newNickname = prompt(`Set a nickname for ${user.name}:`, currentNickname);

    if (newNickname === null) return; // User cancelled the prompt

    try {
        const nicknameRef = db.ref(`users/${currentUser.uid}/nicknames/${user.uid}`);
        if (newNickname.trim() === "") {
            await nicknameRef.remove();
            alert("Nickname removed. The change will appear shortly.");
        } else {
            await nicknameRef.set(newNickname.trim());
            alert(`Nickname set to "${newNickname.trim()}". The change will appear shortly.`);
        }
    } catch (error) {
        console.error("Error updating nickname:", error);
        alert("Failed to update nickname. Please try again.");
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.uid);
    alert('User ID copied to clipboard!');
  };

  const displayName = currentUser.nicknames?.[user.uid] || user.name;

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">{displayName}'s Profile</h1>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="p-6 bg-secondary-cream dark:bg-gray-800 flex flex-col items-center rounded-2xl shadow-lg w-full max-w-sm">
            <button onClick={() => setIsViewerOpen(true)} className="rounded-full focus:outline-none focus:ring-4 focus:ring-accent-brand/50">
              <Avatar src={user.avatarUrl || `https://picsum.photos/seed/${user.uid}/100/100`} alt={user.name} size="lg" />
            </button>
            <div className="flex items-center gap-2 mt-4">
                <h2 className="text-2xl font-bold text-text-primary dark:text-gray-100">{displayName}</h2>
                <button onClick={handleSetNickname} className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                    <Pencil size={16} className="text-text-primary/70 dark:text-gray-300"/>
                </button>
            </div>
            {currentUser.nicknames?.[user.uid] && <p className="text-sm text-text-primary/60 dark:text-gray-400">Originally: {user.name}</p>}
             <div 
              className="text-sm text-text-primary/60 dark:text-gray-400 font-mono bg-base-tan/50 dark:bg-gray-700/50 px-2 py-1 rounded-md mt-2 cursor-pointer flex items-center gap-2"
              onClick={handleCopyId}
            >
              <span className="break-all">UID: {user.uid}</span>
              <Copy size={14} className="flex-shrink-0"/>
            </div>
            <button 
                onClick={() => onBlockUser(user)} 
                className="w-full mt-6 bg-red-500/10 text-red-500 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
            >
                <UserX size={18} />
                Block {displayName}
            </button>
        </div>
      </main>

      {isViewerOpen && (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsViewerOpen(false)}
        >
            <img 
                src={user.avatarUrl || `https://picsum.photos/seed/${user.uid}/100/100`} 
                alt={user.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
      )}
    </div>
  );
};

export default UserProfileViewScreen;