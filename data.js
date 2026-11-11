// Crochit - Instagram Videos & Real-Time Peer Data

const CROCHIT_DATA = {
  // Preloaded Trending Instagram Reels & Videos
  // Uses Instagram's official embed shortcodes
  instagramReels: [
    {
      id: "ig_1",
      shortcode: "C5nQ0q0L7f0", // Real public trending tech/aesthetic reel
      title: "Cyberpunk Setup & Ambient Coding Vibes 💻✨",
      creator: "@tech_aesthetic",
      likes: "185K",
      views: "1.2M",
      category: "Tech & Coding",
      caption: "Late night coding session with ambient lofi music #coding #developer #setup",
      permalink: "https://www.instagram.com/reel/C5nQ0q0L7f0/"
    },
    {
      id: "ig_2",
      shortcode: "C6dO2c_rw6k", // Motivational / Fitness reel
      title: "Daily Discipline & Focus Routine ⚡🔥",
      creator: "@mindset_creator",
      likes: "320K",
      views: "2.4M",
      category: "Motivation",
      caption: "Consistency over motivation every single day #mindset #grind #focus",
      permalink: "https://www.instagram.com/reel/C6dO2c_rw6k/"
    },
    {
      id: "ig_3",
      shortcode: "C7pL8s1K9u2", // Cricket / Sports thriller
      title: "Unbelievable Boundary Catch & Maximum Six 🏏",
      creator: "@cricket_superstars",
      likes: "450K",
      views: "3.8M",
      category: "Sports & Cricket",
      caption: "What a moment! Absolute masterpiece catch at the boundary #cricket #ipl",
      permalink: "https://www.instagram.com/reel/C7pL8s1K9u2/"
    },
    {
      id: "ig_4",
      shortcode: "C4xM3n2V1p8", // Comedy / Indian Relatable Reel
      title: "When Mom Sends 50 WhatsApp Good Morning Stickers 😂",
      creator: "@desi_humor",
      likes: "590K",
      views: "4.5M",
      category: "Comedy",
      caption: "Storage full ho gaya stickers se lol #relatable #familygroup #desi",
      permalink: "https://www.instagram.com/reel/C4xM3n2V1p8/"
    },
    {
      id: "ig_5",
      shortcode: "C3jK7m9L2p4", // Music & Acoustic Cover
      title: "Midnight Acoustic Guitar Chill Session 🎸🎶",
      creator: "@acoustic_tunes",
      likes: "210K",
      views: "1.6M",
      category: "Music",
      caption: "Slow acoustic melodies for peace of mind #acoustic #music #chillvibes",
      permalink: "https://www.instagram.com/reel/C3jK7m9L2p4/"
    }
  ],

  categories: [
    "All Reels", "Tech & Coding", "Comedy", "Sports & Cricket", "Motivation", "Music"
  ]
};

// Backward-compatible alias
const CREOVATE_DATA = CROCHIT_DATA;
