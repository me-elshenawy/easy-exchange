import { db } from '../auth/firebase-config.js';
import { collection, getDocs, query, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- عناصر واجهة المستخدم ---
    const loginPrompt = document.getElementById('login-prompt');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const mainContent = document.getElementById('main-content');
    
    // عناصر لوحة المستخدمين
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const usersListContainer = document.getElementById('users-list-container');
    const skeletonContainer = document.getElementById('loading-skeleton-container');
    
    // عناصر تفاصيل المستخدم
    const detailsPrompt = document.getElementById('details-prompt');
    const detailsView = document.getElementById('details-view');
    const detailsSpinner = document.getElementById('details-loading-spinner');
    const userInfoSection = document.getElementById('user-info-section');
    const userTransactionsBody = document.getElementById('user-transactions-body');
    
    // عناصر الإحصائيات
    const totalUsersStat = document.getElementById('total-users-stat');
    const totalTransactionsStat = document.getElementById('total-transactions-stat');
    const pendingTransactionsStat = document.getElementById('pending-transactions-stat');

    // عناصر فلتر التاريخ الشامل
    const filterByDateBtn = document.getElementById('filter-by-date-btn');
    const resetDateFilterBtn = document.getElementById('reset-date-filter-btn');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const globalResultsContainer = document.getElementById('global-transactions-results');
    const globalTableBody = document.getElementById('global-transactions-body');
    const globalLogMessage = document.getElementById('global-log-message');

    // --- إدارة الحالة ---
    let allUsersData = [];
    let allTransactionsData = [];
    let selectedUserId = null;
    let isLoading = false;

    // --- المصادقة ---
    const REQUIRED_USERNAME = "user";
    const REQUIRED_PASSWORD = "etis1";

    function checkAuth() {
        if (sessionStorage.getItem('userHubAuthenticated') === 'true') {
            loginPrompt.style.display = 'none';
            mainContent.style.display = 'block';
            initializePage();
        } else {
            loginPrompt.style.display = 'flex';
            mainContent.style.display = 'none';
        }
    }

    loginButton.addEventListener('click', () => {
        const username = prompt("اسم المستخدم:");
        const password = prompt("كلمة المرور:");
        if (username === REQUIRED_USERNAME && password === REQUIRED_PASSWORD) {
            sessionStorage.setItem('userHubAuthenticated', 'true');
            checkAuth();
        } else {
            alert("بيانات الاعتماد غير صحيحة.");
        }
    });

    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('userHubAuthenticated');
        allUsersData = [];
        allTransactionsData = [];
        selectedUserId = null;
        checkAuth();
    });

    /**
     * دالة مساعدة لتنسيق الطابع الزمني من Firebase إلى تاريخ ووقت مقروء.
     * @param {object} firebaseTimestamp - كائن التاريخ من Firestore.
     * @returns {string} - التاريخ والوقت المنسق.
     */
    function formatDate(firebaseTimestamp) {
        if (!firebaseTimestamp || typeof firebaseTimestamp.toDate !== 'function') {
            return 'غير متوفر';
        }
        return firebaseTimestamp.toDate().toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
    }

    // --- عرض هياكل التحميل (Skeletons) ---
    function showLoadingSkeletons() {
        let skeletonsHtml = '';
        for (let i = 0; i < 8; i++) {
            skeletonsHtml += `
                <div class="skeleton-item">
                    <div class="skeleton sk-avatar"></div>
                    <div style="flex-grow: 1;">
                        <div class="skeleton sk-line w-75"></div>
                        <div class="skeleton sk-line w-50"></div>
                    </div>
                </div>`;
        }
        skeletonContainer.innerHTML = skeletonsHtml;
        skeletonContainer.style.display = 'block';
        usersListContainer.style.display = 'none';
    }

    // --- جلب ومعالجة البيانات ---
    async function fetchData() {
        if (isLoading) return;
        isLoading = true;
        showLoadingSkeletons();
        detailsView.style.display = 'none';
        detailsPrompt.style.display = 'flex';

        try {
            const [usersSnapshot, transactionsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "users"))),
                getDocs(query(collection(db, "transactions")))
            ]);

            const usersMap = new Map();
            usersSnapshot.docs.forEach(doc => {
                const userData = doc.data();
                usersMap.set(userData.uid, {
                    id: doc.id,
                    ...userData,
                    name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'مستخدم غير مسمى',
                    avatarInitials: ((userData.firstName?.[0] || '') + (userData.lastName?.[0] || 'U')).toUpperCase()
                });
            });

            allTransactionsData = transactionsSnapshot.docs.map(doc => {
                const txData = doc.data();
                const user = usersMap.get(txData.userId);
                return {
                    id: doc.id,
                    ...txData,
                    customerName: user ? user.name : 'عميل محذوف'
                };
            });

            allUsersData = Array.from(usersMap.values()).map(user => {
                const userTransactions = allTransactionsData.filter(tx => tx.userId === user.uid);
                return {
                    ...user,
                    totalTransactions: userTransactions.length,
                    completedTransactions: userTransactions.filter(tx => tx.status === 'Completed').length
                };
            });

            updateDashboardStats();
            applyUserFiltersAndSort();

        } catch (error) {
            console.error("Error fetching data:", error);
            skeletonContainer.innerHTML = '<p class="no-results">فشل تحميل البيانات.</p>';
        } finally {
            isLoading = false;
            skeletonContainer.style.display = 'none';
            usersListContainer.style.display = 'block';
        }
    }

    // --- تحديث الإحصائيات العامة ---
    function updateDashboardStats() {
        totalUsersStat.textContent = allUsersData.length;
        totalTransactionsStat.textContent = allTransactionsData.length;
        pendingTransactionsStat.textContent = allTransactionsData.filter(tx => tx.status === 'Pending').length;
    }

    // --- عرض قائمة المستخدمين ---
    function renderUsersList(usersToRender) {
        usersListContainer.innerHTML = '';
        if (usersToRender.length === 0) {
            usersListContainer.innerHTML = '<p class="no-results">لا توجد نتائج تطابق بحثك.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        usersToRender.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-list-item';
            if (user.uid === selectedUserId) {
                item.classList.add('selected');
            }
            item.dataset.uid = user.uid;
            item.innerHTML = `
                <div class="user-list-avatar">${user.avatarInitials}</div>
                <div class="user-list-info">
                    <p class="name">${user.name}</p>
                    <p class="email">${user.email}</p>
                </div>
                <div class="user-list-stats">
                    <span>الإجمالي: <strong>${user.totalTransactions}</strong></span>
                    <span>الناجحة: <strong style="color: var(--success-color);">${user.completedTransactions}</strong></span>
                </div>
            `;
            fragment.appendChild(item);
        });
        usersListContainer.appendChild(fragment);
    }
    
    /**
     * يعرض تفاصيل المستخدم المحدد بما في ذلك سجل عملياته الكامل.
     * @param {string} userId - معرف المستخدم المراد عرض تفاصيله.
     */
    function renderUserDetails(userId) {
        selectedUserId = userId;
        detailsPrompt.style.display = 'none';
        detailsView.style.display = 'block';
        detailsSpinner.style.display = 'flex';
        userInfoSection.innerHTML = '';
        userTransactionsBody.innerHTML = '';
    
        // Highlight selected user in the list
        document.querySelectorAll('.user-list-item').forEach(item => {
            item.classList.remove('selected');
            if (item.dataset.uid === userId) {
                item.classList.add('selected');
            }
        });
        
        const user = allUsersData.find(u => u.uid === userId);
        if (!user) {
            detailsSpinner.style.display = 'none';
            userInfoSection.innerHTML = '<p class="no-results">لم يتم العثور على المستخدم.</p>';
            return;
        }
        
        // Render User Info
        let phoneHistoryHtml = '';
        if (user.previousPhoneNumbers && user.previousPhoneNumbers.length > 0) {
            phoneHistoryHtml = `
                <div class="contact-item">
                    <box-icon name='phone-outgoing' type='solid'></box-icon>
                    <span>أرقام سابقة: <strong>${user.previousPhoneNumbers.join(', ')}</strong></span>
                </div>`;
        }
        userInfoSection.innerHTML = `
            <div class="user-info-avatar">${user.avatarInitials}</div>
            <div class="user-info-main">
                <h3 class="name">${user.name}</h3>
                <p class="email">${user.email}</p>
            </div>
            <div class="user-info-contacts">
                <div class="contact-item">
                    <box-icon name='phone' type='solid'></box-icon>
                    <span>رقم التواصل: <strong>${user.phoneNumber || 'غير متوفر'}</strong></span>
                </div>
                ${phoneHistoryHtml}
            </div>
        `;
    
        // Render User Transactions
        const userTransactions = allTransactionsData
            .filter(tx => tx.userId === userId)
            .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    
        if (userTransactions.length === 0) {
            userTransactionsBody.innerHTML = '<tr><td colspan="5" class="no-results">لا توجد عمليات لهذا المستخدم.</td></tr>';
        } else {
            const fragment = document.createDocumentFragment();
            userTransactions.forEach(tx => {
                const sortedHistory = (tx.statusHistory || [{ status: tx.status, timestamp: tx.timestamp }])
                    .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    
                const statusHistoryList = sortedHistory
                    .map(item => `<li class="status-history-item">
                                    <span class="status-tag ${(item.status || 'pending').toLowerCase()}">${item.status}</span>
                                    <span class="timestamp">${formatDate(item.timestamp)}</span>
                                 </li>`)
                    .join('');
    
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="رقم العملية">${tx.transactionId || 'N/A'}</td>
                    <td data-label="تاريخ الإنشاء">${formatDate(tx.timestamp)}</td>
                    <td data-label="التفاصيل">${tx.sendAmount?.toFixed(2) || 0} ${tx.sendCurrencyName || ''} -> ${tx.receiveAmount?.toFixed(2) || 0} ${tx.receiveCurrencyName || ''}</td>
                    <td data-label="سجل الحالات"><ul class="status-history-list">${statusHistoryList}</ul></td>
                    <td data-label="إجراء">
                        <button class="delete-btn" data-id="${tx.id}" data-txid="${tx.transactionId}" title="حذف العملية">
                            <box-icon name='trash' type='solid'></box-icon>
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });
            userTransactionsBody.appendChild(fragment);
        }
        detailsSpinner.style.display = 'none';
    }

    /**
     * يعرض العمليات التي تمت فلترتها بالتاريخ في الجدول الشامل.
     * @param {Array} transactions - مصفوفة العمليات المراد عرضها.
     */
    function renderGlobalTransactions(transactions) {
        globalTableBody.innerHTML = '';
        if (transactions.length === 0) {
            globalLogMessage.textContent = 'لا توجد عمليات تطابق نطاق التاريخ المحدد.';
            globalLogMessage.style.display = 'block';
            return;
        }
    
        const fragment = document.createDocumentFragment();
        transactions.forEach(tx => {
            const sortedHistory = (tx.statusHistory || [{ status: tx.status, timestamp: tx.timestamp }])
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    
            const statusHistoryList = sortedHistory
                .map(item => `<li class="status-history-item">
                                <span class="status-tag ${(item.status || 'pending').toLowerCase()}">${item.status}</span>
                                <span class="timestamp">${formatDate(item.timestamp)}</span>
                             </li>`)
                .join('');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="رقم العملية">${tx.transactionId || 'N/A'}</td>
                <td data-label="العميل">${tx.customerName || 'غير معروف'}</td>
                <td data-label="تاريخ الإنشاء">${formatDate(tx.timestamp)}</td>
                <td data-label="التفاصيل">${tx.sendAmount?.toFixed(2) || 0} ${tx.sendCurrencyName || ''} -> ${tx.receiveAmount?.toFixed(2) || 0} ${tx.receiveCurrencyName || ''}</td>
                <td data-label="سجل الحالات"><ul class="status-history-list">${statusHistoryList}</ul></td>
            `;
            fragment.appendChild(row);
        });
        globalTableBody.appendChild(fragment);
    }

    /**
     * يقوم بفلترة جميع العمليات بناءً على نطاق التاريخ المحدد.
     */
    function handleDateFilter() {
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;
    
        if (!startDateValue || !endDateValue) {
            alert('الرجاء تحديد تاريخ البداية والنهاية.');
            return;
        }
    
        // تعيين الوقت لضمان المقارنة الصحيحة
        const startDate = new Date(startDateValue);
        startDate.setHours(0, 0, 0, 0); // بداية اليوم
    
        const endDate = new Date(endDateValue);
        endDate.setHours(23, 59, 59, 999); // نهاية اليوم
    
        if (startDate > endDate) {
            alert('تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.');
            return;
        }
    
        globalResultsContainer.style.display = 'block';
        globalLogMessage.textContent = 'جارٍ البحث...';
        globalLogMessage.style.display = 'block';
        globalTableBody.innerHTML = '';
    
        setTimeout(() => {
            const filteredTransactions = allTransactionsData.filter(tx => {
                if (!tx.timestamp || typeof tx.timestamp.toDate !== 'function') return false;
                const txDate = tx.timestamp.toDate();
                return txDate >= startDate && txDate <= endDate;
            });
    
            filteredTransactions.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    
            globalLogMessage.style.display = 'none';
            renderGlobalTransactions(filteredTransactions);
        }, 200);
    }

    // --- حذف عملية ---
    async function handleDeleteTransaction(docId, txId) {
        if (confirm(`هل أنت متأكد من رغبتك في حذف العملية رقم ${txId} بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            try {
                detailsSpinner.style.display = 'flex';
                await deleteDoc(doc(db, "transactions", docId));
                await fetchData();
                
                if (selectedUserId) {
                    renderUserDetails(selectedUserId);
                } else {
                    detailsSpinner.style.display = 'none';
                }
                alert(`تم حذف العملية ${txId} بنجاح.`);

            } catch (error) {
                console.error("Error deleting transaction: ", error);
                alert("فشل حذف العملية.");
                detailsSpinner.style.display = 'none';
            }
        }
    }

    // --- البحث والفرز ---
    function applyUserFiltersAndSort() {
        let filteredData = [...allUsersData];
        const searchTerm = searchInput.value.toLowerCase();

        if (searchTerm) {
            filteredData = filteredData.filter(user =>
                user.name.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                (user.phoneNumber && user.phoneNumber.includes(searchTerm))
            );
        }

        const sortValue = sortSelect.value;
        filteredData.sort((a, b) => {
            switch (sortValue) {
                case 'name_asc': return a.name.localeCompare(b.name, 'ar');
                case 'name_desc': return b.name.localeCompare(a.name, 'ar');
                case 'total_desc': return b.totalTransactions - a.totalTransactions;
                case 'completed_desc': return b.completedTransactions - a.completedTransactions;
                default: return 0;
            }
        });

        renderUsersList(filteredData);
    }

    // --- التهيئة وربط الأحداث ---
    function initializePage() {
        fetchData();
        
        // أحداث لوحة المستخدمين
        searchInput.addEventListener('input', applyUserFiltersAndSort);
        sortSelect.addEventListener('change', applyUserFiltersAndSort);
        
        usersListContainer.addEventListener('click', (e) => {
            const userItem = e.target.closest('.user-list-item');
            if (userItem) {
                renderUserDetails(userItem.dataset.uid);
            }
        });
        
        detailsView.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                handleDeleteTransaction(deleteButton.dataset.id, deleteButton.dataset.txid);
            }
        });

        // أحداث فلتر التاريخ الشامل
        filterByDateBtn.addEventListener('click', handleDateFilter);
        resetDateFilterBtn.addEventListener('click', () => {
            startDateInput.value = '';
            endDateInput.value = '';
            globalResultsContainer.style.display = 'none';
            globalTableBody.innerHTML = '';
        });
    }

    checkAuth();
});
