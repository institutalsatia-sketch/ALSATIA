// ==========================================
// CONFIGURATION SUPABASE & ÉTAT GLOBAL
// ==========================================
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let allUsersForMentions = []; 
let selectedFile = null; // Pour la gestion des pièces jointes dans la messagerie

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

// ==========================================
// FONCTIONS GLOBALES (SÉCURITÉ ET INTERFACE)
// ==========================================
window.logout = () => { 
    localStorage.clear(); 
    window.location.href = 'login.html'; 
};

window.closeCustomModal = () => { 
    const modal = document.getElementById('custom-modal');
    if(modal) modal.style.display = 'none'; 
};

// Fonction critique pour éviter les injections et bugs d'affichage dans le chat
function escapeHTML(str) {
    if (!str) return "";
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// Fonction pour centraliser l'affichage des notifications
window.showNotice = (title, message) => {
    alert(`${title}\n${message}`); 
};

// Helper pour l'affichage des Modals Luxe
function showCustomModal(html) {
    const m = document.getElementById('custom-modal');
    const b = document.getElementById('modal-body');
    if(m && b) { 
        b.innerHTML = html; 
        m.style.display = 'flex'; 
        if(window.lucide) lucide.createIcons();
    }
}

// ==========================================
// FONCTIONS GLOBALES (CRITIQUE POUR LES ERREURS ONCLICK)
// ==========================================
window.logout = () => { 
    localStorage.clear(); 
    window.location.href = 'login.html'; 
};

window.closeCustomModal = () => { 
    const modal = document.getElementById('custom-modal');
    if(modal) modal.style.display = 'none'; 
};

// Ta fonction personnalisée pour les messages d'information
window.showNotice = (title, message) => {
    alert(`${title}\n${message}`); 
};

// ==========================================
// INITIALISATION AU CHARGEMENT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!currentUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    
    initInterface();
    
    // Services Messagerie (Ajoutés pour la nouvelle version)
    await loadUsersForMentions();
    await loadSubjects();
    setupMentionLogic();
    subscribeToChat();
});

function initInterface() {
    const portal = currentUser.portal;
    const logoSrc = LOGOS[portal] || 'logo_alsatia.png';

    const sideLogo = document.getElementById('entity-logo-container');
    if(sideLogo) sideLogo.innerHTML = `<img src="${logoSrc}" class="entity-logo">`;
    
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = portal;

    const bigLogo = document.getElementById('big-logo-display');
    if(bigLogo) bigLogo.innerHTML = `<img src="${logoSrc}" style="width:250px; filter:drop-shadow(0 20px 30px rgba(0,0,0,0.15));">`;
    
    document.getElementById('welcome-full-name').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('welcome-portal-label').innerText = `Portail Officiel — ${portal}`;

    const navDonors = document.getElementById('nav-donors');
    if (navDonors) {
        navDonors.style.display = (portal === "Institut Alsatia") ? "flex" : "none";
    }

    lucide.createIcons();
}

// ==========================================
// GESTION DE LA NAVIGATION (ONGLETS)
// ==========================================
window.switchTab = (id) => {
    document.querySelectorAll('.side-nav li').forEach(li => li.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${id}`);
    if (activeNav) activeNav.classList.add('active');

    document.querySelectorAll('.page-content').forEach(section => section.classList.remove('active'));
    const targetSection = document.getElementById(`tab-${id}`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.scrollTop = 0; 
    }

    if (id === 'contacts') loadContacts();
    if (id === 'chat') loadChatMessages();
    if (id === 'donors') loadDonors();
    if (id === 'events') loadEvents();

    lucide.createIcons();
};

// ==========================================
// SECTION ANNUAIRE (CONTACTS)
// ==========================================
async function loadContacts() {
    const list = document.getElementById('contacts-list');
    if(!list) return;
    
    // Message d'attente identique à ton original
    list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: #64748b; font-family: 'Inter', sans-serif;">Chargement de l'annuaire de l'Alsatia...</p>`;
    
    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('portal', { ascending: true })
        .order('last_name', { ascending: true });

    if (error) {
        list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 20px;">Erreur lors du chargement des contacts.</p>`;
        return;
    }

    // Rendu strict sans aucune simplification des styles inline
    list.innerHTML = users.map(u => `
        <div class="contact-card" style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; justify-content:space-between; min-height:180px; transition: transform 0.2s ease, box-shadow 0.2s ease;">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <span style="font-size:0.65rem; font-weight:800; color:#d4af37; letter-spacing:1px; text-transform:uppercase; font-family: 'Montserrat', sans-serif;">${u.portal}</span>
                    <i data-lucide="shield-check" style="width:14px; height:14px; color:#d4af37; opacity:0.5;"></i>
                </div>
                <h3 style="margin:8px 0 5px 0; font-size:1.1rem; color:#1e293b; font-family: 'Playfair Display', serif; font-weight: 700;">${u.first_name} ${u.last_name.toUpperCase()}</h3>
                <p style="font-size:0.85rem; color:#64748b; font-weight: 500;">${u.job_title || 'Collaborateur Alsatia'}</p>
            </div>
            <div style="display:flex; gap:10px; margin-top:20px; border-top:1px solid #f1f5f9; padding-top:15px;">
                <a href="mailto:${u.email}" style="flex:1; text-align:center; text-decoration:none; color:#1e293b; background:#f8fafc; padding:10px; border-radius:8px; font-size:0.75rem; border:1px solid #e2e8f0; font-weight:700; transition: background 0.2s;">
                    <i data-lucide="mail" style="width:12px; height:12px; vertical-align:middle; margin-right:5px;"></i>EMAIL
                </a>
                ${u.phone ? `
                <a href="tel:${u.phone}" style="flex:1; text-align:center; text-decoration:none; color:#1e293b; background:#f8fafc; padding:10px; border-radius:8px; font-size:0.75rem; border:1px solid #e2e8f0; font-weight:700; transition: background 0.2s;">
                    <i data-lucide="phone" style="width:12px; height:12px; vertical-align:middle; margin-right:5px;"></i>APPEL
                </a>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
}

// ==========================================
// SECTION MON PROFIL (VERSION COMPLÈTE + EMAIL & PIN)
// ==========================================
window.openProfileModal = async () => {
    // On force la récupération pour avoir les données les plus récentes
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error || !profile) return window.showNotice("Erreur Profil", "Impossible de récupérer vos informations.", "error");

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--gold); padding-bottom:15px; margin-bottom:25px;">
            <h3 style="margin:0; color:var(--primary); font-family: 'Playfair Display', serif; letter-spacing:1px;">
                <i data-lucide="user-cog" style="width:22px; height:22px; vertical-align:middle; margin-right:10px; color:var(--gold);"></i>GESTION DU COMPTE
            </h3>
            <button onclick="closeCustomModal()" style="border:none; background:none; font-size:1.5rem; cursor:pointer; color:#94a3b8;">&times;</button>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
                <label class="mini-label">PRÉNOM</label>
                <input type="text" id="prof-first" class="luxe-input" value="${profile.first_name || ''}">
            </div>
            <div class="form-group">
                <label class="mini-label">NOM</label>
                <input type="text" id="prof-last" class="luxe-input" value="${profile.last_name || ''}">
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top:20px;">
            <div class="form-group">
                <label class="mini-label">ADRESSE EMAIL (IDENTIFIANT)</label>
                <input type="email" id="prof-email" class="luxe-input" value="${profile.email || ''}">
            </div>
            <div class="form-group">
                <label class="mini-label">NOUVEAU CODE PIN (4 CHIFFRES)</label>
                <input type="password" id="prof-pin" class="luxe-input" maxlength="4" placeholder="••••" value="${profile.pin || ''}">
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top:20px;">
            <div class="form-group">
                <label class="mini-label">FONCTION ACTUELLE</label>
                <input type="text" id="prof-job" class="luxe-input" value="${profile.job_title || ''}">
            </div>
            <div class="form-group">
                <label class="mini-label">TÉLÉPHONE DIRECT</label>
                <input type="text" id="prof-phone" class="luxe-input" value="${profile.phone || ''}">
            </div>
        </div>

        <div style="background: rgba(197, 160, 89, 0.05); padding: 15px; border-radius: 12px; margin-top: 25px; border: 1px dashed var(--gold); display:flex; gap:12px; align-items:center;">
            <i data-lucide="shield-check" style="color:var(--gold); width:24px; height:24px; flex-shrink:0;"></i>
            <p style="margin:0; font-size:0.75rem; color:var(--primary); line-height:1.4;">
                Compte rattaché au portail <strong>${profile.portal}</strong>.<br>
                <span style="opacity:0.7;">Toute modification de l'email ou du PIN sera effective dès la prochaine connexion.</span>
            </p>
        </div>

        <button onclick="window.saveMyProfile()" class="btn-gold" style="width:100%; margin-top:30px; height:50px; font-weight:800; letter-spacing:1px;">
            SAUVEGARDER LES MODIFICATIONS
        </button>
    `;
    lucide.createIcons();
};

window.saveMyProfile = async () => {
    const emailVal = document.getElementById('prof-email').value.trim();
    const pinVal = document.getElementById('prof-pin').value.trim();

    const updates = {
        first_name: document.getElementById('prof-first').value.trim(),
        last_name: document.getElementById('prof-last').value.trim(),
        email: emailVal,
        pin: pinVal,
        job_title: document.getElementById('prof-job').value.trim(),
        phone: document.getElementById('prof-phone').value.trim()
    };

    // VALIDATIONS SÉCURITÉ
    if (!updates.first_name || !updates.last_name || !updates.email || !updates.pin) {
        return window.showNotice("Champs obligatoires", "Prénom, Nom, Email et PIN sont requis.", "error");
    }

    if (updates.pin.length !== 4 || isNaN(updates.pin)) {
        return window.showNotice("Format PIN", "Le code PIN doit être composé de 4 chiffres.", "error");
    }

    const { error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

    if (error) {
        console.error("Update Error:", error);
        return window.showNotice("Erreur SQL", "Impossible de sauvegarder : l'email est peut-être déjà utilisé.", "error");
    }

    // MISE À JOUR DE LA SESSION LOCALE
    currentUser = { ...currentUser, ...updates };
    localStorage.setItem('alsatia_user', JSON.stringify(currentUser));

    // REFRESH INTERFACE & FEEDBACK
    initInterface(); 
    closeCustomModal();
    window.showNotice("Profil mis à jour", "Vos informations de compte ont été synchronisées avec succès.");
};

// ==========================================
// CRM - GESTION INTÉGRALE DES DONATEURS
// ==========================================

// 1. CHARGEMENT, CALCULS ET FILTRAGE
async function loadDonors() {
    const { data, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });

    if (error) return console.error("Erreur CRM:", error);
    allDonorsData = data || [];
    window.filterDonors();
}

window.filterDonors = () => {
    const searchVal = document.getElementById('search-donor')?.value.toLowerCase().trim() || "";
    const entityVal = document.getElementById('filter-entity')?.value || "ALL";

    const filtered = allDonorsData.filter(d => {
        const matchesSearch = 
            (d.last_name || "").toLowerCase().includes(searchVal) || 
            (d.first_name || "").toLowerCase().includes(searchVal) ||
            (d.company_name || "").toLowerCase().includes(searchVal) ||
            (d.origin || "").toLowerCase().includes(searchVal) ||
            (d.city || "").toLowerCase().includes(searchVal);

        const matchesEntity = (entityVal === "ALL" || d.entity === entityVal);
        return matchesSearch && matchesEntity;
    });
    renderDonors(filtered);
};

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    if (!list) return;
    
    list.innerHTML = data.map(d => {
        const dons = d.donations || [];
        const total = dons.reduce((acc, cur) => acc + Number(cur.amount), 0);
        
        // LOGIQUE DE CLIGNOTEMENT : Si un don n'est pas remercié
        const hasUnthanked = dons.some(don => don.thanked === false);
        const blinkClass = hasUnthanked ? 'blink-warning' : '';

        const displayName = d.company_name 
            ? `<b>${d.company_name.toUpperCase()}</b> <span style="font-size:0.75rem;">(${d.last_name})</span>` 
            : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name || ''}`;
            
        return `
            <tr class="${blinkClass}">
                <td>
                    ${displayName}
                    ${hasUnthanked ? '<br><small style="color:#ef4444; font-weight:700; font-size:0.6rem;">⚠️ REMERCIEMENT ATTENDU</small>' : ''}
                </td>
                <td><span class="origin-tag">${d.entity || '-'}</span></td>
                <td style="font-weight:800; color:var(--primary);">${total.toLocaleString()} €</td>
                <td style="text-align:right;">
                    <button onclick="window.openDonorFile('${d.id}')" class="btn-gold" style="padding:5px 12px; font-size:0.7rem;">DOSSIER</button>
                </td>
            </tr>`;
    }).join('');
}

// 2. CRÉATION AVEC SÉLECTION D'ENTITÉ OBLIGATOIRE
window.showAddDonorModal = () => {
    // On récupère le portail de l'utilisateur pour pré-remplir l'entité
    const userPortal = currentUser.portal;

    showCustomModal(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(184, 134, 11, 0.2); padding-bottom:10px;">
            <h3 class="luxe-title" style="margin:0; font-size:1.2rem;">NOUVEAU CONTACT CRM</h3>
            <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.8rem; color:var(--primary); line-height:1;">&times;</button>
        </div>

        <div style="max-height:70vh; overflow-y:auto; padding-right:5px;">
            <p class="mini-label" style="margin-top:0;">IDENTITÉ DU CONTACT</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <input type="text" id="n-d-last" class="luxe-input" placeholder="NOM *">
                <input type="text" id="n-d-first" class="luxe-input" placeholder="PRÉNOM">
            </div>
            
            <p class="mini-label" style="margin-top:15px;">AFFECTATION (ÉCOLE)</p>
            <select id="n-d-entity" class="luxe-input" style="width:100%; border:1px solid var(--gold); background:white;">
                <option value="" disabled>SÉLECTIONNER L'ENTITÉ DU DON *</option>
                <option ${userPortal === 'Institut Alsatia' ? 'selected' : ''}>Institut Alsatia</option>
                <option ${userPortal === 'Academia Alsatia' ? 'selected' : ''}>Academia Alsatia</option>
                <option ${userPortal === 'Cours Herrade de Landsberg' ? 'selected' : ''}>Cours Herrade de Landsberg</option>
                <option ${userPortal === 'Collège Saints Louis et Zélie Martin' ? 'selected' : ''}>Collège Saints Louis et Zélie Martin</option>
            </select>

            <p class="mini-label" style="margin-top:15px;">COORDONNÉES PROFESSIONNELLES ET PERSO</p>
            <input type="text" id="n-d-company" class="luxe-input" placeholder="NOM DE L'ENTREPRISE" style="margin-bottom:10px;">
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                <input type="email" id="n-d-email" class="luxe-input" placeholder="ADRESSE EMAIL">
                <input type="text" id="n-d-phone" class="luxe-input" placeholder="N° DE TÉLÉPHONE">
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 2fr; gap:10px;">
                <input type="text" id="n-d-zip" class="luxe-input" placeholder="CODE POSTAL">
                <input type="text" id="n-d-city" class="luxe-input" placeholder="VILLE">
            </div>
            
            <p class="mini-label" style="margin-top:15px;">SUIVI RELATIONNEL</p>
            <input type="text" id="n-d-origin" class="luxe-input" placeholder="ORIGINE DU CONTACT (ex: Gala 2024, Site Web...)" style="margin-bottom:10px;">
            <textarea id="n-d-notes" class="luxe-input" placeholder="Notes particulières sur ce donateur..." style="height:80px;"></textarea>
            
            <button onclick="window.execCreateDonor()" class="btn-gold" style="width:100%; margin-top:20px; height:50px; font-weight:bold; font-size:0.9rem; letter-spacing:1px;">
                ENREGISTRER DANS LE CRM
            </button>
        </div>
    `);
};
window.execCreateDonor = async () => {
    const last_name = document.getElementById('n-d-last').value;
    const entity = document.getElementById('n-d-entity').value;
    if(!last_name || !entity) return window.showNotice("Erreur", "Nom et Entité requis.");

    const payload = {
        last_name: last_name.toUpperCase(),
        first_name: document.getElementById('n-d-first').value,
        company_name: document.getElementById('n-d-company').value,
        entity: entity,
        email: document.getElementById('n-d-email').value,
        phone: document.getElementById('n-d-phone').value,
        zip_code: document.getElementById('n-d-zip').value,
        city: document.getElementById('n-d-city').value,
        origin: document.getElementById('n-d-origin').value,
        notes: document.getElementById('n-d-notes').value,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };

    const { error } = await supabaseClient.from('donors').insert([payload]);
    if(error) return window.showNotice("Erreur", error.message);
    closeCustomModal();
    loadDonors();
};

// 3. DOSSIER COMPLET (EDITION + HISTORIQUE + REMERCIEMENT)
window.openDonorFile = async (id) => {
    const donor = allDonorsData.find(d => d.id === id);
    if (!donor) return;
    const dons = donor.donations || [];
    
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
            <div>
                <span class="mini-label">ENTITÉ : ${donor.entity || 'N/A'}</span>
                <h3 style="margin:0; color:var(--primary);">DOSSIER DONATEUR</h3>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.exportDonorToExcel('${donor.id}')" class="btn-gold" style="font-size:0.65rem; padding:5px 10px;">EXCEL</button>
                <button onclick="window.askDeleteDonor('${donor.id}', '${donor.last_name.replace(/'/g, "\\'")}')" style="background:#fee2e2; color:#ef4444; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.65rem;">SUPPRIMER</button>
                <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem;">&times;</button>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div>
                <p class="mini-label">COORDONNÉES</p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <input type="text" id="edit-last" class="luxe-input" value="${donor.last_name || ''}">
                    <input type="text" id="edit-first" class="luxe-input" value="${donor.first_name || ''}">
                </div>
                <input type="text" id="edit-company" class="luxe-input" value="${donor.company_name || ''}" placeholder="Entreprise" style="margin-bottom:8px;">
                <input type="email" id="edit-email" class="luxe-input" value="${donor.email || ''}" placeholder="Email" style="margin-bottom:8px;">
                <input type="text" id="edit-phone" class="luxe-input" value="${donor.phone || ''}" placeholder="Tél" style="margin-bottom:8px;">
                <div style="display:grid; grid-template-columns:1fr 2fr; gap:8px;">
                    <input type="text" id="edit-zip" class="luxe-input" value="${donor.zip_code || ''}" placeholder="CP">
                    <input type="text" id="edit-city" class="luxe-input" value="${donor.city || ''}" placeholder="VILLE">
                </div>
            </div>
            <div>
                <p class="mini-label">SUIVI CRM</p>
                <input type="text" id="edit-origin" class="luxe-input" value="${donor.origin || ''}" placeholder="Origine" style="margin-bottom:8px;">
                <textarea id="edit-notes" class="luxe-input" style="height:110px; margin-bottom:10px;">${donor.notes || ''}</textarea>
                <button onclick="window.updateDonorFields('${donor.id}')" class="btn-gold" style="width:100%; height:40px;">ENREGISTRER</button>
            </div>
        </div>

        <div style="margin-top:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <p class="mini-label">HISTORIQUE DES DONS</p>
                <button onclick="window.addDonationPrompt('${id}')" class="btn-gold" style="padding:4px 10px; font-size:0.65rem;">+ AJOUTER UN DON</button>
            </div>
            <div style="max-height:180px; overflow-y:auto; border:1px solid #eee; margin-top:10px; border-radius:8px;">
                <table class="luxe-table">
                    <thead><tr><th>DATE</th><th>MONTANT</th><th>REMERCIÉ ?</th><th style="text-align:right;">ACTION</th></tr></thead>
                    <tbody>
                        ${dons.map(don => `
                            <tr style="${!don.thanked ? 'background:rgba(239, 68, 68, 0.05);' : ''}">
                                <td>${new Date(don.date).toLocaleDateString()}</td>
                                <td style="font-weight:700;">${don.amount}€</td>
                                <td style="text-align:center;">
                                    <input type="checkbox" ${don.thanked ? 'checked' : ''} onchange="window.toggleThanked('${don.id}', this.checked)">
                                </td>
                                <td style="text-align:right;">
                                    <i data-lucide="trash-2" style="width:14px; color:#ef4444; cursor:pointer;" onclick="window.askDeleteDonation('${don.id}')"></i>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    lucide.createIcons();
};

// 4. FONCTIONS DE MISE À JOUR (DONS ET REMERCIEMENTS)
window.toggleThanked = async (donId, isChecked) => {
    await supabaseClient.from('donations').update({ thanked: isChecked }).eq('id', donId);
    loadDonors(); // Rafraîchit pour arrêter le clignotement
};

window.addDonationPrompt = (donorId) => {
    showCustomModal(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 class="luxe-title" style="margin:0;">NOUVEAU DON</h3>
            <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem; color:#94a3b8;">&times;</button>
        </div>

        <input type="number" id="don-amt" class="luxe-input" placeholder="MONTANT (€) *">
        <input type="date" id="don-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}" style="margin-top:10px;">
        
        <select id="don-method" class="luxe-input" style="margin-top:10px;">
            <option value="Virement">Virement</option>
            <option value="Chèque">Chèque</option>
            <option value="Espèces">Espèces</option>
            <option value="CB">CB</option>
        </select>

        <div style="margin-top:15px; font-size:0.8rem;">
            <input type="checkbox" id="don-thanked"> Remerciement déjà fait ?
        </div>

        <button onclick="window.execAddDonation('${donorId}')" class="btn-gold" style="width:100%; margin-top:20px;">VALIDER LE DON</button>
    `);
};

window.execAddDonation = async (donorId) => {
    const amount = document.getElementById('don-amt').value;
    const date = document.getElementById('don-date').value;
    const thanked = document.getElementById('don-thanked').checked;
    if (!amount || !date) return window.showNotice("Erreur", "Champs requis.");

    await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: parseFloat(amount),
        date: date,
        payment_mode: document.getElementById('don-method').value,
        thanked: thanked
    }]);
    closeCustomModal();
    loadDonors();
};

window.updateDonorFields = async (id) => {
    const payload = {
        last_name: document.getElementById('edit-last').value.toUpperCase(),
        first_name: document.getElementById('edit-first').value,
        company_name: document.getElementById('edit-company').value,
        email: document.getElementById('edit-email').value,
        phone: document.getElementById('edit-phone').value,
        zip_code: document.getElementById('edit-zip').value,
        city: document.getElementById('edit-city').value,
        origin: document.getElementById('edit-origin').value,
        notes: document.getElementById('edit-notes').value,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };
    await supabaseClient.from('donors').update(payload).eq('id', id);
    window.showNotice("Succès", "Fiche mise à jour.");
    loadDonors();
};

// 5. SUPPRESSIONS ET EXPORTS
window.askDeleteDonation = (donationId) => {
    window.askConfirmation("SUPPRIMER DON ?", "Irréversible.", async () => {
        await supabaseClient.from('donations').delete().eq('id', donationId);
        closeCustomModal(); loadDonors();
    });
};

window.askDeleteDonor = (id, name) => {
    window.askConfirmation("SUPPRIMER CONTACT ?", `Effacer ${name} ?`, async () => {
        await supabaseClient.from('donations').delete().eq('donor_id', id);
        await supabaseClient.from('donors').delete().eq('id', id);
        closeCustomModal(); loadDonors();
    });
};

window.exportDonorToExcel = (id) => {
    const d = allDonorsData.find(x => x.id === id);
    if (!d) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([d]);
    XLSX.utils.book_append_sheet(wb, ws, "Fiche");
    if(d.donations) {
        const wsDons = XLSX.utils.json_to_sheet(d.donations);
        XLSX.utils.book_append_sheet(wb, wsDons, "Historique_Dons");
    }
    XLSX.writeFile(wb, `Fiche_${d.last_name}.xlsx`);
};

window.askConfirmation = (title, message, onConfirm) => {
    showCustomModal(`
        <div style="text-align:center;">
            <h3 style="color:var(--primary);">${title}</h3>
            <p style="font-size:0.85rem; margin-bottom:20px;">${message}</p>
            <div style="display:flex; gap:10px;">
                <button onclick="closeCustomModal()" class="luxe-input" style="flex:1;">NON</button>
                <button id="btn-confirm" class="btn-gold" style="flex:1; background:#ef4444; border:none; color:white;">OUI</button>
            </div>
        </div>
    `);
    document.getElementById('btn-confirm').onclick = onConfirm;
};

// ==========================================
// GESTION DES ÉVÉNEMENTS - WORKFLOW RÉSEAUX
// ==========================================

// 1. CHARGEMENT GLOBAL (Toutes les entités voient tout)
async function loadEvents() {
    const { data, error } = await supabaseClient
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

    const container = document.getElementById('events-container');
    if (!container) return;

    if (error || !data || data.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:40px; color:#64748b;">Aucun événement planifié pour le moment.</p>`;
        return;
    }

    container.innerHTML = data.map(ev => {
        // Un événement est "Prêt" si Heure, Lieu et Description sont remplis
        const isReady = ev.event_time && ev.location && ev.description && ev.description.trim().length > 5;
        
        return `
            <div class="event-card" onclick="window.openEventDetails('${ev.id}')" 
                 style="background:white; border-radius:12px; border:1px solid #e2e8f0; border-left: 6px solid ${isReady ? '#22c55e' : '#f59e0b'}; cursor:pointer; transition:all 0.3s ease; padding:15px; position:relative;">
                
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <span class="mini-label" style="color:var(--gold);">${ev.entity}</span>
                    <span style="font-size:0.6rem; font-weight:800; padding:2px 6px; border-radius:4px; background:${isReady ? '#f0fdf4' : '#fff7ed'}; color:${isReady ? '#166534' : '#9a3412'}; border:1px solid ${isReady ? '#bbf7d0' : '#ffedd5'};">
                        ${isReady ? '✅ PRÊT RÉSEAUX' : '⏳ INFOS MANQUANTES'}
                    </span>
                </div>

                <h3 style="margin:5px 0; font-family:'Playfair Display'; color:#1e293b; font-size:1.1rem;">${ev.title}</h3>
                
                <div style="font-size:0.8rem; color:#64748b; margin-top:10px;">
                    <i data-lucide="calendar" style="width:12px; vertical-align:middle;"></i> 
                    ${new Date(ev.event_date).toLocaleDateString()} 
                    ${ev.event_time ? ` à ${ev.event_time.substring(0,5)}` : ''}
                </div>
                <div style="font-size:0.8rem; color:#64748b; margin-top:4px;">
                    <i data-lucide="map-pin" style="width:12px; vertical-align:middle;"></i> 
                    ${ev.location || 'Lieu à définir'}
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

// 2. CRÉATION (ÉTAPE 1 DU WORKFLOW)
window.showAddEventModal = () => {
    const userPortal = currentUser.portal;
    showCustomModal(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 class="luxe-title" style="margin:0;">PLANIFIER UN ÉVÉNEMENT</h3>
            <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem; color:#94a3b8;">&times;</button>
        </div>

        <p class="mini-label">TITRE DE L'ÉVÉNEMENT *</p>
        <input type="text" id="ev-title" class="luxe-input" placeholder="Ex: Gala de Charité, Portes Ouvertes...">
        
        <p class="mini-label" style="margin-top:15px;">ENTITÉ CONCERNÉE *</p>
        <select id="ev-entity" class="luxe-input" style="width:100%; border:1px solid var(--gold); background:white;">
            <option ${userPortal === 'Institut Alsatia' ? 'selected' : ''}>Institut Alsatia</option>
            <option ${userPortal === 'Academia Alsatia' ? 'selected' : ''}>Academia Alsatia</option>
            <option ${userPortal === 'Cours Herrade de Landsberg' ? 'selected' : ''}>Cours Herrade de Landsberg</option>
            <option ${userPortal === 'Collège Saints Louis et Zélie Martin' ? 'selected' : ''}>Collège Saints Louis et Zélie Martin</option>
        </select>

        <p class="mini-label" style="margin-top:15px;">DATE PRÉVUE *</p>
        <input type="date" id="ev-date" class="luxe-input">

        <button onclick="window.execCreateEvent()" class="btn-gold" style="width:100%; margin-top:25px; height:45px; font-weight:bold;">
            CRÉER ET ATTENDRE LES INFOS
        </button>
    `);
};

window.execCreateEvent = async () => {
    const title = document.getElementById('ev-title').value.trim();
    const event_date = document.getElementById('ev-date').value;
    const entity = document.getElementById('ev-entity').value;
    
    if(!title || !event_date) return window.showNotice("Erreur", "Titre et Date obligatoires.");

    const payload = {
        title, 
        event_date,
        entity,
        created_by: `${currentUser.first_name} ${currentUser.last_name}`
    };

    const { error } = await supabaseClient.from('events').insert([payload]);
    if(error) return window.showNotice("Erreur", error.message);
    
    closeCustomModal();
    loadEvents();
};

// 3. DOSSIER LOGISTIQUE (ÉTAPE 2 & 3)
window.openEventDetails = async (id) => {
    const { data: ev } = await supabaseClient.from('events').select('*').eq('id', id).single();
    if(!ev) return;

    const isReady = ev.event_time && ev.location && ev.description && ev.description.trim().length > 5;

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <span class="mini-label">SITUATION : ${ev.entity}</span>
                <h2 style="margin:0; font-family:'Playfair Display';">${ev.title}</h2>
            </div>
            <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem;">&times;</button>
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:25px;">
            
            <div>
                <p class="mini-label" style="color:var(--primary); font-weight:800; border-bottom:1px solid #eee; padding-bottom:5px;">1. COMPLÉTER LE DOSSIER</p>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:15px;">
                    <div>
                        <label class="mini-label">HEURE DE DÉBUT</label>
                        <input type="time" class="luxe-input" value="${ev.event_time || ''}" 
                               onchange="window.updateEventField('${ev.id}', 'event_time', this.value)">
                    </div>
                    <div>
                        <label class="mini-label">DATE (MODIFIER)</label>
                        <input type="date" class="luxe-input" value="${ev.event_date}" 
                               onchange="window.updateEventField('${ev.id}', 'event_date', this.value)">
                    </div>
                </div>

                <label class="mini-label" style="margin-top:15px; display:block;">LIEU PRÉCIS</label>
                <input type="text" class="luxe-input" value="${ev.location || ''}" placeholder="Adresse, Salle..."
                       onblur="window.updateEventField('${ev.id}', 'location', this.value)">
                
                <label class="mini-label" style="margin-top:15px; display:block;">DESCRIPTION / POST RÉSEAUX</label>
                <textarea class="luxe-input" style="height:120px;" placeholder="Détails de l'événement et texte pour les réseaux sociaux..."
                          onblur="window.updateEventField('${ev.id}', 'description', this.value)">${ev.description || ''}</textarea>
                
                <div style="margin-top:15px; background:#f8fafc; padding:10px; border-radius:8px; border:1px dashed #cbd5e1;">
                    <label class="mini-label">MÉDIAS (PHOTOS / DOCS)</label>
                    <input type="file" id="ev-media-up" style="display:none;" onchange="window.showNotice('Système', 'Fichier prêt')">
                    <button onclick="document.getElementById('ev-media-up').click()" class="btn-gold" style="width:100%; font-size:0.7rem; margin-top:5px;">
                        <i data-lucide="image" style="width:12px; margin-right:5px;"></i> AJOUTER DES PHOTOS
                    </button>
                </div>
            </div>

            <div style="background:${isReady ? '#f0fdf4' : '#fff7ed'}; padding:20px; border-radius:12px; border:1px solid ${isReady ? '#bbf7d0' : '#ffedd5'}; align-self: start;">
                <p class="mini-label" style="color:${isReady ? '#166534' : '#9a3412'}; font-weight:800;">2. EXPLOITATION RÉSEAUX</p>
                
                ${isReady ? `
                    <p style="font-size:0.8rem; color:#166534; margin:15px 0;">✨ <b>Statut : Prêt.</b> Toutes les informations sont collectées pour la communication.</p>
                    
                    <button onclick="window.copyEventText('${ev.id}')" class="btn-gold" style="width:100%; background:#22c55e; border:none; margin-bottom:10px; height:45px;">
                        <i data-lucide="copy" style="width:14px; margin-right:8px;"></i> COPIER LA DESCRIPTION
                    </button>
                    
                    <button onclick="window.showNotice('Media', 'Préparation de l\\'archive photos...')" class="btn-gold" style="width:100%; background:#1e293b; border:none; height:45px;">
                        <i data-lucide="download" style="width:14px; margin-right:8px;"></i> TÉLÉCHARGER PHOTOS
                    </button>
                ` : `
                    <p style="font-size:0.8rem; color:#9a3412; margin:15px 0; line-height:1.4;">
                        ⚠️ <b>En attente d'infos.</b><br>
                        Veuillez renseigner l'heure, le lieu et une description pour débloquer les outils de communication.
                    </p>
                    <div style="opacity:0.2; pointer-events:none;">
                        <button class="btn-gold" style="width:100%; margin-bottom:10px;">COPIER LA DESCRIPTION</button>
                        <button class="btn-gold" style="width:100%;">TÉLÉCHARGER PHOTOS</button>
                    </div>
                `}
            </div>
        </div>

        <div style="margin-top:30px; padding-top:15px; border-top:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <button onclick="window.askDeleteEvent('${ev.id}', '${ev.title.replace(/'/g, "\\'")}')" style="color:#ef4444; background:none; border:none; font-size:0.7rem; cursor:pointer;">SUPPRIMER L'ÉVÉNEMENT</button>
            <span style="font-size:0.6rem; color:#94a3b8;">Créé par ${ev.created_by || 'Système'}</span>
        </div>
    `;
    lucide.createIcons();
};

// 4. UTILITAIRES DE MISE À JOUR ET COPIE
window.updateEventField = async (id, field, value) => {
    const { error } = await supabaseClient.from('events').update({ [field]: value }).eq('id', id);
    if(error) console.error("Erreur MAJ:", error);
    // On ne ferme pas le modal, on recharge juste le fond pour mettre à jour les couleurs du dashboard
    loadEvents(); 
};

window.copyEventText = async (id) => {
    const { data } = await supabaseClient.from('events').select('description').eq('id', id).single();
    if (data && data.description) {
        navigator.clipboard.writeText(data.description).then(() => {
            window.showNotice("Copié !", "La description est dans votre presse-papier.");
        });
    }
};

window.askDeleteEvent = (id, title) => {
    window.askConfirmation("SUPPRIMER L'ÉVÉNEMENT ?", `Voulez-vous vraiment supprimer "${title}" ?`, async () => {
        await supabaseClient.from('events').delete().eq('id', id);
        closeCustomModal();
        loadEvents();
    });
};
