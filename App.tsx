import React, { useState, useEffect, useCallback, useRef } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
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
import WalletScreen from './screens/WalletScreen';
import { User, Chat, ChatWithDetails, UserProfileData, Notification, Presence, Call } from './types';
import { ACCENT_COLORS } from './constants';

export type Screen = 'splash' | 'profile_creation' | 'home' | 'chat' | 'profile' | 'user_profile_view' | 'notification' | 'settings_detail' | 'blocked_users' | 'hidden_chats' | 'privacy_security' | 'account_settings' | 'notification_settings' | 'appearance_settings' | 'wallet';
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
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [accentColorName, setAccentColorName] = useState('green');
  const [isCreatingChatWith, setIsCreatingChatWith] = useState<string | null>(null);

  const [activeCalls, setActiveCalls] = useState<{[key: string]: Call}>({});
  const activeCallListeners = useRef<{[key: string]: {ref: firebase.database.Reference, listener: (s: firebase.database.DataSnapshot) => void}}>({});
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;


  // Navigation handler
  const navigateTo = (targetScreen: Screen, options?: { replace?: boolean }) => {
    // The hash was causing a cross-origin error in the sandboxed environment.
    // We can manage history for back button functionality without changing the URL hash.
    if (options?.replace) {
        window.history.replaceState({ screen: targetScreen }, '');
    } else {
        // Only push new state if it's different from the current one to avoid duplicate entries
        if (window.history.state?.screen !== targetScreen) {
          window.history.pushState({ screen: targetScreen }, '');
        }
    }
    setScreen(targetScreen);
  };
  
  // Back button handler
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.screen) {
        setScreen(event.state.screen);
      } else {
        // If history state is lost or initial, reset to home.
        setScreen('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


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
        navigateTo('splash', { replace: true });
        setTimeout(() => auth.signInAnonymously().catch(err => console.error("Anonymous sign-in failed", err)), 2000);
      }
    });
    return () => unsubscribe();
  }, []);

  // User profile listener
  useEffect(() => {
    if (authUser) {
      const userRef = db.ref(`users/${authUser.uid}`);
      const listener = userRef.on('value', snapshot => {
        if (snapshot.exists()) {
          const userData = { uid: snapshot.key, ...snapshot.val() } as User;
          setCurrentUser(userData);
          setUserCache(prev => ({ ...prev, [userData.uid]: userData }));

          if (userData.accentColor && ACCENT_COLORS[userData.accentColor]) {
              setAccentColorName(userData.accentColor);
          } else {
              setAccentColorName('green'); // default
          }

          if (screen === 'splash' || screen === 'profile_creation') {
            navigateTo('home', { replace: true });
          }
        } else {
          if (screen !== 'profile_creation') {
             navigateTo('profile_creation', { replace: true });
          }
        }
      }, error => {
        console.error("RTDB Error: Failed to listen for user profile.", error);
      });
      return () => userRef.off('value', listener);
    }
  }, [authUser, screen]);
  
  // Presence Management
  useEffect(() => {
    if (!currentUser) return;

    const presenceRef = db.ref(`presence/${currentUser.uid}`);
    const amOnline = {
        isOnline: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    };
    const amOffline = {
        isOnline: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    };

    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            presenceRef.onDisconnect().set(amOffline).then(() => {
                presenceRef.set(amOnline);
            });
        }
    });

    return () => {
        presenceRef.set(amOffline);
        connectedRef.off();
    };
}, [currentUser]);

  // Notifications Listener
  useEffect(() => {
      if(!currentUser) return;
      const notifRef = db.ref(`userNotifications/${currentUser.uid}`).orderByChild('timestamp').limitToLast(50);
      const listener = notifRef.on('value', snapshot => {
          const notifs: Notification[] = [];
          let unreadCount = 0;
          if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                const notif = { id: childSnapshot.key, ...data } as Notification;
                notifs.push(notif);
                if(!notif.isRead) {
                    unreadCount++;
                }
            });
          }
          setNotifications(notifs.reverse());
          setUnreadNotifCount(unreadCount);
      }, error => {
          console.error("RTDB Error: Failed to listen for notifications.", error);
      });
      return () => notifRef.off('value', listener);
  }, [currentUser]);

  // Call Listeners
  useEffect(() => {
    if (!currentUser) {
        Object.values(activeCallListeners.current).forEach(({ref, listener}) => ref.off('value', listener));
        activeCallListeners.current = {};
        setActiveCalls({});
        return;
    }

    const userCallsRef = db.ref(`userCalls/${currentUser.uid}`);

    const userCallsListener = userCallsRef.on('value', (snapshot) => {
        const callIds = snapshot.exists() ? Object.keys(snapshot.val()) : [];
        
        Object.keys(activeCallListeners.current).forEach(callId => {
            if (!callIds.includes(callId)) {
                const { ref, listener } = activeCallListeners.current[callId];
                ref.off('value', listener);
                delete activeCallListeners.current[callId];
                setActiveCalls(prev => {
                    const newCalls = {...prev};
                    delete newCalls[callId];
                    return newCalls;
                });
            }
        });

        callIds.forEach(callId => {
            if (!activeCallListeners.current[callId]) {
                const callRef = db.ref(`calls/${callId}`);
                const callListener = (callSnapshot: firebase.database.DataSnapshot) => {
                    if (callSnapshot.exists()) {
                        const callData = { id: callSnapshot.key, ...callSnapshot.val() } as Call;
                        if (['ended', 'declined', 'missed'].includes(callData.status)) {
                            db.ref(`userCalls/${currentUser.uid}/${callData.id}`).remove();
                        } else {
                            setActiveCalls(prev => ({ ...prev, [callId]: callData }));
                        }
                    } else {
                        db.ref(`userCalls/${currentUser.uid}/${callId}`).remove();
                    }
                };
                callRef.on('value', callListener);
                activeCallListeners.current[callId] = { ref: callRef, listener: callListener };
            }
        });
    }, error => {
        console.error("RTDB Error: Failed to listen for user calls.", error);
    });

    return () => {
        userCallsRef.off('value', userCallsListener);
        Object.values(activeCallListeners.current).forEach(({ ref, listener }) => ref.off('value', listener));
        activeCallListeners.current = {};
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setActiveCall(null);
      return;
    }

    const currentCalls = (Object.values(activeCalls) as Call[]).filter(c => c && ['ringing', 'connected'].includes(c.status));

    if (currentCalls.length === 0) {
        setActiveCall(null);
        return;
    }

    const connectedCall = currentCalls.find(c => c.status === 'connected');
    if (connectedCall) {
        setActiveCall(connectedCall);
        return;
    }

    const outgoingRingingCall = currentCalls.find(c => c.status === 'ringing' && c.callerId === currentUser.uid);
    if(outgoingRingingCall){
        setActiveCall(outgoingRingingCall);
        return;
    }

    const latestRingingCall = currentCalls
        .filter(c => c.status === 'ringing' && c.calleeId === currentUser.uid)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
    
    setActiveCall(latestRingingCall || null);
  }, [activeCalls, currentUser]);


  const handleProfileSave = async (profileData: UserProfileData) => {
    if (authUser) {
      try {
        await db.ref(`users/${authUser.uid}`).set(profileData);
      
        const welcomeNotif = {
          type: 'system',
          title: 'Welcome to ZenChat! 🎉',
          body: 'We are excited to have you. Find friends and start chatting!',
          timestamp: firebase.database.ServerValue.TIMESTAMP,
          isRead: false,
        };
        await db.ref(`userNotifications/${authUser.uid}`).push().set(welcomeNotif);
      } catch (error) {
        console.error("RTDB Error: Failed to save profile.", error);
        throw error; // Re-throw to be caught in the component
      }
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await db.ref(`presence/${currentUser.uid}`).set({
            isOnline: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
      } catch(error) {
        console.error("RTDB Error: Failed to update presence on logout.", error);
      }
    }
    await auth.signOut();
    auth.signInAnonymously().catch(err => console.error("Anonymous sign-in failed", err));
  };

  const handleSelectChat = (chat: ChatWithDetails) => {
    setActiveChat(chat);
    navigateTo('chat');
  };
  
  const handleStartChat = async (user: User) => {
    if (!currentUser || isCreatingChatWith === user.uid) return;

    setIsCreatingChatWith(user.uid);
    try {
        let existingChatId: string | null = null;
        let existingChatData: Chat | null = null;
        
        // Securely find existing 1-on-1 chat
        const userChatsSnap = await db.ref(`userChats/${currentUser.uid}`).once('value');
        if (userChatsSnap.exists()) {
            const userChatIds = Object.keys(userChatsSnap.val());
            for (const chatId of userChatIds) {
                const chatSnap = await db.ref(`chats/${chatId}`).once('value');
                if (chatSnap.exists()) {
                    const chatData = chatSnap.val() as Chat;
                    if (chatData.participants[user.uid] && Object.keys(chatData.participants).length === 2) {
                        existingChatId = chatId;
                        existingChatData = chatData;
                        break;
                    }
                }
            }
        }
        
        let chatToNavigateTo: ChatWithDetails;

        if (existingChatId && existingChatData) {
            // Chat already exists, just make sure it's in the current user's list and navigate
            await db.ref(`userChats/${currentUser.uid}/${existingChatId}`).set(true);
            chatToNavigateTo = {
                id: existingChatId,
                ...existingChatData,
                otherParticipant: user,
                otherParticipantPresence: { isOnline: false, lastSeen: Date.now() }
            };
        } else {
            // Create a new chat
            const newChatRef = db.ref('chats').push();
            const newChatId = newChatRef.key!;
            const chatData: Omit<Chat, 'id'> = {
                participants: { [currentUser.uid]: true, [user.uid]: true },
                member_count: 2,
                createdAt: firebase.database.ServerValue.TIMESTAMP as number,
                unreadCount: { [currentUser.uid]: 0, [user.uid]: 0 },
                typing: { [currentUser.uid]: false, [user.uid]: false }
            };

            // Non-atomic write to comply with security rules: create chat first.
            await newChatRef.set(chatData);

            // Then, add the chat to both users' chat lists.
            const userChatsUpdates: { [key: string]: any } = {};
            userChatsUpdates[`/userChats/${currentUser.uid}/${newChatId}`] = true;
            userChatsUpdates[`/userChats/${user.uid}/${newChatId}`] = true;
            await db.ref().update(userChatsUpdates);


            const notifForCurrentUser = {
                type: 'new_contact',
                title: 'New Friend!',
                body: `You are now connected with ${user.name}. Say hi!`,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                isRead: false,
                link: { screen: 'chat', chatId: newChatId }
            };
            await db.ref(`userNotifications/${currentUser.uid}`).push().set(notifForCurrentUser);

            chatToNavigateTo = {
                id: newChatId,
                participants: chatData.participants,
                unreadCount: chatData.unreadCount,
                typing: chatData.typing,
                otherParticipant: user,
                otherParticipantPresence: { isOnline: false, lastSeen: Date.now() }
            };
        }
        setActiveChat(chatToNavigateTo);
        navigateTo('chat');
        setIsSearchVisible(false);
    } catch (error) {
        console.error("Error creating new chat:", error);
        alert("Could not start chat. Please check your connection and security rules, then try again.");
    } finally {
        setIsCreatingChatWith(null);
    }
  };

  const handleStartCall = async (type: 'audio' | 'video', userToCall: User, chatId: string) => {
    if (!currentUser || activeCall) return;
    try {
        const callDocRef = db.ref('calls').push();
        const callId = callDocRef.key!;
        const newCallData: Omit<Call, 'id'> = {
            participants: { [currentUser.uid]: true, [userToCall.uid]: true },
            member_count: 2,
            callerId: currentUser.uid,
            callerName: currentUser.name,
            callerAvatar: currentUser.avatarUrl || '',
            calleeId: userToCall.uid,
            calleeName: userToCall.name,
            calleeAvatar: userToCall.avatarUrl || '',
            type,
            status: 'ringing',
            createdAt: firebase.database.ServerValue.TIMESTAMP as number,
            chatId: chatId,
        };
        
        const updates: { [key: string]: any } = {};
        updates[`/calls/${callId}`] = newCallData;
        updates[`/userCalls/${currentUser.uid}/${callId}`] = true;
        updates[`/userCalls/${userToCall.uid}/${callId}`] = true;
        
        await db.ref().update(updates);
    } catch (error) {
        console.error("Error starting call:", error);
        alert("Could not start call. Please try again.");
    }
  };

  const handleAnswerCall = useCallback(async () => {
    if (!activeCallRef.current) return;
    try {
      await db.ref(`calls/${activeCallRef.current.id}`).update({ status: 'connected' });
    } catch (error) {
      console.error("RTDB Error: Failed to answer call.", error);
    }
  }, []);

  const handleDeclineCall = useCallback(async () => {
    if (!activeCallRef.current) return;
    try {
      await db.ref(`calls/${activeCallRef.current.id}`).update({ status: 'declined' });
    } catch (error) {
       console.error("RTDB Error: Failed to decline call.", error);
    }
  }, []);

  const handleEndCall = useCallback(async () => {
    if (!activeCallRef.current) return;
    try {
      await db.ref(`calls/${activeCallRef.current.id}`).update({ status: 'ended' });
    } catch (error) {
       console.error("RTDB Error: Failed to end call.", error);
    }
  }, []);
  
  const handleViewProfile = () => {
    if (activeChat) {
        setViewingUser(activeChat.otherParticipant);
        navigateTo('user_profile_view');
    }
  }

  const handleBlockUser = async (userToBlock: User) => {
    if (!currentUser) return;
    const displayName = currentUser.nicknames?.[userToBlock.uid] || userToBlock.name;
    if (window.confirm(`Block ${displayName}? You will no longer see their messages or chats.`)) {
        try {
            await db.ref(`users/${currentUser.uid}/blockedUsers/${userToBlock.uid}`).set(true);
            alert(`${displayName} has been blocked.`);
            // After blocking, the user should be taken out of any related context
            setActiveChat(null);
            setViewingUser(null);
            navigateTo('home', { replace: true });
        } catch (error) {
            console.error("RTDB Error: Failed to block user.", error);
            alert("Could not block user. Please try again.");
        }
    }
  };

  const handleNavigateToSettings = (title: string) => {
    setSettingsPageTitle(title);
    switch (title) {
        case 'Account':
            navigateTo('account_settings');
            break;
        case 'Notifications':
            navigateTo('notification_settings');
            break;
        case 'Appearance':
            navigateTo('appearance_settings');
            break;
        case 'Blocked Users':
            navigateTo('blocked_users');
            break;
        case 'Hidden Chats':
            navigateTo('hidden_chats');
            break;
        case 'Privacy & Security':
            navigateTo('privacy_security');
            break;
        case 'My Wallet':
            navigateTo('wallet');
            break;
        default:
            navigateTo('settings_detail');
            break;
    }
  };

  const handleViewNotifications = async () => {
      navigateTo('notification');
      if (unreadNotifCount > 0 && currentUser) {
          const updates: { [key: string]: any } = {};
          notifications.forEach(notif => {
              if (!notif.isRead) {
                  updates[`/userNotifications/${currentUser.uid}/${notif.id}/isRead`] = true;
              }
          });
          try {
            await db.ref().update(updates);
          } catch(error) {
            console.error("RTDB Error: Failed to mark notifications as read.", error);
          }
      }
  };

  const renderActiveScreen = () => {
    // These screens are mounted and unmounted as needed.
    // HomeScreen is handled separately to preserve its state.
    if (!currentUser && screen !== 'profile_creation') return <SplashScreen />;
    
    switch (screen) {
      case 'splash':
        return <SplashScreen />;
      case 'profile_creation':
        return authUser ? <ProfileCreationScreen uid={authUser.uid} onSave={handleProfileSave} /> : <SplashScreen />;
      case 'home':
        return null; // Handled by the persistent component
      case 'chat':
        return activeChat ? <ChatScreen 
                  chat={activeChat} 
                  onBack={() => { setActiveChat(null); navigateTo('home'); }} 
                  currentUser={currentUser!}
                  onStartCall={(type, user) => handleStartCall(type, user, activeChat.id)}
                  onViewProfile={handleViewProfile}
                  userCache={userCache}
                  setUserCache={setUserCache}
                  chatBackgroundImageUrl={currentUser?.chatBackgroundImageUrl}
                /> : <SplashScreen />;
      case 'profile':
        return <ProfileScreen 
                  currentUser={currentUser!} 
                  onBack={() => navigateTo('home')} 
                  onLogout={handleLogout} 
                  onNavigateToSettings={handleNavigateToSettings} 
                />;
      case 'user_profile_view':
        return viewingUser && currentUser ? <UserProfileViewScreen user={viewingUser} currentUser={currentUser} onBack={() => { setViewingUser(null); navigateTo('chat'); }} onBlockUser={handleBlockUser} /> : null;
      case 'notification':
        return <NotificationScreen 
                  currentUser={currentUser!} 
                  notifications={notifications} 
                  onBack={() => navigateTo('home')} 
                />;
      case 'account_settings':
        return <AccountSettingsScreen currentUser={currentUser!} onBack={() => navigateTo('profile')} />;
      case 'notification_settings':
        return <NotificationSettingsScreen currentUser={currentUser!} onBack={() => navigateTo('profile')} />;
      case 'appearance_settings':
        return <AppearanceSettingsScreen onBack={() => navigateTo('profile')} theme={theme} setTheme={setTheme} currentUser={currentUser!} accentColorName={accentColorName} setAccentColorName={setAccentColorName} />;
      case 'blocked_users':
        return <BlockedUsersScreen currentUser={currentUser!} onBack={() => navigateTo('profile')} />;
      case 'hidden_chats':
        return <HiddenChatsScreen currentUser={currentUser!} onBack={() => navigateTo('profile')} onSelectChat={handleSelectChat} userCache={userCache} setUserCache={setUserCache} />;
      case 'privacy_security':
        return <PrivacySecurityScreen onBack={() => navigateTo('profile')} onNavigate={handleNavigateToSettings} />;
       case 'settings_detail':
        return <SettingsDetailScreen title={settingsPageTitle} onBack={() => navigateTo('profile')} />;
       case 'wallet':
        return <WalletScreen onBack={() => navigateTo('profile')} />;
      default:
        return <SplashScreen />;
    }
  };

  return (
    <div className="w-screen h-screen bg-gray-100 dark:bg-black font-sans overflow-hidden antialiased">
      <div className="h-full w-full max-w-md mx-auto bg-white dark:bg-gray-900 shadow-2xl relative">
        <div style={{ display: screen === 'home' ? 'block' : 'none' }} className="w-full h-full">
            {currentUser && (
                <HomeScreen 
                  currentUser={currentUser} 
                  onSelectChat={handleSelectChat}
                  onSearchClick={() => setIsSearchVisible(true)}
                  onProfileClick={() => navigateTo('profile')}
                  onNotificationsClick={handleViewNotifications}
                  unreadNotifCount={unreadNotifCount}
                  userCache={userCache}
                  setUserCache={setUserCache}
                  onFriendUidsUpdate={setFriendUids}
                />
            )}
        </div>
        
        {screen !== 'home' && renderActiveScreen()}
        
        {isSearchVisible && currentUser && (
          <SearchUserModal 
            currentUser={currentUser}
            onClose={() => setIsSearchVisible(false)}
            onSelectUser={handleStartChat}
            friendUids={friendUids}
            isCreatingChatWith={isCreatingChatWith}
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