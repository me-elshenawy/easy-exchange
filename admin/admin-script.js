// admin-script.js
import { db } from '../auth/firebase-config.js';

import {
    collection, getDocs, doc, updateDoc, addDoc, deleteDoc,
    orderBy, query, where, getDoc, setDoc, serverTimestamp, arrayUnion,
    writeBatch, increment, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // #region ======== Element Selectors ========
    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "K5P22817";

    const loginPromptContainer = document.getElementById('admin-login-prompt');
    const adminPanelContent = document.getElementById('admin-panel-content');
    const adminLogoutButton = document.getElementById('admin-logout-button');

    const transactionsTableContainer = document.getElementById('transactions-table-container');
    const transactionsLoadingMsg = document.getElementById('transactions-loading');
    const statusFilterSelect = document.getElementById('status-filter');
    const refreshTransactionsBtn = document.getElementById('refresh-transactions');
    const searchTransactionsInput = document.getElementById('search-transactions');

    const globalExchangeSettingsForm = document.getElementById('globalExchangeSettingsForm');
    const gsUsdtToEgpBuyRateInput = document.getElementById('gs-usdtToEgpBuyRate');
    const gsUsdtToEgpSellRateInput = document.getElementById('gs-usdtToEgpSellRate');
    const gsWhatsAppNumberInput = document.getElementById('gs-whatsAppNumber');
    const gsUsdtServiceFeeTypeSelect = document.getElementById('gs-usdt-service-fee-type');
    const gsUsdtServiceFeeValueGroup = document.querySelector('.gs-usdt-service-fee-value-group');
    const gsUsdtServiceFeeValueInput = document.getElementById('gs-usdt-service-fee-value');
    const gsUsdtServiceFeeMinCapGroup = document.querySelector('.gs-usdt-service-fee-mincap-group');
    const gsUsdtServiceFeeMinCapInput = document.getElementById('gs-usdt-service-fee-mincap');
    const gsUsdtServiceFeeMaxCapGroup = document.querySelector('.gs-usdt-service-fee-maxcap-group');
    const gsUsdtServiceFeeMaxCapInput = document.getElementById('gs-usdt-service-fee-maxcap');
    const globalSettingsLoadingMsg = document.getElementById('global-settings-loading');
    const globalSettingsMessage = document.getElementById('global-settings-message');
    const GLOBAL_SETTINGS_DOC_ID = "currentGlobalRates";

    const paymentMethodsContainer = document.getElementById('payment-methods-container');
    const paymentMethodsLoadingMsg = document.getElementById('payment-methods-loading');
    const addNewPaymentMethodBtn = document.getElementById('add-new-payment-method-btn');

    const paymentMethodModal = document.getElementById('payment-method-modal');
    const modalTitle = document.getElementById('modal-title');
    const closeModalBtn = paymentMethodModal.querySelector('.close-modal-btn');
    const paymentMethodForm = document.getElementById('payment-method-form');
    const pmDocumentIdInput = document.getElementById('pm-document-id');
    const modalMessage = document.getElementById('modal-message');
    const siteAccountFieldsDiv = document.getElementById('site-account-fields');

    const pmSendingFeeTypeSelect = document.getElementById('pm-sending-fee-type');
    const pmSendingFeeValueGroup = document.querySelector('.pm-sending-fee-value-group');
    const pmSendingFeeValueInput = document.getElementById('pm-sending-fee-value');
    const pmSendingFeeMinCapGroup = document.querySelector('.pm-sending-fee-mincap-group');
    const pmSendingFeeMinCapInput = document.getElementById('pm-sending-fee-mincap');
    const pmSendingFeeMaxCapGroup = document.querySelector('.pm-sending-fee-maxcap-group');
    const pmSendingFeeMaxCapInput = document.getElementById('pm-sending-fee-maxcap');
    const pmReceivingFeeTypeSelect = document.getElementById('pm-receiving-fee-type');
    const pmReceivingFeeValueGroup = document.querySelector('.pm-receiving-fee-value-group');
    const pmReceivingFeeValueInput = document.getElementById('pm-receiving-fee-value');
    const pmReceivingFeeMinCapGroup = document.querySelector('.pm-receiving-fee-mincap-group');
    const pmReceivingFeeMinCapInput = document.getElementById('pm-receiving-fee-mincap');
    const pmReceivingFeeMaxCapGroup = document.querySelector('.pm-receiving-fee-maxcap-group');
    const pmReceivingFeeMaxCapInput = document.getElementById('pm-receiving-fee-maxcap');

    const marqueeSettingsForm = document.getElementById('marqueeSettingsForm');
    const mqMessagesTextarea = document.getElementById('mq-messages');
    const mqSpeedInput = document.getElementById('mq-speed');
    const marqueeSettingsLoadingMsg = document.getElementById('marquee-settings-loading');
    const marqueeSettingsMessage = document.getElementById('marquee-settings-message');

    const reportMonthSelect = document.getElementById('report-month');
    const reportYearSelect = document.getElementById('report-year');
    const loadFeesReportBtn = document.getElementById('load-fees-report-btn');
    const feesSummaryStatsDiv = document.getElementById('fees-summary-stats');
    const completedTxCountMonthSpan = document.getElementById('completed-tx-count-month');
    const totalFeesMonthSpan = document.getElementById('total-fees-month');
    const feesTableContainer = document.getElementById('fees-table-container');
    const feesLoadingMsg = document.getElementById('fees-loading-msg');
    const feesNoDataMsg = document.getElementById('fees-no-data-msg');
    // #endregion

    // ==============================================
    // SECTION: Constants & Global Variables
    // ==============================================
    
    const PLATFORM_FEE_PERCENTAGE = 0.005; // 0.5% Fee
    
    let globalSettings = {};


    // ==============================================
    // SECTION: مصادقة المشرف
    // ==============================================
    function checkAdminAuth() {
        if (sessionStorage.getItem('adminAuthenticated') === 'true') {
            loginPromptContainer.style.display = 'none';
            adminPanelContent.style.display = 'flex';
            initializeAdminPanel();
        } else {
            loginPromptContainer.style.display = 'flex';
            adminPanelContent.style.display = 'none';
             loginPromptContainer.addEventListener('click', (e) => {
                 if(e.target === loginPromptContainer) requestAdminCredentials();
             });

            // --- [IMPROVEMENT] ---
            // Call the login prompt function immediately on page load instead of waiting for a click.
            requestAdminCredentials();
        }
    }

    function requestAdminCredentials() {
        const username = prompt("الرجاء إدخال اسم مستخدم المشرف:");
        if (username === null) return;
        const password = prompt("الرجاء إدخال كلمة مرور المشرف:");
        if (password === null) return;

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            sessionStorage.setItem('adminAuthenticated', 'true');
            checkAdminAuth();
        } else {
            alert("بيانات الاعتماد غير صحيحة. الرجاء المحاولة مرة أخرى.");
        }
    }

    if (adminLogoutButton) {
        adminLogoutButton.addEventListener('click', () => {
            sessionStorage.removeItem('adminAuthenticated');
            window.location.reload();
        });
    }

    
    // ==============================================
    // SECTION: Dashboard Logic (Optimized)
    // ==============================================

    /**
     * @description Fetches only the necessary data for the dashboard view efficiently.
     * Runs targeted queries in parallel to get pending counts, completed today counts,
     * and the 5 most recent transactions. This is much faster than loading all transactions.
     */
    async function loadDashboardStatsAndRecent() {
        const pendingCountSpan = document.getElementById('pending-transactions-count');
        const completedTodayCountSpan = document.getElementById('completed-transactions-count');
        const recentTableBody = document.querySelector('#recent-transactions-table tbody');

        if (!pendingCountSpan || !completedTodayCountSpan || !recentTableBody) return;

        // Set loading states
        pendingCountSpan.textContent = '...';
        completedTodayCountSpan.textContent = '...';
        recentTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">جارٍ تحميل آخر العمليات...</td></tr>';

        try {
            const transactionsRef = collection(db, "transactions");

            // Query for pending transactions
            const pendingQuery = query(transactionsRef, where("status", "==", "Pending"));

            // Query for transactions completed today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const completedTodayQuery = query(transactionsRef,
                where("status", "==", "Completed"),
                where("timestamp", ">=", today)
            );

            // Query for the 5 most recent transactions
            const recentQuery = query(transactionsRef, orderBy("timestamp", "desc"), limit(5));

            // Run all three queries in parallel for maximum speed
            const [pendingSnapshot, completedTodaySnapshot, recentSnapshot] = await Promise.all([
                getDocs(pendingQuery),
                getDocs(completedTodayQuery),
                getDocs(recentQuery)
            ]);

            // Update dashboard stats
            pendingCountSpan.textContent = pendingSnapshot.size;
            completedTodayCountSpan.textContent = completedTodaySnapshot.size;

            // Update recent transactions table
            recentTableBody.innerHTML = ''; // Clear loading message
            if (recentSnapshot.empty) {
                recentTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">لا توجد عمليات لعرضها.</td></tr>';
            } else {
                recentSnapshot.forEach(doc => {
                    const tx = doc.data();
                    const statusClassSuffix = (tx.status || 'pending').toLowerCase().replace(/\s+/g, '-');
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${tx.transactionId || 'N/A'}</td>
                        <td>${tx.exchangerName || tx.userId || 'غير معروف'}</td>
                        <td>${(tx.sendAmount || 0).toFixed(2)} ${tx.sendCurrencyName || tx.sendCurrencyType || ''}</td>
                        <td><span class="status-tag status-${statusClassSuffix}">${tx.status}</span></td>
                    `;
                    recentTableBody.appendChild(row);
                });
            }

        } catch (error) {
            console.error("Error loading dashboard stats:", error);
            pendingCountSpan.textContent = 'خطأ';
            completedTodayCountSpan.textContent = 'خطأ';
            recentTableBody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center; padding: 20px;">فشل تحميل البيانات: ${error.message}</td></tr>`;
        }
    }


    // ==========================================================
    // SECTION: إدارة العمليات (Transactions)
    // ==========================================================
    async function updateTransactionStatus(transactionDocId, newStatus) {
        if (!transactionDocId || !newStatus) return;

        const transactionRef = doc(db, "transactions", transactionDocId);

        try {
            const batch = writeBatch(db);
            const newStatusEntry = {
                status: newStatus,
                timestamp: new Date() 
            };
            batch.update(transactionRef, {
                status: newStatus,
                statusHistory: arrayUnion(newStatusEntry),
                lastAdminUpdate: serverTimestamp()
            });

            if (newStatus === "Completed") {
                const txDoc = await getDoc(transactionRef);
                if (txDoc.exists()) {
                    const userId = txDoc.data().userId;
                    if (userId) {
                        const userRef = doc(db, "users", userId);
                        batch.update(userRef, {
                            completedTransactionsCount: increment(1) 
                        });
                        console.log(`User counter increment batched for user ID: ${userId}`);
                    }
                }
            }
            await batch.commit();
            await loadTransactions(statusFilterSelect.value);

        } catch (error) {
            console.error("Error updating transaction status and/or user counter:", error);
            alert(`فشل تحديث حالة العملية: ${error.message}`);
        }
    }

    async function loadTransactions(statusFilter = "all") {
        if (!transactionsTableContainer || !transactionsLoadingMsg) return;
        transactionsLoadingMsg.style.display = 'block';
        transactionsTableContainer.innerHTML = '';
        transactionsTableContainer.appendChild(transactionsLoadingMsg);

        try {
            const transactionsRef = collection(db, "transactions");
            const q = (statusFilter === "all")
                ? query(transactionsRef, orderBy("timestamp", "desc"))
                : query(transactionsRef, where("status", "==", statusFilter), orderBy("timestamp", "desc"));

            const querySnapshot = await getDocs(q);
            transactionsLoadingMsg.style.display = 'none';

            if (querySnapshot.empty) {
                transactionsTableContainer.innerHTML = "<p style='text-align:center; padding: 20px;'>لا توجد عمليات لعرضها حاليًا.</p>";
                return;
            }

            const table = document.createElement('table');
            table.innerHTML = `<thead><tr><th>ID العملية</th><th>العميل</th><th>يرسل</th><th>يستلم</th><th>التاريخ</th><th>الحالة</th><th>تغيير الحالة</th></tr></thead><tbody></tbody>`;
            const tbody = table.querySelector('tbody');

            querySnapshot.forEach(doc => {
                const tx = { id: doc.id, ...doc.data() };
                const row = tbody.insertRow();
                const currentStatus = tx.status || 'Pending';
                const statusClassSuffix = currentStatus.toLowerCase().replace(/\s+/g, '-');
                const timestampDisplay = tx.timestamp?.toDate() ? tx.timestamp.toDate().toLocaleString('ar-EG-u-nu-latn') : 'غير محدد';

                row.innerHTML = `
                    <td>${tx.transactionId || 'N/A'}</td>
                    <td>${tx.exchangerName || tx.userId || 'غير معروف'}</td>
                    <td>${(tx.sendAmount || 0).toFixed(2)} ${tx.sendCurrencyName || tx.sendCurrencyType || ''}</td>
                    <td>${(tx.receiveAmount || 0).toFixed(2)} ${tx.receiveCurrencyName || tx.receiveCurrencyType || ''}</td>
                    <td>${timestampDisplay}</td>
                    <td><span class="status-tag status-${statusClassSuffix}">${currentStatus}</span></td>
                    <td>
                        <select class="status-change-select" data-id="${tx.id}">
                            <option value="${currentStatus}" selected>${currentStatus}</option>
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Completed">Completed</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </td>
                `;
                row.querySelector('.status-change-select').addEventListener('change', (e) => {
                    const selectedStatus = e.target.value;
                    if(selectedStatus === currentStatus) return;
                    if (confirm(`هل أنت متأكد من تغيير الحالة إلى ${selectedStatus}؟`)) {
                        updateTransactionStatus(e.target.dataset.id, selectedStatus);
                    } else {
                        e.target.value = currentStatus;
                    }
                });
            });

            transactionsTableContainer.innerHTML = '';
            transactionsTableContainer.appendChild(table);

            searchTransactionsInput.onkeyup = () => {
                const searchTerm = searchTransactionsInput.value.toLowerCase().trim();
                tbody.querySelectorAll('tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
                });
            };

        } catch (error) {
            console.error("Error loading transactions: ", error);
            transactionsTableContainer.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">فشل تحميل العمليات: ${error.message}</p>`;
        }
    }

    // ==============================================
    // SECTION: Settings and Other Unchanged Functions...
    // ==============================================
    async function loadGlobalExchangeSettings() {
        if (!globalExchangeSettingsForm) return;
        globalSettingsLoadingMsg.style.display = 'block';
        globalSettingsMessage.style.display = 'none';
        try {
            const settingsRef = doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID);
            const docSnap = await getDoc(settingsRef);

            if (docSnap.exists()) {
                globalSettings = docSnap.data();
                gsUsdtToEgpBuyRateInput.value = globalSettings.usdtToEgpBuyRate ?? '';
                gsUsdtToEgpSellRateInput.value = globalSettings.usdtToEgpSellRate ?? '';
                gsWhatsAppNumberInput.value = globalSettings.whatsAppNumber || '';

                gsUsdtServiceFeeTypeSelect.value = globalSettings.usdtToUsdtServiceFeeType || 'none';
                gsUsdtServiceFeeValueInput.value = globalSettings.usdtToUsdtServiceFeeValue ?? '';
                gsUsdtServiceFeeMinCapInput.value = globalSettings.usdtToUsdtServiceFeeMinCap ?? '';
                gsUsdtServiceFeeMaxCapInput.value = globalSettings.usdtToUsdtServiceFeeMaxCap ?? '';
            } else {
                 globalSettings = {};
            }
            toggleFeeFields(gsUsdtServiceFeeTypeSelect, gsUsdtServiceFeeValueGroup, gsUsdtServiceFeeValueInput, gsUsdtServiceFeeMaxCapGroup, gsUsdtServiceFeeMaxCapInput, gsUsdtServiceFeeMinCapGroup, gsUsdtServiceFeeMinCapInput);
        } catch (error) {
            console.error("Error loading global settings:", error);
             globalSettings = {};
        } finally {
            globalSettingsLoadingMsg.style.display = 'none';
             populateReportFilters();
        }
    }

    async function saveGlobalExchangeSettings(event) {
        event.preventDefault();
        const settingsData = {
            usdtToEgpBuyRate: parseFloat(gsUsdtToEgpBuyRateInput.value),
            usdtToEgpSellRate: parseFloat(gsUsdtToEgpSellRateInput.value),
            whatsAppNumber: gsWhatsAppNumberInput.value.trim(),
            usdtToUsdtServiceFeeType: gsUsdtServiceFeeTypeSelect.value,
            usdtToUsdtServiceFeeValue: parseFloat(gsUsdtServiceFeeValueInput.value) || 0,
            usdtToUsdtServiceFeeMinCap: parseFloat(gsUsdtServiceFeeMinCapInput.value) || null,
            usdtToUsdtServiceFeeMaxCap: parseFloat(gsUsdtServiceFeeMaxCapInput.value) || null,
            lastUpdated: serverTimestamp()
        };
        try {
            await setDoc(doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID), settingsData, { merge: true });
             globalSettings = { ...globalSettings, ...settingsData };
            alert("تم حفظ الإعدادات بنجاح!");
        } catch (error) {
            alert(`فشل حفظ الإعدادات: ${error.message}`);
        }
    }

    function toggleFeeFields(feeTypeSelect, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput) {
        const selectedType = feeTypeSelect.value;
        [valueGroup, maxCapGroup, minCapGroup].forEach(g => { if (g) g.style.display = 'none' });
        if (valueInput) valueInput.required = false;

        if (selectedType === "fixed") {
             if (valueGroup) valueGroup.style.display = 'block';
             if (valueInput) valueInput.required = true;
        } else if (selectedType === "percentage") {
             if (valueGroup) valueGroup.style.display = 'block';
             if (valueInput) valueInput.required = true;
             if (maxCapGroup) maxCapGroup.style.display = 'block';
             if (minCapGroup) minCapGroup.style.display = 'block';
        }
    }

    function openPaymentMethodModal(method = null) {
        paymentMethodForm.reset();
        modalMessage.style.display = 'none';
        siteAccountFieldsDiv.style.display = 'none';
        pmDocumentIdInput.value = '';
        const keyInput = document.getElementById('pm-key');

        if (method) {
            modalTitle.textContent = "تعديل وسيلة الدفع";
            pmDocumentIdInput.value = method.id;
            keyInput.value = method.key;
            keyInput.readOnly = true;
            document.getElementById('pm-name').value = method.name || '';
            document.getElementById('pm-type').value = method.type || 'EGP';
            document.getElementById('pm-sortOrder').value = method.sortOrder ?? 100;
            document.getElementById('pm-minAmount').value = method.minAmount ?? '';
            document.getElementById('pm-balance').value = method.balance ?? '';
            document.getElementById('pm-requiresWholeNumber').checked = method.requiresWholeNumber === true;
            document.getElementById('pm-userIdentifierType').value = method.userIdentifierType || '';
            document.getElementById('pm-isActive').checked = method.isActive !== false;
            document.getElementById('pm-isSiteAccount').checked = method.isSiteAccount === true;
            document.getElementById('pm-iconName').value = method.iconName || '';
            document.getElementById('pm-notes').value = method.notes || '';
            if (method.isSiteAccount) {
                siteAccountFieldsDiv.style.display = 'block';
                document.getElementById('pm-recipientInfo').value = method.recipientInfo || '';
                document.getElementById('pm-recipientType').value = method.recipientType || '';
            }
            const fees = method.fees || {};
            const sendingFees = fees.sending || {};
            pmSendingFeeTypeSelect.value = sendingFees.type || 'none';
            pmSendingFeeValueInput.value = sendingFees.value ?? '';
            pmSendingFeeMinCapInput.value = sendingFees.minCap ?? '';
            pmSendingFeeMaxCapInput.value = sendingFees.maxCap ?? '';
            const receivingFees = fees.receiving || {};
            pmReceivingFeeTypeSelect.value = receivingFees.type || 'none';
            pmReceivingFeeValueInput.value = receivingFees.value ?? '';
            pmReceivingFeeMinCapInput.value = receivingFees.minCap ?? '';
            pmReceivingFeeMaxCapInput.value = receivingFees.maxCap ?? '';
        } else {
            modalTitle.textContent = "إضافة وسيلة دفع جديدة";
            keyInput.readOnly = false;
            document.getElementById('pm-isActive').checked = true;
            document.getElementById('pm-sortOrder').value = 100;
            document.getElementById('pm-balance').value = '';
        }

        toggleFeeFields(pmSendingFeeTypeSelect, pmSendingFeeValueGroup, pmSendingFeeValueInput, pmSendingFeeMaxCapGroup, pmSendingFeeMaxCapInput, pmSendingFeeMinCapGroup, pmSendingFeeMinCapInput);
        toggleFeeFields(pmReceivingFeeTypeSelect, pmReceivingFeeValueGroup, pmReceivingFeeValueInput, pmReceivingFeeMaxCapGroup, pmReceivingFeeMaxCapInput, pmReceivingFeeMinCapGroup, pmReceivingFeeMinCapInput);
        paymentMethodModal.classList.add('show');
    }

    function closePaymentMethodModal() { paymentMethodModal.classList.remove('show'); }

    async function savePaymentMethod(event) {
        event.preventDefault();
        const documentId = pmDocumentIdInput.value;
        const keyVal = document.getElementById('pm-key').value.trim();
        const minAmountStr = document.getElementById('pm-minAmount').value;
        const minAmountVal = minAmountStr === '' ? null : parseFloat(minAmountStr);
        const balanceStr = document.getElementById('pm-balance').value;
        const balanceVal = balanceStr === '' ? null : parseFloat(balanceStr);
        const feesData = {
            sending: {
                type: pmSendingFeeTypeSelect.value,
                value: parseFloat(pmSendingFeeValueInput.value) || 0,
                minCap: parseFloat(pmSendingFeeMinCapInput.value) || null,
                maxCap: parseFloat(pmSendingFeeMaxCapInput.value) || null,
            },
            receiving: {
                type: pmReceivingFeeTypeSelect.value,
                value: parseFloat(pmReceivingFeeValueInput.value) || 0,
                minCap: parseFloat(pmReceivingFeeMinCapInput.value) || null,
                maxCap: parseFloat(pmReceivingFeeMaxCapInput.value) || null,
            }
        };
        let dataToSave = {
            name: document.getElementById('pm-name').value.trim(),
            type: document.getElementById('pm-type').value,
            sortOrder: parseInt(document.getElementById('pm-sortOrder').value) || 100,
            minAmount: minAmountVal,
            balance: balanceVal,
            requiresWholeNumber: document.getElementById('pm-requiresWholeNumber').checked,
            userIdentifierType: document.getElementById('pm-userIdentifierType').value.trim(),
            isActive: document.getElementById('pm-isActive').checked,
            isSiteAccount: document.getElementById('pm-isSiteAccount').checked,
            fees: feesData,
            iconName: document.getElementById('pm-iconName').value.trim(),
            notes: document.getElementById('pm-notes').value.trim(),
            lastUpdated: serverTimestamp()
        };
        if (!documentId) {
            dataToSave.key = keyVal;
            if (!dataToSave.key) { alert("حقل المفتاح مطلوب."); return; }
        }
        if (dataToSave.isSiteAccount) {
            dataToSave.recipientInfo = document.getElementById('pm-recipientInfo').value.trim();
            dataToSave.recipientType = document.getElementById('pm-recipientType').value.trim();
        }
        try {
            if (documentId) {
                await updateDoc(doc(db, "paymentMethods", documentId), dataToSave);
            } else {
                await addDoc(collection(db, "paymentMethods"), dataToSave);
            }
            alert("تم الحفظ بنجاح!");
            closePaymentMethodModal();
            loadManagedPaymentMethods();
        } catch (error) {
            alert(`فشل الحفظ: ${error.message}`);
        }
    }

    async function deleteManagedPaymentMethod(documentId, displayName) {
        if (confirm(`هل أنت متأكد أنك تريد حذف "${displayName}"؟`)) {
            try {
                await deleteDoc(doc(db, "paymentMethods", documentId));
                alert("تم الحذف بنجاح.");
                loadManagedPaymentMethods();
            } catch (error) {
                alert(`فشل الحذف: ${error.message}`);
            }
        }
    }

    async function loadManagedPaymentMethods() {
        if (!paymentMethodsContainer || !paymentMethodsLoadingMsg) return;
        paymentMethodsLoadingMsg.style.display = 'block';
        paymentMethodsContainer.innerHTML = '';
        paymentMethodsContainer.appendChild(paymentMethodsLoadingMsg);
        try {
            const q = query(collection(db, "paymentMethods"), orderBy("sortOrder", "asc"));
            const querySnapshot = await getDocs(q);
            const activeMethodsCountSpan = document.getElementById('active-methods-count');
            if (activeMethodsCountSpan) activeMethodsCountSpan.textContent = querySnapshot.docs.filter(d => d.data().isActive).length;
            paymentMethodsLoadingMsg.style.display = 'none';
            if (querySnapshot.empty) {
                paymentMethodsContainer.innerHTML = "<p style='text-align:center; padding: 20px;'>لم يتم إضافة وسائل دفع بعد.</p>";
                return;
            }
            querySnapshot.forEach((docSnapshot) => {
                const method = { id: docSnapshot.id, ...docSnapshot.data() };
                const card = document.createElement('div');
                card.className = 'payment-method-card';
                let siteAccountInfoHTML = method.isSiteAccount ? `<p style="background-color: #e9f5ff; padding: 5px; border-radius: 4px;"><strong>حساب الموقع:</strong> ${method.recipientInfo}</p>` : '';
                let feesHTML = (method.fees?.sending?.type !== 'none' || method.fees?.receiving?.type !== 'none') ? `<p><strong>الرسوم:</strong> <span>يوجد</span></p>` : '';
                card.innerHTML = `<h4>${method.iconName ? `<box-icon name='${method.iconName}'></box-icon>` : ''} ${method.name} ${method.isActive ? '<span style="color:green;font-size:0.8em;">(مفعل)</span>' : '<span style="color:red;font-size:0.8em;">(غير مفعل)</span>'}</h4><p><strong>المفتاح:</strong> ${method.key}</p><p><strong>الحد الأدنى:</strong> ${method.minAmount ?? 'N/A'} ${method.type || ''}</p><p style="color: var(--primary-color-dark); font-weight: 600;"><strong>الرصيد المتاح:</strong> ${typeof method.balance === 'number' ? `${method.balance.toFixed(2)} ${method.type || ''}` : 'غير محدد'}</p>${siteAccountInfoHTML}${feesHTML}${method.notes ? `<p><strong>ملاحظات:</strong> ${method.notes}</p>` : ''}<div class="actions" style="margin-top: auto; padding-top: 15px; border-top: 1px solid var(--border-color); display: flex; gap: 10px;"><button class="button secondary edit-pm-btn">تعديل</button><button class="button danger delete-pm-btn">حذف</button></div>`;
                card.querySelector('.edit-pm-btn').addEventListener('click', () => openPaymentMethodModal(method));
                card.querySelector('.delete-pm-btn').addEventListener('click', () => deleteManagedPaymentMethod(method.id, method.name));
                paymentMethodsContainer.appendChild(card);
            });
        } catch (error) {
            console.error("Error loading payment methods:", error);
            paymentMethodsContainer.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">فشل تحميل وسائل الدفع.</p>`;
        }
    }

    async function loadMarqueeSettings() {
        if (!marqueeSettingsForm) return;
        try {
            const docSnap = await getDoc(doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID));
            if (docSnap.exists()) {
                const settings = docSnap.data();
                mqMessagesTextarea.value = (settings.marqueeMessages || []).join('\n');
                mqSpeedInput.value = settings.marqueeAnimationSpeedFactor ?? 7;
            }
        } catch(e) { console.error("Error loading marquee settings:", e); }
    }

    async function saveMarqueeSettings(event) {
        event.preventDefault();
        const settingsData = {
            marqueeMessages: mqMessagesTextarea.value.split('\n').filter(Boolean),
            marqueeAnimationSpeedFactor: parseFloat(mqSpeedInput.value),
            lastUpdatedMarquee: serverTimestamp()
        };
        try {
            await updateDoc(doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID), settingsData);
            alert("تم حفظ إعدادات الشريط بنجاح.");
        } catch (error) {
            alert(`فشل حفظ الإعدادات: ${error.message}`);
        }
    }

    function populateReportFilters() {
        if (!reportMonthSelect || !reportYearSelect) return;
        const months = [{ value: 1, name: 'يناير' }, { value: 2, name: 'فبراير' }, { value: 3, name: 'مارس' },{ value: 4, name: 'أبريل' }, { value: 5, name: 'مايو' }, { value: 6, name: 'يونيو' },{ value: 7, name: 'يوليو' }, { value: 8, name: 'أغسطس' }, { value: 9, name: 'سبتمبر' },{ value: 10, name: 'أكتوبر' }, { value: 11, name: 'نوفمبر' }, { value: 12, name: 'ديسمبر' }];
        reportMonthSelect.innerHTML = months.map(m => `<option value="${m.value}">${m.name}</option>`).join('');
        reportMonthSelect.value = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        reportYearSelect.innerHTML = '';
        for (let i = currentYear; i >= currentYear - 5; i--) reportYearSelect.innerHTML += `<option value="${i}">${i}</option>`;
        reportYearSelect.value = currentYear;
    }


    // ==============================================
    // SECTION: Platform Fees Report Logic
    // ==============================================
    function calculatePlatformFee(transaction, usdtBuyRate) {
        // Only calculate for completed transactions
        if (transaction.status !== 'Completed') {
            return 0;
        }

        const sendAmount = parseFloat(transaction.sendAmount);
        const sendCurrencyType = transaction.sendCurrencyType;

        if (isNaN(sendAmount) || sendAmount <= 0) {
            return 0; // Cannot calculate fee without a valid send amount
        }

        let feeInBaseCurrency = sendAmount * PLATFORM_FEE_PERCENTAGE;
        let feeInEGP = 0;

        if (sendCurrencyType === 'EGP') {
            feeInEGP = feeInBaseCurrency; // Fee is already in EGP
        } else if (sendCurrencyType === 'USDT') {
            // Convert USDT fee amount to EGP using the buy rate
            if (isNaN(usdtBuyRate) || usdtBuyRate <= 0) {
                console.warn(`USDT buy rate is not available or invalid (${usdtBuyRate}). Cannot convert USDT fee to EGP for transaction ${transaction.transactionId || transaction.id}.`);
                 return 0; // Cannot convert if rate is invalid
            }
            feeInEGP = feeInBaseCurrency * usdtBuyRate;
        } else {
            // For any other currency type, fee is 0.
            return 0;
        }

        // Ensure fee is a valid number and not negative
        return isNaN(feeInEGP) || feeInEGP < 0 ? 0 : feeInEGP;
    }


    async function loadFeesReport(month, year) {
        if (!feesTableContainer || !feesLoadingMsg || !feesSummaryStatsDiv || !feesNoDataMsg) return;

        feesSummaryStatsDiv.style.display = 'none';
        feesTableContainer.innerHTML = '';
        feesNoDataMsg.style.display = 'none';
        feesLoadingMsg.style.display = 'block';

        try {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 1);
            
            // We need the buy rate to calculate fees for USDT transactions
            if (!globalSettings.usdtToEgpBuyRate) {
                console.warn("Global USDT buy rate not loaded. Fetching settings for fee report.");
                await loadGlobalExchangeSettings();
            }

            // Get the rate needed for the calculation
            const usdtBuyRate = globalSettings.usdtToEgpBuyRate || 0;

            const transactionsRef = collection(db, "transactions");
            const q = query(transactionsRef, where("status", "==", "Completed"), where("timestamp", ">=", startDate), where("timestamp", "<", endDate), orderBy("timestamp", "asc"));
            const querySnapshot = await getDocs(q);

            let totalCompletedCount = 0;
            let totalFeesEGP = 0;
            const reportTransactions = [];

            querySnapshot.forEach(docSnapshot => {
                const tx = { id: docSnapshot.id, ...docSnapshot.data() };
                const fee = calculatePlatformFee(tx, usdtBuyRate);
                tx.platformFeeEGP = fee;
                totalCompletedCount++;
                totalFeesEGP += fee;
                reportTransactions.push(tx);
            });
            
            feesLoadingMsg.style.display = 'none';
            completedTxCountMonthSpan.textContent = totalCompletedCount;
            totalFeesMonthSpan.textContent = totalFeesEGP.toFixed(2);
            feesSummaryStatsDiv.style.display = 'grid';

            if (reportTransactions.length === 0) {
                feesTableContainer.innerHTML = '';
                feesNoDataMsg.style.display = 'block';
            } else {
                feesNoDataMsg.style.display = 'none';
                const table = document.createElement('table');
                table.innerHTML = `<thead><tr><th>ID العملية</th><th>العميل</th><th>المبلغ المرسل</th><th>المبلغ المستلم</th><th>تاريخ الإنشاء</th><th>رسوم المنصة (EGP)</th></tr></thead><tbody>${reportTransactions.map(tx => { const creationTimestampDisplay = tx.timestamp?.toDate() ? tx.timestamp.toDate().toLocaleString('ar-EG-u-nu-latn') : 'غير محدد'; return `<tr><td>${tx.transactionId || 'N/A'}</td><td>${tx.exchangerName || tx.userId || 'غير معروف'}</td><td>${(tx.sendAmount || 0).toFixed(2)} ${tx.sendCurrencyName || tx.sendCurrencyType || ''}</td><td>${(tx.receiveAmount || 0).toFixed(2)} ${tx.receiveCurrencyName || tx.receiveCurrencyType || ''}</td><td>${creationTimestampDisplay}</td><td>${(tx.platformFeeEGP || 0).toFixed(2)} EGP</td></tr>`; }).join('')}</tbody>`;
                feesTableContainer.appendChild(table);
            }

        } catch (error) {
            console.error("Error loading fees report: ", error);
            feesLoadingMsg.style.display = 'none';
            feesSummaryStatsDiv.style.display = 'none';
            feesTableContainer.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">فشل تحميل تقرير الرسوم: ${error.message}</p>`;
        }
    }


    // --- View Initializers and Main Setup ---

    // This function acts as the main entry point after successful login.
    function initializeAdminPanel() {
        // --- [FIX START] ---
        // Automatically switch to and load the dashboard view upon successful authentication.
        // This was previously empty, causing the initial data loading delay.
        if (window.adminSwitchView) {
            window.adminSwitchView('dashboard-view');
        }
        // --- [FIX END] ---
    }


    // Making functions globally accessible so they can be called from HTML event attributes (e.g., onclick)
    window.initializeAdminDashboardView = () => {
        console.log("Initializing Dashboard View...");
        // --- [OPTIMIZATION] ---
        // Use the new, fast function for dashboard stats instead of loading all transactions.
        loadDashboardStatsAndRecent();
        // Still load payment methods count as before.
        loadManagedPaymentMethods();
        // --- [OPTIMIZATION END] ---
    };


    window.initializeTransactionsView = () => {
        console.log("Initializing Transactions View...");
        loadTransactions("all");
    };

    window.initializeSettingsView = async () => {
         console.log("Initializing Settings View...");
         if (loadGlobalExchangeSettings) await loadGlobalExchangeSettings();
         if (loadMarqueeSettings) await loadMarqueeSettings();
    };

    window.initializePaymentMethodsView = loadManagedPaymentMethods;

    window.initializeFeesReportView = () => {
         console.log("Initializing Fees Report View...");
         if (populateReportFilters) populateReportFilters();
         if (loadGlobalExchangeSettings) loadGlobalExchangeSettings(); // Ensure rates are loaded for calculation
    };
    

    // Attach persistent event listeners that are always present in the admin panel
    statusFilterSelect?.addEventListener('change', () => loadTransactions(statusFilterSelect.value));
    refreshTransactionsBtn?.addEventListener('click', () => loadTransactions(statusFilterSelect.value));
    globalExchangeSettingsForm?.addEventListener('submit', saveGlobalExchangeSettings);
    marqueeSettingsForm?.addEventListener('submit', saveMarqueeSettings);
    addNewPaymentMethodBtn?.addEventListener('click', () => openPaymentMethodModal());
    closeModalBtn?.addEventListener('click', closePaymentMethodModal);
    paymentMethodForm?.addEventListener('submit', savePaymentMethod);
    document.getElementById('cancel-payment-method-btn')?.addEventListener('click', closePaymentMethodModal);
    document.getElementById('pm-isSiteAccount')?.addEventListener('change', (e) => { siteAccountFieldsDiv.style.display = e.target.checked ? 'block' : 'none'; });
    
    [pmSendingFeeTypeSelect, pmReceivingFeeTypeSelect, gsUsdtServiceFeeTypeSelect].forEach(select => {
        select?.addEventListener('change', (e) => {
            const targetId = e.target.id;
            let feeTypeSelect, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput;
            if (targetId.includes('pm-sending')) ({ feeTypeSelect, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput } = { feeTypeSelect: pmSendingFeeTypeSelect, valueGroup: pmSendingFeeValueGroup, valueInput: pmSendingFeeValueInput, maxCapGroup: pmSendingFeeMaxCapGroup, maxCapInput: pmSendingFeeMaxCapInput, minCapGroup: pmSendingFeeMinCapGroup, minCapInput: pmSendingFeeMinCapInput });
            else if (targetId.includes('pm-receiving')) ({ feeTypeSelect, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput } = { feeTypeSelect: pmReceivingFeeTypeSelect, valueGroup: pmReceivingFeeValueGroup, valueInput: pmReceivingFeeValueInput, maxCapGroup: pmReceivingFeeMaxCapGroup, maxCapInput: pmReceivingFeeMaxCapInput, minCapGroup: pmReceivingFeeMinCapGroup, minCapInput: pmReceivingFeeMinCapInput });
            else ({ feeTypeSelect, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput } = { feeTypeSelect: gsUsdtServiceFeeTypeSelect, valueGroup: gsUsdtServiceFeeValueGroup, valueInput: gsUsdtServiceFeeValueInput, maxCapGroup: gsUsdtServiceFeeMaxCapGroup, maxCapInput: gsUsdtServiceFeeMaxCapInput, minCapGroup: gsUsdtServiceFeeMinCapGroup, minCapInput: gsUsdtServiceFeeMinCapInput });
            toggleFeeFields(feeTypeSelect, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput);
        });
    });
    
    loadFeesReportBtn?.addEventListener('click', () => {
        const selectedMonth = parseInt(reportMonthSelect.value);
        const selectedYear = parseInt(reportYearSelect.value);
        if (!isNaN(selectedMonth) && !isNaN(selectedYear)) {
            loadFeesReport(selectedMonth, selectedYear);
        } else {
            alert("الرجاء اختيار شهر وسنة صالحين.");
        }
    });

    // --- Final Authentication Check ---
    checkAdminAuth();
});