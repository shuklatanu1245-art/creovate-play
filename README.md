# 💬 Crochit - End-to-End Encrypted Real-Time Chat, Voice & Video Calls

![Crochit Logo](assets/logo.png)

**Crochit** is a dedicated real-time communication platform built with modern web technologies, providing **100% Free End-to-End Encryption (E2EE)** across Chat, Voice Calls, and Video Calls.

---

## 🔒 100% Free End-to-End Encryption (E2EE) Across All Features

### 1. 💬 End-to-End Encrypted Chat
- **AES-GCM-256 Bit Encryption:** Native Web Cryptography API (`window.crypto.subtle`) encrypts all text messages, voice notes, and media before saving or sending.
- **Zero-Knowledge Security:** Only the sender and recipient possess the decryption keys. No intermediate database or server can read the message contents.
- **Safety Number Verification:** 60-digit deterministic fingerprint (arranged in 12 blocks of 5 digits) allowing users to verify encryption integrity directly in the chat.

### 2. 📞 End-to-End Encrypted Voice Calls
- **DTLS-SRTP 256-Bit Audio Streams:** Peer-to-peer audio encrypted directly in the browser's media pipeline.
- Audio visualizer, call timer, mute/unmute microphone, and speaker toggles.

### 3. 📹 End-to-End Encrypted Video Calls
- **DTLS-SRTP AES-256 Video Transmission:** Encrypted camera and microphone feed.
- Live picture-in-picture local selfie camera preview, remote feed, camera flip/toggle, and call controls.

---

## 🗄️ Cloud Database & User Management (Supabase)
- **Account Sign Up & Login:** Registered users are saved in the cloud database.
- **Cross-Device Sync:** When logging in on any device, the user's account and conversations list are restored automatically.
- **In-Place Updates:** Updates to username and password modify the existing database record in-place without generating duplicate accounts.

---

## 🚀 Running Locally
Open `index.html` directly in any web browser:
```bash
Start-Process "C:\Users\HP\.gemini\antigravity\scratch\tubechat\index.html"
```
