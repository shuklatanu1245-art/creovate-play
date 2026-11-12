// Crochit - Dedicated Real-Time Messaging & Chat Core Engine
// 100% Pure Chat & Messaging: Direct Chats, Groups, Status Stories, Real-Time P2P WebRTC, In-Place Database Updates
// No Videos, No External Media Streams - High Performance & Instant Response

// Application State
let state = {
  sidebarTab: 'chats', // 'chats' | 'status' | 'profile'
  activeChatId: 'chat_1',
  currentUser: null,
  activePeerConn: null,
  myPeerId: null,
  peerInstance: null,
  broadcastChannel: null,
  supabaseClient: null,
  authMode: 'signin',
  chatsList: [],
  statusesList: [],
  searchQuery: '',
  statusTimer: null,
  isRecordingVoice: false
};

// Database Storage Keys
const DB_USERS_KEY = 'crochit_db_users_v1';
const DB_SESSION_KEY = 'crochit_active_session_v1';
const DB_CHATS_KEY = 'crochit_chats_v1';
const DB_STATUSES_KEY = 'crochit_statuses_v1';
const DB_SUPABASE_KEY = 'crochit_supabase_config_v1';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initDatabase();
  initSupabase();
  initBroadcastChannel();
  initPeerJSEngine();
  renderMiniStatusBar();
  renderConversationsList();
  renderFullStatusList();
  renderProfileData();
  selectChat(state.activeChatId);
  setupEventListeners();

  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
});

// ==================== 1. DATABASE & USER PROFILE (IN-PLACE UPDATES) ====================
function initDatabase() {
  // 1. Initialize Users Table
  let users = [];
  try {
    const storedUsers = localStorage.getItem(DB_USERS_KEY);
    if (storedUsers) {
      users = JSON.parse(storedUsers);
    }
  } catch (e) {
    console.error("Error reading users db:", e);
  }

  if (!users || !Array.isArray(users) || users.length === 0) {
    users = [CROCHIT_DATABASE.defaultUser];
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
  }

  // 2. Initialize Active Session
  let sessionUser = null;
  try {
    const storedSession = localStorage.getItem(DB_SESSION_KEY);
    if (storedSession) {
      sessionUser = JSON.parse(storedSession);
    }
  } catch (e) {
    console.error("Error reading session:", e);
  }

  if (!sessionUser) {
    sessionUser = users[0];
    localStorage.setItem(DB_SESSION_KEY, JSON.stringify(sessionUser));
  }
  state.currentUser = sessionUser;

  // 3. Initialize Chats Data
  let chats = [];
  try {
    const storedChats = localStorage.getItem(DB_CHATS_KEY);
    if (storedChats) {
      chats = JSON.parse(storedChats);
    }
  } catch (e) {
    console.error("Error reading chats:", e);
  }

  if (!chats || !Array.isArray(chats) || chats.length === 0) {
    chats = JSON.parse(JSON.stringify(CROCHIT_DATABASE.chats));
    localStorage.setItem(DB_CHATS_KEY, JSON.stringify(chats));
  }
  state.chatsList = chats;

  // 4. Initialize Status Stories Data
  let statuses = [];
  try {
    const storedStatuses = localStorage.getItem(DB_STATUSES_KEY);
    if (storedStatuses) {
      statuses = JSON.parse(storedStatuses);
    }
  } catch (e) {
    console.error("Error reading statuses:", e);
  }

  if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
    statuses = JSON.parse(JSON.stringify(CROCHIT_DATABASE.statuses));
    localStorage.setItem(DB_STATUSES_KEY, JSON.stringify(statuses));
  }
  state.statusesList = statuses;
}

// Render Profile Data in UI
function renderProfileData() {
  if (!state.currentUser) return;

  const headerAvatar = document.getElementById('header-user-avatar');
  const headerUsername = document.getElementById('header-username-text');
  const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
  const sidebarName = document.getElementById('sidebar-profile-name');
  const sidebarEmail = document.getElementById('sidebar-profile-email');
  const sidebarStatus = document.getElementById('sidebar-profile-status');
  const editUsernameInput = document.getElementById('edit-username-input');

  if (headerAvatar) headerAvatar.src = state.currentUser.avatar;
  if (headerUsername) headerUsername.textContent = state.currentUser.username;
  if (sidebarAvatar) sidebarAvatar.src = state.currentUser.avatar;
  if (sidebarName) sidebarName.textContent = state.currentUser.username;
  if (sidebarEmail) sidebarEmail.textContent = state.currentUser.email || 'user@crochit.app';
  if (sidebarStatus) sidebarStatus.textContent = `"${state.currentUser.statusMessage || 'Hey there! I am using Crochit.'}"`;
  if (editUsernameInput) editUsernameInput.value = state.currentUser.username;
}

// In-Place Database Update for Profile (Username & Password)
// IMPORTANT: Updates the existing record by user ID; does NOT create duplicate records!
function handleUpdateProfile(event) {
  event.preventDefault();

  const newUsernameInput = document.getElementById('edit-username-input');
  const newPasswordInput = document.getElementById('edit-password-input');
  const statusEl = document.getElementById('update-profile-status');

  const newUsername = newUsernameInput ? newUsernameInput.value.trim() : '';
  const newPassword = newPasswordInput ? newPasswordInput.value.trim() : '';

  if (!newUsername) {
    alert("Please enter a valid username.");
    return;
  }

  // Fetch current user list from localStorage
  let users = [];
  try {
    users = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
  } catch (e) {
    users = [];
  }

  // Find the exact index of this user in the database
  const userIndex = users.findIndex(u => u.id === state.currentUser.id);

  if (userIndex !== -1) {
    // UPDATE IN-PLACE: Modify existing record
    users[userIndex].username = newUsername;
    if (newPassword) {
      users[userIndex].password = newPassword;
    }
    // Sync state
    state.currentUser = users[userIndex];
  } else {
    // If not found, update current user object and add to list
    state.currentUser.username = newUsername;
    if (newPassword) state.currentUser.password = newPassword;
    users.push(state.currentUser);
  }

  // Persist updated records back to DB
  localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
  localStorage.setItem(DB_SESSION_KEY, JSON.stringify(state.currentUser));

  // If Supabase cloud database is connected, update there too
  if (state.supabaseClient && state.currentUser.email) {
    try {
      state.supabaseClient
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', state.currentUser.id)
        .then(() => console.log("Cloud profile synced."));
    } catch (e) {
      console.warn("Supabase sync:", e);
    }
  }

  // Update UI Elements
  renderProfileData();

  if (newPasswordInput) newPasswordInput.value = '';

  // Show confirmation status
  if (statusEl) {
    statusEl.textContent = `✓ Account updated in-place (${newUsername})! No duplicate records.`;
    statusEl.classList.remove('hidden');
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 4000);
  }
}

// Change Avatar Prompt
function changeAvatarPrompt() {
  const newAvatarUrl = prompt("Enter new Avatar Image URL (e.g. Unsplash or direct link):", state.currentUser.avatar);
  if (newAvatarUrl && newAvatarUrl.trim() !== '') {
    let users = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
    const idx = users.findIndex(u => u.id === state.currentUser.id);
    if (idx !== -1) {
      users[idx].avatar = newAvatarUrl.trim();
      state.currentUser.avatar = newAvatarUrl.trim();
      localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
      localStorage.setItem(DB_SESSION_KEY, JSON.stringify(state.currentUser));
      renderProfileData();
    }
  }
}

// ==================== 2. SIDEBAR TAB NAVIGATION ====================
function switchSidebarTab(tabName) {
  state.sidebarTab = tabName;

  const btnChats = document.getElementById('tab-btn-chats');
  const btnStatus = document.getElementById('tab-btn-status');
  const btnProfile = document.getElementById('tab-btn-profile');

  const viewChats = document.getElementById('sidebar-view-chats');
  const viewStatus = document.getElementById('sidebar-view-status');
  const viewProfile = document.getElementById('sidebar-view-profile');
  const searchContainer = document.getElementById('chats-search-container');

  // Reset tab button styles
  const activeClass = "px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold flex items-center gap-1.5 transition";
  const inactiveClass = "px-3 py-1.5 rounded-lg text-gray-400 hover:text-white flex items-center gap-1.5 transition";

  if (btnChats) btnChats.className = (tabName === 'chats') ? activeClass : inactiveClass;
  if (btnStatus) btnStatus.className = (tabName === 'status') ? activeClass : inactiveClass;
  if (btnProfile) btnProfile.className = (tabName === 'profile') ? activeClass : inactiveClass;

  // Toggle View Panes
  if (viewChats) viewChats.classList.toggle('hidden', tabName !== 'chats');
  if (viewStatus) viewStatus.classList.toggle('hidden', tabName !== 'status');
  if (viewProfile) viewProfile.classList.toggle('hidden', tabName !== 'profile');
  if (searchContainer) searchContainer.classList.toggle('hidden', tabName !== 'chats');

  // Mobile layout adjustment
  const sidebarPane = document.getElementById('chat-sidebar-pane');
  const activePane = document.getElementById('chat-active-pane');
  if (window.innerWidth < 768) {
    if (sidebarPane) sidebarPane.classList.remove('hidden');
    if (activePane) activePane.classList.add('hidden');
  }

  // Refresh icons
  if (window.lucide) lucide.createIcons();
}

// ==================== 3. CONVERSATIONS & CHAT LIST ====================
function renderConversationsList() {
  const container = document.getElementById('conversations-list-container');
  if (!container) return;

  const query = state.searchQuery.toLowerCase();
  const filteredChats = state.chatsList.filter(chat => {
    return chat.name.toLowerCase().includes(query) ||
      (chat.messages && chat.messages.some(m => m.text && m.text.toLowerCase().includes(query)));
  });

  if (filteredChats.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-gray-400 space-y-2">
        <i data-lucide="message-square-dashed" class="w-8 h-8 mx-auto text-gray-500"></i>
        <p class="text-xs">No conversations found.</p>
        <button onclick="openNewChatModal()" class="text-xs text-emerald-400 hover:underline font-semibold">
          Start a new chat
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let html = '';
  filteredChats.forEach(chat => {
    const isActive = chat.id === state.activeChatId;
    const lastMsg = (chat.messages && chat.messages.length > 0)
      ? chat.messages[chat.messages.length - 1]
      : { text: "No messages yet", time: "", sender: "" };

    const activeClasses = isActive
      ? "bg-[#202c33] border-l-4 border-emerald-500"
      : "hover:bg-[#16222a] border-l-4 border-transparent";

    // Tick indicator for me
    let tickHtml = '';
    if (lastMsg.sender === 'me') {
      const isRead = lastMsg.status === 'read';
      const tickColor = isRead ? 'text-[#53bdeb]' : 'text-gray-400';
      tickHtml = `<span class="${tickColor} text-xs font-bold mr-1">✓✓</span>`;
    }

    const unreadHtml = (chat.unreadCount && chat.unreadCount > 0 && !isActive)
      ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-bold shrink-0">${chat.unreadCount}</span>`
      : '';

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
              <span class="truncate">${lastMsg.text || 'Photo / Voice'}</span>
            </p>
            ${unreadHtml}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// Select a Chat & Open in Active Conversation Pane
function selectChat(chatId) {
  state.activeChatId = chatId;

  const chat = state.chatsList.find(c => c.id === chatId);
  if (!chat) return;

  // Mark unread messages as read
  chat.unreadCount = 0;
  if (chat.messages) {
    chat.messages.forEach(m => {
      if (m.sender !== 'me') m.status = 'read';
    });
  }
  saveChatsToStorage();

  // Mobile layout switch
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
  const activeAvatar = document.getElementById('active-chat-avatar');
  const activeName = document.getElementById('active-chat-name');
  const activeStatus = document.getElementById('active-chat-status');
  const onlineDot = document.getElementById('active-chat-online-dot');

  if (activeAvatar) activeAvatar.src = chat.avatar;
  if (activeName) activeName.textContent = chat.name;
  if (activeStatus) activeStatus.textContent = chat.online ? 'Online' : (chat.lastSeen || 'Offline');
  if (onlineDot) onlineDot.classList.toggle('hidden', !chat.online);

  // Render Messages
  renderActiveChatMessages();
  renderConversationsList();

  // Focus message input
  const input = document.getElementById('chat-message-input');
  if (input && window.innerWidth >= 768) {
    input.focus();
  }
}

// Mobile Back to Chats List
function backToChatsListMobile() {
  const sidebarPane = document.getElementById('chat-sidebar-pane');
  const activePane = document.getElementById('chat-active-pane');
  if (sidebarPane) sidebarPane.classList.remove('hidden');
  if (activePane) {
    activePane.classList.add('hidden');
    activePane.classList.remove('flex');
  }
}

// Render Messages for Active Chat
function renderActiveChatMessages() {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat || !chat.messages || chat.messages.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div class="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
          <i data-lucide="shield-check" class="w-7 h-7"></i>
        </div>
        <div class="space-y-1">
          <h4 class="font-bold text-white text-sm">End-to-End Encrypted</h4>
          <p class="text-xs text-gray-400 max-w-xs">Messages are securely sent directly between participants on Crochit.</p>
        </div>
        <div class="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300">
          Say hi to start the conversation! 👋
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let html = `
    <div class="text-center my-3">
      <span class="px-3 py-1 rounded-full bg-[#182229] border border-white/5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
        End-to-End Encrypted
      </span>
    </div>
  `;

  chat.messages.forEach(msg => {
    const isMe = msg.sender === 'me';
    const bubbleClass = isMe ? 'bubble-me text-white' : 'bubble-them text-[#e9edef]';
    const alignClass = isMe ? 'justify-end' : 'justify-start';

    // Status ticks for me
    let tickHtml = '';
    if (isMe) {
      const isRead = msg.status === 'read';
      const tickColor = isRead ? 'text-[#53bdeb]' : 'text-gray-300';
      tickHtml = `<span class="${tickColor} text-xs font-bold">✓✓</span>`;
    }

    // Sender title for group chats
    let groupSenderHtml = '';
    if (chat.isGroup && !isMe) {
      const senderName = msg.sender || 'Member';
      groupSenderHtml = `<div class="text-[11px] font-bold text-purple-400 mb-0.5">${senderName}</div>`;
    }

    // Photo attachment preview if message has image
    let imageAttachmentHtml = '';
    if (msg.image) {
      imageAttachmentHtml = `
        <div class="mb-1.5 rounded-lg overflow-hidden border border-white/10 max-w-xs">
          <img src="${msg.image}" alt="Attachment" class="w-full h-auto object-cover max-h-56 cursor-pointer hover:scale-[1.02] transition" onclick="window.open('${msg.image}', '_blank')" />
        </div>
      `;
    }

    // Voice note waveform preview if message is voice note
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
              <span class="w-1 h-4 bg-emerald-400 rounded-full"></span>
              <span class="w-1 h-2 bg-emerald-400 rounded-full"></span>
            </div>
            <div class="text-[10px] text-gray-300 font-mono">0:14 • Voice Message</div>
          </div>
        </div>
      `;
    }

    html += `
      <div class="flex ${alignClass} mb-2 animate-slide-up">
        <div class="max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl shadow-md ${bubbleClass} space-y-1 relative">
          ${groupSenderHtml}
          ${imageAttachmentHtml}
          ${voiceNoteHtml}
          ${msg.text ? `<p class="text-xs sm:text-sm leading-relaxed select-text">${escapeHtml(msg.text)}</p>` : ''}
          <div class="flex items-center justify-end gap-1.5 text-[10px] text-gray-300/80 pt-0.5">
            <span>${msg.time || ''}</span>
            ${tickHtml}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();

  // Scroll to bottom
  scrollToBottom();
}

// Auto Scroll helper
function scrollToBottom() {
  const container = document.getElementById('chat-messages-container');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// ==================== 4. SENDING & RECEIVING MESSAGES ====================
function sendCurrentMessage() {
  const input = document.getElementById('chat-message-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  postMessageToActiveChat({
    text: text,
    sender: 'me',
    isVoiceNote: false
  });

  input.value = '';
}

// Generic Message Dispatcher
function postMessageToActiveChat({ text, sender = 'me', image = null, isVoiceNote = false }) {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) return;

  const newMsg = {
    id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    sender: sender,
    time: getCurrentTimeFormatted(),
    text: text || '',
    image: image || null,
    isVoiceNote: !!isVoiceNote,
    status: 'delivered'
  };

  if (!chat.messages) chat.messages = [];
  chat.messages.push(newMsg);

  saveChatsToStorage();
  renderActiveChatMessages();
  renderConversationsList();

  // Send over WebRTC Peer Connection if open
  if (state.activePeerConn && state.activePeerConn.open) {
    try {
      state.activePeerConn.send({
        type: 'chat_message',
        chatId: chat.id,
        senderName: state.currentUser.username,
        message: newMsg
      });
    } catch (e) {
      console.warn("Peer send error:", e);
    }
  }

  // Broadcast to other tabs on same device
  if (state.broadcastChannel) {
    try {
      state.broadcastChannel.postMessage({
        type: 'chat_message',
        chatId: chat.id,
        senderName: state.currentUser.username,
        message: newMsg
      });
    } catch (e) {
      console.warn("Broadcast error:", e);
    }
  }

  // If user sent a message to a simulated contact, trigger realistic bot reply!
  if (sender === 'me' && (!state.activePeerConn || !state.activePeerConn.open)) {
    triggerSimulatedReply(chat, text);
  }
}

// Simulated Smart Reply for Default Contacts
function triggerSimulatedReply(chat, userText) {
  const typingIndicator = document.getElementById('typing-indicator');
  const typingText = document.getElementById('typing-text');

  if (typingIndicator) {
    if (typingText) typingText.textContent = `${chat.name} is typing...`;
    typingIndicator.classList.remove('hidden');
    scrollToBottom();
  }

  setTimeout(() => {
    if (typingIndicator) typingIndicator.classList.add('hidden');

    // Mark previous user message as read (blue ticks)
    if (chat.messages && chat.messages.length > 0) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg.sender === 'me') {
        lastMsg.status = 'read';
      }
    }

    // Formulate contextual reply
    let replyText = "Awesome! Crochit pe chatting ka maza hi alag hai. Instant & zero lag! 🚀";
    const lower = (userText || '').toLowerCase();

    if (lower.includes('kaise') || lower.includes('kaisa') || lower.includes('how')) {
      replyText = "Main ekdum badhiya hoon bhai! Tum batao, kya chal raha hai?";
    } else if (lower.includes('meet') || lower.includes('plan') || lower.includes('kab')) {
      replyText = "Done! Shaam 6 baje connect karte hain. Link share kar dena!";
    } else if (lower.includes('project') || lower.includes('code') || lower.includes('git')) {
      replyText = "Maine changes check kar liye hain, deployment ekdum solid ho gaya hai 👍";
    } else if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
      replyText = `Hey ${state.currentUser.username || 'bro'}! Kaisa hai? Sab badhiya?`;
    }

    const replyMsg = {
      id: 'msg_reply_' + Date.now(),
      sender: chat.isGroup ? 'Aman' : 'them',
      time: getCurrentTimeFormatted(),
      text: replyText,
      status: 'read'
    };

    chat.messages.push(replyMsg);
    saveChatsToStorage();
    renderActiveChatMessages();
    renderConversationsList();
  }, 1200);
}

// Quick Emoji Insert
function insertQuickEmoji(emoji) {
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.value += emoji;
    input.focus();
  }
}

// Attach Sample Photo
function attachSamplePhoto() {
  const samplePhotos = [
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80"
  ];
  const photo = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];

  postMessageToActiveChat({
    text: "Check out this photo 📸",
    sender: 'me',
    image: photo
  });
}

// Voice Note Simulation
function sendVoiceNote() {
  postMessageToActiveChat({
    text: "",
    sender: 'me',
    isVoiceNote: true
  });
}

// Clear Current Chat History
function clearCurrentChatHistory() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  if (!chat) return;

  if (confirm(`Clear all messages with ${chat.name}?`)) {
    chat.messages = [];
    saveChatsToStorage();
    renderActiveChatMessages();
    renderConversationsList();
  }
}

// Save Chats to LocalStorage
function saveChatsToStorage() {
  try {
    localStorage.setItem(DB_CHATS_KEY, JSON.stringify(state.chatsList));
  } catch (e) {
    console.warn("Storage quota or error saving chats:", e);
  }
}

// Helper: Formatted Time
function getCurrentTimeFormatted() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

// ==================== 5. REAL-TIME P2P WEBRTC (PEERJS) ====================
function initPeerJSEngine() {
  // Generate or retrieve persistent Peer ID
  let peerId = localStorage.getItem('crochit_peer_id_v1');
  if (!peerId) {
    peerId = 'crochit-' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem('crochit_peer_id_v1', peerId);
  }

  try {
    const peer = new Peer(peerId, {
      debug: 1
    });

    state.peerInstance = peer;

    peer.on('open', (id) => {
      state.myPeerId = id;
      updatePeerIdDisplay(id);

      // Check URL parameters for direct invite link (?peer=XYZ)
      const urlParams = new URLSearchParams(window.location.search);
      const targetPeer = urlParams.get('peer');
      if (targetPeer && targetPeer !== id) {
        setTimeout(() => {
          connectToPeer(targetPeer);
        }, 800);
      }
    });

    // Handle Incoming Peer Connection
    peer.on('connection', (conn) => {
      state.activePeerConn = conn;
      setupPeerDataListeners(conn);
      showToastNotification(`Real person connected! (ID: ${conn.peer})`);
    });

    peer.on('error', (err) => {
      console.warn("PeerJS notice:", err);
      updatePeerIdDisplay(peerId);
    });

  } catch (e) {
    console.warn("PeerJS init:", e);
    state.myPeerId = peerId;
    updatePeerIdDisplay(peerId);
  }
}

// Update Peer ID in UI
function updatePeerIdDisplay(id) {
  const headerPeerIdEl = document.getElementById('my-peer-id');
  const modalMyIdEl = document.getElementById('modal-my-id');

  if (headerPeerIdEl) headerPeerIdEl.textContent = id;
  if (modalMyIdEl) modalMyIdEl.textContent = id;
}

// Connect to a Friend by Peer ID
function connectToPeer(targetId) {
  if (!state.peerInstance) {
    alert("P2P Engine is still starting. Please try again in 2 seconds.");
    return;
  }

  const cleanTarget = targetId.trim();
  if (!cleanTarget) return;

  const conn = state.peerInstance.connect(cleanTarget);
  state.activePeerConn = conn;

  conn.on('open', () => {
    setupPeerDataListeners(conn);
    showToastNotification(`Connected to friend (${cleanTarget})!`);

    // Create or select conversation for this peer
    ensureConversationForPeer(cleanTarget);
  });

  conn.on('error', (err) => {
    alert("Connection error: " + err);
  });
}

// Setup Data Listeners for WebRTC Connection
function setupPeerDataListeners(conn) {
  conn.on('data', (data) => {
    if (data.type === 'chat_message') {
      const incomingMsg = data.message;
      incomingMsg.sender = 'them'; // received

      // Find or create conversation for this peer
      const targetChat = ensureConversationForPeer(conn.peer, data.senderName);
      targetChat.messages.push(incomingMsg);

      saveChatsToStorage();

      if (state.activeChatId === targetChat.id) {
        renderActiveChatMessages();
      } else {
        targetChat.unreadCount = (targetChat.unreadCount || 0) + 1;
      }
      renderConversationsList();
      playNotificationSound();
    }
  });

  conn.on('close', () => {
    showToastNotification(`Peer ${conn.peer} disconnected.`);
  });
}

// Helper: Ensure a conversation exists for a peer
function ensureConversationForPeer(peerId, customName = null) {
  const chatId = 'peer_' + peerId;
  let chat = state.chatsList.find(c => c.id === chatId);

  if (!chat) {
    chat = {
      id: chatId,
      name: customName || `Peer (${peerId.substring(0, 10)})`,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      online: true,
      lastSeen: "Live P2P Connection",
      unreadCount: 0,
      isGroup: false,
      messages: []
    };
    state.chatsList.unshift(chat);
    saveChatsToStorage();
  }

  selectChat(chatId);
  return chat;
}

// Copy My Peer ID
function copyMyId() {
  const id = state.myPeerId || 'crochit-local';
  navigator.clipboard.writeText(id).then(() => {
    showToastNotification("✓ Peer ID copied to clipboard!");
  }).catch(() => {
    prompt("Copy your Crochit Peer ID:", id);
  });
}

// Copy Direct Invite Link
function copyInviteLink() {
  const id = state.myPeerId || 'crochit-user';
  const url = `${window.location.origin}${window.location.pathname}?peer=${id}`;
  navigator.clipboard.writeText(url).then(() => {
    showToastNotification("✓ Shareable invite link copied! Send to a friend to chat live.");
  }).catch(() => {
    prompt("Copy your invite link:", url);
  });
}

// Test in New Tab (Multi-tab side-by-side chatting)
function testInNewTab() {
  const url = `${window.location.origin}${window.location.pathname}`;
  window.open(url, '_blank');
}

// Broadcast Channel for Multi-Tab Instant Sync on Same Device
function initBroadcastChannel() {
  try {
    state.broadcastChannel = new BroadcastChannel('crochit_p2p_channel');
    state.broadcastChannel.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'chat_message') {
        const chat = state.chatsList.find(c => c.id === data.chatId);
        if (chat) {
          const remoteMsg = { ...data.message, sender: 'them' };
          chat.messages.push(remoteMsg);
          saveChatsToStorage();
          if (state.activeChatId === chat.id) {
            renderActiveChatMessages();
          } else {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
          }
          renderConversationsList();
          playNotificationSound();
        }
      }
    };
  } catch (e) {
    console.warn("BroadcastChannel not supported:", e);
  }
}

// ==================== 6. MODALS MANAGEMENT ====================
// Connect Modal
function openConnectModal() {
  const modal = document.getElementById('connect-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeConnectModal() {
  const modal = document.getElementById('connect-modal');
  if (modal) modal.classList.add('hidden');
}

function connectToFriendFromModal() {
  const input = document.getElementById('friend-peer-input');
  if (!input) return;

  const targetId = input.value.trim();
  if (!targetId) {
    alert("Please enter friend's Crochit ID.");
    return;
  }

  connectToPeer(targetId);
  closeConnectModal();
  input.value = '';
}

// New Chat Modal
function openNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) modal.classList.add('hidden');
}

function createNewConversation() {
  const nameInput = document.getElementById('new-contact-name');
  const isGroupInput = document.getElementById('new-chat-is-group');

  const name = nameInput ? nameInput.value.trim() : '';
  const isGroup = isGroupInput ? isGroupInput.checked : false;

  if (!name) {
    alert("Please enter a name or group title.");
    return;
  }

  const avatar = isGroup
    ? "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80"
    : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";

  const newChat = {
    id: 'chat_' + Date.now(),
    name: name,
    avatar: avatar,
    online: true,
    lastSeen: isGroup ? "Group Created" : "Just Joined",
    unreadCount: 0,
    isGroup: isGroup,
    messages: [
      {
        id: 'msg_init_' + Date.now(),
        sender: 'them',
        time: getCurrentTimeFormatted(),
        text: isGroup ? `Group "${name}" created on Crochit.` : `Hi! Let's chat on Crochit.`,
        status: 'read'
      }
    ]
  };

  state.chatsList.unshift(newChat);
  saveChatsToStorage();
  closeNewChatModal();
  if (nameInput) nameInput.value = '';
  if (isGroupInput) isGroupInput.checked = false;

  selectChat(newChat.id);
}

// ==================== 7. 24-HOUR STATUS STORIES ====================
function renderMiniStatusBar() {
  const container = document.getElementById('mini-status-bar');
  if (!container) return;

  let html = '';
  state.statusesList.forEach(status => {
    const ringClass = status.hasUnseen ? 'status-ring-unseen' : 'status-ring-seen';
    html += `
      <div 
        onclick="openStatusViewer('${status.id}')"
        class="flex flex-col items-center gap-1 cursor-pointer shrink-0 group"
      >
        <div class="relative p-0.5">
          <img 
            src="${status.avatar}" 
            alt="${status.userName}" 
            class="w-10 h-10 rounded-full object-cover ${ringClass} group-hover:scale-105 transition"
          />
        </div>
        <span class="text-[10px] text-gray-300 font-medium truncate max-w-[56px] text-center">
          ${status.isMe ? 'You' : status.userName.split(' ')[0]}
        </span>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderFullStatusList() {
  const container = document.getElementById('full-status-list');
  if (!container) return;

  let html = '';
  state.statusesList.forEach(status => {
    const ringClass = status.hasUnseen ? 'status-ring-unseen' : 'status-ring-seen';
    html += `
      <div 
        onclick="openStatusViewer('${status.id}')"
        class="p-3 rounded-2xl bg-[#16222a] border border-white/5 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition"
      >
        <img src="${status.avatar}" class="w-11 h-11 rounded-full object-cover ${ringClass}" alt="${status.userName}" />
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-white truncate">${status.userName}</h4>
          <p class="text-[11px] text-gray-400 truncate">${status.time}</p>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-gray-500"></i>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function openStatusViewer(statusId) {
  const status = state.statusesList.find(s => s.id === statusId);
  if (!status) return;

  const modal = document.getElementById('status-viewer-modal');
  const avatar = document.getElementById('status-viewer-avatar');
  const name = document.getElementById('status-viewer-name');
  const time = document.getElementById('status-viewer-time');
  const text = document.getElementById('status-viewer-text');
  const progressBar = document.getElementById('status-progress-bar');

  if (avatar) avatar.src = status.avatar;
  if (name) name.textContent = status.userName;
  if (time) time.textContent = status.time;
  if (text) text.textContent = `"${status.textStatus || 'No text status'}"`;

  if (modal) modal.classList.remove('hidden');

  // Mark status seen
  status.hasUnseen = false;
  saveStatusesToStorage();
  renderMiniStatusBar();
  renderFullStatusList();

  // Progress Bar Animation
  if (progressBar) {
    progressBar.classList.remove('duration-[4000ms]', 'w-full');
    progressBar.classList.add('w-0');
    setTimeout(() => {
      progressBar.classList.add('duration-[4000ms]', 'w-full');
    }, 50);
  }

  // Auto Close after 4 seconds
  clearTimeout(state.statusTimer);
  state.statusTimer = setTimeout(() => {
    closeStatusViewer();
  }, 4100);
}

function closeStatusViewer() {
  clearTimeout(state.statusTimer);
  const modal = document.getElementById('status-viewer-modal');
  if (modal) modal.classList.add('hidden');
}

function triggerAddStatusPrompt() {
  const newText = prompt("Enter your new 24h Status Update:");
  if (newText && newText.trim()) {
    const myStatus = state.statusesList.find(s => s.isMe);
    if (myStatus) {
      myStatus.textStatus = newText.trim();
      myStatus.time = "Just now";
      myStatus.hasUnseen = true;
    } else {
      state.statusesList.unshift({
        id: 'st_' + Date.now(),
        userName: state.currentUser.username,
        avatar: state.currentUser.avatar,
        isMe: true,
        time: "Just now",
        hasUnseen: true,
        textStatus: newText.trim()
      });
    }
    saveStatusesToStorage();
    renderMiniStatusBar();
    renderFullStatusList();
    showToastNotification("✓ Status update posted!");
  }
}

function saveStatusesToStorage() {
  try {
    localStorage.setItem(DB_STATUSES_KEY, JSON.stringify(state.statusesList));
  } catch (e) {
    console.warn("Error saving statuses:", e);
  }
}

// ==================== 8. CLOUD DATABASE & AUTHENTICATION ====================
function initSupabase() {
  try {
    const configStr = localStorage.getItem(DB_SUPABASE_KEY);
    if (configStr) {
      const config = JSON.parse(configStr);
      if (config.url && config.key && window.supabase) {
        state.supabaseClient = window.supabase.createClient(config.url, config.key);
        console.log("Supabase initialized successfully.");
      }
    }
  } catch (e) {
    console.warn("Supabase init notice:", e);
  }
}

function toggleDatabaseConfigForm() {
  const box = document.getElementById('database-config-box');
  if (box) box.classList.toggle('hidden');
}

function saveSupabaseConfig() {
  const urlInput = document.getElementById('supabase-url-input');
  const keyInput = document.getElementById('supabase-key-input');

  const url = urlInput ? urlInput.value.trim() : '';
  const key = keyInput ? keyInput.value.trim() : '';

  if (!url || !key) {
    alert("Please enter both Supabase URL and Anon Key.");
    return;
  }

  localStorage.setItem(DB_SUPABASE_KEY, JSON.stringify({ url, key }));
  initSupabase();
  toggleDatabaseConfigForm();
  alert("Supabase Cloud Database keys saved successfully!");
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

function toggleAuthMode(mode) {
  state.authMode = mode;
  const isSignIn = mode === 'signin';

  const btnSignIn = document.getElementById('auth-toggle-signin');
  const btnSignUp = document.getElementById('auth-toggle-signup');
  const userField = document.getElementById('auth-username-field');
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (btnSignIn) btnSignIn.className = isSignIn ? "flex-1 py-1.5 rounded-lg bg-emerald-500 text-black font-bold" : "flex-1 py-1.5 rounded-lg text-gray-400";
  if (btnSignUp) btnSignUp.className = !isSignIn ? "flex-1 py-1.5 rounded-lg bg-emerald-500 text-black font-bold" : "flex-1 py-1.5 rounded-lg text-gray-400";
  if (userField) userField.classList.toggle('hidden', isSignIn);
  if (title) title.textContent = isSignIn ? "Sign In to Crochit" : "Create Crochit Account";
  if (submitBtn) submitBtn.textContent = isSignIn ? "Sign In" : "Sign Up";
}

function handleAuthSubmit(event) {
  event.preventDefault();

  const emailInput = document.getElementById('auth-email-input');
  const passwordInput = document.getElementById('auth-password-input');
  const usernameInput = document.getElementById('auth-username-input');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const username = usernameInput ? usernameInput.value.trim() : 'Crochit User';

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  let users = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];

  if (state.authMode === 'signup') {
    // Check if user already exists
    const existing = users.find(u => u.email === email);
    if (existing) {
      alert("An account with this email already exists. Please Sign In.");
      return;
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      username: username,
      email: email,
      password: password,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      statusMessage: "Hey there! I am using Crochit."
    };

    users.push(newUser);
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
    state.currentUser = newUser;
    localStorage.setItem(DB_SESSION_KEY, JSON.stringify(newUser));
    showToastNotification(`Welcome to Crochit, ${username}!`);
  } else {
    // Sign In: Find user in local database
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) {
      alert("Invalid email or password.");
      return;
    }
    state.currentUser = found;
    localStorage.setItem(DB_SESSION_KEY, JSON.stringify(found));
    showToastNotification(`Signed in as ${found.username}!`);
  }

  renderProfileData();
  closeAuthModal();
}

// ==================== 9. CALLS & NOTIFICATIONS ====================
function triggerVoiceCall() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  const name = chat ? chat.name : "Contact";
  alert(`📞 Crochit Voice Call:\nCalling ${name} via secure P2P WebRTC audio stream...`);
}

function triggerVideoCall() {
  const chat = state.chatsList.find(c => c.id === state.activeChatId);
  const name = chat ? chat.name : "Contact";
  alert(`📹 Crochit Video Call:\nCalling ${name} via secure P2P WebRTC video stream...`);
}

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    // Audio context may require user interaction
  }
}

function showToastNotification(message) {
  const existing = document.getElementById('crochit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'crochit-toast';
  toast.className = "fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs shadow-xl animate-slide-up flex items-center gap-2";
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// ==================== 10. EVENT LISTENERS ====================
function setupEventListeners() {
  // Enter key to send message
  const chatInput = document.getElementById('chat-message-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendCurrentMessage();
      }
    });
  }

  // Search input filter
  const searchInput = document.getElementById('chat-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderConversationsList();
    });
  }
}

// Utility: HTML Sanitizer
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
