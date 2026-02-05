/**
 * CRM & CALENDRIER ALSATIA - V14 FINAL
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

// ========================== CRM ==========================
async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    if (!list) return;
    list.innerHTML = data.map(d => {
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0);
        return `<tr>
            <td style="padding:15px;"><strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}</td>
            <td style="padding:15px;"><span style="font-size:0.75rem; background:#f1f5f9; padding:4px 8px; border-radius:4px;">${d.entities || 'Alsatia'}</span></td>
            <td style="padding:15px; color:#b99d65;"><strong>${total} €</strong></td>
            <td style="padding:15px;"><button onclick="openDonorFile('${d.id}')" class="btn-sm">Ouvrir</button></td>
        </tr>`;
    }).join('');
}

window.filterDonors = () => {
    const val = document.getElementById('search-donor').value.toLowerCase();
    const filtered = allDonorsData.filter(d => (d.last_name || "").toLowerCase().includes(val) || (d.first_name || "").toLowerCase().includes(val));
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
                <div><label>Nom</label><input type="text" id="n-lname" class="luxe-input"></div>
                <div><label>Prénom</label><input type="text" id="n-fname" class="luxe-input"></div>
                <div style="grid-column: span 2;"><label>Entité</label><select id="n-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select></div>
            </div>
            <button onclick="handleNewDonor()" class="btn-save" style="width:100%; margin-top:20px; background:var(--gold);">Enregistrer Donateur</button>
        </div>`;
};

window.handleNewDonor = async () => {
    const ln = document.getElementById('n-lname').value.trim();
    if(!ln) return;
    await supabaseClient.from('donors').insert([{ last_name: ln, first_name: document.getElementById('n-fname').value, entities: document.getElementById('n-ent').value, last_modified_by: currentUser.last_name }]);
    closeModal(); loadDonors();
};

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="margin:0;">${d.last_name.toUpperCase()} ${d.first_name || ''}</h2>
                <div style="display:flex; gap:10px;">
                    <button onclick="exportSingleDonorExcel('${d.id}')" class="btn-sm" style="background:#22c55e; color:white; border:none;">📊 Export Fiche</button>
                    <button onclick="closeModal()" style="background:none; border:none; cursor:pointer; font-size:1.5rem;">✖</button>
                </div>
            </header>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div style="background:#f8fafc; padding:20px; border-radius:12px;">
                    <h3 style="margin-top:0;">📍 Coordonnées</h3>
                    <label>Email</label><input type="email" id="e-mail" value="${d.email || ''}" class="luxe-input">
                    <label>Adresse</label><input type="text" id="e-addr" value="${d.address || ''}" class="luxe-input">
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <input type="text" id="e-zip" value="${d.zip_code || ''}" class="luxe-input" placeholder="CP">
                        <input type="text" id="e-city" value="${d.city || ''}" class="luxe-input" placeholder="Ville">
                    </div>
                </div>
                <div style="background:#f8fafc; padding:20px; border-radius:12px;">
                    <h3 style="margin-top:0;">🤝 Profil</h3>
                    <label>Entité</label><select id="e-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}" ${d.entities===e?'selected':''}>${e}</option>`).join('')}</select>
                    <label>Origine / Lien</label><input type="text" id="e-link" value="${d.next_action || ''}" class="luxe-input">
                </div>
            </div>
            
            <div style="margin-top:30px; border:2px solid #f1f5f9; padding:20px; border-radius:12px;">
                <h3 style="color:var(--gold); margin-top:0;">💰 Dons & Comptabilité</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:20px; background:#fff; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <input type="number" id="d-amt" class="luxe-input" placeholder="Montant €" style="margin:0;">
                    <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input" style="margin:0;">
                    <select id="d-met" class="luxe-input" style="margin:0;">${METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
                    <select id="d-dest" class="luxe-input" style="grid-column: span 2; margin:0;">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select>
                    <button onclick="addDonation('${d.id}')" class="btn-save" style="background:var(--gold); margin:0;">+ Enregistrer</button>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead><tr style="text-align:left; border-bottom:2px solid #f1f5f9;"><th style="padding:8px;">Date</th><th style="padding:8px;">Montant</th><th style="padding:8px;">Dest.</th><th style="padding:8px;">Action</th></tr></thead>
                    <tbody>${(d.donations || []).map(don => `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:8px;"><input type="date" value="${don.date}" onchange="updateDonation('${don.id}','${d.id}','date',this.value)" class="table-input"></td>
                            <td style="padding:8px;"><input type="number" value="${don.amount}" onchange="updateDonation('${don.id}','${d.id}','amount',this.value)" class="table-input" style="width:70px;"> €</td>
                            <td style="padding:8px; color:#64748b;">${don.destination}</td>
                            <td style="padding:8px;"><button onclick="deleteDonation('${don.id}','${d.id}')" style="color:#ef4444; background:none; border:none; cursor:pointer;">🗑️</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display:flex; gap:15px; margin-top:30px;">
                <button onclick="saveDonor('${d.id}')" class="btn-save" style="flex:2; background:var(--primary);">💾 Sauvegarder les modifications</button>
                <button onclick="delDonor('${d.id}')" class="btn-save" style="flex:1; background:#ef4444;">Supprimer Donateur</button>
            </div>
        </div>`;
};

// --- LOGIQUE DONS ---
window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: amt, date: document.getElementById('d-date').value, payment_method: document.getElementById('d-met').value, destination: document.getElementById('d-dest').value }]);
    openDonorFile(id); loadDonors();
};
window.updateDonation = async (donId, donorId, field, value) => {
    const upd = {}; upd[field] = value;
    await supabaseClient.from('donations').update(upd).eq('id', donId);
    loadDonors();
};
window.deleteDonation = async (donId, donorId) => {
    if(confirm("Supprimer ce don ?")) {
        await supabaseClient.from('donations').delete().eq('id', donId);
        openDonorFile(donorId); loadDonors();
    }
};

// --- LOGIQUE DONATEURS ---
window.saveDonor = async (id) => {
    const up = { email: document.getElementById('e-mail').value, address: document.getElementById('e-addr').value, zip_code: document.getElementById('e-zip').value, city: document.getElementById('e-city').value, entities: document.getElementById('e-ent').value, next_action: document.getElementById('e-link').value, last_modified_by: currentUser.last_name };
    await supabaseClient.from('donors').update(up).eq('id', id);
    closeModal(); loadDonors();
};
window.delDonor = async (id) => {
    if(confirm("ATTENTION : Supprimer ce donateur et tous ses dons ?")) {
        await supabaseClient.from('donors').delete().eq('id', id);
        closeModal(); loadDonors();
    }
};

// --- EXPORTS ---
window.exportGlobalExcel = () => {
    const rows = [["Nom", "Prénom", "Email", "Entité", "Cumul"]];
    allDonorsData.forEach(d => rows.push([d.last_name, d.first_name, d.email, d.entities, (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0)]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alsatia");
    XLSX.writeFile(wb, "Export_Alsatia_Global.xlsx");
};
window.exportSingleDonorExcel = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const rows = [["FICHE : " + d.last_name], ["Entité", d.entities], ["Email", d.email], [], ["DATE", "MONTANT", "DESTINATION"]];
    (d.donations || []).forEach(don => rows.push([don.date, don.amount + "€", don.destination]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fiche");
    XLSX.writeFile(wb, `Fiche_${d.last_name}.xlsx`);
};

// ========================== ÉVÉNEMENTS ==========================
window.loadEvents = async () => {
    const { data } = await supabaseClient.from('events').select('*').order('start_date', { ascending: true });
    const grid = document.getElementById('events-grid');
    grid.innerHTML = (data || []).map(ev => `
        <div class="event-card">
            <div style="color:var(--gold); font-weight:bold; font-size:0.8rem;">📅 ${ev.start_date || ''} • ${ev.start_time || ''}</div>
            <h3 style="margin:10px 0;">${ev.title}</h3>
            <div style="font-size:0.85rem; color:#64748b;">📍 ${ev.location || 'Non défini'}</div>
            <div style="font-size:0.8rem; color:#64748b; margin:10px 0;">Organisé par : <strong>${ev.organizer_entity}</strong></div>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:10px;">
                ${(ev.document_urls || []).map((url, i) => `<a href="${url}" target="_blank" style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:0.7rem; text-decoration:none;">Doc ${i+1}</a>`).join('')}
            </div>
            ${ev.organizer_entity === currentUser.portal ? `<button onclick="deleteEvent('${ev.id}')" style="margin-top:15px; color:#ef4444; background:none; border:none; cursor:pointer; font-size:0.75rem;">Supprimer</button>` : ''}
        </div>`).join('');
};
window.openNewEventModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h2>📅 Nouvel Événement</h2>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div style="grid-column: span 2;"><label>Nom de l'événement</label><input type="text" id="ev-title" class="luxe-input"></div>
                <div><label>Date</label><input type="date" id="ev-date" class="luxe-input"></div>
                <div><label>Horaire</label><input type="time" id="ev-time" class="luxe-input"></div>
                <div style="grid-column: span 2;"><label>Lieu précis</label><input type="text" id="ev-loc" class="luxe-input"></div>
                <div style="grid-column: span 2;"><label>Documents (Affiches, etc.)</label><input type="file" id="ev-files" multiple class="luxe-input"></div>
            </div>
            <button onclick="handleNewEvent()" class="btn-save" style="width:100%; margin-top:20px; background:var(--primary);">Publier sur le calendrier</button>
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
window.deleteEvent = async (id) => { if(confirm("Supprimer l'événement ?")) { await supabaseClient.from('events').delete().eq('id', id); loadEvents(); } };
window.filterEventsByEntity = async (entity) => {
    const { data } = await supabaseClient.from('events').select('*').eq('organizer_entity', entity).order('start_date', { ascending: true });
    loadEvents(); // Utiliserait la data filtrée normalement ici
};
