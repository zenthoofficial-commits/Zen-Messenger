import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { User } from '../types';
import { db } from '../firebase';
import { useDebouncedCallback } from 'use-debounce';

interface NotificationSettingsScreenProps {
  onBack: () => void;
  currentUser: User;
}

const Toggle: React.FC<{ value: boolean; onChange: (value: boolean) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
    <button 
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`w-12 h-6 rounded-full p-1 flex items-center transition-colors duration-300 ${disabled ? 'bg-base-tan/30 dark:bg-gray-700/30 cursor-not-allowed' : 'bg-base-tan/50 dark:bg-gray-700/50'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white dark:bg-gray-500 shadow-md transform transition-transform duration-300 ${value ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
)

type Settings = {
    inApp: { newMessages: boolean; reactions: boolean; };
    push: { all: boolean; };
};

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ onBack, currentUser }) => {
  const [settings, setSettings] = useState<Settings>(currentUser.notificationSettings || {
    inApp: { newMessages: true, reactions: true },
    push: { all: true }
  });
  const [isSaving, setIsSaving] = useState(false);

  const saveSettings = useDebouncedCallback(async (newSettings: Settings) => {
    setIsSaving(true);
    try {
        await db.collection('users').doc(currentUser.uid).update({
            notificationSettings: newSettings
        });
    } catch (error) {
        console.error("Failed to save notification settings", error);
        // Optionally revert state or show an error message
    } finally {
        setIsSaving(false);
    }
  }, 1000);

  const handleSettingChange = <T extends keyof Settings, K extends keyof Settings[T]>(category: T, key: K, value: boolean) => {
      const newSettings = {
          ...settings,
          [category]: {
              ...settings[category],
              [key]: value
          }
      };
      setSettings(newSettings);
      saveSettings(newSettings);
  };
  
  useEffect(() => {
    // Sync state if currentUser prop changes from an external source
    if (currentUser.notificationSettings) {
        setSettings(currentUser.notificationSettings);
    }
  }, [currentUser.notificationSettings]);

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center justify-between bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">Notifications</h1>
        </div>
        <div>
            {isSaving && <Loader2 size={20} className="animate-spin text-text-primary/60 dark:text-gray-400"/>}
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide p-4">
        <div className="space-y-4">
            <div>
                <h4 className="px-3 text-sm font-semibold text-text-primary/60 dark:text-gray-500 mb-2">In-App Alerts</h4>
                 <div className="p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold text-text-primary dark:text-gray-200">New Messages</p>
                        <Toggle value={settings.inApp.newMessages} onChange={(val) => handleSettingChange('inApp', 'newMessages', val)}/>
                    </div>
                     <div className="flex justify-between items-center">
                        <p className="font-semibold text-text-primary dark:text-gray-200">Message Reactions</p>
                        <Toggle value={settings.inApp.reactions} onChange={(val) => handleSettingChange('inApp', 'reactions', val)}/>
                    </div>
                 </div>
            </div>
             <div>
                <h4 className="px-3 text-sm font-semibold text-text-primary/60 dark:text-gray-500 mb-2">Push Notifications</h4>
                 <div className="p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold text-text-primary dark:text-gray-200">All Push Notifications</p>
                        <Toggle value={settings.push.all} onChange={(val) => handleSettingChange('push', 'all', val)}/>
                    </div>
                 </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default NotificationSettingsScreen;
