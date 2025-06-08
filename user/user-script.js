import { db } from '../auth/firebase-config.js';
import { collection, getDocs, query, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- عناصر واجهة المستخدمين ---
    const loginPrompt = document.getElementById('login-prompt');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const mainContent = document.getElementById('main-content');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const usersContainer = document.getElementById('users-container');
    const loadingMessage = document.getElementById('loading-message');

    // --- عناصر واجهة سجل العمليات (الجديد) ---
    const logSearchInput = document.getElementById('log-search-input');
    const logFilterSelect = document.getElementById('log-filter-select');
    const logSortSelect = document.getElementById('log-sort-select');
    const logTableBody = document.getElementById('transactions-log-body');
    const logLoadingMessage = document.getElementById('log-loading-message');

    let allUsersData = [];
    let allTransactionsData = []; // لتخزين بيانات العمليات الكاملة

    // --- المصادقة (لا تغيير) ---
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
        checkAuth();
    });

    // --- جلب ومعالجة البيانات ---
    async function fetchData() {
        loadingMessage.style.display = 'block';
        logLoadingMessage.style.display = 'block';
        usersContainer.innerHTML = '';
        logTableBody.innerHTML = '';

        try {
            const [usersSnapshot, transactionsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "users"))),
                getDocs(query(collection(db, "transactions")))
            ]);

            const usersMap = new Map();
            usersSnapshot.docs.forEach(doc => {
                usersMap.set(doc.data().uid, doc.data());
            });

            allTransactionsData = transactionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            allUsersData = Array.from(usersMap.values()).map(user => {
                const userTransactions = allTransactionsData.filter(tx => tx.userId === user.uid);
                const completedTransactions = userTransactions.filter(tx => tx.status === 'Completed');
                return {
                    id: user.uid,
                    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'مستخدم غير مسمى',
                    email: user.email,
                    phone: user.phoneNumber || 'غير متوفر',
                    previousPhoneNumbers: user.previousPhoneNumbers || [], // دعم المتطلب الثاني
                    totalTransactions: userTransactions.length,
                    completedTransactions: completedTransactions.length
                };
            });
            
            // إضافة أسماء العملاء إلى بيانات العمليات لتسهيل العرض
            allTransactionsData.forEach(tx => {
                const user = usersMap.get(tx.userId);
                tx.customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'عميل محذوف';
            });

            renderUsers(allUsersData);
            applyLogFiltersAndSort(); // عرض السجل المبدئي

        } catch (error) {
            console.error("Error fetching data:", error);
            loadingMessage.textContent = "فشل تحميل البيانات.";
            logLoadingMessage.textContent = "فشل تحميل سجل العمليات.";
        } finally {
            loadingMessage.style.display = 'none';
            logLoadingMessage.style.display = 'none';
        }
    }

    // --- عرض بيانات المستخدمين (مُحدث) ---
    function renderUsers(usersToRender) {
        usersContainer.innerHTML = '';
        if (usersToRender.length === 0) {
            usersContainer.innerHTML = '<p class="no-results">لا توجد نتائج تطابق بحثك.</p>';
            return;
        }

        usersToRender.forEach(user => {
            // منطق عرض أرقام الهواتف السابقة
            let phoneHistoryHtml = '';
            if (user.previousPhoneNumbers && user.previousPhoneNumbers.length > 0) {
                phoneHistoryHtml = `
                    <div class="info-item phone-history">
                        <box-icon name='phone-outgoing' color='#6c757d'></box-icon>
                        <span>أرقام سابقة:</span>
                        <strong>${user.previousPhoneNumbers.join(', ')}</strong>
                    </div>`;
            }

            const card = document.createElement('div');
            card.className = 'user-card';
            card.innerHTML = `
                <div class="card-header">
                    <h3>${user.name}</h3>
                    <p>${user.email}</p>
                </div>
                <div class="card-body">
                    <div class="info-item">
                        <box-icon name='phone' color='#6c757d'></box-icon>
                        <span>رقم التواصل:</span>
                        <strong>${user.phone}</strong>
                    </div>
                    ${phoneHistoryHtml}
                </div>
                <div class="card-footer">
                    <div class="stat-item">
                        <span>إجمالي العمليات</span>
                        <div class="stat-value total">${user.totalTransactions}</div>
                    </div>
                    <div class="stat-item">
                        <span>العمليات الناجحة</span>
                        <div class="stat-value completed">${user.completedTransactions}</div>
                    </div>
                </div>`;
            usersContainer.appendChild(card);
        });
    }

    // --- البحث والفرز للمستخدمين ---
    function applyUserFiltersAndSort() {
        let filteredData = [...allUsersData];
        const searchTerm = searchInput.value.toLowerCase();

        if (searchTerm) {
            filteredData = filteredData.filter(user =>
                user.name.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                user.phone.toLowerCase().includes(searchTerm)
            );
        }

        const sortValue = sortSelect.value;
        filteredData.sort((a, b) => {
            switch (sortValue) {
                case 'name_asc': return a.name.localeCompare(b.name, 'ar');
                case 'name_desc': return b.name.localeCompare(a.name, 'ar');
                case 'total_desc': return b.totalTransactions - a.totalTransactions;
                case 'total_asc': return a.totalTransactions - b.totalTransactions;
                case 'completed_desc': return b.completedTransactions - a.completedTransactions;
                case 'completed_asc': return a.completedTransactions - b.completedTransactions;
                default: return 0;
            }
        });

        renderUsers(filteredData);
    }


    // --- *** جديد: منطق سجل العمليات *** ---

    function formatDate(firebaseTimestamp) {
        if (!firebaseTimestamp || typeof firebaseTimestamp.toDate !== 'function') {
            return 'غير متوفر';
        }
        return firebaseTimestamp.toDate().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
    }

    function renderTransactionLog(transactionsToRender) {
        logTableBody.innerHTML = '';
        if (transactionsToRender.length === 0) {
            logTableBody.innerHTML = '<tr><td colspan="6" class="no-results">لا توجد عمليات تطابق بحثك.</td></tr>';
            return;
        }

        transactionsToRender.forEach(tx => {
            // التأكد من أن statusHistory موجودة ومرتبة (الأحدث أولاً)
            const sortedHistory = (tx.statusHistory || [{ status: tx.status, timestamp: tx.timestamp }])
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            const statusHistoryList = sortedHistory
                .map(item => `<li class="status-history-item">
                                <strong>${item.status}</strong> - <span class="timestamp">${formatDate(item.timestamp)}</span>
                             </li>`)
                .join('');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${tx.transactionId || 'N/A'}</td>
                <td>${formatDate(tx.timestamp)}</td>
                <td>${tx.customerName || 'N/A'}</td>
                <td>${tx.sendAmount?.toFixed(2) || 0} ${tx.sendCurrencyName || ''} -> ${tx.receiveAmount?.toFixed(2) || 0} ${tx.receiveCurrencyName || ''}</td>
                <td><ul class="status-history-list">${statusHistoryList}</ul></td>
                <td>
                    <button class="delete-btn" data-id="${tx.id}" data-txid="${tx.transactionId}" title="حذف العملية">
                        <box-icon name='trash'></box-icon>
                    </button>
                </td>
            `;
            logTableBody.appendChild(row);
        });

        // ربط أحداث الحذف بالأزرار الجديدة
        logTableBody.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDeleteTransaction);
        });
    }
    
    async function handleDeleteTransaction(event) {
        const button = event.currentTarget;
        const docId = button.dataset.id;
        const txId = button.dataset.txid;

        if (confirm(`هل أنت متأكد من رغبتك في حذف العملية رقم ${txId} بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            try {
                button.disabled = true;
                button.innerHTML = '<box-icon name="loader-alt" animation="spin"></box-icon>';
                
                await deleteDoc(doc(db, "transactions", docId));
                
                // إعادة تحميل البيانات بعد الحذف لتحديث كل شيء
                await fetchData();
                alert(`تم حذف العملية ${txId} بنجاح.`);

            } catch (error) {
                console.error("Error deleting transaction: ", error);
                alert("فشل حذف العملية.");
                button.disabled = false;
                button.innerHTML = '<box-icon name="trash"></box-icon>';
            }
        }
    }

    function applyLogFiltersAndSort() {
        let filteredData = [...allTransactionsData];
        const searchTerm = logSearchInput.value.toLowerCase();
        const statusFilter = logFilterSelect.value;
        const sortOrder = logSortSelect.value;

        // تطبيق البحث برقم العملية
        if (searchTerm) {
            filteredData = filteredData.filter(tx => tx.transactionId?.toLowerCase().includes(searchTerm));
        }

        // تطبيق الفلترة بالحالة
        if (statusFilter !== 'all') {
            filteredData = filteredData.filter(tx => tx.status === statusFilter);
        }

        // تطبيق الفرز بالتاريخ
        filteredData.sort((a, b) => {
            const dateA = a.timestamp?.seconds || 0;
            const dateB = b.timestamp?.seconds || 0;
            return sortOrder === 'date_asc' ? dateA - dateB : dateB - dateA;
        });

        renderTransactionLog(filteredData);
    }

    // --- التهيئة ---
    function initializePage() {
        fetchData();
        // ربط مستمعات الأحداث لقسم المستخدمين
        searchInput.addEventListener('input', applyUserFiltersAndSort);
        sortSelect.addEventListener('change', applyUserFiltersAndSort);
        // ربط مستمعات الأحداث لقسم سجل العمليات
        logSearchInput.addEventListener('input', applyLogFiltersAndSort);
        logFilterSelect.addEventListener('change', applyLogFiltersAndSort);
        logSortSelect.addEventListener('change', applyLogFiltersAndSort);
    }

    checkAuth();
});