/**
 * index.js - منطق الصفحة الرئيسية (كان مضمّناً كسكربت inline في index.html،
 * نُقل إلى ملف خارجي حتى يعمل تحت سياسة أمان محتوى صارمة بدون 'unsafe-inline')
 */

// التحقق من حالة المصادقة
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.authenticated) {
            window.location.href = '/dashboard';
        }
    } catch (error) {
        console.log('User not authenticated');
    }
}

// التحقق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', checkAuth);
