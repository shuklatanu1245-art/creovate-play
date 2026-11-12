# 💬 Crochit - Pure Real-Time Messaging & Chat Application

![Crochit Logo](assets/logo.png)

**Crochit** is a dedicated, zero-lag, real-time messaging and chat application built with modern web technologies. Designed with an authentic WhatsApp Web dark interface, Crochit brings instant 1-on-1 chats, group conversations, status stories, voice notes, and direct P2P WebRTC messaging with real people anywhere in the world.

---

## ✨ Core Features

### 1. 💬 Pure Real-Time Messaging
- **1-on-1 & Group Chats:** Chat seamlessly with contacts or create active multi-user group discussions.
- **Read Receipts & Delivery Ticks:** WhatsApp-style double ticks (`✓✓` blue for read, grey for delivered).
- **Interactive Messaging:** Quick emoji selection, photo attachment previews, simulated voice note waveforms, and simulated smart replies.
- **Search:** Search conversations or message histories instantly.

### 2. 🌐 Direct P2P WebRTC Chat with Real People
- **PeerJS Integration:** Every Crochit session gets a unique Peer ID (e.g. `crochit-xyz123`).
- **Shareable Invite Links:** Click "Invite Friend" to copy a direct invite link (`https://.../?peer=crochit-xyz123`). When your friend opens the link, you are instantly connected end-to-end!
- **Zero-Config Multi-Tab Testing:** Click "Open 2nd Tab" to test real-time chat between two windows on the same machine using `BroadcastChannel`.

### 3. 👤 Profile Management & In-Place Database Updates
- **Single Record Integrity:** When you change your **Username** or **Password** in the Profile tab, Crochit updates the existing account in `crochit_db_users_v1` in-place by its unique user ID (`usr_crochit_001`). No duplicate or redundant user entries are created.
- **Session Persistence:** State and credentials persist automatically across page reloads.

### 4. ⭕ 24-Hour Status Stories
- **Status Updates:** Share short status stories that appear in the horizontal status bar and full status feed.
- **Story Viewer:** Fullscreen story player with auto-advancing 4-second progress bar.

### 5. ☁️ Cloud Database & Auth (Supabase Connector)
- Ready for global multi-user deployment on **Vercel**.
- Connect your free **Supabase** project (URL and Anon Key) in 1 click from the Profile tab to enable cloud-backed authentication and user profiles.

---

## 🚀 Running Locally

Open `index.html` directly in any web browser:
```bash
# Windows PowerShell
Start-Process "C:\Users\HP\.gemini\antigravity\scratch\tubechat\index.html"
```

## 📦 Deploying to Vercel

Crochit is a static, zero-dependency web app that deploys in seconds on Vercel:
1. Push code to GitHub repository: `https://github.com/shuklatanu1245-art/creovate-play`
2. Import repository on [Vercel](https://vercel.com).
3. Framework Preset: **Other** (Root directory: `./`).
4. Hit **Deploy** — your live chat app is online!
