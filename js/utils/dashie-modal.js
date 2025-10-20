// js/utils/dashie-modal.js
// Dashie-themed modal for user messages
// Replaces browser alert() with a more aesthetic solution

import { createLogger } from './logger.js';

const logger = createLogger('DashieModal');

/**
 * DashieModal - A themed modal for user messages
 *
 * Usage:
 *   DashieModal.show({
 *     title: 'Success',
 *     message: 'Your changes have been saved!',
 *     type: 'success',
 *     buttons: [{ text: 'OK', primary: true }]
 *   });
 *
 * Types: 'info', 'success', 'error', 'warning'
 */
class DashieModal {
    constructor() {
        this.modalElement = null;
        this.isVisible = false;
        this.currentCallback = null;
        this.initialize();
    }

    /**
     * Initialize the modal and inject into DOM
     */
    initialize() {
        // Create modal HTML
        const modalHTML = `
            <div class="dashie-modal-overlay" style="display: none;">
                <div class="dashie-modal">
                    <div class="dashie-modal__icon"></div>
                    <div class="dashie-modal__content">
                        <h2 class="dashie-modal__title"></h2>
                        <p class="dashie-modal__message"></p>
                    </div>
                    <div class="dashie-modal__buttons"></div>
                </div>
            </div>
        `;

        // Insert modal into DOM
        const container = document.createElement('div');
        container.innerHTML = modalHTML;
        document.body.appendChild(container.firstElementChild);

        this.modalElement = document.querySelector('.dashie-modal-overlay');

        // Bind keyboard handler
        this.handleKeydown = this.handleKeydown.bind(this);

        logger.debug('DashieModal initialized');
    }

    /**
     * Show a modal
     * @param {Object} options - Modal configuration
     * @param {string} options.title - Modal title
     * @param {string} options.message - Modal message
     * @param {string} [options.type='info'] - Modal type (info, success, error, warning)
     * @param {Array} [options.buttons] - Array of button configs
     * @param {Function} [options.onClose] - Callback when modal closes
     * @returns {Promise} Resolves with button that was clicked
     */
    show({ title, message, type = 'info', buttons = null, onClose = null }) {
        return new Promise((resolve) => {
            if (this.isVisible) {
                logger.warn('Modal already visible, hiding current modal first');
                this.hide();
            }

            // Set content
            const titleEl = this.modalElement.querySelector('.dashie-modal__title');
            const messageEl = this.modalElement.querySelector('.dashie-modal__message');
            const iconEl = this.modalElement.querySelector('.dashie-modal__icon');
            const modal = this.modalElement.querySelector('.dashie-modal');

            titleEl.textContent = title;
            messageEl.textContent = message;

            // Set icon based on type
            const icons = {
                info: 'ℹ️',
                success: '✅',
                error: '❌',
                warning: '⚠️'
            };
            iconEl.textContent = icons[type] || icons.info;

            // Remove previous type classes
            modal.classList.remove('dashie-modal--info', 'dashie-modal--success', 'dashie-modal--error', 'dashie-modal--warning');
            modal.classList.add(`dashie-modal--${type}`);

            // Set buttons
            const buttonsContainer = this.modalElement.querySelector('.dashie-modal__buttons');
            buttonsContainer.innerHTML = '';

            // Default to OK button if none provided
            const buttonConfigs = buttons || [{ text: 'OK', primary: true, value: 'ok' }];

            buttonConfigs.forEach((buttonConfig, index) => {
                const button = document.createElement('button');
                button.className = 'dashie-modal__button';
                if (buttonConfig.primary) {
                    button.classList.add('dashie-modal__button--primary');
                }
                button.textContent = buttonConfig.text;
                button.dataset.value = buttonConfig.value || buttonConfig.text.toLowerCase();

                button.addEventListener('click', () => {
                    const returnValue = buttonConfig.value !== undefined ? buttonConfig.value : buttonConfig.text;
                    logger.debug('Button clicked', { text: buttonConfig.text, value: returnValue });
                    this.hide();
                    resolve(returnValue);
                    if (onClose) onClose(returnValue);
                });

                buttonsContainer.appendChild(button);

                // Focus first button
                if (index === 0) {
                    setTimeout(() => button.focus(), 100);
                }
            });

            // Show modal
            this.modalElement.style.display = 'flex';
            this.isVisible = true;

            // Add keyboard listener in CAPTURE phase (fires before other handlers)
            // This is critical to intercept events before Settings input handler
            document.addEventListener('keydown', this.handleKeydown, true);

            logger.info('Modal shown', { title, type });
        });
    }

    /**
     * Hide the modal
     */
    hide() {
        if (!this.isVisible) return;

        // Remove keyboard listener FIRST to prevent any stray events
        // Must match the capture phase flag used when adding
        document.removeEventListener('keydown', this.handleKeydown, true);

        this.modalElement.style.display = 'none';
        this.isVisible = false;

        logger.debug('Modal hidden');
    }

    /**
     * Handle keyboard navigation (d-pad support)
     */
    handleKeydown(event) {
        // Only handle events if modal is visible
        if (!this.isVisible) return;

        const buttons = Array.from(this.modalElement.querySelectorAll('.dashie-modal__button'));
        const focusedButton = document.activeElement;
        const currentIndex = buttons.indexOf(focusedButton);

        switch (event.key) {
            case 'ArrowLeft':
            case 'Left':
                logger.debug('Modal handling ArrowLeft');
                event.preventDefault();
                event.stopImmediatePropagation(); // Stop ALL other handlers including same-level ones
                if (currentIndex > 0) {
                    buttons[currentIndex - 1].focus();
                }
                break;

            case 'ArrowRight':
            case 'Right':
                logger.debug('Modal handling ArrowRight');
                event.preventDefault();
                event.stopImmediatePropagation(); // Stop ALL other handlers including same-level ones
                if (currentIndex < buttons.length - 1) {
                    buttons[currentIndex + 1].focus();
                }
                break;

            case 'Enter':
                logger.debug('Modal handling Enter', { focusedButton: focusedButton?.textContent, isModalButton: buttons.includes(focusedButton) });
                event.preventDefault();
                event.stopImmediatePropagation(); // Stop ALL other handlers including same-level ones
                if (focusedButton && buttons.includes(focusedButton)) {
                    focusedButton.click();
                }
                break;

            case 'Escape':
                logger.debug('Modal handling Escape');
                event.preventDefault();
                event.stopImmediatePropagation(); // Stop ALL other handlers including same-level ones
                // Click first button (usually cancel/ok)
                if (buttons.length > 0) {
                    buttons[0].click();
                }
                break;
        }
    }

    /**
     * Convenience method for info messages
     */
    info(title, message) {
        return this.show({ title, message, type: 'info' });
    }

    /**
     * Convenience method for success messages
     */
    success(title, message) {
        return this.show({ title, message, type: 'success' });
    }

    /**
     * Convenience method for error messages
     */
    error(title, message) {
        return this.show({ title, message, type: 'error' });
    }

    /**
     * Convenience method for warning messages
     */
    warning(title, message) {
        return this.show({ title, message, type: 'warning' });
    }

    /**
     * Convenience method for confirmation dialogs
     */
    confirm(title, message) {
        return this.show({
            title,
            message,
            type: 'warning',
            buttons: [
                { text: 'Cancel', value: false },
                { text: 'Confirm', value: true, primary: true }
            ]
        });
    }
}

// Create singleton instance
const dashieModal = new DashieModal();

export default dashieModal;
