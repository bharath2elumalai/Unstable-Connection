/**
 * UNSTABLE CONNECTION MESSENGER - CLIENT SCRIPT
 * Multi-Room WebSockets, E2EE Simulation, Voice Notes (MediaRecorder),
 * Photo Sharing, Live Typing Indicators, Browser Push Notifications & AI Assistant
 */

// =============================================================================
// STATE & CONFIGURATION
// =============================================================================
let currentRoom = 'general';
let e2eeEnabled = true;
let soundEnabled = localStorage.getItem('unstable_sound') !== 'false';
let audioCtx = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;

// =============================================================================
// AUDIO NOTIFICATION CHIME (Web Audio API - 100% Offline Compatible)
// =============================================================================
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
}

function playNotificationChime() {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  } catch (e) {
    console.debug('Notification sound:', e);
  }
}

// =============================================================================
// END-TO-END ENCRYPTION (E2EE) SIMULATION (XOR Stream Cipher)
// =============================================================================
const E2EE_KEY = "UnstableConnectionSecretKey2026";

function encryptE2EE(plainText) {
  if (!plainText || !e2eeEnabled) return plainText;
  try {
    let output = "";
    for (let i = 0; i < plainText.length; i++) {
      output += String.fromCharCode(plainText.charCodeAt(i) ^ E2EE_KEY.charCodeAt(i % E2EE_KEY.length));
    }
    return "🔒ENC:" + btoa(output);
  } catch (e) {
    return plainText;
  }
}

function decryptE2EE(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith("🔒ENC:")) {
    return { text: cipherText, wasEncrypted: false };
  }
  try {
    const raw = atob(cipherText.replace("🔒ENC:", ""));
    let output = "";
    for (let i = 0; i < raw.length; i++) {
      output += String.fromCharCode(raw.charCodeAt(i) ^ E2EE_KEY.charCodeAt(i % E2EE_KEY.length));
    }
    return { text: output, wasEncrypted: true };
  } catch (e) {
    return { text: cipherText, wasEncrypted: false };
  }
}

// =============================================================================
// VIBRANT COLOR PALETTE FOR GROUP SENDER NAMES (TELEGRAM STYLE)
// =============================================================================
const VIBRANT_NAME_COLORS = [
  '#0088cc', '#e056fd', '#25d366', '#ff4757', '#ffa502', '#8e44ad', '#00d2d3', '#ff6b4a'
];

function getVibrantColor(name) {
  if (!name) return VIBRANT_NAME_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return VIBRANT_NAME_COLORS[Math.abs(hash) % VIBRANT_NAME_COLORS.length];
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// =============================================================================
// EMOJI DATABASE FOR FULL EMOJI PICKER
// =============================================================================
const EMOJI_CATEGORIES = {
  smileys: [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖',
    '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯'
  ],
  gestures: [
    '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘',
    '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️',
    '✋', '🖖', '🫱', '🫲', '🤝', '👏', '🙌', '👐', '🤲', '🙏',
    '✍️', '💪', '🦾', '🖕', '✊', '👊', '🤛', '🤜', '🦶', '👂'
  ],
  hearts: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
    '🔥', '✨', '⭐', '🌟', '💫', '💥', '💯', '💢', '💤', '🎉'
  ],
  tech: [
    '💻', '🖥️', '📱', '📲', '☎️', '📞', '🔋', '🔌', '📡', '🛰️',
    '🚀', '⚡', '💡', '🤖', '👾', '🎮', '🎧', '📸', '📹', '☕',
    '🍕', '🍔', '🍦', '🍩', '🍺', '🍻', '🍷', '🥂', '🎯', '🏆'
  ]
};

// =============================================================================
// API HELPERS
// =============================================================================
let cachedName = null;

async function load_name() {
  if (cachedName !== null) return cachedName;
  try {
    const res = await fetch('/get_name');
    const data = await res.json();
    cachedName = data.name || '';
    return cachedName;
  } catch (e) {
    console.error('Failed to load user name', e);
    return '';
  }
}

async function load_messages() {
  try {
    const res = await fetch('/get_messages');
    return await res.json();
  } catch (e) {
    console.error('Failed to load message history', e);
    return [];
  }
}

function dateNow() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function scrollSmoothToBottom(id) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.scrollTo({
      top: elem.scrollHeight,
      behavior: 'smooth'
    });
  }
}

// =============================================================================
// BROWSER DESKTOP PUSH NOTIFICATIONS
// =============================================================================
function triggerPushNotification(sender, content) {
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(`Unstable Connection - ${sender}`, {
        body: content,
        icon: 'https://cdn-icons-png.flankicon.com/512/1041/1041916.png'
      });
    } catch (e) {
      console.debug("Push notification error:", e);
    }
  }
}

// =============================================================================
// WHATSAPP & TELEGRAM MESSAGE RENDERING
// =============================================================================
async function add_messages(msg, scroll = true) {
  const messagesDiv = document.getElementById("messages");
  if (!messagesDiv || !msg) return;

  const currentUserName = await load_name();

  // 1. System / Connection Announcement
  if (msg.connect || (!msg.name && msg.message)) {
    const pill = document.createElement("div");
    pill.className = "wa-system-pill";
    pill.innerHTML = `
      <i class="fa-solid fa-bell text-warning"></i>
      <span>${escapeHTML(msg.message)}</span>
    `;
    messagesDiv.appendChild(pill);
    if (scroll) scrollSmoothToBottom("messages");
    return;
  }

  // 2. Standard Chat Message Bubble (with Photo / Voice Note / E2EE)
  if (typeof msg.name !== 'undefined' && msg.name !== "") {
    const isOutgoing = (currentUserName === msg.name);
    let timeStr = msg.time || dateNow();
    if (timeStr.includes(" ")) {
      timeStr = timeStr.split(" ")[1] || timeStr;
    }

    // Decrypt if E2EE ciphertext was detected
    const dec = decryptE2EE(msg.message);
    const displayText = dec.text;
    const wasE2EE = dec.wasEncrypted;

    const row = document.createElement("div");
    row.className = `wa-bubble-row ${isOutgoing ? 'outgoing' : 'incoming'}`;

    // Image Photo Attachment
    let imageHTML = '';
    if (msg.image) {
      imageHTML = `<img src="${msg.image}" class="wa-bubble-image" alt="Attachment" onclick="window.open(this.src)">`;
    }

    // Voice Note HTML5 Audio Player
    let audioHTML = '';
    if (msg.audio) {
      audioHTML = `
        <div class="d-flex align-items-center my-1" style="gap: 8px;">
          <i class="fa-solid fa-microphone text-danger" style="font-size: 1.1rem;"></i>
          <audio controls src="${msg.audio}" style="max-width: 240px; height: 36px; outline: none; border-radius: 20px;"></audio>
        </div>
      `;
    }

    // Text Content
    let textHTML = '';
    if (displayText && displayText !== "[Photo Attachment 📷]" && displayText !== "[Voice Note 🎤]") {
      textHTML = `<p class="wa-message-text">${escapeHTML(displayText)}</p>`;
    }

    // E2EE Lock Icon
    const e2eeIconHTML = wasE2EE ? '<i class="fa-solid fa-lock text-success mr-1" title="E2EE Decrypted" style="font-size: 0.65rem;"></i>' : '';

    if (isOutgoing) {
      // Outgoing (WhatsApp Light Green on Right with Blue Ticks)
      row.innerHTML = `
        <div class="wa-bubble">
          ${imageHTML}
          ${audioHTML}
          ${textHTML}
          <div class="wa-bubble-meta">
            ${e2eeIconHTML}
            <span>${escapeHTML(timeStr)}</span>
            <span class="wa-ticks">✓✓</span>
          </div>
        </div>
      `;
    } else {
      // Incoming (White on Left with Telegram-Style Colored Name)
      const nameColor = (msg.is_bot) ? '#0088cc' : getVibrantColor(msg.name);
      const botBadge = (msg.is_bot) ? ' <span class="badge badge-info" style="font-size:0.65rem;">BOT</span>' : '';

      row.innerHTML = `
        <div class="wa-bubble">
          <span class="wa-sender-name" style="color: ${nameColor};">
            ${escapeHTML(msg.name)}${botBadge}
          </span>
          ${imageHTML}
          ${audioHTML}
          ${textHTML}
          <div class="wa-bubble-meta">
            ${e2eeIconHTML}
            <span>${escapeHTML(timeStr)}</span>
          </div>
        </div>
      `;
    }

    messagesDiv.appendChild(row);

    // Audio chime & desktop push notification for incoming messages from others
    if (!isOutgoing && scroll) {
      playNotificationChime();
      triggerPushNotification(msg.name, displayText || (msg.image ? "Sent a photo" : "Sent a voice note"));
    }

    if (scroll) {
      scrollSmoothToBottom("messages");
    }
  }
}

// =============================================================================
// SOCKET.IO REALTIME EVENTS
// =============================================================================
const socket = io();

socket.on('connect', async function() {
  console.log('[Unstable Connection] Connected to WebSocket Relay via Socket.IO v4');
  const usr_name = await load_name();
  if (usr_name && usr_name !== "") {
    socket.emit('user_join', { name: usr_name, room: currentRoom });
    socket.emit('event', {
      message: `${usr_name} linked to #${currentRoom}`,
      room: currentRoom,
      connect: true
    });
  }
});

socket.on('online_users_update', function(data) {
  const countBadge = document.getElementById('onlineCountBadge');
  if (countBadge && data.count) {
    countBadge.textContent = `${data.count} online`;
  }
});

// Live Typing Indicator Handling
socket.on('user typing', function(data) {
  const typingIndicator = document.getElementById('typingIndicator');
  const typingUser = document.getElementById('typingUser');
  const navStatus = document.getElementById('navStatusText');
  const onlineDot = document.getElementById('onlineDot');

  if (typingIndicator && typingUser && data.name) {
    typingUser.textContent = data.name;
    typingIndicator.style.display = 'inline-flex';
    if (navStatus) navStatus.style.display = 'none';
    if (onlineDot) onlineDot.style.display = 'none';
  }
});

socket.on('user stop typing', function() {
  const typingIndicator = document.getElementById('typingIndicator');
  const navStatus = document.getElementById('navStatusText');
  const onlineDot = document.getElementById('onlineDot');

  if (typingIndicator) {
    typingIndicator.style.display = 'none';
    if (navStatus) navStatus.style.display = 'inline';
    if (onlineDot) onlineDot.style.display = 'inline-block';
  }
});

socket.on('message response', function(msg) {
  add_messages(msg, true);
});

// =============================================================================
// UI CONTROLS, VOICE RECORDER & EVENT LISTENERS
// =============================================================================
$(document).ready(async function() {
  const msgInput = document.getElementById("msg");

  // Multi-Room / Channel Selector
  const roomSelector = document.getElementById('roomSelector');
  if (roomSelector) {
    roomSelector.addEventListener('change', async function() {
      const newRoom = this.value;
      const user_name = await load_name();

      // Leave old room, join new room
      socket.emit('leave', { room: currentRoom, name: user_name });
      currentRoom = newRoom;
      socket.emit('join', { room: currentRoom, name: user_name });

      const messagesDiv = document.getElementById("messages");
      if (messagesDiv) {
        messagesDiv.innerHTML = `
          <div class="wa-date-pill">
            <i class="fa-solid fa-hashtag mr-1"></i> Switched to channel #${currentRoom}
          </div>
        `;
      }
    });
  }

  // End-to-End Encryption (E2EE) Toggle
  const e2eeToggleBtn = document.getElementById('e2eeToggleBtn');
  const e2eeBadge = document.getElementById('e2eeBadge');
  const e2eeIcon = document.getElementById('e2eeIcon');

  if (e2eeToggleBtn) {
    e2eeToggleBtn.addEventListener('click', function() {
      e2eeEnabled = !e2eeEnabled;
      if (e2eeBadge && e2eeIcon) {
        if (e2eeEnabled) {
          e2eeBadge.className = 'badge badge-light ml-2 text-success';
          e2eeBadge.innerHTML = '<i class="fa-solid fa-lock mr-1"></i>E2EE Active';
          e2eeIcon.className = 'fa-solid fa-shield-halved text-success';
        } else {
          e2eeBadge.className = 'badge badge-light ml-2 text-muted';
          e2eeBadge.innerHTML = '<i class="fa-solid fa-lock-open mr-1"></i>Plaintext';
          e2eeIcon.className = 'fa-solid fa-shield-halved text-muted';
        }
      }
    });
  }

  // Desktop Push Notification Permission Request
  const pushBtn = document.getElementById('pushNotifyBtn');
  if (pushBtn) {
    pushBtn.addEventListener('click', function() {
      if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            alert("Desktop notifications enabled! You'll receive alerts when this tab is inactive.");
          } else {
            alert("Notifications were dismissed or blocked in browser settings.");
          }
        });
      } else {
        alert("Your browser does not support desktop push notifications.");
      }
    });
  }

  // Render Emojis for Active Tab
  function renderEmojiGrid(category) {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const emojis = EMOJI_CATEGORIES[category] || EMOJI_CATEGORIES.smileys;

    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wa-emoji-item';
      btn.textContent = emoji;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        insertEmojiAtCursor(emoji);
      });
      grid.appendChild(btn);
    });
  }

  function insertEmojiAtCursor(emoji) {
    if (!msgInput) return;
    const start = msgInput.selectionStart || msgInput.value.length;
    const end = msgInput.selectionEnd || msgInput.value.length;
    const val = msgInput.value;

    msgInput.value = val.substring(0, start) + emoji + val.substring(end);
    msgInput.focus();
    const newPos = start + emoji.length;
    msgInput.setSelectionRange(newPos, newPos);
  }

  renderEmojiGrid('smileys');

  $('.wa-tab-btn').on('click', function() {
    $('.wa-tab-btn').removeClass('active');
    $(this).addClass('active');
    const tab = $(this).data('tab');
    renderEmojiGrid(tab);
  });

  // Toggle Emoji Picker Popup
  const emojiPopup = document.getElementById('emojiPickerPopup');
  const smileyBtn = document.getElementById('smileyBtn');
  const closeEmojiBtn = document.getElementById('closeEmojiPickerBtn');

  if (smileyBtn && emojiPopup) {
    smileyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const isVisible = (emojiPopup.style.display === 'flex');
      emojiPopup.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        renderEmojiGrid('smileys');
      }
    });
  }

  if (closeEmojiBtn && emojiPopup) {
    closeEmojiBtn.addEventListener('click', function() {
      emojiPopup.style.display = 'none';
    });
  }

  document.addEventListener('click', function(e) {
    if (emojiPopup && emojiPopup.style.display === 'flex') {
      if (!emojiPopup.contains(e.target) && e.target !== smileyBtn && !smileyBtn.contains(e.target)) {
        emojiPopup.style.display = 'none';
      }
    }
  });

  $('.wa-emoji-tag').on('click', function() {
    const emoji = $(this).data('emoji');
    insertEmojiAtCursor(emoji);
  });

  // ===========================================================================
  // VOICE NOTE AUDIO RECORDING (MediaRecorder API)
  // ===========================================================================
  const micBtn = document.getElementById('micBtn');
  const micIcon = document.getElementById('micIcon');
  const recordingBar = document.getElementById('recordingBar');
  const inputCapsule = document.getElementById('inputCapsule');
  const stopRecBtn = document.getElementById('stopRecBtn');
  const recTimer = document.getElementById('recTimer');

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          const user_name = await load_name();
          socket.emit('event', {
            name: user_name,
            audio: base64Audio,
            message: '[Voice Note 🎤]',
            room: currentRoom
          });
        };
        reader.readAsDataURL(audioBlob);

        // Turn off mic tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();

      // UI changes
      if (recordingBar) recordingBar.classList.remove('d-none');
      if (recordingBar) recordingBar.classList.add('d-flex');
      if (inputCapsule) inputCapsule.style.display = 'none';
      if (micIcon) micIcon.style.color = '#ff4757';

      recordingSeconds = 0;
      clearInterval(recordingTimer);
      recordingTimer = setInterval(() => {
        recordingSeconds++;
        const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
        const secs = String(recordingSeconds % 60).padStart(2, '0');
        if (recTimer) recTimer.textContent = `${mins}:${secs}`;
      }, 1000);
    } catch (err) {
      alert("Microphone permission denied or unavailable: " + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    clearInterval(recordingTimer);
    if (recordingBar) {
      recordingBar.classList.remove('d-flex');
      recordingBar.classList.add('d-none');
    }
    if (inputCapsule) inputCapsule.style.display = 'flex';
    if (micIcon) micIcon.style.color = '#54656f';
  }

  if (micBtn) {
    micBtn.addEventListener('click', function() {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
      } else {
        startRecording();
      }
    });
  }

  if (stopRecBtn) {
    stopRecBtn.addEventListener('click', stopRecording);
  }

  // ===========================================================================
  // PHOTO / IMAGE ATTACHMENTS
  // ===========================================================================
  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('imageFileInput');

  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', function() {
      fileInput.click();
    });

    fileInput.addEventListener('change', async function() {
      const file = this.files[0];
      if (!file) return;

      if (file.size > 8 * 1024 * 1024) {
        alert("Please select an image smaller than 8MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = async function(e) {
        const base64Data = e.target.result;
        const user_name = await load_name();
        const caption = msgInput ? msgInput.value.trim() : '';

        socket.emit('event', {
          name: user_name,
          image: base64Data,
          message: caption || '[Photo Attachment 📷]',
          room: currentRoom
        });

        if (msgInput) msgInput.value = '';
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }

  // Live Typing Indicator Listener
  let typingTimer = null;
  if (msgInput) {
    msgInput.addEventListener('input', async function() {
      const user_name = await load_name();
      if (!user_name) return;

      socket.emit('typing', { name: user_name, room: currentRoom });

      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        socket.emit('stop_typing', { name: user_name, room: currentRoom });
      }, 1500);
    });
  }

  // Sound Toggle Button
  const soundBtn = document.getElementById('soundToggleBtn');
  function updateSoundUI() {
    if (soundBtn) {
      if (soundEnabled) {
        soundBtn.innerHTML = '<i class="fa-solid fa-volume-high text-success"></i>';
        soundBtn.title = 'Sound is ON';
      } else {
        soundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark text-muted"></i>';
        soundBtn.title = 'Sound is OFF';
      }
    }
  }
  updateSoundUI();

  if (soundBtn) {
    soundBtn.addEventListener('click', function() {
      soundEnabled = !soundEnabled;
      localStorage.setItem('unstable_sound', soundEnabled ? 'true' : 'false');
      updateSoundUI();
      if (soundEnabled) playNotificationChime();
    });
  }

  // Clear Local Screen View
  const clearBtn = document.getElementById('clearViewBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      const messagesDiv = document.getElementById("messages");
      if (messagesDiv) {
        messagesDiv.innerHTML = `
          <div class="wa-date-pill">
            <i class="fa-solid fa-broom mr-1"></i> SCREEN CLEARED LOCALLY
          </div>
        `;
      }
    });
  }

  // Submit Message Form
  $('form#msgForm').on('submit', async function(e) {
    e.preventDefault();
    if (!msgInput) return;
    const rawText = msgInput.value.trim();
    if (rawText === "") return;

    const user_name = await load_name();
    msgInput.value = "";

    clearTimeout(typingTimer);
    socket.emit('stop_typing', { name: user_name, room: currentRoom });

    // Apply E2EE encryption if enabled and not a bot command
    const finalText = (rawText.startsWith("/ai ") || rawText.startsWith("@bot ")) ? rawText : encryptE2EE(rawText);

    socket.emit('event', {
      message: finalText,
      name: user_name,
      room: currentRoom
    });
  });

  // Load and Render Message History on Startup
  const historyMsgs = await load_messages();
  if (historyMsgs && historyMsgs.length > 0) {
    for (let i = 0; i < historyMsgs.length; i++) {
      const isLast = (i === historyMsgs.length - 1);
      await add_messages(historyMsgs[i], isLast);
    }
  }
});