// js/modules/Settings/pages/settings-account-page.js
// Account settings page - User account management and deletion

import { createLogger } from '../../../utils/logger.js';
import DashieModal from '../../../utils/dashie-modal.js';

const logger = createLogger('SettingsAccountPage');

/**
 * Account Settings Page
 * Handles user account information display and deletion
 */
export class SettingsAccountPage {
    constructor() {
        this.initialized = false;
        this.user = null;
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.verbose('Initializing Account settings page');

        // Get current user
        this.user = window.sessionManager?.getUser();

        this.initialized = true;
    }

    /**
     * Render the page content
     * @returns {string} - HTML string
     */
    render() {
        if (!this.user) {
            return `
                <div class="settings-modal__page-content">
                    <div class="settings-modal__empty">
                        <div class="settings-modal__empty-icon">👤</div>
                        <div class="settings-modal__empty-text">No user logged in</div>
                    </div>
                </div>
            `;
        }

        // Main account page
        return this.renderMainScreen();
    }

    /**
     * Render main account screen
     */
    renderMainScreen() {
        return `
            <div class="settings-modal__page-content" data-screen="account-main">
                <!-- Account Information Header -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">Account</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <div class="settings-account-info">
                            ${this.user.picture ? `
                                <img src="${this.user.picture}" alt="${this.user.name || 'User'}" class="settings-account-photo">
                            ` : `
                                <div class="settings-account-photo-placeholder">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                                    </svg>
                                </div>
                            `}
                            <div class="settings-account-details">
                                <div class="settings-account-name">${this.user.name || 'User'}</div>
                                <div class="settings-account-email">${this.user.email || ''}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Account Actions -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-content" style="padding: 0;">
                        <!-- Manage Account -->
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable"
                             id="manage-account-item"
                             data-navigate="account-manage"
                             tabindex="1">
                            <span class="settings-modal__menu-label">Manage Account</span>
                            <span class="settings-modal__menu-arrow">›</span>
                        </div>

                        <!-- Erase All Data -->
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable"
                             id="erase-all-data-item"
                             data-navigate="account-erase"
                             tabindex="2">
                            <span class="settings-modal__menu-label">Erase All Data</span>
                            <span class="settings-modal__menu-arrow">›</span>
                        </div>

                        <!-- Delete Account -->
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable settings-modal__menu-item--danger delete-account-item"
                             id="delete-account-item"
                             tabindex="3">
                            <span class="settings-modal__menu-label">Delete Account</span>
                            <span class="settings-modal__menu-arrow">›</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render manage account screen
     */
    renderManageAccountScreen() {
        return `
            <div class="settings-modal__page-content" data-screen="account-manage">
                <div class="settings-modal__empty">
                    <div class="settings-modal__empty-icon">👤</div>
                    <div class="settings-modal__empty-text">Manage Account</div>
                    <div class="settings-modal__empty-text" style="font-size: var(--font-size-base); margin-top: 10px;">
                        Coming soon: Update email, password, and account preferences
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render erase all data screen
     */
    renderEraseAllDataScreen() {
        return `
            <div class="settings-modal__page-content" data-screen="account-erase">
                <div class="settings-modal__empty">
                    <div class="settings-modal__empty-icon">🗑️</div>
                    <div class="settings-modal__empty-text">Erase All Data</div>
                    <div class="settings-modal__empty-text" style="font-size: var(--font-size-base); margin-top: 10px;">
                        Coming soon: Clear all your calendars, photos, and settings while keeping your account
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render delete account screen
     */
    renderDeleteAccountScreen() {
        return `
            <div class="settings-modal__page-content" data-screen="account-delete">
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title" style="color: #FF3B30;">Delete Account</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <p class="settings-modal__section-description" style="color: var(--text-secondary);">
                            Are you sure you want to permanently delete your account?
                        </p>
                        <p class="settings-modal__section-description" style="margin-top: 12px; color: var(--text-secondary);">
                            This will delete all your data including:
                        </p>
                        <ul style="margin: 12px 0; padding-left: 24px; font-size: 14px; color: var(--text-secondary);">
                            <li style="margin: 6px 0;">Calendar settings and connections</li>
                            <li style="margin: 6px 0;">Uploaded photos and albums</li>
                            <li style="margin: 6px 0;">All settings and preferences</li>
                            <li style="margin: 6px 0;">Account information and login access</li>
                        </ul>
                        <p class="settings-modal__section-description" style="margin-top: 12px; color: #FF3B30; font-weight: 600;">
                            This action cannot be undone!
                        </p>
                        <div style="display: flex; gap: 12px; margin-top: 20px;">
                            <button
                                class="settings-button"
                                id="cancel-delete-account-btn"
                                tabindex="0"
                                style="flex: 1;">
                                Cancel
                            </button>
                            <button
                                class="settings-button settings-button--danger"
                                id="confirm-delete-account-btn"
                                tabindex="1"
                                style="flex: 1;">
                                Delete My Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        // Check which screen we're on
        const currentScreen = document.querySelector('[data-screen]');
        const screenName = currentScreen?.dataset?.screen;

        if (screenName === 'account-delete') {
            // Delete account confirmation screen - return both buttons with Cancel first
            const cancelBtn = document.getElementById('cancel-delete-account-btn');
            const confirmBtn = document.getElementById('confirm-delete-account-btn');
            const elements = [];
            if (cancelBtn) elements.push(cancelBtn);
            if (confirmBtn) elements.push(confirmBtn);
            return elements;
        } else {
            // Main screen
            const manageItem = document.getElementById('manage-account-item');
            const eraseItem = document.getElementById('erase-all-data-item');
            const deleteItem = document.getElementById('delete-account-item');

            const elements = [];
            if (manageItem) elements.push(manageItem);
            if (eraseItem) elements.push(eraseItem);
            if (deleteItem) elements.push(deleteItem);

            return elements;
        }
    }

    /**
     * Handle activation (page shown)
     */
    activate() {
        logger.debug('Account page activated');

        // Note: Navigation between account sub-screens is now handled by the modal renderer
        // via data-navigate attributes. No need to attach click handlers here.
        // Event listeners for interactive elements (like the delete button) are attached
        // by the modal renderer when the sub-screen is shown.
    }

    /**
     * Handle item click
     * @param {HTMLElement} item - The clicked item
     * @returns {Promise<object>} - { shouldNavigate: boolean, navigateTo?: string }
     */
    async handleItemClick(item) {
        // Handle delete account clicks
        if (item.classList.contains('delete-account-item')) {
            await this.handleDeleteAccount();
            return { shouldNavigate: false };
        }

        // Default: allow navigation
        return { shouldNavigate: true };
    }

    /**
     * Navigate to a specific screen
     */
    navigateToScreen(screenName) {
        logger.debug('Navigating to screen', { screenName });

        const container = document.querySelector('.settings-modal__page-content');
        if (!container) return;

        let newContent;
        switch (screenName) {
            case 'account-manage':
                newContent = this.renderManageAccountScreen();
                break;
            case 'account-erase':
                newContent = this.renderEraseAllDataScreen();
                break;
            case 'account-delete':
                newContent = this.renderDeleteAccountScreen();
                break;
            case 'account-main':
            default:
                newContent = this.renderMainScreen();
                break;
        }

        container.outerHTML = newContent;

        // Update navigation state (for back button handling)
        if (window.settingsStateManager) {
            window.settingsStateManager.currentScreen = screenName;
        }

        // Re-activate to attach new event listeners
        this.activate();

        // Update focus
        setTimeout(() => {
            if (window.settingsStateManager?.renderer) {
                window.settingsStateManager.renderer.updateSelection();
            }
        }, 50);
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Account page deactivated');
    }

    /**
     * Handle delete account button click
     */
    async handleDeleteAccount() {
        logger.warn('Delete account requested');

        // Show confirmation modal
        const confirmed = await this.showDeleteConfirmation();
        if (!confirmed) {
            logger.info('Account deletion cancelled');
            return;
        }

        try {
            // Call edge function to delete account
            await this.deleteAccount();

            logger.success('Account deleted successfully');

            // Clear all local storage
            this.clearLocalData();

            // Show success message
            await DashieModal.info('Account Deleted', 'Your account has been deleted. You will now be redirected to the login screen.');

            // Reload page to return to login
            window.location.reload();

        } catch (error) {
            logger.error('Failed to delete account', error);
            await DashieModal.error('Failed to Delete Account', `Unable to delete your account:\n\n${error.message}\n\nPlease try again or contact support.`);
        }
    }

    /**
     * Show delete confirmation modal
     * @returns {Promise<boolean>} - True if confirmed
     */
    async showDeleteConfirmation() {
        // Use DashieModal like the remove calendar confirmation
        const confirmed = await DashieModal.confirm(
            'Delete Account',
            `Are you sure you want to permanently delete your account?\n\n${this.user.email}\n\nThis will delete all your data including:\n• Calendar settings and connections\n• Uploaded photos and albums\n• All settings and preferences\n• Account information and login access\n\nThis action cannot be undone!`
        );

        return confirmed;
    }

    /**
     * Call edge function to delete account
     */
    async deleteAccount() {
        logger.info('Calling edge function to delete account');

        const edgeClient = window.sessionManager?.getEdgeClient();
        if (!edgeClient) {
            throw new Error('EdgeClient not available');
        }

        // Call database-operations edge function
        const result = await edgeClient.databaseRequest({ operation: 'delete_account' });

        logger.info('Account deletion response', result);

        // If there are storage paths to delete, log them
        // (The client could delete them from storage, but for now we just log)
        if (result.storage_paths && result.storage_paths.length > 0) {
            logger.info('Storage cleanup needed', {
                paths: result.storage_paths.length
            });
            // Note: Storage paths could be deleted here if we implement storage bucket access
        }

        return result;
    }

    /**
     * Clear all local data
     */
    clearLocalData() {
        logger.info('Clearing all local data');

        try {
            // Clear localStorage
            localStorage.clear();

            // Clear sessionStorage
            sessionStorage.clear();

            // Clear IndexedDB (if used)
            if (window.indexedDB) {
                indexedDB.databases().then(databases => {
                    databases.forEach(db => {
                        if (db.name) {
                            indexedDB.deleteDatabase(db.name);
                            logger.debug('Deleted IndexedDB database', { name: db.name });
                        }
                    });
                });
            }

            logger.success('Local data cleared');
        } catch (error) {
            logger.warn('Failed to clear some local data', error);
        }
    }
}
