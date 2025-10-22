// Simple URL-based routing system for CourtOrder
class Router {
    constructor() {
        this.routes = new Map();
        this.currentPage = null;
        
        // Initialize routing
        this.init();
    }

    init() {
        // Listen for URL changes
        window.addEventListener('popstate', () => this.handleRoute());
        
        // Handle initial load
        this.handleRoute();
    }

    // Register a route
    addRoute(path, handler) {
        this.routes.set(path, handler);
    }

    // Navigate to a route
    navigate(path) {
        history.pushState(null, null, path);
        this.handleRoute();
    }

    // Handle current route
    handleRoute() {
        const path = window.location.pathname;
        const page = this.getPageFromPath(path);
        
        // Check authentication for protected pages
        if (this.isProtectedPage(page) && !this.isAuthenticated()) {
            this.navigate('/login.html');
            return;
        }

        this.currentPage = page;
        
        // Execute route handler if exists
        if (this.routes.has(page)) {
            this.routes.get(page)();
        }
    }

    // Extract page name from path
    getPageFromPath(path) {
        if (path === '/' || path === '/index.html' || path.endsWith('/index.html')) {
            return 'home';
        } else if (path.includes('login.html')) {
            return 'login';
        } else if (path.includes('meetings.html')) {
            return 'meetings';
        } else if (path.includes('coordination.html')) {
            return 'coordination';
        }
        return 'home';
    }

    // Check if page requires authentication
    isProtectedPage(page) {
        const protectedPages = ['meetings', 'coordination'];
        return protectedPages.includes(page);
    }

    // Check if user is authenticated
    isAuthenticated() {
        const authData = localStorage.getItem('courtorder_auth');
        if (!authData) return false;
        
        try {
            const auth = JSON.parse(authData);
            return auth.isLoggedIn && auth.username;
        } catch (e) {
            return false;
        }
    }

    // Get current user
    getCurrentUser() {
        const authData = localStorage.getItem('courtorder_auth');
        if (!authData) return null;
        
        try {
            const auth = JSON.parse(authData);
            return auth.isLoggedIn ? auth.username : null;
        } catch (e) {
            return null;
        }
    }
}

// Global router instance
window.router = new Router();
