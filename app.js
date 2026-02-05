/**
 * PARTENAIRE DE CODE - CRM INSTITUT ALSATIA
 * Version : 2.0 (Structure Professionnelle & Sécurité Admin)
 */

// --- CONFIGURATION SUPABASE ---
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];

// --- EXPOSITION DES FONCTIONS AU WINDOW (Indispensable pour onclick HTML) ---
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

    // Affichage des informations de session
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;

    // SECURITÉ : Seul l'Institut Alsatia gère la base Donateurs
    const navDonors = document.getElementById('nav-donors');
    if (currentUser.portal !== 'Institut Alsatia') {
        if (navDonors) navDonors.style.display = 'none';
        // Si l'utilisateur est sur l'onglet donateur (ex: via refresh), on redirige vers le salon
        if (document.getElementById('tab-donors').classList.contains('active')) {
            switchTab('chat');
        }
    }

    loadAllData();
}

async function loadAllData() {
    // Les donateurs et le dashboard ne sont chargés que pour l'Administrateur
    if (currentUser.portal === 'Institut Alsatia') {
        await loadDonors();
        await loadDashboard();
    }
    // Le chat est accessible à tous
    loadGlobalChat();
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

// --- LOGIQUE CRM (RÉSERVÉE INSTITUT) ---
async function loadDonors() {
    const { data, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });

    if (error) {
        console.error("Erreur chargement:", error);
        return;
    }
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
                <td><small>${d.entities || 'Alsatia'}</small></td>
                <td>${total.toLocaleString('fr-FR')} €</td>
                <td><span class="badge-status">${d.donor_type || 'Prospect'}</span></td>
                <td><button onclick="openDonorFile('${d.id}')" class="btn-primary">Gérer</button></td>
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
            <header class="fiche-header">
                <div>
                    <h2>${donor.last_name} ${donor.first_name || ''}</h2>
                    <p class="text-muted">Référence unique : ${donor.id}</p>
                </div>
                <div class="total-badge">${total.toLocaleString('fr-FR')} € cumulés</div>
            </header>

            <div class="grid-2">
                <div class="card-inner">
                    <h3>📍 Adresse & Contact</h3>
                    <div class="input-stack">
                        <label>Numéro et Rue</label>
                        <input type="text" id="edit-address" value="${donor.address || ''}" class="luxe-input">
                        <div style="display:flex; gap:10px;">
                            <div style="flex:1">
                                <label>Code Postal</label>
                                <input type="text" id="edit-zip" value="${donor.zip_code || ''}" class="luxe-input">
                            </div>
                            <div style="flex:2">
                                <label>Ville</label>
                                <input type="text" id="edit-city" value="${donor.city || ''}" class="luxe-input">
                            </div>
                        </div>
                        <label>Email</label>
                        <input type="email" id="edit-email" value="${donor.email || ''}" class="luxe-input">
                        <label>Téléphone</label>
                        <input type="text" id="edit-phone" value="${donor.phone || ''}" class="luxe-input">
                    </div>
                </div>

                <div class="card-inner">
                    <h3>🤝 Origine & Suivi</h3>
                    <div class="input-stack">
                        <label>Lien / Introduit par</label>
                        <input type="text" id="edit-next-action" value="${donor.next_action || ''}" class="luxe-input" placeholder="Ex: M. Pierre de Villiers">
                        
                        <label>Type de profil</label>
                        <select id="edit-donor-type" class="luxe-input">
                            <option value="Particulier" ${donor.donor_type === 'Particulier' ? 'selected' : ''}>Particulier</option>
                            <option value="Entreprise" ${donor.donor_type === 'Entreprise' ? 'selected' : ''}>Entreprise</option>
                            <option value="Fondation" ${donor.donor_type === 'Fondation' ? 'selected' : ''}>Fondation</option>
                            <option value="Grand Donateur" ${donor.donor_type === 'Grand Donateur' ? 'selected' : ''}>Grand Donateur</option>
                        </select>

                        <label>Dernière action (Notes)</label>
                        <textarea id="edit-last-mod" class="luxe-input" style="height:80px;">${donor.last_modified_by || ''}</textarea>
                    </div>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>📅 Historique des Événements & Participations</h3>
                <div class="event-timeline">
                    ${donor.messages?.filter(m => m.event).map(e => `
                        <div class="event-item">
                            <span class="event-date">${new Date(e.created_at).toLocaleDateString()}</span>
                            <strong>${e.event}</strong>
                        </div>
                    `).join('') || '<p class="text-muted">Aucune participation à un événement enregistrée.</p>'}
                </div>
                <button onclick="linkToEvent('${donor.id}')" class="btn-outline-gold" style="margin-top:10px;">+ Lier à un Événement</button>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>💶 Registre des Dons</h3>
                <table class="luxe-table">
                    <thead>
                        <tr><th>Date</th><th>Montant</th><th>Reçu Fiscal</th></tr>
                    </thead>
                    <tbody>
                        ${donor.donations?.map(don => `
                            <tr>
                                <td>${new Date(don.date).toLocaleDateString()}</td>
                                <td><strong>${don.amount} €</strong></td>
                                <td><code>${don.tax_receipt_id || 'En attente'}</code></td>
                            </tr>
                        `).join('') || '<tr><td colspan="3">Aucun don enregistré.</td></tr>'}
                    </tbody>
                </table>
                <button onclick="addDonation('${donor.id}')" class="btn-primary" style="margin-top:10px;">+ Nouveau Don</button>
            </div>

            <div class="modal-footer">
                <button onclick="saveDonorChanges('${donor.id}')" class="btn-save">💾 Enregistrer les modifications</button>
                <button onclick="deleteDonor('${donor.id}')" class="btn-danger-text">Supprimer la fiche</button>
            </div>
        </div>
    `;
}

// --- SAUVEGARDE & MODIFICATIONS ---
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
    if (error) {
        alert("Erreur lors de la mise à jour");
    } else {
        alert("Fiche donateur mise à jour avec succès");
        loadDonors();
        closeModal('donor-modal');
    }
}

async function addDonation(donorId) {
    const amt = prompt("Montant du don (€) :");
    if (!amt || isNaN(amt)) return;
    
    await supabaseClient.from('donations').insert([
        { 
            donor_id: donorId, 
            amount: parseFloat(amt), 
            date: new Date().toISOString().split('T')[0], 
            thank_you_status: 'À envoyer' 
        }
    ]);
    openDonorFile(donorId); // Rafraîchit la fiche
}

async function deleteDonor(id) {
    if (confirm("ATTENTION : Supprimer ce donateur supprimera également tout son historique de dons. Confirmer ?")) {
        await supabaseClient.from('donors').delete().eq('id', id);
        closeModal('donor-modal');
        loadDonors();
    }
}

// --- MESSAGERIE ET DASHBOARD ---
async function loadGlobalChat() {
    const { data } = await supabaseClient
        .from('messages')
        .select('*')
        .is('private', false)
        .order('created_at', { ascending: false })
        .limit(30);

    const chat = document.getElementById('global-chat-history');
    if (chat) {
        chat.innerHTML = data?.map(m => `
            <div class="chat-msg ${m.author_name.includes(currentUser.last_name) ? 'own' : ''}">
                <small>${m.author_name} - ${new Date(m.created_at).toLocaleTimeString()}</small>
                <p>${m.content}</p>
            </div>
        `).join('') || "Démarrez la conversation...";
    }
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

async function loadDashboard() {
    const { data } = await supabaseClient
        .from('donations')
        .select('*, donors(last_name)')
        .is('tax_receipt_id', null)
        .limit(5);

    const feed = document.getElementById('urgent-donations-feed');
    if (feed) {
        feed.innerHTML = data?.map(d => `
            <div class="donation-item">
                <span><strong>${d.donors?.last_name}</strong> : ${d.amount}€</span>
                <button onclick="openDonorFile('${d.donor_id}')" class="btn-sm">Traiter</button>
            </div>
        `).join('') || "Tous les reçus sont émis !";
    }
}

// --- MODALES ---
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    modal.style.display = 'block';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h3>Nouveau Dossier Donateur</h3>
            <div class="input-stack">
                <label>Nom ou Raison Sociale</label>
                <input type="text" id="n-lname" class="luxe-input">
                <label>Entités concernées (ex: Academia, Collège)</label>
                <input type="text" id="n-entities" class="luxe-input" value="Institut Alsatia">
                <button onclick="handleNewDonor()" class="btn-primary" style="width:100%; margin-top:20px;">Créer la fiche</button>
            </div>
        </div>
    `;
}

async function handleNewDonor() {
    const ln = document.getElementById('n-lname').value;
    const ent = document.getElementById('n-entities').value;
    if (!ln) return alert("Le nom est obligatoire");
    
    await supabaseClient.from('donors').insert([{ last_name: ln, entities: ent }]);
    closeModal('donor-modal');
    loadDonors();
}
