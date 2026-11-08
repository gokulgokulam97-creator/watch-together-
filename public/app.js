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
let peerConnection = null;
let localStream = null;
let isHost = false;

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

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

// Video file selection (Host only)
videoInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  isHost = true;
  const url = URL.createObjectURL(file);
  videoPlayer.src = url;
  videoOverlay.classList.add('hidden');
  videoPlayer.load();

  // Capture stream from video element
  if (videoPlayer.captureStream) {
    localStream = videoPlayer.captureStream();
  } else if (videoPlayer.mozCaptureStream) {
    localStream = videoPlayer.mozCaptureStream();
  }

  // Notify others that host has a video and start streaming if someone is already in the room
  socket.emit('host-ready');
  
  // If there are other users, start the offer immediately
  setTimeout(() => {
    if (isHost && localStream && !peerConnection) {
      startStreaming();
    }
  }, 500);
});

async function startStreaming() {
  if (peerConnection) return;
  await createPeerConnection();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('webrtc-offer', { offer });
}

// Create peer connection
async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(iceServers);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', { candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    videoPlayer.srcObject = event.streams[0];
    videoOverlay.classList.add('hidden');
    addChatMessage({ system: true, message: 'Receiving video' });
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'connected') {
      addChatMessage({ system: true, message: 'Video connected' });
    } else if (peerConnection.connectionState === 'failed') {
      addChatMessage({ system: true, message: 'Connection failed — try refreshing' });
    }
  };

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
}

// WebRTC signaling
socket.on('webrtc-offer', async (data) => {
  await createPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('webrtc-answer', { answer });
});

socket.on('webrtc-answer', async (data) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on('webrtc-ice-candidate', async (data) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

socket.on('host-ready', async () => {
  if (!isHost && !peerConnection) {
    // Guest waits for offer
  }
});

// When host has stream and someone joins, send offer
socket.on('user-list', async (users) => {
  const count = users.length;
  userCountEl.textContent = `${count} watching`;
  document.getElementById('users-online').textContent = `${count} online`;

  if (isHost && localStream && count > 1 && !peerConnection) {
    startStreaming();
  }
});

// Play/Pause (host controls)
function togglePlay() {
  if (videoPlayer.paused) {
    videoPlayer.play();
    playPauseBtn.textContent = '⏸';
  } else {
    videoPlayer.pause();
    playPauseBtn.textContent = '▶';
  }
  socket.emit('video-action', {
    playing: !videoPlayer.paused,
    currentTime: videoPlayer.currentTime
  });
}

playPauseBtn.addEventListener('click', togglePlay);
videoPlayer.addEventListener('click', togglePlay);

// Seek
progressBar.addEventListener('click', (e) => {
  const rect = progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  videoPlayer.currentTime = percent * videoPlayer.duration;
  socket.emit('video-action', {
    playing: !videoPlayer.paused,
    currentTime: videoPlayer.currentTime
  });
});

// Format time
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgress() {
  if (videoPlayer.duration) {
    const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    progress.style.width = percent + '%';
    timeDisplay.textContent = `${formatTime(videoPlayer.currentTime)} / ${formatTime(videoPlayer.duration)}`;
  }
}

videoPlayer.addEventListener('timeupdate', updateProgress);
videoPlayer.addEventListener('loadedmetadata', updateProgress);

// Receive sync from host
socket.on('video-sync', (state) => {
  if (Math.abs(videoPlayer.currentTime - state.currentTime) > 2) {
    videoPlayer.currentTime = state.currentTime;
  }
  if (state.playing && videoPlayer.paused) {
    videoPlayer.play();
    playPauseBtn.textContent = '⏸';
  } else if (!state.playing && !videoPlayer.paused) {
    videoPlayer.pause();
    playPauseBtn.textContent = '▶';
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

// Fullscreen
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

// Load saved username
const savedName = localStorage.getItem('watchtogether_name');
if (savedName) usernameInput.value = savedName;

usernameInput.addEventListener('change', () => {
  localStorage.setItem('watchtogether_name', usernameInput.value);
});
