import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Call, Message } from '../types';
import Avatar from '../components/Avatar';
import { Mic, MicOff, Phone, Video, VideoOff, Sparkles, Film } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import firebase from 'firebase/compat/app';
import PermissionModal from '../components/PermissionModal';

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
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [permissionError, setPermissionError] = useState<{name: 'camera' | 'microphone' | 'camera & microphone', feature: string} | null>(null);
    const [isBeautyEffectOn, setIsBeautyEffectOn] = useState(true);
    const [isVintageEffectOn, setIsVintageEffectOn] = useState(false);

    const pc = useRef<RTCPeerConnection | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const isNegotiating = useRef(false);

    const incomingRingtoneContextRef = useRef<AudioContext | null>(null);
    const incomingRingtoneIntervalRef = useRef<number | null>(null);
    const outgoingRingtoneContextRef = useRef<AudioContext | null>(null);
    const outgoingRingtoneIntervalRef = useRef<number | null>(null);

    const isCaller = call.callerId === currentUser.uid;
    const otherUser = {
        name: isCaller ? call.calleeName : call.callerName,
        avatarUrl: isCaller ? call.calleeAvatar : call.callerAvatar,
        uid: isCaller ? call.calleeId : call.callerId,
    };
    
    const formatDuration = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

    // Prevent background scrolling
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const stopIncomingRingtone = useCallback(() => {
        if (incomingRingtoneIntervalRef.current) {
            clearInterval(incomingRingtoneIntervalRef.current);
            incomingRingtoneIntervalRef.current = null;
        }
        if (incomingRingtoneContextRef.current && incomingRingtoneContextRef.current.state !== 'closed') {
            incomingRingtoneContextRef.current.close().catch(() => {});
            incomingRingtoneContextRef.current = null;
        }
    }, []);

    const stopOutgoingRingtone = useCallback(() => {
        if (outgoingRingtoneIntervalRef.current) {
            clearInterval(outgoingRingtoneIntervalRef.current);
            outgoingRingtoneIntervalRef.current = null;
        }
        if (outgoingRingtoneContextRef.current && outgoingRingtoneContextRef.current.state !== 'closed') {
            outgoingRingtoneContextRef.current.close().catch(() => {});
            outgoingRingtoneContextRef.current = null;
        }
    }, []);
    
    // Manage incoming ringtone
    useEffect(() => {
        if (call.status === 'ringing' && !isCaller) {
             const context = new (window.AudioContext || (window as any).webkitAudioContext)();
             incomingRingtoneContextRef.current = context;
             const playTone = () => {
                 if (context.state === 'suspended') context.resume();
                 const osc1 = context.createOscillator();
                 const gain = context.createGain();
                 osc1.type = 'sine';
                 osc1.frequency.setValueAtTime(440, context.currentTime); // A4
                 gain.gain.setValueAtTime(0, context.currentTime);
                 gain.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.01);
                 osc1.connect(gain);
                 gain.connect(context.destination);
                 osc1.start();
                 gain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 1);
                 osc1.stop(context.currentTime + 1);
             };
             playTone();
             incomingRingtoneIntervalRef.current = window.setInterval(playTone, 2500);
        }
        return () => stopIncomingRingtone();
    }, [call.status, isCaller, stopIncomingRingtone]);

    // Manage outgoing ringtone
    useEffect(() => {
        if (call.status === 'ringing' && isCaller) {
             const context = new (window.AudioContext || (window as any).webkitAudioContext)();
             outgoingRingtoneContextRef.current = context;
             const playTone = () => {
                 if (context.state === 'suspended') context.resume();
                 const osc1 = context.createOscillator();
                 const gain = context.createGain();
                 osc1.type = 'sawtooth';
                 osc1.frequency.setValueAtTime(440, context.currentTime); // A4
                 const osc2 = context.createOscillator();
                 osc2.type = 'sawtooth';
                 osc2.frequency.setValueAtTime(493.88, context.currentTime); // B4
                 
                 gain.gain.setValueAtTime(0, context.currentTime);
                 gain.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.01);

                 osc1.connect(gain);
                 osc2.connect(gain);
                 gain.connect(context.destination);
                 
                 osc1.start();
                 osc2.start();

                 gain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 0.4);

                 osc1.stop(context.currentTime + 0.4);
                 osc2.stop(context.currentTime + 0.4);
             };
             playTone();
             outgoingRingtoneIntervalRef.current = window.setInterval(playTone, 2000); // Ring every 2 seconds
        }
        return () => stopOutgoingRingtone();
    }, [call.status, isCaller, stopOutgoingRingtone]);


    const getMedia = useCallback(async (video = call.type === 'video') => {
        try {
            const audioConstraints = {
                autoGainControl: { ideal: true },
                echoCancellation: { ideal: true },
                noiseSuppression: { ideal: true },
            };
            const constraints = {
                video: video 
                    ? { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } 
                    : false,
                audio: audioConstraints,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            return stream;
        } catch (err) {
            console.error('Error accessing media devices.', err);
            setPermissionError({
                name: video ? 'camera & microphone' : 'microphone',
                feature: `${video ? 'video' : 'audio'} calls`
            });
            setIsPermissionModalOpen(true);
            return null;
        }
    }, [call.type]);

    // Get user media for the caller on mount
    useEffect(() => {
        if (!isCaller) return;
        const getCallerMedia = async () => {
            const stream = await getMedia();
            if (!stream) {
                onEnd();
            }
        };
        getCallerMedia();
    }, [isCaller, getMedia, onEnd]);
    
    // WebRTC Initialization and Signaling
    useEffect(() => {
        const servers = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };
        pc.current = new RTCPeerConnection(servers);
        isNegotiating.current = false;

        pc.current.onnegotiationneeded = async () => {
            if (isNegotiating.current) return;
            isNegotiating.current = true;
            try {
                // To avoid glare, only the caller is responsible for creating offers.
                if (isCaller) {
                    const offer = await pc.current.createOffer();
                    await pc.current.setLocalDescription(offer);
                    db.ref(`calls/${call.id}`).update({ offer: pc.current.localDescription?.toJSON() });
                }
            } catch (error) {
                console.error("WebRTC Error: onnegotiationneeded failed.", error);
            } finally {
                isNegotiating.current = false;
            }
        };

        const callRef = db.ref(`calls/${call.id}`);
        const callerCandidatesRef = callRef.child('callerCandidates');
        const calleeCandidatesRef = callRef.child('calleeCandidates');
        
        pc.current.ontrack = event => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            }
        };

        pc.current.onicecandidate = event => {
            if (event.candidate) {
                const ref = isCaller ? callerCandidatesRef : calleeCandidatesRef;
                ref.push().set(event.candidate.toJSON());
            }
        };

        const remoteCandidatesRef = isCaller ? calleeCandidatesRef : callerCandidatesRef;
        const candidateListener = remoteCandidatesRef.on('child_added', async snapshot => {
            try {
                if (snapshot.exists()) {
                    await pc.current?.addIceCandidate(new RTCIceCandidate(snapshot.val()));
                }
            } catch (error) {
                console.error("WebRTC Error: Failed to add ICE candidate.", error);
            }
        });

        const callListener = callRef.on('value', async (snapshot) => {
            const data = snapshot.val() as Call;
            if (!data || !pc.current) return;

            const newOffer = data.offer;
            const currentRemoteDesc = pc.current.remoteDescription;
            if (newOffer && (!currentRemoteDesc || newOffer.sdp !== currentRemoteDesc.sdp)) {
                try {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(newOffer));
                    if (!isCaller && pc.current.signalingState === 'have-remote-offer') {
                        const answer = await pc.current.createAnswer();
                        await pc.current.setLocalDescription(answer);
                        await db.ref(`calls/${call.id}`).update({ answer: pc.current.localDescription.toJSON() });
                    }
                } catch (e) { console.error("WebRTC Error: Failed to handle new offer.", e); }
            }
            
            const newAnswer = data.answer;
             if (isCaller && newAnswer && pc.current.signalingState === 'have-local-offer') {
                try {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(newAnswer));
                } catch (e) { console.error("WebRTC Error: Failed to set remote description on caller.", e); }
            }
        });

        return () => {
            remoteCandidatesRef.off('child_added', candidateListener);
            callRef.off('value', callListener);
            pc.current?.close();
            pc.current = null;
        };
    }, [call.id, isCaller]);


    // Add local stream tracks
    useEffect(() => {
        if (localStream && pc.current) {
             const existingTracks = pc.current.getSenders().map(s => s.track);
             localStream.getTracks().forEach(track => {
                if(!existingTracks.includes(track)) {
                    pc.current?.addTrack(track, localStream);
                }
            });
        }
    }, [localStream]);

    const sendSystemMessage = useCallback(async (text: string) => {
        if (!call.chatId) return;
        try {
            const messageRef = db.ref(`messages/${call.chatId}`).push();
            const messageData: Omit<Message, 'id'> = {
                text,
                senderId: 'system',
                timestamp: firebase.database.ServerValue.TIMESTAMP as number,
                readBy: {},
                isSystemMessage: true,
            };
            await messageRef.set(messageData);
            await db.ref(`chats/${call.chatId}`).update({ lastMessage: messageData });
        } catch (error) {
            console.error("Failed to send system message", error);
        }
    }, [call.chatId]);

    const handleAnswer = useCallback(async () => {
        const stream = await getMedia(call.type === 'video');
        if (!stream) {
            onDecline();
            return;
        }
        onAnswer();
    }, [call.type, onAnswer, getMedia, onDecline]);

    const handleToggleCamera = useCallback(async () => {
        const turningOn = isCameraOff;
        
        if (turningOn) {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080 } });
                const videoTrack = videoStream.getVideoTracks()[0];
                
                setLocalStream(prevStream => {
                    const newStream = prevStream ? prevStream : new MediaStream();
                    newStream.addTrack(videoTrack);
                    if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
                    return newStream;
                });

                // Add track to peer connection, which will trigger renegotiation
                pc.current?.addTrack(videoTrack, localStream!);
                setIsCameraOff(false);

                // If upgrading from audio, update call type in DB
                if (call.type === 'audio') {
                    db.ref(`calls/${call.id}`).update({ type: 'video' });
                }
            } catch (err) {
                console.error("Failed to get video track", err);
                setIsCameraOff(true);
                setPermissionError({name: 'camera', feature: 'video calls'});
                setIsPermissionModalOpen(true);
            }
        } else {
            if (localStream) {
                localStream.getVideoTracks().forEach(track => {
                    track.stop();
                    localStream.removeTrack(track);
                    const sender = pc.current?.getSenders().find(s => s.track === track);
                    if(sender) pc.current?.removeTrack(sender);
                });
                setLocalStream(new MediaStream(localStream.getAudioTracks()));
                setIsCameraOff(true);
            }
        }
    }, [isCameraOff, localStream, call.id, call.type]);

    useEffect(() => {
        if (localStream) localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    }, [isMuted, localStream]);
    
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);
    
    useEffect(() => {
        let interval: number | null = null;
        if (call.status === 'connected') {
            stopIncomingRingtone();
            stopOutgoingRingtone();
            interval = window.setInterval(() => setCallDuration(prev => prev + 1), 1000);
        } else {
            setCallDuration(0);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [call.status, stopIncomingRingtone, stopOutgoingRingtone]);
    
    useEffect(() => {
      return () => {
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
      }
    }, [localStream, remoteStream]);
    
    const getStatusText = () => call.status === 'connected' ? formatDuration(callDuration) : (isCaller ? 'Ringing...' : 'Incoming Call...');

    const handleDeclineCall = async () => {
        await sendSystemMessage(`Missed ${call.type} call`);
        onDecline();
    };

    const handleEndCall = async () => {
        if (call.status === 'connected') {
            await sendSystemMessage(`${call.type === 'video' ? 'Video' : 'Audio'} call • ${formatDuration(callDuration)}`);
        } else if (call.status === 'ringing') {
             await sendSystemMessage(`Missed ${call.type} call`);
        }
        onEnd();
    };

    const renderCallControls = () => {
        if (call.status === 'ringing' && !isCaller) {
            return (
                 <div className="flex items-center justify-around w-full max-w-xs mx-auto">
                    <button onClick={handleDeclineCall} className="flex flex-col items-center gap-2 text-white/90">
                        <div className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center"><Phone size={28} className="transform -rotate-[135deg]" /></div>
                        <span>Decline</span>
                    </button>
                    <button onClick={handleAnswer} className="flex flex-col items-center gap-2 text-white/90">
                        <div className="w-16 h-16 rounded-full bg-accent-green text-white flex items-center justify-center"><Phone size={28} /></div>
                        <span>Answer</span>
                    </button>
                </div>
            );
        }
        return (
            <div className="flex items-center justify-center gap-4">
                {call.type === 'video' && (
                    <button onClick={() => setIsBeautyEffectOn(!isBeautyEffectOn)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isBeautyEffectOn ? 'bg-accent-orange text-white' : 'bg-white/20 text-white'}`}>
                        <Sparkles size={24}/>
                    </button>
                )}
                {call.type === 'video' && (
                    <button onClick={() => setIsVintageEffectOn(!isVintageEffectOn)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVintageEffectOn ? 'bg-gray-500 text-white' : 'bg-white/20 text-white'}`}>
                        <Film size={24}/>
                    </button>
                )}
                <button onClick={() => setIsMuted(!isMuted)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>{ isMuted ? <MicOff size={24}/> : <Mic size={24}/>}</button>
                <button onClick={handleToggleCamera} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>{isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}</button>
                <button onClick={handleEndCall} className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center"><Phone size={28} className="transform -rotate-[135deg]" /></button>
            </div>
        );
    };
    
    const showCenteredInfo = call.type === 'audio' || call.status !== 'connected' || (call.type === 'video' && !remoteStream);

    const localVideoClasses = [
        'w-full h-full object-cover transform scale-x-[-1]',
        isCameraOff ? 'hidden' : 'block',
        isBeautyEffectOn ? 'filter-beauty' : '',
        isVintageEffectOn ? 'filter-vintage' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className="absolute inset-0 bg-gray-800 z-50 flex flex-col items-center justify-between p-8 text-white">
            {permissionError && (
                <PermissionModal 
                    isOpen={isPermissionModalOpen}
                    onClose={() => setIsPermissionModalOpen(false)}
                    permissionName={permissionError.name}
                    featureName={permissionError.feature}
                />
            )}

            <video ref={remoteVideoRef} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover -z-10 bg-black transition-opacity duration-500 ${call.type === 'video' && remoteStream && call.status === 'connected' ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`absolute inset-0 -z-20 bg-black transition-opacity duration-500 ${showCenteredInfo ? 'opacity-100' : 'opacity-0'}`}>
                <img src={otherUser.avatarUrl || `https://picsum.photos/seed/${otherUser.uid}/100/100`} className="w-full h-full object-cover opacity-30 blur-md" alt="background"/>
            </div>
            
            <div className={`flex-1 flex flex-col items-center justify-center text-center transition-opacity duration-500 ${showCenteredInfo ? 'opacity-100' : 'opacity-0'}`}>
                <Avatar src={otherUser.avatarUrl || `https://picsum.photos/seed/${otherUser.uid}/100/100`} alt={otherUser.name} size="lg" />
                <h2 className="text-3xl font-bold mt-6 text-shadow">{otherUser.name}</h2>
                <p className="text-lg text-white/80 mt-2 text-shadow">{getStatusText()}</p>
            </div>
            
            {localStream && (
                <motion.div drag dragMomentum={false} className={`absolute top-4 right-4 w-28 h-40 bg-black rounded-lg overflow-hidden shadow-lg cursor-grab active:cursor-grabbing transition-opacity duration-500 ${call.status === 'connected' ? 'opacity-100' : 'opacity-0'}`}>
                    <video ref={localVideoRef} autoPlay muted playsInline className={localVideoClasses}/>
                    {isCameraOff && <div className="w-full h-full flex items-center justify-center bg-gray-800"><VideoOff size={32} className="text-white"/></div>}
                </motion.div>
            )}

            <div className="w-full z-10 flex justify-center">{renderCallControls()}</div>
        </div>
    );
};

export default CallScreen;