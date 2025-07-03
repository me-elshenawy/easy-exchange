// manage/admin-utils.js

/**
 * دالة لتنسيق الطابع الزمني من Firebase إلى تاريخ ووقت مقروء.
 * @param {object} firebaseTimestamp - كائن التاريخ من Firestore.
 * @returns {string} - التاريخ والوقت المنسق.
 */
export function formatDate(firebaseTimestamp) {
    if (!firebaseTimestamp || typeof firebaseTimestamp.toDate !== 'function') {
        return 'N/A';
    }
    return firebaseTimestamp.toDate().toLocaleString('ar-EG-u-nu-latn', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
    });
};

/**
 * دالة لإظهار نافذة منبثقة (Modal).
 * @param {HTMLElement} modalElement - عنصر الـ Modal.
 */
export function showModal(modalElement) {
    if(modalElement) {
        modalElement.classList.add('show');
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.classList.add('active');
    }
};

/**
 * دالة لإخفاء نافذة منبثقة (Modal).
 * @param {HTMLElement} modalElement - عنصر الـ Modal.
 */
export function hideModal(modalElement) {
    if(modalElement) {
        modalElement.classList.remove('show');
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.classList.remove('active');
    }
};