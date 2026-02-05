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

// INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    
    // UI Setup
    document.getElementById('entity-logo-container').innerHTML = `<img src="${LOGOS[currentUser.portal] || 'logo_alsatia.png'}" class="entity-logo">`;
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    
    if (currentUser.portal === "Institut Alsatia") {
        const nav = document.getElementById('main-nav');
        if (!document.getElementById('nav-donors')) {
            const li = document.createElement('li');
            li.id = "nav-donors"; li.innerHTML = `<i data-lucide="users"></i> Base Donateurs`;
            li.onclick = () => switchTab('donors');
            nav.insertBefore(li, nav.children[1]);
        }
    }
    
    lucide.createIcons();
    listenRealtime();
    if(document.getElementById('tab-chat').classList.contains('active')) loadSubjects();
});

// NAVIGATION
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    const navItem = document.getElementById(`nav-${id}`);
    if(navItem) navItem.classList.add('active');
    
    if(id === 'chat') { document.getElementById('chat-badge').style.display = 'none'; loadSubjects(); }
    if(id === 'donors') loadDonors();
    if(id === 'campaigns') loadCampaigns();
    if(id === 'events') loadEvents();
    lucide.createIcons();
};

window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };
window.closeCustomModal = () => { document.getElementById('custom-modal').style.display = 'none'; };

// CHAT FUNCTIONS
window.handleFileUpload = (input) => {
    if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        document.getElementById('file-preview').innerText = "📎 Fichier sélectionné : " + selectedFile.name;
    }
};

window.showNewSubjectModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2>Nouveau Sujet de Discussion</h2>
        <input type="text" id="new-subj-name" class="luxe-input" placeholder="Titre du canal...">
        <div id="subj-perms" style="margin-top:15px;">
            ${Object.keys(LOGOS).map(e => `<label style="display:block; margin:5px 0;"><input type="checkbox" value="${e}" checked> ${e}</label>`).join('')}
        </div>
        <button onclick="execCreateSubject()" class="btn-gold" style="width:100%; margin-top:20px; justify-content:center;">Créer le canal</button>
    `;
};

window.execCreateSubject = async () => {
    const name = document.getElementById('new-subj-name').value;
    const perms = Array.from(document.querySelectorAll('#subj-perms input:checked')).map(i => i.value);
    if(!name) return;
    await supabaseClient.from('chat_subjects').insert([{ name, allowed_entities: perms }]);
    closeCustomModal(); loadSubjects();
};

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name', { ascending: true });
    const filtered = data ? data.filter(s => !s.allowed_entities || s.allowed_entities.includes(currentUser.portal)) : [];
    const select = document.getElementById('chat-subject-filter');
    const oldVal = select.value;
    select.innerHTML = filtered.map(s => `<option value="${s.name}" ${s.name === oldVal ? 'selected' : ''}># ${s.name}</option>`).join('');
    loadChatMessages();
}

async function loadChatMessages() {
    const subj = document.getElementById('chat-subject-filter').value;
    if(!subj) return;
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subj).order('created_at', { ascending: true });
    
    const box = document.getElementById('chat-box');
    const filtered = (data || []).filter(m => {
        if (currentUser.portal === "Institut Alsatia" || m.author_name === currentUser.first_name) return true;
        if (m.recipients && m.recipients.includes(currentUser.portal)) return true;
        return (m.portal === currentUser.portal && (!m.recipients || m.recipients.length === 0));
    });

    box.innerHTML = filtered.map(m => {
        const isMe = m.author_name === currentUser.first_name;
        const logo = LOGOS[m.portal] || 'logo_alsatia.png';
        let media = m.file_url ? (m.is_image ? `<img src="${m.file_url}" style="max-width:200px; display:block; margin-top:10px; border-radius:10px;">` : `<a href="${m.file_url}" target="_blank" style="color:var(--gold); display:block; margin-top:10px;">📄 Document</a>`) : '';
        return `
            <div class="message ${isMe ? 'my-msg' : ''}">
                <div style="display:flex; align-items:center; gap:8px; font-size:0.7rem; opacity:0.8; margin-bottom:5px;">
                    <img src="${logo}" style="width:14px; height:14px; object-fit:contain;"> <b>${m.author_name}</b> • ${m.portal}
                </div>
                <div>${m.content}</div>
                ${media}
                ${isMe ? `<div style="text-align:right;"><span onclick="deleteMsg('${m.id}')" style="cursor:pointer; font-size:0.6rem; opacity:0.5;">Supprimer</span></div>` : ''}
            </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const subj = document.getElementById('chat-subject-filter').value;
    if(!input.value.trim() && !selectedFile) return;

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
    loadChatMessages();
};

window.deleteMsg = async (id) => { if(confirm("Supprimer ?")) { await supabaseClient.from('chat_global').delete().eq('id', id); loadChatMessages(); } };

// CRM FUNCTIONS
async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name', { ascending: true });
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const needsThanks = d.donations?.some(don => !don.thanked);
        return `<tr class="${needsThanks ? 'blink-warning' : ''}">
            <td><b>${(d.company_name || d.last_name).toUpperCase()}</b> ${d.first_name || ''}</td>
            <td><span class="portal-tag" style="color:#666;">${d.origin || '-'}</span></td>
            <td><small>${d.notes ? d.notes.substring(0,40) : '-'}</small></td>
            <td style="color:var(--gold); font-weight:bold;">${total}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-gold" style="padding:6px 12px; font-size:0.8rem;">Gérer</button></td>
        </tr>`;
    }).join('');
}

window.openNewDonorModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2>Ajouter un Donateur</h2>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:20px;">
            <input type="text" id="n-last" class="luxe-input" placeholder="Nom / Entreprise">
            <input type="text" id="n-first" class="luxe-input" placeholder="Prénom (si particulier)">
            <input type="text" id="n-origin" class="luxe-input" placeholder="Origine du contact" style="grid-column: span 2;">
        </div>
        <button onclick="execCreateDonor()" class="btn-gold" style="width:100%; margin-top:20px; justify-content:center;">Enregistrer dans la base</button>
    `;
};

window.execCreateDonor = async () => {
    const last = document.getElementById('n-last').value;
    if(!last) return;
    await supabaseClient.from('donors').insert([{ last_name: last, first_name: document.getElementById('n-first').value, origin: document.getElementById('n-origin').value }]);
    closeCustomModal(); loadDonors();
};

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--gold); padding-bottom:15px;">
            <h2>${d.company_name || d.last_name}</h2>
            <button onclick="closeCustomModal()" class="btn-gold">Fermer</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:20px;">
            <div>
                <label>Email</label><input type="text" id="e-email" value="${d.email||''}" class="luxe-input">
                <label>Téléphone</label><input type="text" id="e-phone" value="${d.phone||''}" class="luxe-input">
                <label>Ville</label><input type="text" id="e-ville" value="${d.city||''}" class="luxe-input">
                <label>Origine</label><input type="text" id="e-origin" value="${d.origin||''}" class="luxe-input">
            </div>
            <div>
                <label>Notes privées</label><textarea id="e-notes" class="luxe-input" style="height:210px;">${d.notes||''}</textarea>
            </div>
        </div>
        <h4 style="margin-top:20px;">Nouveau Don</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr auto; gap:8px;">
            <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
            <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
            <select id="d-mode" class="luxe-input"><option>Chèque</option><option>Virement</option><option>CB</option></select>
            <input type="text" id="d-tax" placeholder="Reçu Fiscal #" class="luxe-input">
            <button onclick="addDonation('${d.id}')" class="btn-gold">+</button>
        </div>
        <div style="margin-top:20px; max-height:150px; overflow-y:auto; border:1px solid #eee;">
            <table style="width:100%; font-size:0.85rem;">
                ${(d.donations||[]).map(don => `<tr><td>${don.date}</td><td><b>${don.amount}€</b></td><td><input type="checkbox" ${don.thanked?'checked':''} onchange="updateDonation('${don.id}','thanked',this.checked)"> Merci</td><td><button onclick="delDon('${don.id}','${d.id}')" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button></td></tr>`).join('')}
            </table>
        </div>
        <button onclick="saveDonor('${d.id}')" class="btn-gold" style="width:100%; margin-top:20px; justify-content:center; background:var(--primary);">Sauvegarder la fiche</button>
    `;
    lucide.createIcons();
};

window.saveDonor = async (id) => {
    await supabaseClient.from('donors').update({
        email: document.getElementById('e-email').value,
        phone: document.getElementById('e-phone').value,
        city: document.getElementById('e-ville').value,
        origin: document.getElementById('e-origin').value,
        notes: document.getElementById('e-notes').value
    }).eq('id', id);
    closeCustomModal(); loadDonors();
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value; if(!amt) return;
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: amt, date: document.getElementById('d-date').value, payment_mode: document.getElementById('d-mode').value, fiscal_receipt_id: document.getElementById('d-tax').value, thanked: false }]);
    openDonorFile(id); loadDonors();
};

window.updateDonation = async (id, f, v) => { let o = {}; o[f] = v; await supabaseClient.from('donations').update(o).eq('id', id); loadDonors(); };
window.delDon = async (did, donorId) => { await supabaseClient.from('donations').delete().eq('id', did); openDonorFile(donorId); loadDonors(); };

window.filterDonors = () => {
    const v = document.getElementById('search-donor').value.toLowerCase();
    const f = allDonorsData.filter(d => (d.last_name||'').toLowerCase().includes(v) || (d.city||'').toLowerCase().includes(v) || (d.origin||'').toLowerCase().includes(v));
    renderDonorsTable(f);
};

// REALTIME
function listenRealtime() {
    supabaseClient.channel('alsatia-v30').on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadChatMessages();
        if (currentUser.portal === "Institut Alsatia") loadDonors();
    }).subscribe();
}

function setupChatMentions() {
    const input = document.getElementById('chat-input');
    if(!input) return;
    input.addEventListener('input', (e) => {
        const lastAt = e.target.value.lastIndexOf('@');
        if (lastAt !== -1 && lastAt === e.target.value.length - 1) { /* Mention logic here if needed */ }
    });
}

async function loadCampaigns() {
    const { data } = await supabaseClient.from('campaigns').select('*');
    document.getElementById('campaigns-list').innerHTML = (data||[]).map(c => `<div class="card" style="background:white; padding:20px; border-radius:15px; border-left:5px solid var(--gold);"><h3>${c.name}</h3></div>`).join('');
}

async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('start_date', { ascending: true });
    document.getElementById('events-grid').innerHTML = (data||[]).map(ev => `<div class="card" style="background:white; padding:20px; border-radius:15px; border-left:5px solid #3b82f6;"><h3>${ev.title}</h3><p>${ev.start_date}</p></div>`).join('');
    lucide.createIcons();
}
