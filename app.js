/**
 * CRM INSTITUT ALSATIA - MASTER VERSION FINALISÉE
 */

const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];

const ENTITIES = [
    "Institut Alsatia", 
    "Cours Herrade de Landsberg", 
    "Collège Saints Louis et Zélie Martin", 
    "Academia Alsatia"
];
const PAYMENT_METHODS = ["Virement", "Chèque", "Espèces", "Carte Bancaire", "Prélèvement"];

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    loadDonors();
});

// --- NAVIGATION & UI ---
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
};
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
window.closeConfirm = () => document.getElementById('confirm-modal').style.display = 'none';
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

function showNotify(msg, type = 'success') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
}

function customConfirm(message, onConfirm) {
    document.getElementById('confirm-msg').innerText = message;
    document.getElementById('confirm-modal').style.display = 'flex';
    document.getElementById('confirm-yes').onclick = () => { onConfirm(); window.closeConfirm(); };
}

// --- LOGIQUE DONATEURS ---
async function loadDonors() {
    const { data, error } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    if (error) return showNotify("Erreur de synchronisation", "error");
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    if(!list) return;
    list.innerHTML = data.map(d => {
        // Sécurité sur le calcul du total
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0);
        return `
        <tr>
            <td><strong>${(d.last_name || '').toUpperCase()}</strong> ${d.first_name || ''}</td>
            <td><span class="badge-entity">${d.entities || 'Alsatia'}</span></td>
            <td class="gold-text">${total} €</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Ouvrir Dossier</button></td>
        </tr>`;
    }).join('');
}

window.filterDonors = () => {
    const val = document.getElementById('search-donor').value.toLowerCase();
    const filtered = allDonorsData.filter(d => 
        (d.last_name || "").toLowerCase().includes(val) || 
        (d.first_name || "").toLowerCase().includes(val)
    );
    renderDonorsTable(filtered);
};

// --- CRÉATION NOUVEAU DONATEUR ---
window.openNewDonorModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header">
                <h2 class="gold-title">⚜️ Nouveau Donateur</h2>
                <button onclick="closeModal('donor-modal')" class="btn-icon">✖</button>
            </header>
            <div class="grid-2">
                <div><label>Nom (Obligatoire)</label><input type="text" id="n-lname" class="luxe-input"></div>
                <div><label>Prénom</label><input type="text" id="n-fname" class="luxe-input"></div>
                <div class="full-width">
                    <label>Entité de rattachement</label>
                    <select id="n-ent" class="luxe-input">
                        ${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}
                    </select>
                </div>
            </div>
            <button onclick="handleNewDonor()" class="btn-save" style="width:100%; margin-top:20px;">Créer la fiche</button>
        </div>
    `;
};

window.handleNewDonor = async () => {
    const ln = document.getElementById('n-lname').value.trim();
    if(!ln) { showNotify("Le nom est obligatoire", "error"); return; }

    const { data, error } = await supabaseClient.from('donors').insert([{
        last_name: ln,
        first_name: document.getElementById('n-fname').value,
        entities: document.getElementById('n-ent').value,
        last_modified_by: currentUser ? currentUser.last_name : "Admin"
    }]).select(); // On demande le retour des données pour vérifier

    if(error) {
        console.error("Erreur Supabase:", error);
        showNotify("Erreur : " + error.message, "error");
    } else {
        console.log("Donateur créé avec succès:", data);
        showNotify("Donateur créé !");
        closeModal('donor-modal');
        
        // Attendre un court instant que la BDD respire et recharger
        setTimeout(() => {
            loadDonors(); 
        }, 500);
    }
};

// --- FICHE DÉTAILLÉE ---
window.openDonorFile = async (donorId) => {
    const { data: donor } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', donorId).single();
    document.getElementById('donor-modal').style.display = 'flex';
    const donations = donor.donations || [];
    const notes = donor.messages || [];

    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header">
                <div>
                    <h2>${donor.last_name.toUpperCase()} ${donor.first_name || ''}</h2>
                    <span class="signature-tag">👤 Modifié par : ${donor.last_modified_by || 'Système'}</span>
                </div>
                <button onclick="closeModal('donor-modal')" class="btn-icon">✖</button>
            </header>

            <div class="grid-2">
                <div class="card-inner">
                    <h3>📍 Coordonnées</h3>
                    <label>Email</label><input type="email" id="e-mail" value="${donor.email || ''}" class="luxe-input">
                    <label>Adresse</label><input type="text" id="e-addr" value="${donor.address || ''}" class="luxe-input">
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="e-zip" placeholder="CP" value="${donor.zip_code || ''}" class="luxe-input" style="width:80px;">
                        <input type="text" id="e-city" placeholder="Ville" value="${donor.city || ''}" class="luxe-input">
                    </div>
                </div>
                <div class="card-inner">
                    <h3>🤝 Profil</h3>
                    <label>Entité Principale</label>
                    <select id="e-ent" class="luxe-input">
                        ${ENTITIES.map(e => `<option value="${e}" ${donor.entities === e ? 'selected' : ''}>${e}</option>`).join('')}
                    </select>
                    <label>Lien / Origine</label><input type="text" id="e-link" value="${donor.next_action || ''}" class="luxe-input">
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px; border: 2px solid var(--gold);">
                <h3 style="color: var(--gold);">💰 Enregistrer un nouveau Don</h3>
                <div class="donation-form-grid" style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; background:#fcfaf5; padding:15px; border-radius:8px;">
                    <div><label>Montant (€)</label><input type="number" id="new-amount" class="luxe-input" placeholder="0.00"></div>
                    <div><label>Date</label><input type="date" id="new-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input"></div>
                    <div><label>Moyen</label>
                        <select id="new-method" class="luxe-input">
                            ${PAYMENT_METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}
                        </select>
                    </div>
                    <div style="grid-column: span 2;"><label>Destination (Entité Alsatia)</label>
                        <select id="new-dest" class="luxe-input">
                            ${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; padding-top:20px;">
                        <input type="checkbox" id="new-thanks"> <label>Remercié ?</label>
                    </div>
                    <button onclick="submitDonation('${donor.id}')" class="btn-save" style="grid-column: span 3; background: var(--gold);">✅ Valider le don</button>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>📜 Historique des Dons</h3>
                <div class="table-scroll" style="max-height:150px; overflow-y:auto;">
                    <table class="luxe-table" style="width:100%;">
                        <thead><tr><th>Date</th><th>Montant</th><th>Destination</th><th>Reçu</th><th>Action</th></tr></thead>
                        <tbody>
                            ${donations.map(d => `
                                <tr>
                                    <td>${d.date}</td>
                                    <td><strong>${d.amount} €</strong></td>
                                    <td><small>${d.destination || '-'}</small></td>
                                    <td><input type="text" value="${d.tax_receipt_id || ''}" onchange="updateReceipt('${d.id}', this.value)" class="table-input" style="width:60px;"></td>
                                    <td><button onclick="deleteDonation('${d.id}', '${donor.id}')" class="btn-icon">🗑️</button></td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>💬 Notes de suivi</h3>
                <div class="notes-list" style="max-height:100px; overflow-y:auto; background:#f8fafc; padding:10px; border-radius:8px;">
                    ${notes.map(n => `<div class="note-row"><strong>${n.author_name}</strong>: ${n.content} <button onclick="deleteNote('${n.id}', '${donor.id}')" class="btn-icon" style="float:right;">🗑️</button></div>`).join('')}
                </div>
                <div style="display:flex; gap:5px; margin-top:10px;"><input type="text" id="n-txt" class="luxe-input" placeholder="Ajouter une note..."><button onclick="addNote('${donor.id}')" class="btn-save">OK</button></div>
            </div>

            <div style="margin-top:30px; display:flex; gap:10px;">
                <button onclick="saveDonorChanges('${donor.id}')" class="btn-save" style="flex:2;">💾 Sauvegarder Profil</button>
                <button onclick="deleteFullDonor('${donor.id}')" class="btn-danger-action" style="flex:1;">Supprimer Fiche</button>
            </div>
        </div>
    `;
};

// --- CRUD ---
window.submitDonation = async (donorId) => {
    const amount = document.getElementById('new-amount').value;
    if(!amount || amount <= 0) return showNotify("Indiquez un montant", "error");
    
    await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: amount,
        date: document.getElementById('new-date').value,
        payment_method: document.getElementById('new-method').value,
        destination: document.getElementById('new-dest').value,
        thanked: document.getElementById('new-thanks').checked
    }]);
    
    showNotify("Don enregistré"); openDonorFile(donorId); loadDonors();
};

window.updateReceipt = async (id, val) => {
    await supabaseClient.from('donations').update({ tax_receipt_id: val }).eq('id', id);
    showNotify("N° Reçu mis à jour");
};

window.addNote = async (id) => {
    const val = document.getElementById('n-txt').value.trim();
    if(!val) return;
    await supabaseClient.from('messages').insert([{ donor_id: id, content: val, author_name: currentUser.first_name }]);
    openDonorFile(id);
};

window.saveDonorChanges = async (id) => {
    const up = {
        email: document.getElementById('e-mail').value,
        address: document.getElementById('e-addr').value,
        zip_code: document.getElementById('e-zip').value,
        city: document.getElementById('e-city').value,
        entities: document.getElementById('e-ent').value,
        next_action: document.getElementById('e-link').value,
        last_modified_by: currentUser.last_name
    };
    await supabaseClient.from('donors').update(up).eq('id', id);
    showNotify("Fiche sauvegardée"); loadDonors(); closeModal('donor-modal');
};

window.deleteNote = (nId, dId) => customConfirm("Supprimer cette note ?", async () => { await supabaseClient.from('messages').delete().eq('id', nId); openDonorFile(dId); });
window.deleteDonation = (donId, dId) => customConfirm("Supprimer ce don ?", async () => { await supabaseClient.from('donations').delete().eq('id', donId); openDonorFile(dId); loadDonors(); });
window.deleteFullDonor = (id) => customConfirm("SUPPRIMER DÉFINITIVEMENT ?", async () => { 
    await supabaseClient.from('donations').delete().eq('donor_id', id);
    await supabaseClient.from('messages').delete().eq('donor_id', id);
    await supabaseClient.from('donors').delete().eq('id', id);
    showNotify("Donneur supprimé"); closeModal('donor-modal'); loadDonors();
});

window.exportGlobalExcel = () => {
    const rows = [["Nom", "Prénom", "Email", "Ville", "Entité", "Total Dons"]];
    allDonorsData.forEach(d => {
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount), 0);
        rows.push([d.last_name, d.first_name, d.email, d.city, d.entities, total]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donateurs");
    XLSX.writeFile(wb, `Export_Alsatia_${new Date().toLocaleDateString()}.xlsx`);
};
