// ==========================================
// CONFIGURATION SUPABASE & ÉTAT GLOBAL
// ==========================================
console.log('🚀 APP.JS CHARGÉ - VERSION CORRIGÉE v2.0');

const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let sortUnthankedActive = false; // tri "remerciements dus en premier" 
let allUsersForMentions = []; 
let selectedChatFile = null; // Pour la gestion des pièces jointes dans la messagerie
let currentChatSubject = 'Général'; // Canal de discussion actif
let currentTab = 'home';              // Onglet actuellement visible
let mentionUnreadCount = 0; // Compteur de mentions @nom non lues dans le chat global

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};
// ==========================================
// NOTIFICATIONS - MENTIONS et MESSAGES PRIVES
// ==========================================

window.showMessageNotification = function(fromName, type) {
    // Ne pas empiler plus de 3 toasts du même type
    const existingToasts = document.querySelectorAll('.msg-notif-toast');
    if (existingToasts.length >= 3) return;
    var toastContainer = document.getElementById('notice-toast');
    if (!toastContainer) return;

    var id = 'notif-' + Date.now();
    var icon = type === 'mention' ? 'at-sign' : 'message-circle';
    var label = type === 'mention' ? 'Vous avez été mentionné(e)' : 'Nouveau message privé';
    var color = type === 'mention' ? 'var(--gold)' : '#3b82f6';

    var iconDiv = '<div style="width:36px;height:36px;border-radius:10px;background:' + color + '22;border:1.5px solid ' + color + '55;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="' + icon + '" style="width:18px;height:18px;color:' + color + ';"></i></div>';
    var textDiv = '<div style="flex:1;min-width:0;"><div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:' + color + ';margin-bottom:2px;">' + label + '</div><div style="font-size:0.88rem;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">de ' + fromName + '</div></div>';
    var closeBtn = '<button onclick="document.getElementById(\'' + id + '\').remove()" style="background:none;border:none;cursor:pointer;color:#64748b;padding:4px;border-radius:6px;display:flex;align-items:center;" onmouseover="this.style.color=\'white\'" onmouseout="this.style.color=\'#64748b\'"><i data-lucide="x" style="width:14px;height:14px;"></i></button>';

    var targetTab = type === 'mention' ? 'chat' : 'contacts';
    var wrapperStyle = 'background:var(--primary);color:white;padding:14px 18px;border-radius:14px;border-left:4px solid ' + color + ';box-shadow:0 8px 24px rgba(0,0,0,0.25);display:flex;align-items:center;gap:12px;min-width:280px;max-width:360px;pointer-events:auto;animation:slideIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards;cursor:pointer;';
    var html = '<div id="' + id + '" class="msg-notif-toast" onclick="window.switchTab(\'' + targetTab + '\'); document.getElementById(\'' + id + '\').remove();" style="' + wrapperStyle + '">' + iconDiv + textDiv + closeBtn + '</div>';

    toastContainer.insertAdjacentHTML('beforeend', html);
    if (window.lucide) lucide.createIcons();

    setTimeout(function() {
        var el = document.getElementById(id);
        if (el) {
            el.style.transition = 'all 0.3s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateX(60px)';
            setTimeout(function() { el.remove(); }, 300);
        }
    }, 6000);
};

window.updateMentionBadge = function() {
    var navChat = document.getElementById('nav-chat');
    if (!navChat) return;
    var badge = navChat.querySelector('.mention-nav-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'mention-nav-badge';
        navChat.appendChild(badge);
    }
    if (mentionUnreadCount > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = String(Math.min(mentionUnreadCount, 99));
    } else {
        badge.style.display = 'none';
        badge.textContent = '';
    }
};

window.clearMentionBadge = function() {
    mentionUnreadCount = 0;
    window.updateMentionBadge();
};

window.startGlobalMentionWatcher = function() {
    if (window.mentionWatcherChannel) return;
    var myLastName  = currentUser.last_name.toLowerCase().trim();
    var myFirstName = currentUser.first_name.toLowerCase().trim();
    window.mentionWatcherChannel = supabaseClient
        .channel('mention-watcher-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global' }, function(p) {
            var msg = p.new;
            if (!msg) return;

            // Ignorer ses propres messages
            var authorNorm = (msg.author_full_name || '').toLowerCase().trim();
            var myNorm = (myFirstName + ' ' + myLastName).trim();
            if (authorNorm === myNorm) return;

            // Détecter @NomDeFamille OU @Prénom OU @Prénom+Nom
            const contentLow = (msg.content || '').toLowerCase();
            const isMentioned = contentLow.includes('@' + myLastName)
                              || contentLow.includes('@' + myFirstName)
                              || contentLow.includes('@' + myNorm);
            if (!isMentioned) return;

            // Toujours incrémenter le badge
            mentionUnreadCount++;
            window.updateMentionBadge();

            // Toast uniquement si l'utilisateur N'est PAS en train de lire ce canal
            const onChatTab    = (currentTab === 'chat');
            const onSameSubject = (msg.subject === currentChatSubject);
            if (!onChatTab || !onSameSubject) {
                window.showMessageNotification(msg.author_full_name || 'Quelqu\'un', 'mention');
            }
        })
        .subscribe(function(status) {
            console.log('📣 mention-watcher:', status);
        });
};

// =====================================================
// CHAT GLOBAL — REALTIME ROBUSTE
// - Pas de filter= (bugué côté Supabase RT)
// - Déduplication via Set des IDs déjà affichés
// - Fallback polling si CHANNEL_ERROR / TIMED_OUT
// - DELETE + UPDATE gérés
// =====================================================

// IDs des messages déjà rendus dans le DOM (évite doublons optimiste + realtime)
window._chatRenderedIds = new Set();
window._chatPollTimer   = null;
window._chatPollFlight  = false;

window._chatStopPoll = function() {
    if (window._chatPollTimer) { clearInterval(window._chatPollTimer); window._chatPollTimer = null; }
};

window._chatStartPoll = function() {
    if (window._chatPollTimer) return;
    console.warn('⚠️ Chat realtime KO → polling fallback 3s');
    window._chatPollTimer = setInterval(async function() {
        if (window._chatPollFlight) return;
        window._chatPollFlight = true;
        try { await window._chatPollTick(); } catch(e){} finally { window._chatPollFlight = false; }
    }, 3000);
};

window._chatPollTick = async function() {
    const { data } = await supabaseClient.from('chat_global')
        .select('*').eq('subject', currentChatSubject)
        .order('created_at', { ascending: true }).limit(200);
    if (!data) return;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    data.forEach(function(msg) {
        if (!window._chatRenderedIds.has(msg.id)) {
            if (!document.getElementById('msg-' + msg.id)) {
                appendSingleMessageSafe(msg);
            }
            window._chatRenderedIds.add(msg.id);
        }
    });
};

window.subscribeToChat = function() {
    window._chatStopPoll();
    if (window.chatChannel) {
        try { supabaseClient.removeChannel(window.chatChannel); } catch(e){}
        window.chatChannel = null;
    }

    const myFullName = currentUser.first_name + ' ' + currentUser.last_name;

    window.chatChannel = supabaseClient
        .channel('chat-global-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global' }, function(p) {
            const msg = p.new;
            if (!msg || msg.subject !== currentChatSubject) return;
            // Déduplication : si déjà dans le DOM (ajout optimiste), on skip
            if (window._chatRenderedIds.has(msg.id)) return;
            if (document.getElementById('msg-' + msg.id)) {
                window._chatRenderedIds.add(msg.id);
                return;
            }
            window._chatRenderedIds.add(msg.id);
            appendSingleMessageSafe(msg);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_global' }, function(p) {
            const old = p.old;
            if (!old) return;
            window._chatRenderedIds.delete(old.id);
            const wrapper = document.querySelector('[data-msg-id="' + old.id + '"]');
            if (wrapper) {
                wrapper.style.transition = 'opacity 0.3s';
                wrapper.style.opacity = '0';
                setTimeout(function() { wrapper.remove(); }, 300);
            }
        })
        .subscribe(function(status) {
            console.log('💬 Chat realtime:', status);
            if (status === 'SUBSCRIBED') { window._chatStopPoll(); }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { window._chatStartPoll(); }
        });

    // Filet de sécurité : si pas SUBSCRIBED après 4s → polling
    setTimeout(function() {
        if (!window._chatPollTimer) window._chatStartPoll();
    }, 4000);
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
window.confirmLogout = () => {
    window.alsatiaConfirm(
        "DÉCONNEXION",
        "Voulez-vous vraiment vous déconnecter ?",
        () => {
            localStorage.clear(); 
            window.location.href = 'login.html';
        },
        true
    );
};

window.logout = () => { 
    localStorage.clear(); 
    window.location.href = 'login.html'; 
};

window.closeCustomModal = () => { 
    const m = document.getElementById('custom-modal');
    if (m) {
        // Nettoyer le channel Realtime si ouvert
        if (window.eventChatChannel) {
            try {
                supabaseClient.removeChannel(window.eventChatChannel);
                console.log('🧹 Channel Realtime nettoyé');
            } catch (e) {
                console.log('Erreur cleanup channel:', e);
            }
            window.eventChatChannel = null;
        }
        
        // Animation de fermeture
        m.style.opacity = '0';
        const card = m.querySelector('.modal-card');
        if (card) card.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            m.style.display = 'none';
        }, 300);
    }
};

// Fonction critique pour éviter les injections et bugs d'affichage dans le chat
function escapeHTML(str) {
    if (!str) return "";
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// Fonction pour centraliser l'affichage des notifications
window.showNotice = (title, message, type = 'info') => {
    // Créer une notification élégante au lieu d'un alert natif
    const colors = {
        info: { bg: '#eff6ff', border: '#3b82f6', icon: 'info' },
        success: { bg: '#f0fdf4', border: '#22c55e', icon: 'check-circle' },
        error: { bg: '#fef2f2', border: '#ef4444', icon: 'alert-circle' },
        warning: { bg: '#fffbeb', border: '#f59e0b', icon: 'alert-triangle' }
    };
    
    const color = colors[type] || colors.info;
    
    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" style="position:fixed; top:20px; right:20px; z-index:100000; background:${color.bg}; border:2px solid ${color.border}; border-radius:12px; padding:16px 20px; box-shadow:0 4px 20px rgba(0,0,0,0.15); display:flex; align-items:center; gap:12px; min-width:300px; max-width:500px; animation:slideInRight 0.3s ease;">
            <i data-lucide="${color.icon}" style="width:24px; height:24px; color:${color.border}; flex-shrink:0;"></i>
            <div style="flex:1;">
                <div style="font-weight:700; font-size:0.95rem; color:#1f2937; margin-bottom:4px;">${title}</div>
                <div style="font-size:0.85rem; color:#6b7280;">${message}</div>
            </div>
            <i data-lucide="x" onclick="document.getElementById('${toastId}').remove()" style="width:18px; height:18px; cursor:pointer; color:#9ca3af; flex-shrink:0;"></i>
        </div>
        <style>
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', toastHTML);
    if (window.lucide) lucide.createIcons();
    
    // Auto-suppression après 5 secondes
    setTimeout(() => {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.transition = 'all 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
};

// Helper pour l'affichage des Modals Luxe
function showCustomModal(html) {
    const m = document.getElementById('custom-modal');
    const b = document.getElementById('modal-body');
    if(m && b) { 
        b.innerHTML = html; 
        m.style.display = 'flex';
        
        // Animation d'apparition
        setTimeout(() => {
            m.style.opacity = '1';
            const card = m.querySelector('.modal-card');
            if (card) card.style.transform = 'scale(1)';
        }, 10);
        
        // Fermer avec ESC
        const closeOnEsc = (e) => {
            if (e.key === 'Escape') {
                window.closeCustomModal();
                document.removeEventListener('keydown', closeOnEsc);
            }
        };
        document.addEventListener('keydown', closeOnEsc);
        
        // Fermer en cliquant sur l'overlay (pas sur la carte)
        m.onclick = (e) => {
            if (e.target === m) {
                window.closeCustomModal();
            }
        };
        
        if(window.lucide) lucide.createIcons();
    }
}

// ==========================================
// INITIALISATION AU CHARGEMENT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!currentUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    
    initInterface();
    
    // Chargement initial des données
    loadContacts();
    if(currentUser.portal === "Institut Alsatia") {
        window.loadDonors();
    }
    loadEvents();
    
    // Initialisation du chat avec Realtime
    window.loadChatSubjects();
    window.loadChatMessages();
    window.subscribeToChat();
    window.startGlobalMentionWatcher();
    
    // Initialiser les icônes Lucide
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
    if(bigLogo) {
        bigLogo.innerHTML = `
            <img src="${logoSrc}" 
                 style="width:220px; 
                        max-width:70vw;
                        filter:drop-shadow(0 10px 25px rgba(0,0,0,0.15)); 
                        animation:fadeInScale 0.6s ease-out;">
        `;
    }
    
    const welcomeName = document.getElementById('welcome-full-name');
    if(welcomeName) welcomeName.innerText = `${currentUser.first_name} ${currentUser.last_name}`;

    const welcomePortal = document.getElementById('welcome-portal-label');
    if(welcomePortal) welcomePortal.innerText = `Portail Officiel — ${portal}`;

    const navDonors = document.getElementById('nav-donors');
    if (navDonors) {
        navDonors.style.display = (portal === "Institut Alsatia") ? "flex" : "none";
    }

    // Onglet Campagnes (Institut Alsatia uniquement)
    const navCampaigns = document.getElementById('nav-campaigns');
    if (navCampaigns) navCampaigns.style.display = (portal === 'Institut Alsatia') ? 'flex' : 'none';

    const btnNewCampaign = document.getElementById('btn-new-campaign');
    if (btnNewCampaign) btnNewCampaign.style.display = (portal === 'Institut Alsatia') ? 'inline-flex' : 'none';

    // Boutons réservés à Institut Alsatia
    const btnImport = document.getElementById('btn-import-donors');
    if (btnImport) btnImport.style.display = (portal === 'Institut Alsatia') ? 'inline-flex' : 'none';

    const btnDeleteAll = document.getElementById('btn-delete-all-donors');
    if (btnDeleteAll) btnDeleteAll.style.display = (portal === 'Institut Alsatia') ? 'inline-flex' : 'none';

    // Charger les statistiques
    loadHomeStats();

    // Initialiser le carrousel de citations
    setTimeout(() => { if (window.initQuotes) window.initQuotes(); }, 100);

    if(window.lucide) lucide.createIcons();
}

// Fonction pour charger les statistiques de la page d'accueil
async function loadHomeStats() {
    // Plus de statistiques à charger sur la page d'accueil
    // Cette fonction est conservée au cas où on veuille ajouter des stats plus tard
}

// ==========================================
// GESTION DE LA NAVIGATION (ONGLETS)
// ==========================================
// =====================================================
// REFRESH PAR ONGLET — Animation + rechargement données
// =====================================================
window.refreshTab = function(tabId) {
    // Trouver le bouton refresh cliqué et animer son icône
    const btn = document.querySelector(`[onclick*="refreshTab('${tabId}')"]`);
    if (btn) {
        const icon = btn.querySelector('[data-lucide="refresh-cw"]');
        if (icon) {
            icon.style.transition = 'transform 0.6s ease';
            icon.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                icon.style.transition = '';
                icon.style.transform = '';
            }, 650);
        }
        btn.disabled = true;
        setTimeout(() => { btn.disabled = false; }, 1000);
    }

    // Recharger les données de l'onglet concerné
    if (tabId === 'contacts')  { loadContacts(); }
    if (tabId === 'donors')    { window.loadDonors(); }
    if (tabId === 'campaigns') { window.loadCampaigns(); }
    if (tabId === 'events')    { loadEvents(); }
    if (tabId === 'account')   { window.loadAccountPage(); }
    if (tabId === 'home')      { loadHomeStats(); if (window.initQuotes) window.initQuotes(); }
    if (tabId === 'chat') {
        window._chatRenderedIds = new Set();
        window._chatStopPoll();
        window.loadChatSubjects();
        window.loadChatMessages();
        window.subscribeToChat();
    }
};

// =====================================================
// TRI REMERCIEMENTS DUS — Donateurs
// =====================================================
window.toggleSortUnthanked = function() {
    sortUnthankedActive = !sortUnthankedActive;
    const btn = document.getElementById('btn-sort-unthanked');
    const label = document.getElementById('sort-unthanked-label');
    if (btn) btn.classList.toggle('active', sortUnthankedActive);
    if (label) label.textContent = sortUnthankedActive ? 'Tous les donateurs' : 'Remerciements dus';
    window.filterDonors();
}

// Mettre à jour le badge compteur "Remerciements dûs"
window.updateUnthankedBadge = function() {
    const badge = document.getElementById('unthanked-count-badge');
    if (!badge) return;
    const count = (window.allDonorsData || []).filter(d =>
        !d.archived_at && (d.donations || []).some(don => don.thanked === false)
    ).length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
};
;

window.switchTab = (tabId) => {
    currentTab = tabId;
    console.log("Changement d'onglet vers :", tabId);

    // Nettoyer le channel Realtime des événements si on quitte les événements
    if (tabId !== 'events' && window.eventChatChannel) {
        try {
            supabaseClient.removeChannel(window.eventChatChannel);
            console.log('🧹 Channel événement nettoyé (changement onglet)');
        } catch (e) {
            console.log('Erreur cleanup channel:', e);
        }
        window.eventChatChannel = null;
    }

    // 1. Gère l'affichage visuel des onglets
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));

    const targetPage = document.getElementById('tab-' + tabId);
    if (targetPage) targetPage.classList.add('active');
    
    // On cherche l'élément de menu correspondant pour mettre l'icône en doré
    const menuIcon = document.querySelector(`li[onclick*="${tabId}"]`);
    if (menuIcon) menuIcon.classList.add('active');

    // 2. CHARGEMENT DES DONNÉES SPÉCIFIQUES
    if (tabId === 'donors') window.loadDonors();
    if (tabId === 'campaigns') window.loadCampaigns();
    if (tabId === 'events') loadEvents();
    // Activation de la Messagerie
    if (tabId === 'chat') {
        window.clearMentionBadge();
        window.loadChatSubjects();
        window.loadChatMessages();
        window.subscribeToChat();
    }
    
    // Activation de Mon Compte
    if (tabId === 'account') {
        window.loadAccountPage();
    }
    
    // Retourner à l'accueil
    if (tabId === 'home') {
        loadHomeStats();
    }
};

// ==========================================
// SECTION ANNUAIRE (CONTACTS)
// ==========================================
// Sauvegarder tous les contacts pour le filtre
window.allContactsData = [];

async function loadContacts() {
    const grid = document.getElementById('contacts-grid');
    if(!grid) return;
    
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">Chargement de l'annuaire...</p>`;
    
    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('portal', { ascending: true })
        .order('last_name', { ascending: true});

    if (error) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 40px;">Erreur lors du chargement des contacts.</p>`;
        return;
    }

    window.allContactsData = users || [];
    renderContacts(users);
}

function renderContacts(users) {
    const grid = document.getElementById('contacts-grid');
    if(!grid) return;
    
    const isInstitutAlsatia = currentUser.portal === 'Institut Alsatia';
    
    grid.innerHTML = users.map(u => {
        // Déterminer le badge de statut
        let statusBadge = '';
        let statusActions = '';
        
        if (u.status === 'pending') {
            statusBadge = '<div style="display:inline-block; background:#fef3c7; color:#92400e; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px;">⏳ EN ATTENTE D\'APPROBATION</div>';
            if (isInstitutAlsatia) {
                const pendingEmail = u.email ? `
                    <div style="margin-bottom:12px; background:#fef9ec; border:1.5px solid #fbbf24; border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                        <div style="min-width:0;">
                            <div style="font-size:0.7rem; font-weight:700; color:#92400e; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Email de contact</div>
                            <div style="font-size:0.85rem; color:#1e293b; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.email}</div>
                        </div>
                        <a href="mailto:${u.email}?subject=Votre compte Alsatia a été approuvé&body=Bonjour ${u.first_name},%0A%0AVotre compte sur le portail Alsatia a été approuvé. Vous pouvez désormais vous connecter.%0A%0ACordialement,%0AL'équipe Alsatia"
                           style="background:var(--gold); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.75rem; text-decoration:none; white-space:nowrap; flex-shrink:0;">
                            ✉️ Envoyer
                        </a>
                    </div>
                ` : '<div style="margin-bottom:12px; font-size:0.8rem; color:#94a3b8; font-style:italic;">Aucun email renseigné</div>';

                statusActions = `
                    ${pendingEmail}
                    <div style="display:flex; gap:8px; margin-top:4px;">
                        <button onclick="window.approveUser('${u.id}')" style="flex:1; background:#10b981; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ✅ APPROUVER
                        </button>
                        <button onclick="window.rejectUser('${u.id}')" style="flex:1; background:#ef4444; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ❌ REFUSER
                        </button>
                    </div>
                `;
            }
        } else if (u.status === 'revoked') {
            statusBadge = '<div style="display:inline-block; background:#fee2e2; color:#991b1b; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px;">🚫 ACCÈS RÉVOQUÉ</div>';
            if (isInstitutAlsatia) {
                statusActions = `
                    <div style="margin-top:16px;">
                        <button onclick="window.reactivateUser('${u.id}')" style="width:100%; background:#3b82f6; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ♻️ RÉACTIVER
                        </button>
                    </div>
                `;
            }
        } else if (u.status === 'rejected') {
            statusBadge = '<div style="display:inline-block; background:#fee2e2; color:#991b1b; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px;">❌ INSCRIPTION REFUSÉE</div>';
            if (isInstitutAlsatia) {
                statusActions = `
                    <div style="margin-top:16px;">
                        <button onclick="window.reactivateUser('${u.id}')" style="width:100%; background:#3b82f6; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ♻️ RÉACTIVER
                        </button>
                    </div>
                `;
            }
        } else if (u.status === 'approved' && isInstitutAlsatia && u.id !== currentUser.id) {
            // Utilisateur approuvé - possibilité de révoquer (sauf soi-même)
            statusBadge = '<div style="display:inline-block; background:linear-gradient(135deg, #fef3c7, #fde68a); color:#92400e; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px;">✅ ACTIF</div>';
            
            // GESTION DES ACCÈS (seulement si pas Institut Alsatia)
            let accessToggles = '';
            if (u.portal !== 'Institut Alsatia') {
                accessToggles = `
                    <div style="margin-top:16px; padding:12px; background:#f8fafc; border-radius:8px;">
                        <p style="margin:0 0 10px 0; font-size:0.85rem; font-weight:700; color:#64748b;">🔐 Accès autorisés :</p>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                                <input type="checkbox" ${u.access_donors ? 'checked' : ''} onchange="window.toggleAccess('${u.id}', 'access_donors', this.checked)" style="width:18px; height:18px; cursor:pointer;">
                                <span>Base Donateurs</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                                <input type="checkbox" ${u.access_events ? 'checked' : ''} onchange="window.toggleAccess('${u.id}', 'access_events', this.checked)" style="width:18px; height:18px; cursor:pointer;">
                                <span>Événements</span>
                            </label>
                        </div>
                    </div>
                `;
            }
            
            statusActions = `
                ${accessToggles}
                <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
                    <button onclick="window.revokeUser('${u.id}')" style="width:100%; background:#ef4444; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                        🚫 RÉVOQUER L'ACCÈS
                    </button>
                    <button onclick="window.deleteUser('${u.id}', '${u.first_name} ${u.last_name}')" style="width:100%; background:#7f1d1d; color:#fecaca; border:2px solid #991b1b; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.8rem; letter-spacing:0.5px;">
                        🗑️ SUPPRIMER DÉFINITIVEMENT
                    </button>
                </div>
            `;
        } else {
            // Utilisateur normal approuvé
            statusBadge = '<div style="display:inline-block; background:linear-gradient(135deg, #fef3c7, #fde68a); color:#92400e; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px;">' + u.portal + '</div>';
        }
        
        return `
            <div class="contact-card" style="background:white; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.08); padding:24px; transition:all 0.3s; border:2px solid transparent;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'; this.style.borderColor='var(--gold)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'; this.style.borderColor='transparent';">
                
                <!-- En-tête sans avatar -->
                <div style="margin-bottom:20px;">
                    <h3 style="margin:0 0 4px 0; font-size:1.1rem; font-weight:800; color:#1e293b;">${u.first_name} ${u.last_name.toUpperCase()}</h3>
                    <p style="margin:0; font-size:0.85rem; color:#64748b; font-weight:500;">${u.job_title || 'Collaborateur'}</p>
                </div>
                
                <!-- Badge statut/entité -->
                ${statusBadge}
                
                <!-- Coordonnées -->
                ${u.email ? `
                <div style="margin-bottom:12px; display:flex; align-items:center; gap:10px;">
                    <div style="flex:1; background:#f8fafc; padding:10px 12px; border-radius:10px; font-size:0.85rem; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <i data-lucide="mail" style="width:14px; height:14px; vertical-align:middle; margin-right:6px; color:#64748b;"></i>${u.email}
                    </div>
                    <button onclick="window.copyToClipboard('${u.email}')" style="background:var(--gold); color:white; border:none; width:36px; height:36px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onmouseover="this.style.background='var(--gold-light)'" onmouseout="this.style.background='var(--gold)'">
                        <i data-lucide="copy" style="width:16px; height:16px;"></i>
                    </button>
                </div>
                ` : ''}
                
                ${u.phone ? `
                <div style="margin-bottom:16px; display:flex; align-items:center; gap:10px;">
                    <div style="flex:1; background:#f8fafc; padding:10px 12px; border-radius:10px; font-size:0.85rem; color:#475569;">
                        <i data-lucide="phone" style="width:14px; height:14px; vertical-align:middle; margin-right:6px; color:#64748b;"></i>${u.phone}
                    </div>
                    <button onclick="window.copyToClipboard('${u.phone}')" style="background:var(--gold); color:white; border:none; width:36px; height:36px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onmouseover="this.style.background='var(--gold-light)'" onmouseout="this.style.background='var(--gold)'">
                        <i data-lucide="copy" style="width:16px; height:16px;"></i>
                    </button>
                </div>
                ` : ''}
                
                <!-- Actions de gestion (Institut Alsatia seulement) -->
                ${statusActions}
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

// Fonction pour filtrer les contacts
window.filterContacts = () => {
    const searchVal = document.getElementById('contact-search')?.value.toLowerCase().trim() || "";
    
    const filtered = window.allContactsData.filter(u => {
        return (u.first_name || "").toLowerCase().includes(searchVal) ||
               (u.last_name || "").toLowerCase().includes(searchVal) ||
               (u.email || "").toLowerCase().includes(searchVal) ||
               (u.portal || "").toLowerCase().includes(searchVal) ||
               (u.job_title || "").toLowerCase().includes(searchVal);
    });
    
    renderContacts(filtered);
};

// Fonction pour copier dans le presse-papier
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        window.showNotice("Copié !", `${text} copié dans le presse-papier`, "success");
    });
};

// Fonction pour démarrer une discussion privée
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
// CRM ALSATIA - VERSION INTÉGRALE DÉFINITIVE
// ==========================================

// Sécurité pour la variable globale
if (typeof window.allDonorsData === 'undefined') {
    window.allDonorsData = [];
}

/**
 * 1. CHARGEMENT DES DONNÉES
 */
window.loadDonors = async function() {
    const { data, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });

    if (error) {
        console.error("Erreur de chargement donateurs:", error);
        const list = document.getElementById('donors-list');
        if (list) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:#ef4444;">Erreur de chargement. Vérifiez vos permissions Supabase.</td></tr>';
        }
        return;
    }
    window.allDonorsData = data || [];
    window.filterDonors();
    window.updateUnthankedBadge();
};

/**
 * 2. SYSTÈME DE FILTRAGE
 */
window.filterDonors = () => {
    const searchVal = document.getElementById('search-donor')?.value.toLowerCase().trim() || "";
    const entityVal = document.getElementById('filter-entity')?.value || "ALL";

    const filtered = window.allDonorsData.filter(d => {
        const matchesSearch = 
            (d.last_name || "").toLowerCase().includes(searchVal) || 
            (d.first_name || "").toLowerCase().includes(searchVal) ||
            (d.company_name || "").toLowerCase().includes(searchVal) ||
            (d.city || "").toLowerCase().includes(searchVal) ||
            (d.email || "").toLowerCase().includes(searchVal);

        const matchesEntity = (entityVal === "ALL" || d.entity === entityVal);
        return matchesSearch && matchesEntity;
    });
    // Tri : remerciements dus en tête (si actif)
    if (sortUnthankedActive) {
        filtered.sort((a, b) => {
            const aHas = (a.donations || []).some(d => d.thanked === false) && !a.archived_at ? 1 : 0;
            const bHas = (b.donations || []).some(d => d.thanked === false) && !b.archived_at ? 1 : 0;
            return bHas - aHas;
        });
    }
    renderDonors(filtered);
};

/**
 * 3. AFFICHAGE DE LA LISTE PRINCIPALE
 */
function renderDonors(data) {
    const list = document.getElementById('donors-list');
    if (!list) {
        console.error('Element donors-list introuvable');
        return;
    }
    
    if (data.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:#64748b;">Aucun donateur trouvé</td></tr>';
        return;
    }
    
    list.innerHTML = data.map(d => {
        const dons = d.donations || [];
        const total = dons.reduce((acc, cur) => acc + Number(cur.amount), 0);
        const hasUnthanked = dons.some(don => don.thanked === false);
        const blinkClass = hasUnthanked ? 'blink-warning' : '';

        const displayName = d.company_name 
            ? `<b>${d.company_name.toUpperCase()}</b> <span style="font-size:0.7rem; color:#64748b;">(${d.last_name})</span>` 
            : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name || ''}`;
            
        return `
            <tr class="${blinkClass}" style="${d.archived_at ? 'opacity:0.6;' : ''}">
                <td>
                    ${displayName}
                    ${d.archived_at ? '<span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:1px 7px;border-radius:10px;font-size:0.65rem;font-weight:800;margin-left:6px;vertical-align:middle;">ARCHIVÉ</span>' : ''}
                    ${hasUnthanked && !d.archived_at ? '<br><span class="badge-error">REMERCIEMENT DÛ</span>' : ''}
                </td>
                <td>
                    <span class="origin-tag">${d.entity || '-'}</span>
                    ${d.donor_type ? `<br><span style="font-size:0.68rem;color:#94a3b8;">${d.donor_type}</span>` : ''}
                </td>
                <td style="font-weight:800; color:var(--primary); font-family:monospace; font-size:1rem;">
                    ${total.toLocaleString('fr-FR')} €
                </td>
                <td style="text-align:right;">
                    <button onclick="window.openDonorFile('${d.id}')" class="btn-gold" style="padding:6px 14px;">DOSSIER</button>
                </td>
            </tr>`;
    }).join('');
}

/**
 * 4. CRÉATION D'UNE FICHE
 */
window.showAddDonorModal = () => {
    const userPortal = currentUser.portal;
    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="user-plus" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                NOUVEAU CONTACT CRM
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- Entité -->
            <p class="mini-label">AFFECTATION ÉCOLE *</p>
            <select id="n-d-entity" class="luxe-input" style="border:1px solid var(--gold); margin-bottom:15px;">
                <option ${userPortal === 'Institut Alsatia' ? 'selected' : ''}>Institut Alsatia</option>
                <option ${userPortal === 'Academia Alsatia' ? 'selected' : ''}>Academia Alsatia</option>
                <option ${userPortal === 'Cours Herrade de Landsberg' ? 'selected' : ''}>Cours Herrade de Landsberg</option>
                <option ${userPortal === 'Collège Saints Louis et Zélie Martin' ? 'selected' : ''}>Collège Saints Louis et Zélie Martin</option>
            </select>

            <!-- Nom + Prénom -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><p class="mini-label">NOM *</p><input type="text" id="n-d-last" class="luxe-input" placeholder="DUPONT"></div>
                <div><p class="mini-label">PRÉNOM</p><input type="text" id="n-d-first" class="luxe-input" placeholder="Jean"></div>
            </div>

            <!-- Entreprise -->
            <p class="mini-label">ENTREPRISE / ASSOCIATION (Optionnel)</p>
            <input type="text" id="n-d-company" class="luxe-input" placeholder="Société XYZ" style="margin-bottom:15px;">

            <!-- Email + Téléphone -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><p class="mini-label">EMAIL</p><input type="email" id="n-d-email" class="luxe-input" placeholder="jean@email.com"></div>
                <div><p class="mini-label">TÉLÉPHONE</p><input type="text" id="n-d-phone" class="luxe-input" placeholder="06 12 34 56 78"></div>
            </div>

            <!-- Adresse -->
            <p class="mini-label">ADRESSE</p>
            <input type="text" id="n-d-address" class="luxe-input" placeholder="12 rue de la Paix" style="margin-bottom:10px;">
            <div style="display:grid; grid-template-columns:1fr 2fr; gap:10px; margin-bottom:15px;">
                <div><p class="mini-label">CODE POSTAL</p><input type="text" id="n-d-zip" class="luxe-input" placeholder="67000"></div>
                <div><p class="mini-label">VILLE</p><input type="text" id="n-d-city" class="luxe-input" placeholder="Strasbourg"></div>
            </div>

            <!-- Origine -->
            <p class="mini-label">ORIGINE DU CONTACT</p>
            <select id="n-d-origin" class="luxe-input" style="margin-bottom:15px;">
                <option value="">— Non renseigné —</option>
                <option>Gala annuel</option>
                <option>Recommandation</option>
                <option>Événement</option>
                <option>Site web</option>
                <option>Courrier</option>
                <option>Ancien élève</option>
                <option>Parent d'élève</option>
                <option>Autre</option>
            </select>

            <!-- Notes -->
            <p class="mini-label">NOTES INTERNES</p>
            <textarea id="n-d-notes" class="luxe-input" rows="3" placeholder="Informations complémentaires..." style="margin-bottom:20px;"></textarea>

            <button onclick="window.execCreateDonor()" class="btn-gold-fill" style="width:100%; height:48px; letter-spacing:1px;">
                <i data-lucide="save" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                CRÉER LE CONTACT
            </button>
        </div>
    `);
    if(window.lucide) lucide.createIcons();
};

window.execCreateDonor = async () => {
    const last = document.getElementById('n-d-last').value.trim();
    const ent = document.getElementById('n-d-entity').value;
    if(!last || !ent) return window.showNotice("Erreur", "Le Nom et l'Entité sont obligatoires.", "error");

    const { error } = await supabaseClient.from('donors').insert([{
        last_name: last.toUpperCase(),
        first_name: document.getElementById('n-d-first').value.trim(),
        company_name: document.getElementById('n-d-company').value.trim() || null,
        entity: ent,
        email: document.getElementById('n-d-email').value.trim().toLowerCase() || null,
        phone: document.getElementById('n-d-phone').value.trim() || null,
        address: document.getElementById('n-d-address').value.trim() || null,
        zip_code: document.getElementById('n-d-zip').value.trim() || null,
        city: document.getElementById('n-d-city').value.trim() || null,
        origin: document.getElementById('n-d-origin').value || null,
        notes: document.getElementById('n-d-notes').value.trim() || null,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    }]);

    if(error) return window.showNotice("Erreur", error.message, "error");
    window.showNotice("Succès ✅", "Contact créé avec succès.", "success");
    closeCustomModal();
    loadDonors();
};

/**
 * 5. DOSSIER DONATEUR (INTERFACE COMPLÈTE)
 */
window.openDonorFile = async (id) => {
    console.log('Opening donor file:', id);
    console.log('All donors data:', window.allDonorsData);
    const donor = window.allDonorsData.find(d => d.id === id);
    if (!donor) {
        console.error('Donor not found:', id);
        window.showNotice("Erreur", "Donateur introuvable. Rechargez la page.", "error");
        return;
    }
    const dons = donor.donations || [];
    
    showCustomModal(`
        <!-- EN-TÊTE FICHE -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                ${donor.archived_at ? '<span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:4px 10px;border-radius:20px;font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">⛔ ARCHIVÉ</span>' : ''}
                <div>
                    <p class="mini-label" style="margin:0 0 4px 0;">ÉCOLE / ENTITÉ</p>
                    <select id="edit-entity" class="luxe-input" style="margin:0;border:1px solid var(--gold);padding:6px 10px;height:34px;font-size:0.83rem;">
                        <option ${donor.entity === 'Institut Alsatia' ? 'selected' : ''}>Institut Alsatia</option>
                        <option ${donor.entity === 'Academia Alsatia' ? 'selected' : ''}>Academia Alsatia</option>
                        <option ${donor.entity === 'Cours Herrade de Landsberg' ? 'selected' : ''}>Cours Herrade de Landsberg</option>
                        <option ${donor.entity === 'Collège Saints Louis et Zélie Martin' ? 'selected' : ''}>Collège Saints Louis et Zélie Martin</option>
                    </select>
                </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0;">
                <button onclick="window.exportDonorToExcel('${donor.id}')" class="btn-outline" style="font-size:0.65rem;padding:5px 8px;">
                    <i data-lucide="download" style="width:12px;height:12px;vertical-align:middle;"></i> EXCEL
                </button>
                ${!donor.archived_at ? `
                <button onclick="window.showArchiveDonorModal('${donor.id}','${(donor.last_name||'').replace(/'/g,"\\'")}')"
                    style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:0.65rem;font-weight:700;">
                    <i data-lucide="archive" style="width:12px;height:12px;vertical-align:middle;"></i> ARCHIVER
                </button>` : `
                <button onclick="window.unarchiveDonor('${donor.id}')"
                    style="background:#f0fdf4;color:#16a34a;border:1px solid #86efac;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:0.65rem;font-weight:700;">
                    <i data-lucide="archive-restore" style="width:12px;height:12px;vertical-align:middle;"></i> DÉSARCHIVER
                </button>`}
                <button onclick="window.askDeleteDonor('${donor.id}', '${(donor.last_name||'').replace(/'/g, "\\'")}')"
                    style="background:#fee2e2;color:#ef4444;border:none;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:0.65rem;">
                    <i data-lucide="trash-2" style="width:12px;height:12px;vertical-align:middle;"></i> SUPPRIMER
                </button>
                <button onclick="window.closeCustomModal()" style="border:none;background:none;cursor:pointer;font-size:1.4rem;color:#94a3b8;line-height:1;">&times;</button>
            </div>
        </div>

        ${donor.archived_at ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:0.82rem;">
            <b style="color:#dc2626;">Motif d'archivage :</b>
            <span style="color:#64748b;margin-left:6px;">${donor.archive_reason || '—'}</span>
            <span style="color:#94a3b8;font-size:0.72rem;margin-left:10px;">le ${new Date(donor.archived_at).toLocaleDateString('fr-FR')}</span>
        </div>` : ''}

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div>
                <p class="mini-label">COORDONNÉES</p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <input type="text" id="edit-last" class="luxe-input" value="${donor.last_name || ''}" placeholder="NOM">
                    <input type="text" id="edit-first" class="luxe-input" value="${donor.first_name || ''}" placeholder="PRÉNOM">
                </div>
                <input type="text" id="edit-company" class="luxe-input" value="${donor.company_name || ''}" placeholder="Entreprise" style="margin-bottom:8px;">
                <input type="email" id="edit-email" class="luxe-input" value="${donor.email || ''}" placeholder="Email" style="margin-bottom:8px;">
                <input type="text" id="edit-phone" class="luxe-input" value="${donor.phone || ''}" placeholder="Tél" style="margin-bottom:8px;">
                <input type="text" id="edit-address" class="luxe-input" value="${donor.address || ''}" placeholder="Adresse" style="margin-bottom:8px;">
                <div style="display:grid; grid-template-columns:1fr 2fr; gap:8px;">
                    <input type="text" id="edit-zip" class="luxe-input" value="${donor.zip_code || ''}" placeholder="CP">
                    <input type="text" id="edit-city" class="luxe-input" value="${donor.city || ''}" placeholder="VILLE">
                </div>
            </div>
            <div>
                <p class="mini-label">SUIVI CRM</p>

                <p class="mini-label" style="font-size:0.68rem;margin:0 0 4px;">TYPE DE CONTACT</p>
                <select id="edit-donor-type" class="luxe-input" style="margin-bottom:8px;">
                    <option value="">— Non renseigné —</option>
                    ${DONOR_TYPES.map(t => `<option ${donor.donor_type===t?'selected':''}>${t}</option>`).join('')}
                </select>

                <p class="mini-label" style="font-size:0.68rem;margin:0 0 4px;">ORIGINE DU CONTACT</p>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <input type="text" id="edit-origin" class="luxe-input" style="margin:0;flex:1;" value="${donor.origin || ''}" placeholder="Ex : Gala 2024, Recommandation...">
                    <button onclick="window.pickOriginFromCampaign('${donor.id}')" title="Lier à une campagne"
                        style="padding:8px;border:1.5px solid var(--gold);background:rgba(197,160,89,0.08);color:var(--gold);border-radius:8px;cursor:pointer;flex-shrink:0;">
                        <i data-lucide="link" style="width:14px;height:14px;vertical-align:middle;"></i>
                    </button>
                </div>

                <textarea id="edit-notes" class="luxe-input" style="height:80px;margin-bottom:10px;">${donor.notes || ''}</textarea>
                <button onclick="window.updateDonorFields('${donor.id}')" class="btn-gold" style="width:100%;height:40px;">ENREGISTRER</button>
            </div>
        </div>

        <div style="margin-top:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <p class="mini-label">HISTORIQUE DES DONS</p>
                <button onclick="window.addDonationPrompt('${id}')" class="btn-gold" style="padding:4px 10px; font-size:0.65rem;">+ AJOUTER UN DON</button>
            </div>
            <div style="max-height:240px; overflow-y:auto; border:1px solid #eee; margin-top:10px; border-radius:8px;">
                <table class="luxe-table">
                    <thead><tr><th>DATE DON</th><th>MONTANT</th><th>MODE</th><th>CAMPAGNE</th><th>N° REÇU</th><th>REMERCIÉ ?</th><th>DATE REMERCT</th><th>MOYEN REMERCT</th><th style="text-align:right;">ACTION</th></tr></thead>
                    <tbody>
                        ${dons.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:15px; color:#999;">Aucun don enregistré</td></tr>' : ''}
                        ${dons.map(don => `
                            <tr style="${!don.thanked ? 'background:rgba(239, 68, 68, 0.05);' : ''}">
                                <td>${new Date(don.date).toLocaleDateString('fr-FR')}</td>
                                <td style="font-weight:700;">${Number(don.amount).toLocaleString('fr-FR')} €</td>
                                <td><span style="font-size:0.75rem; color:#64748b;">${don.payment_mode || '—'}</span></td>
                                <td><span style="font-size:0.75rem; color:#64748b;">${don.campaign || '—'}</span></td>
                                <td>
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <input type="text" id="receipt-${don.id}" value="${don.tax_receipt_number || ''}" placeholder="RF-2024-001" style="padding:4px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85rem; width:100%; max-width:120px;">
                                        <i data-lucide="save" style="width:14px; color:var(--gold); cursor:pointer;" onclick="window.updateReceiptNumber('${don.id}')" title="Enregistrer"></i>
                                    </div>
                                </td>
                                <td style="text-align:center;">
                                    <input type="checkbox" ${don.thanked ? 'checked' : ''} onchange="window.toggleThanked('${don.id}', this.checked)">
                                </td>
                                <td>
                                    <input type="date" id="thank-date-${don.id}"
                                        value="${don.thank_date || ''}"
                                        style="padding:3px 6px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.78rem; width:120px;"
                                        onchange="window.updateThankInfo('${don.id}')">
                                </td>
                                <td>
                                    <input type="text" id="thank-means-${don.id}"
                                        value="${don.thank_means || ''}"
                                        placeholder="Courrier, email..."
                                        style="padding:3px 6px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.78rem; width:110px;"
                                        onchange="window.updateThankInfo('${don.id}')">
                                </td>
                                <td style="text-align:right;">
                                    <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;">
                                        <i data-lucide="split" style="width:14px;color:var(--gold);cursor:pointer;" onclick="window.showDonationAllocationModal('${don.id}',${don.amount})" title="Répartir par entité"></i>
                                        <i data-lucide="trash-2" style="width:14px; color:#ef4444; cursor:pointer;" onclick="window.askDeleteDonation('${don.id}')"></i>
                                    </div>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`);
    lucide.createIcons();
};

/**
 * 6. LOGIQUE DES DONS
 */
window.updateReceiptNumber = async (donId) => {
    const input = document.getElementById(`receipt-${donId}`);
    if (!input) return;
    
    const receiptNumber = input.value.trim() || null;
    
    const { error } = await supabaseClient
        .from('donations')
        .update({ tax_receipt_number: receiptNumber })
        .eq('id', donId);
    
    if (error) {
        window.showNotice("Erreur", "Impossible de mettre à jour le reçu.", "error");
        return;
    }
    
    window.showNotice("Enregistré", "N° de reçu fiscal mis à jour.", "success");
    window.loadDonors();
};

/**
 * 6. LOGIQUE DES DONS (suite)
 */
window.toggleThanked = async (donId, isChecked) => {
    const payload = { thanked: isChecked };
    // Si on coche "remercié" et qu'aucune date n'est encore saisie → pré-remplir avec aujourd'hui
    if (isChecked) {
        const dateInput = document.getElementById(`thank-date-${donId}`);
        if (dateInput && !dateInput.value) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            payload.thank_date = today;
        }
    }
    await supabaseClient.from('donations').update(payload).eq('id', donId);
    loadDonors();
};

/**
 * Sauvegarde la date et le moyen de remerciement d'un don
 */
window.updateThankInfo = async (donId) => {
    const dateVal  = document.getElementById(`thank-date-${donId}`)?.value  || null;
    const meansVal = document.getElementById(`thank-means-${donId}`)?.value?.trim() || null;
    const { error } = await supabaseClient
        .from('donations')
        .update({ thank_date: dateVal, thank_means: meansVal })
        .eq('id', donId);
    if (error) {
        window.showNotice("Erreur", "Impossible de sauvegarder.", "error");
    } else {
        window.showNotice("Enregistré ✅", "Remerciement mis à jour.", "success");
    }
};

window.addDonationPrompt = (donorId) => {
    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="heart-handshake" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                ENREGISTRER UN DON
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- Montant + Date -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                <div>
                    <p class="mini-label">MONTANT (€) *</p>
                    <input type="number" id="don-amt" class="luxe-input" placeholder="0.00" min="0" step="0.01">
                </div>
                <div>
                    <p class="mini-label">DATE DU DON *</p>
                    <input type="date" id="don-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}">
                </div>
            </div>

            <!-- Mode de paiement -->
            <p class="mini-label">MODE DE PAIEMENT</p>
            <select id="don-method" class="luxe-input" style="margin-bottom:14px;">
                <option value="">— Sélectionner —</option>
                <option>Virement bancaire</option>
                <option>Chèque</option>
                <option>Espèces</option>
                <option>Carte bancaire</option>
                <option>Prélèvement automatique</option>
                <option>Helloasso</option>
                <option>Autre</option>
            </select>

            <!-- Reçu fiscal + ID reçu -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                <div>
                    <p class="mini-label">N° REÇU FISCAL</p>
                    <input type="text" id="don-receipt" class="luxe-input" placeholder="Ex: RF-2025-001">
                </div>
                <div>
                    <p class="mini-label">ID REÇU INTERNE</p>
                    <input type="text" id="don-fiscal-id" class="luxe-input" placeholder="Ex: REC-0042">
                </div>
            </div>

            <!-- Campagne / Objet du don -->
            <p class="mini-label">OBJET / CAMPAGNE DU DON</p>
            <input type="text" id="don-campaign" class="luxe-input" placeholder="Ex: Gala 2025, Fête de fin d'année..." style="margin-bottom:14px;">

            <!-- Remerciement -->
            <div style="background:rgba(197,160,89,0.06); border:1px dashed var(--gold); border-radius:10px; padding:14px 16px; margin-bottom:20px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <input type="checkbox" id="don-thanked" style="width:18px;height:18px;accent-color:var(--gold);cursor:pointer;" onchange="window.toggleNewDonThanked(this.checked)">
                    <label for="don-thanked" style="cursor:pointer; font-size:0.88rem; font-weight:600; color:var(--primary);">
                        Le donateur a déjà été remercié pour ce don
                    </label>
                </div>
                <div id="don-thank-details" style="display:none; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div>
                        <p class="mini-label">DATE DU REMERCIEMENT</p>
                        <input type="date" id="don-thank-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div>
                        <p class="mini-label">MOYEN UTILISÉ</p>
                        <input type="text" id="don-thank-means" class="luxe-input" placeholder="Courrier, email, appel...">
                    </div>
                </div>
            </div>

            <button onclick="window.execAddDonation('${donorId}')" class="btn-gold-fill" style="width:100%; height:48px; font-size:0.95rem; letter-spacing:1px;">
                <i data-lucide="check-circle" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                VALIDER LE PAIEMENT
            </button>
        </div>
    `);
    if(window.lucide) lucide.createIcons();
};

window.toggleNewDonThanked = (checked) => {
    const details = document.getElementById('don-thank-details');
    if (details) details.style.display = checked ? 'grid' : 'none';
};

window.execAddDonation = async (donorId) => {
    const amt = document.getElementById('don-amt').value;
    const dat = document.getElementById('don-date').value;
    if (!amt || parseFloat(amt) <= 0) return window.showNotice("Erreur", "Le montant doit être supérieur à 0.", "error");
    if (!dat) return window.showNotice("Erreur", "La date est obligatoire.", "error");

    const { error } = await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: parseFloat(amt),
        date: dat,
        payment_mode: document.getElementById('don-method').value || null,
        tax_receipt_number: document.getElementById('don-receipt').value.trim() || null,
        fiscal_receipt_id: document.getElementById('don-fiscal-id').value.trim() || null,
        campaign: document.getElementById('don-campaign').value.trim() || null,
        thanked: document.getElementById('don-thanked').checked,
        thank_date:  document.getElementById('don-thanked').checked
            ? (document.getElementById('don-thank-date')?.value || null)
            : null,
        thank_means: document.getElementById('don-thanked').checked
            ? (document.getElementById('don-thank-means')?.value?.trim() || null)
            : null
    }]);

    if (error) return window.showNotice("Erreur", error.message, "error");

    window.showNotice("Bravo !", "Don enregistré avec succès.", "success");
    if(typeof loadDashboardData === 'function') loadDashboardData();
    closeCustomModal();
    window.loadDonors();
};

window.updateDonorFields = async (id) => {
    const payload = {
        entity: document.getElementById('edit-entity').value,
        last_name: document.getElementById('edit-last').value.toUpperCase(),
        first_name: document.getElementById('edit-first').value,
        company_name: document.getElementById('edit-company').value || null,
        email: document.getElementById('edit-email').value || null,
        phone: document.getElementById('edit-phone').value || null,
        address: document.getElementById('edit-address') ? document.getElementById('edit-address').value : null,
        zip_code: document.getElementById('edit-zip').value || null,
        city: document.getElementById('edit-city').value || null,
        donor_type: document.getElementById('edit-donor-type')?.value || null,
        origin: document.getElementById('edit-origin').value || null,
        notes: document.getElementById('edit-notes').value || null,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };
    const { error } = await supabaseClient.from('donors').update(payload).eq('id', id);
    if(error) return window.showNotice("Erreur", error.message, "error");
    window.showNotice("Succès ✅", "Fiche mise à jour.", "success");
    loadDonors();
};

/**
 * 7. EXPORTS EXCEL
 */
window.exportAllDonors = () => {
    if (!window.allDonorsData.length) return window.showNotice("Erreur", "Aucune donnée.");
    const yearFilter = document.getElementById('export-year')?.value;
    const wb = XLSX.utils.book_new();
    
    const contactsSheet = XLSX.utils.json_to_sheet(window.allDonorsData.map(({donations, ...d}) => d));
    XLSX.utils.book_append_sheet(wb, contactsSheet, "Répertoire");
    
    const dons = [];
    window.allDonorsData.forEach(d => {
        (d.donations || []).forEach(don => {
            const donYear = new Date(don.date).getFullYear().toString();
            if (!yearFilter || donYear === yearFilter) {
                dons.push({
                    NOM: d.last_name, PRÉNOM: d.first_name, ÉCOLE: d.entity,
                    MONTANT: don.amount, DATE: don.date, MODE: don.payment_mode,
                    REMERCIÉ: don.thanked ? 'OUI' : 'NON'
                });
            }
        });
    });
    
    const donsSheet = XLSX.utils.json_to_sheet(dons);
    XLSX.utils.book_append_sheet(wb, donsSheet, "Journal des Dons");
    XLSX.writeFile(wb, `ALSATIA_CRM_Export_${yearFilter || 'GLOBAL'}.xlsx`);
};

window.exportDonorToExcel = (id) => {
    const d = window.allDonorsData.find(x => x.id === id);
    const wb = XLSX.utils.book_new();
    const info = [{ NOM: d.last_name, PRÉNOM: d.first_name, ÉCOLE: d.entity, EMAIL: d.email, TÉL: d.phone }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Identité");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.donations || []), "Historique Dons");
    XLSX.writeFile(wb, `Fiche_${d.last_name}.xlsx`);
};

/**
 * 8. SUPPRESSIONS (INTERFACE LUXE)
 */
window.askDeleteDonation = (donId) => {
    window.alsatiaConfirm(
        "SUPPRIMER CE DON", 
        "Voulez-vous supprimer ce don définitivement ?",
        async () => {
            await supabaseClient.from('donations').delete().eq('id', donId);
            window.showNotice("Supprimé", "Don effacé.");
            loadDonors();
            closeCustomModal();
        },
        true
    );
};

window.askDeleteDonor = (id, name) => {
    window.alsatiaConfirm(
        "SUPPRESSION DÉFINITIVE", 
        `ATTENTION : Voulez-vous vraiment supprimer <b>${name}</b> et l'intégralité de ses dons ?`,
        async () => {
            await Promise.all([
                supabaseClient.from('donations').delete().eq('donor_id', id),
                supabaseClient.from('donors').delete().eq('id', id)
            ]);
            window.showNotice("Supprimé", "Contact effacé.");
            loadDonors();
            closeCustomModal();
        },
    );
};

// ==========================================
// EXPORT EXCEL - SYSTÈME COMPLET
// ==========================================

/**
 * MODALE DE FILTRES POUR L'EXPORT GLOBAL
 */
window.showExportFiltersModal = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for(let y = currentYear; y >= currentYear - 10; y--) {
        years.push(y);
    }
    
    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">EXPORTER VERS EXCEL</h3>
            <button onclick="window.closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <p class="mini-label">FILTRER PAR ENTITÉ</p>
            <select id="export-entity-filter" class="luxe-input" style="margin-bottom:20px;">
                <option value="ALL">Toutes les entités</option>
                <option>Institut Alsatia</option>
                <option>Academia Alsatia</option>
                <option>Cours Herrade de Landsberg</option>
                <option>Collège Saints Louis et Zélie Martin</option>
            </select>
            
            <p class="mini-label">FILTRER PAR ANNÉE DE DON</p>
            <select id="export-year-filter" class="luxe-input" style="margin-bottom:20px;">
                <option value="ALL">Toutes les années</option>
                ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
            </select>
            
            <button onclick="window.executeExportToExcel()" class="btn-gold-fill" style="width:100%; height:50px; font-size:1rem;">
                <i data-lucide="download" style="width:20px; margin-right:10px; vertical-align:middle;"></i>
                TÉLÉCHARGER LE FICHIER EXCEL
            </button>
        </div>
    `);
    if(window.lucide) lucide.createIcons();
};

/**
 * EXPORT GLOBAL DE TOUS LES DONATEURS
 */
window.executeExportToExcel = async () => {
    const entityFilter = document.getElementById('export-entity-filter').value;
    const yearFilter = document.getElementById('export-year-filter').value;
    
    // Charger TOUS les donateurs avec leurs dons
    const { data: allDonors, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });
    
    if (error) {
        window.showNotice("Erreur", "Impossible de charger les données.", "error");
        return;
    }
    
    // Filtrer par entité
    let filteredDonors = allDonors;
    if (entityFilter !== "ALL") {
        filteredDonors = allDonors.filter(d => d.entity === entityFilter);
    }
    
    // Préparer les données pour l'onglet DONATEURS
    const donorsData = filteredDonors.map(d => ({
        'Nom': d.last_name || '',
        'Prénom': d.first_name || '',
        'Entreprise': d.company_name || '',
        'Entité': d.entity || '',
        'Email': d.email || '',
        'Téléphone': d.phone || '',
        'Adresse': d.address || '',
        'Code Postal': d.zip_code || '',
        'Ville': d.city || '',
        'Origine': d.origin || '',
        'Notes': d.notes || '',
        'Modifié par': d.last_modified_by || '',
        'Total des dons': d.donations ? d.donations.reduce((sum, don) => sum + parseFloat(don.amount || 0), 0) + ' €' : '0 €'
    }));
    
    // Préparer les données pour l'onglet DONS
    let allDonations = [];
    filteredDonors.forEach(d => {
        if (d.donations && d.donations.length > 0) {
            d.donations.forEach(don => {
                // Filtrer par année si nécessaire
                const donYear = new Date(don.date).getFullYear().toString();
                if (yearFilter === "ALL" || donYear === yearFilter) {
                    allDonations.push({
                        'Nom donateur': d.last_name || '',
                        'Prénom donateur': d.first_name || '',
                        'Entreprise': d.company_name || '',
                        'Entité': d.entity || '',
                        'Date du don': new Date(don.date).toLocaleDateString('fr-FR'),
                        'Montant (€)': parseFloat(don.amount || 0),
                        'Mode de paiement': don.payment_mode || '',
                        'Campagne': don.campaign || '',
                        'N° Reçu Fiscal': don.tax_receipt_number || '',
                        'ID Reçu Interne': don.fiscal_receipt_id || '',
                        'Remercié': don.thanked ? 'Oui' : 'Non',
                        'Date remerciement': don.thank_date ? new Date(don.thank_date).toLocaleDateString('fr-FR') : '',
                        'Moyen remerciement': don.thank_means || ''
                    });
                }
            });
        }
    });
    
    // Créer le fichier Excel avec 2 onglets
    const wb = XLSX.utils.book_new();
    
    // Onglet 1 : DONATEURS
    const ws1 = XLSX.utils.json_to_sheet(donorsData);
    XLSX.utils.book_append_sheet(wb, ws1, "Donateurs");
    
    // Onglet 2 : DONS
    const ws2 = XLSX.utils.json_to_sheet(allDonations);
    XLSX.utils.book_append_sheet(wb, ws2, "Dons");
    
    // Télécharger le fichier
    const fileName = `Alsatia_Export_${entityFilter}_${yearFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    window.closeCustomModal();
    window.showNotice("Téléchargé !", `Fichier "${fileName}" prêt`, "success");
};

/**
 * EXPORT D'UN DONATEUR SPÉCIFIQUE (depuis sa fiche)
 */
window.exportDonorToExcel = async (donorId) => {
    // Charger le donateur avec tous ses dons
    const { data: donor, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .eq('id', donorId)
        .single();
    
    if (error || !donor) {
        window.showNotice("Erreur", "Impossible de charger les données.", "error");
        return;
    }
    
    // Onglet 1 : INFORMATIONS DU DONATEUR
    const donorInfo = [{
        'Nom': donor.last_name || '',
        'Prénom': donor.first_name || '',
        'Entreprise': donor.company_name || '',
        'Entité': donor.entity || '',
        'Email': donor.email || '',
        'Téléphone': donor.phone || '',
        'Adresse': donor.address || '',
        'Code Postal': donor.zip_code || '',
        'Ville': donor.city || '',
        'Origine': donor.origin || '',
        'Notes': donor.notes || '',
        'Modifié par': donor.last_modified_by || '',
        'Total des dons': donor.donations ? donor.donations.reduce((sum, don) => sum + parseFloat(don.amount || 0), 0) + ' €' : '0 €',
        'Nombre de dons': donor.donations ? donor.donations.length : 0
    }];
    
    // Onglet 2 : TOUS LES DONS DU DONATEUR
    const donationsData = donor.donations && donor.donations.length > 0 
        ? donor.donations.map(don => ({
            'Date': new Date(don.date).toLocaleDateString('fr-FR'),
            'Montant (€)': parseFloat(don.amount || 0),
            'Mode de paiement': don.payment_mode || '',
            'Campagne': don.campaign || '',
            'N° Reçu Fiscal': don.tax_receipt_number || '',
            'ID Reçu Interne': don.fiscal_receipt_id || '',
            'Remercié': don.thanked ? 'Oui' : 'Non',
            'Date remerciement': don.thank_date ? new Date(don.thank_date).toLocaleDateString('fr-FR') : '',
            'Moyen remerciement': don.thank_means || ''
        }))
        : [{ 'Aucun don enregistré': '' }];
    
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(donorInfo);
    XLSX.utils.book_append_sheet(wb, ws1, "Informations");
    const ws2 = XLSX.utils.json_to_sheet(donationsData);
    XLSX.utils.book_append_sheet(wb, ws2, "Historique des dons");
    
    const fileName = `${donor.last_name}_${donor.first_name || 'Donateur'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    window.showNotice("Téléchargé !", `Fichier "${fileName}" prêt`, "success");
};


// ══════════════════════════════════════════════════════════════════════
// CENTRE D'EXPORTS — 8 EXPORTS CRM
// ══════════════════════════════════════════════════════════════════════

// Helper : appliquer largeurs de colonnes auto sur une worksheet XLSX
function xlsxAutoWidth(ws, data) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const colWidths = keys.map(k => {
        const maxLen = Math.max(
            k.length,
            ...data.map(row => String(row[k] || '').length)
        );
        return { wch: Math.min(maxLen + 2, 50) };
    });
    ws['!cols'] = colWidths;
}

// Helper : date FR
function dateFR(val) {
    if (!val) return '';
    try { return new Date(val).toLocaleDateString('fr-FR'); } catch { return val; }
}

// ── Modale centrale des exports ────────────────────────────────────────
window.showExportCenterModal = () => {
    const exports = [
        { id: 1, icon: 'bell-ring',    color: '#ef4444', label: 'Remerciements en attente',        desc: 'Dons non remerciés à traiter' },
        { id: 2, icon: 'bar-chart-2',  color: '#8b5cf6', label: 'Bilan annuel par donateur',       desc: 'Évolution des dons année par année' },
        { id: 3, icon: 'megaphone',    color: '#f59e0b', label: 'Export campagne',                  desc: 'Destinataires + statuts + dons liés' },
        { id: 4, icon: 'book-user',    color: '#3b82f6', label: 'Annuaire contacts',                desc: 'Tous les profils CRM' },
        { id: 5, icon: 'building-2',   color: '#10b981', label: 'Dons par entité',                  desc: 'Un onglet par établissement' },
        { id: 6, icon: 'clock',        color: '#64748b', label: 'Donateurs sans don récent',        desc: 'Relances à prévoir' },
        { id: 7, icon: 'calendar',     color: '#ec4899', label: 'Événements',                       desc: 'Liste des événements et participants' },
        { id: 8, icon: 'landmark',     color: '#c5a059', label: 'Legs & Planification',             desc: 'Suivi juridique / notarial' },
        { id: 0, icon: 'download',     color: '#1e293b', label: 'Export global donateurs',          desc: 'Répertoire complet + journal des dons' },
    ];

    const cards = exports.map(e => `
        <div onclick="window.runExport(${e.id})"
             style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:12px;border:1.5px solid #e2e8f0;cursor:pointer;transition:all 0.18s;background:white;"
             onmouseover="this.style.borderColor='${e.color}';this.style.background='${e.color}10';this.style.transform='translateX(4px)';"
             onmouseout="this.style.borderColor='#e2e8f0';this.style.background='white';this.style.transform='translateX(0)';">
            <div style="width:40px;height:40px;border-radius:10px;background:${e.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i data-lucide="${e.icon}" style="width:18px;height:18px;color:${e.color};"></i>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.88rem;color:var(--text-main);">${e.label}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${e.desc}</div>
            </div>
            <i data-lucide="chevron-right" style="width:16px;height:16px;color:#cbd5e1;flex-shrink:0;"></i>
        </div>`).join('');

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">📊 CENTRE D'EXPORTS</h3>
            <button onclick="window.closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body" style="display:flex;flex-direction:column;gap:10px;">
            ${cards}
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

// ── Routeur ─────────────────────────────────────────────────────────────
window.runExport = async (id) => {
    window.closeCustomModal();
    await new Promise(r => setTimeout(r, 150));

    switch(id) {
        case 0: window.showExportFiltersModal(); break;
        case 1: await window.exportUnthanked(); break;
        case 2: await window.exportAnnualSummary(); break;
        case 3: await window.exportCampaignPicker(); break;
        case 4: await window.exportContacts(); break;
        case 5: await window.exportByEntity(); break;
        case 6: await window.exportInactiveDonors(); break;
        case 7: await window.exportEvents(); break;
        case 8: await window.exportLegs(); break;
    }
};

// ══════════════════════════════════════════════════════════════
// EXPORT 1 — Remerciements en attente
// ══════════════════════════════════════════════════════════════
window.exportUnthanked = async () => {
    window.showNotice('⏳', 'Préparation de l\'export...', 'info');
    const { data, error } = await supabaseClient
        .from('donors').select('*, donations(*)').order('last_name');
    if (error) return window.showNotice('Erreur', error.message, 'error');

    const rows = [];
    (data || []).forEach(d => {
        if (d.archived_at) return;
        (d.donations || []).forEach(don => {
            if (don.thanked !== false) return;
            rows.push({
                'Nom':              d.last_name || '',
                'Prénom':           d.first_name || '',
                'Entreprise':       d.company_name || '',
                'Entité':           d.entity || '',
                'Email':            d.email || '',
                'Téléphone':        d.phone || '',
                'Date du don':      dateFR(don.date),
                'Montant (€)':      parseFloat(don.amount || 0),
                'Mode de paiement': don.payment_mode || '',
                'N° Reçu':          don.tax_receipt_number || '',
                'Notes donateur':   d.notes || '',
            });
        });
    });

    if (!rows.length) return window.showNotice('Info', 'Aucun remerciement en attente !', 'info');

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    xlsxAutoWidth(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Remerciements en attente');
    const fn = `Remerciements_en_attente_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fn);
    window.showNotice('✅ Téléchargé', `${rows.length} dons à remercier — "${fn}"`, 'success');
};

// ══════════════════════════════════════════════════════════════
// EXPORT 2 — Bilan annuel par donateur (tableau croisé)
// ══════════════════════════════════════════════════════════════
window.exportAnnualSummary = async () => {
    window.showNotice('⏳', 'Préparation du bilan annuel...', 'info');
    const { data, error } = await supabaseClient
        .from('donors').select('*, donations(*)').order('last_name');
    if (error) return window.showNotice('Erreur', error.message, 'error');

    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 7}, (_, i) => currentYear - 6 + i); // 7 dernières années

    const rows = (data || []).map(d => {
        const row = {
            'Nom':        d.last_name || '',
            'Prénom':     d.first_name || '',
            'Entreprise': d.company_name || '',
            'Entité':     d.entity || '',
            'Type':       d.donor_type || '',
        };
        let total = 0;
        years.forEach(y => {
            const sum = (d.donations || [])
                .filter(don => don.date && new Date(don.date).getFullYear() === y)
                .reduce((s, don) => s + parseFloat(don.amount || 0), 0);
            row[`${y}`] = sum > 0 ? sum : '';
            total += sum;
        });
        row['TOTAL'] = total > 0 ? total : '';
        row['Nb dons'] = (d.donations || []).length;
        row['Archivé'] = d.archived_at ? 'Oui' : '';
        return row;
    }).filter(r => r['TOTAL'] !== ''); // exclure les sans-dons

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    xlsxAutoWidth(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Bilan annuel');
    const fn = `Bilan_annuel_donateurs_${currentYear}.xlsx`;
    XLSX.writeFile(wb, fn);
    window.showNotice('✅ Téléchargé', `${rows.length} donateurs — "${fn}"`, 'success');
};

// ══════════════════════════════════════════════════════════════
// EXPORT 3 — Campagne (picker puis export)
// ══════════════════════════════════════════════════════════════
window.exportCampaignPicker = async () => {
    const { data: camps, error } = await supabaseClient
        .from('campaigns').select('id, name, status, created_at').order('created_at', { ascending: false });
    if (error) return window.showNotice('Erreur', error.message, 'error');

    const options = (camps || []).map(c =>
        `<option value="${c.id}">${c.name} — ${c.status}</option>`).join('');

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">EXPORTER UNE CAMPAGNE</h3>
            <button onclick="window.closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <p class="mini-label">CHOISIR LA CAMPAGNE</p>
            <select id="export-campaign-select" class="luxe-input" style="margin-bottom:20px;">
                ${options}
            </select>
            <button onclick="window.doExportCampaign()" class="btn-gold-fill" style="width:100%;height:50px;font-size:1rem;">
                <i data-lucide="download" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                TÉLÉCHARGER
            </button>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

window.doExportCampaign = async () => {
    const id = document.getElementById('export-campaign-select')?.value;
    if (!id) return;
    window.closeCustomModal();
    window.showNotice('⏳', 'Préparation...', 'info');

    const [{ data: camp }, { data: recipients }] = await Promise.all([
        supabaseClient.from('campaigns').select('*').eq('id', id).single(),
        supabaseClient.from('campaign_recipients')
            .select('*, donors(last_name,first_name,company_name,email,phone,address,zip_code,city,entity), donations(amount,date,payment_mode,thanked)')
            .eq('campaign_id', id).order('created_at', { ascending: true })
    ]);

    const wb = XLSX.utils.book_new();

    // Onglet 1 : résumé campagne
    const total = recipients?.length || 0;
    const responded = recipients?.filter(r => r.status === 'Répondu').length || 0;
    const totalRaised = (recipients || []).filter(r => r.donations).reduce((s,r) => s + parseFloat(r.donations?.amount||0), 0);
    const summary = [{
        'Nom de la campagne': camp.name,
        'Statut':             camp.status,
        'Canal':              camp.canal || '',
        'Objectif':           camp.objective || '',
        'Date début':         dateFR(camp.start_date),
        'Date fin':           dateFR(camp.end_date),
        'Total destinataires': total,
        'Ont répondu':        responded,
        'Taux de réponse':    total > 0 ? Math.round(responded/total*100)+'%' : '0%',
        'Montant collecté (€)': totalRaised,
        'Objectif montant (€)': camp.goal_amount || '',
        'Notes':              camp.notes || '',
    }];
    const ws1 = XLSX.utils.json_to_sheet(summary);
    xlsxAutoWidth(ws1, summary);
    XLSX.utils.book_append_sheet(wb, ws1, 'Résumé');

    // Onglet 2 : destinataires
    const recRows = (recipients || []).map(r => ({
        'Nom':            r.donors?.last_name || '',
        'Prénom':         r.donors?.first_name || '',
        'Entreprise':     r.donors?.company_name || '',
        'Entité':         r.donors?.entity || '',
        'Email':          r.donors?.email || '',
        'Téléphone':      r.donors?.phone || '',
        'Adresse':        r.donors?.address || '',
        'CP':             r.donors?.zip_code || '',
        'Ville':          r.donors?.city || '',
        'Statut':         r.status || '',
        'Don lié (€)':    r.donations ? parseFloat(r.donations.amount||0) : '',
        'Date du don':    r.donations ? dateFR(r.donations.date) : '',
        'Mode paiement':  r.donations?.payment_mode || '',
        'Remercié':       r.donations?.thanked ? 'Oui' : '',
    }));
    const ws2 = XLSX.utils.json_to_sheet(recRows.length ? recRows : [{'Aucun destinataire':''}]);
    xlsxAutoWidth(ws2, recRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Destinataires');

    const fn = `Campagne_${(camp.name||'export').replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fn);
    window.showNotice('✅ Téléchargé', `"${fn}"`, 'success');
};

// ══════════════════════════════════════════════════════════════
// EXPORT 4 — Annuaire contacts (profiles)
// ══════════════════════════════════════════════════════════════
window.exportContacts = async () => {
    window.showNotice('⏳', 'Chargement de l\'annuaire...', 'info');
    const { data, error } = await supabaseClient
        .from('profiles').select('*').order('portal').order('last_name');
    if (error) return window.showNotice('Erreur', error.message, 'error');

    const rows = (data || []).map(u => ({
        'Portail':        u.portal || '',
        'Nom':            u.last_name || '',
        'Prénom':         u.first_name || '',
        'Email':          u.email || '',
        'Téléphone':      u.phone || '',
        'Rôle':           u.role || '',
        'Accès Donateurs': u.access_donors ? 'Oui' : '',
        'Accès Campagnes': u.access_campaigns ? 'Oui' : '',
        'Accès Événements':u.access_events ? 'Oui' : '',
        'Créé le':        dateFR(u.created_at),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    xlsxAutoWidth(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Annuaire');
    const fn = `Annuaire_contacts_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fn);
    window.showNotice('✅ Téléchargé', `${rows.length} contacts — "${fn}"`, 'success');
};

// ══════════════════════════════════════════════════════════════
// EXPORT 5 — Dons par entité (un onglet par école)
// ══════════════════════════════════════════════════════════════
window.exportByEntity = async () => {
    window.showNotice('⏳', 'Préparation par entité...', 'info');
    const { data, error } = await supabaseClient
        .from('donors').select('*, donations(*)').order('last_name');
    if (error) return window.showNotice('Erreur', error.message, 'error');

    const wb = XLSX.utils.book_new();
    const entities = ALL_ENTITIES;

    entities.forEach(entity => {
        const donors = (data || []).filter(d => d.entity === entity);
        const rows = [];
        donors.forEach(d => {
            (d.donations || []).forEach(don => {
                rows.push({
                    'Nom':            d.last_name || '',
                    'Prénom':         d.first_name || '',
                    'Entreprise':     d.company_name || '',
                    'Date du don':    dateFR(don.date),
                    'Montant (€)':    parseFloat(don.amount || 0),
                    'Mode':           don.payment_mode || '',
                    'N° Reçu':        don.tax_receipt_number || '',
                    'Remercié':       don.thanked ? 'Oui' : 'Non',
                    'Date remerciement': dateFR(don.thank_date),
                });
            });
        });
        const sheetName = entity.substring(0, 31); // max 31 chars pour Excel
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Aucun don': '' }]);
        if (rows.length) xlsxAutoWidth(ws, rows);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Onglet récapitulatif
    const recap = entities.map(entity => {
        const donors = (data || []).filter(d => d.entity === entity);
        const allDons = donors.flatMap(d => d.donations || []);
        return {
            'Entité':            entity,
            'Nb donateurs':      donors.length,
            'Nb dons':           allDons.length,
            'Total collecté (€)':allDons.reduce((s,d) => s+parseFloat(d.amount||0), 0),
            'Non remerciés':     allDons.filter(d => d.thanked === false).length,
        };
    });
    const wsR = XLSX.utils.json_to_sheet(recap);
    xlsxAutoWidth(wsR, recap);
    XLSX.utils.book_append_sheet(wb, wsR, 'Récapitulatif');

    const fn = `Dons_par_entite_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fn);
    window.showNotice('✅ Téléchargé', `${entities.length} onglets — "${fn}"`, 'success');
};

// ══════════════════════════════════════════════════════════════
// EXPORT 6 — Donateurs sans don récent (relances)
// ══════════════════════════════════════════════════════════════
window.exportInactiveDonors = async () => {
    // Demander le seuil
    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">DONATEURS SANS DON RÉCENT</h3>
            <button onclick="window.closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <p class="mini-label">INACTIF DEPUIS PLUS DE</p>
            <select id="export-inactive-years" class="luxe-input" style="margin-bottom:20px;">
                <option value="1">1 an</option>
                <option value="2" selected>2 ans</option>
                <option value="3">3 ans</option>
                <option value="5">5 ans</option>
            </select>
            <button onclick="window.doExportInactive()" class="btn-gold-fill" style="width:100%;height:50px;font-size:1rem;">
                <i data-lucide="download" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                TÉLÉCHARGER
            </button>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

window.doExportInactive = async () => {
    const years = parseInt(document.getElementById('export-inactive-years')?.value || '2');
    window.closeCustomModal();
    window.showNotice('⏳', 'Recherche des donateurs inactifs...', 'info');

    const { data, error } = await supabaseClient
        .from('donors').select('*, donations(*)').order('last_name');
    if (error) return window.showNotice('Erreur', error.message, 'error');

    const threshold = new Date();
    threshold.setFullYear(threshold.getFullYear() - years);

    const rows = (data || []).filter(d => {
        if (d.archived_at) return false;
        if (!d.donations || !d.donations.length) return true; // jamais donné
        const lastDon = d.donations.reduce((max, don) =>
            new Date(don.date) > new Date(max.date) ? don : max, d.donations[0]);
        return new Date(lastDon.date) < threshold;
    }).map(d => {
        const dons = d.donations || [];
        const lastDon = dons.length ? dons.reduce((max, don) =>
            new Date(don.date) > new Date(max.date) ? don : max, dons[0]) : null;
        return {
            'Nom':                d.last_name || '',
            'Prénom':             d.first_name || '',
            'Entreprise':         d.company_name || '',
            'Entité':             d.entity || '',
            'Email':              d.email || '',
            'Téléphone':          d.phone || '',
            'Ville':              d.city || '',
            'Dernier don':        lastDon ? dateFR(lastDon.date) : 'Aucun',
            'Montant dernier don':lastDon ? parseFloat(lastDon.amount||0) : '',
            'Total dons':         dons.reduce((s,don) => s+parseFloat(don.amount||0), 0),
            'Nb dons':            dons.length,
            'Notes':              d.notes || '',
        };
    });

    if (!rows.length) return window.showNotice('Info', `Aucun donateur inactif depuis ${years} ans`, 'info');

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    xlsxAutoWidth(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, `Inactifs +${years}ans`);
    const fn = `Donateurs_inactifs_${years}ans_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fn);
    window.showNotice('✅ Téléchargé', `${rows.length} donateurs inactifs — "${fn}"`, 'success');
};

// ══════════════════════════════════════════════════════════════
// EXPORT 7 — Événements
// ══════════════════════════════════════════════════════════════
window.exportEvents = async () => {
    window.showNotice('⏳', 'Chargement des événements...', 'info');
    const { data, error } = await supabaseClient
        .from('events_v2').select('*').order('event_date', { ascending: true });
    if (error) return window.showNotice('Erreur', error.message, 'error');

    const rows = (data || []).map(e => ({
        'Titre':          e.title || '',
        'Date':           dateFR(e.event_date),
        'Lieu':           e.location || '',
        'Entité':         e.entity || e.portal || '',
        'Description':    e.description || '',
        'Statut':         e.status || '',
        'Nb participants':e.participant_count || '',
        'Créé le':        dateFR(e.created_at),
        'Notes':          e.notes || '',
    }));

    if (!rows.length) return window.showNotice('Info', 'Aucun événement à exporter.', 'info');

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    xlsxAutoWidth(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Événements');
    const fn = `Evenements_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fn);
    window.showNotice('✅ Téléchargé', `${rows.length} événements — "${fn}"`, 'success');
};

// ══════════════════════════════════════════════════════════════
// EXPORT 8 — Legs & Planification
// ══════════════════════════════════════════════════════════════
window.exportLegs = async () => {
    window.showNotice('⏳', 'Chargement des dossiers legs...', 'info');
    const { data, error } = await supabaseClient
        .from('donors').select('*, donations(*)')
        .eq('donor_type', 'Legs')
        .order('last_name');
    if (error) return window.showNotice('Erreur', error.message, 'error');

    const rows = (data || []).map(d => {
        const dons = d.donations || [];
        return {
            'Nom':              d.last_name || '',
            'Prénom':           d.first_name || '',
            'Entreprise':       d.company_name || '',
            'Entité':           d.entity || '',
            'Email':            d.email || '',
            'Téléphone':        d.phone || '',
            'Adresse':          d.address || '',
            'Code Postal':      d.zip_code || '',
            'Ville':            d.city || '',
            'Origine':          d.origin || '',
            'Total dons (€)':   dons.reduce((s,don) => s+parseFloat(don.amount||0), 0),
            'Nb dons':          dons.length,
            'Dernier don':      dons.length ? dateFR(dons.reduce((max,don) =>
                new Date(don.date)>new Date(max.date)?don:max, dons[0]).date) : '',
            'Archivé':          d.archived_at ? dateFR(d.archived_at) : '',
            'Raison archivage': d.archive_reason || '',
            'Notes':            d.notes || '',
        };
    });

    if (!rows.length) return window.showNotice('Info', 'Aucun donateur de type "Legs" trouvé.', 'info');

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    xlsxAutoWidth(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Legs et Planification');
    const fn = `Legs_Planification_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fn);
    window.showNotice('✅ Téléchargé', `${rows.length} dossiers legs — "${fn}"`, 'success');
};


function loadUsersForMentions() { console.log("Module CRM Alsatia v2.0 chargé."); }

// ==========================================
// SUPPRESSION EN MASSE — DONATEURS
// ==========================================

const ENTITIES_LIST = [
    'Toutes les entités',
    'Institut Alsatia',
    'Cours Herrade de Landsberg',
    'Collège Saints Louis et Zélie Martin',
    'Academia Alsatia'
];

window.showDeleteAllDonorsModal = () => {
    if (currentUser.portal !== 'Institut Alsatia') {
        window.showNotice("Accès refusé", "Réservé à Institut Alsatia.", "error");
        return;
    }

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title" style="color:#ef4444;">
                <i data-lucide="trash-2" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:#ef4444;"></i>
                SUPPRESSION EN MASSE
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <div style="background:#fef2f2; border:2px solid #ef4444; border-radius:12px; padding:16px; margin-bottom:20px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <i data-lucide="alert-triangle" style="width:22px;height:22px;color:#ef4444;flex-shrink:0;"></i>
                    <span style="font-weight:800; font-size:0.9rem; color:#991b1b; text-transform:uppercase;">Action irréversible</span>
                </div>
                <p style="font-size:0.83rem; color:#7f1d1d; margin:0; line-height:1.6;">
                    Cette action supprime <b>définitivement</b> les donateurs sélectionnés 
                    <b>ainsi que tous leurs dons associés</b>. Aucun retour en arrière possible.
                </p>
            </div>

            <p class="mini-label">PÉRIMÈTRE DE SUPPRESSION</p>
            <select id="delete-entity-scope" class="luxe-input" style="margin-bottom:16px;" onchange="window.updateDeleteCount()">
                ${ENTITIES_LIST.map(e => `<option value="${e}">${e}</option>`).join('')}
            </select>

            <div id="delete-count-display" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; text-align:center; margin-bottom:20px;">
                <div id="delete-count-number" style="font-size:2rem; font-weight:900; color:#ef4444;">—</div>
                <div style="font-size:0.75rem; color:#64748b; font-weight:600; text-transform:uppercase;">contacts concernés</div>
            </div>

            <p class="mini-label" style="color:#ef4444;">CONFIRMATION — TAPEZ "SUPPRIMER" POUR VALIDER</p>
            <input type="text" id="delete-confirm-input" class="luxe-input" placeholder='Tapez SUPPRIMER' 
                style="border:2px solid #ef4444; margin-bottom:20px; text-transform:uppercase;"
                oninput="window.checkDeleteConfirm()">

            <button id="btn-exec-delete" onclick="window.execDeleteAllDonors()" 
                class="btn-gold-fill" 
                style="width:100%; height:50px; background:#ef4444; border-color:#ef4444; display:none; font-size:1rem; letter-spacing:1px;">
                <i data-lucide="trash-2" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                SUPPRIMER DÉFINITIVEMENT
            </button>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
    window.updateDeleteCount();
};

window.updateDeleteCount = async () => {
    const scope = document.getElementById('delete-entity-scope')?.value;
    if (!scope) return;

    let query = supabaseClient.from('donors').select('id', { count: 'exact', head: true });
    if (scope !== 'Toutes les entités') query = query.eq('entity', scope);

    const { count, error } = await query;
    const el = document.getElementById('delete-count-number');
    if (el) el.textContent = error ? '?' : (count ?? 0);
};

window.checkDeleteConfirm = () => {
    const val = document.getElementById('delete-confirm-input')?.value?.trim().toUpperCase();
    const btn = document.getElementById('btn-exec-delete');
    if (btn) btn.style.display = val === 'SUPPRIMER' ? 'block' : 'none';
};

window.execDeleteAllDonors = async () => {
    const scope = document.getElementById('delete-entity-scope')?.value;
    const confirm = document.getElementById('delete-confirm-input')?.value?.trim().toUpperCase();

    if (confirm !== 'SUPPRIMER') {
        window.showNotice("Confirmation manquante", "Tapez SUPPRIMER pour valider.", "error");
        return;
    }

    const btn = document.getElementById('btn-exec-delete');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width:16px;vertical-align:middle;margin-right:8px;animation:spin 1s linear infinite;"></i>Suppression en cours...';
        if (window.lucide) lucide.createIcons();
    }

    // 1. Récupérer les IDs des donateurs concernés
    let query = supabaseClient.from('donors').select('id');
    if (scope !== 'Toutes les entités') query = query.eq('entity', scope);
    const { data: donors, error: fetchErr } = await query;

    if (fetchErr || !donors) {
        window.showNotice("Erreur", "Impossible de récupérer les donateurs.", "error");
        return;
    }

    const ids = donors.map(d => d.id);
    if (!ids.length) {
        window.showNotice("Rien à supprimer", "Aucun contact trouvé pour ce périmètre.", "info");
        closeCustomModal();
        return;
    }

    // 2. Supprimer les dons liés par batch
    const BATCH = 100;
    for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        await supabaseClient.from('donations').delete().in('donor_id', batch);
    }

    // 3. Supprimer les donateurs par batch
    for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        await supabaseClient.from('donors').delete().in('id', batch);
    }

    closeCustomModal();
    const label = scope === 'Toutes les entités' ? 'tous les contacts' : `les contacts de "${scope}"`;
    window.showNotice(
        "Suppression effectuée ✅",
        `${ids.length} contact${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''} (${label}).`,
        "success"
    );
    window.loadDonors();
};

// ==========================================
// IMPORT EXCEL — DONATEURS (Institut Alsatia uniquement)
// Optimisé pour le fichier "Tableau_amis_et_donateurs.xlsx"
// ==========================================

// ─── UTILITAIRES ──────────────────────────────────────────────────────────────

/**
 * Nettoie une valeur brute : supprime espaces, \n, retours chariot
 */
function _raw(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/\r?\n/g, ' ').trim();
}

/**
 * Prend le premier email si plusieurs sont séparés par \n
 */
function _firstEmail(v) {
    if (!v) return null;
    const first = String(v).split(/\r?\n/)[0].trim().toLowerCase();
    return first || null;
}

/**
 * Évalue les formules simples du type =300+150, =8*8, =SUM(...)
 * Retourne un nombre ou null
 */
function _evalAmount(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v > 0 ? v : null;
    const s = String(v).trim();
    if (s === '' || s === '-') return null;
    // Ignorer les formules SUM globales (lignes totaux)
    if (s.toUpperCase().includes('SUM(')) return null;
    // Évaluer formules simples : =300+150, =8*8, =4200
    if (s.startsWith('=')) {
        try {
            // Remplacer les opérateurs autorisés uniquement
            const expr = s.slice(1).replace(/[^0-9+\-*/.()]/g, '');
            // eslint-disable-next-line no-new-func
            const result = Function('"use strict"; return (' + expr + ')')();
            return typeof result === 'number' && isFinite(result) && result > 0 ? result : null;
        } catch { return null; }
    }
    const n = parseFloat(s.replace(',', '.'));
    return !isNaN(n) && n > 0 ? n : null;
}

/**
 * Détermine l'entité(s) à partir des colonnes "donateur école" / "donateur collège"
 * - "donateur école"   = x  →  Cours Herrade de Landsberg
 * - "donateur collège" = x  →  Collège Saints Louis et Zélie Martin
 * - ni l'un ni l'autre     →  Institut Alsatia (par défaut)
 */
function _resolveEntities(ecole, college) {
    const isEcole   = _raw(ecole).toLowerCase()   === 'x';
    const isCollege = _raw(college).toLowerCase() === 'x';
    const entities = [];
    if (isEcole)   entities.push('Cours Herrade de Landsberg');
    if (isCollege) entities.push('Collège Saints Louis et Zélie Martin');
    if (!entities.length) entities.push('Institut Alsatia');
    return entities;
}

/**
 * Découpe une adresse postale en {address, zip_code, city}
 * Gère : "12 rue de la Paix 67000 Strasbourg"
 *        "1292, chemin des Arriecs 40 700 Horsarrieu"  (CP avec espace)
 */
function _parseAddress(raw) {
    if (!raw || !raw.trim()) return { address: null, zip_code: null, city: null };
    const s = raw.trim();
    // Chercher un CP : 5 chiffres consécutifs (ou 2+espace+3 comme "40 700")
    const cpMatch = s.match(/(\d{2}\s?\d{3})\s+([^\d].*)?$/);
    if (cpMatch) {
        const cp   = cpMatch[1].replace(/\s/g, '');
        const city = (cpMatch[2] || '').trim() || null;
        const addr = s.substring(0, cpMatch.index).trim().replace(/[,\s]+$/, '') || null;
        return { address: addr, zip_code: cp, city };
    }
    return { address: s, zip_code: null, city: null };
}

/**
 * Formate une date ISO à partir d'une valeur quelconque
 */
function _toISODate(v) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split('T')[0];
    const s = String(v).trim();
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10);
    const parts = s.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    return null;
}

// Stockage temporaire
window._importPreviewData = [];
window._importDonsData    = [];

// ─── PARSERS PAR ONGLET ───────────────────────────────────────────────────────

/**
 * Parse l'onglet "Suivi donateurs et amis" (et "donateurs IFI", "archives donateurs")
 * Structure : Nom(2) Prénom(3) école(0) collège(1) type(4) lien(5) tel(6) mail(7)
 *             adresse(8) 2022(9) 2023(10) 2024(11) 2025(12) 2026(13)
 *             reçu(14) paiement(15) statut(18) dernière action(19) prochaine(20)
 *             remercié(21) notes(22)
 */
function _parseSheetPersonnes(rows, sourceLabel) {
    const donors = [];
    const dons   = [];

    rows.forEach((r, i) => {
        const nom = _raw(r[2]);
        if (!nom || nom.toLowerCase() === 'nom') return; // skip vide ou en-tête

        const entities = _resolveEntities(r[0], r[1]);
        const prenom   = _raw(r[3]);
        const phone    = _raw(r[6]);
        const email    = _firstEmail(r[7]);
        const parsedAddr = _parseAddress(_raw(r[8]));
        const remercie = _raw(r[21]).toLowerCase();
        const thanked  = ['oui', 'o', 'yes', '1'].includes(remercie);

        // Construire les notes en regroupant les infos de suivi
        const noteParts = [];
        if (_raw(r[4]))  noteParts.push(`Type: ${_raw(r[4])}`);
        if (_raw(r[5]))  noteParts.push(`Lien: ${_raw(r[5])}`);
        if (_raw(r[18])) noteParts.push(`Statut: ${_raw(r[18])}`);
        if (_raw(r[19])) noteParts.push(`Dernière action: ${_raw(r[19])}`);
        if (_raw(r[20])) noteParts.push(`Prochaine action: ${_raw(r[20])}`);
        if (_raw(r[22])) noteParts.push(_raw(r[22]));
        const notes = noteParts.join(' | ') || null;

        const receiptNumber = _raw(r[14]) || null;
        const paymentMode   = _raw(r[15]) || null;

        // Un donateur peut être dans les deux entités → on crée une entrée par entité
        entities.forEach(entity => {
            const donorKey = `${nom.toUpperCase()}__${entity}__${sourceLabel}__${i}`;
            donors.push({
                _key: donorKey,
                last_name: nom.toUpperCase(),
                first_name: prenom || null,
                company_name: null,
                entity,
                email,
                phone: phone || null,
                address: parsedAddr.address,
                zip_code: parsedAddr.zip_code,
                city: parsedAddr.city,
                origin: sourceLabel,
                notes,
                last_modified_by: 'Import Excel'
            });

            // Colonnes années → dons individuels
            const YEARS = [
                { col: 9,  year: 2022 },
                { col: 10, year: 2023 },
                { col: 11, year: 2024 },
                { col: 12, year: 2025 },
                { col: 13, year: 2026 },
            ];
            YEARS.forEach(({ col, year }) => {
                const amount = _evalAmount(r[col]);
                if (amount !== null) {
                    dons.push({
                        _donor_key: donorKey,
                        amount,
                        date: `${year}-01-01`,
                        payment_mode: paymentMode,
                        tax_receipt_number: receiptNumber,
                        fiscal_receipt_id: null,
                        campaign: null,
                        thanked: thanked && year === Math.max(...YEARS.filter(y => _evalAmount(r[y.col])).map(y => y.year)),
                        _valid: true
                    });
                }
            });
        });
    });

    return { donors, dons };
}

/**
 * Parse l'onglet "suivi entreprises"
 * Structure : école(0) collège(1) entité/nom(2) type(3) lien(4) tel(5) mail(6)
 *             adresse(7) 2022(13) 2023(14) 2024(15) 2025(16) remercié(17) notes(18)
 */
function _parseSheetEntreprises(rows) {
    const donors = [];
    const dons   = [];

    rows.forEach((r, i) => {
        const nom = _raw(r[2]);
        if (!nom) return;

        const entities = _resolveEntities(r[0], r[1]);

        const noteParts = [];
        if (_raw(r[3])) noteParts.push(`Type: ${_raw(r[3])}`);
        if (_raw(r[4])) noteParts.push(`Lien: ${_raw(r[4])}`);
        if (_raw(r[10])) noteParts.push(`Statut: ${_raw(r[10])}`);
        if (_raw(r[11])) noteParts.push(`Dernière action: ${_raw(r[11])}`);
        if (_raw(r[12])) noteParts.push(`Prochaine action: ${_raw(r[12])}`);
        if (_raw(r[18])) noteParts.push(_raw(r[18]));

        const remercie = _raw(r[17]).toLowerCase();

        entities.forEach(entity => {
            const donorKey = `ENT__${nom.toUpperCase()}__${entity}__${i}`;
            const parsedAddrEnt = _parseAddress(_raw(r[7]));
            donors.push({
                _key: donorKey,
                last_name: nom.toUpperCase(),
                first_name: null,
                company_name: nom,
                entity,
                email: _firstEmail(r[6]),
                phone: _raw(r[5]) || null,
                address: parsedAddrEnt.address,
                zip_code: parsedAddrEnt.zip_code,
                city: parsedAddrEnt.city,
                origin: 'Suivi entreprises',
                notes: noteParts.join(' | ') || null,
                last_modified_by: 'Import Excel'
            });

            const YEARS = [
                { col: 13, year: 2022 },
                { col: 14, year: 2023 },
                { col: 15, year: 2024 },
                { col: 16, year: 2025 },
            ];
            YEARS.forEach(({ col, year }) => {
                const amount = _evalAmount(r[col]);
                if (amount !== null) {
                    dons.push({
                        _donor_key: donorKey,
                        amount,
                        date: `${year}-01-01`,
                        payment_mode: null,
                        tax_receipt_number: null,
                        fiscal_receipt_id: null,
                        campaign: null,
                        thanked: ['oui','o','yes','1'].includes(remercie),
                        _valid: true
                    });
                }
            });
        });
    });

    return { donors, dons };
}

/**
 * Parse l'onglet "congregations religieuses"
 * Structure : entité/nom(0) lien(1) tel(2) mail(3) adresse(4)
 *             2022(10) 2023(11) 2024(12) 2025(13) remercié(14) notes(15)
 */
function _parseSheetCongregations(rows) {
    const donors = [];
    const dons   = [];

    rows.forEach((r, i) => {
        const nom = _raw(r[0]);
        if (!nom) return;

        // Nettoyer les noms qui ont des sauts de ligne (ex: "moines du Barroux\nartisanat...")
        const nomClean = nom.split('\n')[0].trim().toUpperCase();

        const noteParts = [];
        if (_raw(r[1]))  noteParts.push(`Lien: ${_raw(r[1])}`);
        if (_raw(r[7]))  noteParts.push(`Statut: ${_raw(r[7])}`);
        if (_raw(r[8]))  noteParts.push(`Dernière action: ${_raw(r[8])}`);
        if (_raw(r[9]))  noteParts.push(`Prochaine action: ${_raw(r[9])}`);
        if (_raw(r[15])) noteParts.push(_raw(r[15]));

        const remercie = _raw(r[14]).toLowerCase();
        const donorKey = `CONG__${nomClean}__${i}`;

        const parsedAddrCong = _parseAddress(_raw(r[4]));
        donors.push({
            _key: donorKey,
            last_name: nomClean,
            first_name: null,
            company_name: nom.split('\n')[0].trim(),
            entity: 'Institut Alsatia',
            email: _firstEmail(r[3]),
            phone: _raw(r[2]) || null,
            address: parsedAddrCong.address,
            zip_code: parsedAddrCong.zip_code,
            city: parsedAddrCong.city,
            origin: 'Congrégations religieuses',
            notes: noteParts.join(' | ') || null,
            last_modified_by: 'Import Excel'
        });

        const YEARS = [
            { col: 10, year: 2022 },
            { col: 11, year: 2023 },
            { col: 12, year: 2024 },
            { col: 13, year: 2025 },
        ];
        YEARS.forEach(({ col, year }) => {
            const amount = _evalAmount(r[col]);
            if (amount !== null) {
                dons.push({
                    _donor_key: donorKey,
                    amount,
                    date: `${year}-01-01`,
                    payment_mode: null,
                    tax_receipt_number: null,
                    fiscal_receipt_id: null,
                    campaign: null,
                    thanked: ['oui','o','yes','1'].includes(remercie),
                    _valid: true
                });
            }
        });
    });

    return { donors, dons };
}

// ─── MODALE D'IMPORT ──────────────────────────────────────────────────────────

window.showImportDonorsModal = () => {
    if (currentUser.portal !== 'Institut Alsatia') {
        window.showNotice("Accès refusé", "Cette fonctionnalité est réservée à Institut Alsatia.", "error");
        return;
    }

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="upload" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                IMPORT EXCEL — DONATEURS
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- INFO FORMAT ATTENDU -->
            <div style="background:rgba(197,160,89,0.07); border:1.5px solid var(--gold); border-radius:14px; padding:16px 18px; margin-bottom:20px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <i data-lucide="file-spreadsheet" style="width:20px;height:20px;color:var(--gold);flex-shrink:0;"></i>
                    <span style="font-weight:800; font-size:0.85rem; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px;">Format reconnu automatiquement</span>
                </div>
                <p style="font-size:0.82rem; color:var(--primary); margin:0 0 10px 0; line-height:1.6;">
                    L'import lit <b>tous les onglets</b> de votre fichier et les fusionne automatiquement :
                </p>
                <div style="display:grid; gap:6px; font-size:0.78rem;">
                    <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:white; border-radius:8px; border:1px solid #e2e8f0;">
                        <span style="background:#10b981; color:white; border-radius:4px; padding:2px 7px; font-weight:700; font-size:0.7rem;">TAB 1</span>
                        <span style="font-weight:600;">Suivi donateurs et amis</span>
                        <span style="color:#64748b; margin-left:auto;">Nom, Prénom, contacts, dons 2022→2026</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:white; border-radius:8px; border:1px solid #e2e8f0;">
                        <span style="background:#10b981; color:white; border-radius:4px; padding:2px 7px; font-weight:700; font-size:0.7rem;">TAB 2</span>
                        <span style="font-weight:600;">Donateurs IFI</span>
                        <span style="color:#64748b; margin-left:auto;">Même structure</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:white; border-radius:8px; border:1px solid #e2e8f0;">
                        <span style="background:#3b82f6; color:white; border-radius:4px; padding:2px 7px; font-weight:700; font-size:0.7rem;">TAB 3</span>
                        <span style="font-weight:600;">Suivi entreprises</span>
                        <span style="color:#64748b; margin-left:auto;">Entité = nom entreprise</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:white; border-radius:8px; border:1px solid #e2e8f0;">
                        <span style="background:#8b5cf6; color:white; border-radius:4px; padding:2px 7px; font-weight:700; font-size:0.7rem;">TAB 4</span>
                        <span style="font-weight:600;">Congrégations religieuses</span>
                        <span style="color:#64748b; margin-left:auto;">Entité = nom congrégation</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:white; border-radius:8px; border:1px solid #e2e8f0;">
                        <span style="background:#f59e0b; color:white; border-radius:4px; padding:2px 7px; font-weight:700; font-size:0.7rem;">TAB 5</span>
                        <span style="font-weight:600;">Archives donateurs</span>
                        <span style="color:#64748b; margin-left:auto;">Même structure, importé avec note</span>
                    </div>
                </div>
                <div style="margin-top:10px; padding:8px 12px; background:#fef3c7; border-radius:8px; font-size:0.75rem; color:#92400e;">
                    <b>💡 Dons par année :</b> les colonnes <code>2022 montant donné</code>, <code>2023</code>, <code>2024</code>, <code>2025</code>, <code>2026</code> sont converties en <b>un don individuel par année</b>.<br>
                    Les formules Excel (ex: <code>=300+150</code>) sont calculées automatiquement.
                </div>
            </div>

            <!-- SÉLECTION FICHIER -->
            <p class="mini-label">SÉLECTIONNER LE FICHIER EXCEL (.xlsx / .xls)</p>
            <input type="file" id="import-excel-file" accept=".xlsx,.xls"
                style="width:100%; padding:12px; border:2px dashed var(--gold); border-radius:12px; background:rgba(197,160,89,0.03); color:var(--primary); margin-bottom:20px; cursor:pointer; font-size:0.9rem;">

            <div id="import-preview" style="display:none; margin-bottom:16px;"></div>

            <button onclick="window.previewImportDonors()" class="btn-gold" style="width:100%; height:46px; margin-bottom:10px;">
                <i data-lucide="eye" style="width:16px;height:16px;vertical-align:middle;margin-right:8px;"></i>
                ANALYSER LE FICHIER
            </button>
            <button id="btn-confirm-import" onclick="window.execImportDonors()" class="btn-gold-fill" style="width:100%; height:50px; display:none; font-size:1rem; letter-spacing:1px;">
                <i data-lucide="upload-cloud" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                CONFIRMER L'IMPORT
            </button>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

// ─── PRÉVISUALISATION ─────────────────────────────────────────────────────────

window.previewImportDonors = () => {
    const fileInput = document.getElementById('import-excel-file');
    if (!fileInput || !fileInput.files[0]) {
        window.showNotice("Erreur", "Veuillez sélectionner un fichier Excel.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
            const allDonors = [];
            const allDons   = [];

            // Lire chaque onglet selon son type
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
                // Supprimer la ligne d'en-tête
                const dataRows = rows.slice(1);
                const nameLower = sheetName.toLowerCase();

                let result = { donors: [], dons: [] };

                if (nameLower.includes('entreprise')) {
                    result = _parseSheetEntreprises(dataRows);
                } else if (nameLower.includes('congregation') || nameLower.includes('congrégation')) {
                    result = _parseSheetCongregations(dataRows);
                } else if (nameLower.includes('donat') || nameLower.includes('suivi') || nameLower.includes('archive') || nameLower.includes('ifi')) {
                    const label = nameLower.includes('archive') ? 'Archives' :
                                  nameLower.includes('ifi')     ? 'IFI'      : 'Import Excel';
                    result = _parseSheetPersonnes(dataRows, label);
                }
                // Onglets non reconnus → ignorés silencieusement

                allDonors.push(...result.donors);
                allDons.push(...result.dons);
            });

            // Dédupliquer les donateurs (même nom+entité dans plusieurs onglets)
            const seen = new Set();
            const uniqueDonors = allDonors.filter(d => {
                const key = `${d.last_name}__${d.entity}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            window._importPreviewData = uniqueDonors;
            window._importDonsData    = allDons;

            const totalDons = allDons.filter(d => d._valid).length;
            const sheets    = workbook.SheetNames;

            // Résumé par onglet
            const sheetSummary = workbook.SheetNames.map(n => {
                const nl = n.toLowerCase();
                let parsed;
                if (nl.includes('entreprise'))                          parsed = _parseSheetEntreprises(XLSX.utils.sheet_to_json(workbook.Sheets[n], {header:1,defval:null}).slice(1));
                else if (nl.includes('congregation')||nl.includes('congrégation')) parsed = _parseSheetCongregations(XLSX.utils.sheet_to_json(workbook.Sheets[n], {header:1,defval:null}).slice(1));
                else if (nl.includes('donat')||nl.includes('suivi')||nl.includes('archive')||nl.includes('ifi')) parsed = _parseSheetPersonnes(XLSX.utils.sheet_to_json(workbook.Sheets[n], {header:1,defval:null}).slice(1), n);
                else return null;
                return { name: n, donors: parsed.donors.length, dons: parsed.dons.length };
            }).filter(Boolean);

            // Afficher le résumé
            const previewEl = document.getElementById('import-preview');
            previewEl.style.display = 'block';
            previewEl.innerHTML = `
                <!-- Compteurs globaux -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
                    <div style="background:#f0fdf4; border:1px solid #22c55e; border-radius:10px; padding:14px; text-align:center;">
                        <div style="font-size:2rem; font-weight:900; color:#16a34a;">${uniqueDonors.length}</div>
                        <div style="font-size:0.72rem; color:#16a34a; font-weight:700; text-transform:uppercase;">Contacts à importer</div>
                    </div>
                    <div style="background:#eff6ff; border:1px solid #3b82f6; border-radius:10px; padding:14px; text-align:center;">
                        <div style="font-size:2rem; font-weight:900; color:#1d4ed8;">${totalDons}</div>
                        <div style="font-size:0.72rem; color:#1d4ed8; font-weight:700; text-transform:uppercase;">Dons à importer</div>
                    </div>
                </div>

                <!-- Résumé par onglet -->
                <p style="font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Détail par onglet :</p>
                <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:14px;">
                    ${sheetSummary.map((s, i) => `
                        <div style="display:flex; align-items:center; padding:10px 14px; ${i < sheetSummary.length-1 ? 'border-bottom:1px solid #f1f5f9;' : ''}; background:${i%2===0?'white':'#fafafa'};">
                            <span style="flex:1; font-weight:600; font-size:0.83rem; color:var(--primary);">${s.name}</span>
                            <span style="background:#f0fdf4; color:#16a34a; padding:3px 10px; border-radius:12px; font-size:0.72rem; font-weight:700; margin-right:8px;">${s.donors} contacts</span>
                            <span style="background:#eff6ff; color:#1d4ed8; padding:3px 10px; border-radius:12px; font-size:0.72rem; font-weight:700;">${s.dons} dons</span>
                        </div>`).join('')}
                </div>

                <!-- Aperçu des premiers contacts -->
                <p style="font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Aperçu des contacts :</p>
                <div style="max-height:180px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                        <thead style="background:var(--surface); position:sticky; top:0;">
                            <tr>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:var(--gold);">NOM</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:var(--gold);">PRÉNOM</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:var(--gold);">EMAIL</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:var(--gold);">ENTITÉ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${uniqueDonors.slice(0, 10).map(r => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:6px 8px; font-weight:700; color:var(--primary);">${r.last_name}</td>
                                    <td style="padding:6px 8px;">${r.first_name || '—'}</td>
                                    <td style="padding:6px 8px; color:#64748b; font-size:0.73rem;">${r.email || '—'}</td>
                                    <td style="padding:6px 8px;">
                                        <span style="background:rgba(197,160,89,0.12); color:var(--primary); padding:2px 7px; border-radius:6px; font-size:0.7rem; font-weight:600;">${r.entity}</span>
                                    </td>
                                </tr>`).join('')}
                            ${uniqueDonors.length > 10 ? `<tr><td colspan="4" style="padding:8px; text-align:center; color:#94a3b8; font-style:italic; font-size:0.75rem;">... et ${uniqueDonors.length - 10} autres contacts</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            `;

            if (uniqueDonors.length > 0) {
                const btn = document.getElementById('btn-confirm-import');
                btn.style.display = 'block';
                btn.innerHTML = `<i data-lucide="upload-cloud" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>IMPORTER ${uniqueDonors.length} CONTACTS + ${totalDons} DONS`;
                if(window.lucide) lucide.createIcons();
            }

            if (window.lucide) lucide.createIcons();

        } catch (err) {
            console.error('Erreur lecture Excel:', err);
            window.showNotice("Erreur de lecture", "Impossible de lire le fichier. Vérifiez le format (.xlsx).", "error");
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
};

// ─── EXÉCUTION DE L'IMPORT ────────────────────────────────────────────────────

window.execImportDonors = async () => {
    const toInsert = (window._importPreviewData || []);
    const donsAll  = (window._importDonsData    || []).filter(d => d._valid);

    if (!toInsert.length) {
        window.showNotice("Erreur", "Aucune donnée valide à importer.", "error");
        return;
    }

    const btn = document.getElementById('btn-confirm-import');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width:16px;vertical-align:middle;margin-right:8px;animation:spin 1s linear infinite;"></i>Import en cours...';
        if (window.lucide) lucide.createIcons();
    }

    const BATCH = 100;
    let insertedDonors = 0;
    let insertedDons   = 0;
    let errorsDonors   = 0;
    let errorsDons     = 0;

    // Map _key → donor_id pour rattacher les dons
    const keyToId = {};

    // Insérer les donateurs (sans le champ _key)
    for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH);
        const keys  = batch.map(d => d._key);
        const clean = batch.map(({ _key, ...d }) => d);

        const { data, error } = await supabaseClient
            .from('donors')
            .insert(clean)
            .select('id, last_name, entity');

        if (error) {
            console.error('Erreur import donateurs:', error);
            errorsDonors += batch.length;
        } else {
            insertedDonors += batch.length;
            // Construire le mapping _key → id en utilisant l'ordre d'insertion
            if (data) {
                data.forEach((row, idx) => {
                    keyToId[keys[idx]] = row.id;
                });
            }
        }
    }

    // Insérer les dons en rattachant les donor_id via _key
    if (donsAll.length > 0) {
        const donsWithIds = donsAll
            .filter(d => keyToId[d._donor_key])
            .map(({ _donor_key, _valid, ...d }) => ({
                ...d,
                donor_id: keyToId[_donor_key]
            }));

        for (let i = 0; i < donsWithIds.length; i += BATCH) {
            const batch = donsWithIds.slice(i, i + BATCH);
            const { error } = await supabaseClient.from('donations').insert(batch);
            if (error) {
                console.error('Erreur import dons:', error);
                errorsDons += batch.length;
            } else {
                insertedDons += batch.length;
            }
        }
    }

    window._importPreviewData = [];
    window._importDonsData    = [];
    closeCustomModal();

    if (errorsDonors === 0 && errorsDons === 0) {
        window.showNotice(
            "Import réussi ✅",
            `${insertedDonors} contact${insertedDonors > 1 ? 's' : ''} et ${insertedDons} don${insertedDons > 1 ? 's' : ''} importés avec succès.`,
            "success"
        );
    } else {
        window.showNotice(
            "Import partiel ⚠️",
            `${insertedDonors} contacts, ${insertedDons} dons importés. ${errorsDonors + errorsDons} erreur(s) — consultez la console.`,
            "warning"
        );
    }

    window.loadDonors();
};
// ==========================================
// GESTION DU COMPTE UTILISATEUR
// ==========================================

/**
 * CHARGER LES INFORMATIONS DU COMPTE
 */
window.loadAccountPage = async () => {
    // Charger les infos depuis Supabase
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (error || !profile) {
        window.showNotice("Erreur", "Impossible de charger votre profil.", "error");
        return;
    }
    
    // Remplir les champs non modifiables
    document.getElementById('account-first-name').value = profile.first_name || '';
    document.getElementById('account-last-name').value = profile.last_name || '';
    document.getElementById('account-portal').value = profile.portal || '';
    
    // Remplir les champs modifiables
    document.getElementById('account-email').value = profile.email || '';
    document.getElementById('account-phone').value = profile.phone || '';
    document.getElementById('account-job-title').value = profile.job_title || '';
    
    // Vider les champs PIN
    document.getElementById('account-old-pin').value = '';
    document.getElementById('account-new-pin').value = '';
    document.getElementById('account-confirm-pin').value = '';
    
    if(window.lucide) lucide.createIcons();
};

/**
 * AFFICHER/MASQUER LE PIN (bouton oeil)
 */
window.togglePinVisibility = (inputId, iconElement) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        iconElement.setAttribute('data-lucide', 'eye');
    }
    
    if(window.lucide) lucide.createIcons();
};

/**
 * SAUVEGARDER LES MODIFICATIONS DU COMPTE
 */
window.saveAccountChanges = async () => {
    // Récupérer les valeurs
    const email = document.getElementById('account-email').value.trim();
    const phone = document.getElementById('account-phone').value.trim();
    const jobTitle = document.getElementById('account-job-title').value.trim();
    const oldPin = document.getElementById('account-old-pin').value.trim();
    const newPin = document.getElementById('account-new-pin').value.trim();
    const confirmPin = document.getElementById('account-confirm-pin').value.trim();
    
    // Préparer les données à mettre à jour
    const updates = {
        email: email || null,
        phone: phone || null,
        job_title: jobTitle || null
    };
    
    // Gérer le changement de PIN si demandé
    let pinChanged = false;
    if (oldPin || newPin || confirmPin) {
        // Vérifier que l'ancien PIN est fourni
        if (!oldPin) {
            window.showNotice("Erreur", "Veuillez saisir votre ancien code PIN.", "error");
            return;
        }
        
        // Vérifier que le nouveau PIN est fourni
        if (!newPin) {
            window.showNotice("Erreur", "Veuillez saisir un nouveau code PIN.", "error");
            return;
        }
        
        // Vérifier que la confirmation est fournie
        if (!confirmPin) {
            window.showNotice("Erreur", "Veuillez confirmer votre nouveau code PIN.", "error");
            return;
        }
        
        // Vérifier que l'ancien PIN est correct
        const { data: currentProfile } = await supabaseClient
            .from('profiles')
            .select('pin')
            .eq('id', currentUser.id)
            .single();
        
        if (!currentProfile || currentProfile.pin !== oldPin) {
            window.showNotice("Erreur", "L'ancien code PIN est incorrect.", "error");
            return;
        }
        
        // Vérifier que le nouveau PIN fait 4 chiffres
        if (!/^\d{4}$/.test(newPin)) {
            window.showNotice("Erreur", "Le nouveau code PIN doit contenir exactement 4 chiffres.", "error");
            return;
        }
        
        // Vérifier que les deux nouveaux PIN correspondent
        if (newPin !== confirmPin) {
            window.showNotice("Erreur", "Les deux nouveaux codes PIN ne correspondent pas.", "error");
            return;
        }
        
        // Ajouter le PIN aux updates
        updates.pin = newPin;
        pinChanged = true;
    }
    
    // Mettre à jour dans Supabase
    const { error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);
    
    if (error) {
        window.showNotice("Erreur", "Impossible de sauvegarder les modifications.", "error");
        console.error("Update error:", error);
        return;
    }
    
    // Mettre à jour currentUser en mémoire
    currentUser = { ...currentUser, ...updates };
    localStorage.setItem('alsatia_user', JSON.stringify(currentUser));
    
    // Message de succès
    if (pinChanged) {
        window.showNotice("Succès", "Vos informations et votre code PIN ont été mis à jour.", "success");
    } else {
        window.showNotice("Succès", "Vos informations ont été mises à jour.", "success");
    }
    
    // Recharger la page
    window.loadAccountPage();
};

// ==========================================
// GESTION DES ÉVÉNEMENTS - SYSTÈME COMPLET & RÉSEAUX
// ==========================================

// 1. DASHBOARD : LISTE GLOBALE AVEC INDICATEUR DE STATUT
window.loadChatSubjects = async () => {
    const { data: subjects, error } = await supabaseClient.from('chat_subjects').select('*').order('name');
    if (error) return;

    const container = document.getElementById('chat-subjects-list');
    if (!container) return;

    const myName = `${currentUser.first_name} ${currentUser.last_name}`;
    
    const filtered = subjects.filter(s => {
        // BLOQUER TOUS LES CANAUX PRIVÉS (discussions 1-to-1 désactivées)
        if (s.entity === 'Privé') {
            return false;
        }
        
        // Si c'est Institut Alsatia, voir tout (sauf les privés)
        if (currentUser.portal === 'Institut Alsatia') return true;
        
        // Sinon, filtrer par entité
        return !s.entity || s.entity === currentUser.portal;
    });

    // PROTECTION : Si le canal actif n'est plus accessible (canal privé supprimé), rediriger vers Général
    const isCurrentSubjectAvailable = filtered.some(s => s.name === currentChatSubject);
    if (!isCurrentSubjectAvailable) {
        console.warn(`⚠️ Canal "${currentChatSubject}" inaccessible, redirection vers Général`);
        currentChatSubject = 'Général';
        const titleEl = document.getElementById('chat-current-title');
        if (titleEl) titleEl.innerText = '# Général';
    }

    container.innerHTML = filtered.map(s => {
        const isActive = currentChatSubject === s.name;
        return `
        <div class="chat-subject-item ${isActive ? 'active-chat-tab' : ''}" 
             onclick="window.switchChatSubject('${s.name.replace(/'/g, "\\'")}')">
            <div class="channel-indicator"></div>
            <div class="channel-name">
                <div class="channel-title"># ${s.name}</div>
                ${s.entity ? `<div class="channel-entity">${s.entity}</div>` : ''}
            </div>
            ${(currentUser.portal === 'Institut Alsatia' || s.entity === currentUser.portal) ? 
                `<i data-lucide="trash-2" 
                    onclick="event.stopPropagation(); window.deleteSubject('${s.id}', '${s.name}')"></i>` : ''}
        </div>
    `;
    }).join('');
    lucide.createIcons();
    
    // Mettre à jour le dropdown mobile
    const mobileMenu = document.getElementById('mobile-channel-menu');
    if (mobileMenu) {
        mobileMenu.innerHTML = filtered.map(s => {
            const isActive = currentChatSubject === s.name;
            return `
            <div class="mobile-channel-item ${isActive ? 'active' : ''}" 
                 onclick="window.switchChatSubject('${s.name.replace(/'/g, "\\'")}'); window.closeChannelDropdown();">
                <div class="mobile-channel-item-content">
                    <div class="mobile-channel-name"># ${s.name}</div>
                    ${s.entity ? `<div class="mobile-channel-entity">${s.entity}</div>` : ''}
                </div>
                ${isActive ? '<span class="mobile-channel-check">✓</span>' : ''}
            </div>
            `;
        }).join('');
    }
    
    // Mettre à jour le bouton du dropdown
    const mobileToggle = document.getElementById('mobile-current-channel');
    if (mobileToggle) {
        mobileToggle.innerText = `# ${currentChatSubject}`;
    }
};

window.switchChatSubject = (subjectName) => {
    currentChatSubject = subjectName;
    window._chatRenderedIds = new Set(); // reset déduplication sur changement canal
    window._chatStopPoll();
    const titleEl = document.getElementById('chat-current-title');
    if(titleEl) titleEl.innerText = `# ${subjectName}`;
    window.loadChatSubjects();
    window.loadChatMessages();
    window.subscribeToChat();
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
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    
    // Indicateur de chargement élégant
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:15px;">
            <div style="width:40px; height:40px; border:3px solid rgba(197,160,89,0.2); border-top-color:var(--gold); border-radius:50%; animation:spin 1s linear infinite;"></div>
            <p style="color:var(--text-muted); font-size:0.9rem;">Chargement des messages...</p>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
    
    const { data, error } = await supabaseClient.from('chat_global')
        .select('*').eq('subject', currentChatSubject).order('created_at', { ascending: true });
    
    if (error) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-muted);">
                <i data-lucide="alert-circle" style="width:48px; height:48px; margin-bottom:15px; opacity:0.5;"></i>
                <p>Erreur lors du chargement des messages</p>
            </div>
        `;
        return;
    }
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:15px; opacity:0.6;">
                <i data-lucide="message-circle" style="width:64px; height:64px; color:var(--gold);"></i>
                <p style="color:var(--text-muted); font-size:1rem; font-weight:600;">Aucun message pour le moment</p>
                <p style="color:var(--text-muted); font-size:0.85rem;">Soyez le premier à écrire dans ce canal !</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    // Réinitialiser le Set de déduplication
    window._chatRenderedIds = new Set();
    window._chatMsgCache   = {};          // cache id→msg pour les citations
    data.forEach(m => {
        window._chatRenderedIds.add(m.id);
        window._chatMsgCache[m.id] = m;
    });

    // Organiser en threads (parents + réponses imbriquées)
    const parentMessages = data.filter(msg => !msg.reply_to);
    const replyMap = {};
    data.filter(msg => msg.reply_to).forEach(r => {
        if (!replyMap[r.reply_to]) replyMap[r.reply_to] = [];
        replyMap[r.reply_to].push(r);
    });

    // Construire le HTML via DOM fragments (pas de string.replace fragile)
    container.innerHTML = '';
    parentMessages.forEach(parent => {
        // Wrapper du message parent
        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderSingleMessage(parent, false);
        container.appendChild(wrapper.firstElementChild);

        // Injecter les réponses dans leur conteneur dédié
        const replies = replyMap[parent.id] || [];
        if (replies.length > 0) {
            const repliesContainer = document.getElementById('replies-' + parent.id);
            if (repliesContainer) {
                replies.forEach(r => {
                    const rWrap = document.createElement('div');
                    rWrap.innerHTML = renderSingleMessage(r, true);
                    repliesContainer.appendChild(rWrap.firstElementChild);
                });
            }
        }
    });

    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
};

function renderSingleMessage(msg, isReply = false) {
    const isMe = msg.author_full_name === `${currentUser.first_name} ${currentUser.last_name}`;
    const isMentioned = (msg.content || '').toLowerCase().includes('@' + currentUser.last_name.toLowerCase());
    const date = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const portalIcon = LOGOS[msg.portal] || 'logo_alsatia.png';

    // Encodage HTML strict
    function esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Contenu sécurisé + surlignage des @mentions
    const safeContent = esc(msg.content || '')
        .replace(/@([A-Za-z\u00C0-\u024F]+(?:\s[A-Za-z\u00C0-\u024F]+)?)/g,
            `<span class="mention-badge" style="background:${isMe ? 'rgba(197,160,89,0.3)' : 'rgba(197,160,89,0.15)'}; color:${isMe ? '#fbbf24' : 'var(--gold)'}; padding:2px 6px; border-radius:4px; font-weight:800;">@$1</span>`);

    // Aperçu sécurisé pour le bouton Répondre (data-attributs, pas onclick inline)
    const replyPreview = esc((msg.content || '').substring(0, 60));
    const replyAuthor  = esc(msg.author_full_name || '');

    // Pièce jointe
    let fileHtml = '';
    if (msg.file_url) {
        const fileName = msg.file_url.split('/').pop();
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
        const isPDF   = /\.pdf$/i.test(fileName);
        const sep     = isMe ? 'rgba(255,255,255,0.2)' : 'var(--border)';
        if (isImage) {
            fileHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid ${sep};">
                <a href="${msg.file_url}" target="_blank">
                    <img src="${msg.file_url}" style="max-width:100%;max-height:280px;border-radius:12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                </a></div>`;
        } else {
            const shortName = fileName.length > 30 ? fileName.substring(0,30)+'…' : fileName;
            const lc = isMe ? '#fbbf24' : 'var(--gold)';
            const bg = isMe ? 'rgba(255,255,255,0.1)' : 'rgba(197,160,89,0.1)';
            const bgH = isMe ? 'rgba(255,255,255,0.18)' : 'rgba(197,160,89,0.18)';
            fileHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid ${sep};">
                <a href="${msg.file_url}" target="_blank"
                   style="color:${lc};text-decoration:none;font-size:0.85rem;font-weight:600;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;background:${bg};border-radius:8px;transition:all 0.2s;"
                   onmouseover="this.style.background='${bgH}'" onmouseout="this.style.background='${bg}'">
                    <i data-lucide="${isPDF ? 'file-text' : 'paperclip'}" style="width:16px;height:16px;"></i>
                    ${shortName}
                </a></div>`;
        }
    }

    // Bouton Répondre + conteneur des réponses (parents seulement)
    const replyZone = !isReply ? `
        <div style="display:flex;gap:4px;margin-top:6px;${isMe ? 'justify-content:flex-end;' : ''}">
            <button class="btn-reply"
                    data-msg-id="${msg.id}"
                    data-author="${replyAuthor}"
                    data-preview="${replyPreview}"
                    onclick="window.replyToMessage(this.dataset.msgId, this.dataset.author, this.dataset.preview)">
                ↩ Répondre
            </button>
        </div>
        <div id="replies-${msg.id}" class="replies-thread"></div>` : '';

    // Bloc citation WhatsApp (affiché uniquement pour les réponses)
    let quoteHtml = '';
    if (isReply && msg.reply_to) {
        const parent = (window._chatMsgCache || {})[msg.reply_to];
        if (parent) {
            const qAuthor  = esc(parent.author_full_name || '');
            const qContent = esc((parent.content || '').substring(0, 80)) + ((parent.content || '').length > 80 ? '…' : '');
            const quoteBg   = isMe ? 'rgba(255,255,255,0.12)' : 'rgba(197,160,89,0.08)';
            const quoteBar  = isMe ? 'rgba(255,255,255,0.7)'  : 'var(--gold)';
            const quoteAuthorColor = isMe ? '#fbbf24' : 'var(--gold)';
            const quoteTextColor   = isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)';
            quoteHtml = `
                <div style="
                    background:${quoteBg};
                    border-left:3px solid ${quoteBar};
                    border-radius:6px;
                    padding:6px 10px;
                    margin-bottom:8px;
                    cursor:pointer;
                " onclick="(function(){const el=document.getElementById('msg-${parent.id}');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid var(--gold)';setTimeout(()=>el.style.outline='none',1500);}})()">
                    <div style="font-size:0.72rem;font-weight:800;color:${quoteAuthorColor};margin-bottom:2px;letter-spacing:0.3px;">
                        ${qAuthor}
                    </div>
                    <div style="font-size:0.8rem;color:${quoteTextColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;">
                        ${qContent || '📎 Pièce jointe'}
                    </div>
                </div>`;
        }
    }

    // Styles bulle
    const bubbleBg     = isMe ? 'linear-gradient(135deg,var(--primary) 0%,#1e293b 100%)' : isMentioned ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : 'white';
    const bubbleColor  = isMe ? 'white' : 'var(--text-main)';
    const bubbleBorder = (isMentioned && !isMe) ? '2px solid var(--gold)' : 'none';
    const shadow       = `0 ${isReply ? '1px 6px' : '2px 12px'} rgba(0,0,0,${isMe ? '0.15' : '0.08'})`;
    const pad          = isReply ? '10px 14px' : '14px 18px';
    const fz           = isReply ? '0.9rem' : '1rem';
    const ml           = isMe ? 'margin-left:auto;' : '';
    const br           = isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px';

    return `
        <div class="message-wrapper ${isMe ? 'my-wrapper' : ''}" data-msg-id="${msg.id}" style="margin-bottom:${isReply ? '8px' : '20px'};width:100%;">
            <div style="${isMe ? 'text-align:right;' : ''}flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;${isMe ? 'justify-content:flex-end;' : ''}">
                    <img src="${portalIcon}" style="width:${isReply ? '16px' : '20px'};height:${isReply ? '16px' : '20px'};object-fit:contain;">
                    <span style="font-weight:700;font-size:${isReply ? '0.8rem' : '0.9rem'};color:var(--text-main);">${esc(msg.author_full_name)}</span>
                    <span style="font-size:0.7rem;color:var(--text-muted);">${date}</span>
                    ${isMe ? `<i data-lucide="trash-2" onclick="window.deleteMessage('${msg.id}')" style="width:14px;height:14px;color:var(--danger);cursor:pointer;opacity:0.7;transition:all 0.2s;" onmouseover="this.style.opacity='1';this.style.transform='scale(1.2)';" onmouseout="this.style.opacity='0.7';this.style.transform='scale(1)';"></i>` : ''}
                </div>
                <div class="message ${isMe ? 'my-msg' : ''} ${isMentioned ? 'mentioned-luxe' : ''}" id="msg-${msg.id}"
                     style="position:relative;padding:${pad};border-radius:${br};background:${bubbleBg};color:${bubbleColor};box-shadow:${shadow};border:${bubbleBorder};line-height:1.6;word-wrap:break-word;display:inline-block;max-width:100%;font-size:${fz};${ml}">
                    ${quoteHtml}
                    ${safeContent}
                    ${fileHtml}
                </div>
                ${replyZone}
            </div>
        </div>`;
}

// appendSingleMessageSafe : utilisé à la fois par l'envoi optimiste et par le realtime
function appendSingleMessageSafe(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    // Déduplication stricte
    if (document.getElementById('msg-' + msg.id)) return;

    // Alimenter le cache pour les citations
    if (!window._chatMsgCache) window._chatMsgCache = {};
    window._chatMsgCache[msg.id] = msg;

    const isMe = (msg.author_full_name === (currentUser.first_name + ' ' + currentUser.last_name));

    // Réponse à un message parent existant
    if (msg.reply_to) {
        const repliesContainer = document.getElementById('replies-' + msg.reply_to);
        if (repliesContainer) {
            const tmp = document.createElement('div');
            tmp.innerHTML = renderSingleMessage(msg, true);
            const el = tmp.firstElementChild;
            if (!el) return;
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            repliesContainer.appendChild(el);
            setTimeout(() => {
                el.style.transition = 'all 0.35s cubic-bezier(0.4,0,0.2,1)';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 30);
            if (window.lucide) lucide.createIcons();
            container.scrollTop = container.scrollHeight;
            return;
        }
    }

    // Message principal
    const tmp = document.createElement('div');
    tmp.innerHTML = renderSingleMessage(msg, false);
    const el = tmp.firstElementChild;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    setTimeout(() => {
        el.style.transition = 'all 0.4s cubic-bezier(0.4,0,0.2,1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    }, 30);
    if (window.lucide) lucide.createIcons();

    // Son discret pour les messages entrants (contexte audio partagé)
    if (!isMe) {
        try {
            if (!window._chatAudioCtx || window._chatAudioCtx.state === 'closed') {
                window._chatAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = window._chatAudioCtx;
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine'; osc.frequency.value = 880;
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
        } catch(e) {}
    }
}

// Alias rétrocompat
function appendSingleMessage(msg) { appendSingleMessageSafe(msg); }


/**
 * 4. MENTIONS & ENVOI
 */
window.handleChatKeyUp = async (e) => {
    const input = e.target;
    const box = document.getElementById('mention-box');
    if (!box) return;

    // Escape : fermer les suggestions
    if (e.key === 'Escape') { box.style.display = 'none'; return; }

    // Enter : envoyer seulement si les suggestions ne sont pas visibles
    if (e.key === 'Enter') {
        if (box.style.display === 'block') { box.style.display = 'none'; return; }
        window.sendChatMessage();
        return;
    }

    // Détecter la dernière occurrence de @ pour les mentions
    const atIdx = input.value.lastIndexOf('@');
    if (atIdx !== -1) {
        const query = input.value.slice(atIdx + 1).toLowerCase();
        // Charger les utilisateurs si nécessaire
        if (!allUsersForMentions || allUsersForMentions.length === 0) {
            const { data: users } = await supabaseClient.from('profiles').select('first_name, last_name');
            allUsersForMentions = (users || []).map(u => ({ name: `${u.first_name} ${u.last_name}` }));
        }
        const entities = ['Institut Alsatia', 'Academia Alsatia', 'Cours Herrade de Landsberg', 'Collège Saints Louis et Zélie Martin'];
        const allSuggestions = [...entities, ...allUsersForMentions.map(u => u.name)];
        const filtered = allSuggestions.filter(s => s.toLowerCase().includes(query)).slice(0, 8);

        if (filtered.length > 0) {
            box.innerHTML = filtered.map(s => {
                const isEntity = entities.includes(s);
                return `<div class="suggest-item"
                     onclick="window.insertMention('${s.replace(/'/g, "\'")}')"
                     style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;"
                     onmouseover="this.style.background='#fdfaf3'" onmouseout="this.style.background='white'">
                    <div style="width:7px;height:7px;border-radius:50%;background:${isEntity ? 'var(--gold)' : '#64748b'};flex-shrink:0;"></div>
                    <div>
                        <div style="font-weight:700;color:var(--text-main);font-size:0.88rem;">@${s}</div>
                        ${isEntity ? '<div style="font-size:0.68rem;color:var(--text-muted);">Entité</div>' : ''}
                    </div>
                </div>`;
            }).join('');
            box.style.display = 'block';
        } else {
            box.style.display = 'none';
        }
    } else {
        box.style.display = 'none';
    }
};

window.insertMention = (name) => {
    const input = document.getElementById('chat-input');
    const parts = input.value.split('@');
    parts.pop();
    input.value = parts.join('@') + '@' + name + ' ';
    document.getElementById('mention-box').style.display = 'none';
    input.focus();
};

// Variable globale pour stocker le message auquel on répond
let replyingTo = null;

window.replyToMessage = (messageId, authorName, messagePreview) => {
    replyingTo = { id: messageId, author: authorName, preview: messagePreview };

    const replyBar  = document.getElementById('reply-bar');
    const authorEl  = document.getElementById('reply-author');
    const previewEl = document.getElementById('reply-preview');

    if (authorEl)  authorEl.textContent  = authorName;
    if (previewEl) previewEl.textContent = messagePreview || '📎 Pièce jointe';

    if (replyBar) {
        replyBar.style.display = 'flex';
        // Animation d'apparition
        replyBar.style.opacity = '0';
        replyBar.style.transform = 'translateY(6px)';
        setTimeout(() => {
            replyBar.style.transition = 'all 0.2s ease';
            replyBar.style.opacity = '1';
            replyBar.style.transform = 'translateY(0)';
        }, 10);
    }

    const input = document.getElementById('chat-input');
    if (input) input.focus();
};

window.cancelReply = () => {
    replyingTo = null;
    const replyBar = document.getElementById('reply-bar');
    if (replyBar) {
        replyBar.style.display = 'none';
    }
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

    // Préparer les données du message
    const messageData = {
        content: content,
        author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        author_last_name: currentUser.last_name,
        portal: currentUser.portal,
        subject: currentChatSubject,
        file_url: fileUrl
    };

    // Ajouter reply_to seulement si on répond à un message
    // (La colonne reply_to doit exister dans Supabase)
    if (replyingTo) {
        messageData.reply_to = replyingTo.id;
    }

    const { data, error } = await supabaseClient.from('chat_global').insert([messageData]).select().single();

    if (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        window.showNotice('Erreur', 'Impossible d\'envoyer le message. Vérifiez que la colonne reply_to existe dans Supabase.', 'error');
        return;
    }

    // Affichage optimiste : on enregistre l'ID AVANT d'ajouter pour que le realtime le déduplique
    if (data) {
        window._chatRenderedIds.add(data.id);
        appendSingleMessageSafe(data);
    }

    input.value = '';
    window.clearChatFile();
    window.cancelReply();
};

window.deleteMessage = (id) => {
    window.alsatiaConfirm("SUPPRIMER", "Voulez-vous supprimer ce message ?", async () => {
        // Supprimer visuellement IMMÉDIATEMENT
        const msgWrapper = document.querySelector(`[data-msg-id="${id}"]`);
        if (msgWrapper) {
            msgWrapper.style.transition = 'all 0.3s ease';
            msgWrapper.style.opacity = '0';
            msgWrapper.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                msgWrapper.remove();
            }, 300);
        }
        
        // Supprimer dans la base de données
        const { error } = await supabaseClient.from('chat_global').delete().eq('id', id);
        
        if (error) {
            console.error('Erreur suppression:', error);
            window.showNotice("Erreur", "Impossible de supprimer le message.", "error");
            // Recharger les messages en cas d'erreur
            window.loadChatMessages();
        } else {
            window.showNotice("Effacé", "Message supprimé.");
        }
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
// =====================================================
// ÉVÉNEMENTS - VERSION REFONTE COMPLÈTE
// =====================================================

/**
 * CHARGEMENT ET AFFICHAGE DES ÉVÉNEMENTS
 * Groupés par mois avec compte à rebours
 */
async function loadEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:40px;"><div class="spinner"></div><p>Chargement...</p></div>';
    
    const { data: events, error } = await supabaseClient
        .from('events_v2')
        .select('*')
        .order('event_date', { ascending: true });
    
    if (error) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Erreur de chargement</div>';
        return;
    }
    
    if (!events || events.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px;">
                <i data-lucide="calendar-x" style="width:64px; height:64px; color:var(--text-muted); margin-bottom:20px;"></i>
                <p style="color:var(--text-muted); font-size:1.1rem;">Aucun événement planifié</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    // Grouper les événements par mois
    const now = new Date();
    const groupedEvents = {
        upcoming: {},
        past: []
    };
    
    events.forEach(ev => {
        const eventDate = new Date(ev.event_date);
        const isPast = eventDate < now;
        
        if (isPast) {
            groupedEvents.past.push(ev);
        } else {
            const monthKey = eventDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
            if (!groupedEvents.upcoming[monthKey]) {
                groupedEvents.upcoming[monthKey] = [];
            }
            groupedEvents.upcoming[monthKey].push(ev);
        }
    });
    
    let html = '';
    
    // Événements à venir (groupés par mois)
    Object.keys(groupedEvents.upcoming).forEach(monthKey => {
        html += `
            <div class="month-separator">
                <i data-lucide="calendar" style="width:20px; height:20px;"></i>
                ${monthKey.toUpperCase()}
            </div>
        `;
        
        groupedEvents.upcoming[monthKey].forEach(ev => {
            html += renderEventCard(ev, false);
        });
    });
    
    // Événements passés
    if (groupedEvents.past.length > 0) {
        html += `
            <div class="month-separator" style="margin-top:40px;">
                <i data-lucide="archive" style="width:20px; height:20px;"></i>
                ÉVÉNEMENTS PASSÉS
            </div>
        `;
        
        groupedEvents.past.forEach(ev => {
            html += renderEventCard(ev, true);
        });
    }
    
    container.innerHTML = html;
    lucide.createIcons();
}

/**
 * RENDER UNE CARTE D'ÉVÉNEMENT
 */
function renderEventCard(ev, isPast) {
    const eventDate = new Date(ev.event_date);
    const now = new Date();
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Texte compte à rebours
    let countdownText = '';
    if (isPast) {
        const daysSince = Math.abs(diffDays);
        countdownText = daysSince === 0 ? "Aujourd'hui" : `Il y a ${daysSince} jour${daysSince > 1 ? 's' : ''}`;
    } else {
        countdownText = diffDays === 0 ? "Aujourd'hui" : 
                       diffDays === 1 ? "Demain" : 
                       `Dans ${diffDays} jours`;
    }
    
    // Couleur du badge statut
    const statusColors = {
        'draft': { bg: '#fef3c7', color: '#92400e', icon: '⏳', text: 'EN PRÉPARATION' },
        'ready': { bg: '#d1fae5', color: '#065f46', icon: '✅', text: 'PRÊT' },
        'published': { bg: '#dbeafe', color: '#1e40af', icon: '📱', text: 'PUBLIÉ' }
    };
    
    const statusStyle = statusColors[ev.status] || statusColors.draft;
    
    // Couleur de la bordure
    const borderColor = isPast ? '#e5e7eb' : 
                       ev.status === 'ready' ? '#10b981' : 
                       ev.status === 'published' ? '#3b82f6' : '#f59e0b';
    
    return `
        <div class="event-card" onclick="window.openEventDetails('${ev.id}')" style="
            border-left: 4px solid ${borderColor};
            opacity: ${isPast ? '0.7' : '1'};
        ">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                <h3 style="margin:0; font-size:1.1rem; color:var(--text-main);">${escapeHTML(ev.title)}</h3>
                <span style="
                    background:${statusStyle.bg}; 
                    color:${statusStyle.color}; 
                    padding:4px 12px; 
                    border-radius:20px; 
                    font-size:0.75rem; 
                    font-weight:700;
                    white-space:nowrap;
                ">
                    ${statusStyle.icon} ${statusStyle.text}
                </span>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:8px; color:var(--text-muted); font-size:0.9rem;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="calendar" style="width:16px; height:16px;"></i>
                    ${eventDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    <span style="color:${isPast ? '#ef4444' : '#10b981'}; font-weight:600;">• ${countdownText}</span>
                </div>
                
                ${ev.location ? `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i data-lucide="map-pin" style="width:16px; height:16px;"></i>
                        ${escapeHTML(ev.location)}
                    </div>
                ` : ''}
                
                <div style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="building" style="width:16px; height:16px;"></i>
                    ${escapeHTML(ev.entity)}
                </div>
            </div>
        </div>
    `;
}

/**
 * MODAL : CRÉER UN NOUVEL ÉVÉNEMENT
 */
window.showAddEventModal = () => {
    const isInstitut = currentUser.portal === 'Institut Alsatia';
    
    showCustomModal(`
        <h3 class="luxe-title">PLANIFIER UN ÉVÉNEMENT</h3>
        
        <div style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">
            <div>
                <label class="mini-label">TITRE DE L'ÉVÉNEMENT</label>
                <input type="text" id="new-event-title" class="luxe-input" placeholder="Gala de Charité 2026">
            </div>
            
            <div>
                <label class="mini-label">ENTITÉ CONCERNÉE</label>
                <select id="new-event-entity" class="luxe-input">
                    <option value="Institut Alsatia" ${!isInstitut ? 'disabled' : ''}>Institut Alsatia</option>
                    <option value="Academia Alsatia">Academia Alsatia</option>
                    <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
                    <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
                </select>
            </div>
            
            <div>
                <label class="mini-label">DATE PRÉVUE</label>
                <input type="date" id="new-event-date" class="luxe-input">
            </div>
            
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="window.closeCustomModal()" class="btn-outline" style="flex:1;">Annuler</button>
                <button onclick="window.createEvent()" class="btn-gold" style="flex:1;">Créer</button>
            </div>
        </div>
    `);
};

/**
 * CRÉER UN ÉVÉNEMENT
 */
window.createEvent = async () => {
    const title = document.getElementById('new-event-title')?.value?.trim();
    const entity = document.getElementById('new-event-entity')?.value;
    const date = document.getElementById('new-event-date')?.value;
    
    if (!title || !entity || !date) {
        window.showNotice("Erreur", "Tous les champs sont requis.", "error");
        return;
    }
    
    const { data, error } = await supabaseClient
        .from('events_v2')
        .insert([{
            title: title,
            entity: entity,
            event_date: date,
            status: 'draft',
            created_by: `${currentUser.first_name} ${currentUser.last_name}`
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Erreur création:', error);
        window.showNotice("Erreur", "Impossible de créer l'événement.", "error");
        return;
    }
    
    window.showNotice("Créé !", "Événement créé avec succès.", "success");
    window.closeCustomModal();
    loadEvents();
    
    // Ouvrir directement la fiche
    setTimeout(() => window.openEventDetails(data.id), 300);
};

/**
 * OUVRIR LA FICHE DÉTAILLÉE D'UN ÉVÉNEMENT
 */
window.openEventDetails = async (eventId) => {
    // Charger l'événement
    const { data: ev, error } = await supabaseClient
        .from('events_v2')
        .select('*')
        .eq('id', eventId)
        .single();
    
    if (error || !ev) {
        window.showNotice("Erreur", "Événement introuvable.", "error");
        return;
    }
    
    // Charger les messages du chat
    const { data: messages } = await supabaseClient
        .from('event_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
    
    const isReady = ev.status === 'ready' || ev.status === 'published';
    const statusBg = ev.status === 'ready' || ev.status === 'published' ? '#d1fae5' : '#fef3c7';
    const statusColor = ev.status === 'ready' || ev.status === 'published' ? '#065f46' : '#92400e';
    const statusText = ev.status === 'ready' || ev.status === 'published' ? '✅ PRÊT POUR PUBLICATION' : '⏳ EN PRÉPARATION';
    
    showCustomModal(`
        <div style="max-height:80vh; overflow-y:auto; padding:10px;">
            <!-- En-tête -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; position:sticky; top:0; background:white; padding-bottom:10px; z-index:10;">
                <h2 class="luxe-title" style="margin:0;">${escapeHTML(ev.title)}</h2>
                <button onclick="window.closeCustomModal()" style="border:none; background:none; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            
            <!-- Badge statut -->
            <div style="background:${statusBg}; color:${statusColor}; padding:12px 20px; border-radius:12px; text-align:center; font-weight:700; margin-bottom:20px;">
                ${statusText}
            </div>
            
            <!-- Description -->
            <div class="luxe-section">
                <label class="mini-label">DESCRIPTION</label>
                <textarea id="ev-description" class="luxe-input" rows="4" placeholder="Décrivez l'événement...">${escapeHTML(ev.description || '')}</textarea>
            </div>
            
            <!-- Informations pratiques -->
            <div class="luxe-section">
                <h4 style="margin:0 0 15px 0; color:var(--gold);">📅 INFORMATIONS PRATIQUES</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div>
                        <label class="mini-label">DATE</label>
                        <input type="date" id="ev-date" class="luxe-input" value="${ev.event_date || ''}">
                    </div>
                    <div>
                        <label class="mini-label">HEURE</label>
                        <input type="time" id="ev-time" class="luxe-input" value="${ev.event_time || ''}">
                    </div>
                </div>
                <div style="margin-top:15px;">
                    <label class="mini-label">LIEU</label>
                    <input type="text" id="ev-location" class="luxe-input" placeholder="Salle des fêtes" value="${escapeHTML(ev.location || '')}">
                </div>
                <button onclick="window.saveEventInfos('${eventId}')" class="btn-gold" style="width:100%; margin-top:15px;">
                    <i data-lucide="save"></i> ENREGISTRER LES INFORMATIONS
                </button>
            </div>
            
            <!-- Photos -->
            <div class="luxe-section">
                <h4 style="margin:0 0 15px 0; color:var(--gold);">📸 PHOTOS</h4>
                <input type="file" id="photo-input-${eventId}" accept="image/*" multiple style="display:none;" onchange="window.uploadPhotos('${eventId}')">
                <button onclick="document.getElementById('photo-input-${eventId}').click()" class="btn-outline" style="width:100%; margin-bottom:15px;">
                    <i data-lucide="upload"></i> AJOUTER DES PHOTOS
                </button>
                <div id="photos-grid-${eventId}" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px;">
                    ${(ev.photos || []).map(url => `
                        <div style="position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; border:2px solid var(--border);">
                            <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                            <div style="position:absolute; top:5px; right:5px; display:flex; gap:4px;">
                                <button onclick="window.downloadSinglePhoto('${url}')" style="background:rgba(197,160,89,0.9); border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; color:white; display:flex; align-items:center; justify-content:center; font-size:16px;" title="Télécharger">⬇️</button>
                                <button onclick="window.deletePhoto('${eventId}', '${url}')" style="background:rgba(239,68,68,0.9); border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; color:white; font-weight:bold;" title="Supprimer">×</button>
                            </div>
                        </div>
                    `).join('') || '<p style="text-align:center; color:var(--text-muted); padding:20px;">Aucune photo</p>'}
                </div>
            </div>
            
            <!-- Texte réseaux sociaux -->
            <div class="luxe-section" style="background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding:20px; border-radius:12px;">
                <h4 style="margin:0 0 15px 0; color:#92400e;">📱 TEXTE POUR LES RÉSEAUX SOCIAUX</h4>
                <textarea id="ev-social-text" class="luxe-input" rows="6" placeholder="Rédigez le post pour Instagram, Facebook, LinkedIn...">${escapeHTML(ev.social_media_text || '')}</textarea>
                <button onclick="window.saveSocialText('${eventId}')" class="btn-gold" style="width:100%; margin-top:10px;">
                    <i data-lucide="save"></i> ${ev.social_media_text ? 'METTRE À JOUR' : 'ENREGISTRER'} LE TEXTE
                </button>
                ${ev.social_media_text ? `<button onclick="window.deleteSocialText('${eventId}')" class="btn-outline" style="width:100%; margin-top:10px; color:#ef4444; border-color:#ef4444;">SUPPRIMER</button>` : ''}
            </div>
            
            <!-- Chat privé -->
            <div class="luxe-section">
                <h4 style="margin:0 0 15px 0; color:var(--gold);">💬 DISCUSSION INTERNE</h4>
                <div id="event-chat-${eventId}" style="background:white; border-radius:8px; padding:15px; max-height:300px; overflow-y:auto; margin-bottom:10px; border:2px solid var(--border);">
                    ${renderEventMessages(messages || [])}
                </div>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="event-msg-input-${eventId}" class="luxe-input" placeholder="Écrire un message..." style="flex:1;" onkeypress="if(event.key==='Enter') window.sendEventMessage('${eventId}')">
                    <button onclick="window.sendEventMessage('${eventId}')" class="btn-gold">
                        <i data-lucide="send"></i>
                    </button>
                </div>
            </div>
            
            <!-- Actions si prêt -->
            ${isReady ? `
                <div class="luxe-section" style="background:#d1fae5; padding:20px; border-radius:12px;">
                    <h4 style="margin:0 0 15px 0; color:#065f46;">✅ ACTIONS DISPONIBLES</h4>
                    <div style="display:flex; gap:10px;">
                        <button onclick="window.downloadAllPhotos('${eventId}')" class="btn-gold" style="flex:1;">
                            <i data-lucide="download"></i> TÉLÉCHARGER LES PHOTOS
                        </button>
                        <button onclick="window.copySocialText('${eventId}')" class="btn-gold" style="flex:1;">
                            <i data-lucide="copy"></i> COPIER LE TEXTE
                        </button>
                    </div>
                </div>
            ` : ''}
            
            <!-- Bouton statut -->
            <button onclick="window.toggleEventStatus('${eventId}', '${ev.status}')" class="btn-gold" style="width:100%; margin-top:15px; ${isReady ? 'background:#f59e0b;' : ''}">
                ${isReady ? '⏳ REPASSER EN PRÉPARATION' : '✅ MARQUER COMME PRÊT'}
            </button>
            
            <!-- Bouton supprimer -->
            <button onclick="window.deleteEvent('${eventId}')" class="btn-outline" style="width:100%; margin-top:10px; color:#ef4444; border-color:#ef4444;">
                <i data-lucide="trash-2"></i> SUPPRIMER L'ÉVÉNEMENT
            </button>
        </div>
    `);
    
    lucide.createIcons();
    
    // Scroll vers le bas du chat
    const chatContainer = document.getElementById(`event-chat-${eventId}`);
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // S'abonner au realtime pour les messages
    window.subscribeToEventChat(eventId);
};

/**
 * RENDER MESSAGES DU CHAT
 */
function renderEventMessages(messages) {
    if (!messages || messages.length === 0) {
        return '<p style="text-align:center; color:var(--text-muted); padding:20px;">Aucun message</p>';
    }
    
    return messages.map(m => `
        <div style="margin-bottom:15px; padding:10px; background:var(--bg); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong style="color:var(--gold);">${escapeHTML(m.author_name)}</strong>
                <span style="color:var(--text-muted); font-size:0.85rem;">${new Date(m.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
            </div>
            <p style="margin:0; color:var(--text-main);">${escapeHTML(m.message)}</p>
        </div>
    `).join('');
}

/**
 * SAUVEGARDER LES INFORMATIONS
 */
window.saveEventInfos = async (eventId) => {
    const description = document.getElementById('ev-description')?.value?.trim() || null;
    const date = document.getElementById('ev-date')?.value || null;
    const time = document.getElementById('ev-time')?.value || null;
    const location = document.getElementById('ev-location')?.value?.trim() || null;
    
    console.log('💾 Sauvegarde:', { eventId, description, date, time, location });
    
    const { error } = await supabaseClient
        .from('events_v2')
        .update({
            description,
            event_date: date,
            event_time: time,
            location
        })
        .eq('id', eventId);
    
    if (error) {
        console.error('❌ Erreur:', error);
        window.showNotice("Erreur", "Impossible de sauvegarder.", "error");
        return;
    }
    
    console.log('✅ Sauvegardé');
    window.showNotice("Enregistré !", "Informations mises à jour.", "success");
    loadEvents();
};

/**
 * UPLOADER DES PHOTOS
 */
window.uploadPhotos = async (eventId) => {
    const input = document.getElementById(`photo-input-${eventId}`);
    const files = input.files;
    
    if (!files || files.length === 0) return;
    
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    let uploaded = 0;
    let failed = 0;

    // Indicateur de chargement
    const uploadBtn = input.closest('div')?.querySelector('.btn-outline') || document.querySelector(`[onclick*="uploadPhotos('${eventId}')"]`);
    const originalBtnHTML = uploadBtn ? uploadBtn.innerHTML : null;
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = `
            <span style="display:inline-flex;align-items:center;gap:8px;">
                <span style="width:16px;height:16px;border:2px solid rgba(197,160,89,0.3);border-top-color:var(--gold);border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;"></span>
                Chargement en cours...
            </span>`;
    }

    // Toast de progression
    window.showNotice('Upload', `Envoi de ${files.length} photo(s)...`, 'info');
    
    for (const file of files) {
        if (file.size > MAX_SIZE) {
            console.warn('Fichier trop lourd:', file.name);
            failed++;
            continue;
        }
        
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = `${eventId}/${fileName}`;
        
        const { data, error } = await supabaseClient.storage
            .from('event-files')
            .upload(filePath, file);
        
        if (error) {
            console.error('Erreur upload:', error);
            failed++;
            continue;
        }
        
        // Récupérer l'URL publique
        const { data: urlData } = supabaseClient.storage
            .from('event-files')
            .getPublicUrl(filePath);
        
        // Ajouter l'URL au tableau photos
        const { data: ev } = await supabaseClient
            .from('events_v2')
            .select('photos')
            .eq('id', eventId)
            .single();
        
        const photos = ev.photos || [];
        photos.push(urlData.publicUrl);
        
        await supabaseClient
            .from('events_v2')
            .update({ photos })
            .eq('id', eventId);
        
        uploaded++;
    }
    
    // Restaurer le bouton
    if (uploadBtn && originalBtnHTML) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalBtnHTML;
    }
    // Réinitialiser l'input fichier
    input.value = '';

    if (uploaded > 0) {
        window.showNotice("Uploadé !", `${uploaded} photo(s) ajoutée(s).`, "success");
        window.openEventDetails(eventId); // Recharger la fiche
    }
    
    if (failed > 0) {
        window.showNotice("Attention", `${failed} fichier(s) non uploadé(s).`, "error");
    }
};

/**
 * SUPPRIMER UNE PHOTO
 */
/**
 * TÉLÉCHARGER UNE PHOTO
 */
window.downloadSinglePhoto = async (photoUrl) => {
    try {
        // Récupérer l'image
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        
        // Extraire le nom du fichier depuis l'URL
        const urlParts = photoUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        window.showNotice("Téléchargée", "Photo téléchargée avec succès.", "success");
    } catch (error) {
        console.error('Erreur téléchargement:', error);
        window.showNotice("Erreur", "Impossible de télécharger la photo.", "error");
    }
};

window.deletePhoto = async (eventId, photoUrl) => {
    window.alsatiaConfirm(
        "SUPPRIMER LA PHOTO",
        "Voulez-vous vraiment supprimer cette photo ?",
        async () => {
            // Récupérer le chemin du fichier depuis l'URL
            const urlParts = photoUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `${eventId}/${fileName}`;
            
            // Supprimer du storage
            await supabaseClient.storage
                .from('event-files')
                .remove([filePath]);
            
            // Retirer l'URL du tableau
            const { data: ev } = await supabaseClient
                .from('events_v2')
                .select('photos')
                .eq('id', eventId)
                .single();
            
            const photos = (ev.photos || []).filter(url => url !== photoUrl);
            
            await supabaseClient
                .from('events_v2')
                .update({ photos })
                .eq('id', eventId);
            
            window.showNotice("Supprimée", "Photo supprimée.", "success");
            window.openEventDetails(eventId);
        },
        true
    );
};

/**
 * SAUVEGARDER TEXTE RÉSEAUX SOCIAUX
 */
window.saveSocialText = async (eventId) => {
    const text = document.getElementById('ev-social-text')?.value?.trim() || null;
    
    const { error } = await supabaseClient
        .from('events_v2')
        .update({ social_media_text: text })
        .eq('id', eventId);
    
    if (error) {
        window.showNotice("Erreur", "Impossible de sauvegarder.", "error");
        return;
    }
    
    window.showNotice("Enregistré !", "Texte sauvegardé.", "success");
    window.openEventDetails(eventId);
};

/**
 * SUPPRIMER TEXTE RÉSEAUX SOCIAUX
 */
window.deleteSocialText = async (eventId) => {
    window.alsatiaConfirm(
        "SUPPRIMER LE TEXTE",
        "Voulez-vous vraiment supprimer le texte ?",
        async () => {
            await supabaseClient
                .from('events_v2')
                .update({ social_media_text: null })
                .eq('id', eventId);
            
            window.showNotice("Supprimé", "Texte supprimé.", "success");
            window.openEventDetails(eventId);
        },
        true
    );
};

/**
 * ENVOYER UN MESSAGE DANS LE CHAT
 */
window.sendEventMessage = async (eventId) => {
    const input = document.getElementById(`event-msg-input-${eventId}`);
    const message = input?.value?.trim();
    
    if (!message) return;
    
    const { data, error } = await supabaseClient
        .from('event_messages')
        .insert([{
            event_id: eventId,
            author_id: currentUser.id,
            author_name: `${currentUser.first_name} ${currentUser.last_name}`,
            message: message
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Erreur message:', error);
        window.showNotice("Erreur", "Message non envoyé.", "error");
        return;
    }
    
    input.value = '';
    
    // Afficher le message immédiatement
    const container = document.getElementById(`event-chat-${eventId}`);
    if (container) {
        const messageHTML = `
            <div style="margin-bottom:15px; padding:10px; background:var(--bg); border-radius:8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:var(--gold);">${escapeHTML(data.author_name)}</strong>
                    <span style="color:var(--text-muted); font-size:0.85rem;">${new Date(data.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <p style="margin:0; color:var(--text-main);">${escapeHTML(data.message)}</p>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', messageHTML);
        container.scrollTop = container.scrollHeight;
    }
};

/**
 * S'ABONNER AU REALTIME POUR LE CHAT
 */
window.subscribeToEventChat = (eventId) => {
    // Désabonner l'ancien channel proprement
    if (window.eventChatChannel) {
        try {
            supabaseClient.removeChannel(window.eventChatChannel);
        } catch (e) {
            console.log('Erreur désabonnement:', e);
        }
        window.eventChatChannel = null;
    }
    
    // Créer le nouveau channel avec gestion d'erreur
    const channel = supabaseClient
        .channel(`event-chat-${eventId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: '' }
            }
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'event_messages',
            filter: `event_id=eq.${eventId}`
        }, async (payload) => {
            console.log('Nouveau message Realtime:', payload.new);
            
            // Si c'est mon propre message, ne rien faire (déjà affiché immédiatement)
            const isMyMessage = payload.new.author_id === currentUser.id;
            if (isMyMessage) {
                console.log('Mon propre message, ignoré (déjà affiché)');
                return;
            }
            
            // Sinon, afficher le message reçu
            const container = document.getElementById(`event-chat-${eventId}`);
            if (container) {
                const messageHTML = `
                    <div style="margin-bottom:15px; padding:10px; background:var(--bg); border-radius:8px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong style="color:var(--gold);">${escapeHTML(payload.new.author_name)}</strong>
                            <span style="color:var(--text-muted); font-size:0.85rem;">${new Date(payload.new.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
                        </div>
                        <p style="margin:0; color:var(--text-main);">${escapeHTML(payload.new.message)}</p>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', messageHTML);
                container.scrollTop = container.scrollHeight;
            }
        })
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Chat Realtime connecté');
            }
            if (status === 'CHANNEL_ERROR') {
                console.error('❌ Erreur channel Realtime:', err);
                // Ne pas réessayer automatiquement pour éviter la boucle
                if (window.eventChatChannel) {
                    supabaseClient.removeChannel(window.eventChatChannel);
                    window.eventChatChannel = null;
                }
            }
            if (status === 'TIMED_OUT') {
                console.warn('⏱️ Timeout Realtime');
            }
            if (status === 'CLOSED') {
                console.log('🔌 Channel fermé');
            }
        });
    
    window.eventChatChannel = channel;
};

/**
 * CHANGER LE STATUT
 */
window.toggleEventStatus = async (eventId, currentStatus) => {
    const newStatus = (currentStatus === 'ready' || currentStatus === 'published') ? 'draft' : 'ready';
    
    console.log('🔄 Toggle statut:', { eventId, currentStatus, newStatus });
    
    const { error } = await supabaseClient
        .from('events_v2')
        .update({ status: newStatus })
        .eq('id', eventId);
    
    if (error) {
        console.error('❌ Erreur:', error);
        window.showNotice("Erreur", "Impossible de changer le statut.", "error");
        return;
    }
    
    console.log('✅ Statut:', newStatus);
    window.showNotice("Modifié", `Événement ${newStatus === 'ready' ? 'prêt' : 'en préparation'}.`, "success");
    loadEvents();
    window.openEventDetails(eventId);
};

/**
 * TÉLÉCHARGER TOUTES LES PHOTOS
 */
window.downloadAllPhotos = async (eventId) => {
    const { data: ev } = await supabaseClient
        .from('events_v2')
        .select('photos')
        .eq('id', eventId)
        .single();
    
    if (!ev || !ev.photos || ev.photos.length === 0) {
        window.showNotice("Aucune photo", "Pas de photos à télécharger.", "info");
        return;
    }
    
    ev.photos.forEach((url, index) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `photo_${index + 1}.jpg`;
            a.click();
        }, index * 500);
    });
    
    window.showNotice("Téléchargement", `${ev.photos.length} photo(s) en cours...`, "success");
};

/**
 * COPIER LE TEXTE DANS LE PRESSE-PAPIER
 */
window.copySocialText = async (eventId) => {
    const { data: ev } = await supabaseClient
        .from('events_v2')
        .select('social_media_text')
        .eq('id', eventId)
        .single();
    
    if (!ev || !ev.social_media_text) {
        window.showNotice("Aucun texte", "Pas de texte à copier.", "info");
        return;
    }
    
    navigator.clipboard.writeText(ev.social_media_text);
    window.showNotice("Copié !", "Texte copié dans le presse-papier.", "success");
};

/**
 * SUPPRIMER UN ÉVÉNEMENT
 */
window.deleteEvent = async (eventId) => {
    const { data: ev } = await supabaseClient
        .from('events_v2')
        .select('title, photos')
        .eq('id', eventId)
        .single();
    
    if (!ev) return;
    
    window.alsatiaConfirm(
        "SUPPRIMER L'ÉVÉNEMENT",
        `Voulez-vous vraiment supprimer "${ev.title}" ?\nLes photos et messages seront également supprimés.`,
        async () => {
            // Supprimer les photos du storage
            if (ev.photos && ev.photos.length > 0) {
                const filePaths = ev.photos.map(url => {
                    const parts = url.split('/');
                    const fileName = parts[parts.length - 1];
                    return `${eventId}/${fileName}`;
                });
                
                await supabaseClient.storage
                    .from('event-files')
                    .remove(filePaths);
            }
            
            // Supprimer l'événement (cascade supprime les messages)
            const { error } = await supabaseClient
                .from('events_v2')
                .delete()
                .eq('id', eventId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de supprimer.", "error");
                return;
            }
            
            window.showNotice("Supprimé", "Événement supprimé.", "success");
            window.closeCustomModal();
            loadEvents();
        },
        true
    );
};


// =====================================================
// RESPONSIVE MOBILE - MENU BURGER
// =====================================================

window.toggleMobileMenu = () => {
    const nav = document.querySelector(".side-nav");
    const overlay = document.getElementById("mobile-overlay");
    const isOpen = nav.classList.contains("mobile-open");
    
    if (isOpen) {
        nav.classList.remove("mobile-open");
        overlay.classList.remove("active");
    } else {
        nav.classList.add("mobile-open");
        overlay.classList.add("active");
    }
};

window.closeMobileMenu = () => {
    document.querySelector(".side-nav").classList.remove("mobile-open");
    document.getElementById("mobile-overlay").classList.remove("active");
};

// Fermer le menu mobile lors du changement d'onglet
const originalSwitchTab = window.switchTab;
window.switchTab = (tabId) => {
    if (window.innerWidth <= 768) {
        window.closeMobileMenu();
    }
    originalSwitchTab(tabId);
};

// =====================================================
// DROPDOWN CANAUX MOBILE
// =====================================================

window.toggleChannelDropdown = () => {
    const menu = document.getElementById('mobile-channel-menu');
    const chevron = document.getElementById('mobile-chevron');
    const isOpen = menu.style.display === 'block';
    
    if (isOpen) {
        menu.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
        document.removeEventListener('click', window.handleClickOutsideDropdown);
    } else {
        menu.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
        
        // Fermer au click extérieur (après un petit délai pour éviter fermeture immédiate)
        setTimeout(() => {
            document.addEventListener('click', window.handleClickOutsideDropdown);
        }, 100);
    }
};

window.handleClickOutsideDropdown = (e) => {
    const menu = document.getElementById('mobile-channel-menu');
    const toggle = document.getElementById('mobile-channel-toggle');
    
    // Si on clique en dehors du menu ET du bouton toggle
    if (menu && !menu.contains(e.target) && !toggle.contains(e.target)) {
        window.closeChannelDropdown();
    }
};

window.closeChannelDropdown = () => {
    const menu = document.getElementById('mobile-channel-menu');
    const chevron = document.getElementById('mobile-chevron');
    
    if (menu) menu.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    document.removeEventListener('click', window.handleClickOutsideDropdown);
};

// Toggle chat sidebar mobile (ancien système)
window.toggleChatSidebar = () => {
    const sidebar = document.querySelector(".chat-sidebar");
    sidebar.classList.toggle("mobile-open");
};

// Ajouter click sur header chat pour ouvrir sidebar mobile
document.addEventListener("DOMContentLoaded", () => {
    const chatHeader = document.querySelector(".chat-header");
    if (chatHeader && window.innerWidth <= 768) {
        chatHeader.style.cursor = "pointer";
        chatHeader.addEventListener("click", window.toggleChatSidebar);
    }
});


// =====================================================
// GESTION DES COMPTES (Institut Alsatia uniquement)
// =====================================================

window.approveUser = async (userId) => {
    window.alsatiaConfirm(
        "APPROUVER LE COMPTE",
        "Voulez-vous approuver ce compte ? L'utilisateur pourra se connecter.",
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'approved' })
                .eq('id', userId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible d'approuver le compte.", "error");
                return;
            }
            
            window.showNotice("Approuvé", "Le compte a été approuvé avec succès.", "success");
            loadContacts();
        }
    );
};

window.rejectUser = async (userId) => {
    window.alsatiaConfirm(
        "REFUSER L'INSCRIPTION",
        "Voulez-vous refuser cette inscription ? L'utilisateur ne pourra pas se connecter.",
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'rejected' })
                .eq('id', userId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de refuser le compte.", "error");
                return;
            }
            
            window.showNotice("Refusé", "L'inscription a été refusée.", "success");
            loadContacts();
        },
        true
    );
};

window.revokeUser = async (userId) => {
    window.alsatiaConfirm(
        "RÉVOQUER L'ACCÈS",
        "Voulez-vous révoquer l'accès de cet utilisateur ? Il ne pourra plus se connecter.",
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'revoked' })
                .eq('id', userId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de révoquer l'accès.", "error");
                return;
            }
            
            window.showNotice("Révoqué", "L'accès a été révoqué.", "success");
            loadContacts();
        },
        true
    );
};

window.deleteUser = async (userId, userName) => {
    window.alsatiaConfirm(
        "⚠️ SUPPRESSION DÉFINITIVE",
        `Vous allez supprimer définitivement le compte de ${userName}. Cette action est IRRÉVERSIBLE. Tous ses messages privés seront aussi supprimés.`,
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) {
                window.showNotice("Erreur", "Impossible de supprimer ce compte.", "error");
                return;
            }

            window.showNotice("Supprimé", `Le compte de ${userName} a été supprimé définitivement.`, "success");
            loadContacts();
        },
        true
    );
};

window.reactivateUser = async (userId) => {
    window.alsatiaConfirm(
        "RÉACTIVER LE COMPTE",
        "Voulez-vous réactiver ce compte ? L'utilisateur pourra se connecter à nouveau.",
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'approved' })
                .eq('id', userId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de réactiver le compte.", "error");
                return;
            }
            
            window.showNotice("Réactivé", "Le compte a été réactivé.", "success");
            loadContacts();
        }
    );
};

// =====================================================
// GESTION DES PERMISSIONS D'ACCÈS
// =====================================================

window.toggleAccess = async (userId, accessField, isChecked) => {
    try {
        console.log(`🔐 Modification ${accessField} pour ${userId} → ${isChecked}`);
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({ [accessField]: isChecked })
            .eq('id', userId);
        
        if (error) throw error;
        
        const accessName = {
            'access_donors': 'Base Donateurs',
            'access_events': 'Événements'
        }[accessField];
        
        window.showNotice(
            "Accès modifié",
            `${accessName} ${isChecked ? 'activé' : 'désactivé'}`,
            "success"
        );
        
    } catch (error) {
        console.error('❌ Erreur toggleAccess:', error);
        window.showNotice("Erreur", "Impossible de modifier l'accès.", "error");
        loadContacts(); // Recharger pour remettre l'état correct
    }
};

function applyAccessPermissions() {
    if (!currentUser) return;
    
    // Institut Alsatia a accès à tout, rien à cacher
    if (currentUser.portal === 'Institut Alsatia') return;
    
    console.log('🔐 Application des permissions pour:', currentUser.portal);
    
    // Cacher Base Donateurs si pas accès
    if (!currentUser.access_donors) {
        const donorsNav = document.getElementById('nav-donors');
        if (donorsNav) {
            donorsNav.style.display = 'none';
            console.log('❌ Base Donateurs masquée');
        }
    }
    
    // Cacher Événements si pas accès
    if (!currentUser.access_events) {
        const eventsNav = document.getElementById('nav-events');
        if (eventsNav) {
            eventsNav.style.display = 'none';
            console.log('❌ Événements masqués');
        }
    }
}

// Appliquer les permissions au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    applyAccessPermissions();
    lucide.createIcons();
});

// ============================================================
// MODULE CAMPAGNES — CRM Institut Alsatia
// ============================================================

// Canal de communication (ex-TYPE)
const CAMPAIGN_CANALS  = ['Email', 'Courrier postal', 'Appel téléphonique', 'Événement', 'SMS', 'Mixte'];
// Objet / nature de la campagne
const CAMPAIGN_OBJECTIVES = [
    'Appel aux dons',
    'Recherche de contacts',
    'Événement',
    'Communication / Info',
    'Partenariat',
    'Legs / Planification',
    'Autre',
];
const CAMPAIGN_STATUTS = ['Brouillon', 'Active', 'Terminée', 'Archivée'];
const RECIPIENT_STATUTS = ['Planifié', 'Envoyé', 'Répondu', 'Refusé', 'Sans réponse'];
// Types de donateurs/contacts pour le ciblage
const DONOR_TYPES = ['Famille', 'Amis', 'Donateurs', 'IFI', 'Entreprise', 'Congrégation', 'Legs'];
const ALL_ENTITIES = [
    'Institut Alsatia',
    'Cours Herrade de Landsberg',
    'Collège Saints Louis et Zélie Martin',
    'Academia Alsatia'
];

const STATUT_COLORS = {
    'Brouillon'    : { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
    'Active'       : { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
    'Terminée'     : { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
    'Archivée'     : { bg: '#fafafa', color: '#a3a3a3', border: '#d4d4d4' },
};
const RECIPIENT_COLORS = {
    'Planifié'      : { bg: '#f8fafc', color: '#64748b' },
    'Envoyé'        : { bg: '#eff6ff', color: '#1d4ed8' },
    'Répondu'       : { bg: '#f0fdf4', color: '#16a34a' },
    'Refusé'        : { bg: '#fef2f2', color: '#dc2626' },
    'Sans réponse'  : { bg: '#fefce8', color: '#ca8a04' },
};
const TYPE_ICONS = {
    'Email'              : 'mail',
    'Courrier postal'    : 'file-text',
    'Appel téléphonique' : 'phone',
    'Événement'          : 'calendar',
    'SMS'                : 'message-square',
    'Mixte'              : 'layers',
};
const OBJECTIVE_ICONS = {
    'Appel aux dons'       : 'heart-handshake',
    'Recherche de contacts': 'users',
    'Événement'            : 'calendar',
    'Communication / Info' : 'megaphone',
    'Partenariat'          : 'handshake',
    'Legs / Planification' : 'scroll',
    'Autre'                : 'tag',
};

// ── CHARGEMENT DE L'ONGLET ─────────────────────────────────
window.loadCampaigns = async () => {
    if (currentUser.portal !== 'Institut Alsatia') {
        const container = document.getElementById('campaigns-container');
        if (container) container.innerHTML = '<div style="text-align:center;padding:60px;color:#94a3b8;">Accès réservé à Institut Alsatia.</div>';
        return;
    }
    const container = document.getElementById('campaigns-container');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;"><i data-lucide="loader" style="animation:spin 1s linear infinite;width:28px;height:28px;"></i><p style="margin-top:12px;">Chargement des campagnes...</p></div>`;
    if (window.lucide) lucide.createIcons();

    const { data: campaigns, error } = await supabaseClient
        .from('campaigns')
        .select('*, campaign_recipients(id, status, donation_id)')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;">Erreur de chargement.</div>`;
        return;
    }

    if (!campaigns || campaigns.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <i data-lucide="megaphone" style="width:48px;height:48px;color:#cbd5e1;margin-bottom:16px;"></i>
                <p style="color:#94a3b8;font-size:1rem;margin-bottom:20px;">Aucune campagne pour le moment.</p>
                <button onclick="window.showCreateCampaignModal()" class="btn-gold">
                    <i data-lucide="plus" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"></i>
                    Créer la première campagne
                </button>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    container.innerHTML = campaigns.map(c => {
        const total     = c.campaign_recipients?.length || 0;
        const sent      = c.campaign_recipients?.filter(r => ['Envoyé','Répondu','Sans réponse'].includes(r.status)).length || 0;
        const responded = c.campaign_recipients?.filter(r => r.status === 'Répondu').length || 0;
        const rate      = sent > 0 ? Math.round((responded / sent) * 100) : 0;
        const sc        = STATUT_COLORS[c.status] || STATUT_COLORS['Brouillon'];
        const icon      = TYPE_ICONS[c.type] || 'megaphone';

        return `
        <div class="campaign-card" onclick="window.openCampaign('${c.id}')" style="background:white;border:1.5px solid #e2e8f0;border-radius:16px;padding:20px 24px;margin-bottom:14px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.04);"
            onmouseover="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';this.style.borderColor='var(--gold)'"
            onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';this.style.borderColor='#e2e8f0'">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(197,160,89,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i data-lucide="${icon}" style="width:20px;height:20px;color:var(--gold);"></i>
                    </div>
                    <div style="min-width:0;">
                        <h3 style="font-size:1rem;font-weight:800;color:var(--primary);margin:0 0 4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</h3>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="font-size:0.72rem;color:#64748b;">${c.type || '—'}</span>
                            ${(c.target_entities||[]).map(e => `<span style="background:rgba(197,160,89,0.12);color:var(--primary);padding:1px 7px;border-radius:5px;font-size:0.68rem;font-weight:700;">${e.split(' ')[0]}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                    <span style="background:${sc.bg};color:${sc.color};border:1px solid ${sc.border};padding:4px 12px;border-radius:20px;font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">${c.status}</span>
                    <i data-lucide="chevron-right" style="width:18px;height:18px;color:#94a3b8;"></i>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid #f1f5f9;">
                <div style="text-align:center;">
                    <div style="font-size:1.3rem;font-weight:900;color:var(--primary);">${total}</div>
                    <div style="font-size:0.65rem;color:#94a3b8;text-transform:uppercase;font-weight:600;">Destinataires</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:1.3rem;font-weight:900;color:#1d4ed8;">${sent}</div>
                    <div style="font-size:0.65rem;color:#94a3b8;text-transform:uppercase;font-weight:600;">Envoyés</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:1.3rem;font-weight:900;color:#16a34a;">${responded}</div>
                    <div style="font-size:0.65rem;color:#94a3b8;text-transform:uppercase;font-weight:600;">Réponses</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:1.3rem;font-weight:900;color:${rate>=20?'#16a34a':rate>=10?'#ca8a04':'#ef4444'};">${rate}%</div>
                    <div style="font-size:0.65rem;color:#94a3b8;text-transform:uppercase;font-weight:600;">Taux réponse</div>
                </div>
            </div>
            ${c.goal_amount ? `
            <div style="margin-top:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                    <span style="font-size:0.72rem;color:#64748b;font-weight:600;">Objectif : ${Number(c.goal_amount).toLocaleString('fr-FR')} €</span>
                </div>
            </div>` : ''}
            ${c.start_date || c.end_date ? `
            <div style="margin-top:8px;font-size:0.72rem;color:#94a3b8;">
                <i data-lucide="calendar" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"></i>
                ${c.start_date ? new Date(c.start_date).toLocaleDateString('fr-FR') : '—'} → ${c.end_date ? new Date(c.end_date).toLocaleDateString('fr-FR') : '—'}
            </div>` : ''}
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
};

// ── CRÉATION D'UNE CAMPAGNE ────────────────────────────────
window.showCreateCampaignModal = (editData = null) => {
    if (currentUser.portal !== 'Institut Alsatia') {
        window.showNotice("Accès refusé", "Réservé à Institut Alsatia.", "error");
        return;
    }
    const isEdit = !!editData;
    const d = editData || {};
    const currentYear = new Date().getFullYear();

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="${isEdit ? 'edit' : 'megaphone'}" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                ${isEdit ? 'MODIFIER LA CAMPAGNE' : 'NOUVELLE CAMPAGNE'}
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <p class="mini-label">NOM DE LA CAMPAGNE *</p>
            <input type="text" id="camp-name" class="luxe-input" placeholder="Ex: Appel aux dons Gala 2025" value="${d.name||''}" style="margin-bottom:14px;">

            <p class="mini-label">DESCRIPTION</p>
            <textarea id="camp-desc" class="luxe-input" placeholder="Objet, contexte, message principal..." style="height:80px;margin-bottom:14px;">${d.description||''}</textarea>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <div>
                    <p class="mini-label">OBJET DE LA CAMPAGNE *</p>
                    <select id="camp-objective" class="luxe-input">
                        ${CAMPAIGN_OBJECTIVES.map(o => `<option ${(d.objective||d.type)===o?'selected':''}>${o}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <p class="mini-label">CANAL DE DIFFUSION</p>
                    <select id="camp-canal" class="luxe-input">
                        <option value="">— Sélectionner —</option>
                        ${CAMPAIGN_CANALS.map(c => `<option ${d.canal===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <div>
                    <p class="mini-label">STATUT</p>
                    <select id="camp-status" class="luxe-input">
                        ${CAMPAIGN_STATUTS.map(s => `<option ${d.status===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <p class="mini-label">OBJECTIF SI AUTRE</p>
                    <input type="text" id="camp-objective-other" class="luxe-input" placeholder="Précisez..." value="${d.objective_other||''}">
                </div>
            </div>

            <p class="mini-label">TYPE DE DONATEURS / CONTACTS VISÉS</p>
            <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;">
                ${DONOR_TYPES.map(t => `
                <label style="display:flex;align-items:center;gap:6px;padding:5px 10px;border:1.5px solid #e2e8f0;border-radius:20px;cursor:pointer;font-size:0.78rem;font-weight:600;transition:all 0.15s;"
                    onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <input type="checkbox" name="camp-donor-type" value="${t}" ${(d.donor_types||[]).includes(t)?'checked':''} style="accent-color:var(--gold);width:13px;height:13px;">
                    ${t}
                </label>`).join('')}
            </div>

            <p class="mini-label">ENTITÉS CIBLÉES</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
                ${ALL_ENTITIES.map(e => `
                    <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.15s;"
                        onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#e2e8f0'">
                        <input type="checkbox" name="camp-entity" value="${e}" ${(d.target_entities||[]).includes(e)?'checked':''} style="accent-color:var(--gold);width:15px;height:15px;">
                        ${e.split(' ').slice(0,2).join(' ')}
                    </label>`).join('')}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
                <div>
                    <p class="mini-label">DATE DÉBUT</p>
                    <input type="date" id="camp-start" class="luxe-input" value="${d.start_date||''}">
                </div>
                <div>
                    <p class="mini-label">DATE FIN</p>
                    <input type="date" id="camp-end" class="luxe-input" value="${d.end_date||''}">
                </div>
                <div>
                    <p class="mini-label">OBJECTIF (€)</p>
                    <input type="number" id="camp-goal" class="luxe-input" placeholder="0" min="0" value="${d.goal_amount||''}">
                </div>
            </div>

            <button onclick="window.saveCampaign(${isEdit ? `'${d.id}'` : 'null'})" class="btn-gold-fill" style="width:100%;height:50px;font-size:1rem;letter-spacing:1px;">
                <i data-lucide="${isEdit ? 'save' : 'plus-circle'}" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                ${isEdit ? 'ENREGISTRER' : 'CRÉER LA CAMPAGNE'}
            </button>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

window.saveCampaign = async (id) => {
    const name = document.getElementById('camp-name').value.trim();
    if (!name) return window.showNotice("Erreur", "Le nom est obligatoire.", "error");

    const entities = [...document.querySelectorAll('input[name="camp-entity"]:checked')].map(c => c.value);
    if (!entities.length) return window.showNotice("Erreur", "Sélectionnez au moins une entité.", "error");

    const donorTypes = [...document.querySelectorAll('input[name="camp-donor-type"]:checked')].map(c => c.value);
    const payload = {
        name,
        description     : document.getElementById('camp-desc').value.trim() || null,
        objective       : document.getElementById('camp-objective').value || null,
        objective_other : document.getElementById('camp-objective-other')?.value.trim() || null,
        canal           : document.getElementById('camp-canal').value || null,
        status          : document.getElementById('camp-status').value,
        target_entities : entities,
        donor_types     : donorTypes.length ? donorTypes : null,
        start_date      : document.getElementById('camp-start').value || null,
        end_date        : document.getElementById('camp-end').value || null,
        goal_amount     : parseFloat(document.getElementById('camp-goal').value) || null,
        created_by      : `${currentUser.first_name} ${currentUser.last_name}`
    };

    const { error } = id
        ? await supabaseClient.from('campaigns').update(payload).eq('id', id)
        : await supabaseClient.from('campaigns').insert([payload]);

    if (error) return window.showNotice("Erreur", error.message, "error");

    window.showNotice("Succès ✅", id ? "Campagne mise à jour." : "Campagne créée.", "success");
    closeCustomModal();
    window.loadCampaigns();
};

// ── FICHE CAMPAGNE ─────────────────────────────────────────
window.openCampaign = async (campaignId) => {
    const [{ data: campaign, error: ce }, { data: recipients, error: re }] = await Promise.all([
        supabaseClient.from('campaigns').select('*').eq('id', campaignId).single(),
        supabaseClient.from('campaign_recipients')
            .select('*, donors(id,last_name,first_name,company_name,email,phone,address,zip_code,city,entity), donations(amount,date)')
            .eq('campaign_id', campaignId)
            .order('created_at', { ascending: false })
    ]);
    if (ce || re) return window.showNotice("Erreur", "Impossible de charger la campagne.", "error");

    const sc       = STATUT_COLORS[campaign.status] || STATUT_COLORS['Brouillon'];
    const total    = recipients.length;
    const planned  = recipients.filter(r => r.status === 'Planifié').length;
    const sent     = recipients.filter(r => ['Envoyé','Répondu','Sans réponse'].includes(r.status)).length;
    const responded= recipients.filter(r => r.status === 'Répondu').length;
    const refused  = recipients.filter(r => r.status === 'Refusé').length;
    const noAnswer = recipients.filter(r => r.status === 'Sans réponse').length;
    const totalRaised = recipients
        .filter(r => r.donations)
        .reduce((sum, r) => sum + parseFloat(r.donations?.amount || 0), 0);
    const avgDon   = responded > 0 ? (totalRaised / responded) : 0;
    const rate     = sent > 0 ? Math.round((responded / sent) * 100) : 0;
    const goalPct  = campaign.goal_amount ? Math.min(100, Math.round((totalRaised / campaign.goal_amount) * 100)) : null;
    const remaining= campaign.goal_amount ? Math.max(0, campaign.goal_amount - totalRaised) : null;

    // Calcul jours restants
    let daysInfo = '';
    if (campaign.end_date) {
        const diff = Math.ceil((new Date(campaign.end_date) - new Date()) / 86400000);
        daysInfo = diff > 0
            ? `<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:12px;font-size:0.72rem;font-weight:700;">⏳ ${diff} jour${diff>1?'s':''} restant${diff>1?'s':''}</span>`
            : `<span style="background:#fef2f2;color:#dc2626;padding:3px 10px;border-radius:12px;font-size:0.72rem;font-weight:700;">⛔ Terminée depuis ${Math.abs(diff)} j</span>`;
    }

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                <i data-lucide="${TYPE_ICONS[campaign.type]||'megaphone'}" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                ${campaign.name}
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- Barre actions -->
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;flex-wrap:wrap;">
                <span style="background:${sc.bg};color:${sc.color};border:1px solid ${sc.border};padding:4px 12px;border-radius:20px;font-size:0.72rem;font-weight:800;text-transform:uppercase;">${campaign.status}</span>
                <span style="font-size:0.78rem;color:#64748b;font-weight:600;">${campaign.type}</span>
                ${daysInfo}
                <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;">
                    <button onclick="window.showCreateCampaignModal(${JSON.stringify(campaign).replace(/"/g,'&quot;')})" class="btn-outline" style="padding:5px 10px;font-size:0.72rem;">
                        <i data-lucide="edit" style="width:13px;height:13px;vertical-align:middle;margin-right:3px;"></i>Modifier
                    </button>
                    <button onclick="window.showAddRecipientsModal('${campaignId}')" class="btn-gold" style="padding:5px 10px;font-size:0.72rem;">
                        <i data-lucide="user-plus" style="width:13px;height:13px;vertical-align:middle;margin-right:3px;"></i>Contacts
                    </button>
                    <button onclick="window.showExportCampaignModal('${campaignId}')" class="btn-outline" style="padding:5px 10px;font-size:0.72rem;">
                        <i data-lucide="download" style="width:13px;height:13px;vertical-align:middle;margin-right:3px;"></i>Export
                    </button>
                    <button onclick="window.deleteCampaign('${campaignId}')" style="padding:5px 8px;border:1.5px solid #ef4444;color:#ef4444;background:white;border-radius:8px;cursor:pointer;font-size:0.72rem;">
                        <i data-lucide="trash-2" style="width:13px;height:13px;vertical-align:middle;"></i>
                    </button>
                </div>
            </div>

            ${campaign.description ? `<p style="font-size:0.83rem;color:#64748b;margin-bottom:16px;padding:10px 14px;background:#f8fafc;border-radius:8px;border-left:3px solid var(--gold);">${campaign.description}</p>` : ''}

            <!-- TABLEAU DE BORD ─────────────────────────────── -->

            <!-- Ligne 1 : KPIs principaux -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;">
                <div style="background:linear-gradient(135deg,#1e3a5f,#0f2744);border-radius:12px;padding:14px;text-align:center;">
                    <div style="font-size:2rem;font-weight:900;color:white;">${total}</div>
                    <div style="font-size:0.65rem;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:700;margin-top:2px;">Destinataires</div>
                </div>
                <div style="background:linear-gradient(135deg,#1d4ed8,#1e40af);border-radius:12px;padding:14px;text-align:center;">
                    <div style="font-size:2rem;font-weight:900;color:white;">${sent}</div>
                    <div style="font-size:0.65rem;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:700;margin-top:2px;">Envoyés</div>
                </div>
                <div style="background:linear-gradient(135deg,#16a34a,#15803d);border-radius:12px;padding:14px;text-align:center;">
                    <div style="font-size:2rem;font-weight:900;color:white;">${responded}</div>
                    <div style="font-size:0.65rem;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:700;margin-top:2px;">Réponses</div>
                </div>
            </div>

            <!-- Ligne 2 : Stats secondaires -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center;">
                    <div style="font-size:1.4rem;font-weight:900;color:${rate>=20?'#16a34a':rate>=10?'#ca8a04':'#94a3b8'};">${rate}%</div>
                    <div style="font-size:0.62rem;color:#94a3b8;text-transform:uppercase;font-weight:600;">Taux réponse</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center;">
                    <div style="font-size:1.4rem;font-weight:900;color:#ca8a04;">${noAnswer}</div>
                    <div style="font-size:0.62rem;color:#94a3b8;text-transform:uppercase;font-weight:600;">Sans réponse</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center;">
                    <div style="font-size:1.4rem;font-weight:900;color:#ef4444;">${refused}</div>
                    <div style="font-size:0.62rem;color:#94a3b8;text-transform:uppercase;font-weight:600;">Refusés</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center;">
                    <div style="font-size:1.4rem;font-weight:900;color:var(--gold);">${planned}</div>
                    <div style="font-size:0.62rem;color:#94a3b8;text-transform:uppercase;font-weight:600;">Planifiés</div>
                </div>
            </div>

            <!-- Barre de progression envoi -->
            ${total > 0 ? `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:0.75rem;font-weight:700;color:var(--primary);">Progression des envois</span>
                    <span style="font-size:0.75rem;color:#64748b;">${sent} / ${total} envoyés</span>
                </div>
                <div style="background:#e2e8f0;border-radius:20px;height:8px;overflow:hidden;">
                    <div style="height:100%;width:${Math.round((sent/total)*100)}%;background:linear-gradient(90deg,var(--gold),#b8903f);border-radius:20px;"></div>
                </div>
            </div>` : ''}

            <!-- Financier -->
            <div style="display:grid;grid-template-columns:${campaign.goal_amount ? '1fr 1fr 1fr' : '1fr 1fr'};gap:10px;margin-bottom:14px;">
                <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-size:1.2rem;font-weight:900;color:#16a34a;">${totalRaised.toLocaleString('fr-FR')} €</div>
                    <div style="font-size:0.62rem;color:#16a34a;text-transform:uppercase;font-weight:700;">Collecté</div>
                </div>
                <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-size:1.2rem;font-weight:900;color:#16a34a;">${avgDon > 0 ? avgDon.toLocaleString('fr-FR', {maximumFractionDigits:0}) : '—'} ${avgDon > 0 ? '€' : ''}</div>
                    <div style="font-size:0.62rem;color:#16a34a;text-transform:uppercase;font-weight:700;">Don moyen</div>
                </div>
                ${campaign.goal_amount ? `
                <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-size:1.2rem;font-weight:900;color:#1d4ed8;">${remaining > 0 ? remaining.toLocaleString('fr-FR')+' €' : '✅ Atteint'}</div>
                    <div style="font-size:0.62rem;color:#1d4ed8;text-transform:uppercase;font-weight:700;">Reste à collecter</div>
                </div>` : ''}
            </div>

            ${campaign.goal_amount ? `
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                    <span style="font-size:0.75rem;font-weight:700;color:var(--primary);">Objectif : ${Number(campaign.goal_amount).toLocaleString('fr-FR')} €</span>
                    <span style="font-size:0.75rem;font-weight:900;color:${goalPct>=100?'#16a34a':'var(--gold)'};">${goalPct}%</span>
                </div>
                <div style="background:#e2e8f0;border-radius:20px;height:12px;overflow:hidden;">
                    <div style="height:100%;width:${goalPct}%;background:linear-gradient(90deg,${goalPct>=100?'#22c55e,#16a34a':'var(--gold),#b8903f'});border-radius:20px;transition:width 0.8s;"></div>
                </div>
            </div>` : ''}

            <!-- Entités ciblées + dates -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
                ${(campaign.target_entities||[]).map(e => `<span style="background:rgba(197,160,89,0.12);color:var(--primary);padding:3px 10px;border-radius:6px;font-size:0.72rem;font-weight:700;">${e}</span>`).join('')}
                ${campaign.start_date || campaign.end_date ? `<span style="font-size:0.72rem;color:#94a3b8;margin-left:4px;"><i data-lucide="calendar" style="width:12px;height:12px;vertical-align:middle;margin-right:3px;"></i>${campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('fr-FR') : '—'} → ${campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('fr-FR') : '—'}</span>` : ''}
            </div>

            <!-- ─────────────────────────────────────────────── -->
            <!-- Liste destinataires -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <p class="mini-label" style="margin:0;">DESTINATAIRES (${total})</p>
                <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" id="search-recip-${campaignId}" placeholder="Rechercher..." onkeyup="window.filterRecipients('${campaignId}')"
                        style="padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.75rem;height:30px;width:130px;">
                    <select id="filter-recip-status" class="luxe-input" style="padding:4px 8px;font-size:0.75rem;height:30px;" onchange="window.filterRecipients('${campaignId}')">
                        <option value="ALL">Tous statuts</option>
                        ${RECIPIENT_STATUTS.map(s => `<option>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div id="recipients-list-${campaignId}" style="max-height:300px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px;">
                ${_renderRecipients(recipients, campaignId)}
            </div>
        </div>
    `);
    window._campaignRecipients = recipients;
    window._currentCampaignId  = campaignId;
    if (window.lucide) lucide.createIcons();
};

function _renderRecipients(recipients, campaignId) {
    if (!recipients.length) return `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;">Aucun destinataire — cliquez sur "Ajouter contacts"</div>`;
    return `<table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
        <thead style="background:var(--surface);position:sticky;top:0;z-index:1;">
            <tr>
                <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0;color:var(--gold);font-weight:700;">CONTACT</th>
                <th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0;color:var(--gold);">ENTITÉ</th>
                <th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0;color:var(--gold);">STATUT</th>
                <th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0;color:var(--gold);">DON ASSOCIÉ</th>
                <th style="padding:8px;border-bottom:1px solid #e2e8f0;color:var(--gold);">NOTES</th>
                <th style="padding:8px;border-bottom:1px solid #e2e8f0;"></th>
            </tr>
        </thead>
        <tbody>
        ${recipients.map(r => {
            const d = r.donors || {};
            const name = d.company_name || `${d.last_name||''} ${d.first_name||''}`.trim() || '—';
            const rc = RECIPIENT_COLORS[r.status] || RECIPIENT_COLORS['Planifié'];
            return `
            <tr style="border-bottom:1px solid #f1f5f9;" id="recip-row-${r.id}">
                <td style="padding:8px 12px;">
                    <div style="font-weight:700;color:var(--primary);">${name}</div>
                    <div style="font-size:0.7rem;color:#94a3b8;">${d.email||''}</div>
                </td>
                <td style="padding:8px;">
                    <span style="background:rgba(197,160,89,0.1);color:var(--primary);padding:2px 6px;border-radius:5px;font-size:0.68rem;font-weight:700;">${(d.entity||'').split(' ')[0]}</span>
                </td>
                <td style="padding:8px;">
                    <select onchange="window.updateRecipientStatus('${r.id}','${campaignId}',this.value)"
                        style="background:${rc.bg};color:${rc.color};border:1px solid ${rc.color}33;padding:3px 6px;border-radius:6px;font-size:0.72rem;font-weight:700;cursor:pointer;">
                        ${RECIPIENT_STATUTS.map(s => `<option ${r.status===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                </td>
                <td style="padding:8px;">
                    ${r.donations ? `<span style="color:#16a34a;font-weight:700;">${Number(r.donations.amount).toLocaleString('fr-FR')} €</span><br><span style="font-size:0.68rem;color:#94a3b8;">${new Date(r.donations.date).toLocaleDateString('fr-FR')}</span>`
                        : `<button onclick="window.linkDonationToRecipient('${r.id}','${d.id}','${campaignId}')" style="font-size:0.7rem;padding:3px 8px;border:1px dashed #94a3b8;background:white;border-radius:5px;cursor:pointer;color:#64748b;">Lier un don</button>`}
                </td>
                <td style="padding:8px;">
                    <input type="text" value="${r.notes||''}" placeholder="Note..."
                        style="width:100px;padding:3px 6px;border:1px solid #e2e8f0;border-radius:5px;font-size:0.72rem;"
                        onblur="window.updateRecipientNotes('${r.id}',this.value)">
                </td>
                <td style="padding:8px;text-align:right;">
                    <i data-lucide="trash-2" style="width:13px;height:13px;color:#ef4444;cursor:pointer;" onclick="window.removeRecipient('${r.id}','${campaignId}')"></i>
                </td>
            </tr>`;
        }).join('')}
        </tbody>
    </table>`;
}

window.filterRecipients = (campaignId) => {
    const filterVal = document.getElementById('filter-recip-status')?.value || 'ALL';
    const search    = (document.getElementById(`search-recip-${campaignId}`)?.value || '').toLowerCase();
    let all = window._campaignRecipients || [];

    if (filterVal !== 'ALL') all = all.filter(r => r.status === filterVal);
    if (search) all = all.filter(r => {
        const d = r.donors || {};
        const txt = `${d.last_name||''} ${d.first_name||''} ${d.company_name||''} ${d.email||''}`.toLowerCase();
        return txt.includes(search);
    });

    const el = document.getElementById(`recipients-list-${campaignId}`);
    if (el) { el.innerHTML = _renderRecipients(all, campaignId); if(window.lucide) lucide.createIcons(); }
};

// ── AJOUT DE DESTINATAIRES (ciblage) ──────────────────────
window.showAddRecipientsModal = async (campaignId) => {
    // Charger les donateurs non déjà dans la campagne
    const [{ data: allDonors }, { data: existing }] = await Promise.all([
        supabaseClient.from('donors').select('id,last_name,first_name,company_name,entity,email,phone,donor_type,archived_at').order('last_name'),
        supabaseClient.from('campaign_recipients').select('donor_id').eq('campaign_id', campaignId)
    ]);

    const existingIds = new Set((existing||[]).map(r => r.donor_id));
    const available = (allDonors||[]).filter(d => !existingIds.has(d.id));

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="users" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                AJOUTER DES DESTINATAIRES
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- Filtres de ciblage -->
            <div style="background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.3);border-radius:12px;padding:14px;margin-bottom:16px;">
                <p style="font-size:0.75rem;font-weight:800;color:var(--primary);text-transform:uppercase;margin-bottom:10px;">🎯 Ciblage automatique</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                    <div>
                        <p class="mini-label" style="font-size:0.68rem;">ENTITÉ</p>
                        <select id="target-entity" class="luxe-input" style="height:34px;font-size:0.8rem;">
                            <option value="ALL">Toutes</option>
                            ${ALL_ENTITIES.map(e => `<option>${e}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <p class="mini-label" style="font-size:0.68rem;">TYPE DE CONTACT</p>
                        <select id="target-donor-type" class="luxe-input" style="height:34px;font-size:0.8rem;">
                            <option value="ALL">Tous types</option>
                            ${DONOR_TYPES.map(t => `<option>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <p class="mini-label" style="font-size:0.68rem;">N'A PAS DONNÉ DEPUIS</p>
                        <select id="target-no-donation-since" class="luxe-input" style="height:34px;font-size:0.8rem;">
                            <option value="">— Ignorer ce filtre —</option>
                            <option value="1">1 an</option>
                            <option value="2">2 ans</option>
                            <option value="3">3 ans et plus</option>
                        </select>
                    </div>
                    <div>
                        <p class="mini-label" style="font-size:0.68rem;">DON MINIMUM (€)</p>
                        <input type="number" id="target-min-donation" class="luxe-input" style="height:34px;font-size:0.8rem;" placeholder="0">
                    </div>
                    <div>
                        <p class="mini-label" style="font-size:0.68rem;">RECHERCHE NOM</p>
                        <input type="text" id="target-search" class="luxe-input" style="height:34px;font-size:0.8rem;" placeholder="Filtrer...">
                    </div>
                    <div>
                        <p class="mini-label" style="font-size:0.68rem;">STATUT ARCHIVAGE</p>
                        <select id="target-archived" class="luxe-input" style="height:34px;font-size:0.8rem;">
                            <option value="active">Actifs uniquement</option>
                            <option value="ALL">Tous (incl. archivés)</option>
                        </select>
                    </div>
                </div>
                <button onclick="window.applyTargetFilters()" class="btn-gold" style="width:100%;height:36px;font-size:0.8rem;">
                    <i data-lucide="filter" style="width:14px;height:14px;vertical-align:middle;margin-right:6px;"></i>
                    APPLIQUER LES FILTRES
                </button>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <p class="mini-label" style="margin:0;" id="available-count">${available.length} contacts disponibles</p>
                <div style="display:flex;gap:8px;align-items:center;">
                    <label style="font-size:0.75rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
                        <input type="checkbox" id="select-all-recip" onchange="window.toggleSelectAll(this.checked)" style="accent-color:var(--gold);"> Tout sélectionner
                    </label>
                </div>
            </div>

            <div id="donors-to-add" style="max-height:280px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px;">
                ${_renderDonorsToAdd(available)}
            </div>

            <button onclick="window.addSelectedRecipients('${campaignId}')" class="btn-gold-fill" style="width:100%;height:48px;font-size:0.95rem;">
                <i data-lucide="user-plus" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                AJOUTER LES CONTACTS SÉLECTIONNÉS
            </button>
        </div>
    `);
    window._availableDonors = available;
    if (window.lucide) lucide.createIcons();
};

function _renderDonorsToAdd(donors) {
    if (!donors.length) return `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.82rem;">Aucun contact disponible avec ces filtres.</div>`;
    return donors.map(d => {
        const name = d.company_name || `${d.last_name||''} ${d.first_name||''}`.trim();
        return `
        <label style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer;"
            onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background='white'">
            <input type="checkbox" class="recip-checkbox" value="${d.id}" style="accent-color:var(--gold);width:15px;height:15px;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.83rem;color:var(--primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                <div style="font-size:0.7rem;color:#94a3b8;">${d.email||''} ${d.entity ? '· '+d.entity.split(' ')[0] : ''}</div>
            </div>
        </label>`;
    }).join('');
}

window.applyTargetFilters = async () => {
    let donors = window._availableDonors || [];
    const entity     = document.getElementById('target-entity')?.value;
    const donorType  = document.getElementById('target-donor-type')?.value || 'ALL';
    const search     = document.getElementById('target-search')?.value?.toLowerCase() || '';
    const minDon     = parseFloat(document.getElementById('target-min-donation')?.value) || 0;
    const noSince    = parseInt(document.getElementById('target-no-donation-since')?.value) || 0;
    const archivedFilter = document.getElementById('target-archived')?.value || 'active';

    if (entity && entity !== 'ALL') donors = donors.filter(d => d.entity === entity);
    if (donorType !== 'ALL') donors = donors.filter(d => (d.donor_type || '') === donorType);
    if (archivedFilter === 'active') donors = donors.filter(d => !d.archived_at);
    if (search) donors = donors.filter(d => {
        const n = (d.last_name+' '+d.first_name+' '+(d.company_name||'')).toLowerCase();
        return n.includes(search);
    });

    // Filtre don minimum : charger les dons si nécessaire
    if (minDon > 0 || noSince > 0) {
        const ids = donors.map(d => d.id);
        const { data: dons } = await supabaseClient
            .from('donations')
            .select('donor_id, amount, date')
            .in('donor_id', ids);
        const donsByDonor = {};
        (dons||[]).forEach(don => {
            if (!donsByDonor[don.donor_id]) donsByDonor[don.donor_id] = [];
            donsByDonor[don.donor_id].push(don);
        });

        if (minDon > 0) {
            donors = donors.filter(d => {
                const total = (donsByDonor[d.id]||[]).reduce((s,x) => s + parseFloat(x.amount||0), 0);
                return total >= minDon;
            });
        }
        if (noSince > 0) {
            const cutoff = new Date();
            cutoff.setFullYear(cutoff.getFullYear() - noSince);
            donors = donors.filter(d => {
                const lastDon = (donsByDonor[d.id]||[]).map(x => new Date(x.date)).sort((a,b) => b-a)[0];
                return !lastDon || lastDon < cutoff;
            });
        }
    }

    const container = document.getElementById('donors-to-add');
    const countEl   = document.getElementById('available-count');
    if (container) { container.innerHTML = _renderDonorsToAdd(donors); if(window.lucide) lucide.createIcons(); }
    if (countEl) countEl.textContent = `${donors.length} contacts disponibles`;
};

window.toggleSelectAll = (checked) => {
    document.querySelectorAll('.recip-checkbox').forEach(cb => cb.checked = checked);
};

window.addSelectedRecipients = async (campaignId) => {
    const selected = [...document.querySelectorAll('.recip-checkbox:checked')].map(cb => cb.value);
    if (!selected.length) return window.showNotice("Erreur", "Sélectionnez au moins un contact.", "error");

    const rows = selected.map(donor_id => ({ campaign_id: campaignId, donor_id, status: 'Planifié' }));
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabaseClient.from('campaign_recipients').insert(rows.slice(i, i + BATCH));
        if (error) return window.showNotice("Erreur", error.message, "error");
    }

    window.showNotice("Ajoutés ✅", `${selected.length} contact${selected.length>1?'s':''} ajouté${selected.length>1?'s':''} à la campagne.`, "success");
    closeCustomModal();
    window.openCampaign(campaignId);
};

// ── MISE À JOUR STATUT DESTINATAIRE ───────────────────────
window.updateRecipientStatus = async (recipId, campaignId, newStatus) => {
    const payload = { status: newStatus };
    if (newStatus === 'Envoyé') payload.sent_at = new Date().toISOString();
    await supabaseClient.from('campaign_recipients').update(payload).eq('id', recipId);
    // Mise à jour visuelle de la couleur du select
    const rc = RECIPIENT_COLORS[newStatus] || RECIPIENT_COLORS['Planifié'];
    const sel = document.querySelector(`#recip-row-${recipId} select`);
    if (sel) { sel.style.background = rc.bg; sel.style.color = rc.color; }
};

window.updateRecipientNotes = async (recipId, notes) => {
    await supabaseClient.from('campaign_recipients').update({ notes: notes||null }).eq('id', recipId);
};

window.removeRecipient = async (recipId, campaignId) => {
    await supabaseClient.from('campaign_recipients').delete().eq('id', recipId);
    const row = document.getElementById(`recip-row-${recipId}`);
    if (row) row.remove();
    window._campaignRecipients = (window._campaignRecipients||[]).filter(r => r.id !== recipId);
};

// ── LIER UN DON À UN DESTINATAIRE ─────────────────────────
window.linkDonationToRecipient = async (recipId, donorId, campaignId) => {
    const { data: dons } = await supabaseClient
        .from('donations')
        .select('id, amount, date, campaign')
        .eq('donor_id', donorId)
        .order('date', { ascending: false })
        .limit(10);

    if (!dons?.length) return window.showNotice("Info", "Ce contact n'a aucun don enregistré.", "info");

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">LIER UN DON À CE CONTACT</h3>
            <button onclick="window.openCampaign('${campaignId}')" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:14px;">Sélectionnez le don correspondant à cette campagne :</p>
            ${dons.map(don => `
                <div onclick="window.confirmLinkDonation('${recipId}','${don.id}','${campaignId}')"
                    style="padding:12px 16px;border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;"
                    onmouseover="this.style.borderColor='var(--gold)';this.style.background='rgba(197,160,89,0.05)'"
                    onmouseout="this.style.borderColor='#e2e8f0';this.style.background='white'">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-weight:700;font-size:1rem;color:#16a34a;">${Number(don.amount).toLocaleString('fr-FR')} €</span>
                        <span style="font-size:0.78rem;color:#64748b;">${new Date(don.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    ${don.campaign ? `<div style="font-size:0.72rem;color:#94a3b8;margin-top:2px;">${don.campaign}</div>` : ''}
                </div>`).join('')}
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

window.confirmLinkDonation = async (recipId, donationId, campaignId) => {
    await supabaseClient.from('campaign_recipients').update({ donation_id: donationId, status: 'Répondu' }).eq('id', recipId);
    window.showNotice("Lié ✅", "Don rattaché à la campagne.", "success");
    window.openCampaign(campaignId);
};

// ── EXPORT CAMPAGNE ────────────────────────────────────────
window.showExportCampaignModal = (campaignId) => {
    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="download" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                EXPORTER LA CAMPAGNE
            </h3>
            <button onclick="window.openCampaign('${campaignId}')" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <p style="font-size:0.83rem;color:#64748b;margin-bottom:18px;">Choisissez les formats à inclure dans le fichier Excel :</p>

            <div style="display:grid;gap:10px;margin-bottom:20px;">
                <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;"
                    onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <input type="checkbox" id="exp-full" checked style="accent-color:var(--gold);width:16px;height:16px;">
                    <div>
                        <div style="font-weight:700;font-size:0.85rem;">Liste complète</div>
                        <div style="font-size:0.72rem;color:#64748b;">Tous les champs + statuts + dons associés + notes</div>
                    </div>
                </label>
                <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;"
                    onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <input type="checkbox" id="exp-mail" checked style="accent-color:var(--gold);width:16px;height:16px;">
                    <div>
                        <div style="font-weight:700;font-size:0.85rem;">Liste courrier postal</div>
                        <div style="font-size:0.72rem;color:#64748b;">Civilité / Nom / Adresse / CP / Ville / Pays — prête à imprimer</div>
                    </div>
                </label>
                <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;"
                    onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <input type="checkbox" id="exp-email" checked style="accent-color:var(--gold);width:16px;height:16px;">
                    <div>
                        <div style="font-weight:700;font-size:0.85rem;">Liste emails</div>
                        <div style="font-size:0.72rem;color:#64748b;">Nom / Email — compatible Brevo, Mailchimp, Sarbacane</div>
                    </div>
                </label>
                <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;"
                    onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <input type="checkbox" id="exp-donors" style="accent-color:var(--gold);width:16px;height:16px;">
                    <div>
                        <div style="font-weight:700;font-size:0.85rem;">Donateurs ayant répondu uniquement</div>
                        <div style="font-size:0.72rem;color:#64748b;">Filtré sur statut = "Répondu" + montant collecté</div>
                    </div>
                </label>
            </div>

            <button onclick="window.execExportCampaign('${campaignId}')" class="btn-gold-fill" style="width:100%;height:48px;font-size:0.95rem;">
                <i data-lucide="download" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                TÉLÉCHARGER LE FICHIER EXCEL
            </button>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

window.execExportCampaign = async (campaignId) => {
    const [{ data: campaign }, { data: recipients }] = await Promise.all([
        supabaseClient.from('campaigns').select('*').eq('id', campaignId).single(),
        supabaseClient.from('campaign_recipients')
            .select('*, donors(*), donations(amount,date)')
            .eq('campaign_id', campaignId)
    ]);

    const inclFull   = document.getElementById('exp-full')?.checked !== false;
    const inclMail   = document.getElementById('exp-mail')?.checked !== false;
    const inclEmail  = document.getElementById('exp-email')?.checked !== false;
    const inclDonors = document.getElementById('exp-donors')?.checked;

    const wb = XLSX.utils.book_new();

    // Onglet 1 : Liste complète
    if (inclFull) {
        const ws1 = XLSX.utils.json_to_sheet(recipients.map(r => ({
            'Nom'             : r.donors?.last_name || '',
            'Prénom'          : r.donors?.first_name || '',
            'Entreprise'      : r.donors?.company_name || '',
            'Entité'          : r.donors?.entity || '',
            'Email'           : r.donors?.email || '',
            'Téléphone'       : r.donors?.phone || '',
            'Adresse'         : r.donors?.address || '',
            'CP'              : r.donors?.zip_code || '',
            'Ville'           : r.donors?.city || '',
            'Statut campagne' : r.status || '',
            'Envoyé le'       : r.sent_at ? new Date(r.sent_at).toLocaleDateString('fr-FR') : '',
            'Don associé (€)' : r.donations?.amount || '',
            'Date du don'     : r.donations?.date ? new Date(r.donations.date).toLocaleDateString('fr-FR') : '',
            'Notes'           : r.notes || ''
        })));
        XLSX.utils.book_append_sheet(wb, ws1, 'Destinataires complet');
    }

    // Onglet 2 : Liste courrier postal
    if (inclMail) {
        const withAddr = recipients.filter(r => r.donors?.address || r.donors?.zip_code);
        const ws2 = XLSX.utils.json_to_sheet(withAddr.map(r => ({
            'Civilité' : '',
            'Nom'      : (r.donors?.company_name || `${r.donors?.last_name||''} ${r.donors?.first_name||''}`.trim()),
            'Adresse'  : r.donors?.address || '',
            'CP'       : r.donors?.zip_code || '',
            'Ville'    : (r.donors?.city || '').toUpperCase(),
            'Pays'     : 'France'
        })));
        XLSX.utils.book_append_sheet(wb, ws2, 'Courrier postal');
    }

    // Onglet 3 : Liste emails
    if (inclEmail) {
        const withEmail = recipients.filter(r => r.donors?.email);
        const ws3 = XLSX.utils.json_to_sheet(withEmail.map(r => ({
            'Nom'    : r.donors?.last_name || r.donors?.company_name || '',
            'Prénom' : r.donors?.first_name || '',
            'Email'  : r.donors?.email || '',
            'Entité' : r.donors?.entity || ''
        })));
        XLSX.utils.book_append_sheet(wb, ws3, 'Emails (Brevo-Mailchimp)');
    }

    // Onglet 4 : Répondants uniquement
    if (inclDonors) {
        const responded = recipients.filter(r => r.status === 'Répondu');
        const ws4 = XLSX.utils.json_to_sheet(responded.map(r => ({
            'Nom'            : r.donors?.last_name || r.donors?.company_name || '',
            'Prénom'         : r.donors?.first_name || '',
            'Email'          : r.donors?.email || '',
            'Téléphone'      : r.donors?.phone || '',
            'Don associé (€)': r.donations?.amount || '',
            'Date du don'    : r.donations?.date ? new Date(r.donations.date).toLocaleDateString('fr-FR') : '',
            'Notes'          : r.notes || ''
        })));
        XLSX.utils.book_append_sheet(wb, ws4, 'Donateurs répondants');
    }

    if (wb.SheetNames.length === 0) {
        return window.showNotice("Erreur", "Sélectionnez au moins un format.", "error");
    }

    const fileName = `Campagne_${campaign.name.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    window.showNotice("Export prêt ✅", fileName, "success");
    closeCustomModal();
};

// ── SUPPRESSION CAMPAGNE ───────────────────────────────────
window.deleteCampaign = (campaignId) => {
    window.alsatiaConfirm(
        "SUPPRIMER LA CAMPAGNE",
        "Cette action supprimera la campagne et tous ses destinataires. Les dons liés ne seront pas supprimés.",
        async () => {
            await supabaseClient.from('campaign_recipients').delete().eq('campaign_id', campaignId);
            await supabaseClient.from('campaigns').delete().eq('id', campaignId);
            window.showNotice("Supprimée ✅", "Campagne supprimée.", "success");
            closeCustomModal();
            window.loadCampaigns();
        }
    );
};

// ════════════════════════════════════════════════════════════
// NOUVELLES FONCTIONS — ARCHIVAGE, ORIGINE, DON PAR ENTITÉ
// ════════════════════════════════════════════════════════════

// ── ARCHIVAGE ──────────────────────────────────────────────
window.showArchiveDonorModal = (donorId, donorName) => {
    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="archive" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:#92400e;"></i>
                ARCHIVER CE CONTACT
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
                <p style="margin:0;font-size:0.85rem;color:#92400e;font-weight:600;">
                    ⚠️ La fiche de <b>${donorName}</b> sera archivée mais conservée dans la base de données.<br>
                    Elle restera visible avec un badge "Archivé".
                </p>
            </div>
            <p class="mini-label">MOTIF D'ARCHIVAGE *</p>
            <textarea id="archive-reason" class="luxe-input" placeholder="Ex : Contact décédé, Demande de désinscription, Déménagement à l'étranger..." style="height:100px;margin-bottom:18px;"></textarea>
            <button onclick="window.execArchiveDonor('${donorId}')" class="btn-gold-fill" style="width:100%;height:48px;background:linear-gradient(135deg,#92400e,#b45309);">
                <i data-lucide="archive" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                CONFIRMER L'ARCHIVAGE
            </button>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

window.execArchiveDonor = async (donorId) => {
    const reason = document.getElementById('archive-reason')?.value?.trim();
    if (!reason) return window.showNotice("Erreur", "Le motif est obligatoire.", "error");
    const { error } = await supabaseClient.from('donors').update({
        archived_at: new Date().toISOString(),
        archive_reason: reason
    }).eq('id', donorId);
    if (error) return window.showNotice("Erreur", error.message, "error");
    window.showNotice("Archivé ✅", "La fiche a été archivée.", "success");
    closeCustomModal();
    window.loadDonors();
};

window.unarchiveDonor = async (donorId) => {
    const { error } = await supabaseClient.from('donors').update({
        archived_at: null, archive_reason: null
    }).eq('id', donorId);
    if (error) return window.showNotice("Erreur", error.message, "error");
    window.showNotice("Désarchivé ✅", "La fiche est de nouveau active.", "success");
    closeCustomModal();
    window.loadDonors();
};

// ── ORIGINE DEPUIS UNE CAMPAGNE ────────────────────────────
window.pickOriginFromCampaign = async (donorId) => {
    const { data: campaigns } = await supabaseClient
        .from('campaigns')
        .select('id, name, objective, canal, created_at')
        .order('created_at', { ascending: false });

    if (!campaigns?.length) {
        return window.showNotice("Info", "Aucune campagne disponible.", "info");
    }

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="link" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                ORIGINE : LIER À UNE CAMPAGNE
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:14px;">Sélectionnez la campagne par laquelle ce contact a été acquis :</p>
            ${campaigns.map(c => `
            <div onclick="window.setOriginFromCampaign('${donorId}', '${c.name.replace(/'/g,"\\'")}','${c.id}')"
                style="padding:12px 16px;border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;"
                onmouseover="this.style.borderColor='var(--gold)';this.style.background='rgba(197,160,89,0.05)'"
                onmouseout="this.style.borderColor='#e2e8f0';this.style.background='white'">
                <div style="font-weight:700;font-size:0.85rem;color:var(--primary);">${c.name}</div>
                <div style="font-size:0.72rem;color:#94a3b8;margin-top:2px;">
                    ${c.objective ? `<span style="background:rgba(197,160,89,0.1);color:var(--primary);padding:1px 6px;border-radius:4px;font-weight:700;">${c.objective}</span>` : ''}
                    ${c.canal ? `· ${c.canal}` : ''}
                    · ${new Date(c.created_at).toLocaleDateString('fr-FR')}
                </div>
            </div>`).join('')}
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

window.setOriginFromCampaign = async (donorId, campaignName, campaignId) => {
    const originInput = document.getElementById('edit-origin');
    if (originInput) {
        originInput.value = campaignName;
        window.showNotice("Lié ✅", `Origine : ${campaignName}`, "success");
    }
    // Lier aussi dans campaign_recipients si pas déjà dedans
    const { data: existing } = await supabaseClient
        .from('campaign_recipients')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('donor_id', donorId)
        .single();
    if (!existing) {
        await supabaseClient.from('campaign_recipients').insert([{
            campaign_id: campaignId, donor_id: donorId, status: 'Répondu'
        }]);
    }
    closeCustomModal();
};

// ── ATTRIBUTION DU DON PAR ENTITÉ (popup dédié) ───────────
window.showDonationAllocationModal = async (donationId, donationAmount) => {
    // Charger les allocations existantes
    const { data: allocations } = await supabaseClient
        .from('donation_allocations')
        .select('*')
        .eq('donation_id', donationId)
        .order('created_at');

    const totalAllocated = (allocations||[]).reduce((s,a) => s + parseFloat(a.amount||0), 0);
    const remaining = parseFloat(donationAmount) - totalAllocated;

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="split" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                RÉPARTITION DU DON
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- Récap montant -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px;">
                <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px;text-align:center;">
                    <div style="font-size:1.1rem;font-weight:900;color:#16a34a;">${Number(donationAmount).toLocaleString('fr-FR')} €</div>
                    <div style="font-size:0.62rem;color:#16a34a;text-transform:uppercase;font-weight:700;">Don total</div>
                </div>
                <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:10px;text-align:center;">
                    <div style="font-size:1.1rem;font-weight:900;color:#1d4ed8;">${totalAllocated.toLocaleString('fr-FR')} €</div>
                    <div style="font-size:0.62rem;color:#1d4ed8;text-transform:uppercase;font-weight:700;">Réparti</div>
                </div>
                <div style="background:${remaining>0?'#fef3c7;border:1px solid #fde68a':'#f1f5f9;border:1px solid #e2e8f0'};border-radius:10px;padding:10px;text-align:center;" id="alloc-remaining-card">
                    <div style="font-size:1.1rem;font-weight:900;color:${remaining>0?'#92400e':'#64748b'};" id="alloc-remaining-val">${remaining.toLocaleString('fr-FR')} €</div>
                    <div style="font-size:0.62rem;color:${remaining>0?'#92400e':'#64748b'};text-transform:uppercase;font-weight:700;">Reste à répartir</div>
                </div>
            </div>

            <!-- Allocations existantes -->
            <div id="allocations-list-${donationId}" style="margin-bottom:16px;">
                ${(allocations||[]).length === 0
                    ? '<p style="text-align:center;color:#94a3b8;font-size:0.82rem;padding:10px;">Aucune répartition définie.</p>'
                    : (allocations||[]).map(a => `
                    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;" id="alloc-row-${a.id}">
                        <div style="flex:1;font-size:0.85rem;font-weight:700;color:var(--primary);">${a.entity}</div>
                        <div style="font-size:0.9rem;font-weight:800;color:#16a34a;">${Number(a.amount).toLocaleString('fr-FR')} €</div>
                        ${a.notes ? `<div style="font-size:0.72rem;color:#94a3b8;flex:1;">${a.notes}</div>` : ''}
                        <button onclick="window.deleteAllocation('${a.id}','${donationId}',${donationAmount})"
                            style="border:none;background:none;cursor:pointer;color:#ef4444;padding:4px;">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>`).join('')}
            </div>

            <!-- Ajouter une allocation -->
            <div style="background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.3);border-radius:12px;padding:14px;">
                <p style="font-size:0.75rem;font-weight:800;color:var(--primary);text-transform:uppercase;margin-bottom:10px;">+ Ajouter une répartition</p>
                <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:10px;">
                    <div>
                        <p class="mini-label" style="font-size:0.68rem;">ENTITÉ BÉNÉFICIAIRE</p>
                        <select id="alloc-entity" class="luxe-input" style="height:36px;font-size:0.82rem;">
                            <option value="">— Sélectionner —</option>
                            ${ALL_ENTITIES.map(e => `<option>${e}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <p class="mini-label" style="font-size:0.68rem;">MONTANT (€)</p>
                        <input type="number" id="alloc-amount" class="luxe-input" style="height:36px;font-size:0.82rem;" placeholder="0.00" min="0" step="0.01">
                    </div>
                </div>
                <div style="margin-bottom:10px;">
                    <p class="mini-label" style="font-size:0.68rem;">NOTE (optionnel)</p>
                    <input type="text" id="alloc-notes" class="luxe-input" style="height:34px;font-size:0.82rem;" placeholder="Ex : Financement projet salle...">
                </div>
                <button onclick="window.addAllocation('${donationId}',${donationAmount})" class="btn-gold-fill" style="width:100%;height:40px;font-size:0.85rem;">
                    <i data-lucide="plus-circle" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"></i>
                    AJOUTER CETTE RÉPARTITION
                </button>
            </div>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

window.addAllocation = async (donationId, donationAmount) => {
    const entity = document.getElementById('alloc-entity')?.value;
    const amount = parseFloat(document.getElementById('alloc-amount')?.value);
    const notes  = document.getElementById('alloc-notes')?.value?.trim() || null;

    if (!entity) return window.showNotice("Erreur", "Sélectionnez une entité.", "error");
    if (!amount || amount <= 0) return window.showNotice("Erreur", "Le montant doit être > 0.", "error");

    // Vérifier qu'on ne dépasse pas le don total
    const { data: existing } = await supabaseClient
        .from('donation_allocations').select('amount').eq('donation_id', donationId);
    const alreadyAllocated = (existing||[]).reduce((s,a) => s + parseFloat(a.amount||0), 0);
    if (alreadyAllocated + amount > parseFloat(donationAmount) + 0.01) {
        return window.showNotice("Erreur", `Dépassement : reste ${(parseFloat(donationAmount) - alreadyAllocated).toLocaleString('fr-FR')} € à répartir.`, "error");
    }

    const { error } = await supabaseClient.from('donation_allocations').insert([{
        donation_id: donationId, entity, amount, notes
    }]);
    if (error) return window.showNotice("Erreur", error.message, "error");
    window.showNotice("Ajouté ✅", `${amount.toLocaleString('fr-FR')} € → ${entity}`, "success");
    window.showDonationAllocationModal(donationId, donationAmount);
};

window.deleteAllocation = async (allocId, donationId, donationAmount) => {
    await supabaseClient.from('donation_allocations').delete().eq('id', allocId);
    window.showDonationAllocationModal(donationId, donationAmount);
};
