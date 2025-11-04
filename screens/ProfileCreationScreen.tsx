import React, { useState, useRef } from 'react';
import { UserProfileData } from '../types';
import SegmentedControl from '../components/SegmentedControl';
import { Camera, Loader2 } from 'lucide-react';
import { storage } from '../firebase';


interface ProfileCreationScreenProps {
  uid: string;
  onSave: (profile: UserProfileData) => Promise<void>;
}

const ProfileCreationScreen: React.FC<ProfileCreationScreenProps> = ({ uid, onSave }) => {
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('Male');
  const [relationshipStatus, setRelationshipStatus] = useState('Single');
  const [error, setError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(() => `https://picsum.photos/seed/${Math.random()}/200/200`);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary'];
  const RELATIONSHIP_OPTIONS = ['Single', 'In a relationship'];

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (isLoading) return;

    if (!name) {
      setError('Please enter your display name.');
      return;
    }
    if (!birthday) {
        setError('Please enter your birthday.');
        return;
    }
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    if (age < 13) {
        setError('You must be at least 13 years old to use ZenChat.');
        return;
    }

    setError('');
    setIsLoading(true);

    let finalAvatarUrl = avatarPreview;

    if (avatarFile) {
        try {
            const filePath = `avatars/${uid}/${Date.now()}_${avatarFile.name}`;
            const storageRef = storage.ref(filePath);
            const uploadTaskSnapshot = await storageRef.put(avatarFile);
            finalAvatarUrl = await uploadTaskSnapshot.ref.getDownloadURL();
        } catch (uploadError) {
            console.error("Storage Error: Failed to upload avatar.", uploadError);
            setError('Failed to upload profile picture. Please try again.');
            setIsLoading(false);
            return;
        }
    }

    try {
        await onSave({ 
            name, 
            name_lowercase: name.toLowerCase(), 
            birthday, 
            gender, 
            relationshipStatus, 
            avatarUrl: finalAvatarUrl,
            accentColor: 'green',
            chatBackgroundImageUrl: '',
            notificationSettings: {
                inApp: { newMessages: true, reactions: true },
                push: { all: true }
            }
        });
    } catch (err) {
        setError('Failed to save profile. Please check permissions and try again.');
        setIsLoading(false);
    }
  };
  
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-base-tan dark:bg-gray-900">
       <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
      <div className="w-full max-w-sm bg-secondary-cream dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-text-primary dark:text-gray-100">Create Your Profile</h1>
          <p className="text-text-primary/70 dark:text-gray-400 mt-1">Personalize your ZenChat presence</p>
        </div>
        
        <div className="flex justify-center mb-6">
            <div className="relative">
                <div 
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-brand to-accent-green flex items-center justify-center overflow-hidden cursor-pointer group"
                    onClick={handleAvatarClick}
                >
                    <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera size={24} className="text-white"/>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary/80 dark:text-gray-300">Name</label>
            <input 
              type="text" 
              placeholder="Your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 p-3 bg-base-tan/50 dark:bg-gray-700/50 rounded-xl outline-none focus:ring-2 focus:ring-accent-brand transition-shadow text-text-primary dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary/80 dark:text-gray-300">Birthday</label>
            <input 
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full mt-1 p-3 bg-base-tan/50 dark:bg-gray-700/50 rounded-xl outline-none focus:ring-2 focus:ring-accent-brand transition-shadow text-text-primary dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary/80 dark:text-gray-300 mb-1 block">Gender</label>
            <SegmentedControl name="gender" options={GENDER_OPTIONS} selectedValue={gender} onChange={setGender} />
          </div>
           <div>
            <label className="text-sm font-medium text-text-primary/80 dark:text-gray-300 mb-1 block">Relationship status</label>
            <SegmentedControl name="relationship" options={RELATIONSHIP_OPTIONS} selectedValue={relationshipStatus} onChange={setRelationshipStatus} />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

        <div className="mt-6 flex flex-col items-center">
          <button onClick={handleSave} disabled={isLoading} className="w-full bg-accent-brand text-white font-semibold py-3 rounded-xl shadow-md transform transition-transform hover:scale-105 active:scale-95 flex items-center justify-center disabled:opacity-50">
            {isLoading ? <Loader2 className="animate-spin" /> : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCreationScreen;