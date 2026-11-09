// Creovate Play - Instagram Reels & Real-Time P2P Chat Engine
// PeerJS + BroadcastChannel + Instagram Embeds

let state = {
  currentView: 'reels',
  activeCategory: 'All Reels',
  myPeerId: null,
  activePeerConn: null,
  connectedPeerId: null,
  dualMode: false,
  broadcastChannel: null,
  activeMiniReel: null
};

// Storage Keys
const REELS_STORAGE_KEY = 'creovate_reels_data_v2';
const CHAT_STORAGE_KEY = 'creovate_real_chat_history_v2';

document.addEventListener('DOMContentLoaded', () => {
  initReelsData();
  initP2PEngine();
  renderCategories();
  renderReels();
  renderChatHistory();
  setupEventListeners();

  // Initialize Lucide icons
  lucide.createIcons();
});

// ==================== DATA INIT ====================
function initReelsData() {
  if (!localStorage.getItem(REELS_STORAGE_KEY)) {
    localStorage.setItem(REELS_STORAGE_KEY, JSON.stringify(CREOVATE_DATA.instagramReels));
  }
}

function getReels() {
  const stored = localStorage.getItem(REELS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : CREOVATE_DATA.instagramReels;
}

function saveReels(reels) {
  localStorage.setItem(REELS_STORAGE_KEY, JSON.stringify(reels));
}

function getChatHistory() {
  const stored = localStorage.getItem(CHAT_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveChatHistory(history) {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
}

// ==================== REAL-TIME P2P ENGINE (PEERJS + BROADCAST) ====================
function initP2PEngine() {
  // 1. Setup multi-tab BroadcastChannel for instant local testing
  try {
    state.broadcastChannel = new BroadcastChannel('creovate_p2p_channel');
    state.broadcastChannel.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'MESSAGE' && data.senderId !== state.myPeerId) {
        handleIncomingMessage(data.payload);
      } else if (data && data.type === 'PING') {
        onPeerConnected('Tab Peer (Real Person)');
      }
    };
  } catch (err) {
    console.log('BroadcastChannel fallback setup:', err);
  }

  // 2. Setup PeerJS for internet-wide P2P communication between real people
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const myGeneratedId = 'creo-' + randomSuffix;

  try {
    const peer = new Peer(myGeneratedId, {
      debug: 1
    });

    peer.on('open', (id) => {
      state.myPeerId = id;
      updateMyIdDisplay(id);

      // Check if URL has ?connect=ID to auto-connect
      const urlParams = new URLSearchParams(window.location.search);
      const connectTo = urlParams.get('connect');
      if (connectTo && connectTo !== id) {
        setTimeout(() => {
          connectToPeer(connectTo);
        }, 800);
      }
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.log('PeerJS note:', err.type);
      // Fallback ID if server busy
      if (!state.myPeerId) {
        state.myPeerId = myGeneratedId;
        updateMyIdDisplay(myGeneratedId);
      }
    });

    window.creovatePeer = peer;
  } catch (err) {
    console.log('PeerJS fallback:', err);
    state.myPeerId = myGeneratedId;
    updateMyIdDisplay(myGeneratedId);
  }
}

function updateMyIdDisplay(id) {
  const el1 = document.getElementById('my-peer-id');
  const el2 = document.getElementById('modal-my-id');
  if (el1) el1.textContent = id;
  if (el2) el2.textContent = id;
}

function connectToPeer(friendId) {
  if (!friendId || friendId === state.myPeerId) {
    alert('Please enter a valid friend ID (different from your own ID)');
    return;
  }

  if (window.creovatePeer) {
    const conn = window.creovatePeer.connect(friendId);
    setupConnection(conn);
  } else {
    onPeerConnected(friendId);
  }
}

function setupConnection(conn) {
  state.activePeerConn = conn;
  state.connectedPeerId = conn.peer;

  conn.on('open', () => {
    onPeerConnected(conn.peer);
    // Notify via broadcast
    if (state.broadcastChannel) {
      state.broadcastChannel.postMessage({ type: 'PING', senderId: state.myPeerId });
    }
  });

  conn.on('data', (data) => {
    handleIncomingMessage(data);
  });

  conn.on('close', () => {
    onPeerDisconnected();
  });
}

function onPeerConnected(peerName) {
  const nameEl = document.getElementById('connected-person-name');
  const statusEl = document.getElementById('connected-person-status');
  const dotEl = document.getElementById('header-conn-status-dot');
  const helperBanner = document.getElementById('unconnected-helper-banner');
  const p2pIndicator = document.getElementById('p2p-status-indicator');
  const p2pInfo = document.getElementById('p2p-info-text');

  if (nameEl) nameEl.textContent = `Connected with ${peerName}`;
  if (statusEl) statusEl.textContent = '🟢 Online & Ready to chat in real-time';
  if (dotEl) {
    dotEl.classList.remove('bg-amber-400');
    dotEl.classList.add('bg-emerald-500');
  }
  if (helperBanner) helperBanner.classList.add('hidden');
  if (p2pIndicator) {
    p2pIndicator.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Connected';
    p2pIndicator.className = 'flex items-center gap-1 text-[11px] text-emerald-400 font-bold';
  }
  if (p2pInfo) {
    p2pInfo.textContent = `Connected with ${peerName}! Messages exchange directly end-to-end.`;
  }
}

function onPeerDisconnected() {
  const statusEl = document.getElementById('connected-person-status');
  const dotEl = document.getElementById('header-conn-status-dot');
  if (statusEl) statusEl.textContent = 'Peer disconnected. Waiting for connection...';
  if (dotEl) {
    dotEl.classList.remove('bg-emerald-500');
    dotEl.classList.add('bg-amber-400');
  }
}

function handleIncomingMessage(msgData) {
  const history = getChatHistory();
  history.push(msgData);
  saveChatHistory(history);
  appendMessageToUI(msgData);

  // If currently on reels view, show subtle notification dot
  if (state.currentView !== 'chat') {
    const badge = document.getElementById('real-peer-badge');
    if (badge) badge.classList.remove('hidden');
  }
}

// ==================== MESSAGING ====================
function sendRealMessage() {
  const input = document.getElementById('chat-message-input');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  input.value = '';

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Check if user pasted an Instagram Reel link directly into chat
  const igMatch = parseInstagramUrl(text);

  const newMsg = {
    id: 'msg_' + Date.now(),
    senderId: state.myPeerId,
    senderName: 'You',
    isMe: true,
    time: timeStr,
    text: text,
    isReel: !!igMatch,
    reelShortcode: igMatch ? igMatch : null,
    reelTitle: igMatch ? 'Shared Instagram Reel' : null
  };

  // Save to history
  const history = getChatHistory();
  history.push(newMsg);
  saveChatHistory(history);
  appendMessageToUI(newMsg);

  // Send to peer via WebRTC
  if (state.activePeerConn && state.activePeerConn.open) {
    const outgoing = { ...newMsg, isMe: false, senderName: 'Friend' };
    state.activePeerConn.send(outgoing);
  }

  // Also broadcast to other browser tabs
  if (state.broadcastChannel) {
    const outgoing = { ...newMsg, isMe: false, senderName: 'Friend' };
    state.broadcastChannel.postMessage({
      type: 'MESSAGE',
      senderId: state.myPeerId,
      payload: outgoing
    });
  }
}

function sendReelToChat(shortcode, title) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newMsg = {
    id: 'msg_' + Date.now(),
    senderId: state.myPeerId,
    senderName: 'You',
    isMe: true,
    time: timeStr,
    text: `Check out this Instagram Reel: ${title}`,
    isReel: true,
    reelShortcode: shortcode,
    reelTitle: title
  };

  const history = getChatHistory();
  history.push(newMsg);
  saveChatHistory(history);
  appendMessageToUI(newMsg);

  if (state.activePeerConn && state.activePeerConn.open) {
    const outgoing = { ...newMsg, isMe: false, senderName: 'Friend' };
    state.activePeerConn.send(outgoing);
  }

  if (state.broadcastChannel) {
    const outgoing = { ...newMsg, isMe: false, senderName: 'Friend' };
    state.broadcastChannel.postMessage({
      type: 'MESSAGE',
      senderId: state.myPeerId,
      payload: outgoing
    });
  }

  closeShareReelModal();
  switchView('chat');
}

function renderChatHistory() {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const history = getChatHistory();
  container.innerHTML = '';
  history.forEach(msg => appendMessageToUI(msg, false));
  container.scrollTop = container.scrollHeight;
}

function appendMessageToUI(msg, scroll = true) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const isMe = msg.isMe;
  const msgEl = document.createElement('div');
  msgEl.className = `flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up`;

  if (msg.isReel && msg.reelShortcode) {
    // Rich Instagram Card in Chat
    msgEl.innerHTML = `
      <div class="max-w-sm rounded-2xl p-3 ${isMe ? 'bubble-me text-white' : 'bubble-them text-gray-100'} shadow-lg border border-white/5 space-y-2">
        <div class="flex items-center gap-2 pb-1 border-b border-white/10">
          <i data-lucide="instagram" class="w-4 h-4 text-pink-400"></i>
          <span class="text-xs font-bold text-pink-300">Instagram Reel</span>
        </div>
        <p class="text-xs leading-snug font-medium">${msg.reelTitle || 'Instagram Reel Video'}</p>
        
        <!-- Reel Preview / Play Action -->
        <div class="relative aspect-video rounded-xl overflow-hidden bg-black/60 flex items-center justify-center group cursor-pointer" onclick="playReelInMini('${msg.reelShortcode}', '${msg.reelTitle || 'Instagram Reel'}')">
          <iframe 
            src="https://www.instagram.com/reel/${msg.reelShortcode}/embed/" 
            class="w-full h-full pointer-events-none" 
            scrolling="no" 
            frameborder="0"
          ></iframe>
          <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition">
            <div class="px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-pink-500/30">
              <i data-lucide="play" class="w-3.5 h-3.5 fill-white"></i>
              <span>Watch in PiP</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between text-[10px] text-gray-300/80 pt-1">
          <a href="https://www.instagram.com/reel/${msg.reelShortcode}/" target="_blank" class="hover:underline text-pink-300">Open on Instagram ↗</a>
          <div class="flex items-center gap-1">
            <span>${msg.time}</span>
            ${isMe ? '<span class="text-emerald-400">✓✓</span>' : ''}
          </div>
        </div>
      </div>
    `;
  } else {
    // Standard text message
    msgEl.innerHTML = `
      <div class="max-w-md rounded-2xl px-3.5 py-2.5 ${isMe ? 'bubble-me text-white' : 'bubble-them text-gray-100'} shadow-md border border-white/5 space-y-1">
        <p class="text-sm leading-relaxed">${escapeHtml(msg.text)}</p>
        <div class="flex items-center justify-end gap-1 text-[10px] text-gray-400">
          <span>${msg.time}</span>
          ${isMe ? '<span class="text-emerald-400">✓✓</span>' : ''}
        </div>
      </div>
    `;
  }

  container.appendChild(msgEl);
  if (scroll) container.scrollTop = container.scrollHeight;
  lucide.createIcons();
}

// ==================== INSTAGRAM REELS FEED ====================
function renderCategories() {
  const container = document.getElementById('category-chips-container');
  if (!container) return;

  container.innerHTML = CREOVATE_DATA.categories.map(cat => {
    const isActive = cat === state.activeCategory;
    return `
      <button 
        onclick="selectCategory('${cat}')" 
        class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
          isActive 
            ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/20' 
            : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
        }"
      >
        ${cat}
      </button>
    `;
  }).join('');
}

function selectCategory(cat) {
  state.activeCategory = cat;
  renderCategories();
  renderReels();
}

function renderReels() {
  const grid = document.getElementById('reels-grid');
  if (!grid) return;

  let reels = getReels();

  if (state.activeCategory !== 'All Reels') {
    reels = reels.filter(r => r.category === state.activeCategory);
  }

  grid.innerHTML = reels.map(reel => {
    return `
      <div class="bg-[#141416] border border-white/10 rounded-2xl overflow-hidden hover:border-pink-500/40 transition shadow-xl flex flex-col justify-between">
        <!-- Reel Header -->
        <div class="p-3.5 border-b border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5">
              <div class="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-white text-[10px]">
                IG
              </div>
            </div>
            <div>
              <h4 class="text-xs font-bold text-white leading-tight">${reel.creator}</h4>
              <span class="text-[10px] text-pink-400 font-medium">${reel.category}</span>
            </div>
          </div>

          <a href="https://www.instagram.com/reel/${reel.shortcode}/" target="_blank" class="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-pink-400 transition" title="Open on Instagram">
            <i data-lucide="external-link" class="w-4 h-4"></i>
          </a>
        </div>

        <!-- Instagram Embed Frame -->
        <div class="relative w-full bg-black aspect-[9/16] max-h-[460px] overflow-hidden flex items-center justify-center">
          <iframe 
            src="https://www.instagram.com/reel/${reel.shortcode}/embed/" 
            class="w-full h-full border-0" 
            scrolling="no" 
            allowtransparency="true"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          ></iframe>
        </div>

        <!-- Reel Footer & Action Row -->
        <div class="p-3 bg-[#17181c] border-t border-white/5 space-y-2.5">
          <p class="text-xs font-semibold text-gray-200 line-clamp-1">${reel.title}</p>
          
          <div class="flex items-center gap-2 pt-1 border-t border-white/5">
            <!-- Watch in Floating PiP -->
            <button 
              onclick="playReelInMini('${reel.shortcode}', '${reel.title}')" 
              class="flex-1 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-purple-500/30 transition"
              title="Watch reel in floating player while chatting"
            >
              <i data-lucide="minimize-2" class="w-3.5 h-3.5"></i>
              <span>Float & Chat</span>
            </button>

            <!-- Send to Connected Real Friend -->
            <button 
              onclick="sendReelToChat('${reel.shortcode}', '${reel.title}')" 
              class="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow transition"
              title="Send this reel directly to your connected friend"
            >
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
              <span>Send in Chat</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// ==================== ADD CUSTOM INSTAGRAM REEL ====================
function openAddReelModal() {
  document.getElementById('add-reel-modal').classList.remove('hidden');
}

function closeAddReelModal() {
  document.getElementById('add-reel-modal').classList.add('hidden');
}

function parseInstagramUrl(url) {
  if (!url) return null;
  // Match reel, p, or tv codes: instagram.com/reel/CODE/...
  const regex = /instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function addInstagramReel() {
  const urlInput = document.getElementById('new-reel-url-input');
  const titleInput = document.getElementById('new-reel-title-input');
  if (!urlInput || !urlInput.value.trim()) return;

  const url = urlInput.value.trim();
  const shortcode = parseInstagramUrl(url);

  if (!shortcode) {
    alert('Please enter a valid Instagram Reel or Post link (e.g. https://www.instagram.com/reel/C5nQ0q0L7f0/)');
    return;
  }

  const title = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : 'Linked Instagram Reel';

  const newReel = {
    id: 'ig_' + Date.now(),
    shortcode: shortcode,
    title: title,
    creator: '@instagram_user',
    likes: 'Trending',
    views: 'Live',
    category: state.activeCategory !== 'All Reels' ? state.activeCategory : 'Tech & Coding',
    caption: title,
    permalink: url
  };

  const reels = getReels();
  reels.unshift(newReel);
  saveReels(reels);

  urlInput.value = '';
  if (titleInput) titleInput.value = '';
  closeAddReelModal();

  renderReels();
  alert('Instagram Reel successfully added to Creovate Play!');
}

// ==================== FLOATING MINI-PLAYER (PIP) ====================
function playReelInMini(shortcode, title) {
  const player = document.getElementById('floating-mini-player');
  const iframe = document.getElementById('mini-reel-iframe');
  const titleEl = document.getElementById('mini-player-title');

  titleEl.textContent = title;
  iframe.src = `https://www.instagram.com/reel/${shortcode}/embed/`;
  player.classList.remove('hidden');
  state.activeMiniReel = shortcode;
}

function closeFloatingPlayer() {
  const player = document.getElementById('floating-mini-player');
  const iframe = document.getElementById('mini-reel-iframe');
  iframe.src = '';
  player.classList.add('hidden');
}

// ==================== SHARE REEL MODAL ====================
function openShareReelToChatModal() {
  const modal = document.getElementById('share-reel-modal');
  const list = document.getElementById('share-reels-picker-list');
  const reels = getReels();

  list.innerHTML = reels.map(r => `
    <div 
      onclick="sendReelToChat('${r.shortcode}', '${r.title}')" 
      class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition"
    >
      <div class="flex items-center gap-2.5 overflow-hidden">
        <i data-lucide="film" class="w-5 h-5 text-pink-400 shrink-0"></i>
        <div class="truncate">
          <h4 class="text-xs font-semibold text-white truncate">${r.title}</h4>
          <span class="text-[10px] text-gray-400">${r.creator}</span>
        </div>
      </div>
      <button class="px-3 py-1 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold shrink-0">
        Send
      </button>
    </div>
  `).join('');

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeShareReelModal() {
  document.getElementById('share-reel-modal').classList.add('hidden');
}

// ==================== CONNECT WITH REAL PERSON MODAL ====================
function openConnectModal() {
  document.getElementById('connect-modal').classList.remove('hidden');
}

function closeConnectModal() {
  document.getElementById('connect-modal').classList.add('hidden');
}

function connectToFriendFromModal() {
  const input = document.getElementById('friend-peer-input');
  if (!input || !input.value.trim()) return;

  const friendId = input.value.trim();
  connectToPeer(friendId);
  closeConnectModal();
  switchView('chat');
}

function copyMyId() {
  if (!state.myPeerId) return;
  navigator.clipboard.writeText(state.myPeerId).then(() => {
    alert(`Copied Your Creovate ID: ${state.myPeerId}\nSend this ID to your friend so they can connect with you!`);
  }).catch(() => {
    prompt('Copy your Creovate ID:', state.myPeerId);
  });
}

function copyInviteLink() {
  const url = `${window.location.origin}${window.location.pathname}?connect=${state.myPeerId}`;
  navigator.clipboard.writeText(url).then(() => {
    alert(`Copied Invite Link: \n${url}\nSend this link to a real person. As soon as they open it in their browser/phone, you both will connect in real time!`);
  }).catch(() => {
    prompt('Copy this invite link to send to a friend:', url);
  });
}

function testInNewTab() {
  const url = `${window.location.origin}${window.location.pathname}?connect=${state.myPeerId}`;
  window.open(url, '_blank');
}

// ==================== VIEW ROUTING ====================
function switchView(view) {
  state.currentView = view;
  const reelsView = document.getElementById('view-reels');
  const chatView = document.getElementById('view-chat');

  if (view === 'reels') {
    reelsView.classList.remove('hidden');
    chatView.classList.add('hidden');
    chatView.classList.remove('flex');
    updateTabBtnStyles('reels');
  } else {
    reelsView.classList.add('hidden');
    chatView.classList.remove('hidden');
    chatView.classList.add('flex');
    updateTabBtnStyles('chat');
    
    // Clear notification badge
    const badge = document.getElementById('real-peer-badge');
    if (badge) badge.classList.add('hidden');
  }

  lucide.createIcons();
}

function updateTabBtnStyles(active) {
  const btnReels = document.getElementById('tab-btn-reels');
  const btnChat = document.getElementById('tab-btn-chat');
  const mReels = document.getElementById('mobile-tab-reels');
  const mChat = document.getElementById('mobile-tab-chat');

  if (active === 'reels') {
    if (btnReels) btnReels.className = 'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition text-white bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 shadow-sm';
    if (btnChat) btnChat.className = 'w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition text-gray-400 hover:text-white hover:bg-white/5';
    if (mReels) { mReels.classList.add('text-pink-400'); mReels.classList.remove('text-gray-400'); }
    if (mChat) { mChat.classList.remove('text-purple-400'); mChat.classList.add('text-gray-400'); }
  } else {
    if (btnReels) btnReels.className = 'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition text-gray-400 hover:text-white hover:bg-white/5';
    if (btnChat) btnChat.className = 'w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-semibold transition text-white bg-gradient-to-r from-emerald-600/20 to-purple-600/20 border border-emerald-500/30 shadow-sm';
    if (mReels) { mReels.classList.remove('text-pink-400'); mReels.classList.add('text-gray-400'); }
    if (mChat) { mChat.classList.add('text-purple-400'); mChat.classList.remove('text-gray-400'); }
  }
}

function toggleDualMode() {
  state.dualMode = !state.dualMode;
  const reelsView = document.getElementById('view-reels');
  const chatView = document.getElementById('view-chat');
  const label = document.getElementById('dual-mode-label');

  if (state.dualMode) {
    reelsView.classList.remove('hidden');
    reelsView.classList.add('w-1/2', 'border-r', 'border-white/10');
    chatView.classList.remove('hidden');
    chatView.classList.add('w-1/2', 'flex');
    label.textContent = 'Single View';
  } else {
    reelsView.classList.remove('w-1/2', 'border-r', 'border-white/10');
    chatView.classList.remove('w-1/2');
    label.textContent = 'Dual View';
    switchView(state.currentView);
  }
}

function setupEventListeners() {
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendRealMessage();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConnectModal();
      closeAddReelModal();
      closeShareReelModal();
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
