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
    const [isReadyToAnswer, setIsReadyToAnswer] = useState(false);
    const isSettingAnswer = useRef(false);

    const pc = useRef<RTCPeerConnection | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoProcessorRef = useRef<{
        videoEl: HTMLVideoElement,
        animationFrameId: number | null,
        originalTrack: MediaStreamTrack | null,
        processedStream: MediaStream | null,
    }>({ videoEl: document.createElement('video'), animationFrameId: null, originalTrack: null, processedStream: null });


    const incomingRingtoneContextRef = useRef<AudioContext | null>(null);
    const incomingRingtoneIntervalRef = useRef<number | null>(null);
    const outgoingRingtoneContextRef = useRef<AudioContext | null>(null);
    const outgoingRingtoneIntervalRef = useRef<number | null>(null);

    const isCaller = call.callerId === currentUser.uid;
    const otherUser = {
        name: isCaller ? call.calleeName : call.callerName,
        avatarUrl: isCaller ? call.calleeAvatar : call.callerAvatar,
        uid: isCaller ? call.calleeId : call.callerId,
        gender: isCaller ? call.calleeGender : call.callerGender
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
                    ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } 
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
    
    // Effect 1: Create and destroy the Peer Connection. Runs only when the call ID changes.
    useEffect(() => {
        const servers = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };
        const peer = new RTCPeerConnection(servers);
        pc.current = peer;

        peer.ontrack = event => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            }
        };

        return () => {
            if (peer) {
                peer.close();
            }
            if (pc.current) {
                pc.current = null;
            }
        };
    }, [call.id]);
    
    // Effect 2: Handle signaling (offer, answer, candidates).
    useEffect(() => {
        const peer = pc.current;
        if (!peer) return;

        const callRef = db.ref(`calls/${call.id}`);
        const callerCandidatesRef = callRef.child('callerCandidates');
        const calleeCandidatesRef = callRef.child('calleeCandidates');

        peer.onicecandidate = event => {
            if (event.candidate) {
                const ref = isCaller ? callerCandidatesRef : calleeCandidatesRef;
                ref.push().set(event.candidate.toJSON());
            }
        };

        const callListener = callRef.on('value', async (snapshot) => {
            const data = snapshot.val() as Call;
            if (!data) return;

            // Callee receives offer
            if (data.offer && peer.signalingState === 'stable' && !isCaller) {
                try {
                    await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
                    setIsReadyToAnswer(true);
                } catch (e) {
                    console.error("Error setting remote description from offer", e);
                }
            }

            // Caller receives answer
            // FIX: Use a ref as a lock to prevent race conditions from rapid Firebase updates.
            if (data.answer && !peer.currentRemoteDescription && !isSettingAnswer.current) {
                isSettingAnswer.current = true;
                try {
                    await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
                } catch (e) {
                    console.error("Error setting remote description from answer", e);
                }
            }
        });

        const remoteCandidatesRef = isCaller ? calleeCandidatesRef : callerCandidatesRef;
        const candidateListener = remoteCandidatesRef.on('child_added', snapshot => {
            if (snapshot.exists()) {
                peer.addIceCandidate(new RTCIceCandidate(snapshot.val())).catch(e => console.error("Error adding ICE candidate", e));
            }
        });

        const startCall = async () => {
            const stream = await getMedia();
            if (stream && pc.current) {
                stream.getTracks().forEach(track => {
                    pc.current?.addTrack(track, stream);
                });

                if (isCaller) {
                    const offer = await pc.current.createOffer();
                    await pc.current.setLocalDescription(offer);
                    callRef.update({ offer: pc.current.localDescription?.toJSON() });
                }
            } else if (!stream) {
                onEnd();
            }
        };
        
        if (isCaller) {
            startCall();
        }

        return () => {
            callRef.off('value', callListener);
            remoteCandidatesRef.off('child_added', candidateListener);
        };
    }, [call.id, isCaller, getMedia, onEnd]);

    // Effect 3: Video processing for effects
    useEffect(() => {
        const peer = pc.current;
        const videoSender = peer?.getSenders().find(s => s.track?.kind === 'video');
        const canvas = canvasRef.current;
        const processor = videoProcessorRef.current;
    
        const cleanup = () => {
            if (processor.animationFrameId) {
                cancelAnimationFrame(processor.animationFrameId);
                processor.animationFrameId = null;
            }
            if (!processor.videoEl.paused) {
                 processor.videoEl.pause();
            }
            // Restore original track if it exists and is different
            if (peer && peer.connectionState !== 'closed' && videoSender && processor.originalTrack && videoSender.track !== processor.originalTrack) {
                videoSender.replaceTrack(processor.originalTrack).catch(e => {
                    if (e.name !== 'InvalidStateError') { // Ignore error if connection is already closed
                        console.warn("Error replacing track back to original", e);
                    }
                });
            }
        };
    
        if (!localStream || !videoSender || !canvas) {
            cleanup();
            return;
        }
    
        if (!processor.originalTrack) {
            processor.originalTrack = videoSender.track;
        }
        const originalTrack = processor.originalTrack;
        if (!originalTrack) return;
    
        const areEffectsOn = isBeautyEffectOn || isVintageEffectOn;
    
        if (!areEffectsOn) {
            cleanup();
            return;
        }
    
        processor.videoEl.srcObject = new MediaStream([originalTrack]);
        processor.videoEl.play().catch(e => console.error("Hidden video element failed to play", e));
    
        const drawFrame = () => {
            const settings = originalTrack.getSettings();
            const originalWidth = settings.width || 640;
            const originalHeight = settings.height || 480;
            const aspectRatio = originalWidth / originalHeight;
            
            const targetWidth = 480;
            const targetHeight = Math.round(targetWidth / aspectRatio);

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
            }
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                let filters = [];
                if (isBeautyEffectOn) filters.push('brightness(1.1) contrast(0.95) saturate(1.2) blur(0.5px)'); // Smoother skin effect to hide blemishes
                if (isVintageEffectOn) filters.push('grayscale(1) sepia(0.4) contrast(1.2) brightness(0.9)');
                ctx.filter = filters.join(' ');
                ctx.drawImage(processor.videoEl, 0, 0, canvas.width, canvas.height);
            }
            processor.animationFrameId = requestAnimationFrame(drawFrame);
        };
        drawFrame();
    
        const processedStream = canvas.captureStream(24);
        const processedTrack = processedStream.getVideoTracks()[0];
        if (processedTrack && videoSender.track !== processedTrack) {
            videoSender.replaceTrack(processedTrack).catch(e => console.error("Error replacing track with processed track", e));
        }
    
        return cleanup;
    }, [localStream, isBeautyEffectOn, isVintageEffectOn]);


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
        const peer = pc.current;
        if (!peer || !isReadyToAnswer) {
            console.error("Cannot answer, peer connection not ready or no offer received.");
            return;
        }

        const stream = await getMedia(call.type === 'video');
        if (!stream) {
            onDecline();
            return;
        }
        
        stream.getTracks().forEach(track => {
            const sender = peer.getSenders().find(s => s.track?.kind === track.kind);
            if (sender) {
                sender.replaceTrack(track);
            } else {
                peer.addTrack(track, stream);
            }
        });
        
        try {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await db.ref(`calls/${call.id}`).update({ answer: peer.localDescription?.toJSON() });
            onAnswer(); // This updates status to 'connected'
        } catch (error) {
            console.error("Failed to create or send answer", error);
            onDecline();
        }
    }, [call.id, call.type, getMedia, onAnswer, onDecline, isReadyToAnswer]);

    const handleToggleCamera = useCallback(async () => {
        const turningOn = isCameraOff;
        
        if (turningOn) {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
                const videoTrack = videoStream.getVideoTracks()[0];
                
                const sender = pc.current?.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack);
                    videoProcessorRef.current.originalTrack = videoTrack; // Update original track for processor
                } else if (localStream) {
                    pc.current?.addTrack(videoTrack, localStream);
                }

                setLocalStream(prevStream => {
                    const newStream = prevStream ? new MediaStream(prevStream.getAudioTracks()) : new MediaStream();
                    newStream.addTrack(videoTrack);
                    if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
                    return newStream;
                });

                setIsCameraOff(false);

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
                    track.enabled = false;
                    track.stop(); // Stop the track to turn off the camera light
                });
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
    
    const cleanupStreams = useCallback(() => {
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
        setRemoteStream(null);
    }, [localStream, remoteStream]);
    
    const getStatusText = () => {
        if (call.status === 'connected') return formatDuration(callDuration);
        const callTypeString = call.type === 'video' ? 'Video' : 'Audio';
        return isCaller ? 'Ringing...' : `Incoming ${callTypeString} Call...`;
    };

    const handleDeclineCall = async () => {
        await sendSystemMessage(`Missed ${call.type} call`);
        cleanupStreams();
        onDecline();
    };

    const handleEndCall = async () => {
        if (call.status === 'connected') {
            await sendSystemMessage(`${call.type === 'video' ? 'Video' : 'Audio'} call • ${formatDuration(callDuration)}`);
        } else if (call.status === 'ringing') {
             await sendSystemMessage(`Missed ${call.type} call`);
        }
        cleanupStreams();
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
                    <button onClick={handleAnswer} disabled={!isReadyToAnswer} className="flex flex-col items-center gap-2 text-white/90 disabled:opacity-60 disabled:cursor-not-allowed group">
                        <div className="w-16 h-16 rounded-full bg-accent-green text-white flex items-center justify-center transition-colors group-disabled:bg-gray-600"><Phone size={28} /></div>
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
                {call.type === 'video' &&
                    <button onClick={handleToggleCamera} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>{isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}</button>
                }
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
            <canvas ref={canvasRef} className="hidden"></canvas>
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
                {call.status === 'ringing' && !isCaller && (
                    <div className="mb-4 p-3 bg-white/10 rounded-full">
                        {call.type === 'video' ? <Video size={24} /> : <Phone size={24} />}
                    </div>
                )}
                <Avatar src={otherUser.avatarUrl || `https://picsum.photos/seed/${otherUser.uid}/100/100`} alt={otherUser.name} size="lg" gender={otherUser.gender}/>
                <h2 className="text-3xl font-bold mt-6 text-shadow">{otherUser.name}</h2>
                <p className="text-lg text-white/80 mt-2 text-shadow">{getStatusText()}</p>
            </div>
            
            {localStream && call.type === 'video' && (
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