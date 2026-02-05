// CONFIGURATION SUPABASE
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ETAT GLOBAL
let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let allUsersForMentions = []; // Stockera les noms et entités
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

async function loadUsersForMentions() {
    // On récupère les utilisateurs depuis votre table de profils/utilisateurs
    const { data } = await supabaseClient.from('profiles').select('first_name, last_name, portal');
    if (data) {
        // On combine les noms d'utilisateurs et les noms des 4 entités fixes
        const entities = [
            "Institut Alsatia", 
            "Academia Alsatia", 
            "Cours Herrade de Landsberg", 
            "Collège Saints Louis et Zélie Martin"
        ];
        const users = data.map(u => `${u.first_name} ${u.last_name} (${u.portal})`);
        allUsersForMentions = [...entities, ...users];
    }
}

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
            // Filtrage dans la liste globale (Utilisateurs + Entités)
            const matches = allUsersForMentions.filter(s => s.toLowerCase().includes(query));
            
            if (matches.length > 0) {
                suggestList.innerHTML = matches.map(m => `<div class="suggest-item">${m}</div>`).join('');
                suggestList.style.display = 'block';
                
                document.querySelectorAll('.suggest-item').forEach(item => {
                    item.onclick = () => {
                        // On insère la mention choisie
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

// ========================== GESTION DES SUJETS (CHANNELS) ==========================

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const select = document.getElementById('chat-subject-filter');
    
    // Filtrage : Sujets publics OU sujets de mon entité
    const mySubjects = (data || []).filter(s => 
        s.entity === "Tous" || 
        s.entity === currentUser.portal || 
        !s.entity
    );

    select.innerHTML = mySubjects.map(s => {
        const icon = (s.entity === "Tous") ? "🌍" : "🔒";
        return `<option value="${s.name}">${icon} # ${s.name}</option>`;
    }).join('');
    
    loadChatMessages();
}

window.showNewSubjectModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--primary); border-bottom:1px solid var(--gold); padding-bottom:10px;">Créer un nouveau salon</h3>
        
        <label class="mini-label">NOM DU SALON</label>
        <input type="text" id="n-subject-name" placeholder="ex: Réunion pédagogique..." class="luxe-input">
        
        <label class="mini-label">VISIBILITÉ DU SUJET</label>
        <select id="n-subject-entity" class="luxe-input">
            <option value="Tous">🌍 Public (Toutes les entités)</option>
            <option value="${currentUser.portal}">🔒 Privé (${currentUser.portal} uniquement)</option>
        </select>
        
        <div style="margin-top:20px; display:flex; gap:10px;">
            <button onclick="execCreateSubject()" class="btn-gold" style="flex:2;">CRÉER LE SALON</button>
            <button onclick="closeCustomModal()" class="btn-gold" style="flex:1; background:#666;">ANNULER</button>
        </div>
    `;
};

window.execCreateSubject = async () => {
    const name = document.getElementById('n-subject-name').value.trim();
    const entity = document.getElementById('n-subject-entity').value;
    
    if(!name) {
        alert("Veuillez donner un nom au salon.");
        return;
    }
    
    const { error } = await supabaseClient.from('chat_subjects').insert([{ 
        name: name, 
        entity: entity 
    }]);
    
    if(!error) { 
        closeCustomModal(); 
        loadSubjects(); // Rafraîchit la liste des sujets immédiatement
    } else {
        alert("Erreur lors de la création du sujet.");
    }
};

window.askDeleteSubject = () => {
    // SEUL L'ADMIN PEUT SUPPRIMER
    if (currentUser.portal !== "Institut Alsatia") {
        alert("⚠️ Action réservée à l'administrateur de l'Institut.");
        return;
    }

    const subj = document.getElementById('chat-subject-filter').value;
    if (subj === "Général") return alert("Le salon principal ne peut être supprimé.");

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--danger);">Supprimer #${subj} ?</h3>
        <p style="font-size:0.8rem;">Cela retirera le salon de la liste pour tout le monde.</p>
        <button onclick="execDeleteSubject('${subj}')" class="btn-danger" style="width:100%; margin-top:10px;">CONFIRMER LA SUPPRESSION</button>
    `;
};

window.execDeleteSubject = async (name) => {
    const { error } = await supabaseClient.from('chat_subjects').delete().eq('name', name);
    if(!error) { closeCustomModal(); loadSubjects(); }
};

async function loadChatMessages() {
    const subj = document.getElementById('chat-subject-filter').value;
    if(!subj) return;
    
    // On s'assure de récupérer le nom complet et le portail
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subj).order('created_at');
    
    const box = document.getElementById('chat-box');
    box.innerHTML = (data || []).map(m => {
        const isMe = m.author_name === currentUser.first_name; // ou ID pour plus de précision
        
        // Style WhatsApp pour les mentions dans le texte
        const contentWithMentions = m.content.replace(/@([\wÀ-ÿ-\s()]+)/g, '<span class="mention-badge">@$1</span>');
        
        return `
            <div class="message ${isMe ? 'my-msg' : ''}">
                <div class="msg-meta" style="font-size:0.7rem; margin-bottom:3px;">
                    <span style="color:var(--gold); font-weight:bold;">${m.author_full_name || m.author_name}</span> 
                    <span style="opacity:0.6; font-style:italic;"> • ${m.portal}</span>
                </div>
                <div class="msg-body" onclick="${isMe ? `askEditMsg('${m.id}','${m.content.replace(/'/g, "\\'")}')` : ''}">
                    ${contentWithMentions}
                </div>
                ${m.file_url ? `<a href="${m.file_url}" target="_blank" class="file-link">📄 Document joint</a>` : ''}
                ${isMe ? `<div class="msg-actions"><span onclick="askDeleteMsg('${m.id}')">Supprimer</span></div>` : ''}
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}
window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const fullName = `${currentUser.first_name} ${currentUser.last_name}`; // Préparation du nom complet
    
    // ... reste du code d'upload ...

    await supabaseClient.from('chat_global').insert([{ 
        content: input.value, 
        author_name: currentUser.first_name,
        author_full_name: fullName, // On stocke le nom complet pour l'affichage
        portal: currentUser.portal, 
        subject: subj, 
        file_url: fUrl 
    }]);
    // ...
};

window.askEditMsg = (id, old) => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `<h3>Modifier</h3><textarea id="edit-area" class="luxe-input" style="height:100px;">${old}</textarea><button onclick="execEditMsg('${id}')" class="btn-gold" style="width:100%">Sauver</button>`;
};
window.execEditMsg = async (id) => {
    await supabaseClient.from('chat_global').update({ content: document.getElementById('edit-area').value }).eq('id', id);
    closeCustomModal(); loadChatMessages();
};
window.askDeleteMsg = (id) => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `<h3>Supprimer ?</h3><button onclick="execDeleteMsg('${id}')" class="btn-danger" style="width:100%">Confirmer</button>`;
};
window.execDeleteMsg = async (id) => {
    await supabaseClient.from('chat_global').delete().eq('id', id);
    closeCustomModal(); loadChatMessages();
};

// ========================== CRM COMPLET (DONATEURS) ==========================

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
        const name = d.company_name ? `<b>${d.company_name}</b> <br><small>${d.last_name}</small>` : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name || ''}`;
        return `<tr class="${needsThanks ? 'blink-warning' : ''}">
            <td>${name}</td>
            <td>${d.origin || d.entities || '-'}</td>
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
        const matchSearch = (d.last_name||'').toLowerCase().includes(search) || (d.company_name||'').toLowerCase().includes(search) || (d.city||'').toLowerCase().includes(search);
        const matchEntity = entity === "ALL" || d.origin === entity || d.entities === entity;
        return matchSearch && matchEntity;
    });
    renderDonors(filtered);
};

window.exportAllDonors = () => {
    const exportData = allDonorsData.map(d => ({
        "Entreprise": d.company_name, "Nom": d.last_name, "Prénom": d.first_name, "Email": d.email, "Tel": d.phone,
        "Adresse": d.address, "CP": d.zip_code, "Ville": d.city, "Origine": d.origin || d.entities, "Notes": d.notes,
        "Total": d.donations?.reduce((s, n) => s + Number(n.amount), 0)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base_Complete");
    XLSX.writeFile(wb, "CRM_Alsatia_Complet.xlsx");
};

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    document.getElementById('custom-modal').style.display = 'flex';
    
    // Date du jour par défaut
    const today = new Date().toISOString().split('T')[0];

    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px;">
            <h3>Fiche Donateur : ${d.last_name}</h3>
            <button onclick="closeCustomModal()" class="btn-gold">X</button>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px;">
            <div class="col">
                <label class="mini-label">Société</label><input type="text" id="e-company" value="${d.company_name||''}" class="luxe-input">
                <label class="mini-label">Nom *</label><input type="text" id="e-last" value="${d.last_name||''}" class="luxe-input">
                <label class="mini-label">Email</label><input type="text" id="e-email" value="${d.email||''}" class="luxe-input">
            </div>
            <div class="col">
                <label class="mini-label">Ville</label><input type="text" id="e-city" value="${d.city||''}" class="luxe-input">
                <label class="mini-label">Origine</label><input type="text" id="e-origin" value="${d.origin||d.entities||''}" class="luxe-input">
                <label class="mini-label">Notes</label><textarea id="e-notes" class="luxe-input" style="height:35px;">${d.notes||''}</textarea>
            </div>
        </div>

        <div style="background:#f8fafc; padding:15px; border-radius:8px; margin-top:15px; border:1px solid #e2e8f0;">
            <h4 style="margin:0 0 10px 0; color:var(--primary); font-size:0.85rem;">NOUVEAU DON</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                <div>
                    <label class="mini-label">Montant (€)</label>
                    <input type="number" id="d-amt" class="luxe-input" style="margin:0">
                </div>
                <div>
                    <label class="mini-label">Date</label>
                    <input type="date" id="d-date" value="${today}" class="luxe-input" style="margin:0">
                </div>
                <div>
                    <label class="mini-label">N° Reçu Fiscal</label>
                    <input type="text" id="d-tax" placeholder="Optionnel" class="luxe-input" style="margin:0">
                </div>
            </div>
            <button onclick="addDonation('${d.id}')" class="btn-gold" style="width:100%; margin-top:10px; height:35px;">VALIDER LE DON</button>
            
            <div style="margin-top:15px; font-size:0.75rem; border-top:1px solid #ddd; padding-top:10px;">
                <label class="mini-label">HISTORIQUE</label>
                ${(d.donations||[]).sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => `
                    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed #eee;">
                        <span>${don.date} : <b>${don.amount}€</b> ${don.tax_receipt_number ? `(RF: ${don.tax_receipt_number})` : ''}</span>
                        <span><input type="checkbox" ${don.thanked?'checked':''} onchange="updateThanks('${don.id}','${d.id}',this.checked)"> Merci</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <button onclick="saveDonor('${d.id}')" class="btn-gold" style="width:100%; margin-top:15px; background:var(--primary);">ENREGISTRER LA FICHE</button>
    `;
};

window.exportSingleDonor = (id) => {
    const d = allDonorsData.find(x => x.id === id);
    const data = d.donations.map(don => ({ "Date": don.date, "Montant": don.amount, "Remercié": don.thanked ? "OUI" : "NON" }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dons");
    XLSX.writeFile(wb, `Dons_${d.last_name}.xlsx`);
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    const date = document.getElementById('d-date').value; // Récupère la date saisie
    const tax = document.getElementById('d-tax').value;  // Récupère le reçu fiscal
    
    if(!amt || !date) return alert("Veuillez saisir le montant et la date.");

    const { error } = await supabaseClient.from('donations').insert([{ 
        donor_id: id, 
        amount: parseFloat(amt), 
        date: date, 
        tax_receipt_number: tax,
        thanked: false 
    }]);

    if(error) {
        alert("Erreur. Avez-vous créé la colonne 'tax_receipt_number' sur Supabase ?");
    } else {
        openDonorFile(id); 
        loadDonors();
    }
};

window.updateThanks = async (donId, donorId, val) => {
    await supabaseClient.from('donations').update({ thanked: val }).eq('id', donId);
    loadDonors();
};

window.saveDonor = async (id) => {
    const upd = {
        company_name: document.getElementById('e-company').value,
        last_name: document.getElementById('e-last').value,
        first_name: document.getElementById('e-first').value,
        email: document.getElementById('e-email').value,
        phone: document.getElementById('e-phone').value,
        address: document.getElementById('e-address').value,
        zip_code: document.getElementById('e-zip').value,
        city: document.getElementById('e-city').value,
        origin: document.getElementById('e-origin').value,
        notes: document.getElementById('e-notes').value,
        next_action: document.getElementById('e-next').value,
        last_modified_by: currentUser.first_name
    };
    await supabaseClient.from('donors').update(upd).eq('id', id);
    closeCustomModal(); loadDonors();
};

window.openNewDonorModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3>Nouveau Donateur</h3>
        <input type="text" id="n-company" placeholder="Entreprise" class="luxe-input">
        <input type="text" id="n-last" placeholder="Nom *" class="luxe-input">
        <input type="text" id="n-origin" placeholder="Origine" class="luxe-input">
        <button onclick="execCreateDonor()" class="btn-gold" style="width:100%">Créer</button>
    `;
};

window.execCreateDonor = async () => {
    const last = document.getElementById('n-last').value;
    if(!last) return;
    await supabaseClient.from('donors').insert([{ last_name: last, company_name: document.getElementById('n-company').value, origin: document.getElementById('n-origin').value }]);
    closeCustomModal(); loadDonors();
};

// ========================== DIVERS ==========================

function listenRealtime() {
    supabaseClient.channel('alsatia-final').on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadChatMessages();
        if(currentUser.portal === "Institut Alsatia") loadDonors();
    }).subscribe();
}

window.handleFileUpload = (input) => { if(input.files[0]) { selectedFile = input.files[0]; document.getElementById('file-preview').innerText = "📎 " + selectedFile.name; } };
