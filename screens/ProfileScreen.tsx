import React, { useState, useRef } from 'react';
import { User } from '../types';
import Avatar from '../components/Avatar';
import { ArrowLeft, User as UserIcon, Bell, Shield, Palette, HelpCircle, LogOut, ChevronRight, Lock, EyeOff, Copy, Camera, Loader2, Wallet } from 'lucide-react';
import { db, storage } from '../firebase';
import { compressImage } from '../utils/media';

interface ProfileScreenProps {
  currentUser: User;
  onBack: () => void;
  onLogout: () => void;
  onNavigateToSettings: (title: string) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ currentUser, onBack, onLogout, onNavigateToSettings }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settingsItems = [
    { icon: UserIcon, label: 'Account', description: 'Manage your account details' },
    { icon: Wallet, label: 'My Wallet', description: 'Send and receive digital gifts' },
    { icon: Bell, label: 'Notifications', description: 'Customize your alerts' },
    { icon: Palette, label: 'Appearance', description: 'Change the theme and look' },
    { icon: HelpCircle, label: 'Help & Support', description: 'Get help and send feedback' },
  ];

  const securityItems = [
    { icon: Lock, label: 'Blocked Users', description: 'Manage users you have blocked' },
    { icon: EyeOff, label: 'Hidden Chats', description: 'View and manage hidden chats' },
    { icon: Shield, label: 'Privacy & Security', description: 'Control your data and privacy' },
  ]
  
  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.uid);
    alert('User ID copied to clipboard!');
  };

  const handleAvatarClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    
    setIsUploading(true);
    try {
        const compressedFile = await compressImage(file);
        const filePath = `avatars/${currentUser.uid}/${file.name}`;
        const storageRef = storage.ref(filePath);
        const uploadTask = storageRef.put(compressedFile);

        uploadTask.on('state_changed', 
            () => {}, // Progress handler (optional)
            (error) => {
                console.error("Storage Error: Failed to upload avatar.", error);
                alert("Failed to upload new profile picture. Please try again.");
                setIsUploading(false);
            },
            async () => {
                try {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    await db.ref(`users/${currentUser.uid}`).update({ avatarUrl: downloadURL });
                    alert("Profile picture updated successfully!");
                } catch (error) {
                    console.error("RTDB/Storage Error: Failed to update avatar URL.", error);
                    alert("Failed to update profile picture. Please check permissions and try again.");
                } finally {
                    setIsUploading(false);
                }
            }
        );
    } catch (error) {
      console.error("Error initiating avatar update:", error);
      alert("Failed to update profile picture. Please try again.");
      setIsUploading(false);
    }
    if(e.target) e.target.value = '';
  };


  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
      
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">Profile</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide p-4">
        <div className="p-6 bg-accent-brand/10 dark:bg-accent-brand/20 flex flex-col items-center rounded-2xl mb-4">
            <button className="relative group rounded-full" onClick={handleAvatarClick} disabled={isUploading}>
              <Avatar src={currentUser.avatarUrl || `https://picsum.photos/seed/${currentUser.uid}/100/100`} alt={currentUser.name} size="lg" />
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {isUploading ? <Loader2 size={32} className="text-white animate-spin"/> : <Camera size={32} className="text-white"/>}
              </div>
            </button>
            <h2 className="text-2xl font-bold text-text-primary dark:text-gray-100 mt-4">{currentUser.name}</h2>
            <div 
              className="text-sm text-text-primary/60 dark:text-gray-400 font-mono bg-base-tan/50 dark:bg-gray-700/50 px-2 py-1 rounded-md mt-1 cursor-pointer flex items-center gap-2"
              onClick={handleCopyId}
            >
              <span className="break-all">UID: {currentUser.uid}</span>
              <Copy size={14} className="flex-shrink-0"/>
            </div>
        </div>

        <div className="space-y-2 mb-4">
            <h3 className="px-3 text-sm font-semibold text-text-primary/60 dark:text-gray-500">Security</h3>
            {securityItems.map(item => (
            <button key={item.label} onClick={() => onNavigateToSettings(item.label)} className="w-full flex items-center p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200">
                <div className="w-10 h-10 flex items-center justify-center bg-base-tan dark:bg-gray-700 rounded-lg mr-4">
                <item.icon size={22} className="text-text-primary/80 dark:text-gray-300" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-text-primary dark:text-gray-200">{item.label}</p>
                </div>
                <ChevronRight size={20} className="text-text-primary/40 dark:text-gray-500" />
            </button>
            ))}
        </div>

        <div className="space-y-2">
            <h3 className="px-3 text-sm font-semibold text-text-primary/60 dark:text-gray-500">General</h3>
            {settingsItems.map(item => (
            <button key={item.label} onClick={() => onNavigateToSettings(item.label)} className="w-full flex items-center p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200">
                <div className="w-10 h-10 flex items-center justify-center bg-base-tan dark:bg-gray-700 rounded-lg mr-4">
                <item.icon size={22} className="text-text-primary/80 dark:text-gray-300" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-text-primary dark:text-gray-200">{item.label}</p>
                </div>
                <ChevronRight size={20} className="text-text-primary/40 dark:text-gray-500" />
            </button>
            ))}
        </div>
      </main>

      <div className="p-4 text-center">
         <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 mb-4 p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl text-left text-red-500 font-semibold hover:bg-red-500/10 transition-colors duration-200">
            <LogOut size={20} />
            <span>Logout</span>
        </button>
        <p className="text-sm text-text-primary/50 dark:text-gray-500">ZenChat v1.9.0</p>
        <p className="text-xs text-text-primary/40 dark:text-gray-600">Secure. Serene. Seamless.</p>
      </div>
    </div>
  );
};

export default ProfileScreen;