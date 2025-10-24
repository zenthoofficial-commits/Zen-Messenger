import firebase from 'firebase/compat/app';
type Timestamp = firebase.firestore.Timestamp;

export interface UserProfileData {
  name: string;
  name_lowercase: string;
  birthday: string;
  gender: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say' | string;
  relationshipStatus: 'Single' | 'In a relationship' | 'Married' | "It's complicated" | 'Prefer not to say';
  avatarUrl?: string;
  blockedUsers?: string[];
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
  [emoji: string]: string[]; // Array of UIDs who reacted
}

export interface Message {
  id: string;
  text: string;
  timestamp: Timestamp | any; // Allow for serverTimestamp()
  senderId: string;
  readBy: string[];
  isEdited?: boolean;
  reactions?: ReactionMap;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
  mediaType?: 'audio' | 'image' | 'video';
  mediaUrl?: string;
  deletedFor?: string[]; // UIDs of users who have deleted this message for themselves
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
  participants: string[];
  createdAt?: Timestamp | any;
  lastMessage?: Message;
  unreadCount: { [key: string]: number };
  typing: { [key: string]: boolean };
  pinnedBy?: string[];
  hiddenBy?: { [userId: string]: boolean };
  pinnedMessageId?: string;
}

export interface ChatWithDetails extends Chat {
    otherParticipant: User;
    otherParticipantPresence: Presence;
}

export interface Call {
  id: string;
  participants: string[];
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  calleeId: string;
  calleeName: string;
  calleeAvatar?: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed';
  createdAt: Timestamp | any;
}