/**
 * api.js - Unified API Client for Adala System V2
 */
class API {
    static baseURL = '/api';

    static async request(endpoint, options = {}) {
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const config = {
            ...options,
            headers: { ...defaultHeaders, ...options.headers }
        };

        try {
            // Show loading indicator automatically for mutations
            if (options.method && options.method !== 'GET') Utils.showLoading();

            const response = await fetch(`${this.baseURL}${endpoint}`, config);

            // Handle 401 Unauthorized globally
            if (response.status === 401) {
                window.location.href = '/login';
                return null;
            }

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Non-JSON Response:', text);
                throw new Error('Server returned non-JSON response: ' + response.status);
            }

            if (!response.ok) {
                console.error('Server Error Data:', data);
                throw new Error(data.message || 'Server Error');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            Utils.showMessage(error.message, 'error');
            throw error;
        } finally {
            if (options.method && options.method !== 'GET') Utils.hideLoading();
        }
    }

    // HTTP Methods
    static get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    static post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    }

    static put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    }

    static delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Global Export
window.API = API;
