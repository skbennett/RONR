// Global access control system for CourtOrder
(function() {
    'use strict';

    // Check if user is authenticated
    function isAuthenticated() {
        try {
            const authData = localStorage.getItem('courtorder_auth');
            if (!authData) return false;
            
            const auth = JSON.parse(authData);
            return auth.isLoggedIn && auth.username;
        } catch (e) {
            // Clear invalid auth data
            localStorage.removeItem('courtorder_auth');
            return false;
        }
    }

    // Get current page name
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        if (filename === 'index.html' || filename === '') {
            return 'home';
        } else if (filename === 'login.html') {
            return 'login';
        } else if (filename === 'meetings.html') {
            return 'meetings';
        } else if (filename === 'coordination.html') {
            return 'coordination';
        }
        return 'unknown';
    }

    // Pages that require authentication (home/index is now public)
    const protectedPages = ['meetings', 'coordination', 'unknown'];
    
    // Show access denied page
    function showAccessDenied() {
        document.body.innerHTML = `
            <div class="access-denied-container">
                <div class="access-denied-content">
                    <div class="access-denied-icon">🚫</div>
                    <h1>Access Denied</h1>
                    <h2>Authentication Required</h2>
                    <p>You must be logged in to access this page.</p>
                    <p>Please sign in to continue, or visit our home page to learn more about CourtOrder.</p>
                    <div class="access-denied-actions">
                        <button onclick="window.location.href='RONR/login.html'" class="login-redirect-btn">
                            Sign In to Continue
                        </button>
                        <button onclick="window.location.href='RONR/index.html'" class="home-redirect-btn">
                            Visit Home Page
                        </button>
                    </div>
                    <div class="access-denied-info">
                        <p><strong>CourtOrder</strong> - Structured Meeting Management</p>
                        <p>Following Robert's Rules of Order</p>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles for access denied page
        const style = document.createElement('style');
        style.textContent = `
            .access-denied-container {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #9EC1A3 0%, #7AAE8C 100%);
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            }
            
            .access-denied-content {
                background: white;
                border-radius: 20px;
                padding: 60px 40px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                max-width: 500px;
                width: 100%;
                border: 3px solid #7AAE8C;
            }
            
            .access-denied-icon {
                font-size: 80px;
                margin-bottom: 20px;
                display: block;
            }
            
            .access-denied-content h1 {
                color: #d32f2f;
                font-size: 36px;
                margin: 0 0 10px 0;
                font-weight: bold;
            }
            
            .access-denied-content h2 {
                color: #2c5530;
                font-size: 24px;
                margin: 0 0 30px 0;
                font-weight: normal;
            }
            
            .access-denied-content p {
                color: #666;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 15px 0;
            }
            
            .access-denied-actions {
                margin: 40px 0 30px 0;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .login-redirect-btn, .home-redirect-btn {
                padding: 15px 30px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                display: inline-block;
            }
            
            .login-redirect-btn {
                background-color: #7AAE8C;
                color: white;
            }
            
            .login-redirect-btn:hover {
                background-color: #6a9e7c;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(122, 174, 140, 0.3);
            }
            
            .home-redirect-btn {
                background-color: #f8f9fa;
                color: #2c5530;
                border: 2px solid #7AAE8C;
            }
            
            .home-redirect-btn:hover {
                background-color: #e9ecef;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            
            .access-denied-info {
                border-top: 1px solid #eee;
                padding-top: 20px;
                margin-top: 20px;
            }
            
            .access-denied-info p {
                font-size: 14px;
                color: #888;
                margin: 5px 0;
            }
            
            .access-denied-info p:first-child {
                font-weight: bold;
                color: #2c5530;
            }
            
            @media (max-width: 600px) {
                .access-denied-content {
                    padding: 40px 20px;
                }
                
                .access-denied-content h1 {
                    font-size: 28px;
                }
                
                .access-denied-content h2 {
                    font-size: 20px;
                }
                
                .access-denied-icon {
                    font-size: 60px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Main access control function
    function checkAccess() {
        const currentPage = getCurrentPage();
        console.log('Access Control - Current page:', currentPage);
        console.log('Access Control - Is authenticated:', isAuthenticated());
        console.log('Access Control - Protected pages:', protectedPages);
        
        // ALWAYS allow access to login page and home page - no restrictions
        if (currentPage === 'login' || currentPage === 'home') {
            console.log('Access Control - Public page, allowing access unconditionally');
            return true;
        }
        
        // Only check authentication for protected pages
        if (protectedPages.includes(currentPage)) {
            console.log('Access Control - Page requires authentication');
            if (!isAuthenticated()) {
                console.log('Access Control - User not authenticated, showing access denied');
                showAccessDenied();
                return false;
            }
            console.log('Access Control - User authenticated, allowing access');
            return true;
        }
        
        // For any other pages, allow access by default
        console.log('Access Control - Unknown page, allowing access by default');
        return true;
    }

    // Run access control check immediately - don't wait for DOM
    checkAccess();
    
    // Also run when DOM is ready (in case the first check was too early)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAccess);
    }

    // Also check on page visibility change (when user switches tabs)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            checkAccess();
        }
    });

    // Prevent navigation to protected pages via JavaScript
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
        originalPushState.apply(history, arguments);
        setTimeout(checkAccess, 0);
    };
    
    history.replaceState = function() {
        originalReplaceState.apply(history, arguments);
        setTimeout(checkAccess, 0);
    };
    
    window.addEventListener('popstate', function() {
        setTimeout(checkAccess, 0);
    });
})();
