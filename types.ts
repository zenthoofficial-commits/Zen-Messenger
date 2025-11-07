import firebase from 'firebase/compat/app';
type Timestamp = number; // RTDB uses Unix timestamps (milliseconds)

export interface UserProfileData {
  name: string;
  name_lowercase: string;
  birthday: string;
  gender: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say' | string;
  relationshipStatus: 'Single' | 'In a relationship' | 'Married' | "It's complicated" | 'Prefer not to say';
  avatarUrl?: string;
  blockedUsers?: { [uid: string]: boolean };
  nicknames?: { [uid: string]: string }; // Map of friend UID to custom nickname
  accentColor?: string;
  chatBackgroundImageUrl?: string;
  notificationSettings?: {
    inApp: {
      newMessages: boolean;
      reactions: boolean;
    };
    push: {
      all: boolean;
    };
  };
}

export interface User extends UserProfileData {
  uid: string;
}

export interface Presence {
    isOnline: boolean;
    lastSeen: Timestamp;
}


export interface ReactionMap {
  [emoji: string]: { [uid: string]: boolean }; // Object of UIDs who reacted
}

export interface Message {
  id: string;
  text: string;
  timestamp: Timestamp;
  senderId: string;
  readBy: { [uid: string]: boolean };
  isEdited?: boolean;
  reactions?: ReactionMap;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
  mediaType?: 'audio' | 'image' | 'video';
  mediaUrl?: string;
  deletedFor?: { [uid: string]: boolean }; // UIDs of users who have deleted this message for themselves
  isSystemMessage?: boolean;
  translatedText?: string;
}

export interface Notification {
  id: string;
  type: 'new_message' | 'new_contact' | 'system';
  title: string;
  body: string;
  timestamp: Timestamp;
  isRead: boolean;
  link?: {
    screen: 'chat';
    chatId: string;
  };
}

export interface Chat {
  id:string;
  participants: { [uid: string]: boolean };
  member_count?: number;
  createdAt?: Timestamp;
  lastMessage?: Message;
  unreadCount: { [key: string]: number };
  typing: { [key: string]: boolean };
  pinnedBy?: { [userId: string]: boolean };
  hiddenBy?: { [userId: string]: boolean };
  pinnedMessageId?: string;
}

export interface ChatWithDetails extends Chat {
    otherParticipant: User;
    otherParticipantPresence: Presence;
}

export interface Call {
  id: string;
  participants: { [uid: string]: boolean };
  member_count?: number;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerGender?: string;
  calleeId: string;
  calleeName: string;
  calleeAvatar?: string;
  calleeGender?: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed';
  createdAt: Timestamp;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  callerCandidates?: any;
  calleeCandidates?: any;
  chatId: string;
}