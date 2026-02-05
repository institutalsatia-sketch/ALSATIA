// ==========================================
// CONFIGURATION SUPABASE & ÉTAT GLOBAL
// ==========================================
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let allUsersForMentions = []; 
let selectedFile = null;

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

// ==========================================
// INITIALISATION & INTERFACE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    initInterface();
    listenRealtime();
    loadSubjects();
    loadUsersForMentions();
    setupMentionLogic();
});

function initInterface() {
    const logoContainer = document.getElementById('entity-logo-container');
    if(logoContainer) logoContainer.innerHTML = `<img src="${LOGOS[currentUser.portal] || 'logo_alsatia.png'}" class="entity-logo">`;
    
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;

    // Affichage conditionnel de l'onglet CRM pour l'Institut
    if (currentUser.portal === "Institut Alsatia") {
        const nav = document.getElementById('main-nav');
        if (nav && !document.getElementById('nav-donors')) {
            const li = document.createElement('li');
            li.id = "nav-donors"; li.innerHTML = `<i data-lucide="users"></i> Base Donateurs`;
            li.onclick = () => switchTab('donors');
            nav.insertBefore(li, nav.children[1]);
        }
    }
    lucide.createIcons();
}

window.switchTab = (id) => {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    if(document.getElementById(`nav-${id}`)) document.getElementById(`nav-${id}`).classList.add('active');
    
    if(id === 'donors') loadDonors();
    if(id === 'chat') loadChatMessages();
    lucide.createIcons();
};

window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };
window.closeCustomModal = () => { document.getElementById('custom-modal').style.display = 'none'; };

// ==========================================
// MESSAGERIE & MENTIONS @
// ==========================================

async function loadUsersForMentions() {
    const { data } = await supabaseClient.from('profiles').select('first_name, last_name, portal');
    const entities = ["Institut Alsatia", "Academia Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin"];
    if (data) {
        const users = data.map(u => `${u.first_name} ${u.last_name} (${u.portal})`);
        allUsersForMentions = [...entities, ...users];
    } else {
        allUsersForMentions = entities;
    }
}

function setupMentionLogic() {
    const input = document.getElementById('chat-input');
    const container = document.querySelector('.input-wrapper');
    if(!input || !container) return;

    let suggestList = document.getElementById('mention-suggestions');
    if(!suggestList) {
        suggestList = document.createElement('div');
        suggestList.id = "mention-suggestions";
        suggestList.className = "mention-suggestions-box";
        container.appendChild(suggestList);
    }

    input.addEventListener('input', () => {
        const val = input.value;
        const words = val.split(/\s/);
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith('@')) {
            const query = lastWord.substring(1).toLowerCase();
            const matches = allUsersForMentions.filter(s => s.toLowerCase().includes(query));
            
            if (matches.length > 0) {
                suggestList.innerHTML = matches.map(m => `<div class="suggest-item">${m}</div>`).join('');
                suggestList.style.display = 'block';
                
                document.querySelectorAll('.suggest-item').forEach(item => {
                    item.onclick = () => {
                        words[words.length - 1] = `@${item.innerText} `;
                        input.value = words.join(' ');
                        suggestList.style.display = 'none';
                        input.focus();
                    };
                });
            } else { suggestList.style.display = 'none'; }
        } else { suggestList.style.display = 'none'; }
    });
}

async function loadChatMessages() {
    const subj = document.getElementById('chat-subject-filter').value;
    if(!subj) return;
    
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subj).order('created_at');
    const box = document.getElementById('chat-box');
    
    box.innerHTML = (data || []).map(m => {
        const isMe = m.author_name === currentUser.first_name;
        const fullName = m.author_full_name || m.author_name;
        const content = m.content.replace(/@([\wÀ-ÿ-\s()]+)/g, '<span class="mention-badge">@$1</span>');
        
        return `
            <div class="message ${isMe ? 'my-msg' : ''}">
                <div class="msg-meta" style="font-size:0.7rem; margin-bottom:3px;">
                    <b style="color:var(--gold);">${fullName}</b> <span style="opacity:0.7;"> • ${m.portal}</span>
                </div>
                <div class="msg-body" onclick="${isMe ? `askEditMsg('${m.id}','${m.content.replace(/'/g, "\\'")}')` : ''}">
                    ${content}
                </div>
                ${m.file_url ? `<a href="${m.file_url}" target="_blank" class="file-link">📄 Document</a>` : ''}
                ${isMe ? `<div class="msg-actions"><span onclick="askDeleteMsg('${m.id}')">Supprimer</span></div>` : ''}
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const subj = document.getElementById('chat-subject-filter').value;
    if(!input.value.trim() && !selectedFile) return;

    let fUrl = null;
    if (selectedFile) {
        const path = `chat/${Date.now()}_${selectedFile.name}`;
        const { data } = await supabaseClient.storage.from('documents').upload(path, selectedFile);
        if (data) fUrl = supabaseClient.storage.from('documents').getPublicUrl(path).data.publicUrl;
    }

    await supabaseClient.from('chat_global').insert([{ 
        content: input.value, 
        author_name: currentUser.first_name,
        author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        portal: currentUser.portal, 
        subject: subj, 
        file_url: fUrl 
    }]);

    input.value = ''; selectedFile = null;
    const preview = document.getElementById('file-preview');
    if(preview) preview.innerText = "";
    loadChatMessages();
};

window.askEditMsg = (id, old) => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Modifier le message</h3>
        <textarea id="edit-area" class="luxe-input" style="height:100px;">${old}</textarea>
        <button onclick="execEditMsg('${id}')" class="btn-gold" style="width:100%; margin-top:10px;">SAUVEGARDER</button>
    `;
};

window.execEditMsg = async (id) => {
    const val = document.getElementById('edit-area').value;
    await supabaseClient.from('chat_global').update({ content: val }).eq('id', id);
    closeCustomModal(); loadChatMessages();
};

window.askDeleteMsg = (id) => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Supprimer ?</h3>
        <p>Voulez-vous retirer ce message ?</p>
        <button onclick="execDeleteMsg('${id}')" class="btn-danger" style="width:100%; margin-top:10px;">CONFIRMER</button>
    `;
};

window.execDeleteMsg = async (id) => {
    await supabaseClient.from('chat_global').delete().eq('id', id);
    closeCustomModal(); loadChatMessages();
};

// ==========================================
// GESTION DES SUJETS (CHANNELS)
// ==========================================

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const select = document.getElementById('chat-subject-filter');
    const mySubjects = (data || []).filter(s => s.entity === "Tous" || s.entity === currentUser.portal || !s.entity);
    
    select.innerHTML = mySubjects.map(s => {
        const icon = (s.entity === "Tous") ? "🌍" : "🔒";
        return `<option value="${s.name}">${icon} # ${s.name}</option>`;
    }).join('');
    loadChatMessages();
}

window.showNewSubjectModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Nouveau Salon</h3>
        <label class="mini-label">NOM</label>
        <input type="text" id="n-subject-name" class="luxe-input">
        <label class="mini-label">VISIBILITÉ</label>
        <select id="n-subject-entity" class="luxe-input">
            <option value="Tous">🌍 Public (Tous)</option>
            <option value="${currentUser.portal}">🔒 Privé (${currentUser.portal})</option>
        </select>
        <button onclick="execCreateSubject()" class="btn-gold" style="width:100%; margin-top:10px;">CRÉER</button>
    `;
};

window.execCreateSubject = async () => {
    const name = document.getElementById('n-subject-name').value.trim();
    const entity = document.getElementById('n-subject-entity').value;
    if(!name) return;
    await supabaseClient.from('chat_subjects').insert([{ name, entity }]);
    closeCustomModal(); loadSubjects();
};

window.askDeleteSubject = () => {
    if (currentUser.portal !== "Institut Alsatia") return alert("Admin uniquement.");
    const subj = document.getElementById('chat-subject-filter').value;
    if (subj === "Général") return alert("Suppression impossible.");

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--danger);">Supprimer #${subj} ?</h3>
        <button onclick="execDeleteSubject('${subj}')" class="btn-danger" style="width:100%; margin-top:15px;">CONFIRMER</button>
    `;
};

window.execDeleteSubject = async (name) => {
    await supabaseClient.from('chat_subjects').delete().eq('name', name);
    closeCustomModal(); loadSubjects();
};

// ==========================================
// CRM COMPLET (DONATEURS)
// ==========================================

async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonors(allDonorsData);
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    if(!list) return;
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const needsThanks = d.donations?.some(don => !don.thanked);
        const name = d.company_name ? `<b>${d.company_name}</b><br><small>${d.last_name}</small>` : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name || ''}`;
        return `<tr class="${needsThanks ? 'blink-warning' : ''}">
            <td>${name}</td>
            <td>${d.origin || d.entities || '-'}</td>
            <td><small>${d.notes ? d.notes.substring(0,25) : '-'}</small></td>
            <td style="color:var(--gold); font-weight:bold;">${total}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-gold">Gérer</button></td>
        </tr>`;
    }).join('');
}

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px;">
            <h3>${d.last_name}</h3>
            <button onclick="closeCustomModal()" class="btn-gold">X</button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px;">
            <div>
                <label class="mini-label">Société</label><input type="text" id="e-company" value="${d.company_name||''}" class="luxe-input">
                <label class="mini-label">Nom</label><input type="text" id="e-last" value="${d.last_name||''}" class="luxe-input">
                <label class="mini-label">Email</label><input type="text" id="e-email" value="${d.email||''}" class="luxe-input">
            </div>
            <div>
                <label class="mini-label">Ville</label><input type="text" id="e-city" value="${d.city||''}" class="luxe-input">
                <label class="mini-label">Origine</label><input type="text" id="e-origin" value="${d.origin||''}" class="luxe-input">
                <label class="mini-label">Notes</label><textarea id="e-notes" class="luxe-input">${d.notes||''}</textarea>
            </div>
        </div>
        <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-top:15px;">
            <h4 style="font-size:0.8rem; margin:0 0 10px 0;">NOUVEAU DON</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
                <input type="date" id="d-date" value="${today}" class="luxe-input">
                <input type="text" id="d-tax" placeholder="N° Reçu Fiscal" class="luxe-input">
            </div>
            <button onclick="addDonation('${d.id}')" class="btn-gold" style="width:100%; margin-top:10px;">AJOUTER LE DON</button>
            <div style="margin-top:15px; max-height:100px; overflow-y:auto; font-size:0.75rem;">
                ${(d.donations||[]).sort((a,b) => new Date(b.date)-new Date(a.date)).map(don => `
                    <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #ddd;">
                        <span>${don.date} : <b>${don.amount}€</b> ${don.tax_receipt_number ? `(RF: ${don.tax_receipt_number})` : ''}</span>
                        <span><input type="checkbox" ${don.thanked?'checked':''} onchange="updateThanks('${don.id}','${d.id}',this.checked)"> Merci</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <button onclick="saveDonor('${d.id}')" class="btn-gold" style="width:100%; margin-top:15px; background:var(--primary);">ENREGISTRER FICHE</button>
    `;
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    const date = document.getElementById('d-date').value;
    const tax = document.getElementById('d-tax').value;
    if(!amt || !date) return alert("Champs obligatoires.");
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: parseFloat(amt), date, tax_receipt_number: tax, thanked: false }]);
    openDonorFile(id); loadDonors();
};

window.updateThanks = async (donId, donorId, val) => {
    await supabaseClient.from('donations').update({ thanked: val }).eq('id', donId);
    loadDonors();
};

window.saveDonor = async (id) => {
    const upd = {
        company_name: document.getElementById('e-company').value,
        last_name: document.getElementById('e-last').value,
        email: document.getElementById('e-email').value,
        city: document.getElementById('e-city').value,
        origin: document.getElementById('e-origin').value,
        notes: document.getElementById('e-notes').value
    };
    await supabaseClient.from('donors').update(upd).eq('id', id);
    closeCustomModal(); loadDonors();
};

window.filterDonors = () => {
    const search = document.getElementById('search-donor').value.toLowerCase();
    const entity = document.getElementById('filter-entity').value;
    const filtered = allDonorsData.filter(d => {
        const matchS = (d.last_name||'').toLowerCase().includes(search) || (d.company_name||'').toLowerCase().includes(search);
        const matchE = entity === "ALL" || d.origin === entity;
        return matchS && matchE;
    });
    renderDonors(filtered);
};

window.openNewDonorModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Nouveau Donateur</h3>
        <input type="text" id="n-company" placeholder="Entreprise" class="luxe-input">
        <input type="text" id="n-last" placeholder="Nom *" class="luxe-input">
        <input type="text" id="n-origin" placeholder="Origine" class="luxe-input">
        <button onclick="execCreateDonor()" class="btn-gold" style="width:100%; margin-top:10px;">CRÉER</button>
    `;
};

window.execCreateDonor = async () => {
    const last = document.getElementById('n-last').value;
    if(!last) return alert("Nom requis.");
    await supabaseClient.from('donors').insert([{ last_name: last, company_name: document.getElementById('n-company').value, origin: document.getElementById('n-origin').value }]);
    closeCustomModal(); loadDonors();
};

window.exportAllDonors = () => {
    const data = allDonorsData.map(d => ({
        "Nom": d.last_name, "Entreprise": d.company_name, "Email": d.email, "Ville": d.city, "Origine": d.origin, 
        "Total Dons": d.donations?.reduce((s, n) => s + Number(n.amount), 0)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donateurs");
    XLSX.writeFile(wb, "CRM_Alsatia.xlsx");
};

// ==========================================
// TEMPS RÉEL & FICHIERS
// ==========================================

function listenRealtime() {
    supabaseClient.channel('alsatia-final').on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadChatMessages();
        if(currentUser.portal === "Institut Alsatia") loadDonors();
    }).subscribe();
}

window.handleFileUpload = (input) => { 
    if(input.files[0]) { 
        selectedFile = input.files[0]; 
        document.getElementById('file-preview').innerText = "📎 " + selectedFile.name; 
    } 
};
