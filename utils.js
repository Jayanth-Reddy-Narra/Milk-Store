/**
 * Utility functions for formatting, validation, and DOM manipulation.
 */

// Generate a unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Format currency
function formatCurrency(amount, currencySymbol = '₹') {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        currencyDisplay: 'symbol',
    }).format(amount).replace('₹', currencySymbol);
}

// Format date
function formatDate(isoString) {
    if (!isoString) return '';
    return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(isoString));
}

// Show a toast message
let snackbarTimeout;
function showToast(message, allowUndo = false, undoCallback = null) {
    const snackbar = document.getElementById('snackbar');

    let html = message;
    if (allowUndo) {
        // Needs a button for undoing (will bind carefully)
        html += ` <button id="btn-undo" style="background: none; border: none; color: var(--brand-accent); font-weight: bold; cursor: pointer; margin-left: 10px;">UNDO</button>`;
    }

    snackbar.innerHTML = html;
    snackbar.className = "show";

    if (allowUndo && undoCallback) {
        document.getElementById('btn-undo').onclick = () => {
            undoCallback();
            snackbar.className = "";
            clearTimeout(snackbarTimeout);
        };
    }

    clearTimeout(snackbarTimeout);
    snackbarTimeout = setTimeout(function () { snackbar.className = snackbar.className.replace("show", ""); }, 5000);
}

// Escape HTML to prevent XSS
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const span = document.createElement('span');
    span.textContent = str;
    return span.innerHTML;
}
