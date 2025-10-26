/**
 * auth.js - إدارة المصادقة
 */

class AuthManager {
    // ✅ تسجيل الدخول
    static async login(credentials) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(credentials)
            });

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'فشل في الاتصال بالخادم'
            };
        }
    }

    // ✅ التسجيل
    static async register(userData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Register error:', error);
            return {
                success: false,
                message: 'فشل في الاتصال بالخادم'
            };
        }
    }

    // ✅ تسجيل الخروج
    static async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Logout error:', error);
            return {
                success: false,
                message: 'فشل في الاتصال بالخادم'
            };
        }
    }

    // ✅ التحقق من حالة الجلسة
    static async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status', {
                credentials: 'include'
            });

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Auth status error:', error);
            return {
                authenticated: false,
                user: null
            };
        }
    }

    // ✅ التحقق من توفر اسم المستخدم
    static async checkUsernameAvailability(username) {
        try {
            const response = await fetch(`/api/auth/check-username/${username}`, {
                credentials: 'include'
            });

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Username check error:', error);
            return {
                available: false,
                message: 'فشل في التحقق'
            };
        }
    }

    // ✅ التحقق من توفر البريد الإلكتروني
    static async checkEmailAvailability(email) {
        try {
            const response = await fetch(`/api/auth/check-email/${email}`, {
                credentials: 'include'
            });

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Email check error:', error);
            return {
                available: false,
                message: 'فشل في التحقق'
            };
        }
    }

    // ✅ إعادة التوجيه بناءً على حالة المصادقة
    static async redirectBasedOnAuth() {
        try {
            const authStatus = await this.checkAuthStatus();
            
            if (authStatus.authenticated) {
                // إذا كان مسجل الدخول بالفعل، توجيه إلى لوحة التحكم
                window.location.href = '/dashboard';
            }
            // إذا لم يكن مسجل الدخول، يبقى في صفحة التسجيل/الدخول
        } catch (error) {
            console.error('Auth redirect error:', error);
        }
    }

    // ✅ التحقق من الصلاحيات
    static async checkPermission(requiredRole) {
        try {
            const authStatus = await this.checkAuthStatus();
            
            if (!authStatus.authenticated) {
                return false;
            }

            if (requiredRole && authStatus.user.role !== requiredRole) {
                return false;
            }

            return true;

        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }
}

// ✅ جعل AuthManager متاحاً globally
window.AuthManager = AuthManager;