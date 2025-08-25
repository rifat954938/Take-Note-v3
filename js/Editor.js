/**
 * Editor.js
 * Handles rich text editing functionality and formatting
 */

class Editor {
    constructor(editorElement) {
        this.editor = editorElement;
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoLevels = 50;
        this.lastSavedState = '';
        
        this.initializeEditor();
        this.bindEvents();
    }

    initializeEditor() {
        // Set up editor defaults
        this.editor.style.outline = 'none';
        this.saveState();
    }

    bindEvents() {
        // Input events
        this.editor.addEventListener('input', () => {
            this.handleInput();
        });

        this.editor.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // Selection change events
        document.addEventListener('selectionchange', () => {
            this.updateToolbarState();
        });

        // Paste event
        this.editor.addEventListener('paste', (e) => {
            this.handlePaste(e);
        });
    }

    handleInput() {
        // Trigger content change callback
        if (this.onContentChange) {
            this.onContentChange(this.getContent());
        }
        
        // Save state for undo functionality (debounced)
        clearTimeout(this.saveStateTimeout);
        this.saveStateTimeout = setTimeout(() => {
            this.saveState();
        }, 500);
    }

    handleKeyDown(e) {
        // Handle keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    this.toggleBold();
                    break;
                case 'i':
                    e.preventDefault();
                    this.toggleItalic();
                    break;
                case 'z':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.redo();
                    } else {
                        e.preventDefault();
                        this.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
            }
        }
    }

    handlePaste(e) {
        e.preventDefault();
        
        // Get plain text from clipboard
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        
        // Insert as plain text, preserving line breaks
        const lines = paste.split('\n');
        const htmlLines = lines.map(line => 
            line.trim() ? `<p>${this.escapeHtml(line)}</p>` : '<p><br></p>'
        ).join('');
        
        this.insertHTML(htmlLines);
    }

    // Content manipulation methods
    getContent() {
        return this.editor.innerHTML;
    }

    setContent(html) {
        this.editor.innerHTML = html || '<p><br></p>';
        this.saveState();
    }

    insertHTML(html) {
        if (document.queryCommandSupported('insertHTML')) {
            document.execCommand('insertHTML', false, html);
        } else {
            // Fallback for browsers that don't support insertHTML
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                
                const fragment = range.createContextualFragment(html);
                range.insertNode(fragment);
                
                // Move cursor to end
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    // Formatting methods
    toggleBold() {
        document.execCommand('bold', false, null);
        this.updateToolbarState();
    }

    toggleItalic() {
        document.execCommand('italic', false, null);
        this.updateToolbarState();
    }

    setHeading(tag) {
        if (tag === 'div') {
            document.execCommand('formatBlock', false, 'div');
        } else {
            document.execCommand('formatBlock', false, tag);
        }
        this.updateToolbarState();
    }

    setTextAlign(alignment) {
        const commands = {
            'left': 'justifyLeft',
            'center': 'justifyCenter',
            'right': 'justifyRight'
        };
        
        if (commands[alignment]) {
            document.execCommand(commands[alignment], false, null);
        }
        this.updateToolbarState();
    }

    insertBulletList() {
        document.execCommand('insertUnorderedList', false, null);
        this.updateToolbarState();
    }

    insertNumberList() {
        document.execCommand('insertOrderedList', false, null);
        this.updateToolbarState();
    }

    // Undo/Redo functionality
    saveState() {
        const currentState = this.getContent();
        
        // Don't save if content hasn't changed
        if (currentState === this.lastSavedState) {
            return;
        }
        
        this.undoStack.push(this.lastSavedState);
        
        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoLevels) {
            this.undoStack.shift();
        }
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
        
        this.lastSavedState = currentState;
    }

    undo() {
        if (this.undoStack.length > 0) {
            const currentState = this.getContent();
            const previousState = this.undoStack.pop();
            
            this.redoStack.push(currentState);
            this.setContent(previousState);
            this.lastSavedState = previousState;
            
            // Update toolbar and trigger content change
            this.updateToolbarState();
            if (this.onContentChange) {
                this.onContentChange(previousState);
            }
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const nextState = this.redoStack.pop();
            
            this.undoStack.push(this.getContent());
            this.setContent(nextState);
            this.lastSavedState = nextState;
            
            // Update toolbar and trigger content change
            this.updateToolbarState();
            if (this.onContentChange) {
                this.onContentChange(nextState);
            }
        }
    }

    // Toolbar state management
    updateToolbarState() {
        if (!this.onToolbarStateChange) return;
        
        const state = {
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            heading: this.getCurrentHeading(),
            alignment: this.getCurrentAlignment(),
            bulletList: document.queryCommandState('insertUnorderedList'),
            numberList: document.queryCommandState('insertOrderedList')
        };
        
        this.onToolbarStateChange(state);
    }

    getCurrentHeading() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).startContainer;
            
            // Find the parent block element
            while (node && node !== this.editor) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();
                    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                        return tagName;
                    }
                }
                node = node.parentNode;
            }
        }
        return 'div'; // Default to normal text
    }

    getCurrentAlignment() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).startContainer;
            
            // Find the parent block element
            while (node && node !== this.editor) {
                if (node.nodeType === Node.ELEMENT_NODE && node.style) {
                    const textAlign = window.getComputedStyle(node).textAlign;
                    if (textAlign === 'center') return 'center';
                    if (textAlign === 'right') return 'right';
                    if (textAlign === 'left') return 'left';
                }
                node = node.parentNode;
            }
        }
        return 'left'; // Default alignment
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    focus() {
        this.editor.focus();
        
        // Place cursor at end if empty
        if (!this.editor.textContent.trim()) {
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(this.editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    clear() {
        this.setContent('<p><br></p>');
        this.focus();
    }

    // Event callbacks (to be set by external code)
    onContentChange = null;
    onToolbarStateChange = null;
}