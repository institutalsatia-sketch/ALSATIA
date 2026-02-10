// =====================================================
// DM (CHAT PRIVÉ) - MODULE AUTONOME (sans toucher app.js)
// - Nom/Entité au-dessus de chaque bulle
// - Bubbles type WhatsApp
// - Badges non lus : menu Contacts + carte contact
// - Dès que la convo est ouverte => badges cleared
// - Realtime + fallback polling si realtime KO
// =====================================================

console.log('💬 DM.JS CHARGÉ');

(function () {
  const DM_LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
  };

  const LS_UNREAD_KEY = 'dm_unread_map_v1'; // { "<sender_profile_id>": number }
  const LS_CONTACT_CACHE_KEY = 'dm_contact_cache_v1'; // { "<profile_id>": {first_name,last_name,portal} }

  // ------------------------------
  // Helpers
  // ------------------------------
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const p = document.createElement('p');
    p.textContent = String(str);
    return p.innerHTML;
  }

  function getCurrentUser() {
    const s = localStorage.getItem('alsatia_user');
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }

  function getSupabaseClient() {
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    if (typeof window.supabaseClient !== 'undefined') return window.supabaseClient;
    return null;
  }

  function makeConversationKey(a, b) {
    const arr = [String(a), String(b)].sort();
    return `${arr[0]}:${arr[1]}`;
  }

  function scrollToBottom(el) {
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function isNearBottom(el) {
    if (!el) return true;
    return (el.scrollHeight - el.scrollTop - el.clientHeight) < 220;
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });
    } catch {
      return '';
    }
  }

  function resolveLogoSrc(portal) {
    return DM_LOGOS[String(portal || '')] || 'logo_alsatia.png';
  }

  function fullName(u) {
    const fn = (u?.first_name || '').trim();
    const ln = (u?.last_name || '').trim();
    const combined = `${fn} ${ln}`.trim();
    return combined || (u?.name || 'Utilisateur');
  }

  function getUnreadMap() {
    try {
      const raw = localStorage.getItem(LS_UNREAD_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return {};
      return obj;
    } catch {
      return {};
    }
  }

  function setUnreadMap(obj) {
    try { localStorage.setItem(LS_UNREAD_KEY, JSON.stringify(obj || {})); } catch {}
  }

  function incUnread(fromProfileId) {
    const me = getCurrentUser();
    if (!me) return;

    const map = getUnreadMap();
    const k = String(fromProfileId || '');
    if (!k) return;

    map[k] = (Number(map[k]) || 0) + 1;
    setUnreadMap(map);
    updateUnreadUI();
  }

  function clearUnreadFor(peerId) {
    const map = getUnreadMap();
    const k = String(peerId || '');
    if (!k) return;

    if (map[k]) {
      delete map[k];
      setUnreadMap(map);
      updateUnreadUI();
    }
  }

  function totalUnread() {
    const map = getUnreadMap();
    return Object.values(map).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  function getContactCache() {
    try {
      const raw = localStorage.getItem(LS_CONTACT_CACHE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return {};
      return obj;
    } catch {
      return {};
    }
  }

  function setContactCache(obj) {
    try { localStorage.setItem(LS_CONTACT_CACHE_KEY, JSON.stringify(obj || {})); } catch {}
  }

  function cacheContact(u) {
    if (!u?.id) return;
    const cache = getContactCache();
    cache[String(u.id)] = {
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      portal: u.portal || ''
    };
    setContactCache(cache);
  }

  async function fetchProfileMini(profileId) {
    const sb = getSupabaseClient();
    if (!sb || !profileId) return null;

    const { data, error } = await sb
      .from('profiles')
      .select('id, first_name, last_name, portal')
      .eq('id', profileId)
      .single();

    if (error) return null;
    return data || null;
  }

  // ------------------------------
  // Etat DM
  // ------------------------------
  let dmChannel = null;        // conversation live
  let dmInboxChannel = null;   // global inbox for unread
  let dmActivePeer = null;     // { id, first_name, last_name, portal }
  let dmConversationKey = null;
  let dmMessagesMap = new Map();

  // Fallback polling
  let dmPollTimer = null;
  let dmPollInFlight = false;

  function stopPolling() {
    if (dmPollTimer) {
      clearInterval(dmPollTimer);
      dmPollTimer = null;
    }
  }

  function unsubscribeConversation() {
    const sb = getSupabaseClient();
    if (!sb) return;

    stopPolling();

    if (dmChannel) {
      try { sb.removeChannel(dmChannel); } catch {}
      dmChannel = null;
    }
  }

  // Wrap closeCustomModal pour cleanup + stop realtime convo
  (function wrapCloseCustomModal() {
    if (typeof window.closeCustomModal !== 'function') return;
    const originalClose = window.closeCustomModal;
    if (originalClose.__dm_wrapped) return;

    function wrappedCloseCustomModal() {
      unsubscribeConversation();
      return originalClose();
    }
    wrappedCloseCustomModal.__dm_wrapped = true;
    window.closeCustomModal = wrappedCloseCustomModal;
  })();

  // ------------------------------
  // UI : badges non lus
  // ------------------------------
  function ensureNavBadge() {
    const nav = document.getElementById('nav-contacts');
    if (!nav) return null;

    let badge = nav.querySelector('.dm-nav-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'dm-nav-badge';
      badge.style.display = 'none';
      nav.appendChild(badge);
    }
    return badge;
  }

  function ensureCardBadge(card) {
    if (!card) return null;

    card.classList.add('dm-card-relative');

    let badge = card.querySelector('.dm-card-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'dm-card-badge';
      badge.textContent = '';
      card.appendChild(badge);
    }
    return badge;
  }

  function updateUnreadUI() {
    // Menu badge (total)
    const total = totalUnread();
    const navBadge = ensureNavBadge();
    if (navBadge) {
      if (total > 0) {
        navBadge.style.display = 'inline-flex';
        navBadge.textContent = String(total);
      } else {
        navBadge.style.display = 'none';
        navBadge.textContent = '';
      }
    }

    // Cards badges (per contact)
    const map = getUnreadMap();
    const grid = document.getElementById('contacts-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.contact-card');
    if (!cards || cards.length === 0) return;

    cards.forEach((card) => {
      const pid = card.dataset.profileId;
      const badge = ensureCardBadge(card);
      if (!badge) return;

      const count = pid ? (Number(map[String(pid)]) || 0) : 0;
      if (count > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = String(Math.min(count, 99));
      } else {
        badge.style.display = 'none';
        badge.textContent = '';
      }
    });
  }

  // ------------------------------
  // UI : ouvrir modale DM
  // ------------------------------
  async function openDMModal(peer) {
    const me = getCurrentUser();
    if (!me) {
      if (window.showNotice) window.showNotice('Erreur', 'Utilisateur non connecté.', 'error');
      return;
    }

    // compléter peer si on n'a pas tout (au cas où)
    let peerFull = peer;
    if (!peerFull.portal || !peerFull.first_name || !peerFull.last_name) {
      const cache = getContactCache();
      const cached = cache[String(peer.id)];
      if (cached) {
        peerFull = { ...peerFull, ...cached };
      } else {
        const fetched = await fetchProfileMini(peer.id);
        if (fetched) peerFull = fetched;
      }
    }

    dmActivePeer = peerFull;
    dmConversationKey = makeConversationKey(me.id, peerFull.id);
    dmMessagesMap = new Map();

    // Dès que la conversation est ouverte => clear unread pour ce contact
    clearUnreadFor(peerFull.id);

    const meName = escapeHTML(fullName(me));
    const peerName = escapeHTML(fullName(peerFull));
    const mePortal = escapeHTML(me.portal || '—');
    const peerPortal = escapeHTML(peerFull.portal || '—');

    const meLogo = escapeHTML(resolveLogoSrc(me.portal));
    const peerLogo = escapeHTML(resolveLogoSrc(peerFull.portal));

    const modalBody = document.getElementById('modal-body');
    const modal = document.getElementById('custom-modal');
    if (!modalBody || !modal) {
      console.error('DM: modal introuvable (#custom-modal / #modal-body)');
      return;
    }

    modalBody.innerHTML = `
      <div class="dm-header">
        <div class="dm-head-left">
          <h3 class="dm-title">
            <i data-lucide="message-circle" style="width:20px; height:20px; color:var(--gold);"></i>
            Conversation privée
          </h3>

          <div class="dm-identities">
            <div class="dm-chip me" title="Vous">
              <img class="dm-chip-logo" src="${meLogo}" alt="Logo ${mePortal}">
              <div class="dm-chip-text">
                <div class="dm-chip-name">${meName}</div>
                <div class="dm-chip-portal">${mePortal}</div>
              </div>
            </div>

            <div class="dm-chip" title="Contact">
              <img class="dm-chip-logo" src="${peerLogo}" alt="Logo ${peerPortal}">
              <div class="dm-chip-text">
                <div class="dm-chip-name">${peerName}</div>
                <div class="dm-chip-portal">${peerPortal}</div>
              </div>
            </div>
          </div>
        </div>

        <button class="dm-close-btn" onclick="window.closeCustomModal()" aria-label="Fermer">&times;</button>
      </div>

      <div class="dm-chat-shell">
        <div id="dm-messages" class="dm-messages">
          <div class="dm-empty">Chargement...</div>
        </div>

        <div class="dm-input-bar">
          <textarea id="dm-input" class="dm-input" placeholder="Écrire un message..." rows="1"></textarea>
          <button id="dm-send" class="dm-send-btn" title="Envoyer">
            <i data-lucide="send" style="width:18px; height:18px;"></i>
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; }, 10);

    if (window.lucide) lucide.createIcons();

    const input = document.getElementById('dm-input');
    const sendBtn = document.getElementById('dm-send');

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendCurrentMessage();
        }
      });

      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendCurrentMessage);

    await loadConversation();
    subscribeConversation();
  }

  // ------------------------------
  // Data : load conversation
  // ------------------------------
  async function loadConversation() {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    const peer = dmActivePeer;

    if (!sb || !me || !peer) return;

    const box = document.getElementById('dm-messages');
    if (box && dmMessagesMap.size === 0) box.innerHTML = `<div class="dm-empty">Chargement...</div>`;

    const { data, error } = await sb
      .from('dm_messages')
      .select('*')
      .eq('conversation_key', dmConversationKey)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('DM load error:', error);
      if (window.showNotice) window.showNotice('DM', 'Impossible de charger la conversation.', 'error');
      if (box) box.innerHTML = `<div class="dm-empty">Impossible de charger la conversation.</div>`;
      return;
    }

    const prevCount = dmMessagesMap.size;

    dmMessagesMap = new Map();
    (data || []).forEach((m) => dmMessagesMap.set(m.id, m));

    const container = document.getElementById('dm-messages');
    const keepBottom = container ? isNearBottom(container) : true;

    renderConversation({ keepScrollIfNearBottom: keepBottom });

    if (container && (prevCount === 0 || keepBottom)) {
      scrollToBottom(container);
    }
  }

  // ------------------------------
  // Poll fallback
  // ------------------------------
  function startPolling() {
    if (dmPollTimer) return;

    console.warn('🟠 DM realtime KO → fallback polling activé (2s)');
    dmPollTimer = setInterval(async () => {
      if (dmPollInFlight) return;
      dmPollInFlight = true;
      try {
        await loadConversation();
      } catch {} finally {
        dmPollInFlight = false;
      }
    }, 2000);
  }

  function stopPolling() {
    if (dmPollTimer) {
      clearInterval(dmPollTimer);
      dmPollTimer = null;
    }
  }

  // ------------------------------
  // Realtime: conversation
  // ------------------------------
  function subscribeConversation() {
    const sb = getSupabaseClient();
    if (!sb || !dmConversationKey) return;

    unsubscribeConversation();

    console.log('🔌 DM subscribe conversation…');

    dmChannel = sb
      .channel('dm-conversation-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.conversation_key !== dmConversationKey) return;

        if (payload.eventType === 'INSERT') {
          dmMessagesMap.set(payload.new.id, payload.new);
          renderConversation({ keepScrollIfNearBottom: true });

          // Si c'est un message entrant et qu'on a la convo ouverte, on clear l'unread (au cas où)
          const me = getCurrentUser();
          if (me && payload.new.receiver_profile_id === me.id && dmActivePeer && payload.new.sender_profile_id === dmActivePeer.id) {
            clearUnreadFor(dmActivePeer.id);
          }
        } else if (payload.eventType === 'UPDATE') {
          dmMessagesMap.set(payload.new.id, payload.new);
          renderConversation({ keepScrollIfNearBottom: true });
        } else if (payload.eventType === 'DELETE') {
          dmMessagesMap.delete(payload.old.id);
          renderConversation({ keepScrollIfNearBottom: true });
        }
      })
      .subscribe((status) => {
        console.log('🔌 DM realtime status (conversation):', status);
        if (status === 'SUBSCRIBED') stopPolling();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') startPolling();
      });

    setTimeout(() => {
      if (!dmPollTimer) startPolling();
    }, 3500);
  }

  // ------------------------------
  // Realtime: inbox (non lus)
  // - Toujours actif pour détecter messages entrants (même sans ouvrir la convo)
  // ------------------------------
  function ensureInboxSubscription() {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    if (!sb || !me) return;

    if (dmInboxChannel) return;

    console.log('📥 DM subscribe inbox…');

    dmInboxChannel = sb
      .channel('dm-inbox-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, async (payload) => {
        const row = payload.new;
        if (!row) return;

        // On ne compte que les messages reçus par moi
        if (row.receiver_profile_id !== me.id) return;

        // Si la conversation est ouverte avec cet expéditeur, on ne badge pas
        if (dmActivePeer && row.sender_profile_id === dmActivePeer.id) {
          // On considère comme "lu à l'ouverture"
          clearUnreadFor(dmActivePeer.id);
          return;
        }

        // Incrémenter unread pour l'expéditeur
        incUnread(row.sender_profile_id);

        // Optionnel: si on ne connaît pas l'expéditeur en cache, tenter de le fetch (pour affichage nom/entité ailleurs si besoin)
        const cache = getContactCache();
        if (!cache[String(row.sender_profile_id)]) {
          const prof = await fetchProfileMini(row.sender_profile_id);
          if (prof) cacheContact(prof);
        }
      })
      .subscribe((status) => {
        console.log('📥 DM realtime status (inbox):', status);
        // Pas de polling ici, seulement badges. Si ça rate, les badges ne seront pas realtime.
      });
  }

  // ------------------------------
  // Render conversation
  // ------------------------------
  function renderConversation(opts = {}) {
    const me = getCurrentUser();
    const peer = dmActivePeer;
    const container = document.getElementById('dm-messages');

    if (!me || !peer || !container) return;

    const wasNearBottom = isNearBottom(container);

    const messages = Array.from(dmMessagesMap.values()).sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return ta - tb;
    });

    if (messages.length === 0) {
      container.innerHTML = `<div class="dm-empty">Aucun message. Dites bonjour 👋</div>`;
      return;
    }

    container.innerHTML = messages.map((m) => renderMessageRow(m, me, peer)).join('');
    if (window.lucide) lucide.createIcons();

    if (opts.keepScrollIfNearBottom && wasNearBottom) {
      scrollToBottom(container);
    }
  }

  function renderAuthorLine(isMe, me, peer) {
    const name = escapeHTML(isMe ? fullName(me) : fullName(peer));
    const portal = escapeHTML(isMe ? (me.portal || '—') : (peer.portal || '—'));
    return `<div class="dm-authorline"><span>${name}</span><span class="dot"></span><span>${portal}</span></div>`;
  }

  function renderMessageRow(m, me, peer) {
    const isMe = m.sender_profile_id === me.id;

    const isDeleted = !!m.is_deleted;
    const content = isDeleted
      ? '<em style="opacity:0.65;">Message supprimé</em>'
      : escapeHTML(m.content);

    const edited = (m.updated_at && m.created_at && (new Date(m.updated_at).getTime() - new Date(m.created_at).getTime()) > 1500);
    const editedBadge = (!isDeleted && edited) ? `<span class="dm-edited">modifié</span>` : '';

    const actions = (isMe && !isDeleted) ? `
      <div class="dm-actions">
        <button class="dm-icon-btn" title="Modifier" onclick="window.dmStartEdit('${m.id}')">
          <i data-lucide="pencil" style="width:14px; height:14px;"></i>
        </button>
        <button class="dm-icon-btn danger" title="Supprimer" onclick="window.dmDeleteMessage('${m.id}')">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
        </button>
      </div>
    ` : '';

    const bubbleClass = isMe ? 'me' : 'them';
    const rowClass = isMe ? 'me' : 'them';

    return `
      <div class="dm-bubble-row ${rowClass}" id="dm-row-${m.id}">
        ${renderAuthorLine(isMe, me, peer)}
        <div class="dm-bubble ${bubbleClass}">
          <div class="dm-text" id="dm-text-${m.id}">${content}</div>
          <div class="dm-meta">
            <span>${formatTime(m.created_at)} ${editedBadge}</span>
            ${actions}
          </div>
        </div>
      </div>
    `;
  }

  // ------------------------------
  // Actions: send/edit/delete
  // ------------------------------
  async function sendCurrentMessage() {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    const peer = dmActivePeer;

    const input = document.getElementById('dm-input');
    if (!sb || !me || !peer || !input) return;

    const text = (input.value || '').trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    const payload = {
      sender_profile_id: me.id,
      receiver_profile_id: peer.id,
      conversation_key: dmConversationKey,
      content: text,
      is_deleted: false
    };

    const { error } = await sb.from('dm_messages').insert([payload]);
    if (error) {
      console.error('DM send error:', error);
      if (window.showNotice) window.showNotice('DM', 'Impossible d’envoyer.', 'error');
    }
  }

  window.dmStartEdit = function (messageId) {
    const me = getCurrentUser();
    if (!me) return;

    const m = dmMessagesMap.get(messageId);
    if (!m || m.sender_profile_id !== me.id || m.is_deleted) return;

    const textDiv = document.getElementById('dm-text-' + messageId);
    if (!textDiv) return;

    const original = m.content || '';

    textDiv.innerHTML = `
      <textarea class="dm-edit-area" id="dm-edit-${messageId}">${escapeHTML(original)}</textarea>
      <div class="dm-edit-actions">
        <button class="dm-mini-btn cancel" onclick="window.dmCancelEdit('${messageId}')">Annuler</button>
        <button class="dm-mini-btn save" onclick="window.dmSaveEdit('${messageId}')">Enregistrer</button>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    const ta = document.getElementById('dm-edit-' + messageId);
    if (ta) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  };

  window.dmCancelEdit = function (messageId) {
    const m = dmMessagesMap.get(messageId);
    const me = getCurrentUser();
    if (!m || !me) return;

    const textDiv = document.getElementById('dm-text-' + messageId);
    if (!textDiv) return;

    textDiv.innerHTML = escapeHTML(m.content || '');
  };

  window.dmSaveEdit = async function (messageId) {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    const m = dmMessagesMap.get(messageId);

    if (!sb || !me || !m || m.sender_profile_id !== me.id || m.is_deleted) return;

    const ta = document.getElementById('dm-edit-' + messageId);
    if (!ta) return;

    const newText = (ta.value || '').trim();
    if (!newText) {
      if (window.showNotice) window.showNotice('DM', 'Le message ne peut pas être vide.', 'warning');
      return;
    }

    const { error } = await sb.from('dm_messages').update({ content: newText }).eq('id', messageId);
    if (error) {
      console.error('DM edit error:', error);
      if (window.showNotice) window.showNotice('DM', 'Impossible de modifier.', 'error');
    }
  };

  window.dmDeleteMessage = function (messageId) {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    const m = dmMessagesMap.get(messageId);

    if (!sb || !me || !m || m.sender_profile_id !== me.id || m.is_deleted) return;

    if (typeof window.alsatiaConfirm === 'function') {
      window.alsatiaConfirm(
        'SUPPRIMER LE MESSAGE',
        'Voulez-vous vraiment supprimer ce message ?',
        async () => {
          const { error } = await sb.from('dm_messages').update({ is_deleted: true, content: '' }).eq('id', messageId);
          if (error) {
            console.error('DM delete error:', error);
            if (window.showNotice) window.showNotice('DM', 'Impossible de supprimer.', 'error');
          }
        },
        true
      );
    } else {
      console.error('DM: alsatiaConfirm indisponible, suppression refusée.');
      if (window.showNotice) window.showNotice('DM', 'Suppression indisponible.', 'error');
    }
  };

  // ------------------------------
  // Integration Contacts: bouton + badges
  // - wrap renderContacts(users) sans modifier app.js
  // ------------------------------
  function injectDMButtonsAndBadges(users) {
    const me = getCurrentUser();
    const grid = document.getElementById('contacts-grid');
    if (!grid || !Array.isArray(users) || users.length === 0) return;

    const cards = grid.querySelectorAll('.contact-card');
    if (!cards || cards.length === 0) return;

    for (let i = 0; i < Math.min(cards.length, users.length); i++) {
      const u = users[i];
      const card = cards[i];
      if (!u || !card) continue;

      // lier carte -> user id pour badges
      card.dataset.profileId = String(u.id || '');

      // cache contact mini pour header DM & author lines
      cacheContact(u);

      // badge sur carte
      ensureCardBadge(card);

      // ne pas proposer un DM avec soi-même
      if (me && u.id === me.id) continue;

      // éviter double injection bouton
      if (!card.querySelector('.dm-contact-btn')) {
        const btn = document.createElement('button');
        btn.className = 'dm-contact-btn';
        btn.type = 'button';
        btn.innerHTML = `
          <i data-lucide="message-circle" style="width:18px; height:18px;"></i>
          MESSAGE PRIVÉ
        `;

        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          await openDMModal({
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            portal: u.portal
          });

          // dès ouverture => retirer badge carte + menu
          updateUnreadUI();
        });

        card.appendChild(btn);
      }
    }

    if (window.lucide) lucide.createIcons();

    // appliquer les badges actuels
    updateUnreadUI();
  }

  function hookRenderContacts() {
    if (typeof window.renderContacts !== 'function') return false;

    const original = window.renderContacts;
    if (original.__dm_wrapped) return true;

    function wrappedRenderContacts(users) {
      original(users);
      injectDMButtonsAndBadges(users);
    }
    wrappedRenderContacts.__dm_wrapped = true;
    window.renderContacts = wrappedRenderContacts;
    return true;
  }

  // ------------------------------
  // Init
  // ------------------------------
  const tryHook = () => {
    const ok = hookRenderContacts();
    if (!ok) setTimeout(tryHook, 60);
  };
  tryHook();

  // badge nav prêt au chargement
  ensureNavBadge();
  updateUnreadUI();

  // inbox realtime pour non-lus (dès que l'utilisateur est présent)
  const tryInbox = () => {
    const me = getCurrentUser();
    const sb = getSupabaseClient();
    if (!me || !sb) return setTimeout(tryInbox, 120);

    ensureInboxSubscription();
  };
  tryInbox();

})();
