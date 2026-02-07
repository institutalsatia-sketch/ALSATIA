// ==========================================
// CONFIGURATION SUPABASE & ÉTAT GLOBAL
// ==========================================
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let allUsersForMentions = []; 
let selectedChatFile = null; // CORRECTION: Renommé de selectedFile en selectedChatFile

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

// ==========================================
// MOTEUR DE DIALOGUE DE LUXE (INDISPENSABLE)
// ==========================================
window.alsatiaConfirm = (title, text, callback, isDanger = false) => {
    // Vérifie si la fonction showCustomModal existe pour éviter un autre crash
    if (typeof showCustomModal !== 'function') {
        console.error("Erreur : showCustomModal n'est pas définie dans votre script principal.");
        return;
    }

    showCustomModal(`
        <div class="confirm-box" style="text-align:center; padding:10px;">
            <h3 class="luxe-title" style="${isDanger ? 'color:var(--danger)' : ''}; margin-bottom:15px;">${title}</h3>
            <p style="margin-bottom:25px; color:var(--text-main); font-size:0.95rem;">${text}</p>
            <div class="confirm-actions" style="display:flex; gap:12px; justify-content:center;">
                <button onclick="closeCustomModal()" class="btn-gold" style="background:var(--border); color:var(--text-main); border:none; padding:10px 20px; border-radius:12px; cursor:pointer;">ANNULER</button>
                <button id="modal-confirm-action" class="btn-gold" style="${isDanger ? 'background:var(--danger)' : ''}; border:none; padding:10px 20px; border-radius:12px; cursor:pointer; color:white;">CONFIRMER</button>
            </div>
        </div>
    `);

    // On lie l'action au bouton de confirmation
    const confirmBtn = document.getElementById('modal-confirm-action');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            callback();
            closeCustomModal();
        };
    }
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

// CORRECTION: Suppression du bloc dupliqué (anciennes lignes 88-104)

// ==========================================
// INITIALISATION AU CHARGEMENT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!currentUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    
    initInterface();
    
    // CORRECTION: Ajout du chargement initial des données
    loadContacts();
    if(currentUser.portal === "Institut Alsatia") {
        loadDonors();
    }
    loadEvents();
    
    // CORRECTION: Initialisation du chat au démarrage
    window.loadChatSubjects();
    window.loadChatMessages();
    window.subscribeToChat();
    
    // CORRECTION: Initialiser les icônes Lucide
    if(window.lucide) lucide.createIcons();
});

function initInterface() {
    const portal = currentUser.portal;
    const logoSrc = LOGOS[portal] || 'logo_alsatia.png';

    const sideLogo = document.getElementById('entity-logo-container');
    if(sideLogo) sideLogo.innerHTML = `<img src="${logoSrc}" class="entity-logo">`;
    
    // On ajoute des protections "if" pour éviter l'erreur "null"
    const nameDisplay = document.getElementById('user-name-display');
    if(nameDisplay) nameDisplay.innerText = `${currentUser.first_name} ${currentUser.last_name}`;

    const portalDisplay = document.getElementById('current-portal-display');
    if(portalDisplay) portalDisplay.innerText = portal;

    const bigLogo = document.getElementById('big-logo-display');
    if(bigLogo) bigLogo.innerHTML = `<img src="${logoSrc}" style="width:250px; filter:drop-shadow(0 20px 30px rgba(0,0,0,0.15));">`;
    
    const welcomeName = document.getElementById('welcome-full-name');
    if(welcomeName) welcomeName.innerText = `${currentUser.first_name} ${currentUser.last_name}`;

    const welcomePortal = document.getElementById('welcome-portal-label');
    if(welcomePortal) welcomePortal.innerText = `Portail Officiel — ${portal}`;

    const navDonors = document.getElementById('nav-donors');
    if (navDonors) {
        navDonors.style.display = (portal === "Institut Alsatia") ? "flex" : "none";
    }

    if(window.lucide) lucide.createIcons();
}

// ==========================================
// GESTION DE LA NAVIGATION (ONGLETS)
// ==========================================
window.switchTab = (tabId) => {
    console.log("Changement d'onglet vers :", tabId);

    // 1. Gère l'affichage visuel des onglets
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));

    // CORRECTION: Ajout du préfixe "tab-" pour trouver le bon élément
    const targetPage = document.getElementById('tab-' + tabId);
    if (targetPage) targetPage.classList.add('active');
    
    // On cherche l'élément de menu correspondant pour mettre l'icône en doré
    const menuIcon = document.querySelector(`li[onclick*="${tabId}"]`);
    if (menuIcon) menuIcon.classList.add('active');

    // 2. CHARGEMENT DES DONNÉES SPÉCIFIQUES
    if (tabId === 'donors') loadDonors();
    if (tabId === 'events') loadEvents();
    if (tabId === 'contacts') loadContacts();
    
    // Activation de la Messagerie que nous venons de créer
    if (tabId === 'chat') {
        window.loadChatSubjects();
        window.loadChatMessages();
        window.subscribeToChat();
    }
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
        list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: #ef4444;">Erreur de chargement : ${error.message}</p>`;
        return;
    }

    if (!users || users.length === 0) {
        list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: #64748b;">Aucun contact trouvé.</p>`;
        return;
    }

    list.innerHTML = users.map(user => `
        <tr>
            <td style="font-weight:600;">${user.last_name.toUpperCase()}</td>
            <td>${user.first_name}</td>
            <td><span class="origin-tag">${user.role || 'Membre'}</span></td>
            <td>${user.portal}</td>
            <td style="text-align:right;">
                <a href="mailto:${user.email}" style="color:var(--gold); text-decoration:none; font-weight:600; font-size:0.75rem;">CONTACTER</a>
            </td>
        </tr>
    `).join('');
}

window.filterContacts = () => {
    const search = document.getElementById('contact-search').value.toLowerCase();
    const rows = document.querySelectorAll('#contacts-list tr');
    
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
};

// ==========================================
// SECTION DONATEURS (Base CRM)
// ==========================================
async function loadDonors() {
    const list = document.getElementById('donors-list');
    if(!list) return;
    
    list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;">Chargement de la base donateurs...</td></tr>`;
    
    const { data, error } = await supabaseClient
        .from('donors')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#ef4444;">Erreur : ${error.message}</td></tr>`;
        return;
    }

    allDonorsData = data || [];
    
    if (allDonorsData.length === 0) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;">Aucun donateur enregistré.</td></tr>`;
        return;
    }

    renderDonorsList(allDonorsData);
    updateDonorsStats();
}

function renderDonorsList(donors) {
    const list = document.getElementById('donors-list');
    if(!list) return;
    
    list.innerHTML = donors.map(d => `
        <tr>
            <td>
                <div style="font-weight:700; font-size:0.95rem;">${d.last_name.toUpperCase()} ${d.first_name}</div>
                ${d.company ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${d.company}</div>` : ''}
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">📍 ${d.city || 'Non renseigné'}</div>
            </td>
            <td><span class="origin-tag">${d.entity}</span></td>
            <td style="font-weight:700; color:var(--gold); font-size:1.1rem;">${d.total_donations || 0} €</td>
            <td style="text-align:right;">
                <button onclick="viewDonorDetail('${d.id}')" class="btn-gold" style="padding:8px 15px; font-size:0.7rem;">VOIR</button>
            </td>
        </tr>
    `).join('');
}

window.filterDonors = () => {
    const search = document.getElementById('search-donor').value.toLowerCase();
    const entity = document.getElementById('filter-entity').value;
    
    let filtered = allDonorsData.filter(d => {
        const matchSearch = d.first_name.toLowerCase().includes(search) || 
                          d.last_name.toLowerCase().includes(search) ||
                          (d.city && d.city.toLowerCase().includes(search)) ||
                          (d.company && d.company.toLowerCase().includes(search));
        
        const matchEntity = entity === 'ALL' || d.entity === entity;
        
        return matchSearch && matchEntity;
    });
    
    renderDonorsList(filtered);
};

function updateDonorsStats() {
    const count = document.getElementById('stat-donors-count');
    if(count) count.innerText = allDonorsData.length;
}

window.viewDonorDetail = async (donorId) => {
    const { data: donor } = await supabaseClient.from('donors').select('*').eq('id', donorId).single();
    if (!donor) return;

    const { data: donations } = await supabaseClient.from('donations')
        .select('*').eq('donor_id', donorId).order('date', { ascending: false });

    showCustomModal(`
        <h2 class="luxe-title">${donor.last_name.toUpperCase()} ${donor.first_name}</h2>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:25px;">
            <div><span class="mini-label">Email</span><br>${donor.email || 'Non renseigné'}</div>
            <div><span class="mini-label">Téléphone</span><br>${donor.phone || 'Non renseigné'}</div>
            <div><span class="mini-label">Ville</span><br>${donor.city || 'Non renseigné'}</div>
            <div><span class="mini-label">Total Dons</span><br><span style="color:var(--gold); font-weight:800; font-size:1.2rem;">${donor.total_donations || 0} €</span></div>
        </div>
        
        <h3 style="font-size:0.9rem; font-weight:800; color:var(--text-muted); margin-bottom:10px;">HISTORIQUE DES DONS</h3>
        <div style="max-height:300px; overflow-y:auto;">
            ${donations && donations.length > 0 ? donations.map(don => `
                <div style="padding:12px; background:#f8fafc; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(don.date).toLocaleDateString('fr-FR')}</div>
                        <div style="font-size:0.75rem; margin-top:2px;">${don.payment_method || 'Non spécifié'}</div>
                    </div>
                    <div style="font-weight:800; color:var(--gold); font-size:1.1rem;">${don.amount} €</div>
                </div>
            `).join('') : '<p style="text-align:center; color:#64748b; padding:20px;">Aucun don enregistré</p>'}
        </div>
        
        <div style="display:flex; gap:10px; margin-top:25px;">
            <button onclick="promptAddDonation('${donor.id}')" class="btn-gold" style="flex:1;">AJOUTER DON</button>
            <button onclick="promptEditDonor('${donor.id}')" class="btn-gold" style="flex:1; background:var(--primary);">MODIFIER</button>
            <button onclick="deleteDonor('${donor.id}')" class="btn-gold" style="background:var(--danger);">SUPPRIMER</button>
        </div>
    `);
};

window.showAddDonorModal = () => {
    showCustomModal(`
        <h2 class="luxe-title">NOUVEAU DONATEUR</h2>
        <div style="display:grid; gap:15px;">
            <div><span class="mini-label">Prénom</span><input type="text" id="donor-fname" class="luxe-input"></div>
            <div><span class="mini-label">Nom</span><input type="text" id="donor-lname" class="luxe-input"></div>
            <div><span class="mini-label">Email</span><input type="email" id="donor-email" class="luxe-input"></div>
            <div><span class="mini-label">Téléphone</span><input type="tel" id="donor-phone" class="luxe-input"></div>
            <div><span class="mini-label">Ville</span><input type="text" id="donor-city" class="luxe-input"></div>
            <div><span class="mini-label">Entreprise (optionnel)</span><input type="text" id="donor-company" class="luxe-input"></div>
            <div><span class="mini-label">Entité</span>
                <select id="donor-entity" class="luxe-input">
                    <option>Institut Alsatia</option>
                    <option>Academia Alsatia</option>
                    <option>Cours Herrade de Landsberg</option>
                    <option>Collège Saints Louis et Zélie Martin</option>
                </select>
            </div>
            <button onclick="saveDonor()" class="btn-gold" style="margin-top:10px;">ENREGISTRER</button>
        </div>
    `);
};

window.saveDonor = async () => {
    const donor = {
        first_name: document.getElementById('donor-fname').value.trim(),
        last_name: document.getElementById('donor-lname').value.trim(),
        email: document.getElementById('donor-email').value.trim(),
        phone: document.getElementById('donor-phone').value.trim(),
        city: document.getElementById('donor-city').value.trim(),
        company: document.getElementById('donor-company').value.trim(),
        entity: document.getElementById('donor-entity').value,
        total_donations: 0
    };

    if(!donor.first_name || !donor.last_name) {
        return alert("Le prénom et le nom sont obligatoires");
    }

    const { error } = await supabaseClient.from('donors').insert([donor]);
    
    if(error) {
        alert("Erreur : " + error.message);
    } else {
        window.showNotice("Succès", "Donateur ajouté");
        closeCustomModal();
        loadDonors();
    }
};

window.promptAddDonation = (donorId) => {
    showCustomModal(`
        <h2 class="luxe-title">ENREGISTRER UN DON</h2>
        <div style="display:grid; gap:15px;">
            <div><span class="mini-label">Montant (€)</span><input type="number" id="donation-amount" class="luxe-input" placeholder="150"></div>
            <div><span class="mini-label">Date</span><input type="date" id="donation-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div><span class="mini-label">Moyen de paiement</span>
                <select id="donation-method" class="luxe-input">
                    <option>Virement</option>
                    <option>Chèque</option>
                    <option>Espèces</option>
                    <option>Carte bancaire</option>
                </select>
            </div>
            <button onclick="saveDonation('${donorId}')" class="btn-gold">ENREGISTRER LE DON</button>
        </div>
    `);
};

window.saveDonation = async (donorId) => {
    const amount = parseFloat(document.getElementById('donation-amount').value);
    const date = document.getElementById('donation-date').value;
    const method = document.getElementById('donation-method').value;

    if(!amount || amount <= 0) return alert("Montant invalide");

    await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: amount,
        date: date,
        payment_method: method
    }]);

    const { data: donor } = await supabaseClient.from('donors').select('total_donations').eq('id', donorId).single();
    const newTotal = (donor.total_donations || 0) + amount;
    
    await supabaseClient.from('donors').update({ total_donations: newTotal }).eq('id', donorId);

    window.showNotice("Succès", `Don de ${amount}€ enregistré`);
    closeCustomModal();
    loadDonors();
};

window.promptEditDonor = async (donorId) => {
    const { data: donor } = await supabaseClient.from('donors').select('*').eq('id', donorId).single();
    if(!donor) return;

    showCustomModal(`
        <h2 class="luxe-title">MODIFIER DONATEUR</h2>
        <div style="display:grid; gap:15px;">
            <div><span class="mini-label">Prénom</span><input type="text" id="edit-fname" class="luxe-input" value="${donor.first_name}"></div>
            <div><span class="mini-label">Nom</span><input type="text" id="edit-lname" class="luxe-input" value="${donor.last_name}"></div>
            <div><span class="mini-label">Email</span><input type="email" id="edit-email" class="luxe-input" value="${donor.email || ''}"></div>
            <div><span class="mini-label">Téléphone</span><input type="tel" id="edit-phone" class="luxe-input" value="${donor.phone || ''}"></div>
            <div><span class="mini-label">Ville</span><input type="text" id="edit-city" class="luxe-input" value="${donor.city || ''}"></div>
            <div><span class="mini-label">Entreprise</span><input type="text" id="edit-company" class="luxe-input" value="${donor.company || ''}"></div>
            <button onclick="updateDonor('${donorId}')" class="btn-gold">SAUVEGARDER</button>
        </div>
    `);
};

window.updateDonor = async (donorId) => {
    const updates = {
        first_name: document.getElementById('edit-fname').value.trim(),
        last_name: document.getElementById('edit-lname').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
        city: document.getElementById('edit-city').value.trim(),
        company: document.getElementById('edit-company').value.trim()
    };

    await supabaseClient.from('donors').update(updates).eq('id', donorId);
    window.showNotice("Succès", "Donateur mis à jour");
    closeCustomModal();
    loadDonors();
};

window.deleteDonor = (donorId) => {
    window.alsatiaConfirm("SUPPRIMER DONATEUR", "Voulez-vous vraiment supprimer ce donateur et tout son historique ?", async () => {
        await supabaseClient.from('donations').delete().eq('donor_id', donorId);
        await supabaseClient.from('donors').delete().eq('id', donorId);
        window.showNotice("Supprimé", "Donateur effacé");
        closeCustomModal();
        loadDonors();
    }, true);
};

window.exportToExcel = async () => {
    if (!allDonorsData || allDonorsData.length === 0) {
        return alert("Aucune donnée à exporter");
    }

    const formatted = allDonorsData.map(d => ({
        'Prénom': d.first_name,
        'Nom': d.last_name,
        'Email': d.email || '',
        'Téléphone': d.phone || '',
        'Ville': d.city || '',
        'Entreprise': d.company || '',
        'Entité': d.entity,
        'Total Dons': d.total_donations || 0
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donateurs");
    XLSX.writeFile(wb, `Donateurs_Alsatia_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ==========================================
// SECTION ÉVÉNEMENTS
// ==========================================
async function loadEvents() {
    const container = document.getElementById('events-container');
    if(!container) return;
    
    container.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">Chargement des événements...</p>`;
    
    const { data, error } = await supabaseClient
        .from('events')
        .select('*')
        .order('date', { ascending: true });

    if (error) {
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:#ef4444;">Erreur : ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">Aucun événement planifié</p>`;
        updateEventsStats(0);
        return;
    }

    container.innerHTML = data.map(evt => {
        const dateObj = new Date(evt.date);
        const isPast = dateObj < new Date();
        
        return `
            <div class="event-card ${isPast ? 'blink-warning' : ''}" onclick="viewEventDetail('${evt.id}')">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:15px;">
                    <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary);">${evt.title}</h3>
                    ${isPast ? '<span style="background:var(--danger); color:white; padding:4px 10px; border-radius:20px; font-size:0.65rem; font-weight:800;">PASSÉ</span>' : ''}
                </div>
                <div style="display:flex; gap:8px; align-items:center; color:var(--text-muted); font-size:0.85rem; margin-bottom:10px;">
                    <i data-lucide="calendar" style="width:14px;"></i>
                    <span>${dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center; color:var(--text-muted); font-size:0.85rem; margin-bottom:15px;">
                    <i data-lucide="map-pin" style="width:14px;"></i>
                    <span>${evt.location || 'Lieu non défini'}</span>
                </div>
                <p style="color:var(--text-muted); font-size:0.9rem; line-height:1.5;">${evt.description ? evt.description.substring(0, 100) + '...' : 'Aucune description'}</p>
                <div style="margin-top:15px; padding-top:15px; border-top:1px solid var(--border);">
                    <span class="origin-tag">${evt.entity}</span>
                </div>
            </div>
        `;
    }).join('');
    
    updateEventsStats(data.length);
    if(window.lucide) lucide.createIcons();
}

function updateEventsStats(count) {
    const statEl = document.getElementById('stat-events-count');
    if(statEl) statEl.innerText = count;
}

window.viewEventDetail = async (eventId) => {
    const { data: evt } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
    if(!evt) return;

    showCustomModal(`
        <h2 class="luxe-title">${evt.title}</h2>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:25px;">
            <div><span class="mini-label">Date</span><br>${new Date(evt.date).toLocaleDateString('fr-FR')}</div>
            <div><span class="mini-label">Heure</span><br>${evt.time || 'Non définie'}</div>
            <div><span class="mini-label">Lieu</span><br>${evt.location || 'Non défini'}</div>
            <div><span class="mini-label">Entité</span><br><span class="origin-tag">${evt.entity}</span></div>
        </div>
        
        <div style="margin-bottom:25px;">
            <span class="mini-label">Description</span>
            <p style="margin-top:8px; line-height:1.6; color:var(--text-muted);">${evt.description || 'Aucune description'}</p>
        </div>

        <div style="display:flex; gap:10px;">
            <button onclick="promptEditEvent('${evt.id}')" class="btn-gold" style="flex:1;">MODIFIER</button>
            <button onclick="deleteEvent('${evt.id}')" class="btn-gold" style="background:var(--danger);">SUPPRIMER</button>
        </div>
    `);
};

window.showAddEventModal = () => {
    showCustomModal(`
        <h2 class="luxe-title">NOUVEL ÉVÉNEMENT</h2>
        <div style="display:grid; gap:15px;">
            <div><span class="mini-label">Titre</span><input type="text" id="event-title" class="luxe-input" placeholder="Gala de fin d'année"></div>
            <div><span class="mini-label">Date</span><input type="date" id="event-date" class="luxe-input"></div>
            <div><span class="mini-label">Heure</span><input type="time" id="event-time" class="luxe-input"></div>
            <div><span class="mini-label">Lieu</span><input type="text" id="event-location" class="luxe-input" placeholder="Salle des fêtes"></div>
            <div><span class="mini-label">Entité</span>
                <select id="event-entity" class="luxe-input">
                    <option>Institut Alsatia</option>
                    <option>Academia Alsatia</option>
                    <option>Cours Herrade de Landsberg</option>
                    <option>Collège Saints Louis et Zélie Martin</option>
                </select>
            </div>
            <div><span class="mini-label">Description</span><textarea id="event-desc" class="luxe-input" rows="4" placeholder="Détails de l'événement..."></textarea></div>
            <button onclick="saveEvent()" class="btn-gold">CRÉER L'ÉVÉNEMENT</button>
        </div>
    `);
};

window.saveEvent = async () => {
    const event = {
        title: document.getElementById('event-title').value.trim(),
        date: document.getElementById('event-date').value,
        time: document.getElementById('event-time').value,
        location: document.getElementById('event-location').value.trim(),
        entity: document.getElementById('event-entity').value,
        description: document.getElementById('event-desc').value.trim()
    };

    if(!event.title || !event.date) {
        return alert("Le titre et la date sont obligatoires");
    }

    const { error } = await supabaseClient.from('events').insert([event]);
    
    if(error) {
        alert("Erreur : " + error.message);
    } else {
        window.showNotice("Succès", "Événement créé");
        closeCustomModal();
        loadEvents();
    }
};

window.promptEditEvent = async (eventId) => {
    const { data: evt } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
    if(!evt) return;

    showCustomModal(`
        <h2 class="luxe-title">MODIFIER ÉVÉNEMENT</h2>
        <div style="display:grid; gap:15px;">
            <div><span class="mini-label">Titre</span><input type="text" id="edit-event-title" class="luxe-input" value="${evt.title}"></div>
            <div><span class="mini-label">Date</span><input type="date" id="edit-event-date" class="luxe-input" value="${evt.date}"></div>
            <div><span class="mini-label">Heure</span><input type="time" id="edit-event-time" class="luxe-input" value="${evt.time || ''}"></div>
            <div><span class="mini-label">Lieu</span><input type="text" id="edit-event-location" class="luxe-input" value="${evt.location || ''}"></div>
            <div><span class="mini-label">Description</span><textarea id="edit-event-desc" class="luxe-input" rows="4">${evt.description || ''}</textarea></div>
            <button onclick="updateEvent('${eventId}')" class="btn-gold">SAUVEGARDER</button>
        </div>
    `);
};

window.updateEvent = async (eventId) => {
    const updates = {
        title: document.getElementById('edit-event-title').value.trim(),
        date: document.getElementById('edit-event-date').value,
        time: document.getElementById('edit-event-time').value,
        location: document.getElementById('edit-event-location').value.trim(),
        description: document.getElementById('edit-event-desc').value.trim()
    };

    await supabaseClient.from('events').update(updates).eq('id', eventId);
    window.showNotice("Succès", "Événement mis à jour");
    closeCustomModal();
    loadEvents();
};

window.deleteEvent = (eventId) => {
    window.alsatiaConfirm("SUPPRIMER ÉVÉNEMENT", "Voulez-vous vraiment supprimer cet événement ?", async () => {
        await supabaseClient.from('events').delete().eq('id', eventId);
        window.showNotice("Supprimé", "Événement effacé");
        closeCustomModal();
        loadEvents();
    }, true);
};

// ==========================================
// SECTION MESSAGERIE (CHAT)
// ==========================================
let currentChatSubject = 'Général';

/**
 * 1. GESTION DES SUJETS DE DISCUSSION
 */
window.loadChatSubjects = async () => {
    const { data: subjects } = await supabaseClient.from('chat_subjects').select('*').order('created_at', { ascending: true });
    const list = document.getElementById('chat-subjects-list');
    if (!list) return;

    const baseSubjects = [
        { id: 'general', name: 'Général', entity: '' }
    ];

    const allSubjects = [...baseSubjects, ...(subjects || [])];
    
    list.innerHTML = allSubjects.map(sub => {
        const isActive = sub.name === currentChatSubject;
        const canDelete = sub.id !== 'general' && currentUser.portal === 'Institut Alsatia';
        
        return `
            <div class="chat-subject-item ${isActive ? 'active-chat-tab' : ''}" 
                 onclick="window.switchChatSubject('${sub.name}')"
                 style="padding:15px 20px; cursor:pointer; transition:0.3s; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:700; font-size:0.85rem; color:${isActive ? 'var(--gold)' : 'white'};"># ${sub.name}</div>
                    ${sub.entity ? `<div style="font-size:0.65rem; opacity:0.7; margin-top:2px;">${sub.entity}</div>` : ''}
                </div>
                ${canDelete ? `<i data-lucide="trash-2" onclick="event.stopPropagation(); window.deleteSubject('${sub.id}', '${sub.name}')" style="width:14px; color:var(--danger); opacity:0; transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0"></i>` : ''}
            </div>
        `;
    }).join('');
    
    if(window.lucide) lucide.createIcons();
};

/**
 * 2. ABONNEMENT TEMPS RÉEL
 */
window.subscribeToChat = () => {
    supabaseClient
        .channel('chat_global_channel')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'chat_global' },
            payload => {
                if (payload.new.subject === currentChatSubject) {
                    appendSingleMessage(payload.new);
                }
            }
        )
        .on('postgres_changes', 
            { event: 'DELETE', schema: 'public', table: 'chat_global' },
            payload => {
                const msgEl = document.getElementById(`msg-${payload.old.id}`);
                if (msgEl) msgEl.closest('.message-wrapper').remove();
            }
        )
        .subscribe();
};

window.switchChatSubject = (subjectName) => {
    currentChatSubject = subjectName;
    const titleEl = document.getElementById('chat-current-title');
    if(titleEl) titleEl.innerText = `# ${subjectName}`;
    window.loadChatSubjects(); 
    window.loadChatMessages();
};

window.promptCreateSubject = () => {
    const isInstitut = currentUser.portal === 'Institut Alsatia';
    showCustomModal(`
        <h3 class="luxe-title">NOUVEAU CANAL</h3>
        <p class="mini-label">NOM DU SUJET</p>
        <input type="text" id="new-sub-name" class="luxe-input" placeholder="ex: Travaux Été">
        <p class="mini-label" style="margin-top:15px;">AFFECTATION ÉCOLE</p>
        <select id="new-sub-entity" class="luxe-input">
            <option value="">Visible par tous (Général)</option>
            <option value="Institut Alsatia" ${!isInstitut ? 'disabled' : ''}>Institut Alsatia Uniquement</option>
            <option value="Academia Alsatia">Academia Alsatia</option>
            <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
            <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
        </select>
        <button onclick="window.execCreateSubject()" class="btn-gold" style="width:100%; margin-top:20px;">CRÉER LE SUJET</button>
    `);
};

window.execCreateSubject = async () => {
    const name = document.getElementById('new-sub-name').value.trim();
    const entity = document.getElementById('new-sub-entity').value;
    if(!name) return;

    await supabaseClient.from('chat_subjects').insert([{ name, entity }]);
    window.showNotice("Succès", "Canal de discussion créé.");
    closeCustomModal();
    window.loadChatSubjects();
};

/**
 * 3. LOGIQUE DES MESSAGES
 */
window.loadChatMessages = async () => {
    const { data, error } = await supabaseClient.from('chat_global')
        .select('*').eq('subject', currentChatSubject).order('created_at', { ascending: true });
    
    if (error) return;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    container.innerHTML = data.map(msg => renderSingleMessage(msg)).join('');
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
};

function renderSingleMessage(msg) {
    const isMe = msg.author_full_name === `${currentUser.first_name} ${currentUser.last_name}`;
    const isMentioned = msg.content.includes(`@${currentUser.last_name}`);
    const date = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const portalIcon = LOGOS[msg.portal] || 'logo_alsatia.png';

    return `
        <div class="message-wrapper ${isMe ? 'my-wrapper' : ''}">
            <div class="msg-header" style="display:flex; align-items:center; gap:5px; font-size:0.7rem; color:var(--text-muted); margin-bottom:2px;">
                <img src="${portalIcon}" style="width:14px; height:14px; object-fit:contain;">
                <span style="font-weight:700;">${msg.author_full_name}</span> • <span>${date}</span>
            </div>
            <div class="message ${isMe ? 'my-msg' : ''} ${isMentioned ? 'mentioned-luxe' : ''}" id="msg-${msg.id}" style="position:relative;">
                ${msg.content.replace(/@([\w\sàéèêîïôûù]+)/g, '<span class="mention-badge">@$1</span>')}
                ${msg.file_url ? `<div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.2); padding-top:5px;"><a href="${msg.file_url}" target="_blank" style="color:var(--gold); font-size:0.8rem; text-decoration:none;">📎 Document joint</a></div>` : ''}
                
                <div class="msg-actions">
                    <span onclick="window.reactToMessage('${msg.id}', '👍')">👍</span>
                    <span onclick="window.reactToMessage('${msg.id}', '❤️')">❤️</span>
                    ${isMe ? `<i data-lucide="trash-2" onclick="window.deleteMessage('${msg.id}')" style="width:12px; color:var(--danger); margin-left:8px;"></i>` : ''}
                </div>
            </div>
        </div>
    `;
}

function appendSingleMessage(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', renderSingleMessage(msg));
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
}

/**
 * 4. MENTIONS & ENVOI
 */
window.handleChatKeyUp = (e) => {
    const input = e.target;
    const box = document.getElementById('mention-box');

    if (input.value.includes('@')) {
        const query = input.value.split('@').pop().toLowerCase();
        box.style.display = 'block';
        
        // Liste des entités et noms en ENTIER
        const suggestions = [
            'Institut Alsatia', 
            'Academia Alsatia', 
            'Cours Herrade de Landsberg', 
            'Collège Saints Louis et Zélie Martin',
            'Molin', 'Zeller'
        ];
        
        const filtered = suggestions.filter(s => s.toLowerCase().includes(query));
        
        box.innerHTML = filtered.map(s => `
            <div class="suggest-item" onclick="window.insertMention('${s}')" style="padding:10px; cursor:pointer; border-bottom:1px solid #eee;">@${s}</div>
        `).join('');
    } else {
        box.style.display = 'none';
    }
    
    if (e.key === 'Enter') window.sendChatMessage();
};

window.insertMention = (name) => {
    const input = document.getElementById('chat-input');
    const parts = input.value.split('@');
    parts.pop();
    input.value = parts.join('@') + '@' + name + ' ';
    document.getElementById('mention-box').style.display = 'none';
    input.focus();
};

window.handleChatFile = (input) => {
    selectedChatFile = input.files[0];
    if (selectedChatFile) {
        document.getElementById('file-preview-bar').style.display = 'block';
        document.getElementById('file-name-preview').innerText = selectedChatFile.name;
    }
};

window.clearChatFile = () => {
    selectedChatFile = null;
    document.getElementById('chat-file-input').value = "";
    document.getElementById('file-preview-bar').style.display = 'none';
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if(!content && !selectedChatFile) return;

    let fileUrl = null;
    if (selectedChatFile) {
        const filePath = `chat/${Date.now()}_${selectedChatFile.name}`;
        const { error: uploadError } = await supabaseClient.storage.from('chat-attachments').upload(filePath, selectedChatFile);
        if (!uploadError) {
            const { data } = supabaseClient.storage.from('chat-attachments').getPublicUrl(filePath);
            fileUrl = data.publicUrl;
        }
    }

    await supabaseClient.from('chat_global').insert([{
        content,
        author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        author_last_name: currentUser.last_name,
        portal: currentUser.portal,
        subject: currentChatSubject,
        file_url: fileUrl
    }]);

    input.value = '';
    window.clearChatFile();
};

window.deleteMessage = (id) => {
    window.alsatiaConfirm("SUPPRIMER", "Voulez-vous supprimer ce message ?", async () => {
        await supabaseClient.from('chat_global').delete().eq('id', id);
        window.showNotice("Effacé", "Message supprimé.");
    }, true);
};

window.deleteSubject = (id, name) => {
    window.alsatiaConfirm("SUPPRIMER CANAL", `Supprimer le sujet #${name} et tous ses messages ?`, async () => {
        await supabaseClient.from('chat_global').delete().eq('subject', name);
        await supabaseClient.from('chat_subjects').delete().eq('id', id);
        window.loadChatSubjects();
        window.switchChatSubject('Général');
    }, true);
};

window.reactToMessage = async (messageId, emoji) => {
    const { data: msg } = await supabaseClient.from('chat_global').select('content').eq('id', messageId).single();
    if (!msg) return;

    const newContent = msg.content + " " + emoji;
    
    const { error } = await supabaseClient
        .from('chat_global')
        .update({ content: newContent })
        .eq('id', messageId);

    if (error) console.error("Erreur réaction:", error);
};
