


const state = {
  groqKey: '',
  model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  messages: [],
  chatHistory: [],
  userName: 'User',
  webcamStream: null,
  isRecording: false,
  recognition: null,
  mediaRecorder: null,
  mediaStream: null,
  audioChunks: [],
  isTranscribing: false,
  pendingAttachment: null,
  clipboardContent: '',
  sidebarCollapsed: false,
  currentChatId: 1,
};




function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(id);
  page.classList.add('active');
  if (id === 'chat') {

    checkMobileLayout();
  }
}

function checkMobileLayout() {
  const btn = document.getElementById('mobileSidebarBtn');
  if (window.innerWidth <= 900) {
    btn.style.display = 'flex';
  } else {
    btn.style.display = 'none';
  }
}
window.addEventListener('resize', checkMobileLayout);




function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const key = document.getElementById('groqKeyInput').value.trim();
  if (!email) { showToast('Please enter your email.', 'error'); return; }
  state.groqKey = key;
  state.userName = email.split('@')[0];
  document.getElementById('userNameSidebar').textContent = state.userName;
  document.getElementById('userAvatarSidebar').textContent = state.userName[0].toUpperCase();
  if (!key) {
    showToast('No API key — demo mode enabled.', 'info');
  } else {
    showToast('Welcome back, ' + state.userName + '!', 'success');
  }
  showPage('chat');
  loadModel();
}

function handleDemo() {
  state.userName = 'Guest';
  state.groqKey = '';
  document.getElementById('userNameSidebar').textContent = 'Guest User';
  document.getElementById('userAvatarSidebar').textContent = 'G';
  showToast('Demo mode — add an API key in Settings for AI responses.', 'info');
  showPage('chat');
}

function togglePw() {
  const input = document.getElementById('loginPassword');
  const icon = document.getElementById('pwIcon');
  if (input.type === 'password') { input.type = 'text'; icon.className = 'fas fa-eye-slash'; }
  else { input.type = 'password'; icon.className = 'fas fa-eye'; }
}

function toggleGroqKey() {
  const input = document.getElementById('groqKeyInput');
  const icon = document.getElementById('groqKeyIcon');
  if (input.type === 'password') { input.type = 'text'; icon.className = 'fas fa-eye-slash'; }
  else { input.type = 'password'; icon.className = 'fas fa-eye'; }
}




function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  state.sidebarCollapsed = !state.sidebarCollapsed;
  sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
  document.querySelectorAll('.sidebar-text').forEach(el => {
    el.style.display = state.sidebarCollapsed ? 'none' : '';
  });
  document.getElementById('sidebarLogo').style.display = state.sidebarCollapsed ? 'none' : '';
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}




function openSettings() {
  document.getElementById('settingsGroqKey').value = state.groqKey;
  document.getElementById('modelSelect').value = state.model;
  document.getElementById('settingsModal').classList.add('visible');
}
function closeSettings() {
  document.getElementById('settingsModal').classList.remove('visible');
}
function saveSettings() {
  state.groqKey = document.getElementById('settingsGroqKey').value.trim();
  state.model = document.getElementById('modelSelect').value;
  closeSettings();
  showToast('Settings saved!', 'success');
  loadModel();
}
function loadModel() {
  document.getElementById('modelSelect') && (document.getElementById('modelSelect').value = state.model);
}




function newChat() {
  state.messages = [];
  state.chatHistory = [];
  document.getElementById('chatMessages').innerHTML = '';
  const ws = document.createElement('div');
  ws.className = 'welcome-screen';
  ws.id = 'welcomeScreen';
  ws.innerHTML = `
    <div class="welcome-orb"><i class="fas fa-brain"></i></div>
    <div>
      <div class="welcome-title">Hello, I'm ABD AI</div>
      <div class="welcome-subtitle">Ask me anything. Use voice, share your camera, paste from clipboard, or upload documents.</div>
    </div>
    <div class="welcome-grid">
      <div class="welcome-card" onclick="sendQuickPrompt('Open my webcam and describe what you see')">
        <i class="fas fa-video"></i><strong>See my camera</strong><span>Open webcam and describe the scene</span>
      </div>
      <div class="welcome-card" onclick="sendQuickPrompt('Read my clipboard and explain what it contains')">
        <i class="fas fa-clipboard"></i><strong>Read clipboard</strong><span>Paste &amp; analyse any content</span>
      </div>
      <div class="welcome-card" onclick="triggerFileAttach()">
        <i class="fas fa-file-upload"></i><strong>Upload document</strong><span>Analyse a PDF or image file</span>
      </div>
      <div class="welcome-card" onclick="startVoice()">
        <i class="fas fa-microphone"></i><strong>Voice message</strong><span>Speak your question aloud</span>
      </div>
    </div>`;
  document.getElementById('chatMessages').appendChild(ws);


  state.currentChatId++;
  const list = document.getElementById('chatList');
  list.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
  const item = document.createElement('div');
  item.className = 'chat-item active';
  item.innerHTML = '<i class="fas fa-comment"></i><span>New Conversation</span>';
  list.insertBefore(item, list.firstChild);
}

function sendQuickPrompt(text) {
  document.getElementById('messageInput').value = text;
  sendMessage();
}

function removeWelcomeScreen() {
  const ws = document.getElementById('welcomeScreen');
  if (ws) ws.remove();
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  const attachment = state.pendingAttachment;
  if (!text && !attachment) return;

  removeWelcomeScreen();
  input.value = '';
  autoResizeTextarea(input);


  const lowerText = text.toLowerCase();
  if (lowerText.includes('webcam') || lowerText.includes('camera') || lowerText.includes('open cam')) {
    renderUserMessage(text);
    state.messages.push({role:'user', content: text});
    appendToSidebarHistory(text);
    openWebcam();
    return;
  }
  if (lowerText.includes('clipboard') && !attachment) {
    renderUserMessage(text);
    state.messages.push({role:'user', content: text});
    appendToSidebarHistory(text);
    await handleClipboardCommand(text);
    return;
  }


  renderUserMessage(text, attachment);
  clearAttachment();


  if (attachment && attachment.type === 'image') {
    state.messages.push({
      role: 'user',
      content: [
        { type: 'text', text: text || 'Please analyse this image and describe everything you see.' },
        { type: 'image_url', image_url: { url: attachment.dataUrl } }
      ]
    });
  } else if (attachment && attachment.type === 'pdf') {
    state.messages.push({
      role: 'user',
      content: `${text || 'Please analyse this document.'}\n\n[Attached PDF: ${attachment.name}]\n${attachment.textContent || '(PDF content could not be extracted — please describe what you know about PDF analysis.)'}`
    });
  } else {
    state.messages.push({ role: 'user', content: text });
  }

  appendToSidebarHistory(text);
  await getAIResponse();
}

function renderUserMessage(text, attachment) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message-row user';
  const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  let attachHtml = '';
  if (attachment) {
    if (attachment.type === 'image') {
      attachHtml = `<div class="msg-attachment-preview"><img src="${attachment.dataUrl}" alt="attached image"></div>`;
    } else if (attachment.type === 'pdf') {
      attachHtml = `<div class="msg-pdf-badge"><i class="fas fa-file-pdf"></i> ${attachment.name}</div>`;
    }
  }
  msgDiv.innerHTML = `
    <div class="msg-avatar user">${state.userName[0].toUpperCase()}</div>
    <div>
      <div class="msg-bubble">${attachHtml}${text ? escapeHtml(text) : ''}</div>
      <div class="msg-meta">${time}</div>
    </div>`;
  document.getElementById('chatMessages').appendChild(msgDiv);
  scrollToBottom();
}

function renderAIMessage(text, isError) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message-row ai';
  const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const color = isError ? 'color:#ef4444;' : '';
  msgDiv.innerHTML = `
    <div class="msg-avatar ai"><i class="fas fa-brain" style="font-size:14px;"></i></div>
    <div>
      <div class="msg-bubble" style="${color}">${formatMarkdown(text)}</div>
      <div class="msg-meta">${time} · ABD AI</div>
    </div>`;
  document.getElementById('chatMessages').appendChild(msgDiv);
  scrollToBottom();
  return msgDiv;
}

function showTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message-row ai';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar ai"><i class="fas fa-brain" style="font-size:14px;"></i></div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  document.getElementById('chatMessages').appendChild(div);
  scrollToBottom();
}

function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function getAIResponse() {
  if (!state.groqKey) {
    showTypingIndicator();
    await sleep(800);
    hideTypingIndicator();
    renderAIMessage("⚠️ **No API Key Configured**\n\nTo get real AI responses, please:\n1. Go to [console.groq.com](https://console.groq.com) and create a free account\n2. Generate an API key\n3. Click the ⚙️ **Settings** button in the sidebar or sign out and enter your key on login\n\nYou're currently in demo mode. All UI features (voice, webcam, clipboard, file upload) are fully functional!", false);
    state.messages.push({role:'assistant', content:'(demo mode — no API key)'});
    return;
  }

  showTypingIndicator();
  document.getElementById('sendBtn').disabled = true;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.groqKey}`
      },
      body: JSON.stringify({
        model: state.model,
        messages: [
          {
            role: 'system',
            content: `You are ABD AI, an intelligent multimodal assistant. You are helpful, concise, and informative. When analysing images, be thorough and descriptive. When explaining errors or code, be clear and actionable. When analysing documents, provide structured, comprehensive summaries. Today's date is ${new Date().toLocaleDateString()}.`
          },
          ...state.messages
        ],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    const data = await response.json();
    hideTypingIndicator();

    if (!response.ok) {
      const errMsg = data.error?.message || 'Unknown API error';
      renderAIMessage(`❌ **API Error:** ${errMsg}`, true);
      showToast('API Error: ' + errMsg, 'error');
      return;
    }

    const assistantMsg = data.choices?.[0]?.message?.content || 'No response received.';
    state.messages.push({ role: 'assistant', content: assistantMsg });
    renderAIMessage(assistantMsg);

  } catch (err) {
    hideTypingIndicator();
    renderAIMessage(`❌ **Network Error:** ${err.message}\n\nMake sure your API key is correct and you have an internet connection.`, true);
    showToast('Network error. Check your connection.', 'error');
  } finally {
    document.getElementById('sendBtn').disabled = false;
  }
}




function toggleWebcam() {
  if (state.webcamStream) {
    stopWebcam();
  } else {
    openWebcam();
  }
}

async function openWebcam() {
  const panel = document.getElementById('webcamPanel');
  panel.classList.add('visible');
  document.getElementById('webcamBtn').classList.add('active-tool');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    state.webcamStream = stream;
    const video = document.getElementById('webcamVideo');
    video.srcObject = stream;
    showToast('Webcam opened! Click "Analyse Frame" to describe what I see.', 'success');

    removeWelcomeScreen();
    renderAIMessage("📷 **Webcam is now live!**\n\nI can see your camera feed. Click the **\"Analyse Frame\"** button to capture the current frame and I'll describe everything I see in detail.");
    state.messages.push({role:'assistant', content:'Webcam opened successfully.'});
  } catch (err) {
    panel.classList.remove('visible');
    document.getElementById('webcamBtn').classList.remove('active-tool');
    showToast('Camera access denied: ' + err.message, 'error');
    renderAIMessage(`❌ **Camera Access Denied**\n\n${err.message}\n\nPlease allow camera permissions in your browser settings and try again.`, true);
  }
}

function stopWebcam() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach(t => t.stop());
    state.webcamStream = null;
  }
  document.getElementById('webcamPanel').classList.remove('visible');
  document.getElementById('webcamBtn').classList.remove('active-tool');
  document.getElementById('webcamVideo').srcObject = null;
  showToast('Webcam closed.', 'info');
}

async function captureAndAnalyze() {
  const video = document.getElementById('webcamVideo');
  const canvas = document.getElementById('captureCanvas');
  if (!state.webcamStream || !video.videoWidth) {
    showToast('Webcam not active.', 'error');
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

  removeWelcomeScreen();
  renderUserMessage('Analyse what you see in my webcam right now.', { type:'image', dataUrl, name:'webcam_capture' });

  state.messages.push({
    role: 'user',
    content: [
      { type: 'text', text: 'Please describe in detail everything you see in this webcam capture. Include people, objects, environment, lighting, colours, and any notable details.' },
      { type: 'image_url', image_url: { url: dataUrl } }
    ]
  });
  appendToSidebarHistory('Webcam analysis');
  await getAIResponse();
}




async function readClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) { showToast('Clipboard is empty.', 'info'); return; }
    state.clipboardContent = text;
    const preview = text.length > 80 ? text.substring(0, 80) + '…' : text;
    document.getElementById('clipboardPreviewText').textContent = '📋 ' + preview;
    document.getElementById('clipboardBanner').classList.add('visible');
    showToast('Clipboard content detected!', 'success');
  } catch (err) {
    showToast('Cannot access clipboard. Try Ctrl+V instead.', 'error');
  }
}

function dismissClipboard() {
  document.getElementById('clipboardBanner').classList.remove('visible');
  state.clipboardContent = '';
}

function useClipboardContent() {
  if (!state.clipboardContent) return;
  dismissClipboard();
  removeWelcomeScreen
();
  const content = state.clipboardContent;
  const text = `I have this content from my clipboard. Please analyse it, explain what it is, and if it's an error message or code, tell me what it means and how to fix any issues:\n\n\`\`\`\n${content}\n\`\`\``;
  document.getElementById('messageInput').value = text;
  sendMessage();
}

async function handleClipboardCommand(prompt) {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      state.clipboardContent = text;
      const fullPrompt = `${prompt}\n\nHere is the current clipboard content:\n\`\`\`\n${text}\n\`\`\`\n\nPlease analyse this content. If it's an error message, explain what it means and suggest fixes. If it's code, explain what it does. If it's plain text, summarise and explain it.`;
      state.messages.push({ role: 'user', content: fullPrompt });
      await getAIResponse();
    } else {
      renderAIMessage("📋 Your clipboard appears to be empty. Copy some text first, then ask me to read your clipboard!", false);
    }
  } catch (err) {
    renderAIMessage("⚠️ I couldn't access your clipboard directly. Please paste your content into the chat and I'll analyse it for you!", false);
  }
}




function triggerFileAttach() {
  document.getElementById('fileInput').click();
}

async function handleFileAttach(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) { showToast('File too large. Max 10MB.', 'error'); return; }

  if (file.type.startsWith('image/')) {
    const dataUrl = await readFileAsDataURL(file);
    state.pendingAttachment = { type: 'image', dataUrl, name: file.name };
    showAttachmentChip(`<img src="${dataUrl}" alt="img"> ${file.name}`, 'image');
    showToast('Image attached!', 'success');
    if (!document.getElementById('messageInput').value) {
      document.getElementById('messageInput').value = 'Please analyse this image and describe all the content you see in detail.';
    }
  } else if (file.type === 'application/pdf') {
    showToast('Loading PDF...', 'info');
    const dataUrl = await readFileAsDataURL(file);

    const textContent = await extractPDFText(file);
    state.pendingAttachment = { type: 'pdf', dataUrl, name: file.name, textContent };
    showAttachmentChip(`<i class="fas fa-file-pdf" style="color:#ef4444;"></i> ${file.name}`, 'pdf');
    showToast('PDF attached!', 'success');
    if (!document.getElementById('messageInput').value) {
      document.getElementById('messageInput').value = 'Please analyse this PDF document and provide a comprehensive summary of all its content, including key points, topics covered, and any important information.';
    }
  }
}

async function extractPDFText(file) {

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          document.head.appendChild(script);
          await new Promise(res => { script.onload = res; script.onerror = res; });
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
        }
        if (!window.pdfjsLib) { resolve(''); return; }
        const pdf = await window.pdfjsLib.getDocument({ data: e.target.result }).promise;
        let fullText = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str).join(' ') + '\n';
        }
        resolve(fullText.substring(0, 12000));
      } catch (err) {
        resolve('');
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function showAttachmentChip(innerHtml, type) {
  const bar = document.getElementById('attachmentPreviewBar');
  bar.innerHTML = `
    <div class="attachment-chip">
      ${innerHtml}
      <span class="remove-chip" onclick="clearAttachment()"><i class="fas fa-times"></i></span>
    </div>`;
}

function clearAttachment() {
  state.pendingAttachment = null;
  document.getElementById('attachmentPreviewBar').innerHTML = '';
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}




function toggleVoice() {
  if (state.isRecording) { stopVoice(); }
  else { startVoice(); }
}

function resetVoiceUI() {
  state.isRecording = false;
  const micBtn = document.getElementById('micBtn');
  const voiceStatus = document.getElementById('voiceStatus');
  if (micBtn) micBtn.classList.remove('recording');
  if (voiceStatus) voiceStatus.style.display = 'none';
}

function mapVoiceError(errorCode) {
  if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
    return 'Microphone permission denied. Allow mic access and try again.';
  }
  if (errorCode === 'no-speech') {
    return 'No speech detected. Please speak clearly and try again.';
  }
  if (errorCode === 'audio-capture') {
    return 'No microphone found. Check your mic connection/device settings.';
  }
  if (errorCode === 'network') {
    return 'Browser speech service network error. Falling back to direct audio transcription...';
  }
  if (errorCode === 'aborted') {
    return 'Voice input was stopped.';
  }
  return 'Voice error: ' + errorCode;
}

async function transcribeWithGroq(audioBlob) {
  const form = new FormData();
  form.append('file', audioBlob, 'voice.webm');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${state.groqKey}`
    },
    body: form
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Transcription failed');
  }
  return (data.text || '').trim();
}

async function startRecorderVoice() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast('Microphone recording is not supported in this browser.', 'error');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const recorder = new MediaRecorder(stream);
    state.mediaStream = stream;
    state.mediaRecorder = recorder;
    state.audioChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) state.audioChunks.push(e.data);
    };

    recorder.onstart = () => {
      state.isRecording = true;
      const micBtn = document.getElementById('micBtn');
      const voiceStatus = document.getElementById('voiceStatus');
      if (micBtn) micBtn.classList.add('recording');
      if (voiceStatus) {
        voiceStatus.style.display = 'flex';
        voiceStatus.innerHTML = '<i class="fas fa-circle" style="color:#ef4444;font-size:8px;"></i> Listening...';
      }
      showToast('Listening... click mic again to stop.', 'info');
    };

    recorder.onstop = async () => {
      const voiceStatus = document.getElementById('voiceStatus');
      if (voiceStatus) {
        voiceStatus.style.display = 'flex';
        voiceStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Transcribing...';
      }

      state.isTranscribing = true;
      try {
        const blob = new Blob(state.audioChunks, { type: recorder.mimeType || 'audio/webm' });
        const transcript = await transcribeWithGroq(blob);
        if (!transcript) {
          showToast('No speech detected. Please try again.', 'error');
        } else {
          const input = document.getElementById('messageInput');
          input.value = transcript;
          autoResizeTextarea(input);
          showToast('Voice converted to text.', 'success');
        }
      } catch (err) {
        showToast('Transcription failed: ' + err.message, 'error');
      } finally {
        state.isTranscribing = false;
        resetVoiceUI();
      }
    };

    recorder.start();
  } catch (err) {
    showToast('Cannot access microphone: ' + err.message, 'error');
  }
}

function cleanupRecorder() {
  if (state.mediaRecorder) {
    try {
      if (state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop();
    } catch (_) {}
    state.mediaRecorder = null;
  }
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
    state.mediaStream = null;
  }
}

async function startVoice() {
  if (state.isRecording || state.recognition || state.mediaRecorder || state.isTranscribing) return;

  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showToast('Voice input requires HTTPS (or localhost).', 'error');
    return;
  }


  if (state.groqKey) {
    await startRecorderVoice();
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('Add Groq API key in Settings to enable reliable voice transcription.', 'error');
    return;
  }

  const recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  state.recognition = recognition;

  recognition.onstart = () => {
    state.isRecording = true;
    const micBtn = document.getElementById('micBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    if (micBtn) micBtn.classList.add('recording');
    if (voiceStatus) voiceStatus.style.display = 'flex';
    showToast('Listening... speak now!', 'info');
  };

  recognition.onresult = (e) => {
    let transcript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    document.getElementById('messageInput').value = transcript;
    autoResizeTextarea(document.getElementById('messageInput'));
  };

  recognition.onend = () => {
    resetVoiceUI();
    state.recognition = null;
  };

  recognition.onerror = (e) => {
    resetVoiceUI();
    state.recognition = null;
    if (e.error === 'network' && state.groqKey) {
      startRecorderVoice();
      return;
    }
    if (e.error !== 'aborted') {
      showToast(mapVoiceError(e.error), 'error');
    }
  };

  try {
    recognition.start();
  } catch (err) {
    resetVoiceUI();
    state.recognition = null;
    showToast('Unable to start voice input: ' + err.message, 'error');
  }
}

function stopVoice() {
  if (state.recognition) {
    try { state.recognition.stop(); }
    catch (_) {}
    state.recognition = null;
  }
  cleanupRecorder();
  resetVoiceUI();
}




function appendToSidebarHistory(text) {
  const firstItem = document.getElementById('chatList').querySelector('.chat-item.active span');
  if (firstItem && firstItem.textContent === 'New Conversation') {
    firstItem.textContent = text.substring(0, 28) + (text.length > 28 ? '…' : '');
  }
}




function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function scrollToBottom() {
  const msgs = document.getElementById('chatMessages');
  msgs.scrollTo({ top: msgs.scrollHeight, behavior: 'smooth' });
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatMarkdown(text) {

  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }




document.addEventListener('DOMContentLoaded', () => {
  checkMobileLayout();

  const savedKey = localStorage.getItem('abdai_key');
  if (savedKey) {
    state.groqKey = savedKey;
    document.getElementById('groqKeyInput').value = savedKey;
  }
});


document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('groqKeyInput').addEventListener('blur', () => {
    const key = document.getElementById('groqKeyInput').value.trim();
    if (key) localStorage.setItem('abdai_key', key);
  });
});


document.getElementById('settingsModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('settingsModal')) closeSettings();
});
