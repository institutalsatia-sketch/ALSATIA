// CONFIGURATION SUPABASE
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ETAT GLOBAL
let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let selectedFile = null;

const SUGGESTIONS = [
    "Institut Alsatia", "Academia Alsatia", "Cours Herrade de Landsberg", 
    "Collège Saints Louis et Zélie Martin", "Direction", "Secrétariat", "Comptabilité"
];

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

// INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    
    initInterface();
    listenRealtime();
    loadSubjects();
    setupMentionLogic();
});

function initInterface() {
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

// ========================== GESTION DES SUJETS (CHANNELS) ==========================

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const select = document.getElementById('chat-subject-filter');
    
    // Filtrage : Sujets de mon entité OU sujets publics ("Tous")
    const mySubjects = (data || []).filter(s => 
        s.entity === currentUser.portal || s.entity === "Tous" || !s.entity
    );

    select.innerHTML = mySubjects.map(s => `<option value="${s.name}"># ${s.name}</option>`).join('');
    loadChatMessages();
}

window.showNewSubjectModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Nouveau Sujet</h3>
        <input type="text" id="n-subject-name" placeholder="Nom du salon..." class="luxe-input">
        <label class="mini-label">Confidentialité :</label>
        <select id="n-subject-entity" class="luxe-input">
            <option value="${currentUser.portal}">Privé (${currentUser.portal})</option>
            <option value="Tous">Public (Toutes les entités)</option>
        </select>
        <button onclick="execCreateSubject()" class="btn-gold" style="width:100%; margin-top:10px;">Créer</button>
    `;
};

window.execCreateSubject = async () => {
    const name = document.getElementById('n-subject-name').value.trim();
    const entity = document.getElementById('n-subject-entity').value;
    if(!name) return;
    const { error } = await supabaseClient.from('chat_subjects').insert([{ name, entity }]);
    if(!error) { closeCustomModal(); loadSubjects(); }
};

window.askDeleteSubject = () => {
    if (currentUser.portal !== "Institut Alsatia") return alert("Droits insuffisants.");
    const subj = document.getElementById('chat-subject-filter').value;
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Supprimer #${subj} ?</h3>
        <button onclick="execDeleteSubject('${subj}')" class="btn-danger" style="width:100%">Confirmer</button>
    `;
};

window.execDeleteSubject = async (name) => {
    await supabaseClient.from('chat_subjects').delete().eq('name', name);
    closeCustomModal(); loadSubjects();
};

// ========================== MESSAGERIE & MENTIONS @ ==========================

function setupMentionLogic() {
    const input = document.getElementById('chat-input');
    const container = document.querySelector('.input-wrapper');
    if(!input) return;

    const suggestList = document.createElement('div');
    suggestList.id = "mention-suggestions";
    suggestList.className = "mention-suggestions-box";
    container.appendChild(suggestList);

    input.addEventListener('keyup', (e) => {
        const val = e.target.value;
        const words = val.split(' ');
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith('@')) {
            const query = lastWord.substring(1).toLowerCase();
            const matches = SUGGESTIONS.filter(s => s.toLowerCase().includes(query));
            
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
        const content = m.content.replace(/@([\wÀ-ÿ-\s]+)/g, '<span class="mention-badge">@$1</span>');
        
        return `
            <div class="message ${isMe ? 'my-msg' : ''}">
                <div style="font-size:0.6rem; opacity:0.7;"><b>${m.author_name}</b> • ${m.portal}</div>
                <div class="msg-body" onclick="${isMe ? `askEditMsg('${m.id}','${m.content.replace(/'/g, "\\'")}')` : ''}">${content}</div>
                ${m.file_url ? `<a href="${m.file_url}" target="_blank" class="file-link">📄 Fichier</a>` : ''}
                ${isMe ? `<div style="text-align:right"><span class="delete-link" onclick="askDeleteMsg('${m.id}')">Supprimer</span></div>` : ''}
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

    const { error } = await supabaseClient.from('chat_global').insert([{
        content: input.value, author_name: currentUser.first_name,
        portal: currentUser.portal, subject: subj, file_url: fUrl
    }]);

    if(!error) { input.value = ''; selectedFile = null; document.getElementById('file-preview').innerText = ""; loadChatMessages(); }
};

window.askEditMsg = (id, old) => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Modifier le message</h3>
        <textarea id="edit-area" class="luxe-input" style="height:100px;">${old}</textarea>
        <button onclick="execEditMsg('${id}')" class="btn-gold" style="width:100%">Sauver</button>
    `;
};

window.execEditMsg = async (id) => {
    const content = document.getElementById('edit-area').value;
    await supabaseClient.from('chat_global').update({ content }).eq(id, id); // id: id correction
    closeCustomModal(); loadChatMessages();
};

window.askDeleteMsg = (id) => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Supprimer ?</h3>
        <button onclick="execDeleteMsg('${id}')" class="btn-danger" style="width:100%">Confirmer</button>
    `;
};

window.execDeleteMsg = async (id) => {
    await supabaseClient.from('chat_global').delete().eq('id', id);
    closeCustomModal(); loadChatMessages();
};

// ========================== CRM (INSTITUT ALSATIA) ==========================

async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonors(allDonorsData);
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const needsThanks = d.donations?.some(don => !don.thanked);
        return `<tr class="${needsThanks ? 'blink-warning' : ''}">
            <td><b>${(d.company_name || d.last_name).toUpperCase()}</b></td>
            <td>${d.origin || '-'}</td>
            <td><small>${d.notes ? d.notes.substring(0,25) : '-'}</small></td>
            <td style="color:var(--gold); font-weight:bold;">${total}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-gold">Gérer</button></td>
        </tr>`;
    }).join('');
}

window.filterDonors = () => {
    const search = document.getElementById('search-donor').value.toLowerCase();
    const entity = document.getElementById('filter-entity').value;
    const filtered = allDonorsData.filter(d => {
        const matchSearch = (d.last_name||'').toLowerCase().includes(search) || (d.city||'').toLowerCase().includes(search);
        const matchEntity = entity === "ALL" || d.origin === entity;
        return matchSearch && matchEntity;
    });
    renderDonors(filtered);
};

window.exportAllDonors = () => {
    const exportData = allDonorsData.map(d => ({
        "Identité": d.company_name || d.last_name, "Email": d.email, "Ville": d.city,
        "Total Dons": d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donateurs");
    XLSX.writeFile(wb, "Alsatia_Donateurs.xlsx");
};

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #ddd; padding-bottom:10px;">
            <h2>${d.last_name}</h2>
            <button onclick="closeCustomModal()" class="btn-gold">X</button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:15px;">
            <div>
                <label class="mini-label">Email</label><input type="text" id="e-email" value="${d.email||''}" class="luxe-input">
                <label class="mini-label">Ville</label><input type="text" id="e-ville" value="${d.city||''}" class="luxe-input">
            </div>
            <div>
                <label class="mini-label">Origine</label><input type="text" id="e-origin" value="${d.origin||''}" class="luxe-input">
                <label class="mini-label">Notes</label><textarea id="e-notes" class="luxe-input">${d.notes||''}</textarea>
            </div>
        </div>
        <h4 style="margin-top:20px;">Ajouter un don</h4>
        <div style="display:flex; gap:5px;">
            <input type="number" id="d-amt" placeholder="Montant" class="luxe-input">
            <button onclick="addDonation('${d.id}')" class="btn-gold">+</button>
        </div>
        <button onclick="saveDonor('${d.id}')" class="btn-gold" style="width:100%; margin-top:15px;">Sauvegarder</button>
    `;
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: parseFloat(amt), date: new Date().toISOString().split('T')[0], thanked: false }]);
    openDonorFile(id); loadDonors();
};

window.saveDonor = async (id) => {
    const updateData = {
        email: document.getElementById('e-email').value,
        city: document.getElementById('e-ville').value,
        origin: document.getElementById('e-origin').value,
        notes: document.getElementById('e-notes').value
    };
    await supabaseClient.from('donors').update(updateData).eq('id', id);
    closeCustomModal(); loadDonors();
};

window.openNewDonorModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Nouveau Donateur</h3>
        <input type="text" id="n-last" placeholder="Nom de famille *" class="luxe-input">
        <input type="text" id="n-origin" placeholder="Origine" class="luxe-input">
        <button onclick="execCreateDonor()" class="btn-gold" style="width:100%; margin-top:10px;">Enregistrer</button>
    `;
};

window.execCreateDonor = async () => {
    const last = document.getElementById('n-last').value;
    if(!last) return;
    await supabaseClient.from('donors').insert([{ last_name: last, origin: document.getElementById('n-origin').value }]);
    closeCustomModal(); loadDonors();
};

// ========================== DIVERS ==========================

function listenRealtime() {
    supabaseClient.channel('alsatia-live').on('postgres_changes', { event: '*', schema: 'public' }, () => {
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
