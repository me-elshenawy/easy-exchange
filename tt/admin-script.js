import { db } from '../auth/firebase-config.js';
import {
    collection, getDocs, doc, updateDoc, addDoc, deleteDoc,
    orderBy, query, where, getDoc, setDoc, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // #region ======== Element Selectors ========
    // !!! WARNING: Hardcoded admin credentials are not secure for production !!!
    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "K5P22817";
    // !!! Consider implementing Firebase Authentication for admin users instead !!!

    const loginPromptContainer = document.getElementById('admin-login-prompt');
    const adminPanelContent = document.getElementById('admin-panel-content');
    const adminLogoutButton = document.getElementById('admin-logout-button');

    // Dashboard View Elements
    const dashboardView = document.getElementById('dashboard-view');
    const pendingTransactionsCountSpan = document.getElementById('pending-transactions-count');
    const completedTransactionsCountSpan = document.getElementById('completed-transactions-count');
    const activeMethodsCountSpan = document.getElementById('active-methods-count');
    const recentTransactionsTableBody = document.querySelector('#recent-transactions-table tbody');
    const viewAllTransactionsLink = document.querySelector('.view-all-link a.nav-link-faux');

    // Transactions View Elements
    const transactionsView = document.getElementById('transactions-view');
    const transactionsTableContainer = document.getElementById('transactions-table-container');
    const transactionsLoadingMsg = document.getElementById('transactions-loading'); // Initial loading message element
    const statusFilterSelect = document.getElementById('status-filter');
    const refreshTransactionsBtn = document.getElementById('refresh-transactions');
    const searchTransactionsInput = document.getElementById('search-transactions');

    // Settings View Elements
    const settingsView = document.getElementById('settings-view');
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

    const marqueeSettingsForm = document.getElementById('marqueeSettingsForm');
    const mqMessagesTextarea = document.getElementById('mq-messages');
    const mqSpeedInput = document.getElementById('mq-speed');
    const marqueeSettingsLoadingMsg = document.getElementById('marquee-settings-loading'); // Unused
    const marqueeSettingsMessage = document.getElementById('marquee-settings-message'); // Unused

    // Payment Methods View Elements
    const paymentMethodsView = document.getElementById('payment-methods-view');
    const paymentMethodsContainer = document.getElementById('payment-methods-container');
    const paymentMethodsLoadingMsg = document.getElementById('payment-methods-loading'); // Initial loading message element
    const addNewPaymentMethodBtn = document.getElementById('add-new-payment-method-btn');

    const paymentMethodModal = document.getElementById('payment-method-modal');
    const modalTitle = document.getElementById('modal-title');
    const closeModalBtn = paymentMethodModal?.querySelector('.close-modal-btn');
    const paymentMethodForm = document.getElementById('payment-method-form');
    const pmDocumentIdInput = document.getElementById('pm-document-id');
    const modalMessage = document.getElementById('modal-message'); // Unused

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


    // Fees Report Elements
    const feesReportView = document.getElementById('fees-report-view');
    const feesReportMonthSelect = document.getElementById('fees-report-month-select');
    const feesReportYearSelect = document.getElementById('fees-report-year-select');
    const loadFeesReportBtn = document.getElementById('load-fees-report-btn');
    const completedTxMonthCountSpan = document.getElementById('completed-tx-month-count');
    const totalPlatformFeesSpan = document.getElementById('total-platform-fees');
    const feesReportTableContainer = document.getElementById('fees-report-table-container');
    const feesReportLoadingMsg = document.getElementById('fees-report-loading'); // Initial loading message element
    const feesReportNoDataMsg = document.getElementById('fees-report-no-data');

// #endregion

    // #region ======== Global Variables ========
    let allTransactionsData = [];
    let allPaymentMethodsData = [];
    let globalSettingsCache = null;

    // Fee calculation constant
    const PLATFORM_FEE_PERCENTAGE = 0.005; // 0.5%

    // #endregion

    // ==============================================
    // SECTION: مصادقة المشرف (Admin Authentication)
    // ==============================================
    function checkAdminAuth() {
        if (sessionStorage.getItem('adminAuthenticated') === 'true') {
            // If authenticated, hide login prompt and show admin panel
            if(loginPromptContainer) loginPromptContainer.style.display = 'none';
            if(adminPanelContent) adminPanelContent.style.display = 'flex';
            initializeAdminPanel(); // Call initialization AFTER successful auth
        } else {
            // If not authenticated, show login prompt (the visual backdrop)
            if(loginPromptContainer) loginPromptContainer.style.display = 'flex';
            if(adminPanelContent) adminPanelContent.style.display = 'none';

            // Explicitly trigger the prompt dialogs
            requestAdminCredentials();

            // If the login box HTML had a button to trigger the prompt, add listener here
             document.getElementById('prompt-login-button')?.addEventListener('click', requestAdminCredentials);
        }
    }

    // Trigger the initial authentication check when the DOM is ready
    // checkAdminAuth() is called at the end of the DOMContentLoaded listener


    function requestAdminCredentials() {
        // Use native browser prompts for login
        const username = prompt("الرجاء إدخال اسم مستخدم المشرف:");
        if (username === null) {
             // User cancelled the first prompt, might want to stop or offer retry
             alert("تم إلغاء تسجيل الدخول.");
             return; // Stop the process
        }
        const password = prompt("الرجاء إدخال كلمة مرور المشرف:");
        if (password === null) {
             // User cancelled the second prompt
             alert("تم إلغاء تسجيل الدخول.");
             return; // Stop the process
        }


        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            sessionStorage.setItem('adminAuthenticated', 'true');
            // Re-check auth state which will now pass and show the panel
            checkAdminAuth();
        } else {
            alert("بيانات الاعتماد غير صحيحة. الرجاء المحاولة مرة أخرى.");
            // Prompt again on failure
            requestAdminCredentials();
        }
    }


    if (adminLogoutButton) {
        adminLogoutButton.addEventListener('click', () => {
            sessionStorage.removeItem('adminAuthenticated');
            window.location.reload(); // Simple reload to trigger auth check from scratch
        });
    }

    // ==============================================
    // SECTION: Dashboard Logic
    // ==============================================
    function updateDashboardAndStats() {
        // These stats rely on the assumption that `allTransactionsData` is kept updated
        // by the transactions view loading. This is acceptable for a simple dashboard view.
        const pendingCount = allTransactionsData.filter(tx => tx.status === 'Pending').length;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completedTodayCount = allTransactionsData.filter(tx =>
             // Use the completion timestamp if available, otherwise original timestamp for daily count
            (tx.status === 'Completed') && ((tx.statusHistory || []).find(item => item.status === 'Completed')?.timestamp?.toDate() || tx.timestamp?.toDate()) >= today
        ).length;

        if (pendingTransactionsCountSpan) pendingTransactionsCountSpan.textContent = pendingCount;
        if (completedTransactionsCountSpan) completedTransactionsCountSpan.textContent = completedTodayCount;
        // Active methods count is updated in loadManagedPaymentMethods


        if (!recentTransactionsTableBody) return;
        recentTransactionsTableBody.innerHTML = '';

        if (allTransactionsData.length === 0) {
            recentTransactionsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">لا توجد عمليات لعرضها.</td></tr>';
            return;
        }

        // Sort by creation timestamp descending for "recent"
        const recentTransactions = [...allTransactionsData] // Use a copy to not alter the original
            .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
            .slice(0, 5); // Show only top 5


        recentTransactions.forEach(tx => {
            const statusClassSuffix = (tx.status || 'pending').toLowerCase().replace(/\s+/g, '-');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${tx.transactionId || 'N/A'}</td>
                <td>${tx.exchangerName || tx.userId || 'غير معروف'}</td>
                <td>${(tx.sendAmount || 0).toFixed(2)} ${tx.sendCurrencyType || ''}</td>
                <td><span class="status-tag status-${statusClassSuffix}">${tx.status || 'Pending'}</span></td>
            `;
            recentTransactionsTableBody.appendChild(row);
        });
    }


    // ==============================================
    // SECTION: إدارة العمليات (Transactions Management)
    // ==============================================
    /**
     * @description تحديث حالة العملية (الإصدار النهائي والمعدل).
     * @param {string} transactionDocId - معرف مستند العملية.
     * @param {string} newStatus - الحالة الجديدة المراد تطبيقها.
     */
    async function updateTransactionStatus(transactionDocId, newStatus) {
        if (!transactionDocId || !newStatus) return;
        const transactionRef = doc(db, "transactions", transactionDocId);
        try {
            // Create the new status entry with client-side timestamp
            // serverTimestamp() is not supported inside arrayUnion when writing
            const newStatusEntry = {
                status: newStatus,
                timestamp: new Date() // Use client-side date for history
            };

            // Update the document:
            await updateDoc(transactionRef, {
                status: newStatus,
                statusHistory: arrayUnion(newStatusEntry),
                lastAdminUpdate: serverTimestamp() // This is fine as it's a top-level field
            });

            // Reload the current view's data to reflect changes
            // Since statusFilterSelect is global, we can use its current value
            loadTransactions(statusFilterSelect.value);


        } catch (error) {
            console.error("Error updating transaction status:", error);
            // Display error message
            alert(`فشل تحديث حالة العملية: ${error.message}`);
        }
    }


    async function loadTransactions(statusFilter = "all") {
        if (!transactionsTableContainer) return; // Check if container exists

        // Clear previous content and add loading message
        transactionsTableContainer.innerHTML = '';
        const loadingMessageElement = document.createElement('p');
        loadingMessageElement.id = 'transactions-loading-temp'; // Use a temp ID
        loadingMessageElement.textContent = 'جارٍ تحميل العمليات...';
        transactionsTableContainer.appendChild(loadingMessageElement);


        try {
            const transactionsRef = collection(db, "transactions");
            // Always order by creation timestamp descending for main view
            const baseQuery = query(transactionsRef, orderBy("timestamp", "desc"));

            const q = (statusFilter === "all")
                ? baseQuery
                : query(transactionsRef, where("status", "==", statusFilter), orderBy("timestamp", "desc")); // Apply filter and keep order

            const querySnapshot = await getDocs(q);

            // Store fetched data globally
            allTransactionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

             // Remove loading message after fetch
             transactionsTableContainer.querySelector('#transactions-loading-temp')?.remove();


            if (allTransactionsData.length === 0) {
                transactionsTableContainer.innerHTML = "<p>لا توجد عمليات لعرضها حاليًا.</p>";
                updateDashboardAndStats(); // Update dashboard stats based on empty list
                return;
            }

            const table = document.createElement('table');
             // Columns for the main transactions table - Ensure 'سجل الحالات' is NOT here
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>ID العملية</th>
                        <th>العميل</th>
                        <th>يرسل</th>
                        <th>يستلم</th>
                        <th>التاريخ</th>
                        <th>الحالة</th>
                        <th>تغيير الحالة</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector('tbody');

            allTransactionsData.forEach(tx => {
                const row = tbody.insertRow();
                const currentStatus = tx.status || 'Pending';
                const statusClassSuffix = currentStatus.toLowerCase().replace(/\s+/g, '-');
                 // Use original timestamp for main transactions list date display
                const timestampDisplay = tx.timestamp?.toDate() ? tx.timestamp.toDate().toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : 'غير محدد';

                // No status history cell in this table


                row.innerHTML = `
                    <td>${tx.transactionId || 'N/A'}</td>
                    <td>${tx.exchangerName || tx.userId || 'غير معروف'}</td>
                    <td>${(tx.sendAmount || 0).toFixed(2)} ${tx.sendCurrencyName || ''}</td>
                    <td>${(tx.receiveAmount || 0).toFixed(2)} ${tx.receiveCurrencyName || ''}</td>
                    <td>${timestampDisplay}</td>
                    <td><span class="status-tag status-${statusClassSuffix}">${currentStatus}</span></td>
                    <td>
                        <select class="status-change-select" data-id="${tx.id}">
                            <option value="Pending" ${currentStatus === "Pending" ? "selected" : ""}>Pending</option>
                            <option value="Processing" ${currentStatus === "Processing" ? "selected" : ""}>Processing</option>
                            <option value="Completed" ${currentStatus === "Completed" ? "selected" : ""}>Completed</option>
                            <option value="Rejected" ${currentStatus === "Rejected" ? "selected" : ""}>Rejected</option>
                        </select>
                    </td>
                `;
                // Event listener for status change dropdown is delegated on tableContainer
            });

            transactionsTableContainer.appendChild(table);

            // Update dashboard stats after fetching data
            updateDashboardAndStats();

        } catch (error) {
            console.error("Error loading transactions: ", error);
             transactionsTableContainer.querySelector('#transactions-loading-temp')?.remove(); // Remove loading message on error
            transactionsTableContainer.innerHTML = `<p style="color:red;">فشل تحميل العمليات: ${error.message}</p>`;
            allTransactionsData = []; // Clear data on error
            updateDashboardAndStats(); // Update dashboard stats based on empty list
        }
    }
    // Delegate the status change listener on the table container
    transactionsTableContainer?.addEventListener('change', (e) => {
        if (e.target.classList.contains('status-change-select')) {
            const selectedStatus = e.target.value;
            const transactionId = e.target.dataset.id;
            // Find the current status from the data array to reset if cancelled
             const currentTx = allTransactionsData.find(tx => tx.id === transactionId);
             const currentStatus = currentTx?.status || 'Pending';

            // Confirm with the user before changing status
            if (confirm(`هل أنت متأكد من تغيير الحالة إلى ${selectedStatus}؟`)) {
                // Call the function to update status in Firestore
                updateTransactionStatus(transactionId, selectedStatus);
            } else {
                // If user cancels, revert the dropdown value back to the original status
                e.target.value = currentStatus;
            }
        }
    });


    // ==============================================
    // SECTION: إعدادات التبادل العامة (Global Exchange Settings)
    // ==============================================
     // Helper to get global settings cache or fetch if needed
    async function getGlobalSettingsCached() {
        if (globalSettingsCache) {
            return globalSettingsCache;
        }
         try {
            const settingsRef = doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID);
            const docSnap = await getDoc(settingsRef);
            if (docSnap.exists()) {
                globalSettingsCache = docSnap.data();
                return globalSettingsCache;
            } else {
                console.error("Global settings document not found:", GLOBAL_SETTINGS_DOC_ID);
                 // Optionally create a default document if it doesn't exist?
                 // Or just return null and handle missing settings gracefully
                 return null;
            }
        } catch (error) {
            console.error("Error fetching global settings:", error);
            return null;
        }
    }


    async function loadGlobalExchangeSettings() {
        if (!globalExchangeSettingsForm || !globalSettingsLoadingMsg) return;
        globalSettingsLoadingMsg.style.display = 'block';
        if (globalSettingsMessage) globalSettingsMessage.style.display = 'none'; // Hide messages on load start

        try {
            const settings = await getGlobalSettingsCached(); // Use cached or fetch
            if (settings) {
                // Populate form fields if elements exist and data is available
                if(gsUsdtToEgpBuyRateInput) gsUsdtToEgpBuyRateInput.value = settings.usdtToEgpBuyRate ?? '';
                if(gsUsdtToEgpSellRateInput) gsUsdtToEgpSellRateInput.value = settings.usdtToEgpSellRate ?? '';
                if(gsWhatsAppNumberInput) gsWhatsAppNumberInput.value = settings.whatsAppNumber || '';

                if(gsUsdtServiceFeeTypeSelect) gsUsdtServiceFeeTypeSelect.value = settings.usdtToUsdtServiceFeeType || 'none';
                if(gsUsdtServiceFeeValueInput) gsUsdtServiceFeeValueInput.value = settings.usdtToUsdtServiceFeeValue ?? '';
                if(gsUsdtServiceFeeMinCapInput) gsUsdtServiceFeeMinCapInput.value = settings.usdtToUsdtServiceFeeMinCap ?? '';
                if(gsUsdtServiceFeeMaxCapInput) gsUsdtServiceFeeMaxCapInput.value = settings.usdtToUsdtServiceFeeMaxCap ?? '';
            } else {
                 // Handle case where settings document doesn't exist or fetch failed
                 console.warn("Global settings not loaded. Form fields might be empty.");
                 // Optionally clear form fields explicitly if settings is null
                 // globalExchangeSettingsForm.reset();
            }
            // Ensure fee fields are toggled based on loaded/default value
            toggleFeeFields(gsUsdtServiceFeeTypeSelect, gsUsdtServiceFeeValueGroup, gsUsdtServiceFeeValueInput, gsUsdtServiceFeeMaxCapGroup, gsUsdtServiceFeeMaxCapInput, gsUsdtServiceFeeMinCapGroup, gsUsdtServiceFeeMinCapInput);
        } catch (error) {
            console.error("Error loading global settings:", error);
            // Display error message on the form if needed
            if (globalSettingsMessage) {
                 globalSettingsMessage.textContent = `فشل تحميل الإعدادات: ${error.message}`;
                 globalSettingsMessage.style.color = 'red';
                 globalSettingsMessage.style.display = 'block';
            }
        } finally {
            globalSettingsLoadingMsg.style.display = 'none';
        }
    }

    async function saveGlobalExchangeSettings(event) {
        event.preventDefault();
        // Ensure required elements are present before trying to save
        if (!globalExchangeSettingsForm || !gsUsdtToEgpBuyRateInput || !gsUsdtToEgpSellRateInput || !gsWhatsAppNumberInput || !gsUsdtServiceFeeTypeSelect || !gsUsdtServiceFeeValueInput || !gsUsdtServiceFeeMinCapInput || !gsUsdtServiceFeeMaxCapInput) {
             console.error("Global settings form elements not found.");
             alert("خطأ: عناصر النموذج غير موجودة لحفظ الإعدادات.");
             return;
        }

         // Validate numbers
        const buyRate = parseFloat(gsUsdtToEgpBuyRateInput.value);
        const sellRate = parseFloat(gsUsdtToEgpSellRateInput.value);
        const feeValue = parseFloat(gsUsdtServiceFeeValueInput.value);
        const feeMinCap = parseFloat(gsUsdtServiceFeeMinCapInput.value);
        const feeMaxCap = parseFloat(gsUsdtServiceFeeMaxCapInput.value);

        if (isNaN(buyRate) || isNaN(sellRate) || buyRate <= 0 || sellRate <= 0) {
            alert("الرجاء إدخال أرقام صحيحة وموجبة لأسعار الصرف.");
            return;
        }
         // Validate fee value based on fee type
         if (gsUsdtServiceFeeTypeSelect.value !== 'none') {
              if (isNaN(feeValue) || feeValue < 0) {
                   alert("الرجاء إدخال قيمة عددية موجبة للرسوم.");
                   return;
              }
         }
          if (gsUsdtServiceFeeTypeSelect.value === 'percentage') {
             // For percentage fees, validate optional min/max caps if provided
             if (gsUsdtServiceFeeMinCapInput.value !== '' && (isNaN(feeMinCap) || feeMinCap < 0)) {
                  alert("الرجاء إدخال قيمة عددية موجبة للحد الأدنى للرسوم (أو اتركه فارغًا).");
                  return;
             }
             if (gsUsdtServiceFeeMaxCapInput.value !== '' && (isNaN(feeMaxCap) || feeMaxCap < 0)) {
                  alert("الرجاء إدخال قيمة عددية موجبة للحد الأقصى للرسوم (أو اتركه فارغًا).");
                  return;
             }
          }


        const settingsData = {
            usdtToEgpBuyRate: buyRate,
            usdtToEgpSellRate: sellRate,
            whatsAppNumber: gsWhatsAppNumberInput.value.trim(),
            usdtToUsdtServiceFeeType: gsUsdtServiceFeeTypeSelect.value,
            usdtToUsdtServiceFeeValue: feeValue || 0, // Use 0 if NaN/empty for non-'none' type
            usdtToUsdtServiceFeeMinCap: feeMinCap || null, // Use null if NaN or 0 for 'percentage' type
            usdtToUsdtServiceFeeMaxCap: feeMaxCap || null, // Use null if NaN or 0 for 'percentage' type
            lastUpdated: serverTimestamp()
        };

        // Explicitly set min/max caps to null if fee type is not percentage or if input was empty/NaN
         if (settingsData.usdtToUsdtServiceFeeType !== 'percentage') {
             settingsData.usdtToUsdtServiceFeeMinCap = null;
             settingsData.usdtToUsdtServiceFeeMaxCap = null;
             settingsData.usdtToUsdtServiceFeeValue = (settingsData.usdtToUsdtServiceFeeType === 'none') ? 0 : settingsData.usdtToUsdtServiceFeeValue; // Ensure value is 0 if type is none
         } else {
              if (isNaN(feeMinCap) || gsUsdtServiceFeeMinCapInput.value === '') settingsData.usdtToUsdtServiceFeeMinCap = null;
              if (isNaN(feeMaxCap) || gsUsdtServiceFeeMaxCapInput.value === '') settingsData.usdtToUsdtServiceFeeMaxCap = null;
         }


        try {
            // Use setDoc with { merge: true } to create the document if it doesn't exist,
            // or update it if it does.
            await setDoc(doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID), settingsData, { merge: true });
            globalSettingsCache = settingsData; // Update cache immediately
            alert("تم حفظ الإعدادات بنجاح!");
            if (globalSettingsMessage) {
                 globalSettingsMessage.textContent = "تم حفظ الإعدادات بنجاح!";
                 globalSettingsMessage.style.color = 'green';
                 globalSettingsMessage.style.display = 'block';
                 setTimeout(() => { globalSettingsMessage.style.display = 'none'; }, 3000);
            }
        } catch (error) {
            console.error("Error saving global settings:", error);
            alert(`فشل حفظ الإعدادات: ${error.message}`);
             if (globalSettingsMessage) {
                 globalSettingsMessage.textContent = `فشل حفظ الإعدادات: ${error.message}`;
                 globalSettingsMessage.style.color = 'red';
                 globalSettingsMessage.style.display = 'block';
             }
        }
    }


    // ==============================================
    // SECTION: إدارة وسائل الدفع (Payment Methods Management)
    // ==============================================
    // This function is now general purpose for both modal fee sections
    function toggleFeeFields(feeTypeSelect, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput) {
        // Ensure elements exist before trying to access properties
        if (!feeTypeSelect) return;

        const selectedType = feeTypeSelect.value;

        // Hide all fee-related inputs initially
        (valueGroup ?? {style:{}}).style.display = 'none';
        (maxCapGroup ?? {style:{}}).style.display = 'none';
        (minCapGroup ?? {style:{}}).style.display = 'none';

        // Only make value input required if type is fixed or percentage
        if (valueInput) valueInput.required = (selectedType !== 'none');
        // Min/Max cap are not strictly required HTML fields, validation happens in JS on save.


        if (selectedType === "fixed") {
            if (valueGroup) valueGroup.style.display = 'block';
        } else if (selectedType === "percentage") {
            if (valueGroup) valueGroup.style.display = 'block';
            if (minCapGroup) minCapGroup.style.display = 'block';
            if (maxCapGroup) maxCapGroup.style.display = 'block';
        }
    }

    function openPaymentMethodModal(method = null) {
        if(!paymentMethodModal || !paymentMethodForm || !modalTitle) return; // Check if modal elements exist

        paymentMethodForm.reset(); // Clear previous form data
        if (modalMessage) modalMessage.style.display = 'none'; // Hide any previous message
        if (siteAccountFieldsDiv) siteAccountFieldsDiv.style.display = 'none'; // Hide site account fields by default


        const pmDocumentIdInput = document.getElementById('pm-document-id');
        const keyInput = document.getElementById('pm-key');
        const pmNameInput = document.getElementById('pm-name');
        const pmTypeSelect = document.getElementById('pm-type');
        const pmSortOrderInput = document.getElementById('pm-sortOrder');
        const pmMinAmountInput = document.getElementById('pm-minAmount');
        const pmBalanceInput = document.getElementById('pm-balance');
        const pmRequiresWholeNumberCheckbox = document.getElementById('pm-requiresWholeNumber');
        const pmUserIdentifierTypeInput = document.getElementById('pm-userIdentifierType');
        const pmIsSiteAccountCheckbox = document.getElementById('pm-isSiteAccount');
        const pmIsActiveCheckbox = document.getElementById('pm-isActive');
        const pmIconNameInput = document.getElementById('pm-iconName');
        const pmNotesTextarea = document.getElementById('pm-notes');

         // Fee related inputs inside the modal - get references here
         const pmSendingFeeTypeSelect = document.getElementById('pm-sending-fee-type');
         const pmSendingFeeValueInput = document.getElementById('pm-sending-fee-value');
         const pmSendingFeeMinCapInput = document.getElementById('pm-sending-fee-mincap');
         const pmSendingFeeMaxCapInput = document.getElementById('pm-sending-fee-maxcap');
         const pmReceivingFeeTypeSelect = document.getElementById('pm-receiving-fee-type');
         const pmReceivingFeeValueInput = document.getElementById('pm-receiving-fee-value');
         const pmReceivingFeeMinCapInput = document.getElementById('pm-receiving-fee-mincap');
         const pmReceivingFeeMaxCapInput = document.getElementById('pm-receiving-fee-maxcap');

         const pmRecipientInfoInput = document.getElementById('pm-recipientInfo');
         const pmRecipientTypeInput = document.getElementById('pm-recipientType');


        if (pmDocumentIdInput) pmDocumentIdInput.value = ''; // Clear ID for new method state

        if (method) {
            modalTitle.textContent = "تعديل وسيلة دفع";
            if(pmDocumentIdInput) pmDocumentIdInput.value = method.id;
            if(keyInput) {
                keyInput.value = method.key || '';
                keyInput.readOnly = true; // Key should not be changed on edit
                 // Add 'readonly' attribute to prevent keyboard input
                 keyInput.setAttribute('readonly', true);
            }

            if(pmNameInput) pmNameInput.value = method.name || '';
            if(pmTypeSelect) pmTypeSelect.value = method.type || 'EGP';
            if(pmSortOrderInput) pmSortOrderInput.value = method.sortOrder ?? 100;
            if(pmMinAmountInput) pmMinAmountInput.value = method.minAmount ?? '';
            if(pmBalanceInput) pmBalanceInput.value = method.balance ?? '';
            if(pmRequiresWholeNumberCheckbox) pmRequiresWholeNumberCheckbox.checked = method.requiresWholeNumber === true;
            if(pmUserIdentifierTypeInput) pmUserIdentifierTypeInput.value = method.userIdentifierType || '';
            if(pmIsActiveCheckbox) pmIsActiveCheckbox.checked = method.isActive !== false;
            if(pmIsSiteAccountCheckbox) pmIsSiteAccountCheckbox.checked = method.isSiteAccount === true;
            if(pmIconNameInput) pmIconNameInput.value = method.iconName || '';
            if(pmNotesTextarea) pmNotesTextarea.value = method.notes || '';


            if (method.isSiteAccount && siteAccountFieldsDiv) {
                siteAccountFieldsDiv.style.display = 'block';
                 if(pmRecipientInfoInput) pmRecipientInfoInput.value = method.recipientInfo || '';
                 if(pmRecipientTypeInput) pmRecipientTypeInput.value = method.recipientType || '';
            } else if (siteAccountFieldsDiv) {
                 siteAccountFieldsDiv.style.display = 'none';
            }

            const fees = method.fees || {};
            const sendingFees = fees.sending || {};
            if(pmSendingFeeTypeSelect) pmSendingFeeTypeSelect.value = sendingFees.type || 'none';
            if(pmSendingFeeValueInput) pmSendingFeeValueInput.value = sendingFees.value ?? '';
            if(pmSendingFeeMinCapInput) pmSendingFeeMinCapInput.value = sendingFees.minCap ?? '';
            if(pmSendingFeeMaxCapInput) pmSendingFeeMaxCapInput.value = sendingFees.maxCap ?? '';

            const receivingFees = fees.receiving || {};
            if(pmReceivingFeeTypeSelect) pmReceivingFeeTypeSelect.value = receivingFees.type || 'none';
            if(pmReceivingFeeValueInput) pmReceivingFeeValueInput.value = receivingFees.value ?? '';
            if(pmReceivingFeeMinCapInput) pmReceivingFeeMinCapInput.value = receivingFees.minCap ?? '';
            if(pmReceivingFeeMaxCapInput) pmReceivingFeeMaxCapInput.value = receivingFees.maxCap ?? '';

        } else { // New method
            modalTitle.textContent = "إضافة وسيلة دفع جديدة";
             if(keyInput) {
                 keyInput.value = ''; // Ensure empty for new
                 keyInput.readOnly = false; // Key is editable for new method
                 keyInput.removeAttribute('readonly');
             }
             if(pmIsActiveCheckbox) pmIsActiveCheckbox.checked = true; // Default active for new
             if(pmSortOrderInput) pmSortOrderInput.value = 100; // Default sort order
        }

        // Ensure fee fields display correctly based on selected types
        // Pass the actual group elements to toggleFeeFields
        toggleFeeFields(pmSendingFeeTypeSelect, document.querySelector('.pm-sending-fee-value-group'), pmSendingFeeValueInput, document.querySelector('.pm-sending-fee-maxcap-group'), pmSendingFeeMaxCapInput, document.querySelector('.pm-sending-fee-mincap-group'), pmSendingFeeMinCapInput);
        toggleFeeFields(pmReceivingFeeTypeSelect, document.querySelector('.pm-receiving-fee-value-group'), pmReceivingFeeValueInput, document.querySelector('.pm-receiving-fee-maxcap-group'), pmReceivingFeeMaxCapInput, document.querySelector('.pm-receiving-fee-mincap-group'), pmReceivingFeeMinCapInput);

        if (paymentMethodModal) paymentMethodModal.classList.add('show');
    }

    function closePaymentMethodModal() {
        if(paymentMethodModal) paymentMethodModal.classList.remove('show');
         // Optionally clear the form fields here too, although form.reset() on open handles it
    }

    async function savePaymentMethod(event) {
        event.preventDefault();
        if(!paymentMethodForm) {
             console.error("Payment method form not found.");
             alert("خطأ: نموذج حفظ وسيلة الدفع غير موجود.");
             return;
        }

        const documentId = document.getElementById('pm-document-id')?.value;
        const keyInput = document.getElementById('pm-key');
        const keyVal = keyInput?.value.trim();

        const pmNameInput = document.getElementById('pm-name');
        const pmTypeSelect = document.getElementById('pm-type');
        const pmSortOrderInput = document.getElementById('pm-sortOrder');
        const pmMinAmountInput = document.getElementById('pm-minAmount');
        const pmBalanceInput = document.getElementById('pm-balance');
        const pmRequiresWholeNumberCheckbox = document.getElementById('pm-requiresWholeNumber');
        const pmUserIdentifierTypeInput = document.getElementById('pm-userIdentifierType');
        const pmIsSiteAccountCheckbox = document.getElementById('pm-isSiteAccount');
        const pmIsActiveCheckbox = document.getElementById('pm-isActive');
        const pmIconNameInput = document.getElementById('pm-iconName');
        const pmNotesTextarea = document.getElementById('pm-notes');

        // Fee related inputs inside the modal - get references here
         const pmSendingFeeTypeSelect = document.getElementById('pm-sending-fee-type');
         const pmSendingFeeValueInput = document.getElementById('pm-sending-fee-value');
         const pmSendingFeeMinCapInput = document.getElementById('pm-sending-fee-mincap');
         const pmSendingFeeMaxCapInput = document.getElementById('pm-sending-fee-maxcap');
         const pmReceivingFeeTypeSelect = document.getElementById('pm-receiving-fee-type');
         const pmReceivingFeeValueInput = document.getElementById('pm-receiving-fee-value');
         const pmReceivingFeeMinCapInput = document.getElementById('pm-receiving-fee-mincap');
         const pmReceivingFeeMaxCapInput = document.getElementById('pm-receiving-fee-maxcap');

         const pmRecipientInfoInput = document.getElementById('pm-recipientInfo');
         const pmRecipientTypeInput = document.getElementById('pm-recipientType');


         // Basic validation
         if (!pmNameInput?.value.trim()) { alert("حقل الاسم المعروض مطلوب."); return; }
         if (!pmTypeSelect?.value) { alert("حقل نوع العملة مطلوب."); return; }
         if (!documentId && !keyVal) { alert("حقل المفتاح مطلوب لوسيلة دفع جديدة."); return; } // Key only required for new


        const minAmountStr = pmMinAmountInput?.value;
        const minAmountVal = minAmountStr === '' ? null : parseFloat(minAmountStr);
        const balanceStr = pmBalanceInput?.value;
        const balanceVal = balanceStr === '' ? null : parseFloat(balanceStr);

         // Validate numbers for min amount and balance
         if (minAmountVal !== null && (isNaN(minAmountVal) || minAmountVal < 0)) { alert("الحد الأدنى يجب أن يكون رقمًا غير سالب (أو فارغًا)."); return; }
         if (balanceVal !== null && (isNaN(balanceVal) || balanceVal < 0)) { alert("الرصيد يجب أن يكون رقمًا غير سالب (أو فارغًا)."); return; }


        const feesData = {
            sending: {
                type: pmSendingFeeTypeSelect?.value || 'none',
                value: parseFloat(pmSendingFeeValueInput?.value) || 0, // Default 0 if empty/NaN for non-none
                minCap: parseFloat(pmSendingFeeMinCapInput?.value) || null, // Default null if empty/NaN
                maxCap: parseFloat(pmSendingFeeMaxCapInput?.value) || null, // Default null if empty/NaN
            },
            receiving: {
                type: pmReceivingFeeTypeSelect?.value || 'none',
                value: parseFloat(pmReceivingFeeValueInput?.value) || 0, // Default 0 if empty/NaN for non-none
                minCap: parseFloat(pmReceivingFeeMinCapInput?.value) || null, // Default null if empty/NaN
                maxCap: parseFloat(pmReceivingFeeMaxCapInput?.value) || null, // Default null if empty/NaN
            }
        };

         // Clean up fee numbers/nulls based on type explicitly AND validate positive values
         try {
             ['sending', 'receiving'].forEach(feeKey => {
                 const feeConfig = feesData[feeKey];
                 const valueInput = feeKey === 'sending' ? pmSendingFeeValueInput : pmReceivingFeeValueInput;
                 const minCapInput = feeKey === 'sending' ? pmSendingFeeMinCapInput : pmReceivingFeeMinCapInput;
                 const maxCapInput = feeKey === 'sending' ? pmSendingFeeMaxCapInput : pmReceivingFeeMaxCapInput;


                 // Value validation based on type
                 if (feeConfig.type !== 'none') {
                      if (isNaN(feeConfig.value) || feeConfig.value < 0) {
                           alert(`قيمة الرسوم لـ ${feeKey === 'sending' ? 'الإرسال' : 'الاستلام'} يجب أن تكون رقمًا غير سالب.`);
                           throw new Error("Invalid fee value"); // Throw to stop the outer try/catch
                      }
                      // If percentage, value must be > 0
                      if (feeConfig.type === 'percentage' && feeConfig.value <= 0) {
                           alert(`قيمة الرسوم لـ ${feeKey === 'sending' ? 'الإرسال' : 'الاستلام'} (النسبة) يجب أن تكون موجبة.`);
                           throw new Error("Invalid fee value for percentage");
                      }
                       // If fixed, value must be > 0
                      if (feeConfig.type === 'fixed' && feeConfig.value <= 0) {
                           alert(`قيمة الرسوم لـ ${feeKey === 'sending' ? 'الإرسال' : 'الاستلام'} (الثابتة) يجب أن تكون موجبة.`);
                           throw new Error("Invalid fee value for fixed");
                      }
                 } else {
                      feeConfig.value = 0; // Explicitly set value to 0 if type is none
                 }


                 // Min/Max caps validation (only relevant for percentage)
                 if (feeConfig.type !== 'percentage') {
                     feeConfig.minCap = null; // Ensure null if not percentage
                     feeConfig.maxCap = null; // Ensure null if not percentage
                 } else {
                      // For percentage, check if provided caps are valid numbers >= 0
                      if (minCapInput.value !== '' && (isNaN(feeConfig.minCap) || feeConfig.minCap < 0)) {
                           alert(`الحد الأدنى للرسوم لـ ${feeKey === 'sending' ? 'الإرسال' : 'الاستلام'} يجب أن يكون رقمًا غير سالب (أو اتركه فارغًا).`);
                           throw new Error("Invalid fee min cap");
                      }
                      if (maxCapInput.value !== '' && (isNaN(feeConfig.maxCap) || feeConfig.maxCap < 0)) {
                           alert(`الحد الأقصى للرسوم لـ ${feeKey === 'sending' ? 'الإرسال' : 'الاستلام'} يجب أن يكون رقمًا غير سالب (أو اتركه فارغًا).`);
                           throw new Error("Invalid fee max cap");
                      }
                      // Ensure null if input was empty string or NaN even if type is percentage
                      if (isNaN(feeConfig.minCap) || minCapInput.value === '') feeConfig.minCap = null;
                      if (isNaN(feeConfig.maxCap) || maxCapInput.value === '') feeConfig.maxCap = null;
                 }

             });
         } catch (validationError) {
             console.error("Fee validation failed:", validationError.message);
             return; // Stop save process if validation fails
         }


        let dataToSave = {
            name: pmNameInput?.value.trim() || '',
            type: pmTypeSelect?.value || 'EGP',
            sortOrder: parseInt(pmSortOrderInput?.value) || 100,
            minAmount: minAmountVal,
            balance: balanceVal,
            requiresWholeNumber: pmRequiresWholeNumberCheckbox?.checked === true,
            userIdentifierType: pmUserIdentifierTypeInput?.value.trim() || '',
            isActive: pmIsActiveCheckbox?.checked === true,
            isSiteAccount: pmIsSiteAccountCheckbox?.checked === true,
            fees: feesData,
            iconName: pmIconNameInput?.value.trim() || '',
            notes: pmNotesTextarea?.value.trim() || '',
            lastUpdated: serverTimestamp()
        };

         if (!documentId) { // Only add key on creation
             // Key is already validated as required above
             dataToSave.key = keyVal;
         }


        if (dataToSave.isSiteAccount) {
             // Recipient info input reference obtained inside function
             dataToSave.recipientInfo = pmRecipientInfoInput?.value.trim() || '';
             dataToSave.recipientType = pmRecipientTypeInput?.value.trim() || '';
             if (!dataToSave.recipientInfo) { alert("معلومات المستلم مطلوبة لحساب الموقع."); return; }
        } else {
             // Remove site account specific fields if not a site account by explicitly setting to undefined or null
             // Using undefined means Firestore will delete the field if it exists
             dataToSave.recipientInfo = undefined;
             dataToSave.recipientType = undefined;
        }


        try {
            if (documentId) {
                // Update existing document
                // The key input is readOnly, so it won't be in dataToSave anyway unless manually added.
                await updateDoc(doc(db, "paymentMethods", documentId), dataToSave);
            } else {
                 // Add new document
                 // Check for duplicate key before adding
                 const existing = allPaymentMethodsData.find(m => m.key === keyVal);
                 if (existing) {
                      alert(`المفتاح "${keyVal}" مستخدم بالفعل لوسيلة الدفع: ${existing.name}.`);
                      return;
                 }
                // Ensure creation timestamp is added if needed, though Firestore adds timestamp automatically
                // dataToSave.createdAt = serverTimestamp(); // Add if you want a separate creation timestamp
                await addDoc(collection(db, "paymentMethods"), dataToSave);
            }
            alert("تم الحفظ بنجاح!");
            closePaymentMethodModal();
            loadManagedPaymentMethods(); // Reload list to show changes
        } catch (error) {
            console.error("Error saving payment method:", error);
            // Check if the error message is from our specific validation throws
            if (error.message.startsWith("Invalid fee value") || error.message.startsWith("Invalid fee min cap") || error.message.startsWith("Invalid fee max cap")) {
                 // Specific error message already alerted
            } else {
                 alert(`فشل الحفظ: ${error.message}`);
            }
        }
    }

    async function deleteManagedPaymentMethod(documentId, displayName) {
        if (confirm(`هل أنت متأكد من رغبتك في حذف وسيلة الدفع "${displayName}" بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            try {
                await deleteDoc(doc(db, "paymentMethods", documentId));
                alert("تم الحذف بنجاح.");
                loadManagedPaymentMethods(); // Reload list to show the method is removed
            } catch (error) {
                console.error("Error deleting payment method: ", error);
                alert(`فشل الحذف: ${error.message}`);
            }
        }
    }

    async function loadManagedPaymentMethods() {
        if (!paymentMethodsContainer) return; // Check if container exists

        // Clear previous content and add loading message
        paymentMethodsContainer.innerHTML = '';
        const loadingMessageElement = document.createElement('p');
        loadingMessageElement.id = 'payment-methods-loading-temp'; // Use a temp ID
        loadingMessageElement.textContent = 'جارٍ تحميل وسائل الدفع...';
        paymentMethodsContainer.appendChild(loadingMessageElement);


        try {
            const q = query(collection(db, "paymentMethods"), orderBy("sortOrder", "asc"));
            const querySnapshot = await getDocs(q);

            // Store fetched data globally BEFORE rendering
            allPaymentMethodsData = querySnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }));

            // Update active methods count (should be in dashboard stats area)
            if(activeMethodsCountSpan) activeMethodsCountSpan.textContent = allPaymentMethodsData.filter(d => d.isActive).length;


             // Remove loading message after fetch
             paymentMethodsContainer.querySelector('#payment-methods-loading-temp')?.remove();


            if (allPaymentMethodsData.length === 0) {
                paymentMethodsContainer.innerHTML = "<p>لم يتم إضافة وسائل دفع بعد.</p>";
                return;
            }

            // Render cards using the stored data
            allPaymentMethodsData.forEach((method) => {
                const card = document.createElement('div');
                card.className = 'payment-method-card';
                card.dataset.id = method.id; // Attach ID for delegation

                let siteAccountInfoHTML = method.isSiteAccount ? `<p style="background-color: #e9f5ff; padding: 5px; border-radius: 4px;"><strong>حساب الموقع:</strong> ${method.recipientInfo || 'غير محدد'}</p>` : '';
                let feesHTML = '';
                if(method.fees?.sending?.type !== 'none' || method.fees?.receiving?.type !== 'none') {
                    feesHTML = `<p><strong>الرسوم:</strong> <span>يوجد</span></p>`;
                }

                card.innerHTML = `
                    <h4>${method.iconName ? `<box-icon name='${method.iconName}'></box-icon>` : ''} ${method.name || 'غير مسمى'} ${method.isActive ? '<span style="color:green;font-size:0.8em;">(مفعل)</span>' : '<span style="color:red;font-size:0.8em;">(غير مفعل)</span>'}</h4>
                    <p><strong>المفتاح:</strong> ${method.key || 'N/A'}</p>
                    <p><strong>الحد الأدنى:</strong> ${method.minAmount ?? 'N/A'} ${method.type || ''}</p>
                    <p style="color: var(--primary-color-dark); font-weight: 600;"><strong>الرصيد المتاح:</strong> ${typeof method.balance === 'number' ? `${method.balance.toFixed(2)} ${method.type || ''}` : 'غير محدد'}</p>
                    ${siteAccountInfoHTML}
                    ${feesHTML}
                    ${method.notes ? `<p><strong>ملاحظات:</strong> ${method.notes}</p>` : ''}
                    <div class="actions">
                        <button class="button secondary edit-pm-btn">تعديل</button>
                        <button class="button danger delete-pm-btn">حذف</button>
                    </div>
                `;
                // Event listeners are handled by delegation on paymentMethodsContainer
                paymentMethodsContainer.appendChild(card);
            });
        } catch (error) {
            console.error("Error loading payment methods:", error);
            paymentMethodsContainer.querySelector('#payment-methods-loading-temp')?.remove(); // Remove loading message on error
            paymentMethodsContainer.innerHTML = `<p style="color:red;">فشل تحميل وسائل الدفع.</p>`;
            allPaymentMethodsData = []; // Clear data on error
            if(activeMethodsCountSpan) activeMethodsCountSpan.textContent = 'خطأ'; // Update count on error
        }
    }
     // Delegate edit/delete listeners on the payment methods container
     paymentMethodsContainer?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-pm-btn');
        const deleteBtn = e.target.closest('.delete-pm-btn');

        if (editBtn) {
            const cardElement = e.target.closest('.payment-method-card');
            const methodId = cardElement?.dataset.id;
            if (methodId) {
                 // Find the method data in the globally stored array
                 const methodToEdit = allPaymentMethodsData.find(m => m.id === methodId);
                 if (methodToEdit) {
                      openPaymentMethodModal(methodToEdit);
                 } else {
                      console.error("Could not find payment method data for ID:", methodId);
                      alert("فشل جلب بيانات وسيلة الدفع للتعديل.");
                 }
            }
        } else if (deleteBtn) {
            const cardElement = e.target.closest('.payment-method-card');
            const methodId = cardElement?.dataset.id;
            // Get the display name from the card element for confirmation
             const displayName = cardElement?.querySelector('h4')?.textContent.trim().replace('(مفعل)', '').replace('(غير مفعل)', '').trim();

            if (methodId && displayName) {
                 deleteManagedPaymentMethod(methodId, displayName);
            }
        }
    });

    // ==============================================
    // SECTION: Marquee Management
    // ==============================================
    async function loadMarqueeSettings() {
        if (!marqueeSettingsForm) return;
        // marqueeSettingsLoadingMsg.style.display = 'block'; // No loading indicator for this small section
        // marqueeSettingsMessage.style.display = 'none'; // No message area for this section

        try {
            const settings = await getGlobalSettingsCached(); // Use cached or fetch
             if (settings) {
                if (mqMessagesTextarea) mqMessagesTextarea.value = (settings.marqueeMessages || []).join('\n');
                if (mqSpeedInput) mqSpeedInput.value = settings.marqueeAnimationSpeedFactor ?? 7;
            }
        } catch(e) {
            console.error("Error loading marquee settings:", e);
             // No specific message area for this section currently
        } finally {
            // marqueeSettingsLoadingMsg.style.display = 'none';
        }
    }
    async function saveMarqueeSettings(event) {
        event.preventDefault();
        if (!marqueeSettingsForm || !mqMessagesTextarea || !mqSpeedInput) {
             console.error("Marquee settings form elements not found.");
             alert("خطأ: عناصر النموذج غير موجودة.");
             return;
        }
         const speed = parseFloat(mqSpeedInput.value);
         if (isNaN(speed) || speed < 3) {
             alert("مدة العرض يجب أن تكون رقمًا أكبر من أو يساوي 3.");
             return;
         }

        const settingsData = {
            marqueeMessages: mqMessagesTextarea.value.split('\n').map(line => line.trim()).filter(line => line.length > 0), // Trim and filter empty lines
            marqueeAnimationSpeedFactor: speed,
            lastUpdatedMarquee: serverTimestamp()
        };
        try {
            const settingsRef = doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID);
            await updateDoc(settingsRef, settingsData);
            // Update cache if globalSettingsCache exists
            if (globalSettingsCache) {
                globalSettingsCache = { ...globalSettingsCache, ...settingsData };
            }
            alert("تم حفظ إعدادات الشريط بنجاح.");
             // No specific message area for this section currently

        } catch (error) {
            console.error("Error saving marquee settings:", error);
            alert(`فشل حفظ الإعدادات: ${error.message}`);
        }
    }


    // ==============================================
    // SECTION: تقرير رسوم المنصة (Platform Fees Report) - Implementation
    // ==============================================

    /**
     * Calculates the platform fee for a transaction in EGP.
     * Fee is 0.5% of the receive amount. Converts USDT to EGP if necessary.
     * @param {object} transaction - The transaction object.
     * @param {number} usdtBuyRate - The current site's USDT to EGP buy rate.
     * @returns {number} - The calculated fee in EGP, or 0 if calculation is not possible or receiveAmount is not positive.
     */
    function calculatePlatformFee(transaction, usdtBuyRate) {
        // Ensure required properties exist and receive amount is positive
        if (!transaction || typeof transaction.receiveAmount !== 'number' || transaction.receiveAmount <= 0 || !transaction.receiveCurrencyType) {
            return 0;
        }

        let receiveAmountInEGP = 0;

        if (transaction.receiveCurrencyType === 'EGP') {
            receiveAmountInEGP = transaction.receiveAmount;
        } else if (transaction.receiveCurrencyType === 'USDT') {
            if (typeof usdtBuyRate !== 'number' || usdtBuyRate <= 0) {
                // console.warn("USDT Buy Rate not available or invalid for fee calculation. Transaction ID:", transaction.transactionId);
                return 0; // Cannot calculate if rate is missing or invalid
            }
            receiveAmountInEGP = transaction.receiveAmount * usdtBuyRate;
        } else {
            // Handle other currencies if they exist and need conversion for fee basis
            // console.warn(`Unknown receive currency type for fee calculation: ${transaction.receiveCurrencyType}. Transaction ID:`, transaction.transactionId);
            return 0;
        }

        // Ensure the amount is a valid number before calculating fee
        if (isNaN(receiveAmountInEGP) || receiveAmountInEGP < 0) { // Fee base should be >= 0
             return 0;
        }

        return receiveAmountInEGP * PLATFORM_FEE_PERCENTAGE;
    }

    /**
     * Renders the fees report table and summary statistics.
     * @param {Array<object>} transactionsWithFees - Array of completed transactions including platformFeeEGP.
     */
    function renderFeesReportTable(transactionsWithFees) {
        if (!feesReportTableContainer || !feesReportNoDataMsg || !completedTxMonthCountSpan || !totalPlatformFeesSpan) return;

        feesReportTableContainer.innerHTML = ''; // Clear previous content
        feesReportNoDataMsg.style.display = 'none';


        if (transactionsWithFees.length === 0) {
            feesReportNoDataMsg.style.display = 'block';
            completedTxMonthCountSpan.textContent = 0;
            totalPlatformFeesSpan.textContent = '0.00 EGP';
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID العملية</th>
                    <th>العميل</th>
                    <th>المبلغ المرسل</th>
                    <th>المبلغ المستلم</th>
                    <th>تاريخ الإكمال</th>
                    <th>رسوم المنصة (EGP)</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        let totalFees = 0;

        transactionsWithFees.forEach(tx => {
            const row = tbody.insertRow();
             // Use the completion timestamp from history if available
            const completionEntry = (tx.statusHistory || []).find(item => item.status === 'Completed');
            const completionTimestamp = completionEntry?.timestamp;

             // Display completion date if available, otherwise original creation date
            const dateToDisplay = completionTimestamp?.toDate() || tx.timestamp?.toDate();

            const dateDisplayString = dateToDisplay ?
                dateToDisplay.toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) + (completionEntry ? '' : ' (إنشاء)') :
                'غير محدد';


            row.innerHTML = `
                <td>${tx.transactionId || 'N/A'}</td>
                <td>${tx.exchangerName || tx.userId || 'غير معروف'}</td>
                <td>${(tx.sendAmount || 0).toFixed(2)} ${tx.sendCurrencyName || ''} (${tx.sendCurrencyType || ''})</td>
                <td>${(tx.receiveAmount || 0).toFixed(2)} ${tx.receiveCurrencyName || ''} (${tx.receiveCurrencyType || ''})</td>
                <td>${dateDisplayString}</td>
                <td>${(tx.platformFeeEGP || 0).toFixed(2)} EGP</td>
            `;
             totalFees += (tx.platformFeeEGP || 0); // Sum up calculated fees
        });

        feesReportTableContainer.appendChild(table);

        // Update summary stats
        completedTxMonthCountSpan.textContent = transactionsWithFees.length;
        totalPlatformFeesSpan.textContent = `${totalFees.toFixed(2)} EGP`;
    }

    /**
     * Loads completed transactions and calculates fees for the specified month and year.
     * @param {number} year - The selected year.
     * @param {number} month - The selected month (1-12).
     */
    async function loadPlatformFeesReport(year, month) {
        if (!feesReportTableContainer || !feesReportLoadingMsg || !completedTxMonthCountSpan || !totalPlatformFeesSpan || !feesReportNoDataMsg) return;

        // Clear previous content and add loading message
        feesReportTableContainer.innerHTML = '';
        feesReportNoDataMsg.style.display = 'none'; // Hide no data message

        const loadingMessageElement = document.createElement('p');
        loadingMessageElement.id = 'fees-report-loading-temp'; // Use a temp ID to avoid conflict
        loadingMessageElement.textContent = 'جارٍ تحميل بيانات التقرير...';
        feesReportTableContainer.appendChild(loadingMessageElement);

        completedTxMonthCountSpan.textContent = '...';
        totalPlatformFeesSpan.textContent = '... EGP';

        try {
            // Get start and end dates for the month
            const startDate = new Date(year, month - 1, 1); // Month is 0-indexed in Date constructor
            const endDate = new Date(year, month, 0); // Last day of the month (day 0 of next month)
            endDate.setHours(23, 59, 59, 999); // Include the whole last day

             // Validate selected month/year is not in the future
             const now = new Date();
             const selectedDate = new Date(year, month - 1, 1); // Use start of the selected month
             // Compare selected month's start date with current date
             if (selectedDate > now) {
                  // Selected month is in the future
                  feesReportTableContainer.querySelector('#fees-report-loading-temp')?.remove(); // Remove loading
                  feesReportNoDataMsg.textContent = `الشهر المحدد (${year}-${month}) لم يأتِ بعد.`;
                  feesReportNoDataMsg.style.display = 'block';
                  completedTxMonthCountSpan.textContent = 0;
                  totalPlatformFeesSpan.textContent = '0.00 EGP';
                  return; // Stop loading process
             }


            // Fetch completed transactions within the month based on the *creation* timestamp
            const transactionsRef = collection(db, "transactions");
            // Query only for 'Completed' transactions
            const q = query(
                transactionsRef,
                where("status", "==", "Completed"),
                where("timestamp", ">=", startDate),
                where("timestamp", "<=", endDate),
                orderBy("timestamp", "desc") // Order by creation timestamp desc
            );

            const querySnapshot = await getDocs(q);

            // Fetch USDT buy rate from settings cache or fetch
            const settings = await getGlobalSettingsCached();
            const usdtBuyRate = settings?.usdtToEgpBuyRate ?? null;

            const transactionsWithFees = [];
            querySnapshot.docs.forEach(doc => {
                const txData = doc.data();
                 // We've already filtered by status=='Completed' in the query,
                 // and by creation timestamp range.
                 // We'll include all such transactions found by the query.
                 // The `calculatePlatformFee` function handles cases where rate is missing.

                const platformFeeEGP = calculatePlatformFee(txData, usdtBuyRate);
                transactionsWithFees.push({ id: doc.id, ...txData, platformFeeEGP });
            });

             // Sort transactions by completion date (preferentially) or creation date
             transactionsWithFees.sort((a, b) => {
                const aCompTimestamp = (a.statusHistory || []).find(item => item.status === 'Completed')?.timestamp || a.timestamp;
                const bCompTimestamp = (b.statusHistory || []).find(item => item.status === 'Completed')?.timestamp || b.timestamp;
                 // Handle cases where timestamps might be missing or null
                const aSeconds = aCompTimestamp?.seconds || 0;
                const bSeconds = bCompTimestamp?.seconds || 0;
                 return bSeconds - aSeconds; // Newest first
             });


            feesReportTableContainer.querySelector('#fees-report-loading-temp')?.remove(); // Remove loading message
            renderFeesReportTable(transactionsWithFees); // Render the table and stats

        } catch (error) {
            console.error("Error loading fees report:", error);
            feesReportTableContainer.querySelector('#fees-report-loading-temp')?.remove(); // Remove loading message on error
            feesReportTableContainer.innerHTML = `<p style="color:red;">فشل تحميل تقرير الرسوم: ${error.message}</p>`;
            completedTxMonthCountSpan.textContent = 0;
            totalPlatformFeesSpan.textContent = '0.00 EGP';
            feesReportNoDataMsg.style.display = 'none'; // Hide no data message on error
        }
    }


    /**
     * Initializes the month and year selects and sets up event listeners.
     * Loads the report for the currently selected month on activation.
     */
    function initializeFeesView() {
        // Check if selects exist
        if (!feesReportView || !feesReportMonthSelect || !feesReportYearSelect || !loadFeesReportBtn) {
             console.error("Fees report view elements not found.");
             return; // Exit if elements are missing
        }

        // Populate selects ONLY if not already initialized
        if (feesReportView.dataset.initialized !== 'true') {
            const now = new Date();
            const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
            const currentYear = now.getFullYear();

            // Populate Month Select (Clear existing first if any - defensive)
            feesReportMonthSelect.innerHTML = '';
            const months = [
                "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
            ];
            months.forEach((monthName, index) => {
                const option = document.createElement('option');
                option.value = index + 1; // Use 1-indexed month value (1-12)
                option.textContent = monthName;
                if (index + 1 === currentMonth) {
                    option.selected = true;
                }
                feesReportMonthSelect.appendChild(option);
            });

            // Populate Year Select (Clear existing first if any - defensive)
            feesReportYearSelect.innerHTML = '';
            const startYear = 2023; // Adjust the start year as needed (e.g., from first transaction date)
            const endYear = currentYear;
            for (let year = endYear; year >= startYear; year--) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === currentYear) {
                    option.selected = true;
                }
                feesReportYearSelect.appendChild(option);
            }

            // Add event listener to the Load Report button ONLY ONCE
            loadFeesReportBtn.addEventListener('click', () => {
                const selectedMonth = parseInt(feesReportMonthSelect.value);
                const selectedYear = parseInt(feesReportYearSelect.value);
                loadPlatformFeesReport(selectedYear, selectedMonth);
            });

            // Mark the view as initialized AFTER populating selects and adding listeners
            feesReportView.dataset.initialized = 'true';
        }

        // Always load the report for the currently selected month/year when the view is activated
        // This handles both the initial load (after selects are populated) and subsequent clicks on the sidebar link
        const selectedMonth = parseInt(feesReportMonthSelect.value);
        const selectedYear = parseInt(feesReportYearSelect.value);
        loadPlatformFeesReport(selectedYear, selectedMonth);

    }


    // ==============================================
    // SECTION: Initialization and Event Listeners
    // ==============================================
    // View Switching Logic
     const adminSidebar = document.getElementById('admin-sidebar');
     const adminMainContent = document.getElementById('admin-main-content'); // Not directly used for switching, but useful ref
     const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
     const contentViews = document.querySelectorAll('.content-view');
     const mainContentTitle = document.getElementById('main-content-title');
     const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
     const overlay = document.getElementById('overlay');

    const switchView = (targetId) => {
        // Update active class in sidebar nav
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.target === targetId) {
                link.classList.add('active');
                // Update main title from the text span within the link
                mainContentTitle.textContent = link.querySelector('span').textContent;
            }
        });

        // Show/hide content views
        contentViews.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) {
                view.classList.add('active');
            }
        });

        // Call specific initialization/loading functions for each view when activated
        // Note: These functions should handle their own loading states and check if already initialized (like initializeFeesView)
        if (targetId === 'dashboard-view') {
             loadTransactions('all'); // Reload all data for dashboard stats
        } else if (targetId === 'transactions-view') {
            loadTransactions(statusFilterSelect.value); // Load main transactions table with current filter
        } else if (targetId === 'settings-view') {
            loadGlobalExchangeSettings();
            loadMarqueeSettings();
        } else if (targetId === 'payment-methods-view') {
            loadManagedPaymentMethods();
        } else if (targetId === 'fees-report-view') {
            initializeFeesView(); // Initialize selects/listeners AND loads the report for the currently selected month/year
        }

        // Close mobile menu if active after selection
        if (adminSidebar && overlay && adminSidebar.classList.contains('mobile-active')) {
             adminSidebar.classList.remove('mobile-active');
             overlay.classList.remove('active');
        }
    };


    function initializeAdminPanel() {
        // Add event listeners for sidebar navigation using the new switchView function
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchView(e.currentTarget.dataset.target);
            });
        });

        // Add listener for the "View All Transactions" link in the dashboard
        if(viewAllTransactionsLink) {
             viewAllTransactionsLink.addEventListener('click', (e) => {
                  e.preventDefault();
                  switchView(e.currentTarget.dataset.target);
             });
        }

        // Add mobile menu toggle listener
        if (mobileMenuToggle && adminSidebar && overlay) {
             mobileMenuToggle.addEventListener('click', () => {
                  adminSidebar.classList.toggle('mobile-active');
                  overlay.classList.toggle('active');
             });
             overlay.addEventListener('click', () => {
                  adminSidebar.classList.remove('mobile-active');
                  overlay.classList.remove('active');
             });
        }


        // --- General Event Listeners (delegated or on persistent elements) ---

        // Transaction filter and refresh button listeners
        statusFilterSelect?.addEventListener('change', () => loadTransactions(statusFilterSelect.value));
        refreshTransactionsBtn?.addEventListener('click', () => loadTransactions(statusFilterSelect.value));

        // Search input listener delegated to a static parent
        document.querySelector('#transactions-section .controls')?.addEventListener('input', (e) => {
            if (e.target.id === 'search-transactions') {
                const searchTerm = e.target.value.toLowerCase().trim();
                const tbody = document.querySelector('#transactions-table-container tbody');
                 if (tbody) {
                     tbody.querySelectorAll('tr').forEach(row => {
                        const rowTextContent = row.textContent || ''; // Get all text in row
                        row.style.display = rowTextContent.toLowerCase().includes(searchTerm) ? "" : "none";
                    });
                 }
            }
        });

        // Global settings form listener
        globalExchangeSettingsForm?.addEventListener('submit', saveGlobalExchangeSettings);
        // Marquee settings form listener
        marqueeSettingsForm?.addEventListener('submit', saveMarqueeSettings);

        // Payment Method Add button listener
        addNewPaymentMethodBtn?.addEventListener('click', () => openPaymentMethodModal());

        // Payment Method Modal close button listener and outside click listener
        closeModalBtn?.addEventListener('click', closePaymentMethodModal);
        paymentMethodModal?.addEventListener('click', (e) => {
             if (e.target === paymentMethodModal) {
                 closePaymentMethodModal();
             }
        });

        // Payment Method Form submit and cancel button listeners
        paymentMethodForm?.addEventListener('submit', savePaymentMethod);
        document.getElementById('cancel-payment-method-btn')?.addEventListener('click', closePaymentMethodModal);

        // Payment Method isSiteAccount checkbox listener
        document.getElementById('pm-isSiteAccount')?.addEventListener('change', (e) => {
            if (siteAccountFieldsDiv) siteAccountFieldsDiv.style.display = e.target.checked ? 'block' : 'none';
        });

        // Fee type select listeners for modal (delegated to paymentMethodForm if it exists)
         paymentMethodForm?.addEventListener('change', (e) => {
             if (e.target.id === 'pm-sending-fee-type' || e.target.id === 'pm-receiving-fee-type') {
                 const targetId = e.target.id;
                 let valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput;
                 // Get element references dynamically within the event handler
                 const form = e.target.closest('form'); // Get the parent form
                 if (!form) return; // Should not happen if delegated on form, but safety check
                 if (targetId === 'pm-sending-fee-type') {
                      valueGroup = form.querySelector('.pm-sending-fee-value-group');
                      valueInput = form.querySelector('#pm-sending-fee-value');
                      minCapGroup = form.querySelector('.pm-sending-fee-mincap-group');
                      minCapInput = form.querySelector('#pm-sending-fee-mincap');
                      maxCapGroup = form.querySelector('.pm-sending-fee-maxcap-group');
                      maxCapInput = form.querySelector('#pm-sending-fee-maxcap');
                 } else { // pm-receiving-fee-type
                      valueGroup = form.querySelector('.pm-receiving-fee-value-group');
                      valueInput = form.querySelector('#pm-receiving-fee-value');
                      minCapGroup = form.querySelector('.pm-receiving-fee-mincap-group');
                      minCapInput = form.querySelector('#pm-receiving-fee-mincap');
                      maxCapGroup = form.querySelector('.pm-receiving-fee-maxcap-group');
                      maxCapInput = form.querySelector('#pm-receiving-fee-maxcap');
                 }
                  toggleFeeFields(e.target, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput);
             }
         });


        // Global settings fee type select listener
        gsUsdtServiceFeeTypeSelect?.addEventListener('change', (e) => {
             toggleFeeFields(e.target, gsUsdtServiceFeeValueGroup, gsUsdtServiceFeeValueInput, gsUsdtServiceFeeMaxCapGroup, gsUsdtServiceFeeMaxCapInput, gsUsdtServiceFeeMinCapGroup, gsUsdtServiceFeeMinCapInput);
        });

        // Fees Report Month/Year select listeners are added within initializeFeesView by the button listener


        // --- Initial Load ---
        // Simulate clicking the default active nav link (dashboard) to trigger the initial view load
        const initialActiveLink = document.querySelector('.sidebar-nav .nav-link.active');
        if (initialActiveLink) {
            switchView(initialActiveLink.dataset.target);
        } else {
            // Fallback: default to dashboard view if no active link is found
            switchView('dashboard-view');
        }
    }

    // --- Start the authentication check process ---
    // This function call is the entry point after DOM is ready
    checkAdminAuth();
});