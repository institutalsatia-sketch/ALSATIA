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
    if(id === 'events') loadEvents();
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
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px; margin-bottom:15px;">
            <h3 style="margin:0;">Fiche : ${d.company_name || d.last_name}</h3>
            <button onclick="closeCustomModal()" class="btn-gold" style="padding:5px 10px;">X</button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; max-height:65vh; overflow-y:auto; padding-right:5px;">
            <div class="col">
                <label class="mini-label">SOCIÉTÉ (COMPANY_NAME)</label>
                <input type="text" id="e-company" value="${d.company_name || ''}" class="luxe-input">
                
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label class="mini-label">NOM *</label>
                        <input type="text" id="e-last" value="${d.last_name || ''}" class="luxe-input">
                    </div>
                    <div style="flex:1;">
                        <label class="mini-label">PRÉNOM</label>
                        <input type="text" id="e-first" value="${d.first_name || ''}" class="luxe-input">
                    </div>
                </div>

                <label class="mini-label">EMAIL</label>
                <input type="email" id="e-email" value="${d.email || ''}" class="luxe-input">
                
                <label class="mini-label">TÉLÉPHONE (PHONE)</label>
                <input type="text" id="e-phone" value="${d.phone || ''}" class="luxe-input">

                <label class="mini-label">ORIGINE / ENTITIES</label>
                <input type="text" id="e-origin" value="${d.origin || d.entities || ''}" class="luxe-input">
            </div>

            <div class="col">
                <label class="mini-label">ADRESSE</label>
                <input type="text" id="e-address" value="${d.address || ''}" class="luxe-input">
                
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label class="mini-label">CODE POSTAL</label>
                        <input type="text" id="e-zip" value="${d.zip_code || ''}" class="luxe-input">
                    </div>
                    <div style="flex:2;">
                        <label class="mini-label">VILLE</label>
                        <input type="text" id="e-city" value="${d.city || ''}" class="luxe-input">
                    </div>
                </div>

                <label class="mini-label">PROCHAINE ACTION (NEXT_ACTION)</label>
                <input type="text" id="e-next" value="${d.next_action || ''}" class="luxe-input" placeholder="ex: Rappeler en septembre...">

                <label class="mini-label">NOTES</label>
                <textarea id="e-notes" class="luxe-input" style="height:72px;">${d.notes || ''}</textarea>
            </div>

            <div style="grid-column: 1 / span 2; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-top:10px;">
                <h4 style="margin:0 0 10px 0; font-size:0.8rem; color:var(--primary);">GESTION DES DONS</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                    <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
                    <input type="date" id="d-date" value="${today}" class="luxe-input">
                    <input type="text" id="d-tax" placeholder="N° Reçu Fiscal" class="luxe-input">
                </div>
                <button onclick="addDonation('${d.id}')" class="btn-gold" style="width:100%; margin-top:10px;">AJOUTER LE DON</button>
                
                <div style="margin-top:15px; max-height:120px; overflow-y:auto;">
                    ${(d.donations || []).sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => `
                        <div style="display:flex; justify-content:space-between; padding:6px; border-bottom:1px solid #eee; font-size:0.75rem;">
                            <span>${don.date} : <b>${don.amount}€</b> ${don.tax_receipt_number ? `(RF: ${don.tax_receipt_number})` : ''}</span>
                            <span><input type="checkbox" ${don.thanked ? 'checked' : ''} onchange="updateThanks('${don.id}','${d.id}',this.checked)"> Merci</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

<div style="margin-top:20px; border-top:1px solid #ddd; padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
             <button onclick="askDeleteDonor('${d.id}', '${(d.company_name || d.last_name).replace(/'/g, "\\'")}')" 
                     class="btn-danger" style="padding:10px 15px; font-size:0.8rem;">
                 SUPPRIMER LA FICHE
             </button>

             <div style="text-align:right;">
                 <small style="display:block; opacity:0.5; margin-bottom:5px;">Dernière modif : ${d.last_modified_by || 'N/A'}</small>
                 <button onclick="saveDonor('${d.id}')" class="btn-gold" style="background:var(--primary); padding:10px 30px;">
                     ENREGISTRER LA FICHE
                 </button>
             </div>
        </div>
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
        first_name: document.getElementById('e-first').value,
        email: document.getElementById('e-email').value,
        phone: document.getElementById('e-phone').value,
        address: document.getElementById('e-address').value,
        zip_code: document.getElementById('e-zip').value,
        city: document.getElementById('e-city').value,
        origin: document.getElementById('e-origin').value,
        notes: document.getElementById('e-notes').value,
        next_action: document.getElementById('e-next').value,
        last_modified_by: currentUser.first_name + " " + currentUser.last_name // Enregistre qui a fait la modif
    };

    const { error } = await supabaseClient
        .from('donors')
        .update(upd)
        .eq('id', id);

    if (!error) {
        closeCustomModal();
        loadDonors(); // Rafraîchit la liste principale
    } else {
        console.error("Erreur sauvegarde:", error);
        alert("Erreur lors de la sauvegarde. Vérifiez la connexion.");
    }
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
        <h3 style="color:var(--primary); border-bottom:1px solid var(--gold); padding-bottom:10px;">Nouveau Donateur</h3>
        
        <div style="margin-top:15px;">
            <label class="mini-label">ENTREPRISE / SOCIÉTÉ</label>
            <input type="text" id="n-company" placeholder="Nom de l'entreprise (optionnel)" class="luxe-input">
            
            <div style="display:flex; gap:10px; margin-top:10px;">
                <div style="flex:1;">
                    <label class="mini-label">PRÉNOM</label>
                    <input type="text" id="n-first" placeholder="Prénom" class="luxe-input">
                </div>
                <div style="flex:1;">
                    <label class="mini-label">NOM *</label>
                    <input type="text" id="n-last" placeholder="Nom de famille" class="luxe-input">
                </div>
            </div>

            <label class="mini-label" style="margin-top:15px;">ENTITÉ RATTACHÉE (ORIGINE DU DON)</label>
            <select id="n-origin" class="luxe-input">
                <option value="Institut Alsatia">Institut Alsatia</option>
                <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
                <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
                <option value="Academia Alsatia">Academia Alsatia</option>
            </select>
            
            <button onclick="execCreateDonor()" class="btn-gold" style="width:100%; margin-top:20px; height:45px;">
                CRÉER LA FICHE DONATEUR
            </button>
            <button onclick="closeCustomModal()" style="width:100%; background:none; border:none; color:gray; cursor:pointer; margin-top:10px; font-size:0.8rem;">
                Annuler
            </button>
        </div>
    `;
};

window.execCreateDonor = async () => {
    const lastName = document.getElementById('n-last').value.trim();
    const firstName = document.getElementById('n-first').value.trim();
    const company = document.getElementById('n-company').value.trim();
    const origin = document.getElementById('n-origin').value;

    if (!lastName) {
        alert("Le nom de famille est obligatoire pour créer une fiche.");
        return;
    }

    const { error } = await supabaseClient
        .from('donors')
        .insert([{ 
            last_name: lastName, 
            first_name: firstName,
            company_name: company, 
            origin: origin,
            last_modified_by: currentUser.first_name + " " + currentUser.last_name 
        }]);

    if (!error) {
        closeCustomModal();
        loadDonors(); // Recharge la liste pour voir le nouveau donateur
    } else {
        console.error("Erreur lors de la création du donateur:", error);
        alert("Impossible de créer la fiche. Vérifiez la console.");
    }
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

window.askDeleteDonor = (id, name) => {
    // Seul l'Institut peut supprimer un donateur
    if (currentUser.portal !== "Institut Alsatia") {
        return alert("⚠️ Action réservée à l'administrateur de l'Institut.");
    }

    // On utilise la modale existante pour la confirmation
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center; padding:20px;">
            <h3 style="color:var(--danger); margin-bottom:15px;">Supprimer définitivement ?</h3>
            <p>Voulez-vous vraiment supprimer la fiche de :<br><b>${name}</b> ?</p>
            <p style="font-size:0.8rem; color:gray; margin-top:10px;">Attention : Cela supprimera également tout l'historique des dons associés à ce donateur.</p>
            
            <div style="margin-top:25px; display:flex; gap:10px;">
                <button onclick="execDeleteDonor('${id}')" class="btn-danger" style="flex:2;">OUI, SUPPRIMER</button>
                <button onclick="closeCustomModal()" class="btn-gold" style="background:#666; flex:1;">ANNULER</button>
            </div>
        </div>
    `;
};

window.execDeleteDonor = async (id) => {
    // 1. Supprimer d'abord les dons (contrainte de clé étrangère)
    await supabaseClient.from('donations').delete().eq('donor_id', id);
    
    // 2. Supprimer le donateur
    const { error } = await supabaseClient.from('donors').delete().eq('id', id);

    if (!error) {
        closeCustomModal();
        loadDonors(); // Rafraîchir le tableau principal
    } else {
        console.error("Erreur suppression:", error);
        alert("Une erreur est survenue lors de la suppression.");
    }
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

// ==========================================
// GESTION DES ÉVÉNEMENTS
// ==========================================

async function loadEvents() {
    // On récupère les événements et on joint les ressources pour le badge de statut
    const { data, error } = await supabaseClient
        .from('events')
        .select('*, event_resources(id, file_url, description)')
        .order('event_date', { ascending: true });

    if (error) return console.error("Erreur events:", error);
    renderEvents(data);
}

function renderEvents(events) {
    const container = document.getElementById('events-container'); 
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; opacity:0.5;">Aucun événement prévu.</div>`;
        return;
    }

    container.innerHTML = events.map(ev => {
        const canManage = (currentUser.portal === "Institut Alsatia" || currentUser.portal === ev.entity);
        
        // Badge intelligent : Prêt si texte > 10 car. ET au moins une image
        const hasText = ev.event_resources?.some(r => r.description && r.description.length > 10);
        const hasPhoto = ev.event_resources?.some(r => r.file_url);
        const isReady = hasText && hasPhoto;

        const dateFr = new Date(ev.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        
        return `
            <div class="event-card" style="border-left: 5px solid ${getColorByEntity(ev.entity)};">
                <div class="event-info">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                        <span class="event-entity-badge" style="background:${getColorByEntity(ev.entity)}20; color:${getColorByEntity(ev.entity)};">
                            ${ev.entity}
                        </span>
                        ${isReady ? '<span class="badge-ready" style="background:#107c10; color:white; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:800;">✅ PRÊT COM</span>' : ''}
                    </div>
                    <h4>${ev.title}</h4>
                    <p><i data-lucide="calendar" style="width:14px;"></i> ${dateFr} ${ev.event_time ? ' à ' + ev.event_time : ''}</p>
                    <p><i data-lucide="map-pin" style="width:14px;"></i> ${ev.location || 'Lieu non défini'}</p>
                </div>
                <div class="event-actions" style="margin-top:15px; display:flex; gap:5px; flex-wrap:wrap;">
                    <button onclick="openEventMedia('${ev.id}')" class="btn-gold" style="flex:1; padding:6px;"><i data-lucide="camera"></i> COM</button>
                    <button onclick="openEventGuests('${ev.id}')" class="btn-gold" style="flex:1; padding:6px; background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1;"><i data-lucide="users"></i> INVITES</button>
                    ${canManage ? `<button onclick="askDeleteEvent('${ev.id}', '${ev.title.replace(/'/g, "\\'")}')" class="btn-mini-danger"><i data-lucide="trash-2"></i></button>` : ''}
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

// --- DOSSIER MÉDIA & RÉSEAUX SOCIAUX ---
window.openEventMedia = async (eventId) => {
    const { data: ev } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
    const { data: res } = await supabaseClient.from('event_resources').select('*').eq('event_id', eventId);

    const textData = res.find(r => !r.file_url);
    const photos = res.filter(r => r.file_url);

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px;">
            <h3>Dossier Com' : ${ev.title}</h3>
            <button onclick="closeCustomModal()" class="btn-gold">X</button>
        </div>
        
        <div style="margin-top:15px; max-height:75vh; overflow-y:auto; padding-right:5px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <label class="mini-label">LÉGENDE / POST RÉSEAUX</label>
                <button onclick="copyEventText()" class="btn-mini-gold" style="font-size:0.65rem; padding:2px 8px;">COPIER LE TEXTE</button>
            </div>
            <textarea id="res-text" class="luxe-input" style="height:120px; font-size:0.9rem;" 
                placeholder="Rédigez ici le post Instagram/Facebook...">${textData ? textData.description : ''}</textarea>
            
            <label class="mini-label" style="margin-top:15px;">PHOTOS & VISUELS</label>
            <input type="file" id="res-file" class="luxe-input" onchange="uploadEventFile('${eventId}')" accept="image/*">
            
            <div id="media-gallery" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px;">
                ${photos.map(r => `
                    <div class="gallery-item" style="position:relative; height:80px;">
                        <img src="${r.file_url}" style="width:100%; height:100%; object-fit:cover; border-radius:5px;">
                        <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); display:flex; justify-content:space-around; padding:2px; border-radius:0 0 5px 5px;">
                            <button onclick="downloadPhoto('${r.file_url}', 'event_${eventId}')" style="background:none; border:none; color:white; cursor:pointer;"><i data-lucide="download" style="width:12px;"></i></button>
                            <button onclick="deleteResource('${r.id}', '${eventId}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer;"><i data-lucide="trash-2" style="width:12px;"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <button onclick="saveEventContent('${eventId}')" class="btn-gold" style="width:100%; margin-top:20px; background:var(--primary);">
                ENREGISTRER LE DOSSIER
            </button>
        </div>
    `;
    lucide.createIcons();
};

// --- GESTION DES INVITÉS ---
window.openEventGuests = async (eventId) => {
    const { data: donors } = await supabaseClient.from('donors').select('id, last_name, first_name, company_name').order('last_name');
    const { data: guests } = await supabaseClient.from('event_guests').select('donor_id').eq('event_id', eventId);
    const guestIds = guests.map(g => g.donor_id);

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px;">
            <h3>Liste des Invités</h3>
            <button onclick="closeCustomModal()" class="btn-gold">X</button>
        </div>
        <div style="margin-top:15px;">
            <p class="mini-label">Cochez les donateurs invités à cet événement</p>
            <div id="guest-list-scroll" style="max-height:400px; overflow-y:auto; margin-top:10px; border:1px solid #eee; border-radius:8px; background:#fff;">
                ${donors.map(d => `
                    <label style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #f9f9f9; cursor:pointer; font-size:0.85rem;">
                        <input type="checkbox" style="margin-right:12px; width:16px; height:16px;" 
                            ${guestIds.includes(d.id) ? 'checked' : ''} 
                            onchange="toggleGuest('${eventId}', '${d.id}', this.checked)">
                        <div>
                            <strong>${d.last_name} ${d.first_name || ''}</strong>
                            <br><small style="color:gray;">${d.company_name || 'Particulier'}</small>
                        </div>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
};

window.toggleGuest = async (eventId, donorId, isChecked) => {
    if (isChecked) {
        await supabaseClient.from('event_guests').insert([{ event_id: eventId, donor_id: donorId }]);
    } else {
        await supabaseClient.from('event_guests').delete().eq('event_id', eventId).eq('donor_id', donorId);
    }
};

// --- FONCTIONS OUTILS ---
window.copyEventText = () => {
    const text = document.getElementById('res-text').value;
    if(!text) return;
    navigator.clipboard.writeText(text);
    // On utilise showNotice si vous l'avez déjà implémenté, sinon alert
    if(window.showNotice) showNotice("Copié !", "Le texte est dans votre presse-papier.");
    else alert("Texte copié !");
};

window.downloadPhoto = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

function getColorByEntity(entity) {
    const colors = {
        "Institut Alsatia": "#1e3a8a",
        "Cours Herrade de Landsberg": "#15803d",
        "Collège Saints Louis et Zélie Martin": "#b91c1c",
        "Academia Alsatia": "#b45309"
    };
    return colors[entity] || "#666";
}

// --- LOGIQUE DE CRÉATION CLASSIQUE ---

window.openNewEventModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--primary); border-bottom:1px solid var(--gold); padding-bottom:10px;">Programmer un événement</h3>
        
        <label class="mini-label">TITRE DE L'ÉVÉNEMENT</label>
        <input type="text" id="ev-title" placeholder="ex: Portes Ouvertes" class="luxe-input">
        
        <div style="display:flex; gap:10px;">
            <div style="flex:1;">
                <label class="mini-label">DATE</label>
                <input type="date" id="ev-date" class="luxe-input">
            </div>
            <div style="flex:1;">
                <label class="mini-label">HEURE (Optionnel)</label>
                <input type="time" id="ev-time" class="luxe-input">
            </div>
        </div>

        <label class="mini-label">LIEU</label>
        <input type="text" id="ev-loc" placeholder="ex: Salle d'honneur" class="luxe-input">

        <label class="mini-label">ENTITÉ ORGANISATRICE</label>
        <select id="ev-entity" class="luxe-input">
            <option value="${currentUser.portal}">${currentUser.portal} (Mon entité)</option>
            ${currentUser.portal === "Institut Alsatia" ? `
                <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
                <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
                <option value="Academia Alsatia">Academia Alsatia</option>
            ` : ''}
        </select>

        <label class="mini-label">DESCRIPTION</label>
        <textarea id="ev-desc" class="luxe-input" style="height:60px;"></textarea>
        
        <button onclick="execCreateEvent()" class="btn-gold" style="width:100%; margin-top:15px;">PUBLIER L'ÉVÉNEMENT</button>
    `;
};

window.execCreateEvent = async () => {
    const title = document.getElementById('ev-title').value.trim();
    const date = document.getElementById('ev-date').value;
    if (!title || !date) return alert("Le titre et la date sont obligatoires.");

    const { error } = await supabaseClient.from('events').insert([{
        title,
        event_date: date,
        event_time: document.getElementById('ev-time').value || null,
        location: document.getElementById('ev-loc').value,
        entity: document.getElementById('ev-entity').value,
        description: document.getElementById('ev-desc').value,
        created_by: currentUser.first_name + " " + currentUser.last_name
    }]);

    if (!error) { closeCustomModal(); loadEvents(); }
};

window.askDeleteEvent = (id, title) => {
    if (!confirm(`Supprimer l'événement "${title}" ?`)) return;
    execDeleteEvent(id);
};

window.execDeleteEvent = async (id) => {
    await supabaseClient.from('events').delete().eq('id', id);
    loadEvents();
};
