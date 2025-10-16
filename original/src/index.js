// Index page JavaScript functionality

// Authentication button handler
function handleAuthButton() {
    const authData = localStorage.getItem('courtorder_auth');
    if (authData) {
        try {
            const auth = JSON.parse(authData);
            if (auth.isLoggedIn) {
                // User is logged in, show logout option
                if (confirm('Do you want to sign out?')) {
                    localStorage.removeItem('courtorder_auth');
                    location.reload();
                }
                return;
            }
        } catch (e) {
            // Invalid auth data, clear it
            localStorage.removeItem('courtorder_auth');
        }
    }
    // User is not logged in, redirect to login
    window.location.href = 'login.html';
}

// Update auth button based on login status
function updateAuthButton() {
    const authBtn = document.getElementById('auth-btn');
    const authData = localStorage.getItem('courtorder_auth');
    
    if (authData) {
        try {
            const auth = JSON.parse(authData);
            if (auth.isLoggedIn) {
                authBtn.textContent = `Sign Out (${auth.username})`;
                return;
            }
        } catch (e) {
            localStorage.removeItem('courtorder_auth');
        }
    }
    authBtn.textContent = 'Sign In';
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    updateAuthButton();
});

// Make functions globally available
window.handleAuthButton = handleAuthButton;
