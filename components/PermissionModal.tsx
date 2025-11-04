import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Video, X, MapPin } from 'lucide-react';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissionName: 'microphone' | 'camera' | 'camera & microphone' | 'geolocation';
  featureName: string;
}

const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onClose, permissionName, featureName }) => {
  const icons = {
    microphone: <Mic size={32} className="text-accent-brand" />,
    camera: <Video size={32} className="text-accent-brand" />,
    'camera & microphone': (
      <div className="flex gap-2">
        <Video size={32} className="text-accent-brand" />
        <Mic size={32} className="text-accent-brand" />
      </div>
    ),
    geolocation: <MapPin size={32} className="text-accent-brand" />,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-sm bg-secondary-cream dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center relative"
          >
            <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                <X size={20} className="text-text-primary/70 dark:text-gray-300" />
            </button>
            
            <div className="flex justify-center mb-4">{icons[permissionName]}</div>
            
            <h2 className="text-xl font-bold text-text-primary dark:text-gray-100">Permission Denied</h2>
            <p className="text-text-primary/80 dark:text-gray-300 mt-2">
              ZenChat needs access to your {permissionName} to enable {featureName}.
            </p>
            <p className="text-sm text-text-primary/60 dark:text-gray-400 mt-4">
              Please go to your browser settings to allow access, then refresh the page.
            </p>

            <button
              onClick={onClose}
              className="mt-6 w-full bg-accent-brand text-white font-semibold py-3 rounded-xl shadow-md transform transition-transform hover:scale-105 active:scale-95"
            >
              OK
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PermissionModal;
