// =====================================================
// DM (CHAT PRIVÉ) - MODULE AUTONOME (sans toucher app.js)
// - Nom/Entité au-dessus de chaque bulle
// - Bubbles type WhatsApp (CSS)
// - Badges non lus : menu Contacts + carte contact
// - Clear dès ouverture de la conversation
// - Realtime conversation + fallback polling
// - Inbox non-lus : POLLING ROBUSTE (3s) + Realtime si dispo
//
// FIX IMPORTANT:
// - Plus de resubscribe automatique sur CLOSED (évite "channels fantômes")
// - CLOSED volontaire (close modal) ignoré
// =====================================================

console.log('💬 DM.JS CHARGÉ (FIX v3)');

(function () {
  const DM_LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
  };

  const LS_UNREAD_KEY = 'dm_unread_map_v1';      // { "<sender_profile_id>": number }
  const LS_SEEN_KEY   = 'dm_last_seen_v1';       // { "<peer_profile_id>": "ISO timestamp" }
  const LS_INBOX_KEY  = 'dm_inbox_last_check_v1';// "ISO timestamp"
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

  function nowISO() {
    return new Date().toISOString();
  }

  function parseISO(iso) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  // ------------------------------
  // Storage: unread
  // ------------------------------
  function getUnreadMap() {
    try {
      const raw = localStorage.getItem(LS_UNREAD_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch {
      return {};
    }
  }

  function setUnreadMap(obj) {
    try { localStorage.setItem(LS_UNREAD_KEY, JSON.stringify(obj || {})); } catch {}
  }

  function totalUnread() {
    const map = getUnreadMap();
    return Object.values(map).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  function incUnread(fromProfileId) {
    const k = String(fromProfileId || '');
    if (!k) return;

    const map = getUnreadMap();
    map[k] = (Number(map[k]) || 0) + 1;
    setUnreadMap(map);
    updateUnreadUI();
  }

  function clearUnreadFor(peerId) {
    const k = String(peerId || '');
    if (!k) return;

    const map = getUnreadMap();
    if (map[k]) {
      delete map[k];
      setUnreadMap(map);
    }
    updateUnreadUI();
  }

  // ------------------------------
  // Storage: last seen per peer
  // ------------------------------
  function getSeenMap() {
    try {
      const raw = localStorage.getItem(LS_SEEN_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch {
      return {};
    }
  }

  function setSeenMap(obj) {
    try { localStorage.setItem(LS_SEEN_KEY, JSON.stringify(obj || {})); } catch {}
  }

  function setSeen(peerId, iso) {
    const k = String(peerId || '');
    if (!k) return;
    const map = getSeenMap();
    map[k] = iso || nowISO();
    setSeenMap(map);
  }

  function getSeen(peerId) {
    const map = getSeenMap();
    const iso = map[String(peerId || '')];
    return iso || null;
  }

  // ------------------------------
  // Contact cache
  // ------------------------------
  function getContactCache() {
    try {
      const raw = localStorage.getItem(LS_CONTACT_CACHE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
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
  // UI: badges
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
    const total = totalUnread();
    const navBadge = ensureNavBadge();
    if (navBadge) {
      if (total > 0) {
        navBadge.style.display = 'inline-flex';
        navBadge.textContent = String(Math.min(total, 99));
      } else {
        navBadge.style.display = 'none';
        navBadge.textContent = '';
      }
    }

    const grid = document.getElementById('contacts-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.contact-card');
    if (!cards || cards.length === 0) return;

    const map = getUnreadMap();
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

  // wrap switchTab → refresh badges quand on ouvre Contacts
  (function wrapSwitchTab() {
    if (typeof window.switchTab !== 'function') return;
    const orig = window.switchTab;
    if (orig.__dm_wrapped) return;

    function wrapped(tab) {
      const r = orig(tab);
      if (tab === 'contacts') setTimeout(updateUnreadUI, 80);
      return r;
    }

    wrapped.__dm_wrapped = true;
    window.switchTab = wrapped;
  })();

  // ------------------------------
  // DM state
  // ------------------------------
  let dmChannel = null;
  let dmActivePeer = null;
  let dmConversationKey = null;
  let dmMessagesMap = new Map();

  // Conversation realtime/poll
  let dmPollTimer = null;
  let dmPollInFlight = false;

  // Inbox poll
  let inboxPollTimer = null;
  let inboxPollInFlight = false;

  // Inbox realtime
  let dmInboxChannel = null;

  // Flags pour éviter les “channels fantômes”
  let dmModalOpen = false;
  let dmClosing = false;

  function startConversationPolling() {
    if (dmPollTimer) return;
    dmPollTimer = setInterval(async () => {
      if (dmPollInFlight) return;
      dmPollInFlight = true;
      try { await loadConversation(); } catch {} finally { dmPollInFlight = false; }
    }, 2000);
  }

  function stopConversationPolling() {
    if (dmPollTimer) {
      clearInterval(dmPollTimer);
      dmPollTimer = null;
    }
  }

  function unsubscribeConversation() {
    const sb = getSupabaseClient();
    if (!sb) return;

    stopConversationPolling();

    if (dmChannel) {
      try {
        dmClosing = true;          // <- IMPORTANT
        sb.removeChannel(dmChannel);
      } catch {}
      dmChannel = null;
      setTimeout(() => { dmClosing = false; }, 300); // laisser le temps au status CLOSED
    }
  }

  // wrap closeCustomModal → cleanup propre
  (function wrapCloseCustomModal() {
    if (typeof window.closeCustomModal !== 'function') return;
    const originalClose = window.closeCustomModal;
    if (originalClose.__dm_wrapped) return;

    function wrappedCloseCustomModal() {
      dmModalOpen = false;
      unsubscribeConversation();
      return originalClose();
    }
    wrappedCloseCustomModal.__dm_wrapped = true;
    window.closeCustomModal = wrappedCloseCustomModal;
  })();

  // ------------------------------
  // Conversation UI
  // ------------------------------
  async function openDMModal(peer) {
    const me = getCurrentUser();
    if (!me) {
      if (window.showNotice) window.showNotice('Erreur', 'Utilisateur non connecté.', 'error');
      return;
    }

    dmModalOpen = true;

    // compléter peer si besoin
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

    // lu à l'ouverture
    setSeen(peerFull.id, nowISO());
    clearUnreadFor(peerFull.id);

    const meName = escapeHTML(fullName(me));
    const peerName = escapeHTML(fullName(peerFull));
    const mePortal = escapeHTML(me.portal || '—');
    const peerPortal = escapeHTML(peerFull.portal || '—');
    const meLogo = escapeHTML(resolveLogoSrc(me.portal));
    const peerLogo = escapeHTML(resolveLogoSrc(peerFull.portal));

    const modalBody = document.getElementById('modal-body');
    const modal = document.getElementById('custom-modal');
    if (!modalBody || !modal) return;

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

    if (error) return;

    const prevCount = dmMessagesMap.size;
    dmMessagesMap = new Map();
    (data || []).forEach((m) => dmMessagesMap.set(m.id, m));

    const container = document.getElementById('dm-messages');
    const keepBottom = container ? isNearBottom(container) : true;

    renderConversation({ keepScrollIfNearBottom: keepBottom });
    if (container && (prevCount === 0 || keepBottom)) scrollToBottom(container);
  }

  // IMPORTANT : pas de resubscribe automatique sur CLOSED
  function subscribeConversation() {
    const sb = getSupabaseClient();
    if (!sb || !dmConversationKey) return;

    unsubscribeConversation();

    console.log('🔌 DM subscribe conversation…');

    // channel name unique par conversation (évite collisions)
    const channelName = `dm-conv:${dmConversationKey}`;

    // watchdog : si pas SUBSCRIBED → polling
    let watchdog = setTimeout(() => {
      if (dmModalOpen) startConversationPolling();
    }, 3500);

    dmChannel = sb
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.conversation_key !== dmConversationKey) return;

        if (payload.eventType === 'INSERT') {
          dmMessagesMap.set(payload.new.id, payload.new);
          renderConversation({ keepScrollIfNearBottom: true });

          const me = getCurrentUser();
          if (me && dmActivePeer && payload.new.receiver_profile_id === me.id && payload.new.sender_profile_id === dmActivePeer.id) {
            setSeen(dmActivePeer.id, nowISO());
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

        if (watchdog) { clearTimeout(watchdog); watchdog = null; }

        if (status === 'SUBSCRIBED') {
          stopConversationPolling();
          return;
        }

        // CLOSED provoqué volontairement (close modal) → ignorer
        if (status === 'CLOSED' && (dmClosing || !dmModalOpen)) return;

        // sinon : fallback polling
        if (dmModalOpen) startConversationPolling();
      });
  }

  function renderConversation(opts = {}) {
    const me = getCurrentUser();
    const peer = dmActivePeer;
    const container = document.getElementById('dm-messages');
    if (!me || !peer || !container) return;

    const wasNearBottom = isNearBottom(container);

    const messages = Array.from(dmMessagesMap.values()).sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    if (messages.length === 0) {
      container.innerHTML = `<div class="dm-empty">Aucun message. Dites bonjour 👋</div>`;
      return;
    }

    container.innerHTML = messages.map((m) => renderMessageRow(m, me, peer)).join('');
    if (window.lucide) lucide.createIcons();

    if (opts.keepScrollIfNearBottom && wasNearBottom) scrollToBottom(container);
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
    if (error) console.error('DM send error:', error);
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
    if (!m) return;

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
    if (!newText) return;

    const { error } = await sb.from('dm_messages').update({ content: newText }).eq('id', messageId);
    if (error) console.error('DM edit error:', error);
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
          if (error) console.error('DM delete error:', error);
        },
        true
      );
    }
  };

  // ------------------------------
  // Contacts integration (bouton + dataset id + badges)
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

      card.dataset.profileId = String(u.id || '');
      cacheContact(u);
      ensureCardBadge(card);

      if (me && u.id === me.id) continue;

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
          updateUnreadUI();
        });

        card.appendChild(btn);
      }
    }

    if (window.lucide) lucide.createIcons();
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
  // Inbox detection: polling + realtime
  // ------------------------------
  function getInboxLastCheck() {
    const raw = localStorage.getItem(LS_INBOX_KEY);
    return raw || null;
  }

  function setInboxLastCheck(iso) {
    try { localStorage.setItem(LS_INBOX_KEY, iso); } catch {}
  }

  function initInboxCursor() {
    const existing = getInboxLastCheck();
    if (!existing) setInboxLastCheck(nowISO());
  }

  async function inboxPollOnce() {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    if (!sb || !me) return;

    const lastISO = getInboxLastCheck() || nowISO();
    const lastT = parseISO(lastISO);
    if (!lastT) return;

    const { data, error } = await sb
      .from('dm_messages')
      .select('id, sender_profile_id, receiver_profile_id, created_at')
      .eq('receiver_profile_id', me.id)
      .gt('created_at', new Date(lastT).toISOString())
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) return;

    const rows = data || [];
    if (rows.length === 0) return;

    const newestISO = rows[rows.length - 1].created_at;
    setInboxLastCheck(newestISO);

    for (const r of rows) {
      const from = r.sender_profile_id;

      if (dmModalOpen && dmActivePeer && String(dmActivePeer.id) === String(from)) {
        setSeen(dmActivePeer.id, nowISO());
        clearUnreadFor(dmActivePeer.id);
        continue;
      }

      const seenISO = getSeen(from);
      if (seenISO && parseISO(r.created_at) <= parseISO(seenISO)) continue;

      incUnread(from);

      const cache = getContactCache();
      if (!cache[String(from)]) {
        const prof = await fetchProfileMini(from);
        if (prof) cacheContact(prof);
      }
    }
  }

  function startInboxPolling() {
    if (inboxPollTimer) return;

    inboxPollTimer = setInterval(async () => {
      if (inboxPollInFlight) return;
      inboxPollInFlight = true;
      try { await inboxPollOnce(); } catch {} finally { inboxPollInFlight = false; }
    }, 3000);
  }

  function ensureInboxRealtime() {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    if (!sb || !me) return;
    if (dmInboxChannel) return;

    dmInboxChannel = sb
      .channel('dm-inbox-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, async (payload) => {
        const row = payload.new;
        if (!row) return;
        if (row.receiver_profile_id !== me.id) return;

        setInboxLastCheck(row.created_at);

        if (dmModalOpen && dmActivePeer && String(dmActivePeer.id) === String(row.sender_profile_id)) {
          setSeen(dmActivePeer.id, nowISO());
          clearUnreadFor(dmActivePeer.id);
          return;
        }

        const seenISO = getSeen(row.sender_profile_id);
        if (seenISO && parseISO(row.created_at) <= parseISO(seenISO)) return;

        incUnread(row.sender_profile_id);

        const cache = getContactCache();
        if (!cache[String(row.sender_profile_id)]) {
          const prof = await fetchProfileMini(row.sender_profile_id);
          if (prof) cacheContact(prof);
        }
      })
      .subscribe(() => {});
  }

  // ------------------------------
  // Init
  // ------------------------------
  const tryHook = () => {
    const ok = hookRenderContacts();
    if (!ok) setTimeout(tryHook, 60);
  };
  tryHook();

  ensureNavBadge();
  updateUnreadUI();

  initInboxCursor();
  startInboxPolling();

  const tryInboxRT = () => {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    if (!sb || !me) return setTimeout(tryInboxRT, 150);
    ensureInboxRealtime();
  };
  tryInboxRT();

})();
