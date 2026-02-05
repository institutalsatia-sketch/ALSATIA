/**
 * CRM & CALENDRIER INSTITUT ALSATIA - V12 (MASTER FINAL)
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
};
window.closeModal = () => document.getElementById('donor-modal').style.display = 'none';
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    loadDonors();
    listenChat(); // Écoute les nouveaux messages en temps réel
});

// ========================== SECTION CHAT (AJOUTÉ) ==========================

async function loadChatMessages() {
    const { data } = await supabaseClient.from('chat_global').select('*').order('created_at', { ascending: true }).limit(50);
    const box = document.getElementById('chat-box');
    if (box && data) {
        box.innerHTML = data.map(m => `
            <div class="message ${m.author_name === currentUser.first_name ? 'my-msg' : ''}">
                <small>${m.author_name} (${m.portal})</small>
                <p>${m.content}</p>
            </div>
        `).join('');
        box.scrollTop = box.scrollHeight;
    }
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    if (!input.value.trim()) return;
    await supabaseClient.from('chat_global').insert([{
        content: input.value,
        author_name: currentUser.first_name,
        portal: currentUser.portal
    }]);
    input.value = '';
    loadChatMessages();
};

function listenChat() {
    supabaseClient.channel('public:chat_global').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global' }, () => {
        loadChatMessages();
    }).subscribe();
}

// ========================== SECTION CRM (STRICTEMENT IDENTIQUE) ==========================

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
        return `<tr><td><strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}</td>
        <td><span class="badge-entity">${d.entities || 'Alsatia'}</span></td>
        <td class="gold-text"><strong>${total} €</strong></td>
        <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Détails</button></td></tr>`;
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
            <header class="fiche-header"><h2>⚜️ Nouveau Donateur</h2><button onclick="closeModal()" class="btn-icon">✖</button></header>
            <div class="grid-2">
                <div><label>Nom</label><input type="text" id="n-lname" class="luxe-input"></div>
                <div><label>Prénom</label><input type="text" id="n-fname" class="luxe-input"></div>
                <div class="full-width"><label>Entité</label><select id="n-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select></div>
            </div>
            <button onclick="handleNewDonor()" class="btn-save" style="width:100%; margin-top:20px;">Créer la fiche</button>
        </div>`;
};

window.handleNewDonor = async () => {
    const ln = document.getElementById('n-lname').value.trim();
    if(!ln) return;
    await supabaseClient.from('donors').insert([{ last_name: ln, first_name: document.getElementById('n-fname').value, entities: document.getElementById('n-ent').value, last_modified_by: currentUser.last_name }]);
    closeModal(); loadDonors();
};

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', id).single();
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header"><h2>${d.last_name.toUpperCase()} ${d.first_name || ''}</h2><button onclick="closeModal()" class="btn-icon">✖</button></header>
            <div class="grid-2">
                <div class="card-inner"><h3>📍 Coordonnées</h3>
                    <input type="email" id="e-mail" value="${d.email || ''}" class="luxe-input" placeholder="Email">
                    <input type="text" id="e-addr" value="${d.address || ''}" class="luxe-input" placeholder="Adresse">
                    <div style="display:flex; gap:5px;"><input type="text" id="e-zip" value="${d.zip_code || ''}" class="luxe-input" placeholder="CP"><input type="text" id="e-city" value="${d.city || ''}" class="luxe-input" placeholder="Ville"></div>
                </div>
                <div class="card-inner"><h3>🤝 Profil</h3>
                    <select id="e-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}" ${d.entities===e?'selected':''}>${e}</option>`).join('')}</select>
                    <input type="text" id="e-link" value="${d.next_action || ''}" class="luxe-input" placeholder="Lien/Origine">
                </div>
            </div>
            <div class="card-inner full-width" style="margin-top:15px; border:1px solid #b99d65;">
                <h3 style="color:#b99d65;">💰 Nouveau Don</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                    <input type="number" id="d-amt" class="luxe-input" placeholder="Montant €">
                    <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
                    <select id="d-met" class="luxe-input">${METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
                    <select id="d-dest" class="luxe-input" style="grid-column: span 2;">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select>
                    <button onclick="addDonation('${d.id}')" class="btn-save" style="grid-column: span 3; background:#b99d65;">Enregistrer</button>
                </div>
            </div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button onclick="saveDonor('${d.id}')" class="btn-save" style="flex:2;">💾 Sauvegarder</button>
                <button onclick="delDonor('${d.id}')" class="btn-danger-action" style="flex:1;">Supprimer</button>
            </div>
        </div>`;
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: amt, date: document.getElementById('d-date').value, payment_method: document.getElementById('d-met').value, destination: document.getElementById('d-dest').value }]);
    openDonorFile(id); loadDonors();
};

window.saveDonor = async (id) => {
    const up = { email: document.getElementById('e-mail').value, address: document.getElementById('e-addr').value, zip_code: document.getElementById('e-zip').value, city: document.getElementById('e-city').value, entities: document.getElementById('e-ent').value, next_action: document.getElementById('e-link').value, last_modified_by: currentUser.last_name };
    await supabaseClient.from('donors').update(up).eq('id', id);
    closeModal(); loadDonors();
};

window.exportGlobalExcel = () => {
    const rows = [["Nom", "Prénom", "Entité", "Total Dons"]];
    allDonorsData.forEach(d => rows.push([d.last_name, d.first_name, d.entities, (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0)]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donateurs");
    XLSX.writeFile(wb, "Export_Alsatia.xlsx");
};

// ========================== SECTION ÉVÉNEMENTS ==========================

window.loadEvents = async () => {
    const { data } = await supabaseClient.from('events').select('*').order('start_date', { ascending: true });
    renderEventsGrid(data || []);
};

function renderEventsGrid(events) {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = events.map(ev => `
        <div class="event-card">
            <div class="event-date">📅 ${new Date(ev.start_date).toLocaleDateString()} - ${ev.start_time || ''}</div>
            <h3 style="margin:10px 0;">${ev.title}</h3>
            <div class="event-meta">📍 ${ev.location || 'Lieu non défini'}</div>
            <div class="event-meta">👤 Organisé par : <strong>${ev.organizer_entity}</strong></div>
            <p style="font-size:0.85rem; color:#475569;">${ev.description || ''}</p>
            <div class="event-docs">
                ${(ev.document_urls || []).map((url, index) => `<a href="${url}" target="_blank" class="doc-link">Fichier ${index + 1}</a>`).join('')}
            </div>
            <div style="margin-top:15px;">
                ${ev.organizer_entity === currentUser.portal ? `<button onclick="deleteEvent('${ev.id}')" class="btn-sm" style="color:red; background:none; border:none; cursor:pointer;">Supprimer l'événement</button>` : ''}
            </div>
        </div>
    `).join('');
}

window.openNewEventModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header"><h2>📅 Nouvel Événement</h2><button onclick="closeModal()" class="btn-icon">✖</button></header>
            <div class="grid-2">
                <div class="full-width"><label>Titre</label><input type="text" id="ev-title" class="luxe-input"></div>
                <div><label>Date</label><input type="date" id="ev-date" class="luxe-input"></div>
                <div><label>Heure</label><input type="time" id="ev-time" class="luxe-input"></div>
                <div class="full-width"><label>Lieu</label><input type="text" id="ev-loc" class="luxe-input"></div>
                <div class="full-width"><label>Description</label><textarea id="ev-desc" class="luxe-input" style="height:60px;"></textarea></div>
                <div class="full-width"><label>Documents (Images, Affiches...)</label><input type="file" id="ev-files" multiple class="luxe-input"></div>
            </div>
            <button onclick="handleNewEvent()" class="btn-save" style="width:100%; margin-top:20px; background:#1e293b;">Publier l'événement</button>
        </div>`;
};

window.handleNewEvent = async () => {
    const title = document.getElementById('ev-title').value;
    const fileInput = document.getElementById('ev-files');
    const uploadedUrls = [];

    if (fileInput.files.length > 0) {
        for (let file of fileInput.files) {
            const fileName = `${Date.now()}_${file.name}`;
            const { data } = await supabaseClient.storage.from('event-documents').upload(fileName, file);
            if (data) {
                const { data: urlData } = supabaseClient.storage.from('event-documents').getPublicUrl(fileName);
                uploadedUrls.push(urlData.publicUrl);
            }
        }
    }

    await supabaseClient.from('events').insert([{
        title: title,
        start_date: document.getElementById('ev-date').value,
        start_time: document.getElementById('ev-time').value,
        location: document.getElementById('ev-loc').value,
        description: document.getElementById('ev-desc').value,
        organizer_entity: currentUser.portal,
        created_by_name: currentUser.last_name,
        document_urls: uploadedUrls
    }]);

    closeModal(); loadEvents();
};

window.deleteEvent = async (id) => {
    if(confirm("Confirmer la suppression ?")) {
        await supabaseClient.from('events').delete().eq('id', id);
        loadEvents();
    }
};

window.filterEventsByEntity = async (entity) => {
    const { data } = await supabaseClient.from('events').select('*').eq('organizer_entity', entity).order('start_date', { ascending: true });
    renderEventsGrid(data || []);
};
