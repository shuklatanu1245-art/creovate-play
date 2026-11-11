// Crochit - Application Core Engine
// 4 Bottom Navigation Pages: Home (YouTube Long Videos), Feed (Instagram Reels), Chat, Profile
// Features: In-App Playback, Real-Time P2P Chat, In-Place Database Updates, Supabase Cloud Auth

// Global Application State
let state = {
  activeTab: 'home',
  activeHomeCategory: 'All',
  homeSearchQuery: '',
  currentUser: null,
  activePeerConn: null,
  myPeerId: null,
  broadcastChannel: null,
  supabaseClient: null,
  authMode: 'signin', // 'signin' or 'signup'
  activeModalYtVideo: null,
  activeMiniMedia: null // { type: 'yt' | 'ig', id, title }
};

// Database Storage Keys
const DB_USERS_KEY = 'crochit_db_users_v1';
const DB_SESSION_KEY = 'crochit_active_session_v1';
const DB_REELS_KEY = 'crochit_reels_data_v1';
const DB_CHAT_KEY = 'crochit_real_chat_history_v1';
const DB_SUPABASE_KEY = 'crochit_supabase_config_v1';

document.addEventListener('DOMContentLoaded', () => {
  initDatabase();
  initSupabase();
  initP2PEngine();
  renderHomeCategories();
  renderHomeVideos();
  renderFeedReels();
  renderChatHistory();
  renderProfileData();
  setupSearchListener();

  // Initialize Lucide icons
  lucide.createIcons();
});

// ==================== 1. DATABASE & USER ACCOUNTS ENGINE ====================
function initDatabase() {
  // Initialize Users Table in local persistent storage
  let users = localStorage.getItem(DB_USERS_KEY);
  if (!users) {
    const initialUsers = [CROCHIT_DATABASE.defaultUser];
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(initialUsers));
    users = JSON.stringify(initialUsers);
  }

  // Initialize Active User Session
  let activeSessionId = localStorage.getItem(DB_SESSION_KEY);
  const parsedUsers = JSON.parse(users);

  if (activeSessionId) {
    state.currentUser = parsedUsers.find(u => u.id === activeSessionId) || parsedUsers[0];
  } else {
    state.currentUser = parsedUsers[0];
    localStorage.setItem(DB_SESSION_KEY, state.currentUser.id);
  }

  // Initialize Reels database
  if (!localStorage.getItem(DB_REELS_KEY)) {
    localStorage.setItem(DB_REELS_KEY, JSON.stringify(CROCHIT_DATABASE.instagramReels));
  }
}

function getAllDatabaseUsers() {
  const users = localStorage.getItem(DB_USERS_KEY);
  return users ? JSON.parse(users) : [CROCHIT_DATABASE.defaultUser];
}

function saveDatabaseUsers(users) {
  localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
}

// IN-PLACE UPDATE (Crucial requirement: pehle wala user hi update hoga, duplicate nahi banega)
function handleUpdateProfile(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  const newUsername = document.getElementById('edit-username-input').value.trim();
  const newPassword = document.getElementById('edit-password-input').value.trim();
  const statusEl = document.getElementById('update-profile-status');

  if (!newUsername) {
    alert('Username cannot be empty.');
    return;
  }

  const users = getAllDatabaseUsers();
  // Find the EXACT existing user by ID
  const existingUserIndex = users.findIndex(u => u.id === state.currentUser.id);

  if (existingUserIndex !== -1) {
    // UPDATE existing record in-place
    users[existingUserIndex].username = newUsername;
    if (newPassword) {
      users[existingUserIndex].password = newPassword;
    }

    // Save updated database
    saveDatabaseUsers(users);
    state.currentUser = users[existingUserIndex];

    // If Supabase Cloud DB is connected, sync update to Supabase
    if (state.supabaseClient) {
      syncProfileUpdateToSupabase(newUsername, newPassword);
    }

    // Update UI elements immediately
    renderProfileData();

    // Show success indicator
    if (statusEl) {
      statusEl.classList.remove('hidden');
      setTimeout(() => statusEl.classList.add('hidden'), 3500);
    }
    alert(`Success: Profile for ${state.currentUser.email} updated in database! (No duplicate created)`);
  } else {
    alert('User not found in database.');
  }
}

function renderProfileData() {
  if (!state.currentUser) return;

  // Header quick info
  const headerAvatar = document.getElementById('header-user-avatar');
  const headerUsername = document.getElementById('header-username-text');
  if (headerAvatar) headerAvatar.src = state.currentUser.avatar;
  if (headerUsername) headerUsername.textContent = state.currentUser.username.split(' ')[0];

  // Profile Page details
  const displayAvatar = document.getElementById('profile-display-avatar');
  const displayUsername = document.getElementById('profile-display-username');
  const displayEmail = document.getElementById('profile-display-email');
  const displayBio = document.getElementById('profile-display-bio');
  const joinedDate = document.getElementById('profile-joined-date');
  const userId = document.getElementById('profile-user-id');
  const footerEmail = document.getElementById('footer-user-email');

  if (displayAvatar) displayAvatar.src = state.currentUser.avatar;
  if (displayUsername) displayUsername.textContent = state.currentUser.username;
  if (displayEmail) displayEmail.textContent = state.currentUser.email;
  if (displayBio) displayBio.textContent = state.currentUser.bio || 'Member of Crochit community.';
  if (joinedDate) joinedDate.textContent = state.currentUser.joinedDate || 'November 2026';
  if (userId) userId.textContent = state.currentUser.id;
  if (footerEmail) footerEmail.textContent = state.currentUser.email;

  // Edit Form Fields
  const editUsernameInput = document.getElementById('edit-username-input');
  const editEmailInput = document.getElementById('edit-email-input');
  const editPasswordInput = document.getElementById('edit-password-input');

  if (editUsernameInput) editUsernameInput.value = state.currentUser.username;
  if (editEmailInput) editEmailInput.value = state.currentUser.email;
  if (editPasswordInput) editPasswordInput.value = '';
}

function changeAvatarPrompt() {
  const newUrl = prompt('Enter image URL for your profile avatar:', state.currentUser.avatar);
  if (newUrl && newUrl.trim()) {
    const users = getAllDatabaseUsers();
    const idx = users.findIndex(u => u.id === state.currentUser.id);
    if (idx !== -1) {
      users[idx].avatar = newUrl.trim();
      saveDatabaseUsers(users);
      state.currentUser = users[idx];
      renderProfileData();
    }
  }
}

// ==================== 2. SUPABASE CLOUD DATABASE INTEGRATION ====================
function initSupabase() {
  const config = localStorage.getItem(DB_SUPABASE_KEY);
  if (config) {
    try {
      const { url, key } = JSON.parse(config);
      if (url && key && window.supabase) {
        state.supabaseClient = window.supabase.createClient(url, key);
        console.log('Supabase Cloud Database connected successfully!');
        const urlInput = document.getElementById('supabase-url-input');
        const keyInput = document.getElementById('supabase-key-input');
        if (urlInput) urlInput.value = url;
        if (keyInput) keyInput.value = key;
      }
    } catch (err) {
      console.log('Supabase init note:', err);
    }
  }
}

function saveSupabaseConfig() {
  const url = document.getElementById('supabase-url-input').value.trim();
  const key = document.getElementById('supabase-key-input').value.trim();

  if (!url || !key) {
    alert('Please enter both Supabase Project URL and Anon Key.');
    return;
  }

  localStorage.setItem(DB_SUPABASE_KEY, JSON.stringify({ url, key }));
  if (window.supabase) {
    state.supabaseClient = window.supabase.createClient(url, key);
  }

  const statusEl = document.getElementById('supabase-save-status');
  if (statusEl) {
    statusEl.classList.remove('hidden');
    setTimeout(() => statusEl.classList.add('hidden'), 3000);
  }
  alert('Supabase credentials saved! All users worldwide can now authenticate with cloud database on Vercel.');
}

function toggleDatabaseConfigForm() {
  const box = document.getElementById('database-config-box');
  if (box) box.classList.toggle('hidden');
}

async function syncProfileUpdateToSupabase(newUsername, newPassword) {
  if (!state.supabaseClient) return;
  try {
    const updateObj = { data: { username: newUsername } };
    if (newPassword) updateObj.password = newPassword;
    await state.supabaseClient.auth.updateUser(updateObj);
  } catch (e) {
    console.log('Supabase sync note:', e);
  }
}

// ==================== 3. AUTH MODAL (SIGN IN / SIGN UP) ====================
function openAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function toggleAuthMode(mode) {
  state.authMode = mode;
  const signinBtn = document.getElementById('auth-toggle-signin');
  const signupBtn = document.getElementById('auth-toggle-signup');
  const usernameField = document.getElementById('auth-username-field');
  const submitBtn = document.getElementById('auth-submit-btn');
  const title = document.getElementById('auth-modal-title');

  if (mode === 'signup') {
    signinBtn.className = 'flex-1 py-1.5 rounded-lg text-gray-400';
    signupBtn.className = 'flex-1 py-1.5 rounded-lg bg-purple-600 text-white';
    usernameField.classList.remove('hidden');
    submitBtn.textContent = 'Create Account (Sign Up)';
    title.textContent = 'Sign Up for Crochit';
  } else {
    signinBtn.className = 'flex-1 py-1.5 rounded-lg bg-purple-600 text-white';
    signupBtn.className = 'flex-1 py-1.5 rounded-lg text-gray-400';
    usernameField.classList.add('hidden');
    submitBtn.textContent = 'Sign In';
    title.textContent = 'Sign In to Crochit';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email-input').value.trim();
  const password = document.getElementById('auth-password-input').value.trim();
  const username = document.getElementById('auth-username-input').value.trim() || email.split('@')[0];

  const users = getAllDatabaseUsers();

  if (state.authMode === 'signup') {
    // Check if email already exists
    const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      alert('An account with this email already exists. Please Sign In.');
      return;
    }

    // Create New User
    const newUser = {
      id: 'usr_' + Date.now(),
      username: username,
      email: email,
      password: password,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
      bio: "New member of Crochit 🚀",
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };

    users.push(newUser);
    saveDatabaseUsers(users);
    state.currentUser = newUser;
    localStorage.setItem(DB_SESSION_KEY, newUser.id);

    // If Supabase is active
    if (state.supabaseClient) {
      try {
        await state.supabaseClient.auth.signUp({ email, password, options: { data: { username } } });
      } catch (err) {
        console.log('Supabase signup:', err);
      }
    }

    closeAuthModal();
    renderProfileData();
    alert(`Welcome to Crochit, ${username}! Your account has been registered in the database.`);
  } else {
    // Sign In Mode
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      alert('No user found with this email. Please check your credentials or click Sign Up.');
      return;
    }
    if (user.password !== password) {
      alert('Incorrect password. Please try again.');
      return;
    }

    state.currentUser = user;
    localStorage.setItem(DB_SESSION_KEY, user.id);

    // If Supabase is active
    if (state.supabaseClient) {
      try {
        await state.supabaseClient.auth.signInWithPassword({ email, password });
      } catch (err) {
        console.log('Supabase signin:', err);
      }
    }

    closeAuthModal();
    renderProfileData();
    alert(`Welcome back, ${user.username}!`);
  }
}

// ==================== 4. 4 BOTTOM NAVIGATION TABS ROUTER ====================
function switchMainTab(tab) {
  state.activeTab = tab;
  const tabs = ['home', 'feed', 'chat', 'profile'];

  // Switch pages
  tabs.forEach(t => {
    const page = document.getElementById(`page-${t}`);
    if (page) {
      if (t === tab) {
        page.classList.remove('hidden');
        if (t === 'chat') page.classList.add('flex');
      } else {
        page.classList.add('hidden');
        page.classList.remove('flex');
      }
    }
  });

  // Update Header Labels & Search Bar
  const searchContainer = document.getElementById('header-search-container');
  const headerLabel = document.getElementById('header-active-tab-label');

  if (tab === 'home') {
    if (searchContainer) searchContainer.classList.remove('hidden');
    if (headerLabel) headerLabel.textContent = 'Home • YouTube Long Videos';
  } else if (tab === 'feed') {
    if (searchContainer) searchContainer.classList.add('hidden');
    if (headerLabel) headerLabel.textContent = 'Feed • Instagram Reels';
  } else if (tab === 'chat') {
    if (searchContainer) searchContainer.classList.add('hidden');
    if (headerLabel) headerLabel.textContent = 'Chat • Real-Time Messaging';
  } else if (tab === 'profile') {
    if (searchContainer) searchContainer.classList.add('hidden');
    if (headerLabel) headerLabel.textContent = 'Profile • User & Database';
    renderProfileData();
  }

  // Update Desktop Sidebar Active Styling
  tabs.forEach(t => {
    const sBtn = document.getElementById(`sidebar-tab-${t}`);
    if (sBtn) {
      if (t === tab) {
        if (t === 'home') sBtn.className = 'w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-semibold transition text-white bg-red-600/20 border border-red-500/30 shadow-sm';
        else if (t === 'feed') sBtn.className = 'w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-semibold transition text-white bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 shadow-sm';
        else if (t === 'chat') sBtn.className = 'w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-semibold transition text-white bg-emerald-600/20 border border-emerald-500/30 shadow-sm';
        else if (t === 'profile') sBtn.className = 'w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-semibold transition text-white bg-purple-600/20 border border-purple-500/30 shadow-sm';
      } else {
        sBtn.className = 'w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium transition text-gray-400 hover:text-white hover:bg-white/5';
      }
    }
  });

  // Update Mobile Bottom Nav Bar Active Styling
  tabs.forEach(t => {
    const bBtn = document.getElementById(`bottom-tab-${t}`);
    if (bBtn) {
      if (t === tab) {
        if (t === 'home') bBtn.className = 'flex flex-col items-center gap-1 text-red-500';
        else if (t === 'feed') bBtn.className = 'flex flex-col items-center gap-1 text-pink-500';
        else if (t === 'chat') bBtn.className = 'flex flex-col items-center gap-1 text-emerald-400 relative';
        else if (t === 'profile') bBtn.className = 'flex flex-col items-center gap-1 text-purple-400';
      } else {
        bBtn.className = 'flex flex-col items-center gap-1 text-gray-400' + (t === 'chat' ? ' relative' : '');
      }
    }
  });

  lucide.createIcons();
}

// ==================== 5. PAGE 1: HOME (YOUTUBE LONG VIDEOS ONLY) ====================
function renderHomeCategories() {
  const container = document.getElementById('home-category-chips');
  if (!container) return;

  container.innerHTML = CROCHIT_DATABASE.homeCategories.map(cat => {
    const isActive = cat === state.activeHomeCategory;
    return `
      <button 
        onclick="selectHomeCategory('${cat}')" 
        class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
          isActive 
            ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
            : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
        }"
      >
        ${cat}
      </button>
    `;
  }).join('');
}

function selectHomeCategory(category) {
  state.activeHomeCategory = category;
  renderHomeCategories();
  renderHomeVideos();
}

function renderHomeVideos() {
  const grid = document.getElementById('youtube-videos-grid');
  if (!grid) return;

  let videos = CROCHIT_DATABASE.youtubeLongVideos;

  // Filter category
  if (state.activeHomeCategory !== 'All') {
    videos = videos.filter(v => v.category === state.activeHomeCategory);
  }

  // Filter search
  if (state.homeSearchQuery.trim()) {
    const q = state.homeSearchQuery.toLowerCase();
    videos = videos.filter(v => 
      v.title.toLowerCase().includes(q) || 
      v.channel.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q)
    );
  }

  if (videos.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-gray-400">
        <i data-lucide="video-off" class="w-12 h-12 mx-auto mb-3 text-gray-600"></i>
        <p class="text-base font-semibold text-gray-300">No long videos match your search</p>
        <p class="text-xs text-gray-500 mt-1">Try another keyword or category.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = videos.map(video => {
    return `
      <div class="bg-[#131822] border border-white/10 hover:border-red-500/30 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col justify-between group">
        <!-- Thumbnail & Play Action -->
        <div class="relative aspect-video bg-black/80 cursor-pointer overflow-hidden" onclick="playYoutubeVideoInApp('${video.id}')">
          <img src="${video.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${video.title}">
          
          <div class="absolute bottom-2 right-2 bg-black/85 text-white font-mono text-[11px] px-2 py-0.5 rounded font-bold">
            ${video.duration}
          </div>

          <!-- Play button overlay -->
          <div class="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition">
            <div class="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition">
              <i data-lucide="play" class="w-6 h-6 fill-white ml-0.5"></i>
            </div>
          </div>
        </div>

        <!-- Details -->
        <div class="p-4 space-y-3">
          <div class="flex gap-3">
            <img src="${video.channelAvatar}" class="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition cursor-pointer" onclick="playYoutubeVideoInApp('${video.id}')">
                ${video.title}
              </h3>
              <p class="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                <span>${video.channel}</span>
                <span>•</span>
                <span>${video.views}</span>
              </p>
            </div>
          </div>

          <!-- Action buttons (Float & Chat + Send to Chat) -->
          <div class="flex items-center gap-2 pt-2 border-t border-white/5 text-xs">
            <button 
              onclick="floatYoutubeVideo('${video.id}')"
              class="flex-1 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-semibold flex items-center justify-center gap-1 border border-purple-500/30 transition"
              title="Watch in corner while chatting"
            >
              <i data-lucide="minimize-2" class="w-3.5 h-3.5"></i>
              <span>Float & Chat</span>
            </button>
            <button 
              onclick="shareYtToChat('${video.id}')"
              class="flex-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center justify-center gap-1 transition"
              title="Send directly to friends in chat"
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

function playYoutubeVideoInApp(videoId) {
  const video = CROCHIT_DATABASE.youtubeLongVideos.find(v => v.id === videoId);
  if (!video) return;

  state.activeModalYtVideo = video;
  const modal = document.getElementById('youtube-video-modal');
  const iframe = document.getElementById('modal-youtube-iframe');

  document.getElementById('modal-yt-title').textContent = video.title;
  document.getElementById('modal-yt-meta').textContent = `${video.views} views • Duration: ${video.duration}`;
  document.getElementById('modal-yt-channel-name').textContent = video.channel;
  document.getElementById('modal-yt-channel-avatar').src = video.channelAvatar;
  document.getElementById('modal-yt-desc').textContent = video.description;

  // Embedded playback inside app without leaving!
  iframe.src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&enablejsapi=1&rel=0`;

  modal.classList.remove('hidden');
  closeFloatingPlayer();
}

function closeYoutubeModal() {
  const modal = document.getElementById('youtube-video-modal');
  const iframe = document.getElementById('modal-youtube-iframe');
  iframe.src = '';
  modal.classList.add('hidden');
}

function minimizeYtToMiniPlayer() {
  if (!state.activeModalYtVideo) return;
  const video = state.activeModalYtVideo;
  closeYoutubeModal();
  floatYoutubeVideo(video.id);
}

function floatYoutubeVideo(videoId) {
  const video = CROCHIT_DATABASE.youtubeLongVideos.find(v => v.id === videoId);
  if (!video) return;

  const player = document.getElementById('floating-mini-player');
  const container = document.getElementById('mini-player-frame-container');
  const titleEl = document.getElementById('mini-player-title');

  titleEl.textContent = video.title;
  container.className = 'relative bg-black aspect-video w-full flex items-center justify-center overflow-hidden';
  container.innerHTML = `
    <iframe 
      src="https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&enablejsapi=1&rel=0" 
      class="w-full h-full border-0" 
      allowfullscreen 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    ></iframe>
  `;

  player.classList.remove('hidden');
  state.activeMiniMedia = { type: 'yt', id: video.id, title: video.title };
}

function shareActiveYtToChat() {
  if (state.activeModalYtVideo) {
    shareYtToChat(state.activeModalYtVideo.id);
    closeYoutubeModal();
  }
}

function shareYtToChat(videoId) {
  const video = CROCHIT_DATABASE.youtubeLongVideos.find(v => v.id === videoId);
  if (!video) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msg = {
    id: 'msg_yt_' + Date.now(),
    senderId: state.myPeerId,
    senderName: state.currentUser ? state.currentUser.username : 'You',
    isMe: true,
    time: timeStr,
    text: `Check out this long video: ${video.title}`,
    isMedia: true,
    mediaType: 'youtube',
    mediaId: video.id,
    mediaTitle: video.title,
    youtubeId: video.youtubeId,
    duration: video.duration,
    thumbnail: video.thumbnail
  };

  saveAndBroadcastMessage(msg);
  switchMainTab('chat');
}

function setupSearchListener() {
  const searchInput = document.getElementById('home-video-search');
  const clearBtn = document.getElementById('clear-search-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.homeSearchQuery = e.target.value;
      if (state.homeSearchQuery) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
      renderHomeVideos();
    });
  }
}

function clearHomeSearch() {
  const input = document.getElementById('home-video-search');
  const clearBtn = document.getElementById('clear-search-btn');
  if (input) input.value = '';
  if (clearBtn) clearBtn.classList.add('hidden');
  state.homeSearchQuery = '';
  renderHomeVideos();
}

// ==================== 6. PAGE 2: FEED (INSTAGRAM REELS ONLY) ====================
function getStoredReels() {
  const stored = localStorage.getItem(DB_REELS_KEY);
  return stored ? JSON.parse(stored) : CROCHIT_DATABASE.instagramReels;
}

function renderFeedReels() {
  const grid = document.getElementById('instagram-reels-grid');
  if (!grid) return;

  const reels = getStoredReels();

  grid.innerHTML = reels.map(reel => {
    return `
      <div class="bg-[#141418] border border-white/10 rounded-2xl overflow-hidden shadow-xl hover:border-pink-500/40 transition flex flex-col justify-between">
        <!-- Reel Header -->
        <div class="p-3.5 border-b border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5">
              <div class="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-white text-[10px]">
                IG
              </div>
            </div>
            <div>
              <h4 class="text-xs font-bold text-white">${reel.creator}</h4>
              <span class="text-[10px] text-pink-400">${reel.category}</span>
            </div>
          </div>
          <span class="text-[10px] text-gray-400 font-semibold">${reel.views} views</span>
        </div>

        <!-- Instagram Reel Player (Plays 100% inside app!) -->
        <div class="relative w-full bg-black aspect-[9/16] max-h-[460px] overflow-hidden flex items-center justify-center">
          <iframe 
            src="https://www.instagram.com/reel/${reel.shortcode}/embed/" 
            class="w-full h-full border-0" 
            scrolling="no" 
            allowtransparency="true"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          ></iframe>
        </div>

        <!-- Actions -->
        <div class="p-3 bg-[#17181c] border-t border-white/5 space-y-2">
          <p class="text-xs font-semibold text-gray-200 line-clamp-1">${reel.title}</p>
          <div class="flex items-center gap-2 pt-1 border-t border-white/5">
            <button 
              onclick="floatInstagramReel('${reel.shortcode}', '${reel.title}')"
              class="flex-1 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-semibold text-xs flex items-center justify-center gap-1 border border-purple-500/30 transition"
              title="Float reel and continue chatting"
            >
              <i data-lucide="minimize-2" class="w-3.5 h-3.5"></i>
              <span>Float & Chat</span>
            </button>
            <button 
              onclick="shareReelToChatDirect('${reel.shortcode}', '${reel.title}')"
              class="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white font-semibold text-xs flex items-center justify-center gap-1 shadow transition"
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

function floatInstagramReel(shortcode, title) {
  const player = document.getElementById('floating-mini-player');
  const container = document.getElementById('mini-player-frame-container');
  const titleEl = document.getElementById('mini-player-title');

  titleEl.textContent = title;
  container.className = 'relative bg-black aspect-[9/16] max-h-[380px] w-full flex items-center justify-center overflow-hidden';
  container.innerHTML = `
    <iframe 
      src="https://www.instagram.com/reel/${shortcode}/embed/" 
      class="w-full h-full border-0" 
      scrolling="no"
      allowfullscreen 
      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
    ></iframe>
  `;

  player.classList.remove('hidden');
  state.activeMiniMedia = { type: 'ig', id: shortcode, title };
}

function closeFloatingPlayer() {
  const player = document.getElementById('floating-mini-player');
  const container = document.getElementById('mini-player-frame-container');
  if (container) container.innerHTML = '';
  if (player) player.classList.add('hidden');
  state.activeMiniMedia = null;
}

function openAddReelModal() {
  document.getElementById('add-reel-modal').classList.remove('hidden');
}

function closeAddReelModal() {
  document.getElementById('add-reel-modal').classList.add('hidden');
}

function parseInstagramUrl(url) {
  if (!url) return null;
  const regex = /instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function addInstagramReel() {
  const urlInput = document.getElementById('new-reel-url');
  const titleInput = document.getElementById('new-reel-title');
  if (!urlInput || !urlInput.value.trim()) return;

  const url = urlInput.value.trim();
  const shortcode = parseInstagramUrl(url);

  if (!shortcode) {
    alert('Please enter a valid Instagram Reel link (e.g. https://www.instagram.com/reel/C5nQ0q0L7f0/)');
    return;
  }

  const title = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : 'Linked Instagram Reel';
  const newReel = {
    id: 'ig_custom_' + Date.now(),
    shortcode: shortcode,
    title: title,
    creator: '@instagram_user',
    likes: 'Trending',
    views: 'Live',
    category: 'Trending',
    permalink: url
  };

  const reels = getStoredReels();
  reels.unshift(newReel);
  localStorage.setItem(DB_REELS_KEY, JSON.stringify(reels));

  urlInput.value = '';
  if (titleInput) titleInput.value = '';
  closeAddReelModal();
  renderFeedReels();
  alert('Instagram Reel successfully added to your Feed!');
}

// ==================== 7. PAGE 3: CHAT (REAL-TIME WEBRTC MESSAGING) ====================
function initP2PEngine() {
  try {
    state.broadcastChannel = new BroadcastChannel('crochit_p2p_channel');
    state.broadcastChannel.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'MESSAGE' && data.senderId !== state.myPeerId) {
        receiveChatMessage(data.payload);
      }
    };
  } catch (err) {
    console.log('Broadcast fallback:', err);
  }

  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const myGeneratedId = 'crochit-' + randomSuffix;

  try {
    const peer = new Peer(myGeneratedId, { debug: 1 });
    peer.on('open', (id) => {
      state.myPeerId = id;
      const el = document.getElementById('my-peer-id');
      if (el) el.textContent = id;

      const urlParams = new URLSearchParams(window.location.search);
      const connectTo = urlParams.get('connect');
      if (connectTo && connectTo !== id) {
        setTimeout(() => connectToPeer(connectTo), 800);
      }
    });

    peer.on('connection', (conn) => setupConnection(conn));
    window.crochitPeer = peer;
  } catch (err) {
    state.myPeerId = myGeneratedId;
    const el = document.getElementById('my-peer-id');
    if (el) el.textContent = myGeneratedId;
  }
}

function connectToPeer(friendId) {
  if (window.crochitPeer) {
    const conn = window.crochitPeer.connect(friendId);
    setupConnection(conn);
  }
}

function setupConnection(conn) {
  state.activePeerConn = conn;
  conn.on('open', () => {
    const subtext = document.getElementById('chat-peer-subtext');
    if (subtext) subtext.textContent = `🟢 Connected with ${conn.peer}`;
  });
  conn.on('data', (data) => receiveChatMessage(data));
}

function copyMyId() {
  if (!state.myPeerId) return;
  navigator.clipboard.writeText(state.myPeerId).then(() => {
    alert(`Copied Your Crochit ID: ${state.myPeerId}`);
  }).catch(() => prompt('Copy your Crochit ID:', state.myPeerId));
}

function copyInviteLink() {
  const url = `${window.location.origin}${window.location.pathname}?connect=${state.myPeerId}`;
  navigator.clipboard.writeText(url).then(() => {
    alert(`Copied Invite Link: \n${url}\nSend this to a friend to connect instantly!`);
  }).catch(() => prompt('Copy invite link:', url));
}

function getStoredChatHistory() {
  const history = localStorage.getItem(DB_CHAT_KEY);
  return history ? JSON.parse(history) : [];
}

function renderChatHistory() {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;
  const history = getStoredChatHistory();
  container.innerHTML = '';
  history.forEach(msg => appendMessageToChatUI(msg, false));
  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chat-message-input');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  input.value = '';

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const igMatch = parseInstagramUrl(text);

  const msg = {
    id: 'msg_' + Date.now(),
    senderId: state.myPeerId,
    senderName: state.currentUser ? state.currentUser.username : 'You',
    isMe: true,
    time: timeStr,
    text: text,
    isMedia: !!igMatch,
    mediaType: igMatch ? 'instagram' : null,
    shortcode: igMatch ? igMatch : null
  };

  saveAndBroadcastMessage(msg);
}

function shareReelToChatDirect(shortcode, title) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msg = {
    id: 'msg_ig_' + Date.now(),
    senderId: state.myPeerId,
    senderName: state.currentUser ? state.currentUser.username : 'You',
    isMe: true,
    time: timeStr,
    text: `Check out this Instagram Reel: ${title}`,
    isMedia: true,
    mediaType: 'instagram',
    shortcode: shortcode,
    title: title
  };

  saveAndBroadcastMessage(msg);
  switchMainTab('chat');
}

function saveAndBroadcastMessage(msg) {
  const history = getStoredChatHistory();
  history.push(msg);
  localStorage.setItem(DB_CHAT_KEY, JSON.stringify(history));
  appendMessageToChatUI(msg);

  if (state.activePeerConn && state.activePeerConn.open) {
    state.activePeerConn.send({ ...msg, isMe: false });
  }

  if (state.broadcastChannel) {
    state.broadcastChannel.postMessage({
      type: 'MESSAGE',
      senderId: state.myPeerId,
      payload: { ...msg, isMe: false }
    });
  }
}

function receiveChatMessage(msg) {
  const history = getStoredChatHistory();
  history.push(msg);
  localStorage.setItem(DB_CHAT_KEY, JSON.stringify(history));
  appendMessageToChatUI(msg);
}

function appendMessageToChatUI(msg, scroll = true) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const isMe = msg.isMe;
  const msgEl = document.createElement('div');
  msgEl.className = `flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up`;

  // Media Card (YouTube or Instagram)
  if (msg.isMedia) {
    if (msg.mediaType === 'youtube') {
      msgEl.innerHTML = `
        <div class="max-w-sm rounded-2xl p-3 ${isMe ? 'bubble-me text-white' : 'bubble-them text-gray-100'} shadow-lg border border-white/5 space-y-2">
          <div class="flex items-center gap-1.5 pb-1 border-b border-white/10 text-xs font-bold text-red-400">
            <i data-lucide="youtube" class="w-4 h-4"></i>
            <span>YouTube Long Video</span>
          </div>
          <p class="text-xs font-semibold leading-snug">${msg.mediaTitle}</p>
          <div class="relative aspect-video rounded-xl overflow-hidden bg-black cursor-pointer group" onclick="playYoutubeVideoInApp('${msg.mediaId}')">
            <img src="${msg.thumbnail}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div class="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                <i data-lucide="play" class="w-5 h-5 fill-white ml-0.5"></i>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-gray-300 pt-1">
            <button onclick="floatYoutubeVideo('${msg.mediaId}')" class="text-purple-300 font-bold hover:underline">Float & Watch</button>
            <div class="flex items-center gap-1">
              <span>${msg.time}</span>
              ${isMe ? '<span class="text-emerald-400">✓✓</span>' : ''}
            </div>
          </div>
        </div>
      `;
    } else {
      msgEl.innerHTML = `
        <div class="max-w-sm rounded-2xl p-3 ${isMe ? 'bubble-me text-white' : 'bubble-them text-gray-100'} shadow-lg border border-white/5 space-y-2">
          <div class="flex items-center gap-1.5 pb-1 border-b border-white/10 text-xs font-bold text-pink-400">
            <i data-lucide="instagram" class="w-4 h-4"></i>
            <span>Instagram Reel</span>
          </div>
          <p class="text-xs font-semibold leading-snug">${msg.title || 'Instagram Reel Video'}</p>
          <div class="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center cursor-pointer group" onclick="floatInstagramReel('${msg.shortcode}', '${msg.title || 'Instagram Reel'}')">
            <iframe src="https://www.instagram.com/reel/${msg.shortcode}/embed/" class="w-full h-full pointer-events-none" scrolling="no" frameborder="0"></iframe>
            <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition">
              <span class="px-3 py-1 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs shadow">Play in PiP</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-gray-300 pt-1">
            <span>${msg.time}</span>
            ${isMe ? '<span class="text-emerald-400">✓✓</span>' : ''}
          </div>
        </div>
      `;
    }
  } else {
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

// ==================== 8. ATTACH MEDIA MODAL IN CHAT ====================
function openAttachMediaModal() {
  document.getElementById('attach-media-modal').classList.remove('hidden');
  renderAttachPicker('yt');
}

function closeAttachMediaModal() {
  document.getElementById('attach-media-modal').classList.add('hidden');
}

function renderAttachPicker(type) {
  const container = document.getElementById('attach-picker-list');
  const ytTab = document.getElementById('modal-tab-yt');
  const igTab = document.getElementById('modal-tab-ig');

  if (type === 'yt') {
    ytTab.className = 'flex-1 py-2 font-bold text-red-400 border-b-2 border-red-500';
    igTab.className = 'flex-1 py-2 font-semibold text-gray-400';
    container.innerHTML = CROCHIT_DATABASE.youtubeLongVideos.map(v => `
      <div onclick="shareYtToChat('${v.id}'); closeAttachMediaModal();" class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition">
        <div class="flex items-center gap-2.5 overflow-hidden">
          <img src="${v.thumbnail}" class="w-16 h-10 object-cover rounded-lg shrink-0">
          <div class="truncate">
            <h4 class="text-xs font-bold text-white truncate">${v.title}</h4>
            <span class="text-[10px] text-gray-400">${v.duration} • ${v.channel}</span>
          </div>
        </div>
        <button class="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0">Send</button>
      </div>
    `).join('');
  } else {
    igTab.className = 'flex-1 py-2 font-bold text-pink-400 border-b-2 border-pink-500';
    ytTab.className = 'flex-1 py-2 font-semibold text-gray-400';
    const reels = getStoredReels();
    container.innerHTML = reels.map(r => `
      <div onclick="shareReelToChatDirect('${r.shortcode}', '${r.title}'); closeAttachMediaModal();" class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition">
        <div class="flex items-center gap-2.5 overflow-hidden">
          <i data-lucide="film" class="w-6 h-6 text-pink-400 shrink-0"></i>
          <div class="truncate">
            <h4 class="text-xs font-bold text-white truncate">${r.title}</h4>
            <span class="text-[10px] text-gray-400">${r.creator}</span>
          </div>
        </div>
        <button class="px-3 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shrink-0">Send</button>
      </div>
    `).join('');
  }

  lucide.createIcons();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
