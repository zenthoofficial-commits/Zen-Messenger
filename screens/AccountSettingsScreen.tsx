import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../firebase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import SegmentedControl from '../components/SegmentedControl';

interface AccountSettingsScreenProps {
  currentUser: User;
  onBack: () => void;
}

const AccountSettingsScreen: React.FC<AccountSettingsScreenProps> = ({ currentUser, onBack }) => {
  const [name, setName] = useState(currentUser.name);
  const [birthday, setBirthday] = useState(currentUser.birthday);
  const [relationshipStatus, setRelationshipStatus] = useState(currentUser.relationshipStatus);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const RELATIONSHIP_OPTIONS = ['Single', 'In a relationship'];

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setError('');
    setSuccess(false);

    if (!name.trim()) {
      setError('Name cannot be empty.');
      setIsSaving(false);
      return;
    }
     if (new Date(birthday) > new Date()) {
      setError('Birthday cannot be in the future.');
      setIsSaving(false);
      return;
    }

    try {
      await db.ref(`users/${currentUser.uid}`).update({
        name: name.trim(),
        name_lowercase: name.trim().toLowerCase(),
        birthday,
        relationshipStatus,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("RTDB Error: Failed to save account settings.", err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">Account Settings</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide p-4">
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-text-primary/80 dark:text-gray-300">Display Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-accent-brand transition-shadow text-text-primary dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary/80 dark:text-gray-300">Birthday</label>
            <input 
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full mt-1 p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-accent-brand transition-shadow text-text-primary dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary/80 dark:text-gray-300 mb-1 block">Relationship Status</label>
            <SegmentedControl name="relationship" options={RELATIONSHIP_OPTIONS} selectedValue={relationshipStatus} onChange={setRelationshipStatus} />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
        {success && <p className="text-accent-brand text-sm text-center mt-4">Changes saved successfully!</p>}
      </main>
      
      <footer className="p-4">
        <button 
          onClick={handleSaveChanges} 
          disabled={isSaving}
          className="w-full bg-accent-brand text-white font-semibold py-3 rounded-xl shadow-md transform transition-transform hover:scale-105 active:scale-95 flex items-center justify-center disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : 'Save Changes'}
        </button>
      </footer>
    </div>
  );
};

export default AccountSettingsScreen;