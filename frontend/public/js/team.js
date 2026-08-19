/**
 * team.js - إدارة فريق العمل والمتدربين (Premium UI Logic)
 */

class TeamManager {
    static init() {
        this.loadTeam();
        this.setupEventListeners();
    }

    static async loadTeam() {
        try {
            Utils.showLoading('جاري جلب بيانات الفريق...');
            const data = await API.get('/team');
            Utils.hideLoading();

            if (data.success) {
                this.renderTeamCards(data.data);
                this.updateStats(data.data);
            }
        } catch (error) {
            console.error('Failed to load team:', error);
            Utils.hideLoading();
        }
    }

    static ROLE_BADGE = {
        admin: { icon: 'fa-user-shield', label: 'أدمن' },
        lawyer: { icon: 'fa-gavel', label: 'محامي' },
        trainee: { icon: 'fa-user-graduate', label: 'متدرب قانوني' },
        client: { icon: 'fa-address-card', label: 'عميل بوابة' }
    };

    static renderTeamCards(members) {
        const grid = document.getElementById('teamGrid');
        const emptyState = document.getElementById('emptyState');
        grid.innerHTML = '';

        if (!members || members.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        members.forEach((member, index) => {
            const initials = member.full_name.charAt(0).toUpperCase();
            const badge = this.ROLE_BADGE[member.role] || { icon: 'fa-user', label: member.role };

            const card = document.createElement('div');
            card.className = 'card';
            card.style = `
                display:flex; 
                flex-direction:column; 
                gap:1.25rem; 
                padding:1.75rem; 
                animation: slideUp 0.3s ease-out forwards; 
                animation-delay: ${index * 0.05}s;
                position:relative;
                overflow:hidden;
            `;

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:1.25rem;">
                    <div class="user-avatar" style="width:65px; height:65px; font-size:1.5rem; border: 3px solid var(--bg-surface-hover); box-shadow: var(--shadow-sm); background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-dark)); color:white;">
                        ${Utils.escapeHTML(initials)}
                    </div>
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:var(--text-main);">${Utils.escapeHTML(member.full_name)}</h3>
                        <div style="font-size:0.9rem; color:var(--brand-primary); font-weight:700; margin-top:0.2rem;">
                            @${Utils.escapeHTML(member.username)}
                        </div>
                    </div>
                    <div class="status-dot" style="position:absolute; top:1.5rem; left:1.5rem;" title="نشط"></div>
                </div>

                <div style="display:inline-flex; align-items:center; gap:0.5rem; background:rgba(37, 99, 235, 0.08); color:var(--brand-primary); padding:6px 14px; border-radius:10px; font-size:0.85rem; font-weight:800; width:fit-content; border: 1px solid rgba(37, 99, 235, 0.15);">
                    <i class="fas ${badge.icon}"></i> ${Utils.escapeHTML(badge.label)}
                </div>

                <div style="display:flex; flex-direction:column; gap:0.75rem; background: var(--bg-body); padding:1rem; border-radius:14px; border:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:0.75rem; font-size:0.9rem; color:var(--text-muted);">
                        <i class="fas fa-envelope" style="width:16px; color:var(--brand-primary);"></i>
                        <span style="font-weight:600;">${Utils.escapeHTML(member.email)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.75rem; font-size:0.9rem; color:var(--text-muted);">
                        <i class="fas fa-briefcase" style="width:16px; color:var(--brand-primary);"></i>
                        <span style="font-weight:600;">${member.specialization ? Utils.escapeHTML(member.specialization) : 'تدريب عام'}</span>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-top:0.5rem;">
                    <button class="btn btn-outline btn-copy-member" style="border-radius:12px; font-weight:700; font-size:0.85rem; border-style:dashed;">
                        <i class="fas fa-copy"></i> نسخ البيانات
                    </button>
                    <button class="btn btn-outline btn-delete-member" style="border-radius:12px; font-weight:700; font-size:0.85rem; color:var(--danger); border-color:var(--danger)44;">
                        <i class="fas fa-user-slash"></i> تعطيل
                    </button>
                </div>
            `;

            // ربط زر "نسخ البيانات" عبر مستمع حدث بدلاً من onclick لتفادي حقن الشيفرة
            // عبر اسم المستخدم أو الاسم الكامل (تهريب HTML وحده لا يحمي داخل onclick)
            card.querySelector('.btn-copy-member')
                .addEventListener('click', () => this.copyMemberInfo(member.username, member.full_name));

            // ربط زر "تعطيل" عبر مستمع حدث بدلاً من onclick (يتوافق مع سياسة أمان المحتوى)
            card.querySelector('.btn-delete-member')
                .addEventListener('click', () => this.deleteMember(member.id));

            grid.appendChild(card);
        });
    }

    static updateStats(members) {
        document.getElementById('totalMembers').textContent = members.length;
        document.getElementById('activeTrainees').textContent = members.filter(m => m.role === 'trainee' && m.is_active).length;
    }

    static ROLE_INFO = {
        trainee: 'سيتمكن المتدرب من الدخول لرؤية القضايا المسندة له فقط، ولن يرى أي مبالغ مالية.',
        lawyer: 'سيتمكن المحامي من الدخول لإدارة القضايا المسندة له والتعامل مع بياناتها.',
        client: 'سيتمكن العميل من الدخول لبوابة العملاء لمتابعة قضاياه وفواتيره الخاصة فقط.'
    };

    static ROLE_LABELS = {
        trainee: 'المتدرب',
        lawyer: 'المحامي',
        client: 'العميل'
    };

    static async loadClientsForPicker() {
        try {
            const result = await API.get('/clients', { limit: 100 });
            const select = document.getElementById('clientIdSelect');
            const clients = (result.success && result.data.clients) || [];

            select.innerHTML = '<option value="">-- اختر عميلاً --</option>' +
                clients.map(c => `<option value="${c.id}">${Utils.escapeHTML(c.full_name)}</option>`).join('');
        } catch (error) {
            console.error('Failed to load clients for picker:', error);
        }
    }

    static updateFormForRole(role) {
        document.getElementById('specializationGroup').style.display = role === 'client' ? 'none' : 'block';
        document.getElementById('clientIdGroup').style.display = role === 'client' ? 'block' : 'none';
        document.getElementById('modalInfoBanner').innerHTML =
            `<i class="fas fa-info-circle"></i> ${this.ROLE_INFO[role] || ''}`;
    }

    static setupEventListeners() {
        const modal = document.getElementById('memberModal');
        const btnAdd = document.getElementById('btnAddMember');
        const closeBtns = document.querySelectorAll('.close-modal');
        const form = document.getElementById('memberForm');
        const roleSelect = document.getElementById('memberRoleSelect');

        if (btnAdd) {
            btnAdd.onclick = () => {
                modal.style.display = 'flex';
                this.updateFormForRole(roleSelect.value);
                this.loadClientsForPicker();
            };
        }
        closeBtns.forEach(btn => btn.onclick = () => modal.style.display = 'none');

        if (roleSelect) {
            roleSelect.addEventListener('change', () => this.updateFormForRole(roleSelect.value));
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const body = Object.fromEntries(formData.entries());

                try {
                    Utils.showLoading('جاري إنشاء الحساب...');
                    const result = await API.post('/team/members', body);
                    Utils.hideLoading();

                    if (result.success) {
                        const roleLabel = this.ROLE_LABELS[body.role] || 'العضو';
                        Utils.showMessage(`تم إنشاء حساب ${roleLabel} بنجاح! يمكنك الآن إرسال بيانات الدخول له.`, 'success');
                        modal.style.display = 'none';
                        form.reset();
                        this.loadTeam();
                    }
                } catch (error) {
                    console.error('Failed to add member:', error);
                    Utils.hideLoading();
                }
            };
        }

        window.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        }
    }

    /**
     * نسخ بيانات الدخول للمتدرب ليتمكن المحامي من إرسالها له
     */
    static copyMemberInfo(username, fullName) {
        const loginUrl = window.location.origin + '/login';
        const message = `أهلاً بك يا ${fullName}، تم إنشاء حسابك في نظام عدالة.\n\nبيانات الدخول:\nاسم المستخدم: ${username}\nرابط الدخول: ${loginUrl}\n\n(استخدم كلمة المرور المؤقتة التي تم تحديدها لك)`;

        Utils.copyToClipboard(message);
        Utils.showMessage('تم نسخ رسالة بيانات الدخول! يمكنك الآن إرسالها للمتدرب عبر الواتساب.', 'success');
    }

    static async deleteMember(id) {
        if (!confirm('هل أنت متأكد من تعطيل حساب هذا العضو؟ لن يتمكن من الدخول للنظام بعد الآن.')) return;

        try {
            Utils.showLoading('جاري التعطيل...');
            const result = await API.delete(`/team/${id}`);
            Utils.hideLoading();

            if (result.success) {
                Utils.showMessage('تم تعطيل الحساب بنجاح', 'success');
                this.loadTeam();
            }
        } catch (error) {
            console.error('Failed to delete member:', error);
            Utils.hideLoading();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => TeamManager.init());
