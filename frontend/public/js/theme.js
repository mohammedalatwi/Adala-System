class ThemeManager {
    static init() {
        // Check for saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);

        // Add toggle button to navbar if not exists
        this.addToggleButton();
    }

    static setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateIcon(theme);
    }

    static toggle() {
        const current = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
        this.setTheme(current);
    }

    static addToggleButton() {
        const nav = document.querySelector('.navbar-nav');
        if (nav && !document.getElementById('themeToggle')) {
            const li = document.createElement('li');
            li.innerHTML = `
                <button id="themeToggle" class="btn btn-sm btn-outline" style="border:none; font-size:1.2rem;" title="تغيير المظهر">
                    <i class="fas fa-moon"></i>
                </button>
            `;
            nav.insertBefore(li, nav.firstChild);

            li.querySelector('button').addEventListener('click', () => this.toggle());
            this.updateIcon(localStorage.getItem('theme'));
        }
    }

    static updateIcon(theme) {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            const icon = btn.querySelector('i');
            if (theme === 'dark') {
                icon.className = 'fas fa-sun';
                icon.style.color = '#f59e0b';
            } else {
                icon.className = 'fas fa-moon';
                icon.style.color = '#4b5563';
            }
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
