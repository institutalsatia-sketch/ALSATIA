// ==========================================
// CONFIGURATION SUPABASE & ÉTAT GLOBAL
// ==========================================
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let allUsersForMentions = []; 

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

// ==========================================
// FONCTIONS GLOBALES (CRITIQUE POUR LES ERREURS ONCLICK)
// ==========================================
window.logout = () => { 
    localStorage.clear(); 
    window.location.href = 'login.html'; 
};

window.closeCustomModal = () => { 
    document.getElementById('custom-modal').style.display = 'none'; 
};

window.showNotice = (title, message) => {
    // Version simple en attendant un toast CSS
    alert(`${title}\n${message}`); 
};

// ==========================================
// INITIALISATION & INTERFACE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    initInterface();
    // Charger le chat par défaut si nécessaire
    if(typeof loadChatMessages === "function") loadChatMessages(); 
});

function initInterface() {
    const portal = currentUser.portal;
    const logoSrc = LOGOS[portal] || 'logo_alsatia.png';

    // 1. Sidebar : Petit logo et infos
    const sideLogo = document.getElementById('entity-logo-container');
    if(sideLogo) sideLogo.innerHTML = `<img src="${logoSrc}" class="entity-logo">`;
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = portal;

    // 2. Accueil : Logo géant et Bienvenue (Prénom + Nom)
    const bigLogo = document.getElementById('big-logo-display');
    if(bigLogo) {
        bigLogo.innerHTML = `<img src="${logoSrc}" style="width:280px; max-width:80%; filter:drop-shadow(0 20px 30px rgba(0,0,0,0.15));">`;
    }
    
    const welcomeName = document.getElementById('welcome-full-name');
    if(welcomeName) welcomeName.innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    
    const welcomePortal = document.getElementById('welcome-portal-label');
    if(welcomePortal) welcomePortal.innerText = `Accès sécurisé — ${portal}`;

    // 3. Gestion de l'onglet Donateurs (Uniquement pour l'Institut)
    const navDonors = document.getElementById('nav-donors');
    if (navDonors) {
        navDonors.style.display = (portal === "Institut Alsatia") ? "flex" : "none";
    }

    lucide.createIcons();
}

window.switchTab = (id) => {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(`tab-${id}`);
    if (target) target.classList.add('active');
    
    const navBtn = document.getElementById(`nav-${id}`);
    if (navBtn) navBtn.classList.add('active');

    if (id === 'contacts') loadContacts();
    // if (id === 'donors') loadDonors(); // etc.
    lucide.createIcons();
};

// ==========================================
// FONCTION ANNUAIRE (CONTACTS)
// ==========================================
async function loadContacts() {
    const list = document.getElementById('contacts-list');
    if(!list) return;
    
    list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px;">Chargement de l'annuaire...</p>`;

    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('portal', { ascending: true });

    if (error) return list.innerHTML = "Erreur de chargement.";

    list.innerHTML = users.map(u => `
        <div class="contact-card" style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; justify-content:space-between; min-height:180px;">
            <div>
                <span style="font-size:0.65rem; font-weight:800; color:#d4af37; letter-spacing:1px; text-transform:uppercase;">${u.portal}</span>
                <h3 style="margin:5px 0; font-size:1.1rem; color:#1e293b;">${u.first_name} ${u.last_name.toUpperCase()}</h3>
                <p style="font-size:0.85rem; color:#64748b;">${u.job_title || 'Collaborateur'}</p>
            </div>
            <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid #f1f5f9; padding-top:15px;">
                <a href="mailto:${u.email}" style="flex:1; text-align:center; text-decoration:none; color:#1e293b; background:#f8fafc; padding:8px; border-radius:6px; font-size:0.75rem; border:1px solid #eee;">Mail</a>
                ${u.phone ? `<a href="tel:${u.phone}" style="flex:1; text-align:center; text-decoration:none; color:#1e293b; background:#f8fafc; padding:8px; border-radius:6px; font-size:0.75rem; border:1px solid #eee;">Appeler</a>` : ''}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// ==========================================
// GESTION DU PROFIL UTILISATEUR & SÉCURITÉ
// ==========================================

window.openProfileModal = async () => {
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error || !profile) {
        console.error("Erreur profil:", error);
        return window.showNotice("Erreur", "Impossible de charger votre profil.");
    }

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #d4af37; padding-bottom:10px; margin-bottom:20px;">
            <h3 style="margin:0; color:#1e293b;"><i data-lucide="settings" style="width:20px; vertical-align:middle; margin-right:8px;"></i>PARAMÈTRES DU PROFIL</h3>
            <button onclick="closeCustomModal()" class="btn-gold" style="padding: 2px 8px; border:none; background:none; font-weight:bold; cursor:pointer;">X</button>
        </div>

        <h4 style="font-size:0.75rem; color:#d4af37; letter-spacing:1px; margin-bottom:15px; text-transform:uppercase;">Informations Personnelles</h4>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <label class="mini-label">PRÉNOM</label>
                <input type="text" id="prof-first" class="luxe-input" value="${profile.first_name || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
            </div>
            <div>
                <label class="mini-label">NOM</label>
                <input type="text" id="prof-last" class="luxe-input" value="${profile.last_name || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
            </div>
        </div>

        <div style="margin-top:15px;">
            <label class="mini-label">FONCTION DANS L'ENTITÉ</label>
            <input type="text" id="prof-job" class="luxe-input" value="${profile.job_title || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:15px;">
            <div>
                <label class="mini-label">TÉLÉPHONE</label>
                <input type="tel" id="prof-phone" class="luxe-input" value="${profile.phone || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
            </div>
            <div>
                <label class="mini-label">MAIL</label>
                <input type="email" id="prof-email" class="luxe-input" value="${profile.email || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
            </div>
        </div>

        <button onclick="window.saveMyProfile()" class="btn-gold" style="width:100%; margin-top:15px; padding:12px; background:#1e293b; color:#d4af37; font-weight:bold; border:1px solid #d4af37; border-radius:8px; cursor:pointer;">
            METTRE À JOUR LE PROFIL
        </button>

        <hr style="border:0; border-top:1px solid #eee; margin:25px 0;">

        <h4 style="font-size:0.75rem; color:#d4af37; letter-spacing:1px; margin-bottom:15px; text-transform:uppercase;">Sécurité & Accès</h4>
        
        <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
            <div style="margin-bottom:10px; font-size:0.8rem; color:#64748b;">
                Portail actuel : <strong style="color:#1e293b;">${profile.portal}</strong>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div>
                    <label class="mini-label">NOUVEAU PIN</label>
                    <input type="password" id="prof-pin" class="luxe-input" placeholder="****" maxlength="6" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
                </div>
                <div>
                    <label class="mini-label">CONFIRMATION</label>
                    <input type="password" id="prof-pin-confirm" class="luxe-input" placeholder="****" maxlength="6" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
                </div>
            </div>
            <button onclick="window.updateSecurityPin()" class="btn-gold" style="width:100%; margin-top:15px; padding:10px; background:#fff; color:#1e293b; font-size:0.75rem; border:1px solid #ddd; border-radius:6px; cursor:pointer;">
                MODIFIER MON CODE PIN
            </button>
        </div>
    `;
    lucide.createIcons();
};

window.saveMyProfile = async () => {
    const updates = {
        first_name: document.getElementById('prof-first').value.trim(),
        last_name: document.getElementById('prof-last').value.trim(),
        job_title: document.getElementById('prof-job').value.trim(),
        phone: document.getElementById('prof-phone').value.trim(),
        email: document.getElementById('prof-email').value.trim()
    };

    if (!updates.first_name || !updates.last_name) {
        return window.showNotice("Champs requis", "Le nom et le prénom sont obligatoires.");
    }

    const { error } = await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id);

    if (!error) {
        window.showNotice("Succès", "Informations enregistrées.");
        currentUser.first_name = updates.first_name;
        currentUser.last_name = updates.last_name;
        localStorage.setItem('alsatia_user', JSON.stringify(currentUser));
        document.getElementById('user-name-display').innerText = `${updates.first_name} ${updates.last_name}`;
        closeCustomModal();
    } else {
        window.showNotice("Erreur", "Sauvegarde impossible.");
    }
};

window.updateSecurityPin = async () => {
    const pin = document.getElementById('prof-pin').value;
    const confirm = document.getElementById('prof-pin-confirm').value;

    if (!pin || pin.length < 4) {
        return window.showNotice("Sécurité", "Le PIN doit faire au moins 4 chiffres.");
    }
    if (pin !== confirm) {
        return window.showNotice("Erreur", "Les codes PIN ne correspondent pas.");
    }

    const { error } = await supabaseClient
        .from('profiles')
        .update({ pin: pin })
        .eq('id', currentUser.id);

    if (!error) {
        window.showNotice("Sécurité", "Code PIN modifié avec succès.");
        document.getElementById('prof-pin').value = "";
        document.getElementById('prof-pin-confirm').value = "";
    } else {
        window.showNotice("Erreur", "Échec de la modification du PIN.");
    }
};
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
// GESTION DES ÉVÉNEMENTS (VUE CHRONOLOGIQUE)
// ==========================================

// --- CHARGEMENT ---
window.loadEvents = async () => {
    // Requête explicite pour éviter l'erreur 400
    const { data, error } = await supabaseClient
        .from('events')
        .select(`
            id, title, event_date, event_time, location, entity, description,
            event_resources(id, file_url, description)
        `)
        .order('event_date', { ascending: true });

    if (error) return console.error("Erreur chargement events:", error);
    renderEvents(data);
};

// --- RENDER PRINCIPAL ---
function renderEvents(events) {
    const container = document.getElementById('events-container'); 
    if (!container) return;

    if (!events || events.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; opacity:0.5;">Aucun événement programmé.</div>`;
        return;
    }

    // 1. Groupement des événements par "Mois Année"
    const grouped = {};
    events.forEach(ev => {
        const date = new Date(ev.event_date);
        const monthYear = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
        if (!grouped[monthYear]) grouped[monthYear] = [];
        grouped[monthYear].push(ev);
    });

    // 2. Génération du HTML
    let html = "";
    
    for (const [month, monthEvents] of Object.entries(grouped)) {
        html += `
            <div class="month-divider">
                <h2>${month}</h2>
            </div>
            <div class="kanban-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 30px;">
        `;

        // Séparation par statut pour ce mois
        const categories = {
            todo: monthEvents.filter(ev => !isStarted(ev)),
            progress: monthEvents.filter(ev => isStarted(ev) && !isEventReady(ev)),
            ready: monthEvents.filter(ev => isEventReady(ev))
        };

        html += `
            <div class="kanban-column" style="background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
                <h3 style="font-size:0.7rem; color:#64748b; margin-bottom:12px; font-weight:800; border-bottom:1px solid #ddd; padding-bottom:5px;">À PLANIFIER (${categories.todo.length})</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${categories.todo.map(ev => renderMiniCard(ev)).join('')}
                </div>
            </div>

            <div class="kanban-column" style="background:#fff7ed; padding:12px; border-radius:10px; border:1px solid #ffedd5;">
                <h3 style="font-size:0.7rem; color:#b45309; margin-bottom:12px; font-weight:800; border-bottom:1px solid #fed7aa; padding-bottom:5px;">EN PRÉPARATION (${categories.progress.length})</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${categories.progress.map(ev => renderMiniCard(ev)).join('')}
                </div>
            </div>

            <div class="kanban-column" style="background:#f0fdf4; padding:12px; border-radius:10px; border:1px solid #dcfce7;">
                <h3 style="font-size:0.7rem; color:#166534; margin-bottom:12px; font-weight:800; border-bottom:1px solid #bbf7d0; padding-bottom:5px;">PRÊT COM (${categories.ready.length})</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${categories.ready.map(ev => renderMiniCard(ev)).join('')}
                </div>
            </div>
        `;

        html += `</div>`;
    }

    container.style.display = "block";
    container.innerHTML = html;
    lucide.createIcons();
}

// --- HELPERS DE STATUT ---
function isStarted(ev) {
    return ev.event_resources?.some(r => (r.description && r.description.length > 5) || r.file_url);
}

function isEventReady(ev) {
    const hasText = ev.event_resources?.some(r => r.description && r.description.length > 10);
    const hasPhoto = ev.event_resources?.some(r => r.file_url);
    return hasText && hasPhoto;
}

function renderMiniCard(ev) {
    const canManage = (currentUser.portal === "Institut Alsatia" || currentUser.portal === ev.entity);
    const dateFr = new Date(ev.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    
    return `
        <div class="event-card-mini" style="background:white; padding:10px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05); border-left: 4px solid ${getColorByEntity(ev.entity)};">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:5px;">
                <span style="font-size: 0.65rem; color: ${getColorByEntity(ev.entity)}; font-weight: bold; background:${getColorByEntity(ev.entity)}15; padding:2px 6px; border-radius:4px;">
                    ${ev.entity}
                </span>
                <span style="font-size:0.7rem; font-weight:700; color:#64748b;">${dateFr}</span>
            </div>
            <h4 style="margin: 5px 0 10px 0; font-size: 0.85rem; line-height:1.2; color:#1e293b;">${ev.title}</h4>
            <div style="display: flex; gap: 4px;">
                <button onclick="window.openEventMedia('${ev.id}')" class="btn-mini-gold" style="flex:2; font-size:0.7rem; padding:5px;"><i data-lucide="camera" style="width:12px;"></i> COM</button>
                <button onclick="window.openEventGuests('${ev.id}')" class="btn-mini-gold" style="flex:1; padding:5px; background:#f1f5f9; color:black; border:1px solid #ddd;"><i data-lucide="users" style="width:12px;"></i></button>
                ${canManage ? `<button onclick="window.askDeleteEvent('${ev.id}', '${ev.title.replace(/'/g, "\\'")}')" style="padding:5px; background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2" style="width:14px;"></i></button>` : ''}
            </div>
        </div>
    `;
}

// --- DOSSIER MÉDIA ---
window.openEventMedia = async (eventId) => {
    const { data: ev } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
    const { data: res } = await supabaseClient.from('event_resources').select('*').eq('event_id', eventId);
    
    const textData = (res || []).find(r => !r.file_url);
    const photos = (res || []).filter(r => r.file_url);

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px;">
            <h3>Dossier Com' : ${ev.title}</h3>
            <button onclick="closeCustomModal()" class="btn-gold">X</button>
        </div>
        <div style="margin-top:15px; max-height:75vh; overflow-y:auto; padding-right:5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label class="mini-label" style="margin:0;">LÉGENDE / POST RÉSEAUX</label>
                <button onclick="window.copyEventText()" class="btn-mini-gold" style="font-size:0.65rem; padding:2px 8px; background:#1e293b; color:white;">
                    <i data-lucide="copy" style="width:10px;"></i> COPIER LE TEXTE
                </button>
            </div>
            <textarea id="res-text" class="luxe-input" style="height:120px; font-size:0.9rem; margin-bottom:15px;" placeholder="Rédigez ici le post...">${textData ? textData.description : ''}</textarea>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label class="mini-label" style="margin:0;">PHOTOS & VISUELS</label>
                <input type="file" id="res-file" style="display:none;" onchange="window.uploadEventFile('${eventId}')" accept="image/*">
                <button onclick="document.getElementById('res-file').click()" class="btn-mini-gold" style="font-size:0.65rem;">+ AJOUTER PHOTO</button>
            </div>
            
            <div id="media-gallery" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px;">
                ${photos.map(r => `
                    <div class="gallery-item" style="position:relative; height:100px; border:1px solid #eee; border-radius:5px; overflow:hidden; background:#f8fafc;">
                        <img src="${r.file_url}" style="width:100%; height:100%; object-fit:cover;">
                        <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); display:flex; justify-content:space-around; padding:5px;">
                            <button onclick="window.downloadImage('${r.file_url}', 'photo_${eventId}')" title="Télécharger" style="background:none; border:none; color:white; cursor:pointer;">
                                <i data-lucide="download" style="width:14px;"></i>
                            </button>
                            <button onclick="window.deleteResource('${r.id}', '${eventId}')" title="Supprimer" style="background:none; border:none; color:#ff4d4d; cursor:pointer;">
                                <i data-lucide="trash-2" style="width:14px;"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button onclick="window.saveEventContent('${eventId}')" class="btn-gold" style="width:100%; margin-top:20px; background:#107c10; border:none;">ENREGISTRER</button>
        </div>
    `;
    lucide.createIcons();
};

// --- LOGIQUE MÉDIA (COPIE, UPLOAD, TÉLÉCHARGEMENT) ---
window.copyEventText = () => {
    const textArea = document.getElementById('res-text');
    if (!textArea || !textArea.value) return window.showNotice("Info", "Rien à copier.");
    navigator.clipboard.writeText(textArea.value);
    window.showNotice("Copié !", "Texte prêt à être collé.");
};

window.downloadImage = async (url, filename) => {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    } catch (e) { window.showNotice("Erreur", "Téléchargement impossible."); }
};

window.uploadEventFile = async (eventId) => {
    const file = document.getElementById('res-file').files[0];
    if(!file) return;
    const path = `events/${eventId}/${Date.now()}_${file.name}`;
    const { data } = await supabaseClient.storage.from('documents').upload(path, file);
    if (data) {
        const url = supabaseClient.storage.from('documents').getPublicUrl(path).data.publicUrl;
        await supabaseClient.from('event_resources').insert([{ event_id: eventId, file_url: url }]);
        window.openEventMedia(eventId);
        window.loadEvents();
    }
};

window.saveEventContent = async (eventId) => {
    const text = document.getElementById('res-text').value;
    const { data: resources } = await supabaseClient.from('event_resources').select('*').eq('event_id', eventId);
    const existingText = resources?.find(r => !r.file_url);
    if(existingText) {
        await supabaseClient.from('event_resources').update({ description: text }).eq('id', existingText.id);
    } else {
        await supabaseClient.from('event_resources').insert([{ event_id: eventId, description: text }]);
    }
    window.showNotice("Succès", "Texte mis à jour.");
    window.loadEvents();
};

window.deleteResource = async (resId, eventId) => {
    await supabaseClient.from('event_resources').delete().eq('id', resId);
    window.openEventMedia(eventId);
    window.loadEvents();
};

// --- GESTION DES INVITÉS ---
window.openEventGuests = async (eventId) => {
    const { data: donors } = await supabaseClient.from('donors').select('id, last_name, first_name, company_name, entity').order('last_name');
    const { data: guests } = await supabaseClient.from('event_guests').select('donor_id').eq('event_id', eventId);
    const guestIds = (guests || []).map(g => g.donor_id);

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px;">
            <h3>Liste des Invités</h3>
            <button onclick="closeCustomModal()" class="btn-gold">X</button>
        </div>
        <div style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">
            <input type="text" id="guest-search" class="luxe-input" placeholder="Rechercher..." oninput="window.filterGuestList()">
            <div id="guest-list-scroll" style="max-height:400px; overflow-y:auto; border:1px solid #eee; border-radius:8px;">
                ${donors.map(d => `
                    <label class="guest-item" data-name="${d.last_name} ${d.first_name}" style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #f9f9f9; cursor:pointer;">
                        <input type="checkbox" ${guestIds.includes(d.id) ? 'checked' : ''} onchange="window.toggleGuest('${eventId}', '${d.id}', this.checked)" style="margin-right:12px; width:18px; height:18px;">
                        <div style="flex:1; font-size:0.85rem;">
                            <strong>${d.last_name} ${d.first_name || ''}</strong><br>
                            <span style="color:gray; font-size:0.75rem;">${d.company_name || d.entity || ''}</span>
                        </div>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
};

window.filterGuestList = () => {
    const q = document.getElementById('guest-search').value.toLowerCase();
    document.querySelectorAll('.guest-item').forEach(item => {
        item.style.display = item.getAttribute('data-name').toLowerCase().includes(q) ? 'flex' : 'none';
    });
};

window.toggleGuest = async (eventId, donorId, isChecked) => {
    if (isChecked) await supabaseClient.from('event_guests').insert([{ event_id: eventId, donor_id: donorId }]);
    else await supabaseClient.from('event_guests').delete().eq('event_id', eventId).eq('donor_id', donorId);
};

// --- CRÉATION ---
window.openNewEventModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--primary); border-bottom:1px solid var(--gold); padding-bottom:10px;">Nouvel Événement</h3>
        <label class="mini-label">TITRE</label><input type="text" id="ev-title" class="luxe-input">
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label class="mini-label">DATE</label><input type="date" id="ev-date" class="luxe-input"></div>
            <div style="flex:1;"><label class="mini-label">HEURE</label><input type="time" id="ev-time" class="luxe-input"></div>
        </div>
        <label class="mini-label">ENTITÉ</label>
        <select id="ev-entity" class="luxe-input">
            <option value="Institut Alsatia">Institut Alsatia</option>
            <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
            <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
            <option value="Academia Alsatia">Academia Alsatia</option>
        </select>
        <label class="mini-label">LIEU</label><input type="text" id="ev-loc" class="luxe-input">
        <button onclick="window.execCreateEvent()" class="btn-gold" style="width:100%; margin-top:15px;">PUBLIER</button>
    `;
};

window.execCreateEvent = async () => {
    const title = document.getElementById('ev-title').value;
    const date = document.getElementById('ev-date').value;
    if (!title || !date) return window.showNotice("Erreur", "Titre et date requis.");

    const { error } = await supabaseClient.from('events').insert([{
        title, event_date: date,
        event_time: document.getElementById('ev-time').value || null,
        location: document.getElementById('ev-loc').value || null,
        entity: document.getElementById('ev-entity').value,
        created_by: `${currentUser.first_name} ${currentUser.last_name}`
    }]);

    if (!error) { 
        window.showNotice("Succès", "Événement créé.");
        closeCustomModal(); 
        window.loadEvents(); 
    } else { window.showNotice("Erreur 400", "Vérifiez les champs."); }
};

// --- SUPPRESSION CUSTOM ---
window.askDeleteEvent = (id, title) => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <div style="color:#ef4444; margin-bottom:15px;"><i data-lucide="alert-triangle" style="width:48px; height:48px; margin:0 auto;"></i></div>
            <h3>Supprimer l'événement ?</h3>
            <p style="color:#64748b; font-size:0.9rem; margin-bottom:20px;">Voulez-vous supprimer <strong>"${title}"</strong> ?</p>
            <div style="display:flex; gap:10px;">
                <button onclick="closeCustomModal()" class="btn-gold" style="flex:1; background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1;">ANNULER</button>
                <button onclick="window.execDeleteEvent('${id}')" style="flex:1; background:#fee2e2; color:#ef4444; border:1px solid #fecaca; border-radius:8px; font-weight:bold; cursor:pointer;">SUPPRIMER</button>
            </div>
        </div>
    `;
    lucide.createIcons();
};

window.execDeleteEvent = async (id) => {
    await supabaseClient.from('event_resources').delete().eq('event_id', id);
    await supabaseClient.from('event_guests').delete().eq('event_id', id);
    await supabaseClient.from('events').delete().eq('id', id);
    window.showNotice("Supprimé", "Événement retiré.");
    closeCustomModal();
    window.loadEvents();
};

function getColorByEntity(ent) {
    const colors = {"Institut Alsatia":"#1e3a8a", "Cours Herrade de Landsberg":"#15803d", "Collège Saints Louis et Zélie Martin":"#b91c1c", "Academia Alsatia":"#b45309"};
    return colors[ent] || "#666";
}
