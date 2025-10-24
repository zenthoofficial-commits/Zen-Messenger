import React from 'react';
import { Message } from '../types';
import { X, Download } from 'lucide-react';
import { motion } from 'framer-motion';

interface MediaViewerProps {
  message: Message;
  onClose: () => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ message, onClose }) => {
  const { mediaType, mediaUrl, text } = message;

  const handleSave = async () => {
    try {
      if (!mediaUrl) return;
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const extension = blob.type.split('/')[1] || 'download';
      a.download = `${text?.replace(/\s/g, '_') || 'media'}-${message.id}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading media:", error);
      alert("Could not save media. Please try again.");
    }
  };

  if (!mediaUrl) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="relative max-w-full max-h-full" 
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8 }}
      >
        {mediaType === 'image' && (
          <img src={mediaUrl} alt={text} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
        )}
        {mediaType === 'video' && (
          <video src={mediaUrl} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl">
            Your browser does not support the video tag.
          </video>
        )}
      </motion.div>

      <div className="absolute top-4 right-4 flex gap-3">
         <button onClick={handleSave} className="w-12 h-12 flex items-center justify-center bg-black/30 text-white rounded-full hover:bg-black/50 transition-colors">
          <Download size={24} />
        </button>
        <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-black/30 text-white rounded-full hover:bg-black/50 transition-colors">
          <X size={24} />
        </button>
      </div>
    </motion.div>
  );
};

export default MediaViewer;
