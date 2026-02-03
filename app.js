// --- CONFIGURATION ---
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonors = [];

// --- FONCTIONS DE CHARGEMENT ---

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

async function loadDashboard() {
    const feed = document.getElementById('urgent-donations-feed');
    if (!feed) return;

    const { data, error } = await supabaseClient
        .from('donations')
        .select('*, donors(last_name)')
        .eq('thank_you_status', 'En attente')
        .limit(5);

    if (error) {
        feed.innerHTML = "Erreur de chargement.";
        return;
    }

    feed.innerHTML = data.length > 0 ? data.map(d => `
        <div class="donation-item" style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <span><strong>${d.donors?.last_name || 'Inconnu'}</strong> : ${d.amount} €</span>
            <button onclick="openDonorFile('${d.donor_id}')" class="btn-primary" style="padding:4px 8px; font-size:0.7rem;">Gérer</button>
        </div>
    `).join('') : "Aucun remerciement en attente.";
}

async function loadDonors() {
    let query = supabaseClient.from('donors').select('*, donations(*)');

    // Filtrage par portail (sauf si Institut Alsatia)
    if (currentUser.portal !== 'Institut Alsatia') {
        const keyword = currentUser.portal.split(' ')[1];
        query = query.ilike('entities', `%${keyword}%`);
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
                <td><span class="status-tag">${d.next_action || 'N/A'}</span></td>
                <td><button onclick="openDonorFile('${d.id}')" class="btn-primary" style="font-size:0.7rem;">Dossier</button></td>
            </tr>
        `;
    }).join('');
}

// --- GESTION DES DOSSIERS ---

async function openDonorFile(donorId) {
    const modal = document.getElementById('donor-modal');
    const content = document.getElementById('donor-detail-content');
    modal.style.display = 'block';
    content.innerHTML = "<div class='loader'>Chargement du dossier...</div>";

    const { data: donor, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*), messages(*)')
        .eq('id', donorId)
        .single();

    if (error) {
        content.innerHTML = "Erreur fatale : dossier introuvable.";
        return;
    }

    const totalDons = donor.donations ? donor.donations.reduce((sum, d) => sum + Number(d.amount), 0) : 0;

    content.innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px; margin-bottom:20px;">
            <h2>${donor.last_name} ${donor.first_name || ''}</h2>
            <h2 style="color:var(--primary)">${totalDons} €</h2>
        </div>
        <div class="grid-2">
            <div>
                <h3>Enregistrer un don</h3>
                <div class="card" style="display:flex; gap:5px;">
                    <input type="number" id="new-don-amount" placeholder="Montant" class="luxe-input">
                    <button onclick="addDonation('${donor.id}')" class="btn-primary">OK</button>
                </div>
                <h3>Historique</h3>
                ${donor.donations.map(don => `
                    <div style="font-size:0.8rem; margin-bottom:5px;">${new Date(don.date).toLocaleDateString()} - ${don.amount} € - ${don.thank_you_status}</div>
                `).join('')}
            </div>
            <div>
                <h3>Notes Internes</h3>
                <div id="donor-chat-history" style="height:150px; overflow-y:auto; background:#f1f5f9; padding:10px; border-radius:8px;">
                    ${donor.messages.map(m => `<p style="font-size:0.8rem;"><strong>${m.author_name}:</strong> ${m.content}</p>`).join('')}
                </div>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <input type="text" id="donor-chat-input" placeholder="Note..." class="luxe-input">
                    <button onclick="sendDonorMessage('${donor.id}')" class="btn-primary">Note</button>
                </div>
            </div>
        </div>
    `;
}

async function addDonation(donorId) {
    const amount = document.getElementById('new-don-amount').value;
    if(!amount) return;
    const { error } = await supabaseClient.from('donations').insert([{ donor_id: donorId, amount: amount }]);
    if(!error) { showToast("Don ajouté"); openDonorFile(donorId); loadAllData(); }
}

async function sendDonorMessage(donorId) {
    const val = document.getElementById('donor-chat-input').value;
    if(!val) return;
    const { error } = await supabaseClient.from('messages').insert([{
        donor_id: donorId, content: val, author_name: currentUser.first_name, target_portal: currentUser.portal
    }]);
    if(!error) openDonorFile(donorId);
}

// --- MODALES ET NAVIGATION ---

function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    const content = document.getElementById('donor-detail-content');
    modal.style.display = 'block';
    content.innerHTML = `
        <h3>Nouveau Donateur</h3>
        <input type="text" id="new-lname" placeholder="Nom" class="luxe-input">
        <input type="text" id="new-fname" placeholder="Prénom" class="luxe-input">
        <input type="text" id="new-entities" placeholder="Entités" class="luxe-input" value="${currentUser.portal}">
        <button onclick="handleNewDonor()" class="btn-primary" style="width:100%">Créer</button>
    `;
}

async function handleNewDonor() {
    const obj = {
        last_name: document.getElementById('new-lname').value,
        first_name: document.getElementById('new-fname').value,
        entities: document.getElementById('new-entities').value,
        last_modified_by: currentUser.first_name
    };
    const { error } = await supabaseClient.from('donors').insert([obj]);
    if(!error) { closeModal('donor-modal'); loadDonors(); showToast("Donateur créé"); }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    if(tabId === 'chat') loadGlobalChat('Global');
}

// --- UTILITAIRES ---
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showToast(msg) {
    const t = document.getElementById('toast-notification');
    t.innerText = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('event_date');
    const cont = document.getElementById('events-container');
    if(cont) cont.innerHTML = data.map(e => `<div class="card"><h4>${e.title}</h4><p>${e.event_date}</p></div>`).join('');
}

// --- EXPOSITION GLOBALE (CORRECTION REFERENCE ERROR) ---
window.openDonorFile = openDonorFile;
window.openNewDonorModal = openNewDonorModal;
window.handleNewDonor = handleNewDonor;
window.addDonation = addDonation;
window.sendDonorMessage = sendDonorMessage;
window.switchTab = switchTab;
window.closeModal = closeModal;
window.onload = init;
