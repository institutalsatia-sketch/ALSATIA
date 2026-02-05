/**
 * CRM & CALENDRIER ALSATIA - V15 (REMERCIEMENTS & CAMPAGNES)
 */
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
const ENTITIES = ["Institut Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin", "Academia Alsatia"];
const METHODS = ["Virement", "Chèque", "Espèces", "CB", "Prélèvement"];

// --- NAVIGATION ---
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
    if(id === 'events') loadEvents();
    if(id === 'chat') loadChatMessages();
    if(id === 'donors') loadDonors();
    if(id === 'campaigns') loadCampaigns();
};
window.closeModal = () => document.getElementById('donor-modal').style.display = 'none';
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    loadDonors();
    listenChat();
});

// ========================== CHAT ==========================
async function loadChatMessages() {
    const { data } = await supabaseClient.from('chat_global').select('*').order('created_at', { ascending: true }).limit(50);
    const box = document.getElementById('chat-box');
    if (box && data) {
        box.innerHTML = data.map(m => `
            <div class="message ${m.author_name === currentUser.first_name ? 'my-msg' : ''}">
                <small><strong>${m.author_name}</strong> • ${m.portal}</small>
                <p style="margin:4px 0 0 0;">${m.content}</p>
            </div>
        `).join('');
        box.scrollTop = box.scrollHeight;
    }
}
window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    if (!input.value.trim()) return;
    await supabaseClient.from('chat_global').insert([{ content: input.value, author_name: currentUser.first_name, portal: currentUser.portal }]);
    input.value = '';
    loadChatMessages();
};
function listenChat() {
    supabaseClient.channel('chat_updates').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global' }, () => { loadChatMessages(); }).subscribe();
}

// ========================== CRM (BASE DONATEURS) ==========================
async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
    checkPendingThanks();
}

function checkPendingThanks() {
    if (currentUser.portal !== "Institut Alsatia") return;
    const pending = allDonorsData.filter(d => (d.donations || []).some(don => !don.thanked));
    const container = document.getElementById('pending-thanks-alert');
    if (pending.length > 0) {
        container.innerHTML = `<div class="thanks-pending">⚠️ Il y a ${pending.length} donateur(s) avec des dons en attente de remerciement.</div>`;
    } else {
        container.innerHTML = "";
    }
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    if (!list) return;
    list.innerHTML = data.map(d => {
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0);
        const identity = d.company_name ? `🏢 <strong>${d.company_name}</strong><br><small>${d.last_name} ${d.first_name || ''}</small>` : `<strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}`;
        return `<tr>
            <td style="padding:15px;">${identity}</td>
            <td style="padding:15px;"><span style="font-size:0.75rem; background:#f1f5f9; padding:4px 8px; border-radius:4px;">${d.entities || 'Alsatia'}</span></td>
            <td style="padding:15px; color:#b99d65;"><strong>${total} €</strong></td>
            <td style="padding:15px;"><button onclick="openDonorFile('${d.id}')" class="btn-sm">Ouvrir</button></td>
        </tr>`;
    }).join('');
}

window.filterDonors = () => {
    const val = document.getElementById('search-donor').value.toLowerCase();
    const filtered = allDonorsData.filter(d => 
        (d.last_name || "").toLowerCase().includes(val) || 
        (d.company_name || "").toLowerCase().includes(val)
    );
    renderDonorsTable(filtered);
};

window.openNewDonorModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>⚜️ Création de Fiche</h2><button onclick="closeModal()" style="background:none; border:none; cursor:pointer; font-size:1.5rem;">✖</button>
            </header>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div style="grid-column: span 2;"><label>Nom de l'Entreprise (Si applicable)</label><input type="text" id="n-comp" class="luxe-input"></div>
                <div><label>Nom (Contact/Donateur)</label><input type="text" id="n-lname" class="luxe-input"></div>
                <div><label>Prénom</label><input type="text" id="n-fname" class="luxe-input"></div>
                <div style="grid-column: span 2;"><label>Entité Principale</label><select id="n-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select></div>
            </div>
            <button onclick="handleNewDonor()" class="btn-save" style="width:100%; margin-top:20px; background:var(--gold);">Enregistrer Fiche</button>
        </div>`;
};

window.handleNewDonor = async () => {
    const ln = document.getElementById('n-lname').value.trim();
    if(!ln) return;
    await supabaseClient.from('donors').insert([{ 
        last_name: ln, 
        first_name: document.getElementById('n-fname').value, 
        company_name: document.getElementById('n-comp').value,
        entities: document.getElementById('n-ent').value, 
        last_modified_by: currentUser.last_name 
    }]);
    closeModal(); loadDonors();
};

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="margin:0;">${d.company_name ? '🏢 ' + d.company_name : d.last_name.toUpperCase() + ' ' + (d.first_name || '')}</h2>
                <div style="display:flex; gap:10px;">
                    <button onclick="exportSingleDonorExcel('${d.id}')" class="btn-sm" style="background:#22c55e; color:white; border:none;">📊 Export Excel</button>
                    <button onclick="closeModal()" style="background:none; border:none; cursor:pointer; font-size:1.5rem;">✖</button>
                </div>
            </header>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div style="background:#f8fafc; padding:20px; border-radius:12px;">
                    <h3 style="margin-top:0;">📍 Coordonnées</h3>
                    <label>Nom Entreprise</label><input type="text" id="e-comp" value="${d.company_name || ''}" class="luxe-input">
                    <label>Nom Contact</label><input type="text" id="e-lname" value="${d.last_name || ''}" class="luxe-input">
                    <label>Prénom Contact</label><input type="text" id="e-fname" value="${d.first_name || ''}" class="luxe-input">
                    <label>Email</label><input type="email" id="e-mail" value="${d.email || ''}" class="luxe-input">
                    <label>Adresse complète</label><input type="text" id="e-addr" value="${d.address || ''}" class="luxe-input">
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <input type="text" id="e-zip" value="${d.zip_code || ''}" class="luxe-input" placeholder="CP">
                        <input type="text" id="e-city" value="${d.city || ''}" class="luxe-input" placeholder="Ville">
                    </div>
                </div>
                <div style="background:#f8fafc; padding:20px; border-radius:12px;">
                    <h3 style="margin-top:0;">🤝 Profil</h3>
                    <label>Entité de rattachement</label><select id="e-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}" ${d.entities===e?'selected':''}>${e}</option>`).join('')}</select>
                    <label>Origine / Lien</label><input type="text" id="e-link" value="${d.next_action || ''}" class="luxe-input">
                </div>
            </div>
            
            <div style="margin-top:30px; border:2px solid #f1f5f9; padding:20px; border-radius:12px;">
                <h3 style="color:var(--gold); margin-top:0;">💰 Gestion des Dons</h3>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:20px; background:#fff; padding:15px; border:1px solid #e2e8f0; border-radius:8px;">
                    <input type="number" id="d-amt" class="luxe-input" placeholder="Montant €">
                    <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
                    <input type="text" id="d-tax" class="luxe-input" placeholder="N° Reçu Fiscal">
                    <select id="d-met" class="luxe-input" style="grid-column: span 1;">${METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
                    <select id="d-dest" class="luxe-input" style="grid-column: span 1;">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select>
                    <button onclick="addDonation('${d.id}')" class="btn-save" style="background:var(--gold);">+ Enregistrer</button>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                    <thead><tr style="text-align:left; border-bottom:2px solid #f1f5f9;">
                        <th>Date & Reçu</th><th>Montant</th><th>Remerciement</th><th>Action</th>
                    </tr></thead>
                    <tbody>${(d.donations || []).sort((a,b)=>new Date(b.date)-new Date(a.date)).map(don => `
                        <tr style="border-bottom:1px solid #f1f5f9; background:${!don.thanked ? '#fff5f5' : 'transparent'};">
                            <td style="padding:10px;">
                                <input type="date" value="${don.date}" onchange="updateDonation('${don.id}','${d.id}','date',this.value)" class="table-input" style="width:120px; margin-bottom:3px;"><br>
                                <input type="text" value="${don.fiscal_receipt_id || ''}" placeholder="N° Reçu" onchange="updateDonation('${don.id}','${d.id}','fiscal_receipt_id',this.value)" class="table-input">
                            </td>
                            <td><input type="number" value="${don.amount}" onchange="updateDonation('${don.id}','${d.id}','amount',this.value)" class="table-input" style="width:65px;"> €</td>
                            <td>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <input type="checkbox" ${don.thanked ? 'checked' : ''} onchange="updateDonation('${don.id}','${d.id}','thanked',this.checked)"> Fait
                                    <input type="date" value="${don.thank_date || ''}" onchange="updateDonation('${don.id}','${d.id}','thank_date',this.value)" class="table-input" style="width:110px;">
                                </div>
                            </td>
                            <td><button onclick="deleteDonation('${don.id}','${d.id}')" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display:flex; gap:15px; margin-top:30px;">
                <button onclick="saveDonor('${d.id}')" class="btn-save" style="flex:2; background:var(--primary);">💾 Sauvegarder Profil</button>
                <button onclick="delDonor('${d.id}')" class="btn-save" style="flex:1; background:#ef4444;">Supprimer</button>
            </div>
        </div>`;
};

// --- LOGIQUE DONS ---
window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{ 
        donor_id: id, amount: amt, date: document.getElementById('d-date').value, 
        fiscal_receipt_id: document.getElementById('d-tax').value,
        payment_method: document.getElementById('d-met').value, 
        destination: document.getElementById('d-dest').value,
        thanked: false
    }]);
    openDonorFile(id); loadDonors();
};
window.updateDonation = async (donId, donorId, field, value) => {
    const upd = {}; upd[field] = value;
    await supabaseClient.from('donations').update(upd).eq('id', donId);
    if(field === 'thanked' || field === 'thank_date') checkPendingThanks();
    loadDonors();
};
window.deleteDonation = async (donId, donorId) => {
    if(confirm("Supprimer ce don ?")) {
        await supabaseClient.from('donations').delete().eq('id', donId);
        openDonorFile(donorId); loadDonors();
    }
};

window.saveDonor = async (id) => {
    const up = { 
        company_name: document.getElementById('e-comp').value,
        last_name: document.getElementById('e-lname').value,
        first_name: document.getElementById('e-fname').value,
        email: document.getElementById('e-mail').value, address: document.getElementById('e-addr').value, 
        zip_code: document.getElementById('e-zip').value, city: document.getElementById('e-city').value, 
        entities: document.getElementById('e-ent').value, next_action: document.getElementById('e-link').value, 
        last_modified_by: currentUser.last_name 
    };
    await supabaseClient.from('donors').update(up).eq('id', id);
    closeModal(); loadDonors();
};
window.delDonor = async (id) => {
    if(confirm("Supprimer la fiche ?")) { await supabaseClient.from('donors').delete().eq('id', id); closeModal(); loadDonors(); }
};

// ========================== CAMPAGNES ==========================
async function loadCampaigns() {
    const { data } = await supabaseClient.from('campaigns').select('*').order('created_at', { ascending: false });
    const grid = document.getElementById('campaigns-list');
    grid.innerHTML = (data || []).map(c => `
        <div class="event-card">
            <div style="font-size:0.7rem; color:var(--gold); font-weight:bold; text-transform:uppercase;">${c.target_entity}</div>
            <h3 style="margin:10px 0;">${c.name}</h3>
            <p style="font-size:0.85rem; color:#64748b;">Objectif : <strong>${c.goal_amount || 'Non défini'} €</strong></p>
            <div style="font-size:0.8rem; margin-top:10px;">${c.description || ''}</div>
            <button onclick="deleteCampaign('${c.id}')" style="margin-top:15px; color:red; background:none; border:none; cursor:pointer; font-size:0.7rem;">Supprimer</button>
        </div>
    `).join('');
}

window.openNewCampaignModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h2>📣 Nouvelle Campagne de Dons</h2>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div style="grid-column: span 2;"><label>Nom de la Campagne</label><input type="text" id="c-name" class="luxe-input"></div>
                <div><label>Entité Cible</label><select id="c-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select></div>
                <div><label>Objectif (€)</label><input type="number" id="c-goal" class="luxe-input"></div>
                <div style="grid-column: span 2;"><label>Description</label><textarea id="c-desc" class="luxe-input" style="height:80px;"></textarea></div>
            </div>
            <button onclick="handleNewCampaign()" class="btn-save" style="width:100%; margin-top:20px; background:var(--gold);">Lancer la campagne</button>
        </div>`;
};

window.handleNewCampaign = async () => {
    await supabaseClient.from('campaigns').insert([{
        name: document.getElementById('c-name').value,
        target_entity: document.getElementById('c-ent').value,
        goal_amount: document.getElementById('c-goal').value,
        description: document.getElementById('c-desc').value
    }]);
    closeModal(); loadCampaigns();
};

window.deleteCampaign = async (id) => { if(confirm("Supprimer cette campagne ?")) { await supabaseClient.from('campaigns').delete().eq('id', id); loadCampaigns(); } };

// ========================== ÉVÉNEMENTS ==========================
window.loadEvents = async () => {
    const { data } = await supabaseClient.from('events').select('*').order('start_date', { ascending: true });
    const grid = document.getElementById('events-grid');
    grid.innerHTML = (data || []).map(ev => `
        <div class="event-card">
            <div style="color:var(--gold); font-weight:bold; font-size:0.8rem;">📅 ${ev.start_date || ''} • ${ev.start_time || ''}</div>
            <h3 style="margin:10px 0;">${ev.title}</h3>
            <div style="font-size:0.85rem; color:#64748b;">📍 ${ev.location || 'Non défini'}</div>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:10px;">
                ${(ev.document_urls || []).map((url, i) => `<a href="${url}" target="_blank" style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:0.7rem; text-decoration:none; border:1px solid #e2e8f0;">Doc ${i+1}</a>`).join('')}
            </div>
        </div>`).join('');
};

window.openNewEventModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h2>📅 Nouvel Événement</h2>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div style="grid-column: span 2;"><label>Titre</label><input type="text" id="ev-title" class="luxe-input"></div>
                <div><label>Date</label><input type="date" id="ev-date" class="luxe-input"></div>
                <div><label>Horaire</label><input type="time" id="ev-time" class="luxe-input"></div>
                <div style="grid-column: span 2;"><label>Lieu</label><input type="text" id="ev-loc" class="luxe-input"></div>
                <div style="grid-column: span 2;"><label>Fichiers</label><input type="file" id="ev-files" multiple class="luxe-input"></div>
            </div>
            <button onclick="handleNewEvent()" class="btn-save" style="width:100%; margin-top:20px; background:var(--primary);">Publier</button>
        </div>`;
};

window.handleNewEvent = async () => {
    const fileInput = document.getElementById('ev-files');
    const urls = [];
    if (fileInput.files.length > 0) {
        for (let file of fileInput.files) {
            const name = `${Date.now()}_${file.name}`;
            const { data } = await supabaseClient.storage.from('event-documents').upload(name, file);
            if (data) urls.push(supabaseClient.storage.from('event-documents').getPublicUrl(name).data.publicUrl);
        }
    }
    await supabaseClient.from('events').insert([{ title: document.getElementById('ev-title').value, start_date: document.getElementById('ev-date').value, start_time: document.getElementById('ev-time').value, location: document.getElementById('ev-loc').value, organizer_entity: currentUser.portal, document_urls: urls }]);
    closeModal(); loadEvents();
};
