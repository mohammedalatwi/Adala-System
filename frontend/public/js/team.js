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
                this.renderTeamCards(data.team);
                this.updateStats(data.team);
            }
        } catch (error) {
            console.error('Failed to load team:', error);
            Utils.hideLoading();
        }
    }

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
            const date = Utils.formatDate(member.created_at);
            const initials = member.full_name.charAt(0).toUpperCase();

            const card = document.createElement('div');
            card.className = 'trainee-card';
            card.style.animationDelay = `${index * 0.1}s`;

            card.innerHTML = `
                <div class="card-bg-decoration"></div>
                <div class="card-header-v2">
                    <div class="trainee-avatar-big">${initials}</div>
                    <div class="status-dot" title="نشط"></div>
                </div>

                <div class="trainee-info-main">
                    <div class="trainee-name">${member.full_name}</div>
                    <div class="trainee-username">@${member.username}</div>
                </div>

                <div class="role-chip">
                    <i class="fas fa-user-graduate"></i>
                    <span>متدرب قانوني</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div class="info-row">
                        <i class="fas fa-envelope"></i>
                        <span>${member.email}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-briefcase"></i>
                        <span>${member.specialization || 'تدريب عام'}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-calendar-check"></i>
                        <span>انضم في: ${date}</span>
                    </div>
                </div>

                <div class="card-actions-v2">
                    <button class="btn btn-credential" onclick="TeamManager.copyMemberInfo('${member.username}', '${member.full_name}')" title="نسخ بيانات الدخول للمتدرب">
                        <i class="fas fa-share-square"></i> نسخ البيانات
                    </button>
                    <button class="btn btn-outline text-danger" onclick="TeamManager.deleteMember(${member.id})" style="border-radius: 10px;">
                        <i class="fas fa-user-minus"></i> تعطيل
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    static updateStats(members) {
        document.getElementById('totalMembers').textContent = members.length;
        document.getElementById('activeTrainees').textContent = members.filter(m => m.role === 'trainee' && m.is_active).length;
    }

    static setupEventListeners() {
        const modal = document.getElementById('memberModal');
        const btnAdd = document.getElementById('btnAddMember');
        const closeBtns = document.querySelectorAll('.close-modal');
        const form = document.getElementById('memberForm');

        if (btnAdd) btnAdd.onclick = () => modal.style.display = 'flex';
        closeBtns.forEach(btn => btn.onclick = () => modal.style.display = 'none');

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const body = Object.fromEntries(formData.entries());

                try {
                    Utils.showLoading('جاري إنشاء الحساب...');
                    const result = await API.post('/team/add', body);
                    Utils.hideLoading();

                    if (result.success) {
                        Utils.showMessage('تم إنشاء حساب المتدرب بنجاح! يمكنك الآن إرسال بيانات الدخول له.', 'success');
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
        const message = `أهلاً بك يا ${fullName}، تم إنشاء حسابك في نظام عدالة.\n\nبيانات الدخول:\nاسم المستخدم: ${username}\nرابط الدخول: ${loginUrl}\n\n(استخدم كلمة المرور التي حددها لك المحامي)`;

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
