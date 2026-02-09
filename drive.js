// =====================================================
// DRIVE ALSATIA PREMIUM - MODULE AUTONOME
// =====================================================

console.log('🚀 DRIVE.JS CHARGÉ');

// Variables globales
let currentFolderId = null;
let currentPath = [];
let allItems = [];
let currentView = 'list'; // 'list' ou 'grid'
let currentEntity = null;
let currentUser = null;

// =====================================================
// INITIALISATION
// =====================================================

async function initDrive() {
    try {
        // Récupérer l'utilisateur depuis localStorage
        const userStr = localStorage.getItem('alsatia_user');
        if (!userStr) {
            showDriveError('Utilisateur non connecté');
            return;
        }
        
        currentUser = JSON.parse(userStr);
        currentEntity = currentUser.portal;
        
        // Charger la racine de l'entité
        await loadRootFolder();
        
    } catch (error) {
        console.error('❌ Erreur init Drive:', error);
        showDriveError('Erreur lors de l\'initialisation du Drive');
    }
}

// =====================================================
// CHARGEMENT DES DOSSIERS
// =====================================================

async function loadRootFolder() {
    try {
        // Charger le dossier racine de l'entité
        const { data, error } = await supabaseClient
            .from('drive_items')
            .select('*')
            .eq('entity', currentEntity)
            .is('parent_id', null)
            .eq('type', 'folder')
            .single();
        
        if (error) throw error;
        
        if (!data) {
            // Créer le dossier racine s'il n'existe pas
            const { data: newRoot, error: createError } = await supabaseClient
                .from('drive_items')
                .insert([{
                    name: currentEntity,
                    type: 'folder',
                    entity: currentEntity,
                    parent_id: null
                }])
                .select()
                .single();
            
            if (createError) throw createError;
            currentFolderId = newRoot.id;
        } else {
            currentFolderId = data.id;
        }
        
        currentPath = [{ id: currentFolderId, name: currentEntity }];
        await loadFolder(currentFolderId);
        
    } catch (error) {
        console.error('❌ Erreur loadRootFolder:', error);
        showDriveError('Impossible de charger le dossier racine');
    }
}

async function loadFolder(folderId) {
    try {
        showDriveLoading();
        
        // Charger tous les items du dossier
        const { data, error } = await supabaseClient
            .from('drive_items')
            .select(`
                *,
                uploaded_by:profiles!drive_items_uploaded_by_fkey(first_name, last_name)
            `)
            .eq('parent_id', folderId)
            .order('type', { ascending: false }) // Dossiers en premier
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        allItems = data || [];
        currentFolderId = folderId;
        
        renderDrive();
        
    } catch (error) {
        console.error('❌ Erreur loadFolder:', error);
        showDriveError('Impossible de charger le dossier');
    }
}

// =====================================================
// RENDU DE L'INTERFACE
// =====================================================

function renderDrive() {
    renderBreadcrumb();
    renderToolbar();
    
    if (currentView === 'list') {
        renderListView();
    } else {
        renderGridView();
    }
}

function renderBreadcrumb() {
    const breadcrumb = document.getElementById('drive-breadcrumb');
    if (!breadcrumb) return;
    
    breadcrumb.innerHTML = currentPath.map((folder, index) => `
        <span class="breadcrumb-item ${index === currentPath.length - 1 ? 'active' : ''}" 
              onclick="${index < currentPath.length - 1 ? `navigateToFolder('${folder.id}', ${index})` : ''}">
            ${index === 0 ? '🏠' : ''} ${folder.name}
        </span>
        ${index < currentPath.length - 1 ? '<span class="breadcrumb-separator">›</span>' : ''}
    `).join('');
}

function renderToolbar() {
    const toolbar = document.getElementById('drive-toolbar');
    if (!toolbar) return;
    
    toolbar.innerHTML = `
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button onclick="createNewFolder()" class="drive-btn-primary">
                <i data-lucide="folder-plus" style="width:16px; height:16px;"></i>
                Nouveau dossier
            </button>
            
            <label class="drive-btn-primary" style="cursor:pointer;">
                <i data-lucide="upload" style="width:16px; height:16px;"></i>
                Importer
                <input type="file" id="drive-file-input" multiple style="display:none;" onchange="handleFileUpload(event)">
            </label>
            
            <div style="flex:1;"></div>
            
            <input type="text" id="drive-search" placeholder="🔍 Rechercher..." 
                   style="padding:8px 12px; border:2px solid var(--border); border-radius:8px; width:250px;"
                   oninput="handleSearch(event)">
            
            <button onclick="toggleView()" class="drive-btn-secondary" title="Changer la vue">
                <i data-lucide="${currentView === 'list' ? 'grid-3x3' : 'list'}" style="width:16px; height:16px;"></i>
            </button>
        </div>
    `;
    
    lucide.createIcons();
}

function renderListView() {
    const container = document.getElementById('drive-content');
    if (!container) return;
    
    if (allItems.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px; color:var(--text-muted);">
                <i data-lucide="folder-open" style="width:64px; height:64px; margin-bottom:20px; opacity:0.3;"></i>
                <p style="font-size:1.1rem; margin-bottom:10px;">Ce dossier est vide</p>
                <p style="font-size:0.9rem;">Créez un dossier ou importez des fichiers</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = `
        <table class="drive-table">
            <thead>
                <tr>
                    <th style="width:40%;">Nom</th>
                    <th style="width:15%;">Taille</th>
                    <th style="width:20%;">Modifié</th>
                    <th style="width:15%;">Propriétaire</th>
                    <th style="width:10%;"></th>
                </tr>
            </thead>
            <tbody>
                ${allItems.map(item => renderListItem(item)).join('')}
            </tbody>
        </table>
    `;
    
    lucide.createIcons();
}

function renderListItem(item) {
    const isFolder = item.type === 'folder';
    const icon = isFolder ? 'folder' : getFileIcon(item.mime_type);
    const size = isFolder ? '-' : formatFileSize(item.file_size);
    const date = new Date(item.updated_at).toLocaleDateString('fr-FR');
    const owner = item.uploaded_by ? `${item.uploaded_by.first_name} ${item.uploaded_by.last_name}` : '-';
    
    return `
        <tr class="drive-item" onclick="${isFolder ? `openFolder('${item.id}', '${item.name}')` : `previewFile('${item.id}')`}">
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <i data-lucide="${icon}" style="width:20px; height:20px; color:${isFolder ? 'var(--gold)' : '#64748b'};"></i>
                    <span style="font-weight:500;">${item.name}</span>
                </div>
            </td>
            <td>${size}</td>
            <td>${date}</td>
            <td>${owner}</td>
            <td>
                <div class="drive-actions" onclick="event.stopPropagation();">
                    ${!isFolder ? `
                        <button onclick="downloadFile('${item.id}')" class="drive-action-btn" title="Télécharger">
                            <i data-lucide="download" style="width:14px; height:14px;"></i>
                        </button>
                    ` : ''}
                    <button onclick="showItemMenu('${item.id}', event)" class="drive-action-btn" title="Plus d'options">
                        <i data-lucide="more-vertical" style="width:14px; height:14px;"></i>
                    </button>
                    <button onclick="deleteItem('${item.id}', '${item.name}', '${item.type}')" class="drive-action-btn" title="Supprimer">
                        <i data-lucide="trash-2" style="width:14px; height:14px; color:#ef4444;"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function renderGridView() {
    const container = document.getElementById('drive-content');
    if (!container) return;
    
    if (allItems.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px; color:var(--text-muted);">
                <i data-lucide="folder-open" style="width:64px; height:64px; margin-bottom:20px; opacity:0.3;"></i>
                <p style="font-size:1.1rem; margin-bottom:10px;">Ce dossier est vide</p>
                <p style="font-size:0.9rem;">Créez un dossier ou importez des fichiers</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = `
        <div class="drive-grid">
            ${allItems.map(item => renderGridItem(item)).join('')}
        </div>
    `;
    
    lucide.createIcons();
}

function renderGridItem(item) {
    const isFolder = item.type === 'folder';
    const icon = isFolder ? 'folder' : getFileIcon(item.mime_type);
    const iconColor = isFolder ? 'var(--gold)' : '#64748b';
    
    return `
        <div class="drive-grid-item" onclick="${isFolder ? `openFolder('${item.id}', '${item.name}')` : `previewFile('${item.id}')`}">
            <div class="drive-grid-icon">
                <i data-lucide="${icon}" style="width:48px; height:48px; color:${iconColor};"></i>
            </div>
            <div class="drive-grid-name" title="${item.name}">${item.name}</div>
            <div class="drive-grid-actions" onclick="event.stopPropagation();">
                ${!isFolder ? `
                    <button onclick="downloadFile('${item.id}')" class="drive-action-btn" title="Télécharger">
                        <i data-lucide="download" style="width:14px; height:14px;"></i>
                    </button>
                ` : ''}
                <button onclick="deleteItem('${item.id}', '${item.name}', '${item.type}')" class="drive-action-btn" title="Supprimer">
                    <i data-lucide="trash-2" style="width:14px; height:14px; color:#ef4444;"></i>
                </button>
            </div>
        </div>
    `;
}

// =====================================================
// NAVIGATION
// =====================================================

window.navigateToFolder = async (folderId, pathIndex) => {
    currentPath = currentPath.slice(0, pathIndex + 1);
    await loadFolder(folderId);
};

window.openFolder = async (folderId, folderName) => {
    currentPath.push({ id: folderId, name: folderName });
    await loadFolder(folderId);
};

window.toggleView = () => {
    currentView = currentView === 'list' ? 'grid' : 'list';
    renderDrive();
};

// =====================================================
// CRÉATION DE DOSSIER
// =====================================================

window.createNewFolder = async () => {
    const folderName = prompt('Nom du nouveau dossier :');
    if (!folderName || folderName.trim() === '') return;
    
    try {
        const { data, error } = await supabaseClient
            .from('drive_items')
            .insert([{
                name: folderName.trim(),
                type: 'folder',
                entity: currentEntity,
                parent_id: currentFolderId,
                uploaded_by: currentUser.id
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        showDriveSuccess(`Dossier "${folderName}" créé`);
        await loadFolder(currentFolderId);
        
    } catch (error) {
        console.error('❌ Erreur création dossier:', error);
        showDriveError('Impossible de créer le dossier');
    }
};

// =====================================================
// UPLOAD DE FICHIERS
// =====================================================

window.handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const uploadContainer = document.getElementById('drive-upload-progress');
    if (uploadContainer) {
        uploadContainer.style.display = 'block';
    }
    
    for (let i = 0; i < files.length; i++) {
        await uploadFile(files[i], i + 1, files.length);
    }
    
    if (uploadContainer) {
        uploadContainer.style.display = 'none';
    }
    
    // Reset input
    event.target.value = '';
    
    await loadFolder(currentFolderId);
};

async function uploadFile(file, current, total) {
    try {
        // Vérifier la taille (50 MB max)
        if (file.size > 52428800) {
            showDriveError(`${file.name} : Fichier trop volumineux (max 50 MB)`);
            return;
        }
        
        updateUploadProgress(`Upload ${current}/${total} : ${file.name}`, (current / total) * 100);
        
        // Générer nom de fichier unique
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const filePath = `${currentEntity}/${currentFolderId}/${fileName}`;
        
        // Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('drive-files')
            .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Récupérer l'URL publique
        const { data: urlData } = supabaseClient.storage
            .from('drive-files')
            .getPublicUrl(filePath);
        
        // Créer l'entrée en base
        const { data, error } = await supabaseClient
            .from('drive_items')
            .insert([{
                name: file.name,
                type: 'file',
                entity: currentEntity,
                parent_id: currentFolderId,
                file_url: urlData.publicUrl,
                file_size: file.size,
                mime_type: file.type,
                uploaded_by: currentUser.id
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        // Créer la version initiale
        await supabaseClient
            .from('drive_file_versions')
            .insert([{
                file_id: data.id,
                version: 1,
                file_url: urlData.publicUrl,
                file_size: file.size,
                uploaded_by: currentUser.id
            }]);
        
        showDriveSuccess(`${file.name} uploadé`);
        
    } catch (error) {
        console.error('❌ Erreur upload:', error);
        showDriveError(`Erreur upload ${file.name}`);
    }
}

function updateUploadProgress(message, percent) {
    const progressEl = document.getElementById('drive-upload-text');
    const barEl = document.getElementById('drive-upload-bar');
    
    if (progressEl) progressEl.innerText = message;
    if (barEl) barEl.style.width = `${percent}%`;
}

// =====================================================
// TÉLÉCHARGEMENT DE FICHIERS
// =====================================================

window.downloadFile = async (itemId) => {
    try {
        const item = allItems.find(i => i.id === itemId);
        if (!item || !item.file_url) return;
        
        const response = await fetch(item.file_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showDriveSuccess(`${item.name} téléchargé`);
        
    } catch (error) {
        console.error('❌ Erreur téléchargement:', error);
        showDriveError('Erreur lors du téléchargement');
    }
};

// =====================================================
// SUPPRESSION
// =====================================================

window.deleteItem = async (itemId, itemName, itemType) => {
    const confirmMsg = itemType === 'folder' 
        ? `Supprimer le dossier "${itemName}" et tout son contenu ?`
        : `Supprimer le fichier "${itemName}" ?`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
        const item = allItems.find(i => i.id === itemId);
        
        // Si fichier, supprimer du storage
        if (itemType === 'file' && item.file_url) {
            const urlParts = item.file_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `${currentEntity}/${currentFolderId}/${fileName}`;
            
            await supabaseClient.storage
                .from('drive-files')
                .remove([filePath]);
        }
        
        // Supprimer de la base (CASCADE supprimera les enfants)
        const { error } = await supabaseClient
            .from('drive_items')
            .delete()
            .eq('id', itemId);
        
        if (error) throw error;
        
        showDriveSuccess(`${itemName} supprimé`);
        await loadFolder(currentFolderId);
        
    } catch (error) {
        console.error('❌ Erreur suppression:', error);
        showDriveError('Impossible de supprimer l\'élément');
    }
};

// =====================================================
// PRÉVISUALISATION
// =====================================================

window.previewFile = async (itemId) => {
    try {
        const item = allItems.find(i => i.id === itemId);
        if (!item) return;
        
        const modal = document.getElementById('drive-preview-modal');
        if (!modal) return;
        
        const content = document.getElementById('drive-preview-content');
        const title = document.getElementById('drive-preview-title');
        
        title.innerText = item.name;
        
        // Prévisualisation selon le type
        if (item.mime_type.startsWith('image/')) {
            content.innerHTML = `<img src="${item.file_url}" style="max-width:100%; max-height:70vh; object-fit:contain;">`;
        } else if (item.mime_type === 'application/pdf') {
            content.innerHTML = `<iframe src="${item.file_url}" style="width:100%; height:70vh; border:none;"></iframe>`;
        } else {
            content.innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <i data-lucide="file" style="width:64px; height:64px; margin-bottom:20px; opacity:0.3;"></i>
                    <p>Prévisualisation non disponible pour ce type de fichier</p>
                    <button onclick="downloadFile('${item.id}')" class="drive-btn-primary" style="margin-top:20px;">
                        <i data-lucide="download" style="width:16px; height:16px;"></i>
                        Télécharger
                    </button>
                </div>
            `;
        }
        
        modal.style.display = 'flex';
        lucide.createIcons();
        
        // Charger les commentaires
        await loadComments(itemId);
        
    } catch (error) {
        console.error('❌ Erreur prévisualisation:', error);
        showDriveError('Impossible d\'afficher le fichier');
    }
};

window.closePreview = () => {
    const modal = document.getElementById('drive-preview-modal');
    if (modal) modal.style.display = 'none';
};

// =====================================================
// COMMENTAIRES
// =====================================================

let currentPreviewItemId = null;

async function loadComments(itemId) {
    currentPreviewItemId = itemId;
    
    try {
        const { data, error } = await supabaseClient
            .from('drive_comments')
            .select(`
                *,
                user:profiles!drive_comments_user_id_fkey(first_name, last_name)
            `)
            .eq('item_id', itemId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        const container = document.getElementById('drive-comments-list');
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Aucun commentaire</p>';
            return;
        }
        
        container.innerHTML = data.map(c => `
            <div style="padding:12px; background:#f8fafc; border-radius:8px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <strong>${c.user.first_name} ${c.user.last_name}</strong>
                    <span style="font-size:0.85rem; color:var(--text-muted);">${new Date(c.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <p style="margin:0;">${c.comment}</p>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('❌ Erreur chargement commentaires:', error);
    }
}

window.addComment = async () => {
    const input = document.getElementById('drive-comment-input');
    if (!input || !input.value.trim()) return;
    
    try {
        const { error } = await supabaseClient
            .from('drive_comments')
            .insert([{
                item_id: currentPreviewItemId,
                user_id: currentUser.id,
                comment: input.value.trim()
            }]);
        
        if (error) throw error;
        
        input.value = '';
        await loadComments(currentPreviewItemId);
        
    } catch (error) {
        console.error('❌ Erreur ajout commentaire:', error);
        showDriveError('Impossible d\'ajouter le commentaire');
    }
};

// =====================================================
// RECHERCHE
// =====================================================

window.handleSearch = (event) => {
    const query = event.target.value.toLowerCase().trim();
    
    if (query === '') {
        renderDrive();
        return;
    }
    
    const filtered = allItems.filter(item => 
        item.name.toLowerCase().includes(query)
    );
    
    const temp = allItems;
    allItems = filtered;
    renderDrive();
    allItems = temp;
};

// =====================================================
// UTILITAIRES
// =====================================================

function getFileIcon(mimeType) {
    if (!mimeType) return 'file';
    
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'file-text';
    if (mimeType.includes('word')) return 'file-text';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-spreadsheet';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
    if (mimeType.startsWith('audio/')) return 'music';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    
    return 'file';
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function showDriveLoading() {
    const container = document.getElementById('drive-content');
    if (container) {
        container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-muted);"><div class="spinner"></div><p>Chargement...</p></div>';
    }
}

function showDriveSuccess(message) {
    if (window.showNotice) {
        window.showNotice('Succès', message, 'success');
    } else {
        alert(message);
    }
}

function showDriveError(message) {
    if (window.showNotice) {
        window.showNotice('Erreur', message, 'error');
    } else {
        alert('Erreur : ' + message);
    }
}

// =====================================================
// LANCEMENT AU CHARGEMENT
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📂 Initialisation du Drive...');
    initDrive();
});

console.log('✅ DRIVE.JS PRÊT');
