import React, { useState, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { auth, db } from './firebase';
import SplashScreen from './screens/SplashScreen';
import ProfileCreationScreen from './screens/ProfileCreationScreen';
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import UserProfileViewScreen from './screens/UserProfileViewScreen';
import SearchUserModal from './components/SearchUserModal';
import CallScreen from './screens/CallScreen';
import NotificationScreen from './screens/NotificationScreen';
import SettingsDetailScreen from './screens/SettingsDetailScreen';
import BlockedUsersScreen from './screens/BlockedUsersScreen';
import HiddenChatsScreen from './screens/HiddenChatsScreen';
import PrivacySecurityScreen from './screens/PrivacySecurityScreen';
import AccountSettingsScreen from './screens/AccountSettingsScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
import AppearanceSettingsScreen from './screens/AppearanceSettingsScreen';
import { User, Chat, ChatWithDetails, UserProfileData, Notification, Presence, Call } from './types';
import { ACCENT_COLORS } from './constants';

export type Screen = 'splash' | 'profile_creation' | 'home' | 'chat' | 'profile' | 'user_profile_view' | 'notification' | 'settings_detail' | 'blocked_users' | 'hidden_chats' | 'privacy_security' | 'account_settings' | 'notification_settings' | 'appearance_settings';
export type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('splash');
  const [authUser, setAuthUser] = useState<firebase.User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeChat, setActiveChat] = useState<ChatWithDetails | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [userCache, setUserCache] = useState<{ [uid: string]: User }>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [friendUids, setFriendUids] = useState<string[]>([]);
  const [settingsPageTitle, setSettingsPageTitle] = useState('');
  const [chatForNavigation, setChatForNavigation] = useState<ChatWithDetails | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [accentColorName, setAccentColorName] = useState('green');


  // Theme and Accent Color management
  useEffect(() => {
    const root = window.document.documentElement;

    // Theme
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);

    // Accent Color
    const colorRgb = ACCENT_COLORS[accentColorName]?.rgb || ACCENT_COLORS.green.rgb;
    root.style.setProperty('--color-accent', colorRgb);

  }, [theme, accentColorName]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setAuthUser(user);
      if (!user) {
        setCurrentUser(null);
        setScreen('splash'); // Could lead to a login screen in a full app
        setTimeout(() => auth.signInAnonymously().catch(err => console.error("Anonymous sign-in failed", err)), 2000); // For demo purposes, auto-sign-in
      }
    });
    return () => unsubscribe();
  }, []);

  // User profile listener
  useEffect(() => {
    if (authUser) {
      const userRef = db.collection('users').doc(authUser.uid);
      const unsubscribe = userRef.onSnapshot(doc => {
        if (doc.exists) {
          const userData = { uid: doc.id, ...doc.data() } as User;
          setCurrentUser(userData);
          setUserCache(prev => ({ ...prev, [userData.uid]: userData }));

          if (userData.accentColor && ACCENT_COLORS[userData.accentColor]) {
              setAccentColorName(userData.accentColor);
          } else {
              setAccentColorName('green'); // default
          }

          if (screen === 'splash' || screen === 'profile_creation') {
            setScreen('home');
          }
        } else {
          if (screen !== 'profile_creation') {
             setScreen('profile_creation');
          }
        }
      });
      return () => unsubscribe();
    }
  }, [authUser, screen]);
  
  // Presence Management
  useEffect(() => {
    if (!currentUser) return;
    const presenceRef = db.collection('presence').doc(currentUser.uid);
    presenceRef.set({
        isOnline: true,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });

    const updateOfflineStatus = () => {
        presenceRef.set({
            isOnline: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    window.addEventListener('beforeunload', updateOfflineStatus);

    return () => {
        window.removeEventListener('beforeunload', updateOfflineStatus);
        updateOfflineStatus();
    };
  }, [currentUser]);

  // Notifications Listener
  useEffect(() => {
      if(!currentUser) return;
      const notifRef = db.collection('users').doc(currentUser.uid).collection('notifications').orderBy('timestamp', 'desc');
      const unsubscribe = notifRef.onSnapshot(snapshot => {
          const notifs: Notification[] = [];
          let unreadCount = 0;
          snapshot.forEach(doc => {
              const data = doc.data() as Omit<Notification, 'id'>;
              const notif = { id: doc.id, ...data } as Notification;
              notifs.push(notif);
              if(!notif.isRead) {
                  unreadCount++;
              }
          });
          setNotifications(notifs);
          setUnreadNotifCount(unreadCount);
      });
      return () => unsubscribe();
  }, [currentUser]);

  // Unified Call Listener
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = db.collection('calls')
      .where('participants', 'array-contains', currentUser.uid)
      .onSnapshot(snapshot => {
        const activeCalls: Call[] = [];
        snapshot.forEach(doc => {
          const call = { id: doc.id, ...doc.data() } as Call;
          if (['ringing', 'connected'].includes(call.status)) {
            activeCalls.push(call);
          }
        });

        if (activeCalls.length === 0) {
            setActiveCall(null);
            return;
        }

        // Prioritize any connected call to prevent a new ringing call from interrupting it.
        const connectedCall = activeCalls.find(c => c.status === 'connected');
        if (connectedCall) {
            setActiveCall(connectedCall);
            return;
        }

        // If no connected calls, find the latest ringing call
        const latestRingingCall = activeCalls
            .filter(c => c.status === 'ringing')
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
            
        setActiveCall(latestRingingCall || null);
      });

    return () => unsubscribe();
  }, [currentUser]);

  // Effect to handle navigation to a chat screen robustly
  useEffect(() => {
    if (chatForNavigation) {
      setActiveChat(chatForNavigation);
      setScreen('chat');
      setIsSearchVisible(false); // Ensure modal is closed
      setChatForNavigation(null); // Reset the trigger
    }
  }, [chatForNavigation]);


  const handleProfileSave = async (profileData: UserProfileData) => {
    if (authUser) {
      await db.collection('users').doc(authUser.uid).set(profileData, { merge: true });
      
      const welcomeNotif = {
        type: 'system',
        title: 'Welcome to ZenChat! 🎉',
        body: 'We are excited to have you. Find friends and start chatting!',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        isRead: false,
      };
      await db.collection('users').doc(authUser.uid).collection('notifications').add(welcomeNotif);
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
        await db.collection('presence').doc(currentUser.uid).set({
            isOnline: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    await auth.signOut();
    auth.signInAnonymously().catch(err => console.error("Anonymous sign-in failed", err));
  };

  const handleSelectChat = (chat: ChatWithDetails) => {
    setChatForNavigation(chat);
  };
  
  const handleStartChat = async (user: User) => {
    if (!currentUser) return;
    
    const chatsRef = db.collection('chats');
    const q = chatsRef.where('participants', 'array-contains', currentUser.uid);
    
    const querySnapshot = await q.get();
    let existingChat: ChatWithDetails | null = null;
    for (const doc of querySnapshot.docs) {
        const chatData = doc.data() as Chat;
        if(chatData.participants.length === 2 && chatData.participants.includes(user.uid)){
            existingChat = {
                id: doc.id,
                ...chatData,
                otherParticipant: user,
                otherParticipantPresence: { isOnline: false, lastSeen: firebase.firestore.Timestamp.now() } 
            };
            break;
        }
    }
    
    let chatToNavigateTo: ChatWithDetails;

    if(existingChat){
        chatToNavigateTo = existingChat;
    } else {
        const chatData: Omit<Chat, 'id'> = {
            participants: [currentUser.uid, user.uid],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            unreadCount: { [currentUser.uid]: 0, [user.uid]: 0 },
            typing: { [currentUser.uid]: false, [user.uid]: false }
        };

        try {
            const newChatRef = await chatsRef.add(chatData);

            const notifForCurrentUser = {
                type: 'new_contact',
                title: 'New Friend!',
                body: `You are now connected with ${user.name}. Say hi!`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                isRead: false,
                link: { screen: 'chat', chatId: newChatRef.id }
            };
            await db.collection('users').doc(currentUser.uid).collection('notifications').add(notifForCurrentUser);

            chatToNavigateTo = {
                id: newChatRef.id,
                participants: chatData.participants,
                unreadCount: chatData.unreadCount,
                typing: chatData.typing,
                otherParticipant: user,
                otherParticipantPresence: { isOnline: false, lastSeen: firebase.firestore.Timestamp.now() }
            };
        } catch (error) {
            console.error("Error creating new chat:", error);
            alert("Could not start chat. Please check your connection and security rules, then try again.");
            return;
        }
    }
    
    setChatForNavigation(chatToNavigateTo);
  };

  const handleStartCall = async (type: 'audio' | 'video', userToCall: User) => {
    if (!currentUser || activeCall) return;
    try {
        const callDocRef = db.collection('calls').doc();
        const newCallData: Omit<Call, 'id'> = {
            participants: [currentUser.uid, userToCall.uid],
            callerId: currentUser.uid,
            callerName: currentUser.name,
            callerAvatar: currentUser.avatarUrl || '',
            calleeId: userToCall.uid,
            calleeName: userToCall.name,
            calleeAvatar: userToCall.avatarUrl || '',
            type,
            status: 'ringing',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        await callDocRef.set(newCallData);
    } catch (error) {
        console.error("Error starting call:", error);
        alert("Could not start call. Please try again.");
    }
  };

  const handleAnswerCall = async () => {
    if (!activeCall) return;
    await db.collection('calls').doc(activeCall.id).update({ status: 'connected' });
  };

  const handleDeclineCall = async () => {
    if (!activeCall) return;
    await db.collection('calls').doc(activeCall.id).update({ status: 'declined' });
    setActiveCall(null);
  };

  const handleEndCall = async () => {
    if (!activeCall) return;
    await db.collection('calls').doc(activeCall.id).update({ status: 'ended' });
    setActiveCall(null);
  };
  
  const handleViewProfile = () => {
    if (activeChat) {
        setViewingUser(activeChat.otherParticipant);
        setScreen('user_profile_view');
    }
  }

  const handleNavigateToSettings = (title: string) => {
    setSettingsPageTitle(title);
    switch (title) {
        case 'Account':
            setScreen('account_settings');
            break;
        case 'Notifications':
            setScreen('notification_settings');
            break;
        case 'Appearance':
            setScreen('appearance_settings');
            break;
        case 'Blocked Users':
            setScreen('blocked_users');
            break;
        case 'Hidden Chats':
            setScreen('hidden_chats');
            break;
        case 'Privacy & Security':
            setScreen('privacy_security');
            break;
        default:
            setScreen('settings_detail');
            break;
    }
  };

  const handleViewNotifications = async () => {
      setScreen('notification');
      if (unreadNotifCount > 0 && currentUser) {
          const batch = db.batch();
          const notifsToUpdate = notifications.filter(n => !n.isRead);
          notifsToUpdate.forEach(notif => {
              const notifRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notif.id);
              batch.update(notifRef, { isRead: true });
          });
          await batch.commit();
      }
  };

  const renderScreen = () => {
    if (!currentUser && screen !== 'profile_creation') return <SplashScreen />;
    
    switch (screen) {
      case 'splash':
        return <SplashScreen />;
      case 'profile_creation':
        return authUser ? <ProfileCreationScreen uid={authUser.uid} onSave={handleProfileSave} /> : <SplashScreen />;
      case 'home':
        return <HomeScreen 
                  currentUser={currentUser!} 
                  onSelectChat={handleSelectChat}
                  onSearchClick={() => setIsSearchVisible(true)}
                  onProfileClick={() => setScreen('profile')}
                  onNotificationsClick={handleViewNotifications}
                  unreadNotifCount={unreadNotifCount}
                  userCache={userCache}
                  setUserCache={setUserCache}
                  onFriendUidsUpdate={setFriendUids}
                />;
      case 'chat':
        return activeChat ? <ChatScreen 
                  chat={activeChat} 
                  onBack={() => { setActiveChat(null); setScreen('home'); }} 
                  currentUser={currentUser!}
                  onStartCall={handleStartCall}
                  onViewProfile={handleViewProfile}
                  userCache={userCache}
                  setUserCache={setUserCache}
                  chatBackgroundImageUrl={currentUser?.chatBackgroundImageUrl}
                /> : <SplashScreen />; // Fallback to splash if chat is not ready
      case 'profile':
        return <ProfileScreen 
                  currentUser={currentUser!} 
                  onBack={() => setScreen('home')} 
                  onLogout={handleLogout} 
                  onNavigateToSettings={handleNavigateToSettings} 
                />;
      case 'user_profile_view':
        return viewingUser && currentUser ? <UserProfileViewScreen user={viewingUser} currentUser={currentUser} onBack={() => { setViewingUser(null); setScreen('chat'); }} /> : null;
      case 'notification':
        return <NotificationScreen 
                  currentUser={currentUser!} 
                  notifications={notifications} 
                  onBack={() => setScreen('home')} 
                />;
      case 'account_settings':
        return <AccountSettingsScreen currentUser={currentUser!} onBack={() => setScreen('profile')} />;
      case 'notification_settings':
        return <NotificationSettingsScreen currentUser={currentUser!} onBack={() => setScreen('profile')} />;
      case 'appearance_settings':
        return <AppearanceSettingsScreen onBack={() => setScreen('profile')} theme={theme} setTheme={setTheme} currentUser={currentUser!} accentColorName={accentColorName} setAccentColorName={setAccentColorName} />;
      case 'blocked_users':
        return <BlockedUsersScreen currentUser={currentUser!} onBack={() => setScreen('profile')} />;
      case 'hidden_chats':
        return <HiddenChatsScreen currentUser={currentUser!} onBack={() => setScreen('profile')} onSelectChat={handleSelectChat} userCache={userCache} setUserCache={setUserCache} />;
      case 'privacy_security':
        return <PrivacySecurityScreen onBack={() => setScreen('profile')} onNavigate={handleNavigateToSettings} />;
       case 'settings_detail':
        return <SettingsDetailScreen title={settingsPageTitle} onBack={() => setScreen('profile')} />;
      default:
        return <SplashScreen />;
    }
  };

  return (
    <div className="w-screen h-screen bg-gray-100 dark:bg-black font-sans overflow-hidden antialiased">
      <div className="h-full w-full max-w-md mx-auto bg-white dark:bg-gray-900 shadow-2xl relative">
        {renderScreen()}
        {isSearchVisible && currentUser && (
          <SearchUserModal 
            currentUser={currentUser}
            onClose={() => setIsSearchVisible(false)}
            onSelectUser={handleStartChat}
            friendUids={friendUids}
          />
        )}
        {activeCall && currentUser && (
            <CallScreen 
                call={activeCall}
                currentUser={currentUser}
                onAnswer={handleAnswerCall}
                onDecline={handleDeclineCall}
                onEnd={handleEndCall}
            />
        )}
      </div>
    </div>
  );
};

export default App;