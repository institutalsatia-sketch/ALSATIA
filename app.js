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
    
    document.getElementById('entity-logo-container').innerHTML = `<img src="${LOGOS[currentUser.portal] || 'logo_alsatia.png'}" class="entity-logo">`;
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;

    // Restriction stricte Institut pour l'onglet CRM
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
    loadSubjects();
});

// NAVIGATION : Nettoyage propre de la page
window.switchTab = (id) => {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`tab-${id}`).classList.add('active');
    const navItem = document.getElementById(`nav-${id}`);
    if(navItem) navItem.classList.add('active');
    
    if(id === 'donors') loadDonors();
    if(id === 'chat') { document.getElementById('chat-badge').style.display = 'none'; loadChatMessages(); }
    if(id === 'campaigns') loadCampaigns();
    if(id === 'events') loadEvents();
    lucide.createIcons();
};

window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };
window.closeCustomModal = () => { document.getElementById('custom-modal').style.display = 'none'; };

// ========================== GESTION CRM (DONATEURS) ==========================

async function loadDonors() {
    if (currentUser.portal !== "Institut Alsatia") return;
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name', { ascending: true });
    allDonorsData = data || [];
    renderDonors(allDonorsData);
    
    const pend = allDonorsData.filter(d => d.donations?.some(don => !don.thanked)).length;
    document.getElementById('pending-thanks-alert').innerHTML = pend > 0 ? `<div style="background:var(--danger); color:white; padding:10px; border-radius:10px; margin-bottom:15px; font-weight:bold;">⚠️ ${pend} donateur(s) à remercier</div>` : "";
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const needsThanks = d.donations?.some(don => !don.thanked);
        return `<tr class="${needsThanks ? 'blink-warning' : ''}">
            <td><b>${(d.company_name || d.last_name).toUpperCase()}</b> ${d.first_name || ''}</td>
            <td><span class="portal-tag" style="background:#eee; color:#333; opacity:1;">${d.origin || '-'}</span></td>
            <td><small>${d.notes ? d.notes.substring(0,30) + '...' : '-'}</small></td>
            <td style="color:var(--gold); font-weight:800;">${total}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-gold" style="padding:6px 12px; font-size:0.8rem;">Gérer</button></td>
        </tr>`;
    }).join('');
}

window.openNewDonorModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2 style="color:var(--primary);">Nouveau Profil Donateur</h2>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:20px;">
            <input type="text" id="n-last" class="luxe-input" placeholder="Nom de famille / Entreprise">
            <input type="text" id="n-first" class="luxe-input" placeholder="Prénom">
            <input type="text" id="n-origin" class="luxe-input" placeholder="Lien d'origine (ex: Gala, Ami...)" style="grid-column: span 2;">
        </div>
        <button onclick="execCreateDonor()" class="btn-gold" style="width:100%; margin-top:20px; justify-content:center;">Enregistrer</button>
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
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:15px;">
            <h2 style="margin:0;">${d.company_name || d.last_name}</h2>
            <button onclick="closeCustomModal()" class="btn-gold">Fermer</button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:25px; margin-top:25px;">
            <div>
                <label>Email</label><input type="text" id="e-email" value="${d.email||''}" class="luxe-input">
                <label>Tél</label><input type="text" id="e-phone" value="${d.phone||''}" class="luxe-input">
                <label>Adresse</label><input type="text" id="e-addr" value="${d.address||''}" class="luxe-input">
                <div style="display:flex; gap:10px; margin-top:5px;">
                    <input type="text" id="e-cp" value="${d.zip_code||''}" placeholder="CP" class="luxe-input" style="width:80px;">
                    <input type="text" id="e-ville" value="${d.city||''}" placeholder="Ville" class="luxe-input" style="flex:1;">
                </div>
            </div>
            <div>
                <label>Lien / Origine</label><input type="text" id="e-origin" value="${d.origin||''}" class="luxe-input">
                <label>Notes Privées</label><textarea id="e-notes" class="luxe-input" style="height:150px; resize:none;">${d.notes||''}</textarea>
            </div>
        </div>
        <h3 style="margin-top:30px; color:var(--gold);">Dons Enregistrés</h3>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap:8px; background:#f1f5f9; padding:15px; border-radius:15px;">
            <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
            <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
            <select id="d-mode" class="luxe-input"><option>Chèque</option><option>Virement</option><option>Espèces</option></select>
            <input type="text" id="d-tax" placeholder="N° Reçu Fiscal" class="luxe-input">
            <button onclick="addDonation('${d.id}')" class="btn-gold">+</button>
        </div>
        <div style="margin-top:15px; max-height:150px; overflow-y:auto;">
            <table style="width:100%; font-size:0.85rem;">
                ${(d.donations||[]).map(don => `
                    <tr>
                        <td>${don.date}</td><td><b>${don.amount}€</b></td>
                        <td><input type="checkbox" ${don.thanked?'checked':''} onchange="updateDonation('${don.id}','thanked',this.checked)"> Merci envoyé</td>
                        <td><button onclick="delDon('${don.id}','${d.id}')" style="color:var(--danger); border:none; background:none; cursor:pointer;">🗑️</button></td>
                    </tr>
                `).join('')}
            </table>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <button onclick="saveDonor('${d.id}')" class="btn-gold" style="width:100%; margin-top:30px; justify-content:center; background:var(--primary);">Sauvegarder les modifications</button>
            <button onclick="deleteFullDonor('${d.id}')" class="btn-danger">Supprimer définitivement la fiche</button>
        </div>
    `;
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

window.deleteFullDonor = async (id) => {
    if(confirm("Confirmer la suppression totale du donateur et de ses dons ?")) {
        await supabaseClient.from('donors').delete().eq('id', id);
        closeCustomModal(); loadDonors();
    }
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

window.updateDonation = async (id, field, val) => {
    let o = {}; o[field] = val;
    await supabaseClient.from('donations').update(o).eq('id', id);
    loadDonors();
};

window.delDon = async (did, donorId) => {
    await supabaseClient.from('donations').delete().eq('id', did);
    openDonorFile(donorId); loadDonors();
};

window.filterDonors = () => {
    const v = document.getElementById('search-donor').value.toLowerCase();
    const f = allDonorsData.filter(d => 
        (d.last_name||'').toLowerCase().includes(v) || (d.city||'').toLowerCase().includes(v) || (d.origin||'').toLowerCase().includes(v)
    );
    renderDonors(f);
};

// ========================== GESTION CHAT & DOCUMENTS ==========================

window.handleFileUpload = (input) => {
    if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        document.getElementById('file-preview').innerText = "📎 Fichier : " + selectedFile.name;
    }
};

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name', { ascending: true });
    const filtered = data ? data.filter(s => !s.allowed_entities || s.allowed_entities.includes(currentUser.portal)) : [];
    const select = document.getElementById('chat-subject-filter');
    const old = select.value;
    select.innerHTML = filtered.map(s => `<option value="${s.name}" ${s.name === old ? 'selected' : ''}># ${s.name}</option>`).join('');
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
        const logo = LOGOS[m.portal] || "logo_alsatia.png";
        let media = m.file_url ? (m.is_image ? `<img src="${m.file_url}" style="max-width:250px; border-radius:10px; margin-top:10px; display:block;">` : `<a href="${m.file_url}" target="_blank" style="color:var(--gold); display:block; margin-top:10px;">📄 Voir le document</a>`) : '';

        return `<div class="message ${isMe ? 'my-msg' : ''}">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.65rem; opacity:0.8; margin-bottom:5px;">
                <img src="${logo}" style="width:14px; height:14px; object-fit:contain;">
                <b>${m.author_name}</b> • ${m.portal}
            </div>
            <div style="cursor:pointer" onclick="${isMe ? `editMsg('${m.id}','${m.content.replace(/'/g, "\\'")}')` : ''}">${m.content}</div>
            ${media}
            ${isMe ? `<div style="text-align:right;"><span onclick="deleteMsg('${m.id}')" style="cursor:pointer; font-size:0.6rem; opacity:0.5;">Supprimer</span></div>` : ''}
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
    loadChatMessages();
};

window.deleteMsg = async (id) => { if(confirm("Supprimer ce message ?")) { await supabaseClient.from('chat_global').delete().eq('id', id); loadChatMessages(); } };

window.editMsg = async (id, old) => {
    const n = prompt("Modifier le message :", old);
    if(n && n !== old) { await supabaseClient.from('chat_global').update({ content: n }).eq('id', id); loadChatMessages(); }
};

window.showNewSubjectModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2>Créer un Canal</h2>
        <input type="text" id="new-subj-name" class="luxe-input" placeholder="Nom (ex: Conseil d'Administration)">
        <div style="margin-top:20px;">
            <p>Accès autorisé pour :</p>
            ${Object.keys(LOGOS).map(e => `<label style="display:block; margin:5px 0;"><input type="checkbox" class="subj-perm" value="${e}" checked> ${e}</label>`).join('')}
        </div>
        <button onclick="execCreateSubject()" class="btn-gold" style="width:100%; margin-top:20px; justify-content:center;">Lancer le sujet</button>
    `;
};

window.execCreateSubject = async () => {
    const name = document.getElementById('new-subj-name').value;
    const perms = Array.from(document.querySelectorAll('.subj-perm:checked')).map(p => p.value);
    if(!name) return;
    await supabaseClient.from('chat_subjects').insert([{ name, allowed_entities: perms }]);
    closeCustomModal(); loadSubjects();
};

window.deleteCurrentSubject = async () => {
    const subj = document.getElementById('chat-subject-filter').value;
    if(subj === 'Général') return alert("Le sujet Général ne peut être supprimé.");
    if(confirm(`Supprimer le sujet #${subj} et TOUS ses messages ?`)) {
        await supabaseClient.from('chat_subjects').delete().eq('name', subj);
        await supabaseClient.from('chat_global').delete().eq('subject', subj);
        loadSubjects();
    }
};

// REALTIME
function listenRealtime() {
    supabaseClient.channel('alsatia-v33').on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        if (payload.table === 'chat_global') {
            if(payload.new && payload.new.author_name !== currentUser.first_name) document.getElementById('chat-badge').style.display = 'block';
            loadChatMessages();
        }
        if (payload.table === 'donors') loadDonors();
    }).subscribe();
}

async function loadCampaigns() {
    const { data } = await supabaseClient.from('campaigns').select('*');
    document.getElementById('campaigns-list').innerHTML = (data||[]).map(c => `<div class="card" style="background:white; padding:20px; border-radius:15px; border-left:5px solid var(--gold); margin-bottom:10px;"><h3>${c.name}</h3></div>`).join('');
}

async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('start_date', { ascending: true });
    document.getElementById('events-grid').innerHTML = (data||[]).map(ev => `<div class="card" style="background:white; padding:20px; border-radius:15px; border-left:5px solid #3b82f6; margin-bottom:10px;"><h3>${ev.title}</h3><p>${ev.start_date}</p></div>`).join('');
    lucide.createIcons();
}
