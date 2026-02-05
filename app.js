/**
 * PORTAIL ALSATIA - CORE V28 (FINAL PREMIUM)
 * GESTION DYNAMIQUE DES LOGOS + CRM INTÉGRAL
 */
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let selectedFile = null;

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

const ENTITIES = Object.keys(LOGOS);

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    
    // Injection du Logo Dynamique
    const logoContainer = document.getElementById('entity-logo-container');
    const logoFileName = LOGOS[currentUser.portal] || "logo_alsatia.png";
    logoContainer.innerHTML = `<img src="${logoFileName}" alt="Logo" class="entity-logo">`;
    
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    
    // Restriction d'accès CRM (Seul Institut Alsatia)
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
    if(document.getElementById('tab-chat').classList.contains('active')) loadSubjects();
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

// ========================== CHAT & DOCUMENTS ==========================

window.handleFileUpload = (input) => {
    if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        document.getElementById('file-preview').innerText = "📎 Prêt : " + selectedFile.name;
    }
};

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const filtered = data ? data.filter(s => !s.allowed_entities || s.allowed_entities.includes(currentUser.portal)) : [];
    const select = document.getElementById('chat-subject-filter');
    const cur = select.value;
    select.innerHTML = filtered.map(s => `<option value="${s.name}" ${s.name === cur ? 'selected' : ''}># ${s.name}</option>`).join('');
    loadChatMessages();
}

async function loadChatMessages() {
    const subject = document.getElementById('chat-subject-filter').value;
    if(!subject) return;
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subject).order('created_at', { ascending: true });
    
    const box = document.getElementById('chat-box');
    const filtered = data.filter(m => {
        if (currentUser.portal === "Institut Alsatia" || m.author_name === currentUser.first_name) return true;
        if (m.recipients && m.recipients.includes(currentUser.portal)) return true;
        return (m.portal === currentUser.portal && (!m.recipients || m.recipients.length === 0));
    });

    box.innerHTML = filtered.map(m => {
        const isMe = m.author_name === currentUser.first_name;
        const msgLogo = LOGOS[m.portal] || "logo_alsatia.png";
        let media = m.file_url ? (m.is_image ? `<img src="${m.file_url}" class="msg-img" onclick="openLightbox('${m.file_url}')">` : `<a href="${m.file_url}" target="_blank" style="display:block; margin-top:10px; font-weight:bold; color:var(--gold);">📄 Document joint</a>`) : '';

        return `<div class="message ${isMe ? 'my-msg' : ''}">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <img src="${msgLogo}" style="width:18px; height:18px; object-fit:contain;">
                <small><strong>${m.author_name}</strong> • ${m.portal}</small>
            </div>
            <div>${m.content.replace(/@\w+/g, '<b>$&</b>')}</div>
            ${media}
            ${isMe ? `<div style="text-align:right; margin-top:5px;"><span onclick="confirmDel('${m.id}')" style="cursor:pointer; font-size:0.6rem; opacity:0.6;">Supprimer</span></div>` : ''}
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const subj = document.getElementById('chat-subject-filter').value;
    if (!input.value.trim() && !selectedFile) return;

    let fUrl = null, isImg = false;
    if (selectedFile) {
        const path = `chat/${Date.now()}_${selectedFile.name}`;
        isImg = selectedFile.type.startsWith('image/');
        const { data } = await supabaseClient.storage.from('documents').upload(path, selectedFile);
        if (data) fUrl = supabaseClient.storage.from('documents').getPublicUrl(path).data.publicUrl;
    }

    const recips = Array.from(document.querySelectorAll('.target-check:checked')).map(c => c.value);
    await supabaseClient.from('chat_global').insert([{ 
        content: input.value, author_name: currentUser.first_name, portal: currentUser.portal, 
        recipients: recips.length > 0 ? recips : null, subject: subj, file_url: fUrl, is_image: isImg
    }]);

    input.value = ''; selectedFile = null;
    document.getElementById('file-preview').innerText = "";
    document.querySelectorAll('.target-check').forEach(c => c.checked = false);
    loadChatMessages();
};

// ========================== SECTION CRM (SANS SIMPLIFICATION) ==========================

async function loadDonors() {
    if (currentUser.portal !== "Institut Alsatia") return;
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
    
    const pend = allDonorsData.filter(d => d.donations?.some(don => !don.thanked)).length;
    const alertBox = document.getElementById('pending-thanks-alert');
    if(alertBox) alertBox.innerHTML = pend > 0 ? `<div class="thanks-pending">⚠️ ${pend} donateurs attendent un remerciement (Lignes rouges).</div>` : "";
    lucide.createIcons();
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const identity = d.company_name ? `🏢 <b>${d.company_name}</b>` : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name}`;
        return `<tr class="${d.donations?.some(don => !don.thanked) ? 'blink-warning' : ''}">
            <td>${identity}</td>
            <td><span class="portal-tag" style="color:#64748b;">${d.origin || '-'}</span></td>
            <td><small>${d.notes ? d.notes.substring(0, 40) + '...' : '-'}</small></td>
            <td style="color:var(--gold); font-weight:bold;">${total}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-gold" style="padding:8px 15px; font-size:0.75rem;">Ouvrir</button></td>
        </tr>`;
    }).join('');
}

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--gold); padding-bottom:20px;">
            <h2>${d.company_name || (d.first_name + ' ' + d.last_name)}</h2>
            <button onclick="closeCustomModal()" class="btn-gold">Fermer</button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px; margin-top:20px;">
            <div>
                <h4><i data-lucide="info"></i> Informations</h4>
                <label>Origine / Lien</label><input type="text" id="e-origin" value="${d.origin||''}" class="luxe-input">
                <label>Email</label><input type="text" id="e-email" value="${d.email||''}" class="luxe-input">
                <label>Téléphone</label><input type="text" id="e-phone" value="${d.phone||''}" class="luxe-input">
                <label>Adresse</label><input type="text" id="e-addr" value="${d.address||''}" class="luxe-input">
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <input type="text" id="e-cp" value="${d.zip_code||''}" placeholder="CP" class="luxe-input" style="width:80px;">
                    <input type="text" id="e-ville" value="${d.city||''}" placeholder="Ville" class="luxe-input" style="flex:1;">
                </div>
            </div>
            <div>
                <h4><i data-lucide="book-open"></i> Notes privées</h4>
                <textarea id="e-notes" class="luxe-input" style="height:230px; resize:none;">${d.notes||''}</textarea>
            </div>
        </div>
        <h3 style="margin-top:30px; color:var(--gold);">Gestion des Dons</h3>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap:8px; background:#f8fafc; padding:15px; border-radius:15px;">
            <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
            <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
            <select id="d-mode" class="luxe-input"><option>Chèque</option><option>Virement</option><option>CB</option><option>Espèces</option></select>
            <input type="text" id="d-tax" placeholder="N° Reçu Fiscal" class="luxe-input">
            <button onclick="addDonation('${d.id}')" class="btn-gold">+</button>
        </div>
        <div style="margin-top:15px; max-height:180px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:12px;">
            <table style="width:100%; font-size:0.85rem;">
                <thead style="background:#f1f5f9;"><tr><th style="padding:10px;">Date</th><th>Montant</th><th>Remercié</th><th>Actions</th></tr></thead>
                <tbody>
                    ${(d.donations||[]).map(don => `
                        <tr>
                            <td style="padding:10px;">${don.date}</td>
                            <td><b>${don.amount}€</b></td>
                            <td><input type="checkbox" ${don.thanked?'checked':''} onchange="updateDonation('${don.id}','thanked',this.checked)"></td>
                            <td><button onclick="delDon('${don.id}','${d.id}')" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <button onclick="saveDonor('${d.id}')" class="btn-gold" style="width:100%; margin-top:25px; justify-content:center; background:var(--primary);">Mettre à jour la fiche</button>
    `;
    lucide.createIcons();
};

window.saveDonor = async (id) => {
    await supabaseClient.from('donors').update({
        email: document.getElementById('e-email').value,
        phone: document.getElementById('e-phone').value,
        address: document.getElementById('e-addr').value,
        zip_code: document.getElementById('e-cp').value,
        city: document.getElementById('e-ville').value,
        origin: document.getElementById('e-origin').value,
        notes: document.getElementById('e-notes').value
    }).eq('id', id);
    closeCustomModal(); loadDonors();
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{ 
        donor_id: id, amount: amt, date: document.getElementById('d-date').value, 
        payment_mode: document.getElementById('d-mode').value, fiscal_receipt_id: document.getElementById('d-tax').value, thanked: false 
    }]);
    openDonorFile(id); loadDonors();
};

window.updateDonation = async (id, f, v) => {
    let o = {}; o[f] = v;
    await supabaseClient.from('donations').update(o).eq('id', id);
    loadDonors();
};

window.delDon = async (did, donorId) => {
    await supabaseClient.from('donations').delete().eq('id', did);
    openDonorFile(donorId); loadDonors();
};

window.filterDonors = () => {
    const v = document.getElementById('search-donor').value.toLowerCase();
    const filtered = allDonorsData.filter(d => 
        (d.last_name||'').toLowerCase().includes(v) || (d.company_name||'').toLowerCase().includes(v) || (d.city||'').toLowerCase().includes(v) || (d.origin||'').toLowerCase().includes(v)
    );
    renderDonorsTable(filtered);
};

// ========================== TEMPS RÉEL & NOTIFS ==========================

function listenRealtime() {
    supabaseClient.channel('alsatia-realtime').on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        if (payload.table === 'chat_global' && payload.new && payload.new.author_name !== currentUser.first_name) {
            document.getElementById('chat-badge').style.display = 'block';
        }
        loadChatMessages();
        if (currentUser.portal === "Institut Alsatia") loadDonors();
    }).subscribe();
}

function setupChatMentions() {
    const input = document.getElementById('chat-input');
    const suggest = document.getElementById('mention-suggestions');
    if(!input) return;
    input.addEventListener('input', (e) => {
        const lastAt = e.target.value.lastIndexOf('@');
        if (lastAt !== -1 && lastAt === e.target.value.length - 1) {
            suggest.innerHTML = ENTITIES.map(ent => `<div class="mention-item" onclick="insertMention('${ent.split(' ')[0]}')">@${ent}</div>`).join('');
            suggest.style.display = 'block';
        } else { suggest.style.display = 'none'; }
    });
}
window.insertMention = (n) => { document.getElementById('chat-input').value += n + " "; document.getElementById('mention-suggestions').style.display = 'none'; };

async function loadCampaigns() {
    const { data } = await supabaseClient.from('campaigns').select('*');
    document.getElementById('campaigns-list').innerHTML = (data||[]).map(c => `<div class="event-card" style="background:white; padding:20px; border-radius:15px; border-left:5px solid var(--gold);"><h3>${c.name}</h3><p>Objectif : ${c.goal_amount}€</p></div>`).join('');
}

async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('start_date');
    document.getElementById('events-grid').innerHTML = (data||[]).map(ev => `<div class="event-card" style="background:white; padding:20px; border-radius:15px; border-left:5px solid #3b82f6;"><h3>${ev.title}</h3><p>📅 ${ev.start_date}</p></div>`).join('');
    lucide.createIcons();
}
