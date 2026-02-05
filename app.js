/**
 * CRM INSTITUT ALSATIA - V8.0
 * Système Complet : Profils, Notes, Dons avancés (Destinations = Entités), Reçus fiscaux & Exports.
 */

const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];

// Configuration des listes
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
    list.innerHTML = data.map(d => {
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount), 0);
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

// --- GESTION FICHE DÉTAILLÉE ---
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
                    <span class="signature-tag">Modifié par : ${donor.last_modified_by || 'Système'}</span>
                </div>
                <button onclick="closeModal('donor-modal')" class="btn-icon">✖</button>
            </header>

            <div class="grid-2">
                <div class="card-inner">
                    <h3>📍 Coordonnées</h3>
                    <label>Email</label>
                    <input type="email" id="e-mail" value="${donor.email || ''}" class="luxe-input">
                    <label>Adresse</label>
                    <input type="text" id="e-addr" value="${donor.address || ''}" class="luxe-input">
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
                    <label>Introduit par / Lien</label>
                    <input type="text" id="e-link" value="${donor.next_action || ''}" class="luxe-input">
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
                    <div style="grid-column: span 2;"><label>Destination du don (Entité)</label>
                        <select id="new-dest" class="luxe-input">
                            ${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; padding-top:20px;">
                        <input type="checkbox" id="new-thanks" style="width:20px; height:20px;"> <label for="new-thanks">Remercié ?</label>
                    </div>
                    <button onclick="submitDonation('${donor.id}')" class="btn-save" style="grid-column: span 3; background: var(--gold);">✅ Valider le don</button>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>📜 Historique des Dons</h3>
                <div class="table-scroll" style="max-height: 200px; overflow-y: auto;">
                    <table class="luxe-table">
                        <thead><tr><th>Date</th><th>Montant</th><th>Destination</th><th>Reçu N°</th><th>Action</th></tr></thead>
                        <tbody>
                            ${donations.map(d => `
                                <tr>
                                    <td>${d.date}</td>
                                    <td><strong>${d.amount} €</strong></td>
                                    <td><small>${d.destination || '-'}</small></td>
                                    <td><input type="text" value="${d.tax_receipt_id || ''}" onchange="updateReceipt('${d.id}', this.value)" class="table-input" style="width:80px;" placeholder="N°"></td>
                                    <td><button onclick="deleteDonation('${d.id}', '${donor.id}')" class="btn-icon">🗑️</button></td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>💬 Notes de suivi</h3>
                <div class="notes-list" style="max-height: 120px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                    ${notes.map(n => `<div class="note-row" style="margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:5px;"><strong>${n.author_name}</strong>: ${n.content} <button onclick="deleteNote('${n.id}', '${donor.id}')" class="btn-icon" style="float:right;">🗑️</button></div>`).join('')}
                </div>
                <div style="display:flex; gap:5px;"><input type="text" id="n-txt" class="luxe-input" placeholder="Nouvelle note..."><button onclick="addNote('${donor.id}')" class="btn-save">OK</button></div>
            </div>

            <div style="margin-top:30px; display:flex; gap:10px;">
                <button onclick="saveDonorChanges('${donor.id}')" class="btn-save" style="flex:2;">💾 Sauvegarder Profil</button>
                <button onclick="deleteFullDonor('${donor.id}')" class="btn-danger-action" style="flex:1;">⚠️ Supprimer Fiche</button>
            </div>
        </div>
    `;
};

// --- ACTIONS CRUD ---
window.submitDonation = async (donorId) => {
    const amount = document.getElementById('new-amount').value;
    const date = document.getElementById('new-date').value;
    const method = document.getElementById('new-method').value;
    const dest = document.getElementById('new-dest').value;
    const thanked = document.getElementById('new-thanks').checked;

    if(!amount || amount <= 0) return showNotify("Indiquez un montant", "error");

    const { error } = await supabaseClient.from('donations').insert([{
        donor_id: donorId, amount: amount, date: date, payment_method: method, destination: dest, thanked: thanked
    }]);

    if(!error) { showNotify("Don enregistré"); openDonorFile(donorId); loadDonors(); }
};

window.updateReceipt = async (donationId, value) => {
    await supabaseClient.from('donations').update({ tax_receipt_id: value }).eq('id', donationId);
    showNotify("Reçu fiscal mis à jour");
};

window.addNote = async (id) => {
    const val = document.getElementById('n-txt').value;
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
    showNotify("Fiche mise à jour");
    loadDonors();
    closeModal('donor-modal');
};

window.deleteNote = (noteId, donorId) => customConfirm("Supprimer cette note ?", async () => { await supabaseClient.from('messages').delete().eq('id', noteId); openDonorFile(donorId); });
window.deleteDonation = (donId, donorId) => customConfirm("Supprimer ce don ?", async () => { await supabaseClient.from('donations').delete().eq('id', donId); openDonorFile(donorId); loadDonors(); });
window.deleteFullDonor = (id) => customConfirm("DÉTRUIRE cette fiche ?", async () => { 
    await supabaseClient.from('donations').delete().eq('donor_id', id);
    await supabaseClient.from('messages').delete().eq('donor_id', id);
    await supabaseClient.from('donors').delete().eq('id', id);
    showNotify("Dossier supprimé");
    closeModal('donor-modal');
    loadDonors();
});

window.exportGlobalExcel = () => {
    const rows = [["Nom", "Prénom", "Email", "Ville", "Entité", "Total Dons"]];
    allDonorsData.forEach(d => {
        const total = d.donations.reduce((s, n) => s + Number(n.amount), 0);
        rows.push([d.last_name, d.first_name, d.email, d.city, d.entities, total]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donateurs");
    XLSX.writeFile(wb, `Alsatia_Export_${new Date().getFullYear()}.xlsx`);
};
