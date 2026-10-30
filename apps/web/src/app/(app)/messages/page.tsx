'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Send, Image as ImageIcon, Smile, MoreVertical,
  Check, CheckCheck, Phone, Video, ShieldCheck, Flame, ArrowLeft,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

interface Conversation {
  id: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    isVerified: boolean;
    isOnline: boolean;
  };
  lastMessage: string;
  unreadCount: number;
  messages: Message[];
}

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_1',
    user: {
      id: 'usr_sarah',
      username: 'sarah_lens',
      displayName: 'Sarah Jenkins',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      isVerified: true,
      isOnline: true,
    },
    lastMessage: 'Let me know what you think of that new grading preset!',
    unreadCount: 1,
    messages: [
      {
        id: 'm1',
        senderId: 'usr_sarah',
        text: 'Hey! Loved your recent post from Mount Rainier 🏔️',
        timestamp: '10:14 AM',
        isRead: true,
      },
      {
        id: 'm2',
        senderId: 'me',
        text: 'Thanks Sarah! The fog rolled in right at golden hour, got super lucky.',
        timestamp: '10:18 AM',
        isRead: true,
      },
      {
        id: 'm3',
        senderId: 'usr_sarah',
        text: 'Let me know what you think of that new grading preset!',
        timestamp: '10:22 AM',
        isRead: false,
      },
    ],
  },
  {
    id: 'conv_2',
    user: {
      id: 'usr_alex',
      username: 'alex_creatives',
      displayName: 'Alex Rivers',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
      isVerified: false,
      isOnline: false,
    },
    lastMessage: 'Working on a new generative shader pack for Flint ✨',
    unreadCount: 0,
    messages: [
      {
        id: 'm4',
        senderId: 'usr_alex',
        text: 'Working on a new generative shader pack for Flint ✨',
        timestamp: 'Yesterday',
        isRead: true,
      },
    ],
  },
  {
    id: 'conv_3',
    user: {
      id: 'usr_flint',
      username: 'flint_official',
      displayName: 'Flint Official',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop',
      isVerified: true,
      isOnline: true,
    },
    lastMessage: 'Welcome to the Flint Creator Community! 🔥',
    unreadCount: 0,
    messages: [
      {
        id: 'm5',
        senderId: 'usr_flint',
        text: 'Welcome to the Flint Creator Community! 🔥 Reach out anytime if you need tips or creator tools.',
        timestamp: 'Oct 28',
        isRead: true,
      },
    ],
  },
];

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string>('conv_1');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputText, setInputText] = useState('');

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? conversations[0];

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeConv) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      senderId: 'me',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConv.id) {
          return {
            ...c,
            lastMessage: newMsg.text,
            messages: [...c.messages, newMsg],
          };
        }
        return c;
      })
    );

    setInputText('');
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] md:h-[calc(100vh-4rem)] max-w-6xl mx-auto md:border border-border md:rounded-2xl overflow-hidden bg-background/60 backdrop-blur-xl shadow-2xl my-2 md:my-4">
      {/* Sidebar: Conversations List */}
      <div
        className={cn(
          'w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-card/40 flex-shrink-0',
          mobileChatOpen ? 'hidden md:flex' : 'flex'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-display spark-text">Messages</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-spark-500/10 text-spark-400 font-medium">
              Direct
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-secondary/50 rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-spark-500/50"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredConversations.map((c) => {
            const isActive = c.id === activeConv?.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveConvId(c.id);
                  setMobileChatOpen(true);
                }}
                className={cn(
                  'w-full p-4 flex items-center gap-3.5 text-left transition-colors hover:bg-secondary/40',
                  isActive && 'bg-secondary/70 md:border-l-4 md:border-spark-500'
                )}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="w-12 h-12 ring-2 ring-border/50">
                    <AvatarImage src={c.user.avatarUrl} alt={c.user.displayName} />
                    <AvatarFallback>{c.user.displayName[0]}</AvatarFallback>
                  </Avatar>
                  {c.user.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-background" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-sm truncate text-foreground">
                        {c.user.displayName}
                      </span>
                      {c.user.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-spark-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.lastMessage}
                  </p>
                </div>

                {c.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-spark-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm shadow-spark-500/30">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeConv ? (
        <div
          className={cn(
            'flex-1 flex flex-col bg-background/40 min-w-0',
            !mobileChatOpen ? 'hidden md:flex' : 'flex'
          )}
        >
          {/* Chat Header */}
          <div className="p-3.5 sm:p-4 border-b border-border flex items-center justify-between bg-card/30">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                onClick={() => setMobileChatOpen(false)}
                className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Avatar className="w-9 h-9 sm:w-10 sm:h-10 ring-1 ring-border/60 flex-shrink-0">
                <AvatarImage src={activeConv.user.avatarUrl} alt={activeConv.user.displayName} />
                <AvatarFallback>{activeConv.user.displayName[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {activeConv.user.displayName}
                  </span>
                  {activeConv.user.isVerified && (
                    <ShieldCheck className="w-3.5 h-3.5 text-spark-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  @{activeConv.user.username} • {activeConv.user.isOnline ? 'Online now' : 'Offline'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors">
                <Phone className="w-4 h-4" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors">
                <Video className="w-4 h-4" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            <AnimatePresence initial={false}>
              {activeConv.messages.map((m) => {
                const isMe = m.senderId === 'me';
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                        isMe
                          ? 'spark-gradient text-white rounded-br-xs'
                          : 'bg-secondary/70 text-foreground border border-border/50 rounded-bl-xs'
                      )}
                    >
                      {m.text}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 px-1">
                      <span>{m.timestamp}</span>
                      {isMe && (
                        m.isRead ? (
                          <CheckCheck className="w-3.5 h-3.5 text-spark-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-muted-foreground" />
                        )
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Message Input Box */}
          <form
            onSubmit={handleSendMessage}
            className="p-3.5 border-t border-border flex items-center gap-2 bg-card/20"
          >
            <button
              type="button"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-xl transition-colors"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-xl transition-colors"
            >
              <Smile className="w-5 h-5" />
            </button>

            <input
              type="text"
              placeholder={`Message ${activeConv.user.displayName}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-secondary/60 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-spark-500/50"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 spark-gradient text-white rounded-xl disabled:opacity-40 hover:shadow-lg hover:shadow-spark-500/25 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Flame className="w-12 h-12 text-spark-500/40 mb-3" />
          <h2 className="text-lg font-semibold text-foreground">Select a conversation</h2>
          <p className="text-sm mt-1">Choose a chat from the left to start messaging</p>
        </div>
      )}
    </div>
  );
}

