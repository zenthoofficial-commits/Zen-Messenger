import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Paperclip, Send, ArrowLeft, Image, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PermissionModal from './PermissionModal';


interface InputBarProps {
  onSendMessage: (text: string) => void;
  onSendAudio: (audioBlob: Blob) => void;
  onSendMedia: (file: File) => void;
  onTyping: (isTyping: boolean) => void;
  onSendLocation: () => void;
  disabled?: boolean;
}

const InputBar: React.FC<InputBarProps> = ({ onSendMessage, onSendAudio, onSendMedia, onTyping, onSendLocation, disabled = false }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [shouldCancel, setShouldCancel] = useState(false);
  const recordingTimer = useRef<number | null>(null);
  const startX = useRef(0);
  const isCancelledRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  useEffect(() => {
    onTyping(text.length > 0);
  }, [text, onTyping]);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
      if(textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 120; // Approx 5 lines
        textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - startX.current;
    if (deltaX < -50) { // Swiped left by 50px
        setShouldCancel(true);
    } else {
        setShouldCancel(false);
    }
  }, []);

  const startRecording = (stream: MediaStream) => {
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];
    isCancelledRef.current = false;

    mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = () => {
        stream.getTracks().forEach(track => track.stop()); // Release microphone
        if (!isCancelledRef.current) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            onSendAudio(audioBlob);
        }
        audioChunksRef.current = [];
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  }

  const handleMicPress = async (e: React.TouchEvent | React.MouseEvent) => {
    if (disabled) return;

    try {
      if (navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'denied') {
          setIsPermissionModalOpen(true);
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startX.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
      recordingTimer.current = window.setTimeout(() => {
        startRecording(stream);
        if ('touches' in e) {
          window.addEventListener('touchmove', handleTouchMove);
        }
      }, 200);
    } catch (err) {
      console.error("Mic permission error:", err);
      setIsPermissionModalOpen(true);
    }
  };

  const handleMicRelease = () => {
    if (disabled) return;
    if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
    }
    window.removeEventListener('touchmove', handleTouchMove);

    if (isRecording) {
        if (shouldCancel) {
            isCancelledRef.current = true;
        }
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setShouldCancel(false);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMedia(file);
    }
    e.target.value = '';
  };

  const handleAttachmentMenu = (type: 'media' | 'location') => {
    setIsAttachmentMenuOpen(false);
    if (type === 'media') {
      fileInputRef.current?.click();
    } else if (type === 'location') {
      onSendLocation();
    }
  };


  if (isRecording) {
      return (
        <div className="p-2 bg-base-tan dark:bg-gray-900" onTouchEnd={handleMicRelease} onMouseUp={handleMicRelease}>
            <div className="bg-secondary-cream dark:bg-gray-800 rounded-xl flex items-center p-2 shadow-sm gap-2">
                <div className="flex items-center gap-2 text-red-500 flex-shrink-0">
                    <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-3 h-3 bg-red-500 rounded-full"
                    />
                    <span className="font-semibold">Recording...</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-text-primary/60 dark:text-gray-400 transition-opacity" style={{ opacity: shouldCancel ? 0 : 1 }}>
                    <ArrowLeft size={16} className="mr-2"/> Slide to Cancel
                </div>
                <div className="text-red-500 font-bold transition-opacity" style={{ opacity: shouldCancel ? 1 : 0 }}>
                    Release to Cancel
                </div>
            </div>
        </div>
      )
  }

  return (
    <div className={`relative p-2 bg-base-tan dark:bg-gray-900 transition-opacity ${disabled ? 'opacity-50' : 'opacity-100'}`}>
      <PermissionModal 
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        permissionName="microphone"
        featureName="voice messages"
      />
      <AnimatePresence>
        {isAttachmentMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute bottom-20 left-2 w-56 flex flex-col gap-1 bg-secondary-cream/95 dark:bg-gray-800/95 backdrop-blur-sm p-2 rounded-xl shadow-lg z-10"
          >
            <button onClick={() => handleAttachmentMenu('media')} className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 w-full text-left">
              <Image size={20} className="text-accent-brand" />
              <span className="font-semibold text-text-primary dark:text-gray-200">Image or Video</span>
            </button>
            <button onClick={() => handleAttachmentMenu('location')} className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 w-full text-left">
              <MapPin size={20} className="text-accent-brand" />
              <span className="font-semibold text-text-primary dark:text-gray-200">Location</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-secondary-cream dark:bg-gray-800 rounded-xl flex items-end p-2 shadow-sm gap-2">
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept="image/*,video/*"
            disabled={disabled}
        />
        <button onClick={() => setIsAttachmentMenuOpen(prev => !prev)} disabled={disabled} className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-accent-brand rounded-full hover:bg-accent-brand/10 transition-colors self-end disabled:cursor-not-allowed">
          <Paperclip size={22} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onFocus={() => setIsAttachmentMenuOpen(false)}
          onBlur={() => onTyping(false)}
          placeholder="Message"
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent outline-none text-text-primary dark:text-gray-100 placeholder:text-text-primary/50 dark:placeholder:text-gray-500 text-lg resize-none max-h-[120px] self-center py-2 disabled:cursor-not-allowed"
        />
        <button 
            onClick={text.trim() ? handleSend : undefined}
            onMouseDown={!text.trim() ? handleMicPress : undefined}
            onMouseUp={!text.trim() ? handleMicRelease : undefined}
            onTouchStart={!text.trim() ? handleMicPress : undefined}
            onTouchEnd={!text.trim() ? handleMicRelease : undefined}
            disabled={disabled}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-accent-brand text-white rounded-full transition-transform transform active:scale-90 self-end disabled:cursor-not-allowed"
        >
          {text.trim() ? <Send size={20} /> : <Mic size={20} />}
        </button>
      </div>
    </div>
  );
};

export default InputBar;
