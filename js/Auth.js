/**
 * Auth.js
 * Handles user authentication and session management
 */

class Auth {
    constructor() {
        this.user = null;
        this.loading = false;
        this.authModal = null;
        this.currentForm = 'login';
        
        this.initializeAuth();
        this.bindEvents();
    }

    async initializeAuth() {
        this.loading = true;
        this.showLoading();
        
        try {
            // Get current user
            const { data: { user }, error } = await window.supabase.auth.getUser();
            
            if (error) {
                console.warn('Auth error:', error);
            }
            
            this.setUser(user);
            
            // Set up auth listener
            window.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state change:', event, session?.user?.email);
                this.setUser(session?.user || null);
                
                if (event === 'SIGNED_IN') {
                    this.hideAuthModal();
                    this.showToast('Successfully signed in!', 'success');
                } else if (event === 'SIGNED_OUT') {
                    this.showToast('Signed out successfully', 'info');
                }
            });
        } catch (error) {
            console.error('Failed to initialize auth:', error);
        } finally {
            this.loading = false;
            this.hideLoading();
        }
    }

    bindEvents() {
        // Login link
        const loginLink = document.getElementById('login-link');
        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAuthModal('login');
            });
        }

        // Auth required login button
        const authRequiredLogin = document.getElementById('auth-required-login');
        if (authRequiredLogin) {
            authRequiredLogin.addEventListener('click', () => {
                this.showAuthModal('login');
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }

        // Wait for DOM to be ready for modal events
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeModalEvents();
        });

        // If DOM is already loaded, initialize immediately
        if (document.readyState === 'loading') {
            // DOM hasn't finished loading yet
        } else {
            this.initializeModalEvents();
        }
    }

    initializeModalEvents() {
        // Auth modal elements
        this.authModal = document.getElementById('auth-modal');
        
        // Modal close
        const modalClose = document.getElementById('auth-modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.hideAuthModal();
            });
        }

        // Click outside modal to close
        if (this.authModal) {
            this.authModal.addEventListener('click', (e) => {
                if (e.target === this.authModal) {
                    this.hideAuthModal();
                }
            });
        }

        // Form toggle links
        const showSignup = document.getElementById('show-signup');
        const showLogin = document.getElementById('show-login');
        
        if (showSignup) {
            showSignup.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForm('signup');
            });
        }
        
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForm('login');
            });
        }

        // Form submissions
        const loginForm = document.getElementById('login-form-element');
        const signupForm = document.getElementById('signup-form-element');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(e);
            });
        }
        
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup(e);
            });
        }
    }

    setUser(user) {
        this.user = user;
        this.updateUI();
        
        // Trigger user change event
        if (this.onUserChange) {
            this.onUserChange(user);
        }
    }

    updateUI() {
        const loginLink = document.getElementById('login-link');
        const userMenu = document.getElementById('user-menu');
        const userEmail = document.getElementById('user-email');
        const authRequired = document.getElementById('auth-required');
        const editorContainer = document.getElementById('editor-container');

        if (this.user) {
            // User is signed in
            if (loginLink) loginLink.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            if (userEmail) userEmail.textContent = this.user.email;
            if (authRequired) authRequired.style.display = 'none';
            if (editorContainer) editorContainer.style.display = 'flex';
        } else {
            // User is signed out
            if (loginLink) loginLink.style.display = 'block';
            if (userMenu) userMenu.style.display = 'none';
            if (userEmail) userEmail.textContent = '';
            if (authRequired) authRequired.style.display = 'flex';
            if (editorContainer) editorContainer.style.display = 'none';
        }
    }

    showAuthModal(formType = 'login') {
        this.currentForm = formType;
        
        if (this.authModal) {
            this.authModal.classList.add('active');
            this.showForm(formType);
            
            // Focus first input
            setTimeout(() => {
                const firstInput = this.authModal.querySelector('input[type="email"], input[type="text"]');
                if (firstInput) {
                    firstInput.focus();
                }
            }, 100);
        }
    }

    hideAuthModal() {
        if (this.authModal) {
            this.authModal.classList.remove('active');
            this.clearErrors();
        }
    }

    showForm(formType) {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const modalTitle = document.getElementById('auth-modal-title');
        
        if (formType === 'login') {
            if (loginForm) loginForm.style.display = 'block';
            if (signupForm) signupForm.style.display = 'none';
            if (modalTitle) modalTitle.textContent = 'Welcome Back';
        } else {
            if (loginForm) loginForm.style.display = 'none';
            if (signupForm) signupForm.style.display = 'block';
            if (modalTitle) modalTitle.textContent = 'Create Account';
        }
        
        this.clearErrors();
    }

    clearErrors() {
        const errorElements = document.querySelectorAll('.auth-error');
        errorElements.forEach(el => el.textContent = '');
    }

    showError(formType, message) {
        const errorEl = document.getElementById(`${formType}-error`);
        if (errorEl) {
            errorEl.textContent = message;
        }
    }

    async handleLogin(e) {
        const formData = new FormData(e.target);
        const email = formData.get('email') || document.getElementById('login-email').value;
        const password = formData.get('password') || document.getElementById('login-password').value;
        
        if (!email || !password) {
            this.showError('login', 'Please fill in all fields');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        }

        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            console.log('Login successful:', data.user.email);
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError('login', error.message || 'Failed to sign in');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Sign In';
            }
        }
    }

    async handleSignup(e) {
        const formData = new FormData(e.target);
        const name = formData.get('name') || document.getElementById('signup-name').value;
        const email = formData.get('email') || document.getElementById('signup-email').value;
        const password = formData.get('password') || document.getElementById('signup-password').value;
        
        if (!name || !email || !password) {
            this.showError('signup', 'Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            this.showError('signup', 'Password must be at least 6 characters');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        }

        try {
            const { data, error } = await window.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: name
                    }
                }
            });

            if (error) {
                throw error;
            }

            if (data.user && !data.session) {
                this.showError('signup', 'Please check your email to confirm your account');
            } else {
                console.log('Signup successful:', data.user.email);
            }
            
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('signup', error.message || 'Failed to create account');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Create Account';
            }
        }
    }

    async signOut() {
        try {
            const { error } = await window.supabase.auth.signOut();
            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Signout error:', error);
            this.showToast('Failed to sign out', 'error');
        }
    }

    // Utility methods
    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
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

    // Public methods
    getCurrentUser() {
        return this.user;
    }

    isAuthenticated() {
        return !!this.user;
    }

    // Event callback (set by external code)
    onUserChange = null;
}