import React, { useState } from 'react';
import { X, Search, MessageSquare } from 'lucide-react';
import { db } from '../firebase';
import { User } from '../types';
import Avatar from './Avatar';

interface SearchUserModalProps {
  currentUser: User;
  onClose: () => void;
  onSelectUser: (user: User) => void;
  friendUids: string[];
}

const SearchUserModal: React.FC<SearchUserModalProps> = ({ currentUser, onClose, onSelectUser, friendUids }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (query.length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    
    const usersRef = db.collection('users');
    const foundUsers: User[] = [];
    const foundUids = new Set<string>();

    try {
        const userDoc = await usersRef.doc(query).get();
        if (userDoc.exists && userDoc.id !== currentUser.uid) {
            const userData = { uid: userDoc.id, ...userDoc.data() } as User;
            foundUsers.push(userData);
            foundUids.add(userData.uid);
        }
    } catch(e) {
        // Not a valid UID, or other error, ignore and proceed to name search.
    }

    const lowerCaseQuery = query.toLowerCase();
    const nameQuery = usersRef
        .where('name_lowercase', '>=', lowerCaseQuery)
        .where('name_lowercase', '<=', lowerCaseQuery + '\uf8ff')
        .limit(10);

    const querySnapshot = await nameQuery.get();
    querySnapshot.forEach((doc) => {
        if (doc.id !== currentUser.uid && !foundUids.has(doc.id)) {
            const userData = { uid: doc.id, ...doc.data() } as User;
            foundUsers.push(userData);
            foundUids.add(userData.uid);
        }
    });
    
    setResults(foundUsers);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-secondary-cream dark:bg-gray-800 rounded-2xl shadow-xl p-4 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-text-primary dark:text-gray-100">Find a Friend</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
            <X size={24} className="text-text-primary/70 dark:text-gray-300" />
          </button>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-primary/50 dark:text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full p-3 pl-10 bg-base-tan/50 dark:bg-gray-700/50 text-text-primary dark:text-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-accent-brand transition-shadow"
                    autoFocus
                />
            </div>
            <button 
                onClick={handleSearch}
                className="px-4 py-3 bg-accent-green text-white font-semibold rounded-xl shadow-md transform transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100"
                disabled={loading}
            >
                Search
            </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide -mx-4 px-4">
            {loading && <p className="text-center text-text-primary/60 dark:text-gray-400">Searching...</p>}
            {!loading && searched && results.length === 0 && <p className="text-center text-text-primary/60 dark:text-gray-400">No users found.</p>}
            
            <div className="space-y-2">
                {results.map(user => {
                    const isFriend = friendUids.includes(user.uid);
                    return (
                        <div key={user.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-base-tan/50 dark:hover:bg-gray-700/50">
                            <div className="flex items-center gap-3">
                                <Avatar src={user.avatarUrl || `https://picsum.photos/seed/${user.uid}/100/100`} alt={user.name} size="sm" />
                                <div>
                                    <span className="font-semibold text-text-primary dark:text-gray-200">{user.name}</span>
                                    {isFriend && (
                                        <p className="text-xs text-accent-green font-medium">Already a friend</p>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={() => onSelectUser(user)}
                                className="p-2 bg-accent-green text-white rounded-full hover:bg-accent-green/90 transition-transform transform active:scale-90"
                            >
                                <MessageSquare size={20} />
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default SearchUserModal;