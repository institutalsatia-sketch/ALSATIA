/**
 * CRM & PORTAIL ALSATIA - V21 FINAL
 * Système complet : CRM, Chat, Sujets Privés, Documents & Lightbox
 */
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let selectedFile = null;
const ENTITIES = ["Institut Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin", "Academia Alsatia"];

// --- NAVIGATION & INITIALISATION ---
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
    if(id === 'chat') { loadSubjects(); loadChatMessages(); }
    if(id === 'donors') loadDonors();
    if(id === 'campaigns') loadCampaigns();
    if(id === 'events') loadEvents();
};

window.closeCustomModal = () => { document.getElementById('custom-modal').style.display = 'none'; };
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    setupChatMentions(); 
    loadDonors(); 
    listenChat();
    if(document.getElementById('tab-chat').classList.contains('active')) loadSubjects();
});

// ========================== GESTION DU CHAT & DOCUMENTS ==========================

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const filtered = data.filter(s => !s.allowed_entities || s.allowed_entities.includes(currentUser.portal));
    const select = document.getElementById('chat-subject-filter');
    const currentVal = select.value;
    select.innerHTML = filtered.map(s => `<option value="${s.name}" ${s.name === currentVal ? 'selected' : ''}># ${s.name}</option>`).join('');
    if (!select.value && filtered.length > 0) select.value = filtered[0].name;
}

window.showNewSubjectModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2>Nouveau Sujet</h2>
        <input type="text" id="new-subject-name" class="luxe-input" placeholder="Nom du sujet...">
        <p style="font-size:0.8rem; margin:15px 0 5px;">Accès restreint à :</p>
        <div id="subject-perms">
            ${ENTITIES.map(e => `<label style="display:block;"><input type="checkbox" value="${e}" checked> ${e}</label>`).join('')}
        </div>
        <div style="margin-top:20px; display:flex; gap:10px;">
            <button onclick="handleCreateSubject()" class="btn-save" style="background:var(--gold); flex:1;">Créer</button>
            <button onclick="closeCustomModal()" class="btn-save" style="background:#64748b; flex:1;">Annuler</button>
        </div>
    `;
};

async function handleCreateSubject() {
    const name = document.getElementById('new-subject-name').value.trim();
    const perms = Array.from(document.querySelectorAll('#subject-perms input:checked')).map(i => i.value);
    if (!name) return;
    await supabaseClient.from('chat_subjects').insert([{ name, allowed_entities: perms }]);
    closeCustomModal();
    loadSubjects();
}

window.handleFileUpload = (input) => {
    if (input.files[0]) {
        selectedFile = input.files[0];
        document.getElementById('file-preview').innerText = "📎 Prêt : " + selectedFile.name;
    }
};

async function loadChatMessages() {
    const subject = document.getElementById('chat-subject-filter').value;
    if(!subject) return;
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subject).order('created_at', { ascending: true });
    const box = document.getElementById('chat-box');
    if (!box || !data) return;

    const filtered = data.filter(m => {
        if (m.portal === "Institut Alsatia") return true;
        if (m.author_name === currentUser.first_name && m.author_last_name === currentUser.last_name) return true;
        if (m.recipients && m.recipients.includes(currentUser.portal)) return true;
        if (m.portal === currentUser.portal && (!m.recipients || m.recipients.length === 0)) return true;
        return false;
    });

    box.innerHTML = filtered.map(m => {
        const isMe = m.author_name === currentUser.first_name && m.author_last_name === currentUser.last_name;
        const content = m.content.replace(/@\w+/g, '<span style="color:var(--gold); font-weight:bold;">$&</span>');
        
        let mediaHtml = '';
        if (m.file_url) {
            if (m.is_image) {
                mediaHtml = `<img src="${m.file_url}" class="msg-img" onclick="openLightbox('${m.file_url}')" style="cursor:pointer;">`;
            } else {
                mediaHtml = `<a href="${m.file_url}" target="_blank" class="msg-file">📄 Télécharger le document</a>`;
            }
        }

        return `<div class="message ${isMe ? 'my-msg' : ''}">
            <small><strong>${m.author_name} ${m.author_last_name || ''}</strong> (${m.portal})</small>
            <p style="margin:5px 0 0 0;">${content}</p>
            ${mediaHtml}
            ${isMe ? `<div class="msg-actions">
                <span onclick="editMessage('${m.id}', '${m.content.replace(/'/g, "\\'")}')">Modifier</span>
                <span onclick="confirmDeleteMessage('${m.id}')" style="color:#ef4444;">Supprimer</span>
            </div>` : ''}
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.openLightbox = (url) => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="text-align:right;"><button onclick="closeCustomModal()" class="btn-sm">Fermer X</button></div>
        <img src="${url}" style="max-width:100%; max-height:80vh; border-radius:8px; margin-top:10px; display:block; margin-left:auto; margin-right:auto;">
    `;
};

window.confirmDeleteMessage = (id) => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Supprimer le message ?</h3>
        <p>Cette action est définitive pour tous.</p>
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button onclick="executeDelete('${id}')" class="btn-save" style="background:#ef4444; flex:1;">Supprimer</button>
            <button onclick="closeCustomModal()" class="btn-save" style="background:#64748b; flex:1;">Annuler</button>
        </div>
    `;
};

async function executeDelete(id) {
    await supabaseClient.from('chat_global').delete().eq('id', id);
    closeCustomModal();
    loadChatMessages();
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const editId = document.getElementById('editing-msg-id').value;
    const subject = document.getElementById('chat-subject-filter').value;
    if (!input.value.trim() && !selectedFile) return;

    let fileUrl = null;
    let isImg = false;

    if (selectedFile) {
        const filePath = `chat/${Date.now()}_${selectedFile.name}`;
        isImg = selectedFile.type.startsWith('image/');
        const { data, error } = await supabaseClient.storage.from('documents').upload(filePath, selectedFile);
        if (data) fileUrl = supabaseClient.storage.from('documents').getPublicUrl(filePath).data.publicUrl;
    }

    if (editId) {
        await supabaseClient.from('chat_global').update({ content: input.value }).eq('id', editId);
        document.getElementById('editing-msg-id').value = "";
        document.getElementById('btn-chat-send').innerText = "Envoyer";
    } else {
        let recips = Array.from(document.querySelectorAll('.target-check:checked')).map(c => c.value);
        ENTITIES.forEach(ent => { if(input.value.includes('@' + ent.split(' ')[0])) recips.push(ent); });
        
        await supabaseClient.from('chat_global').insert([{ 
            content: input.value, author_name: currentUser.first_name, author_last_name: currentUser.last_name,
            portal: currentUser.portal, recipients: recips.length > 0 ? [...new Set(recips)] : null, 
            subject: subject, file_url: fileUrl, is_image: isImg
        }]);
    }

    input.value = '';
    selectedFile = null;
    document.getElementById('file-preview').innerText = "";
    document.querySelectorAll('.target-check').forEach(c => c.checked = false);
    loadChatMessages();
};

window.editMessage = (id, oldContent) => {
    document.getElementById('chat-input').value = oldContent;
    document.getElementById('editing-msg-id').value = id;
    document.getElementById('btn-chat-send').innerText = "Mettre à jour";
    document.getElementById('chat-input').focus();
};

function setupChatMentions() {
    const input = document.getElementById('chat-input');
    const suggest = document.getElementById('mention-suggestions');
    if(!input) return;
    input.addEventListener('input', (e) => {
        const val = e.target.value; const lastAt = val.lastIndexOf('@');
        if (lastAt !== -1 && lastAt === val.length - 1) {
            suggest.innerHTML = ENTITIES.map(e => `<div class="mention-item" onclick="insertMention('${e.split(' ')[0]}')">@${e}</div>`).join('');
            suggest.style.display = 'block';
        } else if (!val.includes('@')) { suggest.style.display = 'none'; }
    });
}

window.insertMention = (name) => {
    const input = document.getElementById('chat-input');
    input.value += name + " "; document.getElementById('mention-suggestions').style.display = 'none'; input.focus();
};

function listenChat() { 
    supabaseClient.channel('chat_updates').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_global' }, () => { loadChatMessages(); }).subscribe(); 
}

// ========================== GESTION CRM (BASE DONATEURS) ==========================

async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
    if(currentUser.portal === "Institut Alsatia") {
        const pending = allDonorsData.filter(d => (d.donations || []).some(don => !don.thanked)).length;
        const alertBox = document.getElementById('pending-thanks-alert');
        if(alertBox) alertBox.innerHTML = pending > 0 ? `<div class="thanks-pending">⚠️ ${pending} donateur(s) en attente de remerciement.</div>` : "";
    }
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list'); if (!list) return;
    list.innerHTML = data.map(d => {
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0);
        const hasP = (d.donations || []).some(don => !don.thanked);
        const identity = d.company_name ? `🏢 <strong>${d.company_name}</strong><br><small>${d.last_name} ${d.first_name||''}</small>` : `<strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}`;
        return `<tr class="${hasP ? 'blink-warning' : ''}">
            <td style="padding:15px;">${identity}</td>
            <td>${d.entities || 'Alsatia'}</td>
            <td style="color:var(--gold);"><strong>${total}€</strong></td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Ouvrir</button></td>
        </tr>`;
    }).join('');
}

window.filterDonors = () => {
    const v = document.getElementById('search-donor').value.toLowerCase();
    renderDonorsTable(allDonorsData.filter(d => (d.last_name||"").toLowerCase().includes(v) || (d.company_name||"").toLowerCase().includes(v)));
};

window.openNewDonorModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2>⚜️ Nouveau Donateur</h2>
        <input type="text" id="n-comp" class="luxe-input" placeholder="Entreprise (Optionnel)">
        <input type="text" id="n-lname" class="luxe-input" placeholder="Nom *">
        <input type="text" id="n-fname" class="luxe-input" placeholder="Prénom">
        <div style="margin-top:15px; display:flex; gap:10px;">
            <button onclick="handleNewDonor()" class="btn-save" style="background:var(--gold); flex:1;">Créer</button>
            <button onclick="closeCustomModal()" class="btn-save" style="background:#64748b; flex:1;">Annuler</button>
        </div>`;
};

async function handleNewDonor() {
    const ln = document.getElementById('n-lname').value.trim(); if(!ln) return;
    await supabaseClient.from('donors').insert([{ 
        last_name: ln, first_name: document.getElementById('n-fname').value, 
        company_name: document.getElementById('n-comp').value, entities: currentUser.portal 
    }]);
    closeCustomModal(); loadDonors();
}

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between;"><h3>Fiche : ${d.company_name || d.last_name}</h3><button onclick="closeCustomModal()" class="btn-sm">Fermer</button></div>
        <div style="margin-top:20px; display:grid; grid-template-columns: 1fr 1fr 1fr auto; gap:10px;">
            <input type="number" id="d-amt" placeholder="Montant" class="luxe-input">
            <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
            <input type="text" id="d-receipt" placeholder="N° Reçu" class="luxe-input">
            <button onclick="addDonation('${d.id}')" class="btn-save" style="background:var(--gold);">+</button>
        </div>
        <table style="width:100%; margin-top:20px; font-size:0.85rem;">
            ${(d.donations || []).map(don => `
                <tr style="border-bottom:1px solid #eee;">
                    <td>${don.date}</td><td><strong>${don.amount}€</strong></td>
                    <td><input type="checkbox" ${don.thanked?'checked':''} onchange="updateDonation('${don.id}','thanked',this.checked)"> Merci</td>
                    <td><button onclick="deleteDonation('${don.id}','${d.id}')" style="border:none; color:red; background:none; cursor:pointer;">🗑️</button></td>
                </tr>`).join('')}
        </table>
    `;
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value; if(!amt) return;
    await supabaseClient.from('donations').insert([{ 
        donor_id: id, amount: amt, date: document.getElementById('d-date').value, 
        fiscal_receipt_id: document.getElementById('d-receipt').value, thanked: false 
    }]);
    openDonorFile(id); loadDonors();
};

window.updateDonation = async (donId, field, value) => {
    const upd = {}; upd[field] = value;
    await supabaseClient.from('donations').update(upd).eq('id', donId);
    loadDonors();
};

window.deleteDonation = async (donId, donorId) => {
    await supabaseClient.from('donations').delete().eq('id', donId);
    openDonorFile(donorId); loadDonors();
};

// ========================== CAMPAGNES & ÉVÉNEMENTS (INCHANGÉ) ==========================
async function loadCampaigns() {
    const { data } = await supabaseClient.from('campaigns').select('*').order('created_at', { ascending: false });
    const list = document.getElementById('campaigns-list');
    if(list) list.innerHTML = (data || []).map(c => `<div class="event-card"><h3>${c.name}</h3><p>Objectif : <strong>${c.goal_amount}€</strong></p><small>${c.target_entity}</small></div>`).join('');
}

async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('start_date');
    const list = document.getElementById('events-grid');
    if(list) list.innerHTML = (data || []).map(ev => `<div class="event-card">📅 ${ev.start_date}<h3>${ev.title}</h3><p>${ev.location || ''}</p></div>`).join('');
}

window.openNewCampaignModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2>Nouvelle Campagne</h2>
        <input type="text" id="c-name" class="luxe-input" placeholder="Nom de la campagne">
        <input type="number" id="c-goal" class="luxe-input" placeholder="Objectif €">
        <button onclick="handleNewCampaign()" class="btn-save" style="width:100%; margin-top:15px; background:var(--gold);">Lancer</button>
    `;
};

async function handleNewCampaign() {
    await supabaseClient.from('campaigns').insert([{ 
        name: document.getElementById('c-name').value, 
        goal_amount: document.getElementById('c-goal').value, 
        target_entity: currentUser.portal 
    }]);
    closeCustomModal(); loadCampaigns();
}

window.openNewEventModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2>Nouvel Événement</h2>
        <input type="text" id="ev-title" class="luxe-input" placeholder="Titre">
        <input type="date" id="ev-date" class="luxe-input">
        <button onclick="handleNewEvent()" class="btn-save" style="width:100%; margin-top:15px; background:var(--primary);">Publier</button>
    `;
};

async function handleNewEvent() {
    await supabaseClient.from('events').insert([{ 
        title: document.getElementById('ev-title').value, 
        start_date: document.getElementById('ev-date').value, 
        organizer_entity: currentUser.portal 
    }]);
    closeCustomModal(); loadEvents();
}
