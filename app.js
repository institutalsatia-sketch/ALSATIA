// --- CONFIGURATION SUPABASE ---
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];

// --- EXPOSITION DES FONCTIONS AU WINDOW (Indispensable pour le HTML) ---
window.switchTab = switchTab;
window.openDonorFile = openDonorFile;
window.addDonation = addDonation;
window.saveDonorChanges = saveDonorChanges;
window.deleteDonor = deleteDonor;
window.openNewDonorModal = openNewDonorModal;
window.handleNewDonor = handleNewDonor;
window.closeModal = closeModal;
window.sendGlobalMessage = sendGlobalMessage;
window.sendDonorNote = sendDonorNote;
window.updateTaxReceipt = updateTaxReceipt;
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (!currentUser) { 
        window.location.href = 'login.html'; 
        return; 
    }

    // Affichage interface utilisateur
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;

    // SECURITE : Restriction d'accès au CRM (Seul Institut Alsatia gère les donateurs)
    if (currentUser.portal !== 'Institut Alsatia') {
        const navDonors = document.getElementById('nav-donors');
        if (navDonors) navDonors.style.display = 'none';
    }

    loadAllData();
}

async function loadAllData() {
    if (currentUser.portal === 'Institut Alsatia') {
        await loadDonors();
        await loadDashboard();
    }
    if (document.getElementById('tab-chat').classList.contains('active')) {
        loadGlobalChat();
    }
}

// --- NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');

    if (tabId === 'chat') loadGlobalChat();
    if (tabId === 'donors' && currentUser.portal === 'Institut Alsatia') loadDonors();
}

// --- GESTION DES DONATEURS (CRM) ---
async function loadDonors() {
    const { data, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });

    if (error) console.error("Erreur:", error);
    allDonorsData = data || [];
    renderDonors(allDonorsData);
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        return `
            <tr>
                <td><strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}</td>
                <td><small>${d.entities || 'N/A'}</small></td>
                <td>${total} €</td>
                <td><span class="badge-status">${d.donor_type || 'Actif'}</span></td>
                <td><button onclick="openDonorFile('${d.id}')" class="btn-primary">Ouvrir</button></td>
            </tr>
        `;
    }).join('');
}

// --- FICHE DONATEUR COMPLETE (NON-SIMPLIFIÉE) ---
async function openDonorFile(donorId) {
    const { data: donor, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*), messages(*)')
        .eq('id', donorId)
        .single();

    if (error) return;

    const modal = document.getElementById('donor-modal');
    const container = document.getElementById('donor-detail-content');
    modal.style.display = 'block';

    const total = donor.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;

    container.innerHTML = `
        <div class="pro-fiche">
            <div class="fiche-header">
                <h2>${donor.last_name} ${donor.first_name || ''}</h2>
                <p>ID: <small>${donor.id}</small></p>
            </div>

            <div class="grid-2">
                <div class="card-inner">
                    <h3>📍 Coordonnées</h3>
                    <label>Adresse (Rue et N°)</label>
                    <input type="text" id="edit-address" value="${donor.address || ''}" class="luxe-input">
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="edit-zip" placeholder="CP" value="${donor.zip_code || ''}" class="luxe-input" style="width:80px;">
                        <input type="text" id="edit-city" placeholder="Ville" value="${donor.city || ''}" class="luxe-input">
                    </div>
                    <label>Email</label>
                    <input type="email" id="edit-email" value="${donor.email || ''}" class="luxe-input">
                    <label>Téléphone</label>
                    <input type="text" id="edit-phone" value="${donor.phone || ''}" class="luxe-input">
                </div>

                <div class="card-inner">
                    <h3>🤝 Suivi & Origine</h3>
                    <label>Lien / Introduit par</label>
                    <input type="text" id="edit-next-action" value="${donor.next_action || ''}" class="luxe-input" placeholder="Qui l'a introduit ?">
                    
                    <label>Statut actuel</label>
                    <select id="edit-donor-type" class="luxe-input">
                        <option value="Donateur" ${donor.donor_type === 'Donateur' ? 'selected' : ''}>Donateur</option>
                        <option value="Entreprise" ${donor.donor_type === 'Entreprise' ? 'selected' : ''}>Entreprise</option>
                        <option value="Prospect" ${donor.donor_type === 'Prospect' ? 'selected' : ''}>Prospect</option>
                        <option value="Grand Donateur" ${donor.donor_type === 'Grand Donateur' ? 'selected' : ''}>Grand Donateur</option>
                    </select>

                    <label>Dernière action réalisée</label>
                    <input type="text" id="edit-last-mod" value="${donor.last_modified_by || ''}" class="luxe-input">
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>📅 Historique des Événements</h3>
                <div class="event-timeline">
                    ${donor.messages?.filter(m => m.event).map(e => `
                        <div class="event-item"><strong>${e.event}</strong> (${new Date(e.created_at).toLocaleDateString()})</div>
                    `).join('') || 'Aucun événement enregistré.'}
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>💶 Dons (${total} €)</h3>
                <div id="donations-area">
                    ${donor.donations?.map(don => `
                        <div class="donation-line">
                            ${new Date(don.date).toLocaleDateString()} - <strong>${don.amount}€</strong> 
                            [Reçu: ${don.tax_receipt_id || 'Non émis'}]
                        </div>
                    `).join('')}
                </div>
                <button onclick="addDonation('${donor.id}')" class="btn-primary" style="margin-top:10px;">+ Enregistrer un don</button>
            </div>

            <div class="modal-footer">
                <button onclick="saveDonorChanges('${donor.id}')" class="btn-save">Enregistrer les modifications</button>
                <button onclick="deleteDonor('${donor.id}')" class="btn-danger-text">Supprimer la fiche</button>
            </div>
        </div>
    `;
}

// --- ACTIONS BDD ---
async function saveDonorChanges(id) {
    const updates = {
        address: document.getElementById('edit-address').value,
        zip_code: document.getElementById('edit-zip').value,
        city: document.getElementById('edit-city').value,
        email: document.getElementById('edit-email').value,
        phone: document.getElementById('edit-phone').value,
        next_action: document.getElementById('edit-next-action').value,
        donor_type: document.getElementById('edit-donor-type').value,
        last_modified_by: document.getElementById('edit-last-mod').value
    };

    const { error } = await supabaseClient.from('donors').update(updates).eq('id', id);
    if (error) alert("Erreur lors de la sauvegarde");
    else {
        alert("Fiche mise à jour");
        loadDonors();
        closeModal('donor-modal');
    }
}

async function addDonation(donorId) {
    const amt = prompt("Montant du don (€) :");
    if (!amt) return;
    
    await supabaseClient.from('donations').insert([
        { donor_id: donorId, amount: parseFloat(amt), date: new Date().toISOString().split('T')[0], thank_you_status: 'À envoyer' }
    ]);
    openDonorFile(donorId);
    loadDashboard();
}

async function deleteDonor(id) {
    if (confirm("Supprimer définitivement ce donateur ? Cette action est irréversible.")) {
        await supabaseClient.from('donors').delete().eq('id', id);
        closeModal('donor-modal');
        loadDonors();
    }
}

// --- DASHBOARD & MESSAGERIE ---
async function loadDashboard() {
    const { data } = await supabaseClient.from('donations').select('*, donors(last_name)').is('tax_receipt_id', null).limit(5);
    const feed = document.getElementById('urgent-donations-feed');
    if (feed) feed.innerHTML = data?.map(d => `<div class="donation-item">${d.donors?.last_name} : ${d.amount}€ <button onclick="openDonorFile('${d.donor_id}')">Détails</button></div>`).join('') || "R.A.S";
}

async function loadGlobalChat() {
    const { data } = await supabaseClient.from('messages').select('*').is('private', false).order('created_at', { ascending: false }).limit(20);
    const chat = document.getElementById('global-chat-history');
    if (chat) chat.innerHTML = data?.map(m => `<div><strong>${m.author_name} :</strong> ${m.content}</div>`).join('') || "Aucun message.";
}

async function sendGlobalMessage() {
    const input = document.getElementById('global-chat-input');
    if (!input.value) return;
    await supabaseClient.from('messages').insert([{
        content: input.value,
        author_name: `${currentUser.first_name} ${currentUser.last_name}`,
        private: false,
        target_portal: currentUser.portal
    }]);
    input.value = '';
    loadGlobalChat();
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    modal.style.display = 'block';
    document.getElementById('donor-detail-content').innerHTML = `
        <h3>Nouveau Donateur</h3>
        <input type="text" id="n-lname" placeholder="Nom / Raison Sociale" class="luxe-input">
        <input type="text" id="n-entities" placeholder="Entités (ex: Academia, Herrade)" class="luxe-input">
        <button onclick="handleNewDonor()" class="btn-primary" style="width:100%; margin-top:10px;">Créer le dossier</button>
    `;
}

async function handleNewDonor() {
    const ln = document.getElementById('n-lname').value;
    const ent = document.getElementById('n-entities').value;
    if (!ln) return alert("Nom obligatoire");
    await supabaseClient.from('donors').insert([{ last_name: ln, entities: ent }]);
    closeModal('donor-modal');
    loadDonors();
}
