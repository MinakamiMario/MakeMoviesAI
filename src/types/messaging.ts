/** Messaging system types */

export type Conversation = {
  id: string;
  created_at: string;
  updated_at: string;
};

export type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
    reputation_score: number;
  } | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
    reputation_score: number;
  } | null;
};

export type InboxItem = {
  conversationId: string;
  updatedAt: string;
  lastReadAt: string;
  otherUser: {
    userId: string;
    username: string;
    avatarUrl: string | null;
    reputationScore: number;
  };
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
  unreadCount: number;
};
