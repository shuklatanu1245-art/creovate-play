// Crochit - Core Database & Media Datasets
// 4 Core Sections: Home (YouTube Long Videos), Feed (Instagram Reels), Chat, Profile

const CROCHIT_DATABASE = {
  // Default Seed User Account in Database
  defaultUser: {
    id: "usr_crochit_001",
    username: "Alex Rivera",
    email: "alex@crochit.app",
    password: "password123", // Stored in database, can be updated in-place
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    bio: "Exploring tech, lofi music, and connecting on Crochit 🚀",
    joinedDate: "November 2026",
    savedReelsCount: 14,
    savedVideosCount: 28
  },

  // 1. HOME: YouTube Long Videos ONLY (10+ minutes, High Quality, 100% In-App Embeddable)
  youtubeLongVideos: [
    {
      id: "yt_1",
      title: "Building Next-Gen Full Stack Web Apps in 2026 - Masterclass (1 Hour)",
      youtubeId: "PkZNo7MFNFg", // FreeCodeCamp / Web Dev Full Course (Embeddable)
      channel: "freeCodeCamp.org",
      channelAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
      duration: "1:24:18",
      views: "1.4M",
      category: "Tech & Coding",
      thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
      description: "Complete in-depth architectural guide on building modern real-time progressive web apps, WebRTC peer connections, and serverless backends."
    },
    {
      id: "yt_2",
      title: "3 Hours of Deep Focus & Cyberpunk Lofi Hip Hop Beats [Study / Code / Chill]",
      youtubeId: "jfKfPfyJRdk", // Lofi Girl Official Stream
      channel: "Lofi Girl",
      channelAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80",
      duration: "3:40:00",
      views: "12.8M",
      category: "Music & Chill",
      thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
      description: "Calm and peaceful lofi hip hop radio. Perfect for background listening while chatting with friends on Crochit."
    },
    {
      id: "yt_3",
      title: "The Incredible Physics of Black Holes and Space-Time (Full Documentary)",
      youtubeId: "e-P5IFTqB98", // Kurzgesagt / Space Documentary
      channel: "Science Realm",
      channelAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      duration: "45:30",
      views: "3.2M",
      category: "Documentary",
      thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
      description: "An extraordinary journey through space, relativity, and the mysterious event horizons of the cosmos."
    },
    {
      id: "yt_4",
      title: "Unreal Engine 5.5 Full Showcase & Next-Gen Gaming Graphics Deep Dive",
      youtubeId: "qC5KtatMcUw", // Unreal Engine Tech Showcase
      channel: "GameVortex Studios",
      channelAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
      duration: "32:15",
      views: "980K",
      category: "Gaming",
      thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80",
      description: "A comprehensive breakdown of real-time ray tracing, nanite geometry, and high-fidelity open world physics."
    },
    {
      id: "yt_5",
      title: "How to Build Mental Discipline & High Focus: 2-Hour Podcast Masterclass",
      youtubeId: "T1e0aIq8s2c", // Huberman Lab / Podcast
      channel: "Mind & Health Hub",
      channelAvatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&auto=format&fit=crop&q=80",
      duration: "2:08:44",
      views: "2.1M",
      category: "Podcasts",
      thumbnail: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&auto=format&fit=crop&q=80",
      description: "Science-based tools for enhancing focus, motivation, and eliminating digital distractions."
    },
    {
      id: "yt_6",
      title: "Full Match Highlights & Thrilling Finishes - World Cricket Legends",
      youtubeId: "bO1fGqH1y3k", // Sports Classics
      channel: "Cricket Arena 24/7",
      channelAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      duration: "28:10",
      views: "4.5M",
      category: "Sports",
      thumbnail: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80",
      description: "Relive unforgettable final-over nail-biters, boundary catches, and historic maximums."
    }
  ],

  // 2. FEED: Instagram Reels ONLY (Vertical Videos, In-App Embeddable)
  instagramReels: [
    {
      id: "ig_reel_1",
      shortcode: "C5nQ0q0L7f0",
      title: "Cyberpunk Setup & Ambient Coding Vibes 💻✨",
      creator: "@tech_aesthetic",
      creatorAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      likes: "185K",
      views: "1.2M",
      category: "Tech & Coding",
      caption: "Late night coding session with ambient lofi music #coding #developer #setup",
      permalink: "https://www.instagram.com/reel/C5nQ0q0L7f0/"
    },
    {
      id: "ig_reel_2",
      shortcode: "C6dO2c_rw6k",
      title: "Daily Discipline & Focus Routine ⚡🔥",
      creator: "@mindset_creator",
      creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      likes: "320K",
      views: "2.4M",
      category: "Motivation",
      caption: "Consistency over motivation every single day #mindset #grind #focus",
      permalink: "https://www.instagram.com/reel/C6dO2c_rw6k/"
    },
    {
      id: "ig_reel_3",
      shortcode: "C7pL8s1K9u2",
      title: "Unbelievable Boundary Catch & Maximum Six 🏏",
      creator: "@cricket_superstars",
      creatorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      likes: "450K",
      views: "3.8M",
      category: "Sports",
      caption: "What a moment! Absolute masterpiece catch at the boundary #cricket #ipl",
      permalink: "https://www.instagram.com/reel/C7pL8s1K9u2/"
    },
    {
      id: "ig_reel_4",
      shortcode: "C4xM3n2V1p8",
      title: "When Mom Sends 50 WhatsApp Good Morning Stickers 😂",
      creator: "@desi_humor",
      creatorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
      likes: "590K",
      views: "4.5M",
      category: "Comedy",
      caption: "Storage full ho gaya stickers se lol #relatable #familygroup #desi",
      permalink: "https://www.instagram.com/reel/C4xM3n2V1p8/"
    },
    {
      id: "ig_reel_5",
      shortcode: "C3jK7m9L2p4",
      title: "Midnight Acoustic Guitar Chill Session 🎸🎶",
      creator: "@acoustic_tunes",
      creatorAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
      likes: "210K",
      views: "1.6M",
      category: "Music",
      caption: "Slow acoustic melodies for peace of mind #acoustic #music #chillvibes",
      permalink: "https://www.instagram.com/reel/C3jK7m9L2p4/"
    }
  ],

  // Categories for YouTube Home
  homeCategories: [
    "All", "Tech & Coding", "Podcasts", "Music & Chill", "Gaming", "Documentary", "Sports"
  ]
};

// Aliases
const CROCHIT_DATA = CROCHIT_DATABASE;
const CREOVATE_DATA = CROCHIT_DATABASE;
