/**
 * app.js
 * Main application entry point - coordinates all modules with authentication
 */

class TakenoteApp {
    constructor() {
        this.auth = new Auth();
        this.noteManager = new NoteManager(this.auth);
        this.ui = new UI(this.auth);
        this.editor = null;
        
        this.currentNoteId = null;
        this.autoSaveTimeout = null;
        
        this.initializeApp();
    }

    async initializeApp() {
        // Wait for auth to be ready
        await this.waitForAuth();
        
        // Initialize editor only after auth is ready
        this.editor = new Editor(this.ui.elements.textEditor);
        
        this.bindEvents();
        this.updateUI();
        
        console.log('takenote app initialized');
    }

    async waitForAuth() {
        // Wait for auth to complete initialization
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        while (this.auth.loading && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (this.auth.loading) {
            console.warn('Auth initialization timeout');
        }
    }

    bindEvents() {
        // UI event callbacks
        this.ui.onNewNote = () => this.createNewNote();
        this.ui.onNoteSelect = (noteId) => this.switchToNote(noteId);
        this.ui.onNoteDelete = (noteId, title) => this.deleteNote(noteId, title);
        
        // Toolbar event callbacks
        if (this.editor) {
            this.ui.onHeadingChange = (tag) => this.editor.setHeading(tag);
            this.ui.onBoldToggle = () => this.editor.toggleBold();
            this.ui.onItalicToggle = () => this.editor.toggleItalic();
            this.ui.onTextAlign = (alignment) => this.editor.setTextAlign(alignment);
            this.ui.onBulletList = () => this.editor.insertBulletList();
            this.ui.onNumberList = () => this.editor.insertNumberList();
            this.ui.onUndo = () => this.editor.undo();
            this.ui.onRedo = () => this.editor.redo();
        }
        
        // File handling callbacks
        this.ui.onFileUpload = (file) => this.handleFileUpload(file);
        this.ui.onFileDownload = () => this.handleFileDownload();
        
        // Editor event callbacks
        if (this.editor) {
            this.editor.onContentChange = (content) => this.handleContentChange(content);
            this.editor.onToolbarStateChange = (state) => this.ui.updateToolbarState(state);
        }
        
        // Note manager callbacks
        this.noteManager.onNotesChange = () => this.updateUI();
        
        // Auth callbacks
        this.auth.onUserChange = (user) => this.handleUserChange(user);
    }

    handleUserChange(user) {
        console.log('User changed:', user?.email || 'signed out');
        
        // Update authentication UI (but always show editor)
        this.ui.updateAuthenticationUI(!!user);
        
        if (user) {
            // User signed in - their notes will be loaded via NoteManager
            this.loadActiveNote();
        }
        
        this.updateUI();
    }

    async loadActiveNote() {
        const activeNote = this.noteManager.getActiveNote();
        if (activeNote && this.editor) {
            this.currentNoteId = activeNote.id;
            this.editor.setContent(activeNote.content);
        }
    }

    updateUI() {
        const notes = this.noteManager.getAllNotes();
        const activeNoteId = this.noteManager.activeNoteId;
        
        this.ui.renderNotesList(notes, activeNoteId);
        
        // Update status counters
        if (this.editor && this.auth.isAuthenticated()) {
            const content = this.editor.getContent();
            const stats = this.noteManager.getNoteStats(content);
            this.ui.updateStatusCounters(stats);
        } else {
            // Clear counters when not authenticated
            this.ui.updateStatusCounters({ words: 0, characters: 0, sentences: 0 });
        }
    }

    async createNewNote() {
        try {
            const newNote = await this.noteManager.createNote();
            this.currentNoteId = newNote.id;
            
            if (this.editor) {
                this.editor.setContent('<p><br></p>');
                this.editor.focus();
            }
            
            this.ui.showToast('New note created!', 'success');
        } catch (error) {
            console.error('Failed to create note:', error);
            this.ui.showErrorMessage('Failed to create note');
        }
    }

    async switchToNote(noteId) {
        const note = this.noteManager.getNoteById(noteId);
        if (!note) return;
        
        // Save current note before switching
        if (this.currentNoteId && this.currentNoteId !== noteId) {
            await this.saveCurrentNote();
        }
        
        this.noteManager.setActiveNote(noteId);
        this.currentNoteId = noteId;
        
        if (this.editor) {
            this.editor.setContent(note.content);
            this.editor.focus();
        }
        
        this.updateUI();
    }

    async deleteNote(noteId, title) {
        const confirmMessage = `Are you sure you want to delete "${title}"? This action cannot be undone.`;
        
        if (!window.confirm(confirmMessage)) {
            return;
        }
        
        try {
            const wasDeleted = await this.noteManager.deleteNote(noteId);
            
            if (wasDeleted) {
                // If we deleted the current note, switch to the new active note
                if (noteId === this.currentNoteId) {
                    const newActiveNote = this.noteManager.getActiveNote();
                    if (newActiveNote) {
                        this.currentNoteId = newActiveNote.id;
                        if (this.editor) {
                            this.editor.setContent(newActiveNote.content);
                        }
                    } else {
                        // No notes left, create a new one
                        await this.createNewNote();
                        return;
                    }
                }
                
                this.ui.showToast('Note deleted successfully!', 'success');
            }
        } catch (error) {
            console.error('Failed to delete note:', error);
            this.ui.showErrorMessage('Failed to delete note');
        }
    }

    handleContentChange(content) {
        // Update live counters
        const stats = this.noteManager.getNoteStats(content);
        this.ui.updateStatusCounters(stats);
        
        // Auto-save with debouncing
        if (this.currentNoteId) {
            this.noteManager.autoSaveNote(this.currentNoteId, content);
        }
    }

    async saveCurrentNote() {
        if (!this.currentNoteId) return;
        
        try {
            const content = this.editor.getContent();
            await this.noteManager.updateNoteTitle(this.currentNoteId, content);
        } catch (error) {
            console.warn('Failed to save note:', error);
        }
    }

    async handleFileUpload(file) {
        if (!file) return;
        
        // Check file type
        const allowedTypes = ['text/plain', 'text/markdown'];
        const allowedExtensions = ['.txt', '.md'];
        
        const hasValidType = allowedTypes.includes(file.type);
        const hasValidExtension = allowedExtensions.some(ext => 
            file.name.toLowerCase().endsWith(ext)
        );
        
        if (!hasValidType && !hasValidExtension) {
            this.ui.showErrorMessage('Please select a text file (.txt) or markdown file (.md).');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const content = e.target.result;
                const newNote = await this.noteManager.importTextContent(content, file.name);
                
                await this.switchToNote(newNote.id);
                this.ui.showFileUploadFeedback(file.name);
            } catch (error) {
                console.error('File upload error:', error);
                this.ui.showErrorMessage('Failed to upload file. Please try again.');
            }
        };
        
        reader.onerror = () => {
            this.ui.showErrorMessage('Failed to read file. Please try again.');
        };
        
        reader.readAsText(file);
    }

    async handleFileDownload() {
        if (!this.currentNoteId) {
            this.ui.showErrorMessage('No note to download.');
            return;
        }
        
        // Save current content first
        await this.saveCurrentNote();
        
        const exportData = this.noteManager.exportNoteAsText(this.currentNoteId);
        if (!exportData) {
            this.ui.showErrorMessage('Failed to export note.');
            return;
        }
        
        try {
            const blob = new Blob([exportData.content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = exportData.filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            this.ui.showFileDownloadFeedback(exportData.filename);
        } catch (error) {
            console.error('Download error:', error);
            this.ui.showErrorMessage('Failed to download file. Please try again.');
        }
    }

    // Public methods for external access
    getCurrentNote() {
        return this.noteManager.getActiveNote();
    }

    getAllNotes() {
        return this.noteManager.getAllNotes();
    }

    getCurrentUser() {
        return this.auth.getCurrentUser();
    }

    isAuthenticated() {
        return this.auth.isAuthenticated();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.takenoteApp = new TakenoteApp();
    
    // Handle beforeunload to save current note
    window.addEventListener('beforeunload', async () => {
        if (window.takenoteApp && window.takenoteApp.getCurrentUser()) {
            await window.takenoteApp.saveCurrentNote();
        }
    });
    
    // Handle visibility change to save when tab becomes hidden
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden && window.takenoteApp) {
            await window.takenoteApp.saveCurrentNote();
        }
    });
});