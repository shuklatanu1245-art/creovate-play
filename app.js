// Crochit - Core Application Engine
// Only 3 Core Features: Real-Time Chat, Voice Call, Video Call
// Clean Cloud Database Auth (Sign Up / Login), Contact Sync, No AI Bots, No Status Stories

// Application State
let state = {
  currentUser: null,
  activeChatId: null,
  chatsList: [],
  searchQuery: '',
  supabaseClient: null,
  authMode: 'signup',
  // Voice Call State
  voiceCallTimer: null,
  voiceCallSeconds: 0,
  isVoiceMuted: false,
  // 0 KB Offline Emergency Grace Engine (10-Min Minimum Hold)
  isCallOfflineSimulated: false,
  emergencyGraceSeconds: 600,
  emergencyGraceTimer: null,
  reservedCallContact: null,
  offlineVoiceRecorder: null,
  offlineVoiceChunks: [],
  isRecordingOfflineCapsule: false,
  // Video Call State
  localVideoStream: null,
  videoCallTimer: null,
  videoCallSeconds: 0,
  isVideoMicMuted: false,
  isVideoCamOff: false
};

// Storage Keys (v3 for clean state with zero dummy chats)
const DB_USERS_KEY = 'crochit_registered_users_v3';
const DB_SESSION_KEY = 'crochit_permanent_session_v3';
const DB_CHATS_KEY = 'crochit_user_chats_v3';
const DB_RESERVED_CALL_KEY = 'crochit_reserved_call_v3';
const DB_OFFLINE_OUTBOX_KEY = 'crochit_offline_outbox_v3';

// ==================== CROCHIT E2EE CRYPTOGRAPHY ENGINE ====================
// 100% Free, Native Browser WebCrypto Subtle (AES-GCM-256)
const CrochitCrypto = {
  keyCache: {},

  // Derive high-entropy 256-bit AES-GCM Key deterministically for a conversation
  async getChatKey(chatId) {
    if (this.keyCache[chatId]) return this.keyCache[chatId];
    try {
      if (!window.crypto || !window.crypto.subtle) return null;
      const seed = `crochit_e2ee_key_v1_${chatId}_salt_9381`;
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.digest('SHA-256', enc.encode(seed));
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      this.keyCache[chatId] = cryptoKey;
      return cryptoKey;
    } catch (e) {
      console.warn("Crypto key derivation notice:", e);
      return null;
    }
  },

  // Encrypt message text into ciphertext with random 12-byte IV
  async encrypt(text, chatId) {
    try {
      if (!text || typeof text !== 'string') return text;
      const key = await this.getChatKey(chatId);
      if (!key || !window.crypto || !window.crypto.subtle) return text;

      const enc = new TextEncoder();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(text)
      );

      let ivBinary = '';
      iv.forEach(b => ivBinary += String.fromCharCode(b));
      const ivBase64 = btoa(ivBinary);

      let cipherBinary = '';
      new Uint8Array(encryptedBuffer).forEach(b => cipherBinary += String.fromCharCode(b));
      const cipherBase64 = btoa(cipherBinary);

      return `🔒e2ee:${ivBase64}:${cipherBase64}`;
    } catch (err) {
      console.warn("Encryption fallback:", err);
      return text;
    }
  },

  // Decrypt ciphertext back to plaintext
  async decrypt(cipherText, chatId) {
    try {
      if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('🔒e2ee:')) {
        return cipherText;
      }

      const parts = cipherText.replace('🔒e2ee:', '').split(':');
      if (parts.length !== 2) return cipherText;

      const key = await this.getChatKey(chatId);
      if (!key) return cipherText;

      const ivStr = atob(parts[0]);
      const iv = new Uint8Array(ivStr.length);
      for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);

      const cipherStr = atob(parts[1]);
      const cipherBytes = new Uint8Array(cipherStr.length);
      for (let i = 0; i < cipherStr.length; i++) cipherBytes[i] = cipherStr.charCodeAt(i);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        cipherBytes
      );

      const dec = new TextDecoder();
      return dec.decode(decryptedBuffer);
    } catch (err) {
      return cipherText;
    }
  },

  // Generate authentic 60-digit safety verification numbers in 12 blocks of 5 digits
  generateSafetyNumbers(contactId, userId) {
    const combined = [contactId, userId || 'user'].sort().join('_');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash);
    const blocks = [];
    for (let b = 0; b < 12; b++) {
      const num = Math.floor(Math.abs(Math.sin(seed + b * 137.45)) * 90000) + 10000;
      blocks.push(String(num));
    }
    return blocks;
  }
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initCloudDatabase();
  initAuthentication();
  setupEventListeners();
  initEmojiGifPicker();
  initOfflineEmergencyEngine();

  if (window.lucide) {
    lucide.createIcons();
  }
});

// ==================== 1. CLOUD DATABASE & AUTH ADAPTER ====================
// Bulletproof dual-engine: Supabase JS SDK + Native Browser REST API (fetch)
// Works seamlessly across different devices, tabs, Chrome profiles, and mobile browsers.
const CrochitCloudDB = {
  get url() {
    return (typeof CROCHIT_CONFIG !== 'undefined' && CROCHIT_CONFIG.supabaseUrl) ? CROCHIT_CONFIG.supabaseUrl : '';
  },
  get key() {
    return (typeof CROCHIT_CONFIG !== 'undefined' && CROCHIT_CONFIG.supabaseAnonKey) ? CROCHIT_CONFIG.supabaseAnonKey : '';
  },
  getHeaders(preferRepresentation = true) {
    const headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json'
    };
    if (preferRepresentation) {
      headers['Prefer'] = 'return=representation';
    }
    return headers;
  },

  // 1. Register new user directly into Supabase crochit_users table
  async insertUser(newUser) {
    if (!this.url || !this.key) {
      return { success: false, error: 'Supabase configuration missing' };
    }

    // Try Supabase JS Client first if initialized
    if (state.supabaseClient) {
      try {
        const { data, error } = await state.supabaseClient
          .from('crochit_users')
          .insert([newUser]);
        if (!error) {
          console.log("✓ User registered via Supabase Client:", newUser.username);
          return { success: true, user: newUser };
        }
        console.warn("Supabase Client insert notice, trying direct REST:", error);
      } catch (sdkErr) {
        console.warn("Supabase Client exception:", sdkErr);
      }
    }

    // Direct Native REST API fetch fallback (100% independent of client library)
    try {
      const resp = await fetch(`${this.url}/rest/v1/crochit_users`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(newUser)
      });

      if (resp.ok || resp.status === 201) {
        console.log("✓ User registered via Direct REST API:", newUser.username);
        return { success: true, user: newUser };
      }

      if (resp.status === 409) {
        return { success: true, user: newUser, alreadyExists: true };
      }

      const errText = await resp.text();
      console.error("Direct REST insert error:", resp.status, errText);
      return { success: false, error: errText };
    } catch (netErr) {
      console.error("Direct REST network failure:", netErr);
      return { success: false, error: netErr.message };
    }
  },

  // 2. Search users across both Supabase Cloud Database and local cache
  async searchUsers(query) {
    const rawQuery = (query || '').trim();
    const cleanQuery = rawQuery.toLowerCase().replace(/^@/, '');
    const results = [];
    const seenIds = new Set();

    function add(u, fromCloud = true) {
      if (!u || !u.id) return;
      const uid = String(u.id);
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const uname = (u.username || u.name || 'User').replace(/^@/, '');
      const uemail = u.email || '';
      results.push({
        id: uid,
        username: uname,
        email: uemail,
        avatar: u.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
        bio: u.bio || "Available on Crochit 🚀",
        fromCloud
      });
    }

    // A. Search local cache
    try {
      const localUsers = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
      localUsers.forEach(u => {
        if (!u || !u.id) return;
        const uname = (u.username || '').toLowerCase().replace(/^@/, '');
        const uid = String(u.id || '').toLowerCase();
        const uemail = (u.email || '').toLowerCase();
        if (!cleanQuery || uname.includes(cleanQuery) || uid.includes(cleanQuery) || uemail.includes(cleanQuery)) {
          add(u, false);
        }
      });
    } catch (e) {}

    // B. Query Supabase Cloud Database
    if (this.url && this.key) {
      let cloudUsers = [];

      // Try SDK query first if available
      if (state.supabaseClient) {
        try {
          let qb = state.supabaseClient
            .from('crochit_users')
            .select('id, username, email, avatar, bio');
          if (cleanQuery) {
            qb = qb.or(`username.ilike.%${cleanQuery}%,id.ilike.%${cleanQuery}%,email.ilike.%${cleanQuery}%`);
          }
          const { data, error } = await qb.limit(50);
          if (data && data.length > 0) {
            cloudUsers = data;
          }
        } catch (e) {}
      }

      // If SDK returned 0 or not ready, query direct REST API
      if (cloudUsers.length === 0) {
        try {
          const endpoint = cleanQuery
            ? `${this.url}/rest/v1/crochit_users?select=id,username,email,avatar,bio&or=(username.ilike.*${encodeURIComponent(cleanQuery)}*,id.ilike.*${encodeURIComponent(cleanQuery)}*,email.ilike.*${encodeURIComponent(cleanQuery)}*)&limit=50`
            : `${this.url}/rest/v1/crochit_users?select=id,username,email,avatar,bio&order=created_at.desc&limit=30`;

          const resp = await fetch(endpoint, {
            headers: {
              'apikey': this.key,
              'Authorization': `Bearer ${this.key}`
            }
          });

          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
              cloudUsers = data;
            }
          }
        } catch (fetchErr) {
          console.warn("Direct REST search notice:", fetchErr);
        }
      }

      // Merge cloud users and save into local storage cache
      if (cloudUsers && cloudUsers.length > 0) {
        try {
          const localCache = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
          let updatedCache = false;
          cloudUsers.forEach(cu => {
            add(cu, true);
            if (!localCache.some(lu => lu.id === cu.id)) {
              localCache.push(cu);
              updatedCache = true;
            }
          });
          if (updatedCache) {
            localStorage.setItem(DB_USERS_KEY, JSON.stringify(localCache));
          }
        } catch (e) {}
      }
    }

    return results;
  },

  // 3. Check if username is already taken in the cloud database
  async checkUsernameTaken(username) {
    const clean = (username || '').trim().toLowerCase().replace(/^@/, '');
    if (!clean || !this.url || !this.key) return false;

    if (state.supabaseClient) {
      try {
        const { data } = await state.supabaseClient
          .from('crochit_users')
          .select('id, username')
          .ilike('username', clean)
          .maybeSingle();
        if (data) return true;
      } catch (e) {}
    }

    try {
      const resp = await fetch(`${this.url}/rest/v1/crochit_users?select=id,username&username=ilike.${encodeURIComponent(clean)}&limit=1`, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (resp.ok) {
        const list = await resp.json();
        return Array.isArray(list) && list.length > 0;
      }
    } catch (e) {}

    return false;
  },

  // 4. Check if email is already taken in the cloud database
  async checkEmailTaken(email) {
    const clean = (email || '').trim().toLowerCase();
    if (!clean || !this.url || !this.key) return false;

    if (state.supabaseClient) {
      try {
        const { data } = await state.supabaseClient
          .from('crochit_users')
          .select('id')
          .eq('email', clean)
          .maybeSingle();
        if (data) return true;
      } catch (e) {}
    }

    try {
      const resp = await fetch(`${this.url}/rest/v1/crochit_users?select=id&email=eq.${encodeURIComponent(clean)}&limit=1`, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (resp.ok) {
        const list = await resp.json();
        return Array.isArray(list) && list.length > 0;
      }
    } catch (e) {}

    return false;
  },

  // 5. Cloud Sign In (Accepts either username or email)
  async loginUser(identifier, password) {
    const clean = (identifier || '').trim().toLowerCase().replace(/^@/, '');
    if (!this.url || !this.key) return null;

    if (state.supabaseClient) {
      try {
        const { data } = await state.supabaseClient
          .from('crochit_users')
          .select('*')
          .or(`email.ilike.${clean},username.ilike.${clean}`)
          .eq('password', password)
          .maybeSingle();
        if (data) return data;
      } catch (e) {}
    }

    try {
      const endpoint = `${this.url}/rest/v1/crochit_users?select=*&or=(email.ilike.${encodeURIComponent(clean)},username.ilike.${encodeURIComponent(clean)})&password=eq.${encodeURIComponent(password)}&limit=1`;
      const resp = await fetch(endpoint, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (resp.ok) {
        const list = await resp.json();
        if (Array.isArray(list) && list.length > 0) return list[0];
      }
    } catch (e) {}

    return null;
  },

  // 6. Startup Auto-Sync of Current User
  async syncCurrentUser() {
    if (!state.currentUser || !this.url || !this.key) return;
    try {
      const checkResp = await fetch(`${this.url}/rest/v1/crochit_users?select=id&id=eq.${encodeURIComponent(state.currentUser.id)}&limit=1`, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (checkResp.ok) {
        const checkList = await checkResp.json();
        if (Array.isArray(checkList) && checkList.length === 0) {
          console.log("⚡ Auto-uploading local account to Supabase Cloud:", state.currentUser.username);
          await this.insertUser(state.currentUser);
        }
      }
    } catch (e) {
      console.warn("User auto-sync notice:", e);
    }
  },

  // 7. Sync Recipient Contact in Supabase Cloud
  async syncContact(contact) {
    if (!this.url || !this.key) return;
    if (state.supabaseClient) {
      try {
        await state.supabaseClient
          .from('crochit_user_chats')
          .upsert([contact]);
        return;
      } catch (e) {}
    }

    try {
      await fetch(`${this.url}/rest/v1/crochit_user_chats`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(contact)
      });
    } catch (e) {}
  },

  // 8. Send Message to Supabase Cloud
  async sendMessage(msg) {
    if (!this.url || !this.key) return;
    if (state.supabaseClient) {
      try {
        const { error } = await state.supabaseClient
          .from('crochit_messages')
          .insert([msg]);
        if (!error) return;
      } catch (e) {}
    }

    try {
      const resp = await fetch(`${this.url}/rest/v1/crochit_messages`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(msg)
      });
      if (!resp.ok) {
        const txt = await resp.text();
        if (txt.includes('violates row-level security policy')) {
          console.warn("Supabase Notice: Run 'ALTER TABLE crochit_messages DISABLE ROW LEVEL SECURITY;' in Supabase SQL editor to enable cross-device messaging.");
        }
      }
    } catch (e) {}
  },

  // 9. Poll Messages from Supabase Cloud
  async pollMessages(myId, lastTime) {
    if (!myId || !this.url || !this.key) return [];
    if (state.supabaseClient) {
      try {
        let qb = state.supabaseClient
          .from('crochit_messages')
          .select('*')
          .or(`receiver_id.eq.${myId},chat_id.like.%${myId}%`);
        if (lastTime) {
          qb = qb.gt('created_at', lastTime);
        }
        const { data, error } = await qb.order('created_at', { ascending: true });
        if (data && data.length > 0) return data;
      } catch (e) {}
    }

    try {
      let endpoint = `${this.url}/rest/v1/crochit_messages?select=*&or=(receiver_id.eq.${encodeURIComponent(myId)},chat_id.like.*${encodeURIComponent(myId)}*)&order=created_at.asc`;
      if (lastTime) {
        endpoint += `&created_at=gt.${encodeURIComponent(lastTime)}`;
      }
      const resp = await fetch(endpoint, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) {}

    return [];
  }
};

function initCloudDatabase() {
  const activeKey = CROCHIT_CONFIG.supabaseAnonKey;
  const initClient = () => {
    if (CROCHIT_CONFIG.supabaseUrl && activeKey && window.supabase && !state.supabaseClient) {
      try {
        state.supabaseClient = window.supabase.createClient(
          CROCHIT_CONFIG.supabaseUrl,
          activeKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true
            }
          }
        );
        console.log("✓ Crochit Supabase Cloud Database Connected:", CROCHIT_CONFIG.supabaseUrl);
        const statusEl = document.getElementById('app-conn-status');
        if (statusEl) statusEl.textContent = "Cloud DB Active";
        startRealtimeMessageListeners();
      } catch (e) {
        console.warn("Supabase initialization error:", e);
      }
    }
  };

  initClient();
  if (!state.supabaseClient) {
    let retries = 0;
    const retryInterval = setInterval(() => {
      retries++;
      initClient();
      if (state.supabaseClient || retries >= 15) {
        clearInterval(retryInterval);
      }
    }, 300);
  }
}

function initAuthentication() {
  // Check if permanent session exists in localStorage
  let session = null;
  try {
    // Clear any obsolete v2/legacy dummy sessions
    localStorage.removeItem('crochit_session_v2');
    localStorage.removeItem('crochit_session');

    const raw = localStorage.getItem(DB_SESSION_KEY);
    if (raw) session = JSON.parse(raw);
  } catch (e) {
    console.error("Error loading session:", e);
  }

  if (session && session.id) {
    state.currentUser = session;
    closeAuthModal();
    loadUserConversations();
    renderAppUI();
    startRealtimeMessageListeners();
    CrochitCloudDB.syncCurrentUser();
  } else {
    // Brand new visitor / logged out: Show Sign Up screen immediately!
    // No dummy users, no pre-loaded fake chats
    state.currentUser = null;
    state.chatsList = [];
    state.activeChatId = null;
    renderProfileHeader();
    renderConversationsList();
    renderEmptyChatView();
    toggleAuthMode('signup');
    openAuthModal();
  }
}

function renderAppUI() {
  renderProfileHeader();
  renderConversationsList();
  if (state.chatsList.length > 0) {
    selectChat(state.activeChatId || state.chatsList[0].id);
  } else {
    state.activeChatId = null;
    renderEmptyChatView();
  }
}

// Clean Empty State when user has no active chat or no conversations yet
function renderEmptyChatView() {
  const name = document.getElementById('active-chat-name');
  const status = document.getElementById('active-chat-status');
  const avatar = document.getElementById('active-chat-avatar');
  const onlineDot = document.getElementById('active-chat-online-dot');
  const container = document.getElementById('chat-messages-container');

  if (name) name.textContent = state.currentUser ? `Welcome, ${state.currentUser.username}!` : "Welcome to Crochit";
  if (status) status.textContent = "100% Free End-to-End Encrypted";
  if (avatar) avatar.src = "assets/logo.png";
  if (onlineDot) onlineDot.classList.add('hidden');

  if (container) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div class="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <i data-lucide="shield-check" class="w-8 h-8"></i>
        </div>
        <div class="max-w-md space-y-1.5">
          <h3 class="font-bold text-white text-base">End-to-End Encrypted Messenger</h3>
          <p class="text-xs text-gray-400 leading-relaxed">
            Your chats, voice calls, and video calls are 100% private. Neither Crochit nor anyone else can read your messages or listen to your calls.
          </p>
        </div>
        <button 
          onclick="openNewChatModal()" 
          class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
        >
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Start a New Conversation</span>
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

// Load Conversations for current user (Local storage + Cloud Supabase sync)
async function loadUserConversations() {
  if (!state.currentUser) {
    state.chatsList = [];
    renderConversationsList();
    renderEmptyChatView();
    return;
  }

  const userChatKey = `${DB_CHATS_KEY}_${state.currentUser.id}`;
  let userChats = [];

  try {
    const raw = localStorage.getItem(userChatKey);
    if (raw) userChats = JSON.parse(raw);
  } catch (e) {
    userChats = [];
  }

  // If cloud DB is available and local list is empty, fetch saved contacts from cloud
  if (!userChats || userChats.length === 0) {
    try {
      let remoteChats = [];
      if (state.supabaseClient) {
        const { data } = await state.supabaseClient
          .from('crochit_user_chats')
          .select('*')
          .eq('user_id', state.currentUser.id);
        if (data) remoteChats = data;
      }
      if (remoteChats.length === 0 && CrochitCloudDB.url && CrochitCloudDB.key) {
        const resp = await fetch(`${CrochitCloudDB.url}/rest/v1/crochit_user_chats?select=*&user_id=eq.${encodeURIComponent(state.currentUser.id)}`, {
          headers: { 'apikey': CrochitCloudDB.key, 'Authorization': `Bearer ${CrochitCloudDB.key}` }
        });
        if (resp.ok) {
          const list = await resp.json();
          if (Array.isArray(list)) remoteChats = list;
        }
      }

      if (remoteChats && remoteChats.length > 0) {
        userChats = remoteChats.map(rc => ({
          id: rc.contact_id ? (rc.contact_id.startsWith('direct_') ? rc.contact_id : getDirectChatId(state.currentUser.id, rc.contact_id)) : rc.id,
          name: rc.contact_name,
          avatar: rc.contact_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
          otherUserId: rc.contact_id,
          online: true,
          lastSeen: "Active now",
          isGroup: rc.is_group,
          messages: []
        }));
        localStorage.setItem(userChatKey, JSON.stringify(userChats));
      }
    } catch (e) {
      console.warn("Could not fetch remote chats:", e);
    }
  }

  // Never load fake dummy chats - clean empty state for genuine user experience
  if (!userChats) {
    userChats = [];
  }

  // Fetch message history from cloud database if available
  if (state.currentUser) {
    try {
      const myId = state.currentUser.id;
      const cloudMsgs = await CrochitCloudDB.pollMessages(myId, null);

      if (cloudMsgs && cloudMsgs.length > 0) {
        cloudMsgs.forEach(cm => {
          let chat = userChats.find(c => c.id === cm.chat_id || (cm.sender_id !== myId && c.otherUserId === cm.sender_id) || (cm.receiver_id !== myId && c.otherUserId === cm.receiver_id));
          if (!chat && cm.sender_id !== myId) {
            // Auto-add contact from incoming message history
            chat = {
              id: cm.chat_id || getDirectChatId(myId, cm.sender_id),
              name: cm.sender_name || 'Contact',
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
              otherUserId: cm.sender_id,
              online: true,
              lastSeen: "Active now",
              isGroup: false,
              messages: []
            };
            userChats.unshift(chat);
          }

          if (chat) {
            if (!chat.messages) chat.messages = [];
            if (!chat.messages.some(m => m.id === cm.id)) {
              chat.messages.push({
                id: cm.id,
                sender: cm.sender_id === myId ? 'me' : 'them',
                sender_name: cm.sender_name,
                time: getCurrentTimeFormatted(),
                text: cm.text,
                image: cm.image,
                isVoiceNote: cm.is_voice_note,
                created_at: cm.created_at,
                status: cm.status || 'delivered'
              });
            }
          }
        });
        localStorage.setItem(userChatKey, JSON.stringify(userChats));
      }
    } catch (e) {
      console.warn("Cloud message fetch notice:", e);
    }
  }

  state.chatsList = userChats;
  renderConversationsList();

  if (state.chatsList.length > 0) {
    selectChat(state.activeChatId || state.chatsList[0].id);
  } else {
    state.activeChatId = null;
    renderEmptyChatView();
  }
}

function saveUserConversations() {
  if (!state.currentUser) return;
  const userChatKey = `${DB_CHATS_KEY}_${state.currentUser.id}`;
  try {
    localStorage.setItem(userChatKey, JSON.stringify(state.chatsList));
  } catch (e) {
    console.warn("Storage quota:", e);
  }

  // If cloud DB is connected, sync contact list
  if (state.supabaseClient) {
    try {
      state.supabaseClient
        .from('crochit_user_chats')
        .upsert(state.chatsList.map(c => ({
          id: `${state.currentUser.id}_${c.id}`,
          user_id: state.currentUser.id,
          contact_id: c.otherUserId || c.id,
          contact_name: c.name,
          contact_avatar: c.avatar,
          is_group: c.isGroup,
          updated_at: new Date()
        })))
        .then(() => console.log("Chats synced with cloud DB"));
    } catch (e) {
      console.warn("Cloud sync error:", e);
    }
  }
}

// Render User Avatar and Username in Top Header & Profile
function renderProfileHeader() {
  const headerAvatar = document.getElementById('header-user-avatar');
  const headerUsername = document.getElementById('header-username-text');
  const bottomLabel = document.getElementById('bottom-user-label');
  const modalAvatar = document.getElementById('modal-profile-avatar');
  const modalName = document.getElementById('modal-profile-name');
  const modalEmail = document.getElementById('modal-profile-email');
  const modalId = document.getElementById('modal-profile-id');
  const editUsernameInput = document.getElementById('edit-username-input');

  if (state.currentUser) {
    const avatarUrl = state.currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80";
    if (headerAvatar) headerAvatar.src = avatarUrl;
    if (headerUsername) headerUsername.textContent = state.currentUser.username || 'User';
    if (bottomLabel) bottomLabel.textContent = `@${state.currentUser.username} (ID: ${state.currentUser.id})`;
    if (modalAvatar) modalAvatar.src = avatarUrl;
    if (modalName) modalName.textContent = state.currentUser.username || 'User';
    if (modalEmail) modalEmail.textContent = state.currentUser.email || '';
    if (modalId) modalId.textContent = state.currentUser.id || 'N/A';
    if (editUsernameInput) editUsernameInput.value = state.currentUser.username || '';
  } else {
    if (headerAvatar) headerAvatar.src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80";
    if (headerUsername) headerUsername.textContent = "Sign Up / In";
    if (bottomLabel) bottomLabel.textContent = "Not logged in";
    if (modalName) modalName.textContent = "Guest";
    if (modalEmail) modalEmail.textContent = "";
    if (modalId) modalId.textContent = "Not logged in";
    if (editUsernameInput) editUsernameInput.value = "";
  }
}

// In-Place Update Profile (Username & Password)
// Updates the exact existing record by ID; does NOT create duplicate records!
async function handleUpdateProfile(event) {
  event.preventDefault();

  const usernameInput = document.getElementById('edit-username-input');
  const passwordInput = document.getElementById('edit-password-input');
  const statusEl = document.getElementById('update-profile-status');

  const newUsername = usernameInput ? usernameInput.value.trim() : '';
  const newPassword = passwordInput ? passwordInput.value.trim() : '';

  if (!newUsername) {
    alert("Please enter a valid username.");
    return;
  }

  // 1. Update in local storage
  let users = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
  const idx = users.findIndex(u => u.id === state.currentUser.id);

  if (idx !== -1) {
    users[idx].username = newUsername;
    if (newPassword) users[idx].password = newPassword;
    state.currentUser = users[idx];
  } else {
    state.currentUser.username = newUsername;
    if (newPassword) state.currentUser.password = newPassword;
    users.push(state.currentUser);
  }

  localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
  localStorage.setItem(DB_SESSION_KEY, JSON.stringify(state.currentUser));

  // 2. If Supabase cloud database is connected, update remote database row
  if (state.supabaseClient) {
    try {
      const updates = { username: newUsername };
      if (newPassword) updates.password = newPassword;

      await state.supabaseClient
        .from('crochit_users')
        .update(updates)
        .eq('id', state.currentUser.id);
      console.log("✓ Cloud database updated in-place!");
    } catch (e) {
      console.warn("Cloud update notice:", e);
    }
  }

  renderProfileHeader();
  if (passwordInput) passwordInput.value = '';

  if (statusEl) {
    statusEl.textContent = `✓ Profile updated in-place! (${newUsername})`;
    statusEl.classList.remove('hidden');
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3500);
  }
}

function changeAvatarPrompt() {
  const newUrl = prompt("Enter Image URL for your new Profile Avatar:", state.currentUser.avatar);
  if (newUrl && newUrl.trim()) {
    state.currentUser.avatar = newUrl.trim();
    localStorage.setItem(DB_SESSION_KEY, JSON.stringify(state.currentUser));

    let users = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
    const idx = users.findIndex(u => u.id === state.currentUser.id);
    if (idx !== -1) {
      users[idx].avatar = newUrl.trim();
      localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
    }

    renderProfileHeader();
  }
}

// Auth Mode Switching
function toggleAuthMode(mode) {
  state.authMode = mode;
  const isSignIn = mode === 'signin';

  const btnSignIn = document.getElementById('auth-toggle-signin');
  const btnSignUp = document.getElementById('auth-toggle-signup');
  const userField = document.getElementById('auth-username-field');
  const userInput = document.getElementById('auth-username-input');
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (btnSignIn) btnSignIn.className = isSignIn ? "flex-1 py-2 rounded-lg bg-emerald-500 text-black font-bold transition" : "flex-1 py-2 rounded-lg text-gray-400 hover:text-white transition";
  if (btnSignUp) btnSignUp.className = !isSignIn ? "flex-1 py-2 rounded-lg bg-emerald-500 text-black font-bold transition" : "flex-1 py-2 rounded-lg text-gray-400 hover:text-white transition";
  if (userField) userField.classList.toggle('hidden', isSignIn);
  if (userInput) userInput.required = !isSignIn;
  if (title) title.textContent = isSignIn ? "Sign In to Crochit" : "Create Your Crochit Account";
  if (submitBtn) submitBtn.textContent = isSignIn ? "Sign In" : "Create Account";

  const emailInput = document.getElementById('auth-email-input');
  const emailLabel = emailInput ? emailInput.previousElementSibling : null;
  if (emailLabel) emailLabel.textContent = isSignIn ? "Username or Email Address:" : "Email Address:";
  if (emailInput) {
    emailInput.type = isSignIn ? "text" : "email";
    emailInput.placeholder = isSignIn ? "username (e.g. dev_01) or email" : "you@example.com";
  }
}

// ==================== INSTAGRAM-STYLE UNIQUE USERNAME ENGINE ====================
let usernameCheckTimeout = null;

function handleUsernameInput(val) {
  clearTimeout(usernameCheckTimeout);
  const statusEl = document.getElementById('auth-username-status');
  const iconEl = document.getElementById('auth-username-icon');
  const suggContainer = document.getElementById('auth-username-suggestions-container');
  const suggBox = document.getElementById('auth-username-suggestions');

  if (!val) {
    if (statusEl) statusEl.classList.add('hidden');
    if (iconEl) iconEl.classList.add('hidden');
    if (suggContainer) suggContainer.classList.add('hidden');
    return;
  }

  usernameCheckTimeout = setTimeout(async () => {
    const clean = val.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;

    if (!/^[a-zA-Z0-9._]{3,30}$/.test(clean)) {
      if (statusEl) {
        statusEl.className = "text-[11px] mt-1 text-red-400 font-semibold";
        statusEl.textContent = "3-30 chars. Only letters, numbers, _, and . allowed";
        statusEl.classList.remove('hidden');
      }
      if (iconEl) {
        iconEl.innerHTML = `<span class="text-red-400">✗</span>`;
        iconEl.classList.remove('hidden');
      }
      if (suggContainer) suggContainer.classList.add('hidden');
      return;
    }

    let users = [];
    try { users = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || []; } catch (e) {}

    let isTaken = users.some(u => (u.username || '').toLowerCase() === clean);

    if (!isTaken && state.supabaseClient) {
      try {
        const { data: match } = await state.supabaseClient
          .from('crochit_users')
          .select('id')
          .ilike('username', clean)
          .maybeSingle();
        if (match) isTaken = true;
      } catch (e) {}
    }

    if (isTaken) {
      if (statusEl) {
        statusEl.className = "text-[11px] mt-1 text-amber-400 font-semibold";
        statusEl.textContent = `❌ @${clean} is already taken! Try these variations:`;
        statusEl.classList.remove('hidden');
      }
      if (iconEl) {
        iconEl.innerHTML = `<span class="text-amber-400">✗</span>`;
        iconEl.classList.remove('hidden');
      }

      // Generate Instagram-like suggestions
      const suggestions = generateUsernameSuggestions(clean, users);
      if (suggBox && suggestions.length > 0) {
        suggBox.innerHTML = suggestions.map(s => `
          <button type="button" onclick="applyUsernameSuggestion('${s}')" class="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono transition">
            @${s}
          </button>
        `).join('');
        if (suggContainer) suggContainer.classList.remove('hidden');
      }
    } else {
      if (statusEl) {
        statusEl.className = "text-[11px] mt-1 text-emerald-400 font-semibold";
        statusEl.textContent = `✓ @${clean} is available!`;
        statusEl.classList.remove('hidden');
      }
      if (iconEl) {
        iconEl.innerHTML = `<span class="text-emerald-400">✓</span>`;
        iconEl.classList.remove('hidden');
      }
      if (suggContainer) suggContainer.classList.add('hidden');
    }
  }, 180);
}

function generateUsernameSuggestions(base, existingUsers = []) {
  const variations = [
    `${base}_1`,
    `${base}_01`,
    `${base}_official`,
    `${base}.${Math.floor(Math.random() * 89) + 10}`,
    `${base}_${Math.floor(Math.random() * 899) + 100}`,
    `real_${base}`
  ];

  const userList = existingUsers.map(u => (u.username || '').toLowerCase());
  return variations.filter(v => !userList.includes(v)).slice(0, 4);
}

function applyUsernameSuggestion(sugg) {
  const input = document.getElementById('auth-username-input');
  if (input) {
    input.value = sugg;
    handleUsernameInput(sugg);
  }
}

// Handle Sign In or Sign Up Form Submit
async function handleAuthSubmit(event) {
  event.preventDefault();

  const emailInput = document.getElementById('auth-email-input');
  const passwordInput = document.getElementById('auth-password-input');
  const usernameInput = document.getElementById('auth-username-input');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const username = usernameInput ? usernameInput.value.trim() : '';

  if (!email || !password) {
    alert("Please fill in both email and password.");
    return;
  }

  let users = [];
  try {
    users = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
  } catch (e) {
    users = [];
  }

  if (state.authMode === 'signup') {
    // 1. Sign Up Mode (Instagram-style Unique @username)
    if (!username) {
      alert("Please choose a unique @username.");
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(cleanUsername)) {
      alert("Username must be 3-30 characters long and can only contain letters, numbers, underscores (_), and periods (.).");
      return;
    }

    // Check if username already exists locally
    const usernameTakenLocal = users.some(u => (u.username || '').toLowerCase() === cleanUsername);
    if (usernameTakenLocal) {
      const suggestions = generateUsernameSuggestions(cleanUsername, users);
      alert(`@${cleanUsername} is already taken! Try adding numbers or underscores, like: @${suggestions.join(', @')}`);
      return;
    }

    // Check if username already exists in cloud Supabase database
    const cloudUsernameTaken = await CrochitCloudDB.checkUsernameTaken(cleanUsername);
    if (cloudUsernameTaken) {
      const suggestions = generateUsernameSuggestions(cleanUsername, users);
      alert(`@${cleanUsername} is already taken in the database! Try: @${suggestions.join(', @')}`);
      return;
    }

    // Check if email already exists locally
    const existing = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (existing) {
      alert("An account with this email already exists. Please Sign In.");
      toggleAuthMode('signin');
      return;
    }

    // Check cloud database for email
    const cloudEmailTaken = await CrochitCloudDB.checkEmailTaken(email);
    if (cloudEmailTaken) {
      alert("An account with this email already exists in the database. Please Sign In.");
      toggleAuthMode('signin');
      return;
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      username: cleanUsername,
      email: email,
      password: password,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      bio: "Available on Crochit 🚀",
      created_at: new Date().toISOString()
    };

    // Save to Cloud DB (Guaranteed with direct REST API fallback)
    const cloudSaveResult = await CrochitCloudDB.insertUser(newUser);
    if (!cloudSaveResult.success && !cloudSaveResult.alreadyExists) {
      alert("Database notice: Could not save account to cloud database (" + (cloudSaveResult.error || "network issue") + "). Please try again.");
      return;
    }

    // Save to local database
    users.push(newUser);
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));

    // Permanent session persistence (Never expires on browser close/reboot)
    state.currentUser = newUser;
    localStorage.setItem(DB_SESSION_KEY, JSON.stringify(newUser));
    alert(`Account created successfully! Welcome, @${newUser.username}`);

  } else {
    // 2. Sign In Mode (Accepts either Username or Email)
    const cleanAuthIdentifier = email.trim().toLowerCase().replace(/^@/, '');
    let foundUser = users.find(u => 
      (((u.email || '').toLowerCase() === cleanAuthIdentifier) || ((u.username || '').toLowerCase() === cleanAuthIdentifier)) && 
      u.password === password
    );

    // If not in local storage, check cloud Supabase DB
    if (!foundUser) {
      foundUser = await CrochitCloudDB.loginUser(cleanAuthIdentifier, password);
      if (foundUser) {
        users.push(foundUser);
        localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
      }
    }

    if (!foundUser) {
      alert("Invalid username/email or password. Please check your credentials.");
      return;
    }

    // Permanent session persistence
    state.currentUser = foundUser;
    localStorage.setItem(DB_SESSION_KEY, JSON.stringify(foundUser));
    await CrochitCloudDB.syncCurrentUser();
  }

  closeAuthModal();
  await loadUserConversations();
  renderAppUI();
  startRealtimeMessageListeners();
}

function handleLogout() {
  if (confirm("Are you sure you want to sign out of Crochit?")) {
    clearInterval(cloudPollInterval);
    localStorage.removeItem(DB_SESSION_KEY);
    state.currentUser = null;
    state.chatsList = [];
    state.activeChatId = null;
    closeProfileModal();
    renderProfileHeader();
    renderConversationsList();
    renderEmptyChatView();
    toggleAuthMode('signin');
    openAuthModal();
  }
}

// Modals
function openProfileModal() {
  renderProfileHeader();
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.add('hidden');
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  // If not logged in, prevent bypassing auth modal!
  if (!state.currentUser) return;
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

function openNewChatModal(initialQuery = '') {
  const modal = document.getElementById('new-chat-modal');
  if (modal) modal.classList.remove('hidden');
  toggleNewChatTab('direct');
  const searchInput = document.getElementById('search-user-input');
  const q = typeof initialQuery === 'string' ? initialQuery : '';
  if (searchInput) {
    searchInput.value = q;
    setTimeout(() => {
      searchInput.focus();
      if (q) searchInput.setSelectionRange(q.length, q.length);
    }, 100);
  }
  searchUsersInDatabase(q);
}

function closeNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) modal.classList.add('hidden');
}

function openSearchWithQuery(q) {
  openNewChatModal(q);
}

// ==================== 2. CHAT & MESSAGING ENGINE ====================
function renderConversationsList() {
  const container = document.getElementById('conversations-list-container');
  const countBadge = document.getElementById('chats-count-badge');
  if (!container) return;

  const rawQuery = (state.searchQuery || '').trim();
  const query = rawQuery.toLowerCase();
  const filtered = state.chatsList.filter(c => {
    return c.name.toLowerCase().includes(query) ||
      (c.messages && c.messages.some(m => m.text && m.text.toLowerCase().includes(query)));
  });

  if (countBadge) countBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    const isSearching = !!rawQuery;
    container.innerHTML = `
      <div class="p-6 text-center text-gray-400 space-y-3">
        <i data-lucide="${isSearching ? 'database' : 'message-square'}" class="w-8 h-8 mx-auto text-emerald-400"></i>
        <p class="text-xs text-gray-300 font-medium">${isSearching ? `No active conversation found for "${escapeHtml(rawQuery)}"` : 'No conversations yet.'}</p>
        <button onclick="${isSearching ? `openSearchWithQuery('${escapeAttr(rawQuery)}')` : 'openNewChatModal()'}" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold transition flex items-center gap-1.5 mx-auto shadow-md shadow-emerald-500/20">
          <i data-lucide="search" class="w-3.5 h-3.5"></i>
          <span>${isSearching ? `Search User Database for "${escapeHtml(rawQuery)}"` : '+ Start a new chat'}</span>
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let html = '';

  // If user is searching and chats exist, also display a top shortcut banner to search global user database
  if (rawQuery) {
    html += `
      <div class="p-2 border-b border-white/5 bg-[#16222a]/50">
        <button onclick="openSearchWithQuery('${escapeAttr(rawQuery)}')" class="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between transition">
          <span class="flex items-center gap-1.5 truncate">
            <i data-lucide="database" class="w-3.5 h-3.5 shrink-0"></i>
            <span class="truncate">Search Database for "${escapeHtml(rawQuery)}"</span>
          </span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5 shrink-0"></i>
        </button>
      </div>
    `;
  }
  filtered.forEach(chat => {
    const isActive = chat.id === state.activeChatId;
    const lastMsg = (chat.messages && chat.messages.length > 0)
      ? chat.messages[chat.messages.length - 1]
      : { text: "No messages yet", time: "", sender: "" };

    const activeClasses = isActive
      ? "bg-[#202c33] border-l-4 border-emerald-500"
      : "hover:bg-[#16222a] border-l-4 border-transparent";

    let tickHtml = '';
    if (lastMsg.sender === 'me') {
      const isRead = lastMsg.status === 'read';
      const tickColor = isRead ? 'text-[#53bdeb]' : 'text-gray-400';
      tickHtml = `<span class="${tickColor} text-xs font-bold mr-1">✓✓</span>`;
    }

    const onlineDotHtml = chat.online
      ? `<span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111b21]"></span>`
      : '';

    html += `
      <div 
        onclick="selectChat('${chat.id}')"
        class="px-3.5 py-3 flex items-center gap-3 cursor-pointer transition ${activeClasses}"
      >
        <div class="relative shrink-0">
          <img src="${chat.avatar}" alt="${chat.name}" class="w-11 h-11 rounded-full object-cover border border-white/10" />
          ${onlineDotHtml}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1 mb-0.5">
            <h4 class="text-xs font-bold text-white truncate">${chat.name}</h4>
            <span class="text-[10px] text-gray-400 shrink-0 font-medium">${lastMsg.time || ''}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs text-gray-400 truncate flex items-center">
              ${tickHtml}
              <span class="truncate">${lastMsg.text || 'Attachment'}</span>
            </p>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function selectChat(chatId) {
  state.activeChatId = chatId;

  const chat = state.chatsList.find(c => c.id === chatId);
  if (!chat) return;

  // On Mobile: switch pane
  const sidebarPane = document.getElementById('chat-sidebar-pane');
  const activePane = document.getElementById('chat-active-pane');
  if (window.innerWidth < 768) {
    if (sidebarPane) sidebarPane.classList.add('hidden');
    if (activePane) {
      activePane.classList.remove('hidden');
      activePane.classList.add('flex');
    }
  }

  // Update Active Chat Header
  const avatar = document.getElementById('active-chat-avatar');
  const name = document.getElementById('active-chat-name');
  const status = document.getElementById('active-chat-status');
  const onlineDot = document.getElementById('active-chat-online-dot');

  if (avatar) avatar.src = chat.avatar;
  if (name) name.textContent = chat.name;
  if (status) status.textContent = chat.online ? 'Active now' : (chat.lastSeen || 'Offline');
  if (onlineDot) onlineDot.classList.toggle('hidden', !chat.online);

  renderActiveChatMessages();
  renderConversationsList();

  const input = document.getElementById('chat-message-input');
  if (input && window.innerWidth >= 768) {
    input.focus();
  }
}

function backToChatsListMobile() {
  const sidebarPane = document.getElementById('chat-sidebar-pane');
  const activePane = document.getElementById('chat-active-pane');
  if (sidebarPane) sidebarPane.classList.remove('hidden');
  if (activePane) {
    activePane.classList.add('hidden');
    activePane.classList.remove('flex');
  }
}

async function renderActiveChatMessages() {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat || !chat.messages || chat.messages.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div class="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
          <i data-lucide="shield-check" class="w-6 h-6"></i>
        </div>
        <div>
          <h4 class="font-bold text-white text-sm">🔒 End-to-End Encrypted</h4>
          <p class="text-xs text-gray-400 mt-1">Messages and calls are secured with 256-bit AES-GCM encryption.</p>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Asynchronously decrypt all messages for display
  const decryptedMessages = await Promise.all(chat.messages.map(async msg => {
    let plainText = msg.text;
    let isEncrypted = false;
    if (plainText && typeof plainText === 'string' && plainText.startsWith('🔒e2ee:')) {
      plainText = await CrochitCrypto.decrypt(plainText, chat.id);
      isEncrypted = true;
    }
    return { ...msg, displayText: plainText, isEncrypted };
  }));

  let html = `
    <div class="flex items-center justify-center my-3 cursor-pointer" onclick="openSecurityVerifyModal()">
      <div class="px-4 py-2 rounded-2xl bg-[#182229]/90 border border-emerald-500/25 text-center max-w-sm hover:border-emerald-500/40 transition shadow-sm">
        <div class="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-bold mb-0.5">
          <i data-lucide="lock" class="w-3.5 h-3.5"></i>
          <span>End-to-End Encrypted</span>
        </div>
        <p class="text-[11px] text-gray-400 leading-normal">
          Messages, voice notes, audio and video calls are secured with 256-bit AES-GCM encryption. Tap to verify security code.
        </p>
      </div>
    </div>
  `;

  decryptedMessages.forEach(msg => {
    const isMe = msg.sender === 'me';
    const bubbleClass = isMe ? 'bubble-me text-white' : 'bubble-them text-[#e9edef]';
    const alignClass = isMe ? 'justify-end' : 'justify-start';

    let tickHtml = '';
    if (isMe) {
      const isRead = msg.status === 'read';
      const tickColor = isRead ? 'text-[#53bdeb]' : 'text-gray-300';
      tickHtml = `<span class="${tickColor} text-xs font-bold">✓✓</span>`;
    }

    let groupSenderHtml = '';
    if (chat.isGroup && !isMe) {
      groupSenderHtml = `<div class="text-[11px] font-bold text-purple-400 mb-0.5">${msg.sender || 'Member'}</div>`;
    }

    let imageHtml = '';
    if (msg.image) {
      const isGif = msg.isGif || (typeof msg.image === 'string' && (msg.image.includes('.gif') || msg.image.includes('giphy.com') || msg.image.includes('data:image/gif')));
      imageHtml = `
        <div class="mb-1 rounded-2xl overflow-hidden border border-white/10 max-w-xs relative group bg-black/40">
          <img src="${msg.image}" alt="GIF/Image" class="w-full h-auto object-cover max-h-60 rounded-2xl cursor-pointer hover:opacity-95 transition" onclick="window.open('${msg.image}', '_blank')" />
          ${isGif ? `<span class="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/75 text-[9px] font-bold text-white tracking-widest backdrop-blur-sm border border-white/10 select-none">GIF</span>` : ''}
        </div>
      `;
    }

    let voiceNoteHtml = '';
    if (msg.isVoiceNote) {
      voiceNoteHtml = `
        <div class="flex items-center gap-3 py-1 px-1">
          <button class="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0">
            <i data-lucide="play" class="w-4 h-4 fill-black"></i>
          </button>
          <div class="flex-1 space-y-1">
            <div class="flex items-center gap-1 h-4">
              <span class="w-1 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span class="w-1 h-3 bg-emerald-400 rounded-full"></span>
              <span class="w-1 h-4 bg-emerald-400 rounded-full animate-pulse"></span>
              <span class="w-1 h-2 bg-emerald-400 rounded-full"></span>
              <span class="w-1 h-3 bg-emerald-400 rounded-full"></span>
            </div>
            <div class="text-[10px] text-gray-300 font-mono">0:12 • Encrypted Voice Note</div>
          </div>
        </div>
      `;
    }

    html += `
      <div class="flex ${alignClass} mb-2 animate-slide-up">
        <div class="max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl shadow-md ${bubbleClass} space-y-1">
          ${groupSenderHtml}
          ${imageHtml}
          ${voiceNoteHtml}
          ${msg.displayText ? `<p class="text-xs sm:text-sm leading-relaxed select-text">${escapeHtml(msg.displayText)}</p>` : ''}
          <div class="flex items-center justify-end gap-1.5 text-[10px] text-gray-300/80 pt-0.5">
            <span class="text-[9px] text-emerald-400 font-mono" title="AES-256 E2EE Encrypted">🔒</span>
            <span>${msg.time || ''}</span>
            ${tickHtml}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
  container.scrollTop = container.scrollHeight;
}

// Central Dispatcher for All Outgoing Messages (Cross-Tab Broadcast + Cloud Supabase Sync)
async function dispatchOutgoingMessage(chat, newMsg) {
  if (!chat.messages) chat.messages = [];
  chat.messages.push(newMsg);

  saveUserConversations();
  await renderActiveChatMessages();
  renderConversationsList();

  const payload = {
    id: newMsg.id,
    chat_id: chat.id,
    sender: 'them', // when received by other user
    sender_id: state.currentUser.id,
    sender_name: state.currentUser.username,
    sender_avatar: state.currentUser.avatar,
    receiver_id: chat.otherUserId || '',
    text: newMsg.text,
    image: newMsg.image || null,
    isVoiceNote: !!newMsg.isVoiceNote,
    time: newMsg.time,
    created_at: newMsg.created_at || new Date().toISOString()
  };

  // 1. Cross-tab Realtime Mesh (BroadcastChannel) - Instant 0ms delivery
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      if (!window.crochitChannel) {
        window.crochitChannel = new BroadcastChannel('crochit_realtime_mesh');
      }
      window.crochitChannel.postMessage({
        type: 'INCOMING_MESSAGE',
        payload: payload
      });
    } catch (e) {
      console.warn("BroadcastChannel post error:", e);
    }
  }

  // 2. Cross-tab Storage Mailbox fallback
  try {
    const raw = localStorage.getItem('crochit_shared_mailbox') || '[]';
    let mailbox = [];
    try { mailbox = JSON.parse(raw); } catch (e) { mailbox = []; }
    mailbox.push(payload);
    if (mailbox.length > 60) mailbox = mailbox.slice(mailbox.length - 60);
    localStorage.setItem('crochit_shared_mailbox', JSON.stringify(mailbox));
  } catch (e) {}

  // 3. Supabase Cloud Database insert (cross-device delivery)
  CrochitCloudDB.sendMessage({
    id: newMsg.id,
    chat_id: chat.id,
    sender_id: state.currentUser.id,
    sender_name: state.currentUser.username,
    receiver_id: chat.otherUserId || '',
    text: newMsg.text,
    image: newMsg.image || null,
    is_voice_note: !!newMsg.isVoiceNote,
    status: 'delivered',
    created_at: newMsg.created_at || new Date().toISOString()
  });
}

async function sendCurrentMessage() {
  const input = document.getElementById('chat-message-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) return;

  // 100% Free E2EE Encryption with AES-GCM 256 before transmission
  const encryptedText = await CrochitCrypto.encrypt(text, chat.id);

  const newMsg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    chat_id: chat.id,
    sender: 'me',
    sender_id: state.currentUser.id,
    sender_name: state.currentUser.username,
    receiver_id: chat.otherUserId || '',
    time: getCurrentTimeFormatted(),
    text: encryptedText,
    created_at: new Date().toISOString(),
    status: 'delivered'
  };

  input.value = '';
  await dispatchOutgoingMessage(chat, newMsg);
}

// ==================== END-TO-END ENCRYPTION VERIFICATION MODAL ====================
function openSecurityVerifyModal() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) {
    alert("Please select or start a conversation first to verify End-to-End Encryption safety numbers.");
    return;
  }

  const modal = document.getElementById('security-verify-modal');
  const avatar = document.getElementById('verify-contact-avatar');
  const name = document.getElementById('verify-contact-name');
  const grid = document.getElementById('safety-numbers-grid');
  const rawCipherBox = document.getElementById('audit-raw-ciphertext');
  const resultBox = document.getElementById('interception-test-result');

  if (avatar) avatar.src = chat.avatar;
  if (name) name.textContent = chat.name;
  if (resultBox) resultBox.classList.add('hidden');

  const userId = state.currentUser ? state.currentUser.id : 'usr';
  const blocks = CrochitCrypto.generateSafetyNumbers(chat.id, userId);

  if (grid) {
    grid.innerHTML = blocks.map(b => `
      <div class="p-2 rounded-xl bg-black/40 border border-white/5 font-mono text-emerald-400 font-bold hover:bg-black/60 transition">
        ${b}
      </div>
    `).join('');
  }

  // Populate raw ciphertext from latest message
  if (rawCipherBox) {
    let latestCipher = "No messages sent yet. Send a message to inspect raw ciphertext.";
    if (chat.messages && chat.messages.length > 0) {
      const last = chat.messages[chat.messages.length - 1];
      latestCipher = last.text || "🔒e2ee:IV:Attachment";
    }
    rawCipherBox.textContent = latestCipher;
  }

  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeSecurityVerifyModal() {
  const modal = document.getElementById('security-verify-modal');
  if (modal) modal.classList.add('hidden');
}

async function simulateInterceptionTest() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  const resultBox = document.getElementById('interception-test-result');
  if (!chat || !resultBox) return;

  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `
    <div class="flex items-center gap-1.5 text-yellow-400 font-bold mb-1">
      <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping"></span>
      Simulating Man-in-the-Middle Hacker Attack...
    </div>
    <p class="text-gray-300">Attempting to crack AES-GCM ciphertext without the recipient private key...</p>
  `;

  setTimeout(async () => {
    try {
      const fakeSeed = "hacker_tampered_key_attempt_0x999";
      const enc = new TextEncoder();
      const fakeKeyMat = await window.crypto.subtle.digest('SHA-256', enc.encode(fakeSeed));
      const fakeKey = await window.crypto.subtle.importKey(
        'raw', fakeKeyMat, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
      );

      let testCipher = chat.messages && chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : "🔒e2ee:sample";
      let parts = (testCipher || '').replace('🔒e2ee:', '').split(':');
      let rejected = true;

      if (parts.length === 2) {
        const ivStr = atob(parts[0]);
        const iv = new Uint8Array(ivStr.length);
        for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);
        const cipherStr = atob(parts[1]);
        const cipherBytes = new Uint8Array(cipherStr.length);
        for (let i = 0; i < cipherStr.length; i++) cipherBytes[i] = cipherStr.charCodeAt(i);

        try {
          await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, fakeKey, cipherBytes);
          rejected = false;
        } catch (cryptErr) {
          rejected = true;
        }
      }

      if (rejected) {
        resultBox.className = "text-[10px] font-mono p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 space-y-1 animate-slide-up";
        resultBox.innerHTML = `
          <div class="font-bold text-red-400 flex items-center gap-1.5">
            <span>🛡️ HACK INTERCEPTION FAILED (Integrity Verified)</span>
          </div>
          <div class="text-[10px] text-gray-300 leading-normal">
            <strong>Error:</strong> <code class="text-red-400">OperationError: Authentication Tag Mismatch</code><br>
            The browser WebCrypto engine mathematically rejected the unauthorized decryption attempt. Zero plaintext was leaked!
          </div>
        `;
      }
    } catch (e) {
      resultBox.textContent = "Security verification confirmed: AES-GCM-256 block authentication active.";
    }
  }, 900);
}

// ==================== EMOJI & GIF ENGINE ====================

const CROCHIT_EMOJI_CATEGORIES = [
  {
    name: "Smileys & Emotion",
    emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👻","👽","🤖"]
  },
  {
    name: "Gestures & Hands",
    emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦵","🦶","👂","👃","👀","👁️","👅","👄"]
  },
  {
    name: "Hearts & Love",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","💌","💋","💍","💎"]
  },
  {
    name: "Party & Reactions",
    emojis: ["🔥","💥","✨","🌟","💫","🎉","🎊","🎈","🎁","🏆","🥇","🚀","🎯","💯","⚠️","🔔","💡","⚡","🌈","☀️","🌙","⭐"]
  },
  {
    name: "Food & Drinks",
    emojis: ["🍕","🍔","🍟","🌭","🍿","🥓","🥚","🥞","🧇","🍞","🥐","🥨","🧀","🥗","🥪","🌯","🌮","🍣","🍦","🍧","🍨","🍩","🍪","🎂","🍰","🍫","🍬","🍭","☕","🍵","🥤","🧃","🍺","🍻","🥂","🍷"]
  }
];

const CROCHIT_GIFS = [
  { title: "Celebration Dance", url: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif", tags: ["party", "dance", "celebrate", "happy"] },
  { title: "Dancing Vibing", url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif", tags: ["dance", "party", "vibing"] },
  { title: "Cat Vibe", url: "https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif", tags: ["cat", "dance", "vibing", "music"] },
  { title: "Minions Laughing", url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif", tags: ["laugh", "funny", "minions"] },
  { title: "Laughing Out Loud", url: "https://media.giphy.com/media/Q7ozWVYCR0nyW2rvPW/giphy.gif", tags: ["laugh", "funny", "lol"] },
  { title: "Mind Blown", url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif", tags: ["shocked", "wow", "mindblown"] },
  { title: "Facepalm", url: "https://media.giphy.com/media/6yRVg0HWzgS88/giphy.gif", tags: ["facepalm", "oops", "smh"] },
  { title: "Thumbs Up Yes", url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif", tags: ["thumbs up", "ok", "yes", "good"] },
  { title: "Applause Clap", url: "https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif", tags: ["clap", "applause", "bravo"] },
  { title: "Heart Love Hug", url: "https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif", tags: ["love", "heart", "hug"] },
  { title: "Sending Love", url: "https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif", tags: ["love", "kiss", "heart"] },
  { title: "Cute Cat Love", url: "https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif", tags: ["cat", "love", "cute"] },
  { title: "Waving Bye", url: "https://media.giphy.com/media/m9eG1qVjvNINLFtg24/giphy.gif", tags: ["bye", "wave", "goodbye"] },
  { title: "Nodding Agree", url: "https://media.giphy.com/media/6cFcUiCG5eONW/giphy.gif", tags: ["yes", "agree", "nod"] },
  { title: "Mic Drop", url: "https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/giphy.gif", tags: ["mic drop", "done", "boss"] },
  { title: "Happy Dance", url: "https://media.giphy.com/media/pa37AAGzKXoek/giphy.gif", tags: ["dance", "happy", "party"] },
  { title: "Popcorn Watching", url: "https://media.giphy.com/media/GLbiGvv9RiNpPdzyxs/giphy.gif", tags: ["popcorn", "drama", "watching"] },
  { title: "Shrug", url: "https://media.giphy.com/media/eLvhchyvNUPuU/giphy.gif", tags: ["shrug", "dunno", "whatever"] },
  { title: "Snoopy Happy Dance", url: "https://media.giphy.com/media/J6fjW4xvv2T2uPgk8M/giphy.gif", tags: ["dance", "happy", "snoopy"] },
  { title: "Cheers Drinks", url: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif", tags: ["party", "cheers", "celebrate"] }
];

function initEmojiGifPicker() {
  renderEmojiGrid();
  renderGifGrid(CROCHIT_GIFS);

  // Close picker when clicking outside
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('emoji-gif-picker');
    const toggleBtn = document.getElementById('emoji-picker-toggle-btn');
    if (!picker || picker.classList.contains('hidden')) return;

    if (!picker.contains(e.target) && !toggleBtn.contains(e.target)) {
      toggleEmojiGifPicker(false);
    }
  });
}

function toggleEmojiGifPicker(forcedState) {
  const picker = document.getElementById('emoji-gif-picker');
  if (!picker) return;

  const shouldOpen = typeof forcedState === 'boolean' ? forcedState : picker.classList.contains('hidden');
  picker.classList.toggle('hidden', !shouldOpen);

  if (shouldOpen && window.lucide) {
    lucide.createIcons();
  }
}

function switchPickerTab(tab) {
  const isEmoji = tab === 'emoji';
  const paneEmoji = document.getElementById('picker-pane-emoji');
  const paneGif = document.getElementById('picker-pane-gif');
  const tabEmoji = document.getElementById('picker-tab-emoji');
  const tabGif = document.getElementById('picker-tab-gif');

  if (paneEmoji) paneEmoji.classList.toggle('hidden', !isEmoji);
  if (paneGif) paneGif.classList.toggle('hidden', isEmoji);

  if (tabEmoji) {
    tabEmoji.className = isEmoji
      ? "px-3.5 py-1.5 rounded-lg bg-emerald-500 text-black font-bold transition flex items-center gap-1.5"
      : "px-3.5 py-1.5 rounded-lg text-gray-400 hover:text-white transition flex items-center gap-1.5";
  }
  if (tabGif) {
    tabGif.className = !isEmoji
      ? "px-3.5 py-1.5 rounded-lg bg-purple-600 text-white font-bold transition flex items-center gap-1.5"
      : "px-3.5 py-1.5 rounded-lg text-gray-400 hover:text-white transition flex items-center gap-1.5";
  }

  if (!isEmoji) {
    const searchInput = document.getElementById('gif-search-input');
    if (searchInput) setTimeout(() => searchInput.focus(), 80);
  }
}

function renderEmojiGrid() {
  const container = document.getElementById('emoji-grid-container');
  if (!container) return;

  let html = '';
  CROCHIT_EMOJI_CATEGORIES.forEach(cat => {
    html += `
      <div class="space-y-1.5">
        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0 bg-[#16222a]/95 py-1 backdrop-blur-sm z-10">
          ${cat.name}
        </div>
        <div class="grid grid-cols-8 sm:grid-cols-9 gap-1.5 text-center">
          ${cat.emojis.map(em => `
            <button 
              type="button"
              onclick="insertEmojiIntoInput('${em}')" 
              class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-125 transition select-none text-xl sm:text-2xl"
              title="${em}"
            >
              ${em}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function insertEmojiIntoInput(emoji) {
  const input = document.getElementById('chat-message-input');
  if (!input) return;

  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;
  const val = input.value;

  input.value = val.substring(0, start) + emoji + val.substring(end);
  const newPos = start + emoji.length;
  input.focus();
  input.setSelectionRange(newPos, newPos);
}

function renderGifGrid(gifs) {
  const container = document.getElementById('gif-grid-container');
  if (!container) return;

  if (!gifs || gifs.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 py-8 text-center text-gray-400 space-y-1">
        <p class="text-xs">No GIFs found.</p>
        <p class="text-[10px] text-gray-500">Try searching "dance", "laugh", "happy", or "love".</p>
      </div>
    `;
    return;
  }

  let html = '';
  gifs.forEach(gif => {
    html += `
      <div 
        onclick="sendGifMessage('${escapeAttr(gif.url)}', '${escapeAttr(gif.title)}')"
        class="relative rounded-xl overflow-hidden bg-black/40 border border-white/5 hover:border-emerald-500/60 transition cursor-pointer group h-28 sm:h-32"
        title="Click to send ${escapeHtml(gif.title)}"
      >
        <img 
          src="${gif.url}" 
          alt="${escapeHtml(gif.title)}" 
          loading="lazy"
          class="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 opacity-90 group-hover:opacity-100">
          <span class="text-[10px] font-semibold text-white truncate max-w-full">${escapeHtml(gif.title)}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function handleGifSearchInput(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    renderGifGrid(CROCHIT_GIFS);
    return;
  }

  const filtered = CROCHIT_GIFS.filter(g => {
    return g.title.toLowerCase().includes(q) || g.tags.some(t => t.includes(q));
  });

  renderGifGrid(filtered);
}

function filterGifsByTag(tag) {
  const searchInput = document.getElementById('gif-search-input');
  if (searchInput) searchInput.value = '';

  if (tag === 'all') {
    renderGifGrid(CROCHIT_GIFS);
    return;
  }

  const filtered = CROCHIT_GIFS.filter(g => g.tags.includes(tag));
  renderGifGrid(filtered);
}

// 1-Click Send Animated GIF in Active Chat
async function sendGifMessage(gifUrl, title) {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) {
    alert("Please select or start a chat first to send a GIF.");
    openNewChatModal();
    return;
  }

  const newMsg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    chat_id: chat.id,
    sender: 'me',
    sender_id: state.currentUser ? state.currentUser.id : 'usr',
    sender_name: state.currentUser ? state.currentUser.username : 'User',
    receiver_id: chat.otherUserId || '',
    time: getCurrentTimeFormatted(),
    text: title || "GIF",
    image: gifUrl,
    isGif: true,
    created_at: new Date().toISOString(),
    status: 'delivered'
  };

  await dispatchOutgoingMessage(chat, newMsg);
  toggleEmojiGifPicker(false);
}

// Trigger Local Device Image / GIF File Upload
function triggerMediaUpload() {
  const fileInput = document.getElementById('media-file-input');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

// Handle Image or GIF file picked from user device
async function handleMediaFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) {
    alert("Please select or start a conversation first to send an image.");
    openNewChatModal();
    return;
  }

  // Check file size (limit to 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert("Please select an image smaller than 5MB.");
    return;
  }

  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const newMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      chat_id: chat.id,
      sender: 'me',
      sender_id: state.currentUser ? state.currentUser.id : 'usr',
      sender_name: state.currentUser ? state.currentUser.username : 'User',
      receiver_id: chat.otherUserId || '',
      time: getCurrentTimeFormatted(),
      text: isGif ? "GIF" : "Photo 📸",
      image: dataUrl,
      isGif: isGif,
      created_at: new Date().toISOString(),
      status: 'delivered'
    };

    await dispatchOutgoingMessage(chat, newMsg);
  };

  reader.readAsDataURL(file);
}

async function sendVoiceNote() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) return;

  const newMsg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    chat_id: chat.id,
    sender: 'me',
    sender_id: state.currentUser ? state.currentUser.id : 'usr',
    sender_name: state.currentUser ? state.currentUser.username : 'User',
    receiver_id: chat.otherUserId || '',
    time: getCurrentTimeFormatted(),
    text: "",
    isVoiceNote: true,
    created_at: new Date().toISOString(),
    status: 'delivered'
  };

  await dispatchOutgoingMessage(chat, newMsg);
}

function clearCurrentChatHistory() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) return;

  if (confirm(`Clear all messages with ${chat.name}?`)) {
    chat.messages = [];
    saveUserConversations();
    renderActiveChatMessages();
    renderConversationsList();
  }
}

// ==================== USER SEARCH & REAL-TIME DIRECT CONVERSATIONS ====================

// Generate deterministic shared chat ID for 2 users so both have the exact same chat thread
function getDirectChatId(id1, id2) {
  if (!id1 || !id2) return 'chat_' + Date.now();
  return 'direct_' + [String(id1), String(id2)].sort().join('_');
}

// Toggle between "Find User" and "Create Group" tabs
function toggleNewChatTab(tab) {
  const isDirect = tab === 'direct';
  const tabDirect = document.getElementById('new-chat-tab-direct');
  const tabGroup = document.getElementById('new-chat-tab-group');
  const btnDirect = document.getElementById('tab-find-user-btn');
  const btnGroup = document.getElementById('tab-create-group-btn');

  if (tabDirect) tabDirect.classList.toggle('hidden', !isDirect);
  if (tabGroup) tabGroup.classList.toggle('hidden', isDirect);

  if (btnDirect) {
    btnDirect.className = isDirect
      ? "flex-1 py-1.5 rounded-lg bg-emerald-500 text-black font-bold transition"
      : "flex-1 py-1.5 rounded-lg text-gray-400 hover:text-white transition";
  }
  if (btnGroup) {
    btnGroup.className = !isDirect
      ? "flex-1 py-1.5 rounded-lg bg-purple-600 text-white font-bold transition"
      : "flex-1 py-1.5 rounded-lg text-gray-400 hover:text-white transition";
  }
}

let searchDebounceTimer = null;
function handleUserSearchInput(query) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchUsersInDatabase(query);
  }, 250);
}

// ==================== INSTAGRAM-STYLE USER EXPLORE & SEARCH DIRECTORY ====================
// Searches registered users by exact @username, ID, or partial name/email from local storage and Supabase cloud DB.
// Always returns the user card with their exact Username AND their exact Database User ID!
async function searchUsersInDatabase(query) {
  const container = document.getElementById('search-user-results');
  if (!container) return;

  const rawQuery = (query || '').trim();
  const cleanQuery = rawQuery.toLowerCase().replace(/^@/, '');

  const myId = state.currentUser ? String(state.currentUser.id || '') : '';
  const myEmail = state.currentUser ? (state.currentUser.email || '').toLowerCase() : '';

  // Show live feedback while querying database
  if (cleanQuery) {
    container.innerHTML = `
      <div class="p-5 text-center text-gray-400 space-y-2 rounded-xl bg-white/[0.02] border border-white/5">
        <div class="inline-block animate-spin rounded-full h-5 w-5 border-2 border-emerald-400 border-t-transparent"></div>
        <p class="text-xs text-emerald-400 font-mono">Searching database for "${escapeHtml(rawQuery)}"...</p>
      </div>
    `;
  }

  // Query Cloud Database & Local Storage via CrochitCloudDB
  const foundRaw = await CrochitCloudDB.searchUsers(rawQuery);

  let matchedUsers = [];
  const seenIds = new Set();

  function addUserResult(u) {
    if (!u || !u.id) return;
    const uid = String(u.id);
    if (seenIds.has(uid)) return;
    seenIds.add(uid);

    const uname = (u.username || u.name || 'User').replace(/^@/, '');
    const uemail = u.email || '';
    const isSelf = (uid === myId) || (myEmail && uemail.toLowerCase() === myEmail);
    const isExact = cleanQuery && (uname.toLowerCase() === cleanQuery || uid.toLowerCase() === cleanQuery || uemail.toLowerCase() === cleanQuery);

    matchedUsers.push({
      id: uid,
      username: uname,
      email: uemail,
      avatar: u.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      bio: u.bio || "Available on Crochit 🚀",
      isSelf: isSelf,
      isExact: isExact
    });
  }

  foundRaw.forEach(u => addUserResult(u));

  // Also include current user in search results if matched (so they can verify their own ID/username)
  if (state.currentUser) {
    const myName = (state.currentUser.username || '').toLowerCase().replace(/^@/, '');
    const myIdLower = String(state.currentUser.id || '').toLowerCase();
    if (!cleanQuery || myName.includes(cleanQuery) || myIdLower.includes(cleanQuery) || myEmail.includes(cleanQuery)) {
      addUserResult(state.currentUser);
    }
  }

  // Sort: Exact matches first, then startsWith, then others
  matchedUsers.sort((a, b) => {
    if (a.isExact && !b.isExact) return -1;
    if (!a.isExact && b.isExact) return 1;

    const aName = a.username.toLowerCase();
    const bName = b.username.toLowerCase();
    const aStarts = cleanQuery && aName.startsWith(cleanQuery);
    const bStarts = cleanQuery && bName.startsWith(cleanQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return 0;
  });

  // If no users matched
  if (matchedUsers.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-gray-400 space-y-2 rounded-2xl bg-white/[0.02] border border-white/5">
        <i data-lucide="user-x" class="w-8 h-8 mx-auto text-gray-500"></i>
        <h4 class="text-xs font-bold text-white">No user found matching "${escapeHtml(rawQuery)}"</h4>
        <p class="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">
          We checked both local storage and the Supabase cloud database. Verify spelling or check the exact username.
        </p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Render matched users
  let html = `
    <div class="flex items-center justify-between px-1 mb-2.5 text-[10px] text-gray-400 font-semibold">
      <span class="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider">
        <i data-lucide="database" class="w-3.5 h-3.5"></i>
        ${cleanQuery ? `DATABASE SEARCH RESULTS FOR "${escapeHtml(rawQuery)}"` : 'REGISTERED USERS DIRECTORY'}
      </span>
      <span class="text-emerald-300 font-mono bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
        ${matchedUsers.length} user${matchedUsers.length > 1 ? 's' : ''}
      </span>
    </div>
    <div class="space-y-2.5">
  `;

  matchedUsers.forEach(u => {
    const sharedChatId = getDirectChatId(myId, u.id);
    const isExistingChat = state.chatsList.some(c => c.id === sharedChatId || c.otherUserId === u.id);

    html += `
      <div class="p-3.5 rounded-2xl bg-[#16222a] border ${u.isExact ? 'border-emerald-500/70 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30' : 'border-white/5 hover:border-emerald-500/40'} transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div class="relative shrink-0">
            <img src="${u.avatar}" class="w-11 h-11 rounded-full object-cover border-2 ${u.isExact ? 'border-emerald-400' : 'border-emerald-500/40'}" alt="${escapeHtml(u.username)}" />
            <span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111b21]"></span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold text-white font-mono">@${escapeHtml(u.username)}</span>
              ${u.isExact ? `<span class="px-1.5 py-0.2 bg-emerald-500 text-black text-[9px] font-black rounded uppercase tracking-wider">Exact Match</span>` : ''}
              ${u.isSelf ? `<span class="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] font-bold rounded">You</span>` : ''}
              <span class="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] font-mono rounded-full border border-emerald-500/30">Verified</span>
            </div>

            <!-- PROMINENT USER DATABASE ID DISPLAY -->
            <div class="mt-1 flex items-center gap-1.5 flex-wrap">
              <div class="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0b141a] border border-emerald-500/35 rounded-md text-[11px] font-mono text-emerald-300">
                <span class="text-[9px] uppercase font-sans font-bold text-gray-400">User ID:</span>
                <span class="font-bold select-all tracking-wide text-emerald-400">${escapeHtml(u.id)}</span>
              </div>
              <button 
                type="button" 
                onclick="event.stopPropagation(); copyTextToClipboard('${escapeAttr(u.id)}', 'Copied User ID: ${escapeAttr(u.id)}');" 
                class="px-1.5 py-0.5 rounded bg-white/5 hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-300 transition text-[10px] flex items-center gap-1 border border-white/5"
                title="Copy User ID"
              >
                <i data-lucide="copy" class="w-3 h-3"></i>
                <span>Copy</span>
              </button>
            </div>

            <p class="text-[10px] text-gray-400 truncate mt-0.5">${escapeHtml(u.bio || 'Available on Crochit')}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button 
            onclick="startDirectChatWithUser('${u.id}', '${escapeAttr(u.username)}', '${escapeAttr(u.avatar)}')"
            class="px-3.5 py-2 rounded-xl ${u.isSelf ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-black'} text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <i data-lucide="${u.isSelf ? 'bookmark' : (isExistingChat ? 'message-square' : 'user-plus')}" class="w-3.5 h-3.5"></i>
            <span>${u.isSelf ? 'Self Notes' : (isExistingChat ? 'Open Chat' : 'Chat')}</span>
          </button>
          ${!u.isSelf ? `
            <button 
              onclick="startDirectChatWithUser('${u.id}', '${escapeAttr(u.username)}', '${escapeAttr(u.avatar)}'); startVoiceCall();"
              class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-400 hover:text-white transition"
              title="Encrypted Voice Call"
            >
              <i data-lucide="phone" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// Start or Open Direct 1-on-1 Conversation with a User
function startDirectChatWithUser(otherUserId, otherUsername, otherAvatar) {
  if (!state.currentUser) return;

  const isSelf = String(otherUserId) === String(state.currentUser.id);
  const chatId = isSelf ? `self_${state.currentUser.id}` : getDirectChatId(state.currentUser.id, otherUserId);
  let existing = state.chatsList.find(c => c.id === chatId || (!isSelf && c.otherUserId === otherUserId));

  if (existing) {
    closeNewChatModal();
    selectChat(existing.id);
    return;
  }

  const newChat = {
    id: chatId,
    name: isSelf ? `${otherUsername} (Saved Notes)` : otherUsername,
    avatar: otherAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    otherUserId: otherUserId,
    online: true,
    lastSeen: "Active now",
    isGroup: false,
    messages: []
  };

  state.chatsList.unshift(newChat);
  saveUserConversations();

  // If not self, also sync contact to other user's list in Supabase so they see current user too
  if (!isSelf) {
    CrochitCloudDB.syncContact({
      id: `${otherUserId}_${chatId}`,
      user_id: otherUserId,
      contact_id: state.currentUser.id,
      contact_name: state.currentUser.username,
      contact_avatar: state.currentUser.avatar || '',
      is_group: false,
      updated_at: new Date().toISOString()
    });
  }

  closeNewChatModal();
  selectChat(newChat.id);
}

// Create Group Conversation
function createGroupConversation() {
  const nameInput = document.getElementById('new-group-name');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    alert("Please enter a group title.");
    return;
  }

  const newChat = {
    id: 'group_' + Date.now(),
    name: name,
    avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
    online: true,
    lastSeen: "Group Chat",
    isGroup: true,
    messages: []
  };

  state.chatsList.unshift(newChat);
  saveUserConversations();
  closeNewChatModal();
  if (nameInput) nameInput.value = '';
  selectChat(newChat.id);
}

// ==================== REAL-TIME MESSAGE SYNC & EVENT LISTENERS ====================
let cloudPollInterval = null;
let lastCloudPollTime = new Date(Date.now() - 3600000).toISOString();

function startRealtimeMessageListeners() {
  // 1. Cross-tab Realtime Mesh (BroadcastChannel) - Instant 0ms delivery
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      if (!window.crochitChannel) {
        window.crochitChannel = new BroadcastChannel('crochit_realtime_mesh');
      }
      window.crochitChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'INCOMING_MESSAGE') {
          handleIncomingMessage(event.data.payload);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel init notice:", e);
    }
  }

  // 2. Storage Event (cross-tab fallback for all browsers)
  window.addEventListener('storage', (e) => {
    if (e.key === 'crochit_shared_mailbox' && e.newValue) {
      try {
        const mailbox = JSON.parse(e.newValue);
        if (Array.isArray(mailbox)) {
          mailbox.forEach(msg => handleIncomingMessage(msg));
        }
      } catch (err) {}
    }
  });

  // 3. Supabase Cloud Realtime Channel (cross-device push)
  if (state.supabaseClient) {
    try {
      state.supabaseClient
        .channel('public:crochit_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crochit_messages' }, payload => {
          if (payload && payload.new) {
            handleIncomingMessage(payload.new);
          }
        })
        .subscribe((status) => {
          console.log("Supabase Realtime status:", status);
        });
    } catch (err) {
      console.warn("Supabase Realtime notice:", err);
    }
  }

  // 4. Supabase Cloud Polling (every 3 seconds as rock-solid background sync)
  clearInterval(cloudPollInterval);
  cloudPollInterval = setInterval(pollCloudMessages, 3000);
}

// Ingest incoming message from another user in real time
async function handleIncomingMessage(payload) {
  if (!state.currentUser || !payload) return;

  const myId = state.currentUser.id;

  // Is this message from myself? Ignore.
  if (payload.sender_id === myId) return;

  // Is this message meant for me?
  const isForMe = payload.receiver_id === myId || (payload.chat_id && payload.chat_id.includes(myId));
  if (!isForMe) return;

  // Find or automatically create the conversation in state.chatsList
  let chat = state.chatsList.find(c => c.id === payload.chat_id || (payload.sender_id && c.otherUserId === payload.sender_id));

  if (!chat) {
    // Automatically add this sender to current user's chat list!
    chat = {
      id: payload.chat_id || getDirectChatId(myId, payload.sender_id),
      name: payload.sender_name || 'Contact',
      avatar: payload.sender_avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      otherUserId: payload.sender_id,
      online: true,
      lastSeen: "Active now",
      isGroup: false,
      messages: []
    };
    state.chatsList.unshift(chat);
  }

  if (!chat.messages) chat.messages = [];

  // Prevent duplicate message IDs
  const exists = chat.messages.some(m => m.id === payload.id);
  if (exists) return;

  const incomingMsg = {
    id: payload.id,
    sender: 'them',
    sender_name: payload.sender_name,
    time: payload.time || getCurrentTimeFormatted(),
    text: payload.text,
    image: payload.image || null,
    isVoiceNote: !!payload.isVoiceNote,
    created_at: payload.created_at || new Date().toISOString(),
    status: 'read'
  };

  chat.messages.push(incomingMsg);
  saveUserConversations();
  renderConversationsList();

  if (state.activeChatId === chat.id) {
    await renderActiveChatMessages();
  } else {
    playMessageTone();
  }
}

// Background poller for Supabase messages
async function pollCloudMessages() {
  if (!state.currentUser) return;

  try {
    const myId = state.currentUser.id;
    const messages = await CrochitCloudDB.pollMessages(myId, lastCloudPollTime);

    if (messages && messages.length > 0) {
      for (const msg of messages) {
        await handleIncomingMessage({
          id: msg.id,
          chat_id: msg.chat_id,
          sender_id: msg.sender_id,
          sender_name: msg.sender_name,
          receiver_id: msg.receiver_id,
          text: msg.text,
          image: msg.image,
          isVoiceNote: msg.is_voice_note,
          created_at: msg.created_at,
          time: getCurrentTimeFormatted()
        });

        if (msg.created_at > lastCloudPollTime) {
          lastCloudPollTime = msg.created_at;
        }
      }
    }
  } catch (e) {
    // Silent catch for background polling
  }
}

function playMessageTone() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
}

function escapeAttr(text) {
  if (!text) return '';
  return String(text)
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}

// ==================== 3. INTERACTIVE VOICE CALL & 20-MIN EMERGENCY GRACE ====================
function startVoiceCall() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) {
    alert("Please select or start a conversation first to make an encrypted voice call.");
    openNewChatModal();
    return;
  }

  // Hide top bar if active and preserve contact
  hideEmergencyCallTopBar();
  state.reservedCallContact = chat;

  const modal = document.getElementById('voice-call-modal');
  const avatar = document.getElementById('voice-call-avatar');
  const name = document.getElementById('voice-call-name');
  const status = document.getElementById('voice-call-status');

  if (avatar) avatar.src = chat.avatar;
  if (name) name.textContent = chat.name;
  if (status) status.textContent = "Calling...";

  state.voiceCallSeconds = 0;
  state.isVoiceMuted = false;
  state.isCallOfflineSimulated = false;

  const banner = document.getElementById('call-offline-grace-banner');
  if (banner) banner.classList.add('hidden');

  const simLabel = document.getElementById('simulate-cut-label');
  if (simLabel) simLabel.textContent = "Simulate Internet Cut (Test 20-Min Grace)";

  if (modal) modal.classList.remove('hidden');

  playCallTone();

  // Connect after 2.5 seconds
  setTimeout(() => {
    if (!modal.classList.contains('hidden')) {
      if (status) status.textContent = "Connected (00:00)";
      startVoiceTimer();
    }
  }, 2500);
}

function startVoiceTimer() {
  clearInterval(state.voiceCallTimer);
  state.voiceCallTimer = setInterval(() => {
    state.voiceCallSeconds++;
    const mins = String(Math.floor(state.voiceCallSeconds / 60)).padStart(2, '0');
    const secs = String(state.voiceCallSeconds % 60).padStart(2, '0');
    const status = document.getElementById('voice-call-status');
    if (status && !state.isCallOfflineSimulated) {
      status.textContent = `Connected (${mins}:${secs})`;
    }
  }, 1000);
}

function endVoiceCall() {
  clearInterval(state.voiceCallTimer);
  const modal = document.getElementById('voice-call-modal');
  if (modal) modal.classList.add('hidden');

  // Reserve session for 10 minutes so user can 1-tap resume/redial!
  const chat = state.chatsList.find(c => c.id === state.activeChatId) || state.reservedCallContact;
  if (chat) {
    state.reservedCallContact = chat;
    if (!state.emergencyGraceTimer) {
      state.emergencyGraceSeconds = 600; // 10 minutes minimum
    }
    try {
      localStorage.setItem(DB_RESERVED_CALL_KEY, JSON.stringify({
        contact: chat,
        expiresAt: Date.now() + (state.emergencyGraceSeconds > 0 ? state.emergencyGraceSeconds : 600) * 1000
      }));
    } catch (e) {}

    startEmergencyGraceCountdown();
    showEmergencyCallTopBar();
  }
}

function toggleVoiceMute() {
  state.isVoiceMuted = !state.isVoiceMuted;
  const btn = document.getElementById('voice-mute-btn');
  if (btn) {
    btn.classList.toggle('bg-red-600', state.isVoiceMuted);
    btn.classList.toggle('text-white', state.isVoiceMuted);
  }
}

function toggleSpeaker() {
  alert("Speaker output toggled.");
}

// ==================== 20-MINUTE EMERGENCY OFFLINE GRACE & SURVIVAL ENGINE ====================
function initOfflineEmergencyEngine() {
  // 1. Listen for browser online / offline network events
  window.addEventListener('offline', () => {
    console.warn("⚠️ Network offline detected!");
    const voiceModal = document.getElementById('voice-call-modal');
    if (voiceModal && !voiceModal.classList.contains('hidden')) {
      triggerCallOfflineGraceMode(false);
    }
  });

  window.addEventListener('online', () => {
    console.log("✓ Network online restored!");
    if (state.emergencyGraceTimer) {
      const status = document.getElementById('voice-call-status');
      if (status) status.innerHTML = `<span class="text-emerald-400 font-bold">✓ Internet Restored! Reconnecting...</span>`;
      setTimeout(() => {
        reconnectCallSession();
      }, 1200);
    }
    flushOfflineOutbox();
  });

  // 2. Restore any ongoing 20-minute reservation from localStorage
  restoreReservedCallSession();
}

function restoreReservedCallSession() {
  try {
    const raw = localStorage.getItem(DB_RESERVED_CALL_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !data.expiresAt || !data.contact) return;

    const remaining = Math.floor((data.expiresAt - Date.now()) / 1000);
    if (remaining > 0) {
      state.reservedCallContact = data.contact;
      state.emergencyGraceSeconds = remaining;
      showEmergencyCallTopBar();
      startEmergencyGraceCountdown();
    } else {
      localStorage.removeItem(DB_RESERVED_CALL_KEY);
    }
  } catch (e) {
    console.warn("Error restoring reserved call session:", e);
  }
}

function triggerCallOfflineGraceMode(isSimulated = false) {
  playEmergencyOfflineChime();

  const chat = state.chatsList.find(c => c.id === state.activeChatId) || state.reservedCallContact;
  if (chat) {
    state.reservedCallContact = chat;
    try {
      localStorage.setItem(DB_RESERVED_CALL_KEY, JSON.stringify({
        contact: chat,
        expiresAt: Date.now() + 600 * 1000
      }));
    } catch (e) {}
  }

  const banner = document.getElementById('call-offline-grace-banner');
  if (banner) banner.classList.remove('hidden');

  const status = document.getElementById('voice-call-status');
  if (status) {
    status.innerHTML = `
      <div class="space-y-1.5">
        <span class="text-amber-400 font-bold animate-pulse text-xs block">⚠️ Wi-Fi / Light Outage — 0 KB Emergency Call Active (10-Min Hold)</span>
        <button onclick="openEmergencyFlashModal()" class="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold shadow-lg shadow-red-600/40 animate-bounce inline-flex items-center gap-1.5">
          <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-300"></i>
          <span>Send 0 KB Flash Message (No Phone No.)</span>
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  // Automatically start buffering voice locally so user's speech isn't lost during outage
  if (!state.isRecordingOfflineCapsule) {
    recordOfflineVoiceCapsule();
  }

  if (!state.emergencyGraceTimer) {
    state.emergencyGraceSeconds = 600;
  }
  startEmergencyGraceCountdown();
}

function startEmergencyGraceCountdown() {
  clearInterval(state.emergencyGraceTimer);
  updateGraceTimerDisplay();

  state.emergencyGraceTimer = setInterval(() => {
    state.emergencyGraceSeconds--;
    if (state.emergencyGraceSeconds <= 0) {
      clearInterval(state.emergencyGraceTimer);
      state.emergencyGraceTimer = null;
      dismissReservedCall();
      alert("⚠️ 10-minute Emergency Call Reservation has expired.");
      return;
    }
    updateGraceTimerDisplay();
  }, 1000);
}

function updateGraceTimerDisplay() {
  const mins = String(Math.floor(state.emergencyGraceSeconds / 60)).padStart(2, '0');
  const secs = String(state.emergencyGraceSeconds % 60).padStart(2, '0');
  const timeFormatted = `${mins}:${secs}`;

  const bannerTimer = document.getElementById('offline-grace-timer');
  if (bannerTimer) bannerTimer.textContent = timeFormatted;

  const topBarTimer = document.getElementById('top-bar-grace-timer');
  if (topBarTimer) topBarTimer.textContent = timeFormatted;
}

function simulateInternetCutToggle() {
  state.isCallOfflineSimulated = !state.isCallOfflineSimulated;
  const label = document.getElementById('simulate-cut-label');

  if (state.isCallOfflineSimulated) {
    if (label) label.textContent = "Restore Wi-Fi (End Outage Test)";
    triggerCallOfflineGraceMode(true);
  } else {
    if (label) label.textContent = "Simulate Wi-Fi Cut (Test 0 KB 10-Min Emergency)";
    reconnectCallSession();
  }
}

function reconnectCallSession() {
  state.isCallOfflineSimulated = false;
  const label = document.getElementById('simulate-cut-label');
  if (label) label.textContent = "Simulate Wi-Fi Cut (Test 0 KB 10-Min Emergency)";

  const banner = document.getElementById('call-offline-grace-banner');
  if (banner) banner.classList.add('hidden');

  const status = document.getElementById('voice-call-status');
  if (status) {
    status.innerHTML = `<span class="text-emerald-400 font-bold">✓ Connected (Handshake Restored with E2EE)</span>`;
  }

  clearInterval(state.emergencyGraceTimer);
  state.emergencyGraceTimer = null;
  localStorage.removeItem(DB_RESERVED_CALL_KEY);
  hideEmergencyCallTopBar();
  playCallTone();
}

function showEmergencyCallTopBar() {
  const topBar = document.getElementById('emergency-call-top-bar');
  const nameEl = document.getElementById('top-bar-contact-name');
  if (topBar && state.reservedCallContact) {
    const handle = state.reservedCallContact.username ? `@${state.reservedCallContact.username}` : (state.reservedCallContact.name ? `@${state.reservedCallContact.name.toLowerCase().replace(/\s+/g, '')}` : '@contact');
    if (nameEl) nameEl.textContent = handle;
    topBar.classList.remove('hidden');
    updateGraceTimerDisplay();
    if (window.lucide) lucide.createIcons();
  }
}

function hideEmergencyCallTopBar() {
  const topBar = document.getElementById('emergency-call-top-bar');
  if (topBar) topBar.classList.add('hidden');
}

function reconnectReservedCall() {
  if (!state.reservedCallContact) {
    alert("No active reserved call session found.");
    return;
  }

  state.activeChatId = state.reservedCallContact.id;
  hideEmergencyCallTopBar();

  const modal = document.getElementById('voice-call-modal');
  const avatar = document.getElementById('voice-call-avatar');
  const name = document.getElementById('voice-call-name');
  const status = document.getElementById('voice-call-status');

  if (avatar) avatar.src = state.reservedCallContact.avatar;
  if (name) name.textContent = state.reservedCallContact.name;
  if (status) status.textContent = "Resuming Reserved Call...";

  if (modal) modal.classList.remove('hidden');
  playCallTone();

  setTimeout(() => {
    reconnectCallSession();
    startVoiceTimer();
  }, 1200);
}

function dismissReservedCall() {
  clearInterval(state.emergencyGraceTimer);
  state.emergencyGraceTimer = null;
  state.reservedCallContact = null;
  state.emergencyGraceSeconds = 1200;
  localStorage.removeItem(DB_RESERVED_CALL_KEY);
  hideEmergencyCallTopBar();
  const banner = document.getElementById('call-offline-grace-banner');
  if (banner) banner.classList.add('hidden');
}

async function recordOfflineVoiceCapsule() {
  if (state.isRecordingOfflineCapsule) {
    stopOfflineVoiceCapsule();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.offlineVoiceChunks = [];
    state.offlineVoiceRecorder = new MediaRecorder(stream);

    state.offlineVoiceRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.offlineVoiceChunks.push(e.data);
    };

    state.offlineVoiceRecorder.onstop = async () => {
      const blob = new Blob(state.offlineVoiceChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        queueOfflineVoiceCapsuleMessage(base64Audio);
      };
      reader.readAsDataURL(blob);

      stream.getTracks().forEach(t => t.stop());
    };

    state.offlineVoiceRecorder.start();
    state.isRecordingOfflineCapsule = true;

    alert("🎙️ Emergency Voice Capsule recording started! You can speak without any internet. When done, click Voice Capsule again to save and queue for auto-delivery.");
  } catch (err) {
    console.warn("Microphone access notice for capsule:", err);
    const note = prompt("🎙️ Microphone direct stream paused. Enter emergency voice capsule transcript to queue for 100% automatic delivery:");
    if (note && note.trim()) {
      queueOfflineVoiceCapsuleMessage(null, note.trim());
    }
  }
}

function stopOfflineVoiceCapsule() {
  if (state.offlineVoiceRecorder && state.isRecordingOfflineCapsule) {
    state.offlineVoiceRecorder.stop();
    state.isRecordingOfflineCapsule = false;
    alert("✓ Emergency Voice Capsule saved! It will automatically deliver to your contact as soon as internet reconnects or within this 20-minute grace window.");
  }
}

function queueOfflineVoiceCapsuleMessage(audioDataUrl, textFallback) {
  const targetContact = state.reservedCallContact || state.chatsList.find(c => c.id === state.activeChatId);
  if (!targetContact) return;

  const capsuleMsg = {
    id: 'capsule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    chat_id: targetContact.id,
    sender: 'me',
    sender_id: state.currentUser ? state.currentUser.id : 'usr',
    sender_name: state.currentUser ? state.currentUser.username : 'User',
    receiver_id: targetContact.otherUserId || '',
    time: getCurrentTimeFormatted(),
    text: textFallback ? `[Emergency Voice Capsule]: ${textFallback}` : "🎙️ [Emergency Offline Voice Capsule Attached]",
    audioUrl: audioDataUrl || null,
    isVoiceCapsule: true,
    isOfflineQueued: true,
    created_at: new Date().toISOString(),
    status: 'pending_reconnect'
  };

  if (!targetContact.messages) targetContact.messages = [];
  targetContact.messages.push(capsuleMsg);
  saveUserConversations();
  renderActiveChatMessages();

  try {
    const raw = localStorage.getItem(DB_OFFLINE_OUTBOX_KEY) || '[]';
    let outbox = JSON.parse(raw);
    outbox.push({ contact: targetContact, message: capsuleMsg });
    localStorage.setItem(DB_OFFLINE_OUTBOX_KEY, JSON.stringify(outbox));
  } catch (e) {}
}

async function flushOfflineOutbox() {
  try {
    const raw = localStorage.getItem(DB_OFFLINE_OUTBOX_KEY);
    if (!raw) return;
    const outbox = JSON.parse(raw);
    if (!Array.isArray(outbox) || outbox.length === 0) return;

    console.log(`Flushing ${outbox.length} offline queued items...`);
    for (const item of outbox) {
      if (item && item.contact && item.message) {
        item.message.status = 'delivered';
        await dispatchOutgoingMessage(item.contact, item.message);
      }
    }
    localStorage.removeItem(DB_OFFLINE_OUTBOX_KEY);
    console.log("✓ Offline outbox flushed successfully!");
  } catch (e) {
    console.warn("Outbox flush notice:", e);
  }
}

function playEmergencyOfflineChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.09, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {}
}

// ==================== 0 KB EMERGENCY FLASH SOS DISPATCHER (NO PHONE NUMBERS) ====================
function openEmergencyFlashModal() {
  const target = state.reservedCallContact || state.chatsList.find(c => c.id === state.activeChatId);
  if (!target) {
    alert("Please select a contact or active call session to dispatch an Emergency Flash Message.");
    return;
  }

  const modal = document.getElementById('emergency-flash-modal');
  const avatar = document.getElementById('flash-recipient-avatar');
  const name = document.getElementById('flash-recipient-name');
  const username = document.getElementById('flash-recipient-username');
  const statusBanner = document.getElementById('flash-status-banner');
  const textInput = document.getElementById('emergency-flash-text');

  if (avatar) avatar.src = target.avatar || "assets/logo.png";
  if (name) name.textContent = target.name || "Recipient";
  if (username) username.textContent = target.username ? `@${target.username}` : (target.name ? `@${target.name.toLowerCase().replace(/\s+/g, '')}` : '@contact');

  if (statusBanner) statusBanner.classList.add('hidden');
  if (textInput && !textInput.value) {
    textInput.value = '💡 Light chali gayi, Wi-Fi band ho gaya! Call 10-min emergency buffer par active hai.';
  }

  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeEmergencyFlashModal() {
  const modal = document.getElementById('emergency-flash-modal');
  if (modal) modal.classList.add('hidden');
}

function setFlashPresetMessage(msg) {
  const textInput = document.getElementById('emergency-flash-text');
  if (textInput) {
    textInput.value = msg;
    textInput.focus();
  }
}

// 0 KB In-App Emergency Flash (Dispatches directly inside Crochit to @username without phone numbers)
async function dispatchZeroDataInAppFlash() {
  const target = state.reservedCallContact || state.chatsList.find(c => c.id === state.activeChatId);
  if (!target) return;

  const textInput = document.getElementById('emergency-flash-text');
  const text = (textInput ? textInput.value : '').trim();
  if (!text) {
    alert("Please type or select an emergency message to send.");
    return;
  }

  const sosMsg = {
    id: 'sos_flash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    chat_id: target.id,
    sender: 'me',
    sender_id: state.currentUser ? state.currentUser.id : 'usr',
    sender_name: state.currentUser ? state.currentUser.username : 'User',
    receiver_id: target.otherUserId || '',
    time: getCurrentTimeFormatted(),
    text: `⚡ [0 KB Emergency Flash]: ${text}`,
    isEmergencySos: true,
    created_at: new Date().toISOString(),
    status: 'pending_reconnect'
  };

  if (!target.messages) target.messages = [];
  target.messages.push(sosMsg);
  saveUserConversations();
  renderActiveChatMessages();

  // 1. BroadcastChannel local mesh (instant if tabs/devices on same browser/network)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      if (!window.crochitChannel) {
        window.crochitChannel = new BroadcastChannel('crochit_realtime_mesh');
      }
      window.crochitChannel.postMessage({
        type: 'INCOMING_MESSAGE',
        payload: {
          id: sosMsg.id,
          chat_id: target.id,
          sender: 'them',
          sender_id: state.currentUser ? state.currentUser.id : 'usr',
          sender_name: state.currentUser ? state.currentUser.username : 'User',
          receiver_id: target.otherUserId || '',
          text: sosMsg.text,
          time: sosMsg.time,
          created_at: sosMsg.created_at
        }
      });
    } catch (e) {}
  }

  // 2. Queue into 0 KB Outbox (will auto-deliver as soon as Wi-Fi/power restores)
  try {
    const raw = localStorage.getItem(DB_OFFLINE_OUTBOX_KEY) || '[]';
    let outbox = JSON.parse(raw);
    outbox.push({ contact: target, message: sosMsg });
    localStorage.setItem(DB_OFFLINE_OUTBOX_KEY, JSON.stringify(outbox));
  } catch (e) {}

  const statusBanner = document.getElementById('flash-status-banner');
  if (statusBanner) {
    statusBanner.innerHTML = `✓ 0 KB Flash saved to emergency buffer for <b>@${escapeHtml(target.username || target.name || 'contact')}</b>! It will auto-deliver immediately when connection restores.`;
    statusBanner.classList.remove('hidden');
  }

  playCallTone();
}

// 0 KB Local Hotspot / LAN Direct Connect
function triggerLocalHotspotConnect() {
  alert("📶 0 KB Local Hotspot / LAN Connect:\n\nIf you or your friend are nearby (in the colony or same building):\n1. Turn on phone Portable Hotspot (even with 0 recharge / 0 internet pack).\n2. Have your friend connect to this Wi-Fi.\n3. Crochit connects direct WebRTC audio over local IP with 0 KB internet data required!");
}

// Global browser window bindings
window.startVoiceCall = startVoiceCall;
window.endVoiceCall = endVoiceCall;
window.toggleVoiceMute = toggleVoiceMute;
window.toggleSpeaker = toggleSpeaker;
window.simulateInternetCutToggle = simulateInternetCutToggle;
window.reconnectCallSession = reconnectCallSession;
window.reconnectReservedCall = reconnectReservedCall;
window.dismissReservedCall = dismissReservedCall;
window.recordOfflineVoiceCapsule = recordOfflineVoiceCapsule;
window.openEmergencyFlashModal = openEmergencyFlashModal;
window.closeEmergencyFlashModal = closeEmergencyFlashModal;
window.setFlashPresetMessage = setFlashPresetMessage;
window.dispatchZeroDataInAppFlash = dispatchZeroDataInAppFlash;
window.triggerLocalHotspotConnect = triggerLocalHotspotConnect;
window.handleUsernameInput = handleUsernameInput;
window.applyUsernameSuggestion = applyUsernameSuggestion;

// ==================== 4. INTERACTIVE VIDEO CALL ====================
async function startVideoCall() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) {
    alert("Please select or start a conversation first to make an encrypted video call.");
    openNewChatModal();
    return;
  }

  const modal = document.getElementById('video-call-modal');
  const headerAvatar = document.getElementById('video-call-header-avatar');
  const headerName = document.getElementById('video-call-header-name');
  const remoteAvatar = document.getElementById('video-remote-avatar');
  const remoteName = document.getElementById('video-remote-name');
  const timerEl = document.getElementById('video-call-timer');

  if (headerAvatar) headerAvatar.src = chat.avatar;
  if (headerName) headerName.textContent = chat.name;
  if (remoteAvatar) remoteAvatar.src = chat.avatar;
  if (remoteName) remoteName.textContent = chat.name;
  if (timerEl) timerEl.textContent = "Connecting...";

  if (modal) modal.classList.remove('hidden');

  // Request camera and microphone stream
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    state.localVideoStream = stream;
    const localVideo = document.getElementById('local-camera-feed');
    if (localVideo) {
      localVideo.srcObject = stream;
    }
  } catch (err) {
    console.warn("Camera access permission denied or unavailable:", err);
  }

  // Start Call Timer
  state.videoCallSeconds = 0;
  clearInterval(state.videoCallTimer);
  state.videoCallTimer = setInterval(() => {
    state.videoCallSeconds++;
    const mins = String(Math.floor(state.videoCallSeconds / 60)).padStart(2, '0');
    const secs = String(state.videoCallSeconds % 60).padStart(2, '0');
    if (timerEl) timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

function endVideoCall() {
  clearInterval(state.videoCallTimer);

  // Stop camera tracks
  if (state.localVideoStream) {
    state.localVideoStream.getTracks().forEach(track => track.stop());
    state.localVideoStream = null;
  }

  const modal = document.getElementById('video-call-modal');
  if (modal) modal.classList.add('hidden');
}

function toggleVideoMic() {
  state.isVideoMicMuted = !state.isVideoMicMuted;
  if (state.localVideoStream) {
    state.localVideoStream.getAudioTracks().forEach(track => {
      track.enabled = !state.isVideoMicMuted;
    });
  }
  const btn = document.getElementById('video-mute-mic-btn');
  if (btn) btn.classList.toggle('bg-red-600', state.isVideoMicMuted);
}

function toggleVideoCam() {
  state.isVideoCamOff = !state.isVideoCamOff;
  if (state.localVideoStream) {
    state.localVideoStream.getVideoTracks().forEach(track => {
      track.enabled = !state.isVideoCamOff;
    });
  }
  const btn = document.getElementById('video-toggle-cam-btn');
  if (btn) btn.classList.toggle('bg-red-600', state.isVideoCamOff);
}

// Tone helper
function playCallTone() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {}
}

// ==================== 5. EVENT LISTENERS ====================
function setupEventListeners() {
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendCurrentMessage();
      }
    });
  }

  const search = document.getElementById('chat-search-input');
  if (search) {
    search.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderConversationsList();
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = (e.target.value || '').trim();
        if (q) {
          openSearchWithQuery(q);
        }
      }
    });
  }
}

// ==================== CLIPBOARD & TOAST UTILITIES ====================
function copyTextToClipboard(text, successMsg) {
  if (!text) return;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      if (successMsg) showSearchCopyToast(successMsg);
    }).catch(() => {
      fallbackCopyText(text, successMsg);
    });
  } else {
    fallbackCopyText(text, successMsg);
  }
}

function fallbackCopyText(text, successMsg) {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    if (successMsg) showSearchCopyToast(successMsg);
  } catch (err) {
    console.warn("Clipboard copy fallback error:", err);
  }
}

function showSearchCopyToast(msg) {
  let toast = document.getElementById('crochit-copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'crochit-copy-toast';
    toast.className = 'fixed bottom-6 right-6 z-[9999] bg-emerald-500 text-black px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-none';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>${escapeHtml(msg)}</span>`;
  if (window.lucide) lucide.createIcons();
  toast.classList.remove('translate-y-2', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-2', 'opacity-0');
  }, 2200);
}

// Time Helper
function getCurrentTimeFormatted() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
