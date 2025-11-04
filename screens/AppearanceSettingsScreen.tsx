import React, { useState, useRef } from 'react';
import { ArrowLeft, Palette, Moon, Sun, Droplets, Image as ImageIcon, Check, Loader2, Trash2 } from 'lucide-react';
import { Theme } from '../App';
import { ACCENT_COLORS } from '../constants';
import { User } from '../types';
import { db, storage } from '../firebase';
import { compressImage } from '../utils/media';

interface AppearanceSettingsScreenProps {
  onBack: () => void;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  currentUser: User;
  accentColorName: string;
  setAccentColorName: React.Dispatch<React.SetStateAction<string>>;
}

const ThemeToggle: React.FC<{ theme: Theme, setTheme: React.Dispatch<React.SetStateAction<Theme>> }> = ({ theme, setTheme }) => {
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  return (
    <button onClick={toggleTheme} className="w-14 h-8 rounded-full p-1 flex items-center transition-colors duration-300 bg-base-tan/50 dark:bg-gray-700/50">
      <div className={`w-6 h-6 rounded-full bg-white dark:bg-gray-500 shadow-md transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}>
        {theme === 'dark' ? <Moon size={16} className="m-1 text-white"/> : <Sun size={16} className="m-1 text-yellow-500"/>}
      </div>
    </button>
  );
};

const AppearanceSettingsScreen: React.FC<AppearanceSettingsScreenProps> = ({ onBack, theme, setTheme, currentUser, accentColorName, setAccentColorName }) => {
  const [isBgUploading, setIsBgUploading] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const handleAccentColorChange = async (colorName: string) => {
    const oldColor = accentColorName;
    setAccentColorName(colorName); // Optimistic update
    try {
        await db.ref(`users/${currentUser.uid}`).update({ accentColor: colorName });
    } catch (error) {
        console.error("RTDB Error: Failed to save accent color", error);
        setAccentColorName(oldColor); // Revert on error
        alert("Could not save accent color. Please try again.");
    }
  };

  const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBgUploading(true);
    try {
        const compressedFile = await compressImage(file, 0.8, 1920); // Quality 0.8, max dimension 1920px
        const filePath = `backgrounds/${currentUser.uid}/${Date.now()}_${file.name}`;
        const storageRef = storage.ref(filePath);
        const uploadTaskSnapshot = await storageRef.put(compressedFile);
        const downloadURL = await uploadTaskSnapshot.ref.getDownloadURL();

        await db.ref(`users/${currentUser.uid}`).update({ chatBackgroundImageUrl: downloadURL });
    } catch (error) {
        console.error("RTDB/Storage Error: Failed to upload chat background", error);
        alert("Error: Could not save background image.");
    } finally {
        setIsBgUploading(false);
    }
    if (e.target) e.target.value = '';
  };

  const handleRemoveBg = async () => {
    if (window.confirm("Are you sure you want to remove your custom chat background?")) {
      try {
        await db.ref(`users/${currentUser.uid}`).update({
          chatBackgroundImageUrl: ''
        });
      } catch (error) {
        console.error("RTDB Error: Failed to remove chat background", error);
        alert("Error: Could not remove background.");
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <input type="file" ref={bgFileInputRef} onChange={handleBgFileChange} className="hidden" accept="image/*" />
      <header className="p-3 flex items-center gap-3 bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">Appearance</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide p-4">
         <div className="space-y-6">
            <div>
                <h4 className="px-3 text-sm font-semibold text-text-primary/60 dark:text-gray-500 mb-2">Theme</h4>
                 <div className="p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Palette size={20} className="text-text-primary/80 dark:text-gray-300"/>
                            <p className="font-semibold text-text-primary dark:text-gray-200">Dark Mode</p>
                        </div>
                        <ThemeToggle theme={theme} setTheme={setTheme} />
                    </div>
                 </div>
            </div>
             <div>
                <h4 className="px-3 text-sm font-semibold text-text-primary/60 dark:text-gray-500 mb-2">Customization</h4>
                 <div className="p-3 bg-secondary-cream dark:bg-gray-800 rounded-xl flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                             <Droplets size={20} className="text-text-primary/80 dark:text-gray-300"/>
                             <p className="font-semibold text-text-primary dark:text-gray-200">Accent Color</p>
                        </div>
                       <div className="flex items-center gap-2">
                          {Object.entries(ACCENT_COLORS).map(([key, color]) => (
                            <button key={key} onClick={() => handleAccentColorChange(key)} className="w-6 h-6 rounded-full border-2 border-white/50 dark:border-black/50 flex items-center justify-center" style={{ backgroundColor: color.hex }}>
                              {accentColorName === key && <Check size={16} className="text-white"/>}
                            </button>
                          ))}
                       </div>
                    </div>
                     <div className="flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <ImageIcon size={20} className="text-text-primary/80 dark:text-gray-300"/>
                            <div className="flex flex-col">
                                <p className="font-semibold text-text-primary dark:text-gray-200">Chat Background</p>
                                {currentUser.chatBackgroundImageUrl && <p className="text-xs text-text-primary/60 dark:text-gray-400">Custom background is set.</p>}
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            {isBgUploading ? (
                                <Loader2 className="animate-spin text-text-primary/60 dark:text-gray-400"/>
                            ) : (
                                <>
                                {currentUser.chatBackgroundImageUrl && (
                                    <button onClick={handleRemoveBg} className="p-2 bg-red-500/10 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-500/20">
                                        <Trash2 size={16}/>
                                    </button>
                                )}
                                <button onClick={() => bgFileInputRef.current?.click()} className="p-2 bg-base-tan/50 dark:bg-gray-700/50 rounded-lg text-xs font-semibold hover:bg-base-tan dark:hover:bg-gray-700">
                                    Change
                                </button>
                                </>
                            )}
                         </div>
                    </div>
                 </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default AppearanceSettingsScreen;