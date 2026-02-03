// 1. CONFIGURATION
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));

// 2. EXPOSITION GLOBALE (POUR LE HTML)
window.switchTab = switchTab;
window.openDonorFile = openDonorFile;
window.addDonation = addDonation;
window.sendDonorMessage = sendDonorMessage;
window.openNewDonorModal = openNewDonorModal;
window.handleNewDonor = handleNewDonor;
window.closeModal = closeModal;
window.logout = logout;
window.sendGlobalMessage = sendGlobalMessage;

// 3. FONCTIONS CŒUR
async function init() {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    loadAllData();
}

async function loadAllData() {
    await loadDonors();
    await loadDashboard();
    await loadEvents();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    if(tabId === 'chat') loadGlobalChat();
}

// 4. DONATEURS & DONS
async function loadDonors() {
    let query = supabaseClient.from('donors').select('*, donations(*)');
    if (currentUser.portal !== 'Institut Alsatia') {
        const key = currentUser.portal.split(' ')[1];
        query = query.ilike('entities', `%${key}%`);
    }
    const { data } = await query.order('last_name');
    if (data) renderDonors(data);
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    if (!list) return;
    list.innerHTML = data.map(d => {
        const total = d.donations ? d.donations.reduce((s, n) => s + Number(n.amount), 0) : 0;
        return `<tr><td>${d.last_name}</td><td>${d.entities}</td><td>${total}€</td><td>${d.next_action || ''}</td>
        <td><button onclick="openDonorFile('${d.id}')" class="btn-primary">Dossier</button></td></tr>`;
    }).join('');
}

async function openDonorFile(id) {
    const modal = document.getElementById('donor-modal');
    const content = document.getElementById('donor-detail-content');
    modal.style.display = 'block';
    content.innerHTML = "Chargement...";

    const { data: d } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', id).single();

    content.innerHTML = `
        <h2>${d.last_name} ${d.first_name || ''}</h2>
        <div class="grid-2" style="margin-top:20px;">
            <div>
                <h3>Nouveau Don</h3>
                <input type="number" id="new-don-amount" class="luxe-input" placeholder="Montant">
                <button onclick="addDonation('${d.id}')" class="btn-primary">Valider</button>
            </div>
            <div>
                <h3>Notes</h3>
                <div style="height:100px; overflow-y:auto; background:#f9f9f9; padding:5px; font-size:0.8rem;">
                    ${d.messages?.map(m => `<p><strong>${m.author_name}:</strong> ${m.content}</p>`).join('') || ''}
                </div>
                <input type="text" id="donor-chat-input" class="luxe-input" placeholder="Note...">
                <button onclick="sendDonorMessage('${d.id}')" class="btn-primary">Note</button>
            </div>
        </div>
    `;
}

async function addDonation(id) {
    const amt = document.getElementById('new-don-amount').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: amt }]);
    openDonorFile(id);
    loadAllData();
}

async function sendDonorMessage(id) {
    const msg = document.getElementById('donor-chat-input').value;
    if(!msg) return;
    await supabaseClient.from('messages').insert([{ donor_id: id, content: msg, author_name: currentUser.first_name }]);
    openDonorFile(id);
}

// 5. DASHBOARD & EVENTS
async function loadDashboard() {
    const { data } = await supabaseClient.from('donations').select('*, donors(last_name)').eq('thank_you_status', 'En attente');
    const feed = document.getElementById('urgent-donations-feed');
    if(feed) feed.innerHTML = data?.map(d => `<div class="donation-item">${d.donors?.last_name} : ${d.amount}€</div>`).join('') || "Rien.";
}

async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*');
    const cont = document.getElementById('events-container');
    if(cont) cont.innerHTML = data?.map(e => `<div class="card"><h4>${e.title}</h4></div>`).join('') || "Aucun.";
}

// 6. CHAT GLOBAL
async function sendGlobalMessage() {
    const input = document.getElementById('global-chat-input');
    await supabaseClient.from('messages').insert([{ content: input.value, author_name: currentUser.first_name, target_portal: 'Global' }]);
    input.value = '';
    loadGlobalChat();
}

async function loadGlobalChat() {
    const { data } = await supabaseClient.from('messages').select('*').eq('target_portal', 'Global').order('created_at');
    const hist = document.getElementById('global-chat-history');
    if(hist) hist.innerHTML = data.map(m => `<p><strong>${m.author_name}:</strong> ${m.content}</p>`).join('');
}

// 7. AUTRES
function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    const content = document.getElementById('donor-detail-content');
    modal.style.display = 'block';
    content.innerHTML = `<h3>Nouveau Donateur</h3>
    <input type="text" id="new-lname" placeholder="Nom" class="luxe-input">
    <input type="text" id="new-entities" placeholder="Entités" class="luxe-input" value="${currentUser.portal}">
    <button onclick="handleNewDonor()" class="btn-primary">Créer</button>`;
}

async function handleNewDonor() {
    const ln = document.getElementById('new-lname').value;
    const ent = document.getElementById('new-entities').value;
    await supabaseClient.from('donors').insert([{ last_name: ln, entities: ent }]);
    closeModal('donor-modal');
    loadDonors();
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.removeItem('alsatia_user'); window.location.href = 'login.html'; }

window.onload = init;
