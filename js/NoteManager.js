/**
 * NoteManager.js
 * Handles all note-related operations with localStorage and optional Supabase backend integration
 */

class NoteManager {
    constructor(auth) {
        this.auth = auth;
        this.notes = [];
        this.activeNoteId = null;
        this.loading = false;
        this.useDatabase = false; // Track if we're using database or localStorage
        
        // Initialize with localStorage
        this.loadNotesFromStorage();
        
        // Bind auth user changes
        if (this.auth) {
            this.auth.onUserChange = (user) => this.handleUserChange(user);
        }
    }

    async handleUserChange(user) {
        if (user) {
            // User signed in, migrate to database and load their notes
            this.useDatabase = true;
            await this.migrateToDatabase();
            await this.loadNotesFromDatabase();
        } else {
            // User signed out, switch back to localStorage
            this.useDatabase = false;
            this.loadNotesFromStorage();
        }
    }

    // Generate unique ID for notes
    generateId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Create a new note
    async createNote(title = 'Untitled Note', content = '') {
        if (this.useDatabase && this.auth.isAuthenticated()) {
            return await this.createNoteInDatabase(title, content);
        } else {
            return this.createNoteInStorage(title, content);
        }
    }

    // Create note in database (authenticated users)
    async createNoteInDatabase(title, content) {
        const user = this.auth.getCurrentUser();
        
        try {
            // Insert note into database
            const { data, error } = await window.supabase
                .from('notes')
                .insert({
                    user_id: user.id,
                    title: title,
                    content: content
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            const note = {
                id: data.id,
                title: data.title,
                content: data.content,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
            
            this.notes.unshift(note); // Add to beginning
            this.activeNoteId = note.id;
            this.saveNotesToStorage(); // Also save to localStorage as backup
            
            // Trigger UI update
            if (this.onNotesChange) {
                this.onNotesChange();
            }
            
            return note;
        } catch (error) {
            console.error('Failed to create note in database:', error);
            // Fall back to localStorage
            return this.createNoteInStorage(title, content);
        }
    }

    // Create note in localStorage (non-authenticated users)
    createNoteInStorage(title, content) {
        const note = {
            id: this.generateId(),
            title: title,
            content: content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.notes.unshift(note); // Add to beginning
        this.activeNoteId = note.id;
        this.saveNotesToStorage();
        
        // Trigger UI update
        if (this.onNotesChange) {
            this.onNotesChange();
        }
        
        return note;
    }

    // Get a note by ID
    getNoteById(id) {
        return this.notes.find(note => note.id === id);
    }

    // Get the active note
    getActiveNote() {
        if (!this.activeNoteId) {
            return null;
        }
        return this.getNoteById(this.activeNoteId);
    }

    // Update note content
    async updateNote(id, updates) {
        if (this.useDatabase && this.auth.isAuthenticated()) {
            return await this.updateNoteInDatabase(id, updates);
        } else {
            return this.updateNoteInStorage(id, updates);
        }
    }

    // Update note in database
    async updateNoteInDatabase(id, updates) {
        const user = this.auth.getCurrentUser();
        
        try {
            // Update in database
            const { data, error } = await window.supabase
                .from('notes')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Update local notes array
            const noteIndex = this.notes.findIndex(note => note.id === id);
            if (noteIndex !== -1) {
                this.notes[noteIndex] = {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at
                };
                
                this.saveNotesToStorage(); // Also save to localStorage as backup
                
                // Trigger UI update
                if (this.onNotesChange) {
                    this.onNotesChange();
                }
                
                return this.notes[noteIndex];
            }
            
            return null;
        } catch (error) {
            console.error('Failed to update note in database:', error);
            // Fall back to localStorage
            return this.updateNoteInStorage(id, updates);
        }
    }

    // Update note in localStorage
    updateNoteInStorage(id, updates) {
        const noteIndex = this.notes.findIndex(note => note.id === id);
        if (noteIndex !== -1) {
            this.notes[noteIndex] = {
                ...this.notes[noteIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            this.saveNotesToStorage();
            
            // Trigger UI update
            if (this.onNotesChange) {
                this.onNotesChange();
            }
            
            return this.notes[noteIndex];
        }
        
        return null;
    }

    // Update note title based on content
    async updateNoteTitle(id, content) {
        const firstLine = this.extractFirstLineAsTitle(content);
        const title = firstLine ? firstLine.substring(0, 50) + (firstLine.length > 50 ? '...' : '') : 'Untitled Note';
        
        try {
            await this.updateNote(id, { 
                title: title,
                content: content
            });
        } catch (error) {
            console.error('Failed to update note title:', error);
        }
    }

    // Extract first line as title
    extractFirstLineAsTitle(content) {
        if (!content || typeof content !== 'string') return '';
        
        // Remove HTML tags and get plain text
        const plainText = content.replace(/<[^>]*>/g, '').trim();
        if (!plainText) return '';
        
        // Get first meaningful line
        const firstLine = plainText.split('\n')[0].trim();
        return firstLine || 'Untitled Note';
    }

    // Delete a note
    async deleteNote(id) {
        if (!this.auth.isAuthenticated()) {
            throw new Error('User must be authenticated to delete notes');
        }

        const user = this.auth.getCurrentUser();
        
        try {
            // Delete from database
            const { error } = await window.supabase
                .from('notes')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) {
                throw error;
            }

            // Remove from local notes array
            const noteIndex = this.notes.findIndex(note => note.id === id);
            if (noteIndex !== -1) {
                this.notes.splice(noteIndex, 1);
                
                // If the deleted note was active, set a new active note
                if (this.activeNoteId === id) {
                    if (this.notes.length > 0) {
                        this.activeNoteId = this.notes[0].id;
                    } else {
                        this.activeNoteId = null;
                    }
                }
                
                // Trigger UI update
                if (this.onNotesChange) {
                    this.onNotesChange();
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to delete note:', error);
            throw new Error('Failed to delete note');
        }
    }

    // Set active note
    setActiveNote(id) {
        const note = this.getNoteById(id);
        if (note) {
            this.activeNoteId = id;
            return note;
        }
        return null;
    }

    // Get all notes
    getAllNotes() {
        return this.notes;
    }

    // Load notes from database
    async loadNotesFromDatabase() {
        if (!this.auth.isAuthenticated()) {
            this.loadNotesFromStorage();
            return;
        }

        const user = this.auth.getCurrentUser();
        this.loading = true;
        
        try {
            const { data, error } = await window.supabase
                .from('notes')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) {
                throw error;
            }

            // Convert database format to local format
            this.notes = data.map(note => ({
                id: note.id,
                title: note.title,
                content: note.content,
                createdAt: note.created_at,
                updatedAt: note.updated_at
            }));

            // Set active note (first note or none)
            if (this.notes.length > 0) {
                this.activeNoteId = this.notes[0].id;
            } else {
                this.activeNoteId = null;
                // Create a welcome note for new users
                await this.createNote('Welcome to takenote', '<p>Welcome to takenote! This is your first note.</p><p>You can:</p><ul><li>Format text with the toolbar</li><li>Create new notes</li><li>Upload and download files</li><li>Access your notes from anywhere when signed in</li></ul>');
            }
            
            // Also save to localStorage as backup
            this.saveNotesToStorage();
            
            // Trigger UI update
            if (this.onNotesChange) {
                this.onNotesChange();
            }
            
        } catch (error) {
            console.error('Failed to load notes from database:', error);
            // Fall back to localStorage
            this.loadNotesFromStorage();
        } finally {
            this.loading = false;
        }
    }

    // Save notes to localStorage
    saveNotesToStorage() {
        try {
            localStorage.setItem('takenote-notes', JSON.stringify(this.notes));
            localStorage.setItem('takenote-active-id', this.activeNoteId || '');
        } catch (error) {
            console.warn('Failed to save notes to localStorage:', error);
        }
    }

    // Load notes from localStorage
    loadNotesFromStorage() {
        try {
            const savedNotes = localStorage.getItem('takenote-notes');
            const savedActiveId = localStorage.getItem('takenote-active-id');
            
            if (savedNotes) {
                this.notes = JSON.parse(savedNotes);
            }
            
            if (savedActiveId && this.getNoteById(savedActiveId)) {
                this.activeNoteId = savedActiveId;
            } else if (this.notes.length > 0) {
                this.activeNoteId = this.notes[0].id;
            }

            // If no notes exist, create a default one
            if (this.notes.length === 0) {
                this.createNoteInStorage('Welcome to takenote', '<p>Welcome to takenote! This is your first note.</p><p>You can:</p><ul><li>Format text with the toolbar</li><li>Create new notes</li><li>Upload and download files</li><li>Sign in to sync your notes across devices</li></ul>');
            }
            
            // Trigger UI update
            if (this.onNotesChange) {
                this.onNotesChange();
            }
        } catch (error) {
            console.warn('Failed to load notes from localStorage:', error);
            // Create default note on error
            this.createNoteInStorage('Welcome to takenote', '<p>Welcome to takenote! Start taking notes.</p>');
        }
    }

    // Migrate localStorage notes to database when user signs in
    async migrateToDatabase() {
        if (!this.auth.isAuthenticated() || this.notes.length === 0) {
            return;
        }

        const user = this.auth.getCurrentUser();
        console.log('Migrating', this.notes.length, 'notes to database for user', user.email);

        try {
            // Check if user already has notes in database
            const { data: existingNotes } = await window.supabase
                .from('notes')
                .select('id')
                .eq('user_id', user.id)
                .limit(1);

            // If user already has notes in database, don't migrate
            if (existingNotes && existingNotes.length > 0) {
                console.log('User already has notes in database, skipping migration');
                return;
            }

            // Migrate each note to database
            for (const note of this.notes) {
                try {
                    await window.supabase
                        .from('notes')
                        .insert({
                            user_id: user.id,
                            title: note.title,
                            content: note.content
                        });
                } catch (error) {
                    console.error('Failed to migrate note:', note.title, error);
                }
            }
            
            console.log('Migration completed successfully');
        } catch (error) {
            console.error('Failed to migrate notes to database:', error);
        }
    }

    // Export note as text
    exportNoteAsText(id) {
        const note = this.getNoteById(id);
        if (!note) return null;
        
        // Convert HTML to plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        return {
            title: note.title,
            content: plainText,
            filename: this.sanitizeFilename(note.title) + '.txt'
        };
    }

    // Sanitize filename
    sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    // Import text content
    async importTextContent(content, filename = '') {
        const title = filename ? filename.replace(/\.[^/.]+$/, '') : 'Imported Note';
        
        // Convert plain text to HTML paragraphs
        const htmlContent = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => `<p>${this.escapeHtml(line)}</p>`)
            .join('');
        
        return await this.createNote(title, htmlContent || '<p></p>');
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get note statistics
    getNoteStats(content) {
        if (!content) {
            return { words: 0, characters: 0, sentences: 0 };
        }
        
        // Convert HTML to plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        const characters = plainText.length;
        const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
        const sentences = plainText.trim() ? plainText.split(/[.!?]+/).filter(s => s.trim().length > 0).length : 0;
        
        return { words, characters, sentences };
    }

    // Auto-save functionality
    async autoSaveNote(id, content, debounceMs = 2000) {
        if (!this.auth.isAuthenticated()) {
            return;
        }

        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Set new timeout
        this.autoSaveTimeout = setTimeout(async () => {
            try {
                await this.updateNoteTitle(id, content);
            } catch (error) {
                console.warn('Auto-save failed:', error);
            }
        }, debounceMs);
    }

    // Event callback (set by external code)
    onNotesChange = null;
}