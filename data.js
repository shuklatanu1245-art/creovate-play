// Crochit - Pure Real-Time Chat & Messaging Data
// 100% Dedicated Messenger: Direct Chats, Groups, Status Stories, and User Database

const CROCHIT_DATABASE = {
  // Default User Account
  defaultUser: {
    id: "usr_crochit_001",
    username: "Alex Rivera",
    email: "alex@crochit.app",
    password: "password123",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    bio: "Available on Crochit 🚀 | Always up for good conversations",
    joinedDate: "November 2026",
    statusMessage: "Hey there! I am using Crochit."
  },

  // Initial Conversations (1-on-1 & Groups)
  chats: [
    {
      id: "chat_1",
      name: "Rahul Sharma",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      online: true,
      lastSeen: "Online",
      unreadCount: 2,
      isGroup: false,
      messages: [
        {
          id: "m_1_1",
          sender: "them",
          time: "10:30 AM",
          text: "Bhai kaisa hai? Naya chat app kaisa lag raha hai?",
          status: "read"
        },
        {
          id: "m_1_2",
          sender: "me",
          time: "10:32 AM",
          text: "Ekdum smooth aur fast hai bhai! Pure chatting experience WhatsApp jaisa ban gaya hai 🔥",
          status: "read"
        },
        {
          id: "m_1_3",
          sender: "them",
          time: "10:35 AM",
          text: "Sahi me yaar, ab koi faltu cheez nahi hai. Seedha real-time chatting!",
          status: "delivered"
        },
        {
          id: "m_1_4",
          sender: "them",
          time: "10:36 AM",
          text: "Shaam ko code review ke liye connect karein?",
          status: "delivered"
        }
      ]
    },
    {
      id: "chat_2",
      name: "Coders & Tech Tribe 🚀",
      avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
      online: true,
      lastSeen: "14 members, 6 online",
      unreadCount: 4,
      isGroup: true,
      messages: [
        {
          id: "m_2_1",
          sender: "Aman",
          senderAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
          time: "09:15 AM",
          text: "Morning devs! Crochit ka WebRTC peer messaging test kiya sabne?",
          status: "read"
        },
        {
          id: "m_2_2",
          sender: "Priya",
          senderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
          time: "09:20 AM",
          text: "Haan! Direct end-to-end connect ho raha hai without latency.",
          status: "read"
        },
        {
          id: "m_2_3",
          sender: "Aman",
          time: "09:25 AM",
          text: "Aur Vercel pe deploy hone ke baad sabhi users aapas me chat kar sakte hain.",
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
          text: "Hey! Project documentation complete ho gaya kya?",
          status: "read"
        },
        {
          id: "m_3_2",
          sender: "me",
          time: "Yesterday",
          text: "Haan almost done hai, thodi der me share karta hoon.",
          status: "read"
        }
      ]
    },
    {
      id: "chat_4",
      name: "College Friends Gang 🎉",
      avatar: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&auto=format&fit=crop&q=80",
      online: true,
      lastSeen: "8 members",
      unreadCount: 1,
      isGroup: true,
      messages: [
        {
          id: "m_4_1",
          sender: "Kabir",
          time: "11:10 AM",
          text: "Weekend ka kya plan hai sabka? Meetup karein?",
          status: "read"
        }
      ]
    }
  ],

  // 24-Hour Status Stories
  statuses: [
    {
      id: "st_me",
      userName: "My Status",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      isMe: true,
      time: "Tap to add status update",
      hasUnseen: false,
      textStatus: "Living my best life coding ⚡"
    },
    {
      id: "st_1",
      userName: "Rahul Sharma",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      isMe: false,
      time: "25 minutes ago",
      hasUnseen: true,
      textStatus: "Weekend road trip begins! 🚗💨"
    },
    {
      id: "st_2",
      userName: "Priya Verma",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      isMe: false,
      time: "2 hours ago",
      hasUnseen: true,
      textStatus: "Coffee + Good books = Perfect afternoon ☕📖"
    },
    {
      id: "st_3",
      userName: "Aman Gupta",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      isMe: false,
      time: "5 hours ago",
      hasUnseen: false,
      textStatus: "New multi-monitor setup ready! 🖥️✨"
    }
  ]
};

// Aliases
const CROCHIT_DATA = CROCHIT_DATABASE;
