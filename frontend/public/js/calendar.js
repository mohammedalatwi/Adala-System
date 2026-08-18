/**
 * calendar.js - إدارة التقويم التفاعلي المطور
 */

class CalendarManager {
    static calendar = null;

    static init() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ar',
            direction: 'rtl',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            buttonText: {
                today: 'اليوم',
                month: 'شهر',
                week: 'أسبوع',
                day: 'يوم'
            },
            events: async (info, successCallback, failureCallback) => {
                try {
                    const start = info.startStr.split('T')[0];
                    const end = info.endStr.split('T')[0];

                    const result = await API.get(`/calendar/events?start=${start}&end=${end}`);

                    if (result.success) {
                        successCallback(result.data);
                    } else {
                        failureCallback(result.message);
                    }
                } catch (error) {
                    console.error('Failed to fetch events:', error);
                    failureCallback(error);
                }
            },
            eventClick: (info) => {
                this.handleEventClick(info.event);
            },
            height: '100%',
            eventTimeFormat: {
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false
            }
        });

        this.calendar.render();
    }

    static handleEventClick(event) {
        const props = event.extendedProps;
        const isSession = props.type === 'session';
        const type = isSession ? 'جلسة قضائية' : 'مهمة عمل';
        const modalTitle = isSession ? 'تفاصيل الجلسة' : 'تفاصيل المهمة';

        // تنسيق التاريخ والوقت باللغة العربية بشكل أنيق
        let dateLabel = '';
        let dateValue = 'غير محدد';
        if (event.start) {
            const dateObj = new Date(event.start);
            if (isSession) {
                dateLabel = 'موعد وتاريخ الجلسة';
                dateValue = dateObj.toLocaleString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            } else {
                dateLabel = 'تاريخ الاستحقاق النهائي';
                dateValue = dateObj.toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
        }

        // بناء محتوى تفاصيل الحدث بشكل فخم
        let detailsContent = '';
        if (isSession) {
            detailsContent = `
                <div style="display: flex; gap: 1rem; align-items: flex-start; background: rgba(59, 130, 246, 0.05); padding: 1rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.15);">
                    <div style="background: var(--info); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; min-width: 36px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                        <i class="far fa-calendar-alt"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.25rem;">${dateLabel}</div>
                        <div style="font-size: 0.95rem; color: var(--text-main); font-weight: 700;">${dateValue}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; align-items: flex-start; background: rgba(15, 23, 42, 0.03); padding: 1rem; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="background: var(--text-muted); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; min-width: 36px;">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.25rem;">مقر / مكان انعقاد الجلسة</div>
                        <div style="font-size: 0.95rem; color: var(--text-main); font-weight: 700;">${props.location || 'قاعة افتراضية / غير محدد'}</div>
                    </div>
                </div>
            `;
        } else {
            // تنسيق ألوان الأولوية
            let priorityIcon = 'fa-info-circle';
            let priorityColor = 'var(--text-muted)';
            let priorityBg = 'rgba(100, 116, 139, 0.1)';

            if (props.priority === 'عاجل' || props.priority === 'عالية') {
                priorityIcon = 'fa-fire-alt';
                priorityColor = 'var(--danger)';
                priorityBg = 'rgba(239, 68, 68, 0.1)';
            } else if (props.priority === 'متوسط') {
                priorityIcon = 'fa-exclamation-triangle';
                priorityColor = 'var(--warning)';
                priorityBg = 'rgba(245, 158, 11, 0.1)';
            } else if (props.priority === 'منخفض') {
                priorityIcon = 'fa-check-circle';
                priorityColor = 'var(--success)';
                priorityBg = 'rgba(16, 185, 129, 0.1)';
            }

            // تنسيق ألوان الحالة
            let statusIcon = 'fa-tasks';
            let statusColor = 'var(--info)';
            let statusBg = 'rgba(59, 130, 246, 0.1)';

            if (props.status === 'مكتمل') {
                statusIcon = 'fa-check-double';
                statusColor = 'var(--success)';
                statusBg = 'rgba(16, 185, 129, 0.1)';
            } else if (props.status === 'ملغي') {
                statusIcon = 'fa-times-circle';
                statusColor = 'var(--danger)';
                statusBg = 'rgba(239, 68, 68, 0.1)';
            } else if (props.status === 'قيد الانتظار') {
                statusIcon = 'fa-hourglass-start';
                statusColor = 'var(--warning)';
                statusBg = 'rgba(245, 158, 11, 0.1)';
            }

            detailsContent = `
                <div style="display: flex; gap: 1rem; align-items: flex-start; background: rgba(245, 158, 11, 0.05); padding: 1rem; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.15);">
                    <div style="background: var(--warning); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; min-width: 36px; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);">
                        <i class="far fa-calendar-check"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.25rem;">${dateLabel}</div>
                        <div style="font-size: 0.95rem; color: var(--text-main); font-weight: 700;">${dateValue}</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="display: flex; gap: 0.75rem; align-items: center; background: ${priorityBg}; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                        <i class="fas ${priorityIcon}" style="color: ${priorityColor}; font-size: 1.1rem;"></i>
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">الأولوية</div>
                            <div style="font-size: 0.9rem; color: ${priorityColor}; font-weight: 800;">${props.priority || 'عادية'}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.75rem; align-items: center; background: ${statusBg}; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                        <i class="fas ${statusIcon}" style="color: ${statusColor}; font-size: 1.1rem;"></i>
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">حالة المهمة</div>
                            <div style="font-size: 0.9rem; color: ${statusColor}; font-weight: 800;">${props.status || 'قيد الانتظار'}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // إزالة أي نافذة قديمة إذا كانت موجودة لمنع التكرار
        const existingModal = document.getElementById('calendar-event-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // إنشاء كائن النافذة المنبثقة
        const modalContainer = document.createElement('div');
        modalContainer.id = 'calendar-event-modal';
        modalContainer.className = 'modal';
        modalContainer.style.display = 'flex';
        modalContainer.style.opacity = '0';
        modalContainer.style.transition = 'opacity 0.25s ease';

        const themeColor = isSession ? 'var(--info)' : 'var(--warning)';

        modalContainer.innerHTML = `
            <div class="modal-content" style="max-width: 520px; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-color); box-shadow: var(--shadow-xl); transform: scale(0.95); transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);">
                <!-- الرأس -->
                <div class="modal-header" style="background: var(--bg-surface-hover); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; margin-bottom: 0;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="background: ${themeColor}; color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; min-width: 36px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                            <i class="${isSession ? 'fas fa-balance-scale' : 'fas fa-tasks'}" style="color: white; font-size: 1rem;"></i>
                        </div>
                        <span style="color: var(--text-main); font-size: 1.15rem; font-weight: 800;">${modalTitle}</span>
                    </div>
                    <button class="modal-close" id="closeCalendarModalBtn" style="font-size: 1.25rem; line-height: 1; padding: 0.25rem; background: none; border: none; cursor: pointer; color: var(--text-muted); transition: color 0.2s;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <!-- المحتوى الداخلي -->
                <div class="modal-body" style="padding: 1.75rem; display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- اسم الحدث والتصنيف -->
                    <div>
                        <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; line-height: 1.5;">${event.title}</h3>
                        <span style="font-size: 0.8rem; color: ${themeColor}; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.8rem; border-radius: 30px; background: ${isSession ? 'rgba(59, 130, 246, 0.08)' : 'rgba(245, 158, 11, 0.08)'}; border: 1px solid ${isSession ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)'};">
                            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${themeColor}; display: inline-block;"></span>
                            ${type}
                        </span>
                    </div>

                    <!-- خط فاصل -->
                    <div style="height: 1px; background: var(--border-color); width: 100%; margin: 0.25rem 0;"></div>

                    <!-- تفاصيل الحدث المنسقة -->
                    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                        ${detailsContent}
                    </div>
                </div>

                <!-- ذيل النافذة (الأزرار) -->
                <div class="modal-footer" style="padding: 1.25rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); background: var(--bg-surface-hover);">
                    <button class="btn" id="cancelCalendarModalBtn" style="border-radius: 8px; font-weight: 700; padding: 0.65rem 1.25rem; cursor: pointer; background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        <i class="fas fa-times" style="font-size: 0.85rem;"></i>
                        إغلاق
                    </button>
                    <button class="btn btn-primary" id="confirmCalendarModalBtn" style="border-radius: 8px; font-weight: 700; padding: 0.65rem 1.5rem; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: var(--brand-primary); color: white; border: none;">
                        <span>${isSession ? 'عرض تفاصيل الجلسة' : 'الانتقال إلى المهام'}</span>
                        <i class="fas fa-arrow-left" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modalContainer);

        // الحصول على عناصر التحكم بالـ DOM
        const modalContent = modalContainer.querySelector('.modal-content');
        const closeBtn = modalContainer.querySelector('#closeCalendarModalBtn');
        const cancelBtn = modalContainer.querySelector('#cancelCalendarModalBtn');
        const confirmBtn = modalContainer.querySelector('#confirmCalendarModalBtn');

        // إغلاق النافذة مع تأثيرات الحركة
        const closeModal = () => {
            modalContainer.style.opacity = '0';
            modalContent.style.transform = 'scale(0.95)';
            setTimeout(() => {
                modalContainer.remove();
            }, 250);
        };

        // تفعيل حركات الدخول التدريجي
        setTimeout(() => {
            modalContainer.style.opacity = '1';
            modalContent.style.transform = 'scale(1)';
        }, 10);

        // ربط الأحداث
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // إغلاق عند النقر خارج المحتوى
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                closeModal();
            }
        });

        // الانتقال عند التأكيد
        confirmBtn.addEventListener('click', () => {
            closeModal();
            if (isSession) {
                window.location.href = `/sessions?id=${event.id.replace('session_', '')}`;
            } else {
                window.location.href = '/tasks';
            }
        });
    }
}
