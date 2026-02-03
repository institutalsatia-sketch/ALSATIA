// --- CONFIGURATION SUPABASE ---
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- VARIABLES GLOBALES ---
let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonors = [];
let currentTab = 'dashboard';

// --- 1. INITIALISATION ---
async function init() {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    
    await loadAllData();
}

async function loadAllData() {
    await loadDonors();
    await loadDashboard();
    await loadEvents();
}

// --- 2. NAVIGATION ---
function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    
    if(tabId === 'chat') loadGlobalChat('Global');
    if(tabId === 'dashboard') loadDashboard();
}

// --- 3. DASHBOARD (Correction erreur loadDashboard is not defined) ---
async function loadDashboard() {
    const feedDons = document.getElementById('urgent-donations-feed');
    if (!feedDons) return;

    // Récupérer les dons en attente
    const { data, error } = await supabaseClient
        .from('donations')
        .select('*, donors(last_name)')
        .eq('thank_you_status', 'En attente')
        .limit(5);

    if (error) {
        feedDons.innerHTML = "Erreur de chargement.";
        return;
    }

    feedDons.innerHTML = data.length > 0 ? data.map(d => `
        <div class="donation-item">
            <strong>${d.donors?.last_name || 'Inconnu'}</strong> : ${d.amount} €
            <button onclick="openDonorFile('${d.donor_id}')" class="btn-primary" style="font-size:0.6rem; float:right;">Voir</button>
        </div>
    `).join('') : "Aucun don en attente de remerciement.";
}

// --- 4. GESTION DES DONATEURS ---
async function loadDonors() {
    let query = supabaseClient.from('donors').select('*, donations(*)');

    if (currentUser.portal !== 'Institut Alsatia') {
        const schoolKeyword = currentUser.portal.split(' ')[1];
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
    if(!list) return;
    list.innerHTML = data.map(d => {
        const total = d.donations ? d.donations.reduce((sum, don) => sum + Number(don.amount), 0) : 0;
        return `
            <tr>
                <td><strong>${d.last_name}</strong> ${d.first_name || ''}</td>
                <td><small>${d.entities || ''}</small></td>
                <td>${total} €</td>
                <td><span class="status-tag">${d.next_action || 'Aucune'}</span></td>
                <td><button onclick="openDonorFile('${d.id}')" class="btn-primary" style="font-size:0.7rem;">Ouvrir</button></td>
            </tr>
        `;
    }).join('');
}

// --- 5. MODALES (Correction erreur openNewDonorModal) ---
function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    const content = document.getElementById('donor-detail-content');
    modal.style.display = 'block';
    content.innerHTML = `
        <h3>Nouveau Donateur</h3>
        <form onsubmit="handleNewDonor(event)">
            <label>Type</label>
            <select id="new-type" class="luxe-input"><option>Particulier</option><option>Entreprise</option></select>
            <input type="text" id="new-lname" placeholder="Nom / Raison Sociale" class="luxe-input" required>
            <input type="text" id="new-fname" placeholder="Prénom" class="luxe-input">
            <input type="text" id="new-entities" placeholder="Entités (ex: Herrade, Institut)" class="luxe-input" value="${currentUser.portal}">
            <button type="submit" class="btn-primary" style="width:100%">Créer le dossier</button>
        </form>
    `;
}

async function handleNewDonor(e) {
    e.preventDefault();
    const newDonor = {
        donor_type: document.getElementById('new-type').value,
        last_name: document.getElementById('new-lname').value,
        first_name: document.getElementById('new-fname').value,
        entities: document.getElementById('new-entities').value,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };

    const { error } = await supabaseClient.from('donors').insert([newDonor]);
    if (!error) {
        closeModal('donor-modal');
        loadDonors();
        showToast("Donateur créé avec succès");
    }
}

// --- 6. SALON DE CHAT (Correction erreur 400 et map null) ---
async function loadGlobalChat(type) {
    const chatBox = document.getElementById('global-chat-history');
    if (!chatBox) return;

    let query = supabaseClient.from('messages').select('*').is('donor_id', null);
    
    if(type === 'Global') {
        query = query.eq('target_portal', 'Global');
    } else {
        query = query.eq('target_portal', currentUser.portal);
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    
    if (error || !data) {
        chatBox.innerHTML = "Aucun message.";
        return;
    }

    chatBox.innerHTML = data.map(m => `
        <div class="chat-bubble ${m.author_id === currentUser.id ? 'my-msg' : ''}">
            <div class="chat-meta">${m.author_name} • ${new Date(m.created_at).toLocaleTimeString()}</div>
            <div>${m.content}</div>
        </div>
    `).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- 7. AGENDA & EVENTS ---
async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('event_date', { ascending: true });
    const container = document.getElementById('events-container');
    if(!container) return;
    
    container.innerHTML = data ? data.map(ev => `
        <div class="card">
            <small style="color:var(--gold)">${new Date(ev.event_date).toLocaleDateString()}</small>
            <h4>${ev.title}</h4>
            <p>${ev.description || ''}</p>
        </div>
    `).join('') : "Aucun événement prévu.";
}

// --- UTILITAIRES ---
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showToast(msg) {
    const t = document.getElementById('toast-notification');
    t.innerText = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
function logout() { localStorage.removeItem('alsatia_user'); window.location.href = 'login.html'; }

window.onload = init;
