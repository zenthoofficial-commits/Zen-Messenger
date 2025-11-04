import React, { useState, useRef } from 'react';
import { User, Notification } from '../types';
import { ArrowLeft, Bell, Trash2, MessageSquare, UserPlus } from 'lucide-react';
import { db } from '../firebase';
import { formatDistanceToNow } from 'date-fns';

interface NotificationScreenProps {
  currentUser: User;
  notifications: Notification[];
  onBack: () => void;
}

const NOTIFICATION_ICONS = {
    new_message: MessageSquare,
    new_contact: UserPlus,
    system: Bell,
};

const NotificationScreen: React.FC<NotificationScreenProps> = ({ currentUser, notifications, onBack }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
        await db.ref(`userNotifications/${currentUser.uid}`).remove();
    }
  };

  const handleDelete = async (notificationId: string) => {
    await db.ref(`userNotifications/${currentUser.uid}/${notificationId}`).remove();
    setDeletingId(null);
  };

  const handlePressStart = (notificationId: string) => {
      longPressTimer.current = window.setTimeout(() => {
          setDeletingId(notificationId);
      }, 500);
  };

  const handlePressEnd = () => {
      if(longPressTimer.current) {
          clearTimeout(longPressTimer.current);
      }
  };


  return (
    <div className="w-full h-full flex flex-col bg-base-tan dark:bg-gray-900">
      <header className="p-3 flex items-center justify-between bg-secondary-cream/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-text-primary/80 dark:text-gray-300 hover:text-text-primary dark:hover:text-white p-1">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-text-primary dark:text-gray-100">Notifications</h1>
        </div>
        {notifications.length > 0 && (
            <button onClick={handleClearAll} className="text-sm font-semibold text-accent-brand hover:text-accent-brand/80">
                Clear All
            </button>
        )}
      </header>
      
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {notifications.length > 0 ? (
            <div className="p-2 space-y-2">
                {notifications.map(notif => {
                    const Icon = NOTIFICATION_ICONS[notif.type] || Bell;
                    return (
                        <div 
                            key={notif.id} 
                            className={`relative p-3 rounded-xl flex items-start gap-4 transition-colors ${!notif.isRead ? 'bg-accent-brand/10 dark:bg-accent-brand/20' : 'bg-secondary-cream dark:bg-gray-800'}`}
                            onTouchStart={() => handlePressStart(notif.id)}
                            onTouchEnd={handlePressEnd}
                            onMouseDown={() => handlePressStart(notif.id)}
                            onMouseUp={handlePressEnd}
                            onMouseLeave={handlePressEnd}
                        >
                            <div className={`relative w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full mt-1 ${notif.type === 'new_contact' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-brand/20 text-accent-brand'}`}>
                                <Icon size={20} />
                                {!notif.isRead && <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-brand border-2 ${!notif.isRead ? 'border-accent-brand/10 dark:border-accent-brand/20' : 'border-secondary-cream dark:border-gray-800'}`}></div>}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-text-primary dark:text-gray-100">{notif.title}</h3>
                                <p className="text-text-primary/80 dark:text-gray-300 text-sm mt-0.5">{notif.body}</p>
                                <p className="text-xs text-text-primary/60 dark:text-gray-400 mt-1">
                                    {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                                </p>
                            </div>
                            {deletingId === notif.id && (
                                 <button 
                                    onClick={() => handleDelete(notif.id)}
                                    className="absolute inset-0 bg-red-500/90 text-white flex items-center justify-center rounded-xl text-lg font-bold"
                                 >
                                    <Trash2 size={24} className="mr-2"/> Delete
                                 </button>
                            )}
                        </div>
                    )
                })}
            </div>
        ) : (
             <div className="p-8 text-center text-text-primary/60 dark:text-gray-400 flex flex-col items-center justify-center h-full">
                <Bell size={48} className="mb-4 text-text-primary/30 dark:text-gray-600"/>
                <p className="font-semibold text-lg">No notifications yet</p>
                <p className="mt-1">You're all caught up!</p>
            </div>
        )}
      </main>
    </div>
  );
};

export default NotificationScreen;