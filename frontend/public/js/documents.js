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
                const cases = result.data.cases || result.data;
                const options = cases.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
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
                // Backend now returns { documents, pagination } in data
                this.renderDocuments(result.data.documents);
            }
        } catch (error) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red;">خطأ: ${error.message}</div>`;
        }
    }

    static renderDocuments(docs) {
        const grid = document.getElementById('docsGrid');

        if (!docs || docs.length === 0) {
            grid.innerHTML = `
                <div class="card" style="grid-column: 1/-1; text-align:center; padding:5rem; background: var(--glass-bg);">
                    <div style="width:100px; height:100px; background:rgba(37, 99, 235, 0.05); color:var(--brand-primary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:3.5rem; margin:0 auto 1.5rem; opacity:0.3;">
                        <i class="fas fa-folder-open"></i>
                    </div>
                    <h3 style="font-weight:800; font-size:1.5rem;">الأرشيف فارغ حالياً</h3>
                    <p style="color:var(--text-muted);">ابدأ برفع مستندات القضايا أو المذكرات لتنظيم عملك بشكل رقمي محترف.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = docs.map(doc => {
            const iconClass = this.getFileIcon(doc.file_type);
            const iconColor = this.getFileColor(doc.file_type);

            return `
            <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column; transition: var(--transition-base);">
                <div style="height:140px; background: linear-gradient(135deg, ${iconColor}08, ${iconColor}15); display:flex; align-items:center; justify-content:center; position:relative; border-bottom:1px solid var(--border-color);">
                    <i class="${iconClass}" style="font-size:3.5rem; color:${iconColor}; filter: drop-shadow(0 4px 6px ${iconColor}33);"></i>
                    <div style="position:absolute; bottom:0.75rem; right:0.75rem; background:rgba(255,255,255,0.9); padding:4px 10px; border-radius:8px; font-size:0.7rem; font-weight:800; color:${iconColor}; border:1px solid ${iconColor}22;">
                        ${doc.file_type ? doc.file_type.split('/')[1].toUpperCase() : 'DOC'}
                    </div>
                </div>
                <div style="padding:1.25rem;">
                    <h4 style="margin:0; font-size:1rem; font-weight:800; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${doc.title}">
                        ${doc.title}
                    </h4>
                    <div style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.5rem;">
                        <div style="font-size:0.85rem; color:var(--brand-primary); font-weight:700;">
                            <i class="fas fa-briefcase" style="width:16px;"></i> ${doc.case_title || 'مستند عام'}
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">
                            <i class="far fa-clock" style="width:16px;"></i> ${new Date(doc.uploaded_at).toLocaleDateString('ar-SA')}
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-top:1.25rem;">
                        <button class="btn btn-outline" style="border-radius:10px; font-weight:700; font-size:0.85rem; border-color:var(--brand-primary)44; color:var(--brand-primary);" onclick="DocumentsManager.downloadDoc(${doc.id})">
                            <i class="fas fa-download"></i> تحميل
                        </button>
                        <button class="btn btn-outline" style="border-radius:10px; font-weight:700; font-size:0.85rem; color:var(--danger); border-color:var(--danger)44;" onclick="DocumentsManager.deleteDoc(${doc.id})">
                            <i class="fas fa-trash-alt"></i> حذف
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    static getFileColor(mime) {
        if (!mime) return '#94a3b8';
        if (mime.includes('pdf')) return '#ef4444';
        if (mime.includes('image')) return '#10b981';
        if (mime.includes('word') || mime.includes('document')) return '#3b82f6';
        if (mime.includes('excel') || mime.includes('sheet')) return '#22c55e';
        return '#64748b';
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
