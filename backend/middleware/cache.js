/**
 * cache.js - نظام التخزين المؤقت المتقدم
 */

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 دقائق افتراضياً
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        
        console.log('✅ نظام التخزين المؤقت مفعل');
    }

    // ✅ تخزين قيمة في الذاكرة المؤقتة
    set(key, value, ttl = this.defaultTTL) {
        try {
            this.cache.set(key, {
                value: JSON.parse(JSON.stringify(value)), // Deep clone
                expiry: Date.now() + ttl,
                createdAt: Date.now(),
                accessCount: 0
            });
            
            this.stats.sets++;
            return true;
        } catch (error) {
            console.error('❌ خطأ في التخزين المؤقت:', error);
            return false;
        }
    }

    // ✅ جلب قيمة من الذاكرة المؤقتة
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        
        item.accessCount++;
        this.stats.hits++;
        return item.value;
    }

    // ✅ حذف قيمة من الذاكرة المؤقتة
    delete(key) {
        const existed = this.cache.delete(key);
        if (existed) {
            this.stats.deletes++;
        }
        return existed;
    }

    // ✅ التحقق من وجود قيمة
    has(key) {
        const item = this.cache.get(key);
        if (!item) return false;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }

    // ✅ مسح الذاكرة المؤقتة بالكامل
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`🧹 تم مسح ${size} عنصر من الذاكرة المؤقتة`);
        return size;
    }

    // ✅ الحصول على إحصائيات الاستخدام
    getStats() {
        const now = Date.now();
        let expiredCount = 0;
        let totalSize = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                expiredCount++;
            }
            totalSize += JSON.stringify(item.value).length;
        }

        return {
            ...this.stats,
            totalItems: this.cache.size,
            expiredItems: expiredCount,
            hitRate: this.stats.hits + this.stats.misses > 0 
                ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) 
                : 0,
            memoryUsage: `${(totalSize / 1024).toFixed(2)} KB`
        };
    }

    // ✅ تنظيف الذاكرة المؤقتة تلقائياً
    startCleanup(interval = 60 * 1000) {
        setInterval(() => {
            const now = Date.now();
            let cleanedCount = 0;

            for (const [key, item] of this.cache.entries()) {
                if (now > item.expiry) {
                    this.cache.delete(key);
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                console.log(`🧹 تم تنظيف ${cleanedCount} عنصر من الذاكرة المؤقتة`);
            }
        }, interval);

        console.log(`✅ بدأ التنظيف التلقائي كل ${interval / 1000} ثانية`);
    }

    // ✅ جلب جميع المفاتيح (لأغراض التصحيح)
    getKeys() {
        return Array.from(this.cache.keys());
    }

    // ✅ تجديد مدة العنصر
    renew(key, ttl = this.defaultTTL) {
        const item = this.cache.get(key);
        if (item) {
            item.expiry = Date.now() + ttl;
            return true;
        }
        return false;
    }

    // ✅ التخزين المؤقت للاستعلامات (خاص بقاعدة البيانات)
    async cachedQuery(cacheKey, queryFunction, ttl = this.defaultTTL) {
        // التحقق من الذاكرة المؤقتة أولاً
        const cached = this.get(cacheKey);
        if (cached) {
            return cached;
        }

        // إذا لم تكن في الذاكرة، تنفيذ الاستعلام
        try {
            const result = await queryFunction();
            this.set(cacheKey, result, ttl);
            return result;
        } catch (error) {
            console.error('❌ خطأ في الاستعلام المؤقت:', error);
            throw error;
        }
    }
}

// إنشاء نسخة واحدة من المدير
const cacheManager = new CacheManager();

// بدء التنظيف التلقائي
cacheManager.startCleanup();

module.exports = cacheManager;