// --- CONFIGURATION SUPABASE ---
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- VARIABLES GLOBALES ---
let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonors = [];
let currentTab = 'dashboard';

// --- 1. INITIALISATION & SÉCURITÉ ---
async function init() {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Affichage identité
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    if(document.getElementById('btn-my-portal')) {
        document.getElementById('btn-my-portal').innerText = `🔒 Salon ${currentUser.portal.split(' ')[0]}`;
    }

    await loadAllData();
}

async function loadAllData() {
    await loadDonors();
    await loadDashboard();
    await loadEvents();
    if(currentTab === 'chat') loadGlobalChat('Global');
}

// --- 2. GESTION DES ONGLETS ---
function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    
    if(tabId === 'chat') loadGlobalChat('Global');
}

// --- 3. GESTION DES DONATEURS & FILTRAGE ---
async function loadDonors() {
    let query = supabaseClient.from('donors').select('*, donations(*)');

    // FILTRE DE SÉCURITÉ : Les écoles ne voient que leurs donateurs
    if (currentUser.portal !== 'Institut Alsatia') {
        const schoolKeyword = currentUser.portal.split(' ')[1]; // Récupère "Herrade", "Martin" ou "Academia"
        query = query.ilike('entities', `%${schoolKeyword}%`);
    }

    const { data, error } = await query.order('last_name');
    if (!error) {
        allDonors = data;
        renderDonors(data);
    }
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations.reduce((sum, don) => sum + Number(don.amount), 0);
        return `
            <tr>
                <td><strong>${d.last_name}</strong> ${d.first_name || ''}</td>
                <td><small>${d.entities || ''}</small></td>
                <td>${total} €</td>
                <td><span class="status-tag ${d.next_action ? 'status-waiting' : ''}">${d.next_action || 'Aucune'}</span></td>
                <td><button onclick="openDonorFile('${d.id}')" class="btn-primary" style="font-size:0.7rem;">Ouvrir</button></td>
            </tr>
        `;
    }).join('');
}

// --- 4. MESSAGERIE (DOSSIER & SALON) ---
async function sendGlobalMessage() {
    const input = document.getElementById('global-chat-input');
    const portalTarget = document.querySelector('.btn-portal.active').innerText.includes('Général') ? 'Global' : currentUser.portal;
    
    if(!input.value) return;

    await supabaseClient.from('messages').insert([{
        content: input.value,
        author_id: currentUser.id,
        author_name: `${currentUser.first_name} ${currentUser.last_name}`,
        target_portal: portalTarget
    }]);

    input.value = '';
    loadGlobalChat(portalTarget === 'Global' ? 'Global' : 'Privé');
}

async function loadGlobalChat(type) {
    let query = supabaseClient.from('messages').select('*').is('donor_id', null);
    
    if(type === 'Global') {
        query = query.eq('target_portal', 'Global');
    } else {
        query = query.eq('target_portal', currentUser.portal);
    }

    const { data } = await query.order('created_at', { ascending: true });
    const chatBox = document.getElementById('global-chat-history');
    
    chatBox.innerHTML = data.map(m => `
        <div class="chat-bubble ${m.author_id === currentUser.id ? 'my-msg' : ''}">
            <div class="chat-meta">${m.author_name} • ${new Date(m.created_at).toLocaleTimeString()}</div>
            <div>${m.content}</div>
        </div>
    `).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- 5. AGENDA & DOCUMENTS (STORAGE) ---
async function handleEventSubmit(e) {
    e.preventDefault();
    const files = document.getElementById('ev-files').files;
    let urls = [];

    // Upload fichiers
    for (let file of files) {
        const path = `events/${Date.now()}_${file.name}`;
        const { data, error } = await supabaseClient.storage.from('event-files').upload(path, file);
        if(!error) {
            const { data: urlData } = supabaseClient.storage.from('event-files').getPublicUrl(path);
            urls.push(urlData.publicUrl);
        }
    }

    await supabaseClient.from('events').insert([{
        title: document.getElementById('ev-title').value,
        event_date: document.getElementById('ev-date').value,
        description: document.getElementById('ev-desc').value,
        portal: currentUser.portal,
        created_by: `${currentUser.first_name} ${currentUser.last_name}`,
        attachments: urls
    }]);

    closeModal('event-modal');
    loadEvents();
    showToast("Événement publié !");
}

async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('event_date', { ascending: true });
    const container = document.getElementById('events-container');
    
    container.innerHTML = data.map(ev => `
        <div class="card event-card">
            <div class="chat-meta" style="color:var(--gold)">${new Date(ev.event_date).toLocaleDateString()} - ${ev.portal}</div>
            <h4>${ev.title}</h4>
            <p style="font-size:0.8rem;">${ev.description}</p>
            <div class="event-media">
                ${ev.attachments?.map(url => `<small onclick="window.open('${url}')" style="cursor:pointer; color:blue; display:block;">📄 Document joint</small>`).join('')}
            </div>
        </div>
    `).join('');
}

// --- 6. UTILITAIRES ---
function showToast(msg) {
    const t = document.getElementById('toast-notification');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function logout() {
    localStorage.removeItem('alsatia_user');
    window.location.href = 'login.html';
}

function openEventModal() { document.getElementById('event-modal').style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Démarrage
window.onload = init;
