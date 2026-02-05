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
const METHODS = ["Virement", "Chèque", "Espèces", "CB", "Prélèvement"];

// --- 1. NAVIGATION (FONCTION GLOBALISÉE) ---
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${id}`);
    const targetNav = document.getElementById(`nav-${id}`);
    
    if (targetTab) targetTab.classList.add('active');
    if (targetNav) targetNav.classList.add('active');
};

window.closeModal = () => document.getElementById('donor-modal').style.display = 'none';
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

// --- 2. INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    loadDonors();
});

// --- 3. LOGIQUE CRM ---
async function loadDonors() {
    const { data, error } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    if (error) return;
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    if (!list) return;
    list.innerHTML = data.map(d => {
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0);
        return `
        <tr>
            <td><strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}</td>
            <td><span class="badge-entity">${d.entities || 'Alsatia'}</span></td>
            <td class="gold-text"><strong>${total} €</strong></td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Détails</button></td>
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

// --- 4. MODALE NOUVEAU DONATEUR ---
window.openNewDonorModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header"><h2>⚜️ Nouveau Donateur</h2><button onclick="closeModal()" class="btn-icon">✖</button></header>
            <div class="grid-2">
                <div><label>Nom</label><input type="text" id="n-lname" class="luxe-input"></div>
                <div><label>Prénom</label><input type="text" id="n-fname" class="luxe-input"></div>
                <div class="full-width"><label>Entité de rattachement</label>
                    <select id="n-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select>
                </div>
            </div>
            <button onclick="handleNewDonor()" class="btn-save" style="width:100%; margin-top:20px;">Créer la fiche</button>
        </div>`;
};

window.handleNewDonor = async () => {
    const ln = document.getElementById('n-lname').value.trim();
    if(!ln) return alert("Le nom est obligatoire");
    const { error } = await supabaseClient.from('donors').insert([{
        last_name: ln, first_name: document.getElementById('n-fname').value,
        entities: document.getElementById('n-ent').value, last_modified_by: currentUser.last_name
    }]);
    if(!error) { closeModal(); loadDonors(); }
};

// --- 5. FICHE DÉTAILLÉE ---
window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', id).single();
    document.getElementById('donor-modal').style.display = 'flex';
    
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header">
                <h2>${d.last_name.toUpperCase()} ${d.first_name || ''}</h2>
                <button onclick="closeModal()" class="btn-icon">✖</button>
            </header>
            
            <div class="grid-2">
                <div class="card-inner">
                    <h3>📍 Coordonnées</h3>
                    <input type="email" id="e-mail" value="${d.email || ''}" class="luxe-input" placeholder="Email">
                    <input type="text" id="e-addr" value="${d.address || ''}" class="luxe-input" placeholder="Adresse">
                    <div style="display:flex; gap:5px;"><input type="text" id="e-zip" value="${d.zip_code || ''}" class="luxe-input" placeholder="CP"><input type="text" id="e-city" value="${d.city || ''}" class="luxe-input" placeholder="Ville"></div>
                </div>
                <div class="card-inner"><h3>🤝 Profil</h3>
                    <select id="e-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}" ${d.entities===e?'selected':''}>${e}</option>`).join('')}</select>
                    <input type="text" id="e-link" value="${d.next_action || ''}" class="luxe-input" placeholder="Lien/Origine">
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:15px; border:1px solid #b99d65; background:#fffdf9;">
                <h3 style="color:#b99d65;">💰 Nouveau Don</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                    <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
                    <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
                    <select id="d-met" class="luxe-input">${METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
                    <select id="d-dest" class="luxe-input" style="grid-column: span 2;">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select>
                    <div style="display:flex; align-items:center;"><input type="checkbox" id="d-thk"> Remercié ?</div>
                    <button onclick="addDonation('${d.id}')" class="btn-save" style="grid-column: span 3; background:#b99d65;">Enregistrer le Don</button>
                </div>
                <table class="luxe-table" style="width:100%; margin-top:10px; font-size:0.8rem;">
                    <thead><tr><th>Date</th><th>Montant</th><th>Destination</th><th>Reçu N°</th><th></th></tr></thead>
                    <tbody>${(d.donations || []).map(don => `
                        <tr><td>${don.date}</td><td>${don.amount}€</td><td><small>${don.destination}</small></td>
                        <td><input type="text" value="${don.tax_receipt_id||''}" onchange="updateTax('${don.id}','${d.id}',this.value)" class="table-input" style="width:60px;"></td>
                        <td><button onclick="delDon('${don.id}','${d.id}')" class="btn-icon">🗑️</button></td></tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div class="card-inner full-width">
                <h3>💬 Notes</h3>
                <div style="max-height:80px; overflow-y:auto; background:#f8fafc; padding:8px; border-radius:8px;">
                    ${(d.messages || []).map(m => `<div><strong>${m.author_name}:</strong> ${m.content}</div>`).join('')}
                </div>
                <div style="display:flex; gap:5px; margin-top:5px;"><input type="text" id="n-txt" class="luxe-input" placeholder="Note..."><button onclick="addNote('${d.id}')" class="btn-save">OK</button></div>
            </div>

            <div style="display:flex; gap:10px; margin-top:15px;">
                <button onclick="saveDonor('${d.id}')" class="btn-save" style="flex:2;">💾 Sauvegarder Profil</button>
                <button onclick="delDonor('${d.id}')" class="btn-danger-action" style="flex:1;">Supprimer</button>
            </div>
        </div>`;
};

// --- 6. ACTIONS CRUD ---
window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{
        donor_id: id, amount: amt, date: document.getElementById('d-date').value,
        payment_method: document.getElementById('d-met').value,
        destination: document.getElementById('d-dest').value, thanked: document.getElementById('d-thk').checked
    }]);
    openDonorFile(id); loadDonors();
};

window.updateTax = async (donId, donorId, val) => {
    await supabaseClient.from('donations').update({ tax_receipt_id: val }).eq('id', donId);
};

window.addNote = async (id) => {
    const txt = document.getElementById('n-txt').value;
    if(!txt) return;
    await supabaseClient.from('messages').insert([{ donor_id: id, content: txt, author_name: currentUser.first_name }]);
    openDonorFile(id);
};

window.saveDonor = async (id) => {
    const up = {
        email: document.getElementById('e-mail').value, address: document.getElementById('e-addr').value,
        zip_code: document.getElementById('e-zip').value, city: document.getElementById('e-city').value,
        entities: document.getElementById('e-ent').value, next_action: document.getElementById('e-link').value,
        last_modified_by: currentUser.last_name
    };
    await supabaseClient.from('donors').update(up).eq('id', id);
    closeModal(); loadDonors();
};

window.delDon = async (donId, donorId) => { if(confirm("Supprimer don ?")) { await supabaseClient.from('donations').delete().eq('id', donId); openDonorFile(donorId); loadDonors(); } };
window.delDonor = async (id) => { if(confirm("Supprimer ce donateur ?")) { await supabaseClient.from('donors').delete().eq('id', id); closeModal(); loadDonors(); } };

window.exportGlobalExcel = () => {
    const rows = [["Nom", "Prénom", "Email", "Entité", "Total Dons"]];
    allDonorsData.forEach(d => rows.push([d.last_name, d.first_name, d.email, d.entities, (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0)]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donateurs");
    XLSX.writeFile(wb, "Alsatia_CRM_Export.xlsx");
};
