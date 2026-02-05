/**
 * PORTAIL ALSATIA - CORE V25
 * CRM (Institut uniquement) + Chat Multidiffusion + Sujets Privés + Notes & Origines
 */
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let selectedFile = null;
const ENTITIES = ["Institut Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin", "Academia Alsatia"];

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    
    // Affichage des infos utilisateur
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    
    // RESTRICTION CRM : Seul l'Institut voit l'onglet Donateurs
    if (currentUser.portal === "Institut Alsatia") {
        const nav = document.getElementById('main-nav');
        if (!document.getElementById('nav-donors')) {
            const crmTab = document.createElement('li');
            crmTab.id = "nav-donors";
            crmTab.innerHTML = `<i data-lucide="users"></i> Base Donateurs`;
            crmTab.onclick = () => switchTab('donors');
            nav.insertBefore(crmTab, nav.children[1]);
        }
    }
    
    lucide.createIcons();
    setupChatMentions(); 
    listenRealtime();
    if(document.getElementById('tab-chat').classList.contains('active')) {
        loadSubjects();
    }
});

// --- NAVIGATION ---
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
    
    if(id === 'chat') { 
        document.getElementById('chat-badge').style.display = 'none';
        loadSubjects();
    }
    if(id === 'donors') loadDonors();
    if(id === 'campaigns') loadCampaigns();
    if(id === 'events') loadEvents();
    
    lucide.createIcons();
};

window.closeCustomModal = () => { document.getElementById('custom-modal').style.display = 'none'; };
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

// ========================== SECTION CHAT & DOCUMENTS ==========================

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const filtered = data ? data.filter(s => !s.allowed_entities || s.allowed_entities.includes(currentUser.portal)) : [];
    const select = document.getElementById('chat-subject-filter');
    const currentVal = select.value;
    select.innerHTML = filtered.map(s => `<option value="${s.name}" ${s.name === currentVal ? 'selected' : ''}># ${s.name}</option>`).join('');
    loadChatMessages();
}

window.showNewSubjectModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2 style="color:var(--primary);">Nouveau Sujet de Discussion</h2>
        <input type="text" id="new-subject-name" class="luxe-input" placeholder="Nom du sujet (ex: Travaux Été)">
        <p style="font-size:0.8rem; margin:15px 0 5px; color:#64748b;">Autoriser l'accès à :</p>
        <div id="subject-perms" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            ${ENTITIES.map(e => `<label style="font-size:0.85rem;"><input type="checkbox" value="${e}" checked> ${e}</label>`).join('')}
        </div>
        <div style="margin-top:25px; display:flex; gap:10px;">
            <button onclick="handleCreateSubject()" class="btn-gold" style="flex:1; justify-content:center;">Créer</button>
            <button onclick="closeCustomModal()" class="btn-sm" style="flex:1;">Annuler</button>
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

async function loadChatMessages() {
    const subject = document.getElementById('chat-subject-filter').value;
    if(!subject) return;
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subject).order('created_at', { ascending: true });
    const box = document.getElementById('chat-box');
    if (!box || !data) return;

    const filtered = data.filter(m => {
        if (currentUser.portal === "Institut Alsatia" || m.author_name === currentUser.first_name) return true;
        if (m.recipients && m.recipients.includes(currentUser.portal)) return true;
        if (m.portal === currentUser.portal && (!m.recipients || m.recipients.length === 0)) return true;
        return false;
    });

    box.innerHTML = filtered.map(m => {
        const isMe = m.author_name === currentUser.first_name && m.author_last_name === currentUser.last_name;
        const content = m.content.replace(/@\w+/g, '<span style="color:var(--gold); font-weight:bold;">$&</span>');
        let mediaHtml = m.file_url ? (m.is_image ? `<img src="${m.file_url}" class="msg-img" onclick="openLightbox('${m.file_url}')">` : `<a href="${m.file_url}" target="_blank" class="msg-file">📄 Document</a>`) : '';

        return `<div class="message ${isMe ? 'my-msg' : ''}">
            <small><strong>${m.author_name}</strong> (${m.portal})</small>
            <div style="margin-top:5px;">${content}</div>
            ${mediaHtml}
            ${isMe ? `<div class="msg-actions">
                <span onclick="confirmDeleteMessage('${m.id}')" style="color:red; cursor:pointer;">Supprimer</span>
            </div>` : ''}
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const subject = document.getElementById('chat-subject-filter').value;
    if (!input.value.trim() && !selectedFile) return;

    let fileUrl = null, isImg = false;
    if (selectedFile) {
        const path = `chat/${Date.now()}_${selectedFile.name}`;
        isImg = selectedFile.type.startsWith('image/');
        const { data } = await supabaseClient.storage.from('documents').upload(path, selectedFile);
        if (data) fileUrl = supabaseClient.storage.from('documents').getPublicUrl(path).data.publicUrl;
    }

    const recips = Array.from(document.querySelectorAll('.target-check:checked')).map(c => c.value);
    
    await supabaseClient.from('chat_global').insert([{ 
        content: input.value, author_name: currentUser.first_name, author_last_name: currentUser.last_name,
        portal: currentUser.portal, recipients: recips.length > 0 ? recips : null, 
        subject: subject, file_url: fileUrl, is_image: isImg
    }]);

    input.value = ''; selectedFile = null;
    document.getElementById('file-preview').innerText = "";
    document.querySelectorAll('.target-check').forEach(c => c.checked = false);
};

window.openLightbox = (url) => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <img src="${url}" style="width:100%; border-radius:15px; box-shadow:0 20px 50px rgba(0,0,0,0.3);">
        <button onclick="closeCustomModal()" class="btn-gold" style="width:100%; margin-top:20px; justify-content:center;">Fermer le plein écran</button>
    `;
};

window.confirmDeleteMessage = (id) => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:#ef4444;">Supprimer ce message ?</h3>
        <p>Cette action est irréversible pour tous les participants.</p>
        <div style="margin-top:25px; display:flex; gap:10px;">
            <button onclick="executeDelete('${id}')" class="btn-gold" style="background:#ef4444; flex:1; justify-content:center;">Confirmer</button>
            <button onclick="closeCustomModal()" class="btn-sm" style="flex:1;">Annuler</button>
        </div>
    `;
};

async function executeDelete(id) {
    await supabaseClient.from('chat_global').delete().eq('id', id);
    closeCustomModal();
    loadChatMessages();
}

// ========================== SECTION CRM (BASE DONATEURS) ==========================

async function loadDonors() {
    if (currentUser.portal !== "Institut Alsatia") return;
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
    
    const pend = allDonorsData.filter(d => d.donations?.some(don => !don.thanked)).length;
    const alertBox = document.getElementById('pending-thanks-alert');
    if(alertBox) alertBox.innerHTML = pend > 0 ? `<div class="thanks-pending"><i data-lucide="alert-triangle"></i> ${pend} donateurs en attente de remerciement</div>` : "";
    lucide.createIcons();
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const hasP = d.donations?.some(don => !don.thanked);
        const nameDisplay = d.company_name ? `🏢 <strong>${d.company_name}</strong><br><small>${d.last_name} ${d.first_name}</small>` : `<strong>${d.last_name.toUpperCase()}</strong> ${d.first_name}`;
        
        return `<tr class="${hasP ? 'blink-warning' : ''}">
            <td>${nameDisplay}</td>
            <td><span class="portal-tag" style="border-color:#cbd5e1; color:#64748b;">${d.origin || 'Source inconnue'}</span></td>
            <td><small>${d.notes ? d.notes.substring(0, 30) + '...' : '-'}</small></td>
            <td style="color:var(--gold); font-weight:bold;">${total}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm"><i data-lucide="edit-3" style="width:14px;"></i> Gérer</button></td>
        </tr>`;
    }).join('');
    lucide.createIcons();
}

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:15px;">
            <h2>Fiche : ${d.company_name || d.last_name}</h2>
            <button onclick="closeCustomModal()" class="btn-sm">Fermer</button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-top:20px;">
            <div>
                <label style="font-size:0.8rem; font-weight:bold;">Origine du donateur / Lien</label>
                <input type="text" id="e-origin" value="${d.origin||''}" class="luxe-input" placeholder="Ex: Site web, Relation, Événement...">
                
                <label style="margin-top:15px; display:block; font-size:0.8rem; font-weight:bold;">Coordonnées</label>
                <input type="text" id="e-email" value="${d.email||''}" class="luxe-input" placeholder="Email">
                <input type="text" id="e-phone" value="${d.phone||''}" class="luxe-input" placeholder="Téléphone" style="margin-top:5px;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:bold;">Notes privées & Historique relationnel</label>
                <textarea id="e-notes" class="luxe-input" style="height:120px; width:100%; resize:none; font-family:inherit;">${d.notes||''}</textarea>
            </div>
        </div>

        <h3 style="margin-top:30px; border-top:1px solid #eee; padding-top:20px; color:var(--gold);">Enregistrer un Don</h3>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap:5px;">
            <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
            <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
            <select id="d-mode" class="luxe-input">
                <option>Chèque</option><option>Virement</option><option>Espèces</option><option>CB</option>
            </select>
            <input type="text" id="d-tax" placeholder="Reçu Fiscal" class="luxe-input">
            <button onclick="addDonation('${d.id}')" class="btn-gold" style="justify-content:center;">+</button>
        </div>

        <div style="margin-top:20px; max-height:180px; overflow-y:auto; border:1px solid #f1f5f9; border-radius:10px;">
            <table style="width:100%; font-size:0.85rem;">
                <thead style="background:#f8fafc;">
                    <tr><th style="padding:10px;">Date</th><th>Montant</th><th>Remercié</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${(d.donations || []).map(don => `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:10px;">${don.date}</td>
                            <td><strong>${don.amount}€</strong></td>
                            <td><input type="checkbox" ${don.thanked?'checked':''} onchange="updateDonation('${don.id}','thanked',this.checked)"></td>
                            <td><button onclick="deleteDonation('${don.id}','${d.id}')" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button></td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <button onclick="saveDonor('${d.id}')" class="btn-gold" style="width:100%; margin-top:25px; justify-content:center; background:var(--primary);">Sauvegarder la fiche</button>
    `;
};

window.saveDonor = async (id) => {
    await supabaseClient.from('donors').update({
        origin: document.getElementById('e-origin').value,
        notes: document.getElementById('e-notes').value,
        email: document.getElementById('e-email').value,
        phone: document.getElementById('e-phone').value
    }).eq('id', id);
    closeCustomModal();
    loadDonors();
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value; if(!amt) return;
    await supabaseClient.from('donations').insert([{ 
        donor_id: id, amount: amt, date: document.getElementById('d-date').value, 
        payment_mode: document.getElementById('d-mode').value, fiscal_receipt_id: document.getElementById('d-tax').value, thanked: false 
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

window.filterDonors = () => {
    const v = document.getElementById('search-donor').value.toLowerCase();
    const filtered = allDonorsData.filter(d => 
        (d.last_name||"").toLowerCase().includes(v) || 
        (d.company_name||"").toLowerCase().includes(v) ||
        (d.city||"").toLowerCase().includes(v) ||
        (d.origin||"").toLowerCase().includes(v)
    );
    renderDonorsTable(filtered);
};

// ========================== GESTION TEMPS RÉEL & NOTIFICATIONS ==========================

function listenRealtime() {
    // Écoute des nouveaux messages pour le badge notification
    supabaseClient.channel('chat_notif')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global' }, (p) => {
        if (p.new.author_name !== currentUser.first_name) {
            const badge = document.getElementById('chat-badge');
            if (badge) badge.style.display = 'inline-block';
        }
        if (document.getElementById('tab-chat').classList.contains('active')) {
            loadChatMessages();
        }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'donors' }, () => {
        if (currentUser.portal === "Institut Alsatia") loadDonors();
    })
    .subscribe();
}

function setupChatMentions() {
    const input = document.getElementById('chat-input');
    const suggest = document.getElementById('mention-suggestions');
    if(!input) return;
    input.addEventListener('input', (e) => {
        const val = e.target.value; const lastAt = val.lastIndexOf('@');
        if (lastAt !== -1 && lastAt === val.length - 1) {
            suggest.innerHTML = ENTITIES.map(ent => `<div class="mention-item" onclick="insertMention('${ent.split(' ')[0]}')">@${ent}</div>`).join('');
            suggest.style.display = 'block';
        } else if (!val.includes('@')) { suggest.style.display = 'none'; }
    });
}

window.insertMention = (name) => {
    const input = document.getElementById('chat-input');
    input.value += name + " "; 
    document.getElementById('mention-suggestions').style.display = 'none'; 
    input.focus();
};

// ========================== CAMPAGNES & ÉVÉNEMENTS ==========================

async function loadCampaigns() {
    const { data } = await supabaseClient.from('campaigns').select('*').order('created_at', { ascending: false });
    const list = document.getElementById('campaigns-list');
    list.innerHTML = (data || []).map(c => `
        <div class="event-card" style="background:white; padding:20px; border-radius:12px; border-left:4px solid var(--gold);">
            <h3 style="margin-top:0;">${c.name}</h3>
            <p style="color:#64748b;">Cible : ${c.target_entity}</p>
            <div style="font-size:1.2rem; font-weight:bold; color:var(--primary);">Objectif : ${c.goal_amount}€</div>
        </div>`).join('');
}

async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('start_date');
    const grid = document.getElementById('events-grid');
    grid.innerHTML = (data || []).map(ev => `
        <div class="event-card" style="background:white; padding:20px; border-radius:12px; border-left:4px solid var(--accent);">
            <div style="color:var(--accent); font-weight:bold; font-size:0.8rem;">📅 ${ev.start_date}</div>
            <h3 style="margin:10px 0;">${ev.title}</h3>
            <p style="margin:0; font-size:0.9rem; color:#64748b;"><i data-lucide="map-pin" style="width:14px;"></i> ${ev.location || 'Lieu à définir'}</p>
        </div>`).join('');
    lucide.createIcons();
}
