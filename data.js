// Crochit - Dedicated Real-Time Messaging & Cloud Database Configuration
// Only 3 Core Features: Real-Time Chat, Voice Call, Video Call (No AI, No Status Stories)

const CROCHIT_CONFIG = {
  // Cloud Database Setup (Supabase)
  supabaseUrl: "https://bmiabyytkxutomjtejot.supabase.co", 
  supabaseAnonKey: "sb_publishable_ZzrCWGCmyq8KR_1ExkzMug_AOqYueyY"
};

const CROCHIT_DATABASE = {
  // Default Seed Account (used before custom signup or login)
  defaultUser: {
    id: "usr_crochit_001",
    username: "Alex Rivera",
    email: "alex@crochit.app",
    password: "password123",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    bio: "Available on Crochit 🚀",
    joinedDate: "November 2026"
  },

  // Initial Conversations List (Direct & Groups)
  chats: [
    {
      id: "chat_1",
      name: "Rahul Sharma",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      online: true,
      lastSeen: "Active now",
      unreadCount: 0,
      isGroup: false,
      messages: [
        {
          id: "m_1_1",
          sender: "them",
          time: "10:30 AM",
          text: "Bhai kaisa hai? Shaam ko video call pe connect karein?",
          status: "read"
        },
        {
          id: "m_1_2",
          sender: "me",
          time: "10:32 AM",
          text: "Haan bilkul! Crochit pe voice aur video calling ekdum HD aur fast hai 🔥",
          status: "read"
        }
      ]
    },
    {
      id: "chat_2",
      name: "Tech Project Tribe 🚀",
      avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
      online: true,
      lastSeen: "8 members, 4 active",
      unreadCount: 0,
      isGroup: true,
      messages: [
        {
          id: "m_2_1",
          sender: "Aman",
          time: "09:15 AM",
          text: "Hello everyone! Group chat aur calls test kar lo sabhi.",
          status: "read"
        },
        {
          id: "m_2_2",
          sender: "Priya",
          time: "09:20 AM",
          text: "Audio aur video ekdum clear aa rahi hai 👍",
          status: "read"
        }
      ]
    },
    {
      id: "chat_3",
      name: "Priya Verma",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      online: false,
      lastSeen: "Last seen today at 11:45 AM",
      unreadCount: 0,
      isGroup: false,
      messages: [
        {
          id: "m_3_1",
          sender: "them",
          time: "Yesterday",
          text: "Meeting notes review ho gaye kya?",
          status: "read"
        },
        {
          id: "m_3_2",
          sender: "me",
          time: "Yesterday",
          text: "Haan sab update kar diya hai.",
          status: "read"
        }
      ]
    },
    {
      id: "chat_4",
      name: "Kabir Mehra",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      online: true,
      lastSeen: "Active now",
      unreadCount: 0,
      isGroup: false,
      messages: [
        {
          id: "m_4_1",
          sender: "them",
          time: "Yesterday",
          text: "Jab free ho to call lagana ek zaroori discussion hai.",
          status: "read"
        }
      ]
    }
  ]
};
