/**
 * documents.js - V3.0 Documents Manager
 */
class DocumentsManager {
    static selectedFile = null;

    static async init() {
        await this.checkAuth();
        this.setupEventListeners();

        await this.loadCasesForFilter();
        this.loadDocuments();

        console.log('✅ Documents Manager Ready');
    }

    static async checkAuth() {
        const auth = await API.get('/auth/status');
        if (!auth.authenticated) {
            window.location.href = '/login';
        } else {
            if (auth.user) {
                document.getElementById('userName').textContent = auth.user.full_name;
                document.getElementById('userRole').textContent = auth.user.role;
                document.getElementById('userAvatar').textContent = auth.user.full_name.charAt(0).toUpperCase();
            }
        }
    }

    static setupEventListeners() {
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await API.post('/auth/logout');
            window.location.href = '/login';
        });

        // Search & Filter
        document.getElementById('searchInput').addEventListener('input', Utils.debounce(() => this.loadDocuments(), 500));
        document.getElementById('caseFilter').addEventListener('change', () => this.loadDocuments());
        document.getElementById('typeFilter').addEventListener('change', () => this.loadDocuments());

        // File Input Handling
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });

        // Drag & Drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelection(e.dataTransfer.files[0]);
            }
        });

        // Modal outside click
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('uploadModal')) {
                this.closeUploadModal();
            }
        });
    }

    static async loadCasesForFilter() {
        try {
            const result = await API.get('/cases?limit=100');
            if (result.success) {
                const options = result.data.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
                document.getElementById('caseFilter').insertAdjacentHTML('beforeend', options);
                document.getElementById('docCase').insertAdjacentHTML('beforeend', options);
            }
        } catch (error) {
            console.error('Failed to load cases:', error);
        }
    }

    static async loadDocuments() {
        const grid = document.getElementById('docsGrid');
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';

        const params = {
            search: document.getElementById('searchInput').value,
            case_id: document.getElementById('caseFilter').value,
            document_type: document.getElementById('typeFilter').value,
            limit: 50
        };
        // Clean params
        Object.keys(params).forEach(key => !params[key] && delete params[key]);

        try {
            const result = await API.get('/documents', params);
            if (result.success) {
                this.renderDocuments(result.data);
            }
        } catch (error) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red;">خطأ: ${error.message}</div>`;
        }
    }

    static renderDocuments(docs) {
        const grid = document.getElementById('docsGrid');

        if (!docs || docs.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
                    <i class="fas fa-file-contract" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <h3>المجلد فارغ</h3>
                    <p>قم برفع المستندات لتظهر هنا</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = docs.map(doc => `
            <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; padding:0;">
                <div style="height:120px; background:var(--bg-body); display:flex; align-items:center; justify-content:center; font-size:3rem; color:var(--brand-primary-light);">
                    <i class="${this.getFileIcon(doc.file_type)}"></i>
                </div>
                <div style="padding:1rem;">
                    <h4 style="margin:0 0 0.5rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${doc.title}">${doc.title}</h4>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
                        <div><i class="fas fa-folder"></i> ${doc.case_title || 'عام'}</div>
                        <div><i class="fas fa-clock"></i> ${new Date(doc.uploaded_at).toLocaleDateString()}</div>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <button class="btn btn-sm btn-outline" style="color:var(--brand-primary);" onclick="DocumentsManager.downloadDoc(${doc.id})">
                            <i class="fas fa-download"></i> تحميل
                        </button>
                        <button class="btn btn-sm btn-outline" style="color:var(--danger);" onclick="DocumentsManager.deleteDoc(${doc.id})">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    static getFileIcon(mime) {
        if (!mime) return 'fas fa-file';
        if (mime.includes('pdf')) return 'fas fa-file-pdf';
        if (mime.includes('image')) return 'fas fa-file-image';
        if (mime.includes('word') || mime.includes('document')) return 'fas fa-file-word';
        if (mime.includes('excel') || mime.includes('sheet')) return 'fas fa-file-excel';
        return 'fas fa-file-alt';
    }

    static handleFileSelection(file) {
        this.selectedFile = file;
        this.openUploadModal();
        document.getElementById('docTitle').value = file.name;
    }

    static openUploadModal() {
        document.getElementById('uploadModal').style.display = 'flex';
        if (!this.selectedFile) {
            // Trigger file input if opened via button without drag/drop
            // For now, we rely on the drag/drop or the file input change to set selectedFile.
            // If opened manually, we need to handle that logic separate or just let user drag drop.
            // Simplified: Button clicks the hidden input in setupEventListeners.
            // This method is called AFTER file selected.
            // If called from button (which it isn't directly, button triggers file input), we're good.
            // Wait, the HTML button calls this directly. Let's fix that interaction.
        }
        // If opened via button "Upload", initiate file picker first? 
        // Logic fix: The "Upload" button in HTML calls openUploadModal(). 
        // It should probably simulate dropzone click if no file selected.
        if (!this.selectedFile) {
            document.getElementById('uploadModal').style.display = 'none'; // Close
            document.getElementById('fileInput').click(); // Pick file
            return;
        }
    }

    // Adjusted logic: Button triggers file select, which triggers modal. 
    // But if we want a modal where users DROP files, we need to open it empty? 
    // Let's stick to: Click Upload -> Pick File -> Open Modal with file pre-filled.

    static closeUploadModal() {
        document.getElementById('uploadModal').style.display = 'none';
        document.getElementById('uploadForm').reset();
        this.selectedFile = null;
        // Reset file input value to allow selecting same file again
        document.getElementById('fileInput').value = '';
    }

    static async uploadFile() {
        if (!this.selectedFile) {
            Utils.showMessage('يرجى اختيار ملف', 'error');
            return;
        }

        const title = document.getElementById('docTitle').value;
        if (!title) {
            Utils.showMessage('العنوان مطلوب', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('case_id', document.getElementById('docCase').value);
        formData.append('document_type', document.getElementById('docType').value);
        formData.append('file', this.selectedFile);

        try {
            // Can't use API.post because it handles JSON. Need fetch wrapper or handle Multipart.
            // API.js usually assumes JSON. Let's start raw fetch or update API.js.
            // Updating API.js is risky mid-flight. Use raw fetch here for safety.

            Utils.showLoading('جاري الرفع...');
            const response = await fetch('/api/documents', {
                method: 'POST',
                body: formData // No headers, let browser set boundary
            });

            const result = await response.json();
            Utils.hideLoading();

            if (result.success) {
                Utils.showMessage('تم رفع المستند بنجاح', 'success');
                this.closeUploadModal();
                this.loadDocuments();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showMessage('فشل الرفع: ' + error.message, 'error');
        }
    }

    static async downloadDoc(id) {
        window.location.href = `/api/documents/${id}/download`;
    }

    static async deleteDoc(id) {
        if (confirm('هل أنت متأكد؟')) {
            try {
                const result = await API.delete(`/documents/${id}`);
                if (result.success) this.loadDocuments();
            } catch (e) {
                console.error(e);
            }
        }
    }
}

window.DocumentsManager = DocumentsManager;
document.addEventListener('DOMContentLoaded', () => DocumentsManager.init());
