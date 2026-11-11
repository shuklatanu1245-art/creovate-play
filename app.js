// Crochit - Application Core Engine
// 4 Bottom Navigation Pages: Home (Long Videos), Feed (Vertical Snap Reels), Chat, Profile
// 100% Native In-App Playback, Infinite Scrolling, Real Search, In-Place Database Updates

let state = {
  activeTab: 'home',
  activeHomeCategory: 'All',
  homeSearchQuery: '',
  currentUser: null,
  activePeerConn: null,
  myPeerId: null,
  broadcastChannel: null,
  supabaseClient: null,
  authMode: 'signin',
  activeModalVideo: null,
  activeMiniVideo: null,
  homeVideosList: [],
  reelsList: [],
  reelObserver: null,
  reelsMuted: true
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
  initMediaStreams();
  renderHomeCategories();
  renderHomeVideos();
  initReelsFeed();
  renderChatHistory();
  renderProfileData();
  setupInfiniteScrollListeners();
  setupSearchListener();

  // Initialize Lucide icons
  lucide.createIcons();
});

// ==================== 1. MEDIA STREAMS & INFINITE GENERATORS ====================
function initMediaStreams() {
  // Initialize Home Long Videos list with initial bank
  state.homeVideosList = [...CROCHIT_MEDIA_BANK.longStreams];

  // Initialize Reels with initial bank
  state.reelsList = [...CROCHIT_MEDIA_BANK.reelStreams];
}

// Procedural Generator for Infinite Long Videos (Never Ends!)
function generateMoreLongVideos(count = 6) {
  const titles = [
    "Next-Gen High Performance Cloud Architecture & Microservices Masterclass",
    "Midnight Synthwave Coding & Focus Odyssey [Extended 3-Hour Session]",
    "Deep Dive: Neurological Mechanisms of Deep Focus and Habit Mastery",
    "Epic Space Odyssey: Unraveling Gravitational Waves and Quantum Mechanics",
    "High-Octane Cinematic Action: Behind the Scenes of Next-Gen Game Engines",
    "Championship Finals: Unbelievable Last-Second Comebacks & Clutch Plays",
    "Autonomous Robotics & Intelligent Agent Frameworks in 2026",
    "Calm Rain & Lo-Fi Beats for Creative Flow and Relaxed Thinking"
  ];

  const creators = ["Apex Studio", "DevMastery", "SoundVibes", "CosmoChronicles", "GameCraft", "StadiumLive"];
  const categories = ["Tech & Coding", "Music & Chill", "Documentary", "Gaming", "Podcasts", "Sports"];
  const streams = CROCHIT_MEDIA_BANK.longStreams;

  const newVideos = [];
  for (let i = 0; i < count; i++) {
    const stream = streams[Math.floor(Math.random() * streams.length)];
    const title = titles[Math.floor(Math.random() * titles.length)];
    const creator = creators[Math.floor(Math.random() * creators.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const views = (Math.random() * 4 + 1).toFixed(1) + 'M';
    const duration = `${Math.floor(Math.random() * 20 + 10)}:${Math.floor(Math.random() * 50 + 10)}`;

    newVideos.push({
      id: 'long_' + Date.now() + '_' + i,
      url: stream.url,
      title: `${title} #${state.homeVideosList.length + i + 1}`,
      creator: creator,
      avatar: stream.avatar,
      duration: duration,
      views: views,
      category: category,
      thumbnail: stream.thumbnail,
      description: stream.description
    });
  }

  state.homeVideosList.push(...newVideos);
  return newVideos;
}

// Procedural Generator for Infinite Vertical Reels (Never Ends!)
function generateMoreReels(count = 5) {
  const reelTitles = [
    "Late night flow state with ambient beats 💻⚡ #coding #vibes",
    "Daily relentless focus over temporary motivation 🔥",
    "Unbelievable reflex catch at the boundary line! 💥",
    "When notifications explode on your phone at 6 AM 😂",
    "Midnight acoustic melody for calm relaxation 🎸🌧️",
    "POV: Chatting with friends while watching reels simultaneously on Crochit 🚀"
  ];

  const creators = ["@code_artisan", "@mindset_daily", "@sports_pulse", "@comedy_hub", "@acoustic_chords", "@crochit_creator"];
  const reelStreams = CROCHIT_MEDIA_BANK.reelStreams;

  const newReels = [];
  for (let i = 0; i < count; i++) {
    const stream = reelStreams[Math.floor(Math.random() * reelStreams.length)];
    const title = reelTitles[Math.floor(Math.random() * reelTitles.length)];
    const creator = creators[Math.floor(Math.random() * creators.length)];
    const likes = `${Math.floor(Math.random() * 500 + 100)}K`;
    const comments = `${(Math.random() * 15 + 1).toFixed(1)}K`;
    const shares = `${Math.floor(Math.random() * 80 + 10)}K`;

    newReels.push({
      id: 'reel_' + Date.now() + '_' + i,
      url: stream.url,
      title: title,
      creator: creator,
      creatorAvatar: stream.creatorAvatar,
      likes: likes,
      comments: comments,
      shares: shares,
      music: stream.music,
      category: stream.category,
      isLiked: false
    });
  }

  state.reelsList.push(...newReels);
  return newReels;
}

// ==================== 2. PAGE 1: HOME (LONG VIDEOS & REAL SEARCH) ====================
function renderHomeCategories() {
  const container = document.getElementById('home-category-chips');
  if (!container) return;

  container.innerHTML = CROCHIT_MEDIA_BANK.categories.map(cat => {
    const isActive = cat === state.activeHomeCategory;
    return `
      <button 
        onclick="selectHomeCategory('${cat}')" 
        class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
          isActive 
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' 
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

function executeHomeSearch() {
  const input = document.getElementById('home-video-search');
  if (input) {
    state.homeSearchQuery = input.value.trim();
    renderHomeVideos();
    // Switch to home tab if on another page
    if (state.activeTab !== 'home') {
      switchMainTab('home');
    }
  }
}

function setupSearchListener() {
  const input = document.getElementById('home-video-search');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        executeHomeSearch();
      }
    });
  }
}

function renderHomeVideos() {
  const grid = document.getElementById('long-videos-grid');
  if (!grid) return;

  let videos = state.homeVideosList;

  // Filter category
  if (state.activeHomeCategory !== 'All') {
    videos = videos.filter(v => v.category === state.activeHomeCategory);
  }

  // Filter real search
  if (state.homeSearchQuery.trim()) {
    const q = state.homeSearchQuery.toLowerCase();
    videos = videos.filter(v => 
      v.title.toLowerCase().includes(q) || 
      v.creator.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      (v.description && v.description.toLowerCase().includes(q))
    );
  }

  if (videos.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-gray-400">
        <i data-lucide="video-off" class="w-12 h-12 mx-auto mb-3 text-gray-600"></i>
        <p class="text-base font-bold text-gray-200">No videos found for "${escapeHtml(state.homeSearchQuery)}"</p>
        <p class="text-xs text-gray-500 mt-1">Try another keyword or category.</p>
        <button onclick="clearSearchAndReset()" class="mt-4 px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold">
          Reset Search
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = videos.map(video => {
    return `
      <div class="bg-[#121822] border border-white/10 hover:border-purple-500/40 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col justify-between group">
        <!-- Thumbnail & Play Action -->
        <div class="relative aspect-video bg-black cursor-pointer overflow-hidden" onclick="playNativeVideoInModal('${video.id}')">
          <img src="${video.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${video.title}">
          
          <div class="absolute bottom-2 right-2 bg-black/85 text-white font-mono text-[11px] px-2 py-0.5 rounded font-bold backdrop-blur-sm">
            ${video.duration}
          </div>

          <!-- Play button overlay -->
          <div class="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition">
            <div class="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition">
              <i data-lucide="play" class="w-6 h-6 fill-white ml-0.5"></i>
            </div>
          </div>
        </div>

        <!-- Details -->
        <div class="p-4 space-y-3">
          <div class="flex gap-3">
            <img src="${video.avatar}" class="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-purple-400 transition cursor-pointer" onclick="playNativeVideoInModal('${video.id}')">
                ${video.title}
              </h3>
              <p class="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                <span>${video.creator}</span>
                <span>•</span>
                <span>${video.views}</span>
              </p>
            </div>
          </div>

          <!-- Action buttons (Float & Chat + Send to Chat) -->
          <div class="flex items-center gap-2 pt-2 border-t border-white/5 text-xs">
            <button 
              onclick="floatNativeVideo('${video.id}')"
              class="flex-1 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-semibold flex items-center justify-center gap-1 border border-purple-500/30 transition"
              title="Watch in corner while chatting"
            >
              <i data-lucide="minimize-2" class="w-3.5 h-3.5"></i>
              <span>Float & Chat</span>
            </button>
            <button 
              onclick="shareVideoToChatDirect('${video.id}')"
              class="flex-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center justify-center gap-1 transition"
              title="Send to chat"
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

function clearSearchAndReset() {
  const input = document.getElementById('home-video-search');
  if (input) input.value = '';
  state.homeSearchQuery = '';
  state.activeHomeCategory = 'All';
  renderHomeCategories();
  renderHomeVideos();
}

// Play Video In-App via HTML5 Native Video Player
function playNativeVideoInModal(videoId) {
  const video = state.homeVideosList.find(v => v.id === videoId);
  if (!video) return;

  state.activeModalVideo = video;
  const modal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('modal-native-video');

  document.getElementById('modal-video-title').textContent = video.title;
  document.getElementById('modal-video-meta').textContent = `${video.views} views • Duration: ${video.duration}`;
  document.getElementById('modal-video-creator-name').textContent = video.creator;
  document.getElementById('modal-video-creator-avatar').src = video.avatar;
  document.getElementById('modal-video-desc').textContent = video.description || 'High-definition long-form stream on Crochit.';

  videoEl.src = video.url;
  videoEl.play().catch(e => console.log('Autoplay handled:', e));

  modal.classList.remove('hidden');
  closeFloatingPlayer();
}

function closeVideoModal() {
  const modal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('modal-native-video');
  if (videoEl) videoEl.pause();
  modal.classList.add('hidden');
}

function minimizeModalVideoToMini() {
  if (!state.activeModalVideo) return;
  const currentVideo = state.activeModalVideo;
  const modalVideoEl = document.getElementById('modal-native-video');
  const currentTime = modalVideoEl ? modalVideoEl.currentTime : 0;

  closeVideoModal();
  floatNativeVideo(currentVideo.id, currentTime);
}

function floatNativeVideo(videoId, startTime = 0) {
  const video = state.homeVideosList.find(v => v.id === videoId) || state.reelsList.find(r => r.id === videoId);
  if (!video) return;

  const player = document.getElementById('floating-mini-player');
  const miniVideoEl = document.getElementById('mini-player-video');
  const titleEl = document.getElementById('mini-player-title');

  titleEl.textContent = video.title;
  miniVideoEl.src = video.url;
  if (startTime > 0) miniVideoEl.currentTime = startTime;

  player.classList.remove('hidden');
  miniVideoEl.play().catch(e => console.log('Mini play policy:', e));
  state.activeMiniVideo = video;
}

function closeFloatingPlayer() {
  const player = document.getElementById('floating-mini-player');
  const miniVideoEl = document.getElementById('mini-player-video');
  if (miniVideoEl) miniVideoEl.pause();
  if (player) player.classList.add('hidden');
  state.activeMiniVideo = null;
}

function shareActiveModalVideoToChat() {
  if (state.activeModalVideo) {
    shareVideoToChatDirect(state.activeModalVideo.id);
    closeVideoModal();
  }
}

// ==================== 3. PAGE 2: FEED (VERTICAL SNAP-SCROLL REELS) ====================
function initReelsFeed() {
  const container = document.getElementById('reels-snap-container');
  if (!container) return;

  container.innerHTML = '';
  appendReelsToFeed(state.reelsList);

  // IntersectionObserver to auto-play only visible reel and pause others
  setupReelsIntersectionObserver();
}

function appendReelsToFeed(reelsToAppend) {
  const container = document.getElementById('reels-snap-container');
  if (!container) return;

  reelsToAppend.forEach(reel => {
    const slide = document.createElement('div');
    slide.className = 'reel-slide-item w-full';
    slide.id = `reel-slide-${reel.id}`;
    slide.dataset.reelId = reel.id;

    slide.innerHTML = `
      <!-- Video Element (Autoplays seamlessly, loop) -->
      <video 
        class="reel-native-video absolute inset-0 w-full h-full object-cover cursor-pointer"
        src="${reel.url}"
        loop
        playsinline
        muted
      ></video>

      <!-- Center Play/Pause indicator overlay on tap -->
      <div class="reel-center-play absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity">
        <div class="w-16 h-16 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
          <i data-lucide="play" class="w-8 h-8 fill-white text-white ml-1"></i>
        </div>
      </div>

      <!-- Right Action Column -->
      <div class="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-20 text-white">
        <!-- Like Button -->
        <button onclick="toggleReelLike('${reel.id}')" class="flex flex-col items-center gap-1 group">
          <div class="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center group-hover:scale-110 transition border border-white/10">
            <i id="like-icon-${reel.id}" data-lucide="heart" class="w-6 h-6 ${reel.isLiked ? 'fill-red-500 text-red-500' : 'text-white'}"></i>
          </div>
          <span id="like-count-${reel.id}" class="text-[11px] font-bold">${reel.likes}</span>
        </button>

        <!-- Comments -->
        <button onclick="openReelComments('${reel.id}')" class="flex flex-col items-center gap-1 group">
          <div class="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center group-hover:scale-110 transition border border-white/10">
            <i data-lucide="message-circle" class="w-6 h-6 text-white"></i>
          </div>
          <span class="text-[11px] font-bold">${reel.comments}</span>
        </button>

        <!-- Share to Chat -->
        <button onclick="shareReelToChat('${reel.id}')" class="flex flex-col items-center gap-1 group">
          <div class="w-11 h-11 rounded-full bg-purple-600/90 backdrop-blur flex items-center justify-center group-hover:scale-110 transition shadow-lg shadow-purple-600/30">
            <i data-lucide="send" class="w-5 h-5 text-white"></i>
          </div>
          <span class="text-[11px] font-bold">Share</span>
        </button>

        <!-- Float & Chat (Picture-in-Picture) -->
        <button onclick="floatReelSlide('${reel.id}')" class="flex flex-col items-center gap-1 group" title="Float reel & chat simultaneously">
          <div class="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center group-hover:scale-110 transition border border-white/10">
            <i data-lucide="minimize-2" class="w-5 h-5 text-purple-300"></i>
          </div>
          <span class="text-[10px] font-bold text-gray-300">Float</span>
        </button>

        <!-- Sound Toggle -->
        <button onclick="toggleReelAudio('${reel.id}')" class="flex flex-col items-center gap-1 group">
          <div class="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center group-hover:scale-110 transition border border-white/10">
            <i id="sound-icon-${reel.id}" data-lucide="volume-x" class="w-5 h-5 text-white"></i>
          </div>
        </button>
      </div>

      <!-- Bottom Details Overlay -->
      <div class="absolute left-3 right-16 bottom-5 z-20 space-y-2 pointer-events-auto">
        <div class="flex items-center gap-2.5">
          <img src="${reel.creatorAvatar}" class="w-9 h-9 rounded-full object-cover border-2 border-purple-500 shadow">
          <span class="font-bold text-white text-sm">${reel.creator}</span>
          <button onclick="toggleFollow(this)" class="px-2.5 py-0.5 rounded-full bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition">
            Follow
          </button>
        </div>

        <p class="text-xs text-gray-100 font-medium line-clamp-2 leading-relaxed">
          ${reel.title}
        </p>

        <div class="flex items-center gap-1.5 text-xs text-gray-300">
          <i data-lucide="music" class="w-3.5 h-3.5 text-purple-400"></i>
          <span class="text-[11px] truncate">${reel.music}</span>
        </div>
      </div>
    `;

    // Click on video toggles play/pause
    const video = slide.querySelector('.reel-native-video');
    const playIndicator = slide.querySelector('.reel-center-play');
    video.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        playIndicator.classList.add('opacity-0');
      } else {
        video.pause();
        playIndicator.classList.remove('opacity-0');
      }
    });

    container.appendChild(slide);
  });

  lucide.createIcons();
}

function setupReelsIntersectionObserver() {
  if (state.reelObserver) {
    state.reelObserver.disconnect();
  }

  const container = document.getElementById('reels-snap-container');
  if (!container) return;

  const options = {
    root: container,
    threshold: 0.65 // Video must be 65% in view to play
  };

  state.reelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target.querySelector('.reel-native-video');
      if (!video) return;

      if (entry.isIntersecting && state.activeTab === 'feed') {
        video.play().catch(e => console.log('Reel autoplay policy:', e));
      } else {
        video.pause();
      }
    });
  }, options);

  const slides = container.querySelectorAll('.reel-slide-item');
  slides.forEach(slide => state.reelObserver.observe(slide));
}

function toggleReelLike(reelId) {
  const reel = state.reelsList.find(r => r.id === reelId);
  const icon = document.getElementById(`like-icon-${reelId}`);
  const count = document.getElementById(`like-count-${reelId}`);
  if (!reel || !icon) return;

  reel.isLiked = !reel.isLiked;
  if (reel.isLiked) {
    icon.className = 'w-6 h-6 fill-red-500 text-red-500 animate-heart-pop';
    icon.classList.add('fill-red-500', 'text-red-500');
  } else {
    icon.className = 'w-6 h-6 text-white';
  }
}

function toggleReelAudio(reelId) {
  state.reelsMuted = !state.reelsMuted;
  const container = document.getElementById('reels-snap-container');
  if (!container) return;

  const videos = container.querySelectorAll('.reel-native-video');
  videos.forEach(v => v.muted = state.reelsMuted);

  const icons = container.querySelectorAll(`[id^="sound-icon-"]`);
  icons.forEach(ic => {
    if (state.reelsMuted) {
      ic.setAttribute('data-lucide', 'volume-x');
    } else {
      ic.setAttribute('data-lucide', 'volume-2');
    }
  });

  lucide.createIcons();
}

function floatReelSlide(reelId) {
  const reel = state.reelsList.find(r => r.id === reelId);
  if (!reel) return;
  floatNativeVideo(reel.id);
}

function shareReelToChat(reelId) {
  const reel = state.reelsList.find(r => r.id === reelId);
  if (!reel) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msg = {
    id: 'msg_reel_' + Date.now(),
    senderId: state.myPeerId,
    senderName: state.currentUser ? state.currentUser.username : 'You',
    isMe: true,
    time: timeStr,
    text: `Check out this Reel: ${reel.title}`,
    isMedia: true,
    mediaType: 'reel',
    mediaId: reel.id,
    mediaTitle: reel.title,
    mediaUrl: reel.url,
    creator: reel.creator
  };

  saveAndBroadcastMessage(msg);
  switchMainTab('chat');
}

function toggleFollow(btn) {
  if (btn.textContent.trim() === 'Follow') {
    btn.textContent = 'Following';
    btn.className = 'px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold text-xs';
  } else {
    btn.textContent = 'Follow';
    btn.className = 'px-2.5 py-0.5 rounded-full bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition';
  }
}

function openReelComments(reelId) {
  alert('Reel comments section: Active community discussion.');
}

// ==================== 4. INFINITE SCROLL LISTENERS (UNLIMITED CONTENT) ====================
function setupInfiniteScrollListeners() {
  // 1. Home Long Videos Infinite Scroll
  const homePage = document.getElementById('page-home');
  if (homePage) {
    homePage.addEventListener('scroll', () => {
      // If user is within 300px of bottom, append more long videos
      if (homePage.scrollTop + homePage.clientHeight >= homePage.scrollHeight - 300) {
        if (!state.homeSearchQuery) { // Only append if not actively filtering
          generateMoreLongVideos(6);
          renderHomeVideos();
        }
      }
    });
  }

  // 2. Feed Vertical Snap Reels Infinite Scroll
  const reelsContainer = document.getElementById('reels-snap-container');
  if (reelsContainer) {
    reelsContainer.addEventListener('scroll', () => {
      // If user is within 2 slides of bottom, append 5 more reels
      if (reelsContainer.scrollTop + reelsContainer.clientHeight >= reelsContainer.scrollHeight - 600) {
        const moreReels = generateMoreReels(5);
        appendReelsToFeed(moreReels);
        setupReelsIntersectionObserver();
      }
    });
  }
}

// ==================== 5. PAGE 3: CHAT (REAL-TIME WEBRTC MESSAGING) ====================
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

  const msg = {
    id: 'msg_' + Date.now(),
    senderId: state.myPeerId,
    senderName: state.currentUser ? state.currentUser.username : 'You',
    isMe: true,
    time: timeStr,
    text: text,
    isMedia: false
  };

  saveAndBroadcastMessage(msg);
}

function shareVideoToChatDirect(videoId) {
  const video = state.homeVideosList.find(v => v.id === videoId);
  if (!video) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msg = {
    id: 'msg_v_' + Date.now(),
    senderId: state.myPeerId,
    senderName: state.currentUser ? state.currentUser.username : 'You',
    isMe: true,
    time: timeStr,
    text: `Check out this video: ${video.title}`,
    isMedia: true,
    mediaType: 'long',
    mediaId: video.id,
    mediaTitle: video.title,
    mediaUrl: video.url,
    thumbnail: video.thumbnail,
    duration: video.duration
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

  if (msg.isMedia) {
    msgEl.innerHTML = `
      <div class="max-w-sm rounded-2xl p-3 ${isMe ? 'bubble-me text-white' : 'bubble-them text-gray-100'} shadow-lg border border-white/5 space-y-2">
        <div class="flex items-center gap-1.5 pb-1 border-b border-white/10 text-xs font-bold text-purple-300">
          <i data-lucide="${msg.mediaType === 'reel' ? 'zap' : 'play'}" class="w-4 h-4"></i>
          <span>${msg.mediaType === 'reel' ? 'Reel Clip' : 'Video Stream'}</span>
        </div>
        <p class="text-xs font-semibold leading-snug">${msg.mediaTitle}</p>
        
        <div class="relative aspect-video rounded-xl overflow-hidden bg-black cursor-pointer group" onclick="playNativeVideoInModal('${msg.mediaId}')">
          ${msg.thumbnail ? `<img src="${msg.thumbnail}" class="w-full h-full object-cover">` : `<video src="${msg.mediaUrl}" class="w-full h-full object-cover"></video>`}
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div class="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
              <i data-lucide="play" class="w-5 h-5 fill-white ml-0.5"></i>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between text-[10px] text-gray-300 pt-1">
          <button onclick="floatNativeVideo('${msg.mediaId}')" class="text-purple-300 font-bold hover:underline">Float & Watch</button>
          <div class="flex items-center gap-1">
            <span>${msg.time}</span>
            ${isMe ? '<span class="text-emerald-400">✓✓</span>' : ''}
          </div>
        </div>
      </div>
    `;
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

function openAttachMediaModal() {
  document.getElementById('attach-media-modal').classList.remove('hidden');
  renderAttachPicker('long');
}

function closeAttachMediaModal() {
  document.getElementById('attach-media-modal').classList.add('hidden');
}

function renderAttachPicker(type) {
  const container = document.getElementById('attach-picker-list');
  const longTab = document.getElementById('modal-tab-long');
  const reelsTab = document.getElementById('modal-tab-reels');

  if (type === 'long') {
    longTab.className = 'flex-1 py-2 font-bold text-purple-400 border-b-2 border-purple-500';
    reelsTab.className = 'flex-1 py-2 font-semibold text-gray-400';
    container.innerHTML = state.homeVideosList.map(v => `
      <div onclick="shareVideoToChatDirect('${v.id}'); closeAttachMediaModal();" class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition">
        <div class="flex items-center gap-2.5 overflow-hidden">
          <img src="${v.thumbnail}" class="w-16 h-10 object-cover rounded-lg shrink-0">
          <div class="truncate">
            <h4 class="text-xs font-bold text-white truncate">${v.title}</h4>
            <span class="text-[10px] text-gray-400">${v.duration} • ${v.creator}</span>
          </div>
        </div>
        <button class="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0">Send</button>
      </div>
    `).join('');
  } else {
    reelsTab.className = 'flex-1 py-2 font-bold text-purple-400 border-b-2 border-purple-500';
    longTab.className = 'flex-1 py-2 font-semibold text-gray-400';
    container.innerHTML = state.reelsList.map(r => `
      <div onclick="shareReelToChat('${r.id}'); closeAttachMediaModal();" class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition">
        <div class="flex items-center gap-2.5 overflow-hidden">
          <i data-lucide="zap" class="w-6 h-6 text-purple-400 shrink-0"></i>
          <div class="truncate">
            <h4 class="text-xs font-bold text-white truncate">${r.title}</h4>
            <span class="text-[10px] text-gray-400">${r.creator}</span>
          </div>
        </div>
        <button class="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0">Send</button>
      </div>
    `).join('');
  }

  lucide.createIcons();
}

// ==================== 6. PAGE 4: PROFILE & IN-PLACE DATABASE UPDATE ====================
function initDatabase() {
  let users = localStorage.getItem(DB_USERS_KEY);
  if (!users) {
    const initialUsers = [CROCHIT_MEDIA_BANK.defaultUser];
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(initialUsers));
    users = JSON.stringify(initialUsers);
  }

  let activeSessionId = localStorage.getItem(DB_SESSION_KEY);
  const parsedUsers = JSON.parse(users);

  if (activeSessionId) {
    state.currentUser = parsedUsers.find(u => u.id === activeSessionId) || parsedUsers[0];
  } else {
    state.currentUser = parsedUsers[0];
    localStorage.setItem(DB_SESSION_KEY, state.currentUser.id);
  }
}

function getAllDatabaseUsers() {
  const users = localStorage.getItem(DB_USERS_KEY);
  return users ? JSON.parse(users) : [CROCHIT_MEDIA_BANK.defaultUser];
}

function saveDatabaseUsers(users) {
  localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
}

// IN-PLACE UPDATE (Crucial requirement: pehle wala record hi update hoga, duplicate nahi banega)
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
  // Find EXACT user in database by ID
  const existingUserIndex = users.findIndex(u => u.id === state.currentUser.id);

  if (existingUserIndex !== -1) {
    users[existingUserIndex].username = newUsername;
    if (newPassword) {
      users[existingUserIndex].password = newPassword;
    }

    saveDatabaseUsers(users);
    state.currentUser = users[existingUserIndex];

    if (state.supabaseClient) {
      syncProfileUpdateToSupabase(newUsername, newPassword);
    }

    renderProfileData();

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

  const headerAvatar = document.getElementById('header-user-avatar');
  const headerUsername = document.getElementById('header-username-text');
  if (headerAvatar) headerAvatar.src = state.currentUser.avatar;
  if (headerUsername) headerUsername.textContent = state.currentUser.username.split(' ')[0];

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

// ==================== 7. SUPABASE CLOUD DATABASE CONFIG ====================
function initSupabase() {
  const config = localStorage.getItem(DB_SUPABASE_KEY);
  if (config) {
    try {
      const { url, key } = JSON.parse(config);
      if (url && key && window.supabase) {
        state.supabaseClient = window.supabase.createClient(url, key);
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
  alert('Supabase credentials saved! Users worldwide can now authenticate with cloud database on Vercel.');
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

// ==================== 8. AUTH MODAL (SIGN IN / SIGN UP) ====================
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
    const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      alert('An account with this email already exists. Please Sign In.');
      return;
    }

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

// ==================== 9. NAVIGATION TABS ROUTING ====================
function switchMainTab(tab) {
  state.activeTab = tab;
  const tabs = ['home', 'feed', 'chat', 'profile'];

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

  const searchContainer = document.getElementById('header-search-container');
  const headerLabel = document.getElementById('header-active-tab-label');

  if (tab === 'home') {
    if (searchContainer) searchContainer.classList.remove('hidden');
    if (headerLabel) headerLabel.textContent = 'Home • Long Videos';
  } else if (tab === 'feed') {
    if (searchContainer) searchContainer.classList.add('hidden');
    if (headerLabel) headerLabel.textContent = 'Feed • Vertical Reels';
    // Trigger intersection observer on reels
    setTimeout(() => setupReelsIntersectionObserver(), 100);
  } else if (tab === 'chat') {
    if (searchContainer) searchContainer.classList.add('hidden');
    if (headerLabel) headerLabel.textContent = 'Chat • Live Messaging';
  } else if (tab === 'profile') {
    if (searchContainer) searchContainer.classList.add('hidden');
    if (headerLabel) headerLabel.textContent = 'Profile • User & Database';
    renderProfileData();
  }

  // Update Desktop Sidebar
  tabs.forEach(t => {
    const sBtn = document.getElementById(`sidebar-tab-${t}`);
    if (sBtn) {
      if (t === tab) {
        sBtn.className = 'w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-semibold transition text-white bg-purple-600/20 border border-purple-500/30 shadow-sm';
      } else {
        sBtn.className = 'w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium transition text-gray-400 hover:text-white hover:bg-white/5';
      }
    }
  });

  // Update Mobile Bottom Nav Bar
  tabs.forEach(t => {
    const bBtn = document.getElementById(`bottom-tab-${t}`);
    if (bBtn) {
      if (t === tab) {
        bBtn.className = 'flex flex-col items-center gap-1 text-purple-400' + (t === 'chat' ? ' relative' : '');
      } else {
        bBtn.className = 'flex flex-col items-center gap-1 text-gray-400' + (t === 'chat' ? ' relative' : '');
      }
    }
  });

  lucide.createIcons();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
