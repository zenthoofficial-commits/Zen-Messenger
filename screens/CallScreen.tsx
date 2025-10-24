import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Call } from '../types';
import Avatar from '../components/Avatar';
import { Mic, MicOff, Phone, Video, VideoOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface CallScreenProps {
    call: Call;
    currentUser: User;
    onAnswer: () => void;
    onDecline: () => void;
    onEnd: () => void;
}

const CallScreen: React.FC<CallScreenProps> = ({ call, currentUser, onAnswer, onDecline, onEnd }) => {
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(call.type === 'audio');
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const ringtoneContextRef = useRef<AudioContext | null>(null);
    // FIX: Replaced NodeJS.Timeout with number as this code runs in the browser.
    const ringtoneSourceRef = useRef<number | null>(null);
    const audioActivityContextRef = useRef<AudioContext | null>(null);
    const activityAnimationRef = useRef<number | null>(null);

    const isCaller = call.callerId === currentUser.uid;
    const otherUser = {
        name: isCaller ? call.calleeName : call.callerName,
        avatarUrl: isCaller ? call.calleeAvatar : call.callerAvatar,
        uid: isCaller ? call.calleeId : call.callerId,
    };
    
    // Prevent background scrolling when call screen is active
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    const stopRingtone = useCallback(() => {
        if (ringtoneSourceRef.current) {
            clearInterval(ringtoneSourceRef.current);
            ringtoneSourceRef.current = null;
        }
        if (ringtoneContextRef.current && ringtoneContextRef.current.state !== 'closed') {
            ringtoneContextRef.current.close().catch(() => {});
            ringtoneContextRef.current = null;
        }
    }, []);

    const playRingtone = useCallback(() => {
        stopRingtone();
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        ringtoneContextRef.current = context;

        const playTone = () => {
            if (context.state === 'suspended') context.resume();
            const osc1 = context.createOscillator();
            const osc2 = context.createOscillator();
            const gain = context.createGain();
            
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(941.0, context.currentTime);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1477.0, context.currentTime);
            
            gain.gain.setValueAtTime(0, context.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.01);
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(context.destination);
            
            osc1.start();
            osc2.start();
            
            gain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 1);
            osc1.stop(context.currentTime + 1);
            osc2.stop(context.currentTime + 1);
        };

        playTone();
        ringtoneSourceRef.current = window.setInterval(playTone, 2500);

        return () => {
            if (ringtoneSourceRef.current) clearInterval(ringtoneSourceRef.current);
            stopRingtone();
        };
    }, [stopRingtone]);

    useEffect(() => {
        if (call.status === 'ringing' && !isCaller) {
            const cleanup = playRingtone();
            return cleanup;
        }
        return () => {
            stopRingtone();
        };
    }, [call.status, isCaller, playRingtone, stopRingtone]);

    const stopAudioActivityDetector = useCallback(() => {
        if (activityAnimationRef.current) cancelAnimationFrame(activityAnimationRef.current);
        if (audioActivityContextRef.current && audioActivityContextRef.current.state !== 'closed') {
            audioActivityContextRef.current.close().catch(() => {});
        }
        activityAnimationRef.current = null;
        audioActivityContextRef.current = null;
        setIsSpeaking(false);
    }, []);
    
    const startAudioActivityDetector = useCallback((stream: MediaStream) => {
        stopAudioActivityDetector();
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioActivityContextRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);
        
        const detect = () => {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (const amplitude of dataArray) {
                const value = (amplitude / 128.0) - 1.0;
                sum += value * value;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setIsSpeaking(rms > 0.02); // Speaking threshold
            activityAnimationRef.current = requestAnimationFrame(detect);
        };
        detect();
    }, [stopAudioActivityDetector]);

    useEffect(() => {
        let stream: MediaStream | null = null;
        const getMedia = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: call.type === 'video',
                    audio: {
                        noiseSuppression: true,
                        echoCancellation: true
                    },
                });
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error('Error accessing media devices.', err);
                alert('Could not access camera or microphone. Please check permissions.');
                onEnd();
            }
        };

        getMedia();

        return () => {
            stream?.getTracks().forEach(track => track.stop());
            stopAudioActivityDetector();
        };
    }, [call.type, onEnd, stopAudioActivityDetector]);

    useEffect(() => {
      if (call.status === 'connected' && localStream) {
        startAudioActivityDetector(localStream);
      } else {
        stopAudioActivityDetector();
      }
    }, [call.status, localStream, startAudioActivityDetector, stopAudioActivityDetector]);

    useEffect(() => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
        }
    }, [isMuted, localStream]);
    
    useEffect(() => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !isCameraOff);
        }
    }, [isCameraOff, localStream]);
    
    useEffect(() => {
        let interval: number | null = null;
        if (call.status === 'connected') {
            stopRingtone();
            interval = window.setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [call.status, stopRingtone]);
    
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const getStatusText = () => {
        switch (call.status) {
            case 'ringing':
                return isCaller ? 'Ringing...' : 'Incoming Call...';
            case 'connected':
                return formatDuration(callDuration);
            default:
                return 'Call Ended';
        }
    };

    const renderCallControls = () => {
        if (call.status === 'ringing' && !isCaller) {
            return (
                <div className="flex items-center justify-around w-full">
                    <div className="flex flex-col items-center">
                        <button 
                            onClick={onDecline}
                            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center"
                        >
                            <Phone size={28} className="transform -rotate-[135deg]" />
                        </button>
                        <span className="mt-2 text-white/90">Decline</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <button 
                            onClick={onAnswer}
                            className="w-16 h-16 rounded-full bg-accent-green text-white flex items-center justify-center"
                        >
                            <Phone size={28} />
                        </button>
                        <span className="mt-2 text-white/90">Answer</span>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="flex items-center justify-center gap-6">
                <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ring-4 ${isSpeaking && !isMuted ? 'ring-accent-green' : 'ring-transparent'} ${isMuted ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                    {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
                </button>

                {call.type === 'video' && (
                     <button 
                        onClick={() => setIsCameraOff(!isCameraOff)}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}
                    >
                        {isCameraOff ? <VideoOff size={28} /> : <Video size={28} />}
                    </button>
                )}

                <button 
                    onClick={onEnd}
                    className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                    <Phone size={28} className="transform -rotate-[135deg]" />
                </button>
            </div>
        );
    };

    return (
        <div className="absolute inset-0 bg-secondary-cream z-50 flex flex-col items-center justify-between p-8 text-white">
             <div className="absolute inset-0 -z-10 bg-black">
                <img src={otherUser.avatarUrl || `https://picsum.photos/seed/${otherUser.uid}/100/100`} className="w-full h-full object-cover opacity-30 blur-md" alt="background"/>
                {call.type === 'video' && call.status === 'connected' && !isCameraOff && (
                    <div className="absolute inset-0 w-full h-full bg-black">
                        {/* In a real app, this would be the remote user's video stream */}
                    </div>
                )}
            </div>
            
            <div className="flex flex-col items-center mt-16">
                <Avatar src={otherUser.avatarUrl || `https://picsum.photos/seed/${otherUser.uid}/100/100`} alt={otherUser.name} size="lg" />
                <h2 className="text-3xl font-bold mt-6">{otherUser.name}</h2>
                <p className="text-lg text-white/80 mt-2">{getStatusText()}</p>
            </div>
            
            {call.type === 'video' && localStream && (
                <motion.div
                    drag
                    dragMomentum={false}
                    className="absolute top-4 right-4 w-28 h-40 bg-black rounded-lg overflow-hidden shadow-lg cursor-grab active:cursor-grabbing"
                >
                    <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? 'hidden' : 'block'}`}/>
                    {isCameraOff && <div className="w-full h-full flex items-center justify-center bg-gray-800"><VideoOff size={32} className="text-white"/></div>}
                </motion.div>
            )}

            <div className="w-full mb-8">
                {renderCallControls()}
            </div>
        </div>
    );
};

export default CallScreen;