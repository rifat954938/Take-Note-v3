/**
 * UI.js
 * Handles all user interface interactions and DOM manipulation
 */

class UI {
    constructor(auth) {
        this.auth = auth;
        this.elements = this.getElements();
        this.isMobile = window.innerWidth <= 768;
        this.sidebarOpen = false;
        
        this.bindEvents();
        this.updateResponsive();
    }

    getElements() {
        return {
            // Sidebar elements
            sidebar: document.getElementById('sidebar'),
            sidebarToggle: document.getElementById('sidebar-toggle'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            newNoteBtn: document.getElementById('new-note-btn'),
            notesList: document.getElementById('notes-list'),
            languageSelect: document.getElementById('language-select'),
            
            // Editor elements
            textEditor: document.getElementById('text-editor'),
            editorContainer: document.getElementById('editor-container'),
            authRequired: document.getElementById('auth-required'),
            
            // Toolbar elements
            headingSelect: document.getElementById('heading-select'),
            boldBtn: document.getElementById('bold-btn'),
            italicBtn: document.getElementById('italic-btn'),
            alignLeftBtn: document.getElementById('align-left-btn'),
            alignCenterBtn: document.getElementById('align-center-btn'),
            alignRightBtn: document.getElementById('align-right-btn'),
            bulletListBtn: document.getElementById('bullet-list-btn'),
            numberListBtn: document.getElementById('number-list-btn'),
            undoBtn: document.getElementById('undo-btn'),
            redoBtn: document.getElementById('redo-btn'),
            
            // File action elements
            uploadBtn: document.getElementById('upload-btn'),
            uploadInput: document.getElementById('upload-input'),
            downloadBtn: document.getElementById('download-btn'),
            
            // Status elements
            wordCount: document.getElementById('word-count'),
            charCount: document.getElementById('char-count'),
            sentenceCount: document.getElementById('sentence-count')
        };
    }

    bindEvents() {
        // Sidebar events
        this.elements.sidebarToggle?.addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        this.elements.sidebarOverlay?.addEventListener('click', () => {
            this.closeSidebar();
        });
        
        this.elements.newNoteBtn?.addEventListener('click', () => {
            if (this.onNewNote) this.onNewNote();
        });
        
        // Toolbar events
        this.elements.headingSelect?.addEventListener('change', (e) => {
            if (this.onHeadingChange) this.onHeadingChange(e.target.value);
        });
        
        this.elements.boldBtn?.addEventListener('click', () => {
            if (this.onBoldToggle) this.onBoldToggle();
        });
        
        this.elements.italicBtn?.addEventListener('click', () => {
            if (this.onItalicToggle) this.onItalicToggle();
        });
        
        this.elements.alignLeftBtn?.addEventListener('click', () => {
            if (this.onTextAlign) this.onTextAlign('left');
        });
        
        this.elements.alignCenterBtn?.addEventListener('click', () => {
            if (this.onTextAlign) this.onTextAlign('center');
        });
        
        this.elements.alignRightBtn?.addEventListener('click', () => {
            if (this.onTextAlign) this.onTextAlign('right');
        });
        
        this.elements.bulletListBtn?.addEventListener('click', () => {
            if (this.onBulletList) this.onBulletList();
        });
        
        this.elements.numberListBtn?.addEventListener('click', () => {
            if (this.onNumberList) this.onNumberList();
        });
        
        this.elements.undoBtn?.addEventListener('click', () => {
            if (this.onUndo) this.onUndo();
        });
        
        this.elements.redoBtn?.addEventListener('click', () => {
            if (this.onRedo) this.onRedo();
        });
        
        // File action events
        this.elements.uploadBtn?.addEventListener('click', () => {
            this.elements.uploadInput?.click();
        });
        
        this.elements.uploadInput?.addEventListener('change', (e) => {
            if (this.onFileUpload && e.target.files.length > 0) {
                this.onFileUpload(e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });
        
        this.elements.downloadBtn?.addEventListener('click', () => {
            if (this.onFileDownload) this.onFileDownload();
        });
        
        // Responsive events
        window.addEventListener('resize', () => {
            this.updateResponsive();
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.sidebarOpen) {
                this.closeSidebar();
            }
        });
    }

    showAuthRequiredMessage() {
        this.showToast('Please sign in to access this feature', 'info');
    }

    // Sidebar management
    toggleSidebar() {
        if (this.sidebarOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        if (this.isMobile) {
            this.elements.sidebar?.classList.add('mobile-open');
            this.elements.sidebarOverlay?.classList.add('active');
            this.sidebarOpen = true;
        }
    }

    closeSidebar() {
        if (this.isMobile) {
            this.elements.sidebar?.classList.remove('mobile-open');
            this.elements.sidebarOverlay?.classList.remove('active');
            this.sidebarOpen = false;
        }
    }

    updateResponsive() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;
        
        // If switching from mobile to desktop, ensure sidebar is visible
        if (wasMobile && !this.isMobile) {
            this.elements.sidebar?.classList.remove('mobile-open');
            this.elements.sidebarOverlay?.classList.remove('active');
            this.sidebarOpen = false;
        }
    }

    // Notes list management
    renderNotesList(notes, activeNoteId) {
        if (!this.elements.notesList) return;
        
        this.elements.notesList.innerHTML = '';
        
        if (notes.length === 0) {
            const emptyState = document.createElement('li');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #999; font-style: italic;">
                    <p>No notes yet. Create your first note!</p>
                    ${!this.auth.isAuthenticated() ? '<p style="font-size: 12px; margin-top: 8px;">💡 Sign in to sync across devices</p>' : ''}
                </div>
            `;
            this.elements.notesList.appendChild(emptyState);
            return;
        }
        
        notes.forEach(note => {
            const listItem = document.createElement('li');
            listItem.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
            listItem.dataset.noteId = note.id;
            
            listItem.innerHTML = `
                <span class="note-title">${this.escapeHtml(note.title)}</span>
                <button class="note-delete-btn" title="Delete note" aria-label="Delete note">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
            // Add click event for note selection
            const titleSpan = listItem.querySelector('.note-title');
            titleSpan.addEventListener('click', () => {
                if (this.onNoteSelect) {
                    this.onNoteSelect(note.id);
                }
                if (this.isMobile) {
                    this.closeSidebar();
                }
            });
            
            // Add click event for note deletion
            const deleteBtn = listItem.querySelector('.note-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onNoteDelete) {
                    this.onNoteDelete(note.id, note.title);
                }
            });
            
            this.elements.notesList.appendChild(listItem);
        });
    }

    // Editor management
    setEditorContent(content) {
        if (this.elements.textEditor) {
            this.elements.textEditor.innerHTML = content || '<p><br></p>';
        }
    }

    getEditorContent() {
        return this.elements.textEditor ? this.elements.textEditor.innerHTML : '';
    }

    focusEditor() {
        if (this.elements.textEditor) {
            this.elements.textEditor.focus();
        }
    }

    // Toolbar state management
    updateToolbarState(state) {
        if (!state) return;
        
        // Update heading dropdown
        if (this.elements.headingSelect) {
            this.elements.headingSelect.value = state.heading || 'div';
        }
        
        // Update formatting buttons
        this.toggleButtonState(this.elements.boldBtn, state.bold);
        this.toggleButtonState(this.elements.italicBtn, state.italic);
        this.toggleButtonState(this.elements.bulletListBtn, state.bulletList);
        this.toggleButtonState(this.elements.numberListBtn, state.numberList);
        
        // Update alignment buttons
        this.toggleButtonState(this.elements.alignLeftBtn, state.alignment === 'left');
        this.toggleButtonState(this.elements.alignCenterBtn, state.alignment === 'center');
        this.toggleButtonState(this.elements.alignRightBtn, state.alignment === 'right');
    }

    toggleButtonState(button, isActive) {
        if (!button) return;
        
        if (isActive) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }

    // Status bar management
    updateStatusCounters(stats) {
        if (this.elements.wordCount) {
            this.elements.wordCount.textContent = `Words: ${stats.words}`;
        }
        if (this.elements.charCount) {
            this.elements.charCount.textContent = `Characters: ${stats.characters}`;
        }
        if (this.elements.sentenceCount) {
            this.elements.sentenceCount.textContent = `Sentences: ${stats.sentences}`;
        }
    }

    // File handling UI
    showFileUploadFeedback(filename) {
        this.showToast(`File "${filename}" uploaded successfully!`, 'success');
    }

    showFileDownloadFeedback(filename) {
        this.showToast(`File "${filename}" downloaded successfully!`, 'success');
    }

    showErrorMessage(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const colors = {
            success: '#4CAF50',
            error: '#F44336',
            info: '#4A90E2'
        };
        
        toast.style.cssText = `
            position: fixed;
            top: 66px;
            right: 24px;
            background-color: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease-in-out;
            pointer-events: none;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 100);
        
        // Animate out and remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Authentication UI updates
    updateAuthenticationUI(isAuthenticated) {
        // Always show the editor - authentication is optional
        if (this.elements.authRequired) {
            this.elements.authRequired.style.display = 'none';
        }
        if (this.elements.editorContainer) {
            this.elements.editorContainer.style.display = 'flex';
        }
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event callbacks (to be set by external code)
    onNewNote = null;
    onNoteSelect = null;
    onNoteDelete = null;
    onHeadingChange = null;
    onBoldToggle = null;
    onItalicToggle = null;
    onTextAlign = null;
    onBulletList = null;
    onNumberList = null;
    onUndo = null;
    onRedo = null;
    onFileUpload = null;
    onFileDownload = null;
}