// --- CONFIGURATION ---
const API_BASE = "https://zlm-back-production.up.railway.app";

// --- Navigation Logic ---
function toggleMobileMenu() {
    const drawer = document.getElementById('mobileNavDrawer');
    const overlay = document.getElementById('mobileNavOverlay');
    const btn = document.getElementById('hamburgerBtn');
    const isOpen = drawer.classList.contains('open');
    drawer.classList.toggle('open', !isOpen);
    overlay.classList.toggle('open', !isOpen);
    btn.classList.toggle('active', !isOpen);
    document.body.style.overflow = isOpen ? 'auto' : 'hidden';
}

function closeMobileMenu() {
    const drawer = document.getElementById('mobileNavDrawer');
    const overlay = document.getElementById('mobileNavOverlay');
    const btn = document.getElementById('hamburgerBtn');
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    btn.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('hide'), 3000);
    setTimeout(() => toast.remove(), 3500);
}
function openTerms() { document.getElementById('terms-overlay').style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closeTerms() { document.getElementById('terms-overlay').style.display = 'none'; document.body.style.overflow = 'auto'; }
function openPrivacy() { document.getElementById('privacy-overlay').style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closePrivacy() { document.getElementById('privacy-overlay').style.display = 'none'; document.body.style.overflow = 'auto'; }

function switchGenModeAndShow(mode) {
    showSection('generate');
    switchGenMode(mode);
}

function showSection(sectionId) {
    document.querySelectorAll('.section-view').forEach(view => {
        view.classList.remove('active');
    });

    const target = document.getElementById('section-' + sectionId);
    target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.textContent.toLowerCase() === sectionId ||
            (sectionId === 'community' && link.textContent.toLowerCase().includes('community')) ||
            (sectionId === 'generate' && link.textContent.toLowerCase() === 'generate')) {
            link.classList.add('active');
        }
    });
    window.scrollTo(0, 0);
}

// --- Navbar Scroll Effect ---
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// --- Showcase Animation ---
const observerOptions = { threshold: 0.2 };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.showcase-row').forEach(row => observer.observe(row));
document.querySelectorAll('.pdf-step-card').forEach(card => observer.observe(card));

// --- Status Update Helper ---
function updateStatus(icon, text, isError = false) {
    document.getElementById('status-display').style.display = 'block';
    document.getElementById('preview-display-box').style.display = 'none';

    const statusBox = document.getElementById('status-display');
    statusBox.innerHTML = `
        <i class="ph ${icon}" style="font-size: 50px; color: ${isError ? '#ff2d55' : 'var(--primary)'}; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;"></i>
        <p style="color: ${isError ? '#ff2d55' : 'white'}; font-weight: 500;">${text}</p>
    `;
}

// --- Generator Logic ---
let currentGenMode = 't2i';
let currentRatio = '1:1';

function setRatio(ratio) {
    currentRatio = ratio;
    document.querySelectorAll('.ratio-btn').forEach(btn => btn.classList.remove('active'));
    if (ratio === '1:1') document.getElementById('ratio-square').classList.add('active');
    if (ratio === '16:9') document.getElementById('ratio-landscape').classList.add('active');
    if (ratio === '9:16') document.getElementById('ratio-portrait').classList.add('active');
}

async function generateNow() {
    const genBtn = document.getElementById('gen-btn');
    const promptInput = document.getElementById(currentGenMode === 't2i' ? 'image-prompt' : (currentGenMode === 'i2v' ? 'i2v-prompt' : 'video-prompt'));
    const prompt = promptInput.value.trim();

    if (!prompt) { showToast("Please enter a prompt!", "error"); return; }
    
    if (!window.currentUser) {
        showToast("Please Login with Google first to generate!", "error");
        openAuthModal();
        return;
    }

    genBtn.disabled = true;
    genBtn.innerHTML = 'Generating... <i class="ph ph-sparkle animate-pulse"></i>';
    updateStatus('ph-rocket-launch animate-spin', "Generating...");

    try {
        const isVideo = currentGenMode.includes('v');
        const type = isVideo ? 'video' : 'image';

        const resp = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: prompt, 
                aspectRatio: currentRatio, 
                type: type,
                userId: window.currentUser.uid
            })
        });

        const data = await resp.json();

        if (data.success) {
            const fullUrl = data.url;
            showToast("Generation Complete! ✨");
            updateStatus('ph-check-circle', 'Success!');
            showPreview(fullUrl, type, prompt);
            addToHistory(fullUrl, type, prompt);
            
            // Save to DB
            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await addDoc(collection(window.db, "generations"), {
                userId: window.currentUser.uid,
                prompt: prompt,
                url: fullUrl,
                type: type,
                timestamp: Date.now()
            });
        } else {
            showToast("AI Error: " + data.error, "error");
            updateStatus('ph-warning-circle', "API Error", true);
        }
    } catch (err) {
        console.error(err);
        showToast("Connection Error", "error");
        updateStatus('ph-warning-circle', "Make sure backend is running!", true);
    } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = 'Generate Now <i class="ph ph-sparkle"></i>';
    }
}

function switchGenMode(mode) {
    currentGenMode = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const isVideo = mode.includes('v');
    const genContainer = document.querySelector('.generate-container');
    const comingSoon = document.getElementById('coming-soon');

    if (isVideo) {
        genContainer.style.display = 'none';
        comingSoon.style.display = 'flex';
    } else {
        genContainer.style.display = 'grid'; 
        comingSoon.style.display = 'none';

        document.querySelectorAll('.gen-mode-inputs').forEach(inputs => inputs.style.display = 'none');
        document.getElementById(mode + '-inputs').style.display = 'block';
    }

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${mode}'`)) {
                btn.classList.add('active');
            }
        });
    }

    const squareBtn = document.getElementById('ratio-square');
    if (squareBtn) {
        if (isVideo) {
            squareBtn.style.display = 'none';
            if (currentRatio === '1:1') setRatio('16:9');
        } else {
            squareBtn.style.display = 'flex';
        }
    }
}

function showPreview(url, type, prompt) {
    document.getElementById('status-display').style.display = 'none';
    const previewBox = document.getElementById('preview-display-box');
    previewBox.style.display = 'block';
    const mediaContent = type === 'image' ? `<img src="${url}">` : `<video src="${url}" controls autoplay loop></video>`;
    
    const fileName = type === 'image' ? `ZLM-AI-${Date.now()}.jpg` : `ZLM-AI-${Date.now()}.mp4`;

    previewBox.innerHTML = `
        ${mediaContent}
        <div style="background: rgba(0,0,0,0.4); padding: 15px; border-radius: 12px; border: 1px solid var(--glass-border); text-align: left;">
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px;"><strong>PROMPT:</strong> ${prompt}</p>
            <div style="display: flex; gap: 15px;">
                <a href="${url}" download="${fileName}" class="btn-primary" style="padding: 8px 20px; font-size: 13px; animation: none;"><i class="ph ph-download-simple"></i> Download</a>
                <button class="join-btn" onclick="window.open('${url}')" style="padding: 8px 20px; font-size: 13px; margin-top:0;"><i class="ph ph-arrows-out"></i> Full View</button>
            </div>
        </div>
    `;
}

function addToHistory(url, type, prompt) {
    const list = document.querySelector('.history-list');
    const item = document.createElement('div');
    item.className = 'history-item';
    item.title = prompt;
    item.onclick = () => showPreview(url, type, prompt);
    item.innerHTML = type === 'image' ? `<img src="${url}" class="history-item-media" style="object-fit: cover;">` : `<video src="${url}" class="history-item-media" style="object-fit: cover;"></video>`;
    list.prepend(item);
}

function filterTools(category, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.tool-card').forEach(card => {
        const categories = card.dataset.category.split(' ');
        if (category === 'all' || categories.includes(category)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

function openPricing() { document.getElementById('pricing-overlay').style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closePricing() { document.getElementById('pricing-overlay').style.display = 'none'; document.body.style.overflow = 'auto'; }
function openAuthModal() { document.getElementById('auth-modal-overlay').style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closeAuthModal() { document.getElementById('auth-modal-overlay').style.display = 'none'; document.body.style.overflow = 'auto'; }

function copyPrompt(btn) {
    const codeBlock = btn.parentElement;
    const textToCopy = codeBlock.innerText.replace('Copy JSON', '').trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-check"></i> Copied!';
        btn.classList.add('copied');

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('copied');
        }, 2000);
    });
}

let chatHistory = [
    { role: "assistant", content: "Hello! I am ZLM, your AI companion. How can I help you today?" }
];

function toggleBotChat() {
    const embed = document.getElementById('botChatEmbed');
    const badge = document.getElementById('botBadge');
    const avatar = document.getElementById('botAvatar');

    embed.classList.toggle('active');

    if (embed.classList.contains('active')) {
        badge.style.opacity = '0';
        avatar.style.borderColor = 'var(--secondary)';
        avatar.style.boxShadow = '0 0 30px var(--secondary-glow)';
        document.getElementById('chatInput').focus();
    } else {
        badge.style.opacity = '1';
        avatar.style.borderColor = 'var(--primary)';
        avatar.style.boxShadow = '0 0 20px var(--primary-glow)';
    }
}

function handleChatEnter(e) { if (e.key === 'Enter') sendMessage(); }

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    const chatBody = document.getElementById('chatBody');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = text;
    chatBody.appendChild(userMsg);
    chatHistory.push({ role: "user", content: text });
    input.value = '';
    chatBody.scrollTop = chatBody.scrollHeight;

    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'chat-message bot';
    loadingMsg.innerHTML = '<i class="ph ph-circle-notch animate-spin"></i> Analyzing...';
    chatBody.appendChild(loadingMsg);

    try {
        const apiHistory = chatHistory.filter(msg => msg.content !== "Hello! I am ZLM, your AI companion. How can I help you today?");
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: apiHistory })
        });

        const data = await response.json();
        chatBody.removeChild(loadingMsg);

        if (response.ok && data.choices && data.choices[0]) {
            let botReply = data.choices[0].message.content;
            const redirectMatch = botReply.match(/\[REDIRECT:(\w+)\]/);
            if (redirectMatch) {
                const sectionId = redirectMatch[1];
                botReply = botReply.replace(/\[REDIRECT:\w+\]/g, '').trim();
                if (!botReply) botReply = `Navigating to ${sectionId.toUpperCase()}... 🚀`;
                setTimeout(() => { if (sectionId === 'pricing') openPricing(); else if (typeof showSection === 'function') showSection(sectionId); }, 500);
            }
            const botMsg = document.createElement('div');
            botMsg.className = 'chat-message bot';
            botMsg.textContent = botReply;
            chatBody.appendChild(botMsg);
            chatHistory.push({ role: "assistant", content: botReply });
        } else {
            throw new Error("Invalid response");
        }
    } catch (err) {
        if (chatBody.contains(loadingMsg)) chatBody.removeChild(loadingMsg);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'chat-message bot';
        errorMsg.innerHTML = `<i class="ph ph-warning-circle"></i> Connection failed.`;
        chatBody.appendChild(errorMsg);
    }
    chatBody.scrollTop = chatBody.scrollHeight;
}

window.loadUserHistory = async () => {
    if (!window.currentUser || !window.db) return;
    const list = document.querySelector('.history-list');
    list.innerHTML = '<p style="color:var(--text-muted); text-align:center; font-size:12px; padding: 20px;">Loading...</p>';
    try {
        const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const q = query(collection(window.db, "generations"), where("userId", "==", window.currentUser.uid));
        const querySnapshot = await getDocs(q);
        let myHistory = [];
        querySnapshot.forEach((doc) => myHistory.push(doc.data()));
        myHistory.sort((a, b) => b.timestamp - a.timestamp);
        list.innerHTML = '';
        if(myHistory.length === 0) list.innerHTML = '<p style="color:var(--text-muted); text-align:center; font-size:12px; padding: 20px;">No generations yet.</p>';
        myHistory.forEach(data => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.title = data.prompt;
            item.onclick = () => showPreview(data.url, data.type, data.prompt);
            item.innerHTML = data.type === 'image' ? `<img src="${data.url}" class="history-item-media" style="object-fit: cover;">` : `<video src="${data.url}" class="history-item-media" style="object-fit: cover;"></video>`;
            list.appendChild(item);
        });
    } catch (e) {
        console.error("Failed to load history", e);
    }
};
