const socket = io();

// Elements
const joinScreen = document.getElementById('join-screen');
const roomScreen = document.getElementById('room-screen');
const usernameInput = document.getElementById('username');
const roomCodeInput = document.getElementById('room-code');
const generateRoomBtn = document.getElementById('generate-room');
const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const currentRoomEl = document.getElementById('current-room');
const userCountEl = document.getElementById('user-count');
const videoPlayer = document.getElementById('video-player');
const videoInput = document.getElementById('video-input');
const videoOverlay = document.getElementById('video-overlay');
const playPauseBtn = document.getElementById('play-pause');
const progressBar = document.querySelector('.progress-bar');
const progress = document.getElementById('progress');
const timeDisplay = document.getElementById('time-display');
const fullscreenBtn = document.getElementById('fullscreen');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');

let currentRoom = null;
let isSyncing = false;
let lastSyncTime = 0;
const SYNC_THRESHOLD = 1.5; // seconds

// Generate random room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

generateRoomBtn.addEventListener('click', () => {
  roomCodeInput.value = generateRoomCode();
});

// Join room
joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim() || 'Guest';
  const roomId = roomCodeInput.value.trim().toUpperCase();
  
  if (!roomId) {
    alert('Please enter a room code');
    return;
  }

  currentRoom = roomId;
  socket.emit('join-room', { roomId, username });
  
  currentRoomEl.textContent = roomId;
  joinScreen.classList.remove('active');
  roomScreen.classList.add('active');
});

leaveBtn.addEventListener('click', () => {
  location.reload();
});

// Video file selection
videoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    videoPlayer.src = url;
    videoOverlay.classList.add('hidden');
    videoPlayer.load();
  }
});

// Format time
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update progress
function updateProgress() {
  if (videoPlayer.duration) {
    const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    progress.style.width = percent + '%';
    timeDisplay.textContent = `${formatTime(videoPlayer.currentTime)} / ${formatTime(videoPlayer.duration)}`;
  }
}

videoPlayer.addEventListener('timeupdate', updateProgress);
videoPlayer.addEventListener('loadedmetadata', updateProgress);

// Play/Pause
function togglePlay() {
  if (videoPlayer.paused) {
    videoPlayer.play();
    playPauseBtn.textContent = '⏸';
    emitVideoAction();
  } else {
    videoPlayer.pause();
    playPauseBtn.textContent = '▶';
    emitVideoAction();
  }
}

playPauseBtn.addEventListener('click', togglePlay);
videoPlayer.addEventListener('click', togglePlay);

// Seek
progressBar.addEventListener('click', (e) => {
  const rect = progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  videoPlayer.currentTime = percent * videoPlayer.duration;
  emitVideoAction();
});

// Mobile optimizations
document.addEventListener('touchstart', () => {}, { passive: true });

// Prevent iOS zoom on double-tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Better fullscreen handling for mobile
fullscreenBtn.addEventListener('click', () => {
  const container = document.querySelector('.video-container');
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } else {
    if (container.requestFullscreen) container.requestFullscreen();
    else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    else if (videoPlayer.webkitEnterFullscreen) videoPlayer.webkitEnterFullscreen();
  }
});

// Emit video state
function emitVideoAction() {
  if (!currentRoom || isSyncing) return;
  
  socket.emit('video-action', {
    playing: !videoPlayer.paused,
    currentTime: videoPlayer.currentTime
  });
}

// Receive sync
socket.on('video-sync', (state) => {
  if (!videoPlayer.src) return;
  
  isSyncing = true;
  
  const timeDiff = Math.abs(videoPlayer.currentTime - state.currentTime);
  
  if (timeDiff > SYNC_THRESHOLD) {
    videoPlayer.currentTime = state.currentTime;
  }
  
  if (state.playing && videoPlayer.paused) {
    videoPlayer.play();
    playPauseBtn.textContent = '⏸';
  } else if (!state.playing && !videoPlayer.paused) {
    videoPlayer.pause();
    playPauseBtn.textContent = '▶';
  }
  
  setTimeout(() => { isSyncing = false; }, 100);
});

// Initial room state
socket.on('room-state', (state) => {
  if (videoPlayer.src && state.currentTime > 0) {
    videoPlayer.currentTime = state.currentTime;
    if (state.playing) {
      videoPlayer.play();
      playPauseBtn.textContent = '⏸';
    }
  }
});

// Chat
function addChatMessage(data) {
  const div = document.createElement('div');
  div.className = 'chat-message' + (data.system ? ' system' : '');
  
  if (data.system) {
    div.textContent = data.message;
  } else {
    div.innerHTML = `<span class="username">${data.username}</span><span class="text">${escapeHtml(data.message)}</span>`;
  }
  
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const message = chatInput.value.trim();
  if (message) {
    socket.emit('chat-message', message);
    chatInput.value = '';
  }
}

socket.on('chat-message', addChatMessage);

socket.on('user-list', (users) => {
  const count = users.length;
  userCountEl.textContent = `${count} watching`;
  document.getElementById('users-online').textContent = `${count} online`;
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  }
});

// Load saved username
const savedName = localStorage.getItem('watchtogether_name');
if (savedName) usernameInput.value = savedName;

usernameInput.addEventListener('change', () => {
  localStorage.setItem('watchtogether_name', usernameInput.value);
});
