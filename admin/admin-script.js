import { db } from '../auth/firebase-config.js';
import {
    collection, getDocs, doc, updateDoc, addDoc, deleteDoc,
    orderBy, query, where, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
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
    const gsWhatsAppNumberInput = document.getElementById('gs-whatsAppNumber'); // الحقل الجديد
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

    // ==============================================
    // SECTION: مصادقة المشرف
    // ==============================================
    function checkAdminAuth() {
        const isAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
        if (isAuthenticated) {
            loginPromptContainer.style.display = 'none';
            adminPanelContent.style.display = 'block';
            initializeAdminPanel();
        } else {
            loginPromptContainer.style.display = 'flex';
            adminPanelContent.style.display = 'none';
            requestAdminCredentials();
        }
    }
    function requestAdminCredentials() {
        const username = prompt("الرجاء إدخال اسم مستخدم المشرف:");
        if (username === null) { loginPromptContainer.innerHTML = "<h2>تسجيل دخول المشرف</h2><p style='color:orange;'>تم إلغاء تسجيل الدخول.</p>"; return; }
        const password = prompt("الرجاء إدخال كلمة مرور المشرف:");
        if (password === null) { loginPromptContainer.innerHTML = "<h2>تسجيل دخول المشرف</h2><p style='color:orange;'>تم إلغاء تسجيل الدخول.</p>"; return; }
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            sessionStorage.setItem('adminAuthenticated', 'true');
            checkAdminAuth();
        } else {
            alert("بيانات الاعتماد غير صحيحة. الرجاء المحاولة مرة أخرى.");
            loginPromptContainer.innerHTML = "<h2>تسجيل دخول المشرف</h2><p style='color:red;'>فشل تسجيل الدخول. حاول تحديث الصفحة.</p>";
        }
    }
    if (adminLogoutButton) {
        adminLogoutButton.addEventListener('click', () => {
            sessionStorage.removeItem('adminAuthenticated');
            window.location.reload();
        });
    }

    // ==============================================
    // SECTION: إدارة العمليات (Transactions)
    // ==============================================
    async function updateTransactionStatus(transactionDocId, newStatus) {
        if (!transactionDocId || !newStatus) { alert("خطأ: معرف العملية أو الحالة الجديدة مفقود."); return; }
        const transactionRef = doc(db, "transactions", transactionDocId);
        try {
            await updateDoc(transactionRef, { status: newStatus, lastAdminUpdate: serverTimestamp() });
            loadTransactions(statusFilterSelect.value);
        } catch (error) {
            alert(`فشل تحديث حالة العملية: ${error.message}`);
        }
    }
    async function loadTransactions(statusFilter = "all") {
        if (searchTransactionsInput) { searchTransactionsInput.value = ""; }
        if (!transactionsTableContainer || !transactionsLoadingMsg) return;
        transactionsLoadingMsg.style.display = 'block';
        transactionsTableContainer.innerHTML = '';
        transactionsTableContainer.appendChild(transactionsLoadingMsg);
        try {
            const transactionsRef = collection(db, "transactions");
            let q;
            if (statusFilter === "all") {
                q = query(transactionsRef, orderBy("timestamp", "desc"));
            } else {
                q = query(transactionsRef, where("status", "==", statusFilter), orderBy("timestamp", "desc"));
            }
            const querySnapshot = await getDocs(q);
            transactionsLoadingMsg.style.display = 'none';
            if (querySnapshot.empty) {
                transactionsTableContainer.innerHTML = "<p>لا توجد عمليات لعرضها حاليًا.</p>";
                return;
            }
            const table = document.createElement('table');
            table.innerHTML = `<thead><tr><th>ID العملية</th><th>العميل</th><th>يرسل</th><th>يستلم</th><th>التاريخ</th><th>الحالة الحالية</th><th>تغيير الحالة إلى</th></tr></thead><tbody></tbody>`;
            const tbody = table.querySelector('tbody');
             querySnapshot.forEach((docSnapshot) => {
                const tx = docSnapshot.data();
                const txDocId = docSnapshot.id;
                const row = tbody.insertRow();
                const currentStatus = tx.status || 'Pending'; 
                const statusClassSuffix = currentStatus.toLowerCase().replace(/\s+/g, '-');
                const fullStatusClassName = `status-${statusClassSuffix}`;
                const sendAmountDisplay = typeof tx.sendAmount === 'number' ? tx.sendAmount.toFixed(2) : 'N/A';
                const receiveAmountDisplay = typeof tx.receiveAmount === 'number' ? tx.receiveAmount.toFixed(2) : 'N/A';
                const timestampDisplay = tx.timestamp && tx.timestamp.toDate ? tx.timestamp.toDate().toLocaleString('ar-EG-u-nu-latn') : (tx.timestamp && tx.timestamp.seconds ? new Date(tx.timestamp.seconds * 1000).toLocaleString('ar-EG-u-nu-latn') : 'غير محدد');
                row.innerHTML = `
                    <td>${tx.transactionId || 'N/A'}</td>
                    <td>${tx.exchangerName || tx.userId || 'غير معروف'}</td>
                    <td>${sendAmountDisplay} ${tx.sendCurrencyName || ''} (${tx.sendCurrencyType || tx.sendCurrencyKey || ''})</td>
                    <td>${receiveAmountDisplay} ${tx.receiveCurrencyName || ''} (${tx.receiveCurrencyType || tx.receiveCurrencyKey || ''})</td>
                    <td>${timestampDisplay}</td>
                    <td><span class="status-tag ${fullStatusClassName}">${currentStatus}</span></td>
                    <td>
                        <select class="status-change-select" data-id="${txDocId}">
                            <option value="Pending" ${currentStatus === "Pending" ? "selected" : ""}>Pending</option>
                            <option value="Processing" ${currentStatus === "Processing" ? "selected" : ""}>Processing</option>
                            <option value="Completed" ${currentStatus === "Completed" ? "selected" : ""}>Completed</option>
                            <option value="Rejected" ${currentStatus === "Rejected" ? "selected" : ""}>Rejected</option>
                        </select>
                    </td>
                `;
                const statusSelectElement = row.querySelector('.status-change-select');
                statusSelectElement.addEventListener('change', (event) => {
                    const selectedStatus = event.target.value;
                    const transactionDocumentId = event.target.dataset.id;
                    if (confirm(`هل أنت متأكد أنك تريد تغيير حالة العملية ${tx.transactionId || txDocId} إلى ${selectedStatus}؟`)) {
                        updateTransactionStatus(transactionDocumentId, selectedStatus);
                    } else {
                        event.target.value = currentStatus;
                    }
                });
            });
            transactionsTableContainer.innerHTML = ''; 
            transactionsTableContainer.appendChild(table);
            if (searchTransactionsInput && tbody.getElementsByTagName('tr').length > 0) {
                searchTransactionsInput.onkeyup = () => { 
                    const searchTerm = searchTransactionsInput.value.toLowerCase().trim();
                    const rows = tbody.getElementsByTagName('tr');
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        const cells = row.getElementsByTagName('td');
                        let found = false;
                        for (let j = 0; j < cells.length -1; j++) { 
                            const cellText = cells[j].textContent || cells[j].innerText;
                            if (cellText.toLowerCase().includes(searchTerm)) {
                                found = true;
                                break;
                            }
                        }
                        row.style.display = found ? "" : "none";
                    }
                };
            }
        } catch (error) {
            console.error("Error loading transactions: ", error);
            transactionsLoadingMsg.style.display = 'none';
            transactionsTableContainer.innerHTML = `<p style="color:red;">فشل تحميل العمليات: ${error.message}</p>`;
        }
    }

    // ==============================================
    // SECTION: إعدادات التبادل العامة
    // ==============================================
    async function loadGlobalExchangeSettings() {
        if (!globalExchangeSettingsForm) return;
        globalSettingsLoadingMsg.style.display = 'block';
        globalSettingsMessage.style.display = 'none';
        [gsUsdtServiceFeeValueGroup, gsUsdtServiceFeeMinCapGroup, gsUsdtServiceFeeMaxCapGroup].forEach(g => { if(g) g.style.display = 'none';});

        try {
            const settingsRef = doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID);
            const docSnap = await getDoc(settingsRef);

            if (docSnap.exists()) {
                const settings = docSnap.data();
                gsUsdtToEgpBuyRateInput.value = settings.usdtToEgpBuyRate ?? '';
                gsUsdtToEgpSellRateInput.value = settings.usdtToEgpSellRate ?? '';
                gsWhatsAppNumberInput.value = settings.whatsAppNumber || ''; // تحميل الرقم
                
                gsUsdtServiceFeeTypeSelect.value = settings.usdtToUsdtServiceFeeType || 'none';
                gsUsdtServiceFeeValueInput.value = settings.usdtToUsdtServiceFeeValue ?? '';
                gsUsdtServiceFeeMinCapInput.value = settings.usdtToUsdtServiceFeeMinCap ?? '';
                gsUsdtServiceFeeMaxCapInput.value = settings.usdtToUsdtServiceFeeMaxCap ?? '';
            } else {
                globalSettingsMessage.textContent = "لم يتم العثور على إعدادات التبادل. يمكنك حفظ إعدادات جديدة.";
                globalSettingsMessage.style.color = "orange"; 
                globalSettingsMessage.style.display = 'block';
                gsUsdtServiceFeeTypeSelect.value = 'none'; 
            }
            toggleFeeFields(gsUsdtServiceFeeTypeSelect, gsUsdtServiceFeeValueGroup, gsUsdtServiceFeeValueInput, gsUsdtServiceFeeMaxCapGroup, gsUsdtServiceFeeMaxCapInput, gsUsdtServiceFeeMinCapGroup, gsUsdtServiceFeeMinCapInput);
        } catch (error) {
            console.error("Error loading global exchange settings:", error);
            globalSettingsMessage.textContent = `فشل تحميل الإعدادات: ${error.message}`;
            globalSettingsMessage.style.color = "red"; 
            globalSettingsMessage.style.display = 'block';
        } finally {
            globalSettingsLoadingMsg.style.display = 'none';
        }
    }

    async function saveGlobalExchangeSettings(event) {
        event.preventDefault();
        
        const whatsAppNumberVal = gsWhatsAppNumberInput.value.trim();
        if (!whatsAppNumberVal || !/^\d+$/.test(whatsAppNumberVal)) {
            globalSettingsMessage.textContent = "الرجاء إدخال رقم واتساب صحيح يحتوي على أرقام فقط (بدون الرمز الدولي +).";
            globalSettingsMessage.style.color = "red";
            globalSettingsMessage.style.display = 'block';
            return;
        }
        
        const usdtServiceFeeType = gsUsdtServiceFeeTypeSelect.value;
        const usdtServiceFeeValueStr = gsUsdtServiceFeeValueInput.value.trim();
        const usdtServiceFeeMinCapStr = gsUsdtServiceFeeMinCapInput.value.trim();
        const usdtServiceFeeMaxCapStr = gsUsdtServiceFeeMaxCapInput.value.trim();

        const settingsData = {
            usdtToEgpBuyRate: parseFloat(gsUsdtToEgpBuyRateInput.value),
            usdtToEgpSellRate: parseFloat(gsUsdtToEgpSellRateInput.value),
            whatsAppNumber: whatsAppNumberVal, // حفظ الرقم
            usdtToUsdtServiceFeeType: usdtServiceFeeType,
            usdtToUsdtServiceFeeValue: (usdtServiceFeeType !== 'none' && usdtServiceFeeValueStr !== '') ? parseFloat(usdtServiceFeeValueStr) : 0,
            usdtToUsdtServiceFeeMinCap: (usdtServiceFeeType === 'percentage' && usdtServiceFeeMinCapStr !== '') ? parseFloat(usdtServiceFeeMinCapStr) : null,
            usdtToUsdtServiceFeeMaxCap: (usdtServiceFeeType === 'percentage' && usdtServiceFeeMaxCapStr !== '') ? parseFloat(usdtServiceFeeMaxCapStr) : null,
            lastUpdated: serverTimestamp()
        };

        if (isNaN(settingsData.usdtToEgpBuyRate) || isNaN(settingsData.usdtToEgpSellRate)) {
            globalSettingsMessage.textContent = "الرجاء إدخال قيم رقمية صحيحة لأسعار شراء وبيع USDT.";
            globalSettingsMessage.style.color = "red";
            globalSettingsMessage.style.display = 'block';
            return;
        }
        if ((settingsData.usdtToUsdtServiceFeeType !== 'none' && isNaN(settingsData.usdtToUsdtServiceFeeValue)) ||
            (settingsData.usdtToUsdtServiceFeeType === 'percentage' && settingsData.usdtToUsdtServiceFeeMinCap !== null && isNaN(settingsData.usdtToUsdtServiceFeeMinCap)) ||
            (settingsData.usdtToUsdtServiceFeeType === 'percentage' && settingsData.usdtToUsdtServiceFeeMaxCap !== null && isNaN(settingsData.usdtToUsdtServiceFeeMaxCap))
           ) {
            globalSettingsMessage.textContent = "قيم رسوم خدمة USDT أو الحدود يجب أن تكون أرقامًا صحيحة (أو تترك فارغة إذا كان الحد اختياريًا).";
            globalSettingsMessage.style.color = "red"; globalSettingsMessage.style.display = 'block';
            return;
        }

        globalSettingsMessage.textContent = "جارٍ حفظ الإعدادات...";
        globalSettingsMessage.style.color = "blue";
        globalSettingsMessage.style.display = 'block';
        try {
            const settingsRef = doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID);
            await setDoc(settingsRef, settingsData, { merge: true }); 
            globalSettingsMessage.textContent = "تم حفظ إعدادات التبادل بنجاح!";
            globalSettingsMessage.style.color = "green";
        } catch (error) {
            console.error("Error saving global exchange settings:", error);
            globalSettingsMessage.textContent = `فشل حفظ الإعدادات: ${error.message}`;
            globalSettingsMessage.style.color = "red";
        }
    }

    // ==============================================
    // SECTION: إدارة وسائل الدفع الموحدة (paymentMethods)
    // ==============================================
    function toggleFeeFields(feeTypeSelect, valueGroup, valueInput, maxCapGroup, maxCapInput, minCapGroup, minCapInput) {
        const selectedType = feeTypeSelect.value;
        valueGroup.style.display = 'none';
        maxCapGroup.style.display = 'none';
        minCapGroup.style.display = 'none'; 
        valueInput.required = false;

        if (selectedType === "fixed") {
            valueGroup.style.display = 'block'; 
            valueInput.placeholder = "القيمة الثابتة للرسوم";
            valueInput.required = true;
            maxCapInput.value = ''; 
            minCapInput.value = ''; 
        } else if (selectedType === "percentage") {
            valueGroup.style.display = 'block'; 
            valueInput.placeholder = "النسبة (مثال: 0.01)";
            valueInput.required = true;
            maxCapGroup.style.display = 'block'; 
            minCapGroup.style.display = 'block';  
            maxCapInput.placeholder = "الحد الأقصى (اتركه فارغًا لـ لا يوجد)";
            minCapInput.placeholder = "الحد الأدنى (اتركه فارغًا لـ لا يوجد)";
        } else { 
            valueInput.value = '';
            maxCapInput.value = '';
            minCapInput.value = '';
        }
    }
    function openPaymentMethodModal(method = null) {
        paymentMethodForm.reset(); 
        pmDocumentIdInput.value = '';
        modalMessage.style.display = 'none';
        siteAccountFieldsDiv.style.display = 'none'; 
        
        [pmSendingFeeValueGroup, pmSendingFeeMaxCapGroup, pmSendingFeeMinCapGroup, 
         pmReceivingFeeValueGroup, pmReceivingFeeMaxCapGroup, pmReceivingFeeMinCapGroup].forEach(group => {
            if(group) group.style.display = 'none';
        });
        const keyInput = document.getElementById('pm-key');
        if (method) { 
            modalTitle.textContent = "تعديل وسيلة الدفع";
            pmDocumentIdInput.value = method.id;
            keyInput.value = method.key || '';
            keyInput.readOnly = true; 
            document.getElementById('pm-name').value = method.name || '';
            document.getElementById('pm-type').value = method.type || 'EGP';
            document.getElementById('pm-sortOrder').value = method.sortOrder ?? 100;
            document.getElementById('pm-minAmount').value = method.minAmount ?? '';
            document.getElementById('pm-requiresWholeNumber').checked = method.requiresWholeNumber === true;
            document.getElementById('pm-userIdentifierType').value = method.userIdentifierType || '';
            document.getElementById('pm-isActive').checked = method.isActive !== undefined ? method.isActive : true;
            document.getElementById('pm-isSiteAccount').checked = method.isSiteAccount === true;
            document.getElementById('pm-iconName').value = method.iconName || '';
            document.getElementById('pm-notes').value = method.notes || '';
            if (method.isSiteAccount === true) {
                siteAccountFieldsDiv.style.display = 'block';
                document.getElementById('pm-recipientInfo').value = method.recipientInfo || '';
                document.getElementById('pm-recipientType').value = method.recipientType || '';
            }
            const fees = method.fees || {}; 
            const sendingFees = fees.sending || {};
            const receivingFees = fees.receiving || {};
            pmSendingFeeTypeSelect.value = sendingFees.type || 'none';
            pmSendingFeeValueInput.value = sendingFees.value ?? ''; 
            pmSendingFeeMinCapInput.value = sendingFees.minCap ?? ''; 
            pmSendingFeeMaxCapInput.value = sendingFees.maxCap ?? '';
            pmReceivingFeeTypeSelect.value = receivingFees.type || 'none';
            pmReceivingFeeValueInput.value = receivingFees.value ?? '';
            pmReceivingFeeMinCapInput.value = receivingFees.minCap ?? ''; 
            pmReceivingFeeMaxCapInput.value = receivingFees.maxCap ?? '';
        } else { 
            modalTitle.textContent = "إضافة وسيلة دفع جديدة";
            keyInput.readOnly = false;
            document.getElementById('pm-isActive').checked = true; 
            document.getElementById('pm-sortOrder').value = 100;
            pmSendingFeeTypeSelect.value = 'none';
            pmReceivingFeeTypeSelect.value = 'none';
        }
        toggleFeeFields(pmSendingFeeTypeSelect, pmSendingFeeValueGroup, pmSendingFeeValueInput, pmSendingFeeMaxCapGroup, pmSendingFeeMaxCapInput, pmSendingFeeMinCapGroup, pmSendingFeeMinCapInput);
        toggleFeeFields(pmReceivingFeeTypeSelect, pmReceivingFeeValueGroup, pmReceivingFeeValueInput, pmReceivingFeeMaxCapGroup, pmReceivingFeeMaxCapInput, pmReceivingFeeMinCapGroup, pmReceivingFeeMinCapInput);
        paymentMethodModal.classList.add('show');
    }
    function closePaymentMethodModal() { paymentMethodModal.classList.remove('show'); }
    async function savePaymentMethod(event) {
        event.preventDefault();
        const documentId = pmDocumentIdInput.value;
        modalMessage.style.display = 'none';
        const saveButton = document.getElementById('save-payment-method-btn');
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner" style="border-top-color: #fff; width:16px; height:16px; display:inline-block; margin-left:5px; vertical-align: middle;"></span> جارٍ الحفظ...';
        const keyVal = document.getElementById('pm-key').value.trim();
        const nameVal = document.getElementById('pm-name').value.trim();
        const typeVal = document.getElementById('pm-type').value;
        const minAmountStr = document.getElementById('pm-minAmount').value;
        const minAmountVal = minAmountStr === '' ? null : parseFloat(minAmountStr);
        const sendingFeeType = pmSendingFeeTypeSelect.value;
        const sendingFeeValueStr = pmSendingFeeValueInput.value.trim();
        const sendingFeeMinCapStr = pmSendingFeeMinCapInput.value.trim();
        const sendingFeeMaxCapStr = pmSendingFeeMaxCapInput.value.trim();
        const receivingFeeType = pmReceivingFeeTypeSelect.value;
        const receivingFeeValueStr = pmReceivingFeeValueInput.value.trim();
        const receivingFeeMinCapStr = pmReceivingFeeMinCapInput.value.trim();
        const receivingFeeMaxCapStr = pmReceivingFeeMaxCapInput.value.trim();
        const feesData = {
            sending: {
                type: sendingFeeType,
                value: (sendingFeeType !== 'none' && sendingFeeValueStr !== '') ? parseFloat(sendingFeeValueStr) : 0,
                minCap: (sendingFeeType === 'percentage' && sendingFeeMinCapStr !== '') ? parseFloat(sendingFeeMinCapStr) : null,
                maxCap: (sendingFeeType === 'percentage' && sendingFeeMaxCapStr !== '') ? parseFloat(sendingFeeMaxCapStr) : null
            },
            receiving: {
                type: receivingFeeType,
                value: (receivingFeeType !== 'none' && receivingFeeValueStr !== '') ? parseFloat(receivingFeeValueStr) : 0,
                minCap: (receivingFeeType === 'percentage' && receivingFeeMinCapStr !== '') ? parseFloat(receivingFeeMinCapStr) : null,
                maxCap: (receivingFeeType === 'percentage' && receivingFeeMaxCapStr !== '') ? parseFloat(receivingFeeMaxCapStr) : null
            }
        };
        if ((feesData.sending.type !== 'none' && isNaN(feesData.sending.value)) || 
            (feesData.sending.type === 'percentage' && feesData.sending.minCap !== null && isNaN(feesData.sending.minCap)) ||
            (feesData.sending.type === 'percentage' && feesData.sending.maxCap !== null && isNaN(feesData.sending.maxCap)) ||
            (feesData.receiving.type !== 'none' && isNaN(feesData.receiving.value)) ||
            (feesData.receiving.type === 'percentage' && feesData.receiving.minCap !== null && isNaN(feesData.receiving.minCap)) ||
            (feesData.receiving.type === 'percentage' && feesData.receiving.maxCap !== null && isNaN(feesData.receiving.maxCap))
           ) {
            modalMessage.textContent = "قيم الرسوم أو الحدود يجب أن تكون أرقامًا صحيحة.";
            modalMessage.style.color = "red"; modalMessage.style.display = 'block';
            saveButton.disabled = false; saveButton.textContent = 'حفظ'; return;
        }
        let dataToSave = {
            name: nameVal, type: typeVal,
            sortOrder: parseInt(document.getElementById('pm-sortOrder').value) || 100,
            minAmount: minAmountVal,
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
            if (!dataToSave.key) {
                modalMessage.textContent = "حقل المفتاح (Key) مطلوب.";
                modalMessage.style.color = "red"; modalMessage.style.display = 'block';
                saveButton.disabled = false; saveButton.textContent = 'حفظ'; return;
            }
        }
        if (!dataToSave.name || !dataToSave.type || dataToSave.minAmount === null || isNaN(dataToSave.minAmount) || dataToSave.minAmount < 0) {
            modalMessage.textContent = "الرجاء ملء الحقول الأساسية بشكل صحيح.";
            modalMessage.style.color = "red"; modalMessage.style.display = 'block';
            saveButton.disabled = false; saveButton.textContent = 'حفظ'; return;
        }
        if (dataToSave.isSiteAccount) {
            dataToSave.recipientInfo = document.getElementById('pm-recipientInfo').value.trim();
            dataToSave.recipientType = document.getElementById('pm-recipientType').value.trim();
            if (!dataToSave.recipientInfo || !dataToSave.recipientType) {
                modalMessage.textContent = "معلومات حساب الموقع مطلوبة.";
                modalMessage.style.color = "red"; modalMessage.style.display = 'block';
                saveButton.disabled = false; saveButton.textContent = 'حفظ'; return;
            }
        } else {
            dataToSave.recipientInfo = null; 
            dataToSave.recipientType = null;
        }
        try {
            if (documentId) { 
                const methodRef = doc(db, "paymentMethods", documentId);
                await updateDoc(methodRef, dataToSave);
                modalMessage.textContent = "تم التحديث بنجاح!";
            } else { 
                const q = query(collection(db, "paymentMethods"), where("key", "==", dataToSave.key));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    modalMessage.textContent = `المفتاح "${dataToSave.key}" مستخدم.`;
                    modalMessage.style.color = "red"; modalMessage.style.display = 'block';
                    saveButton.disabled = false; saveButton.textContent = 'حفظ'; return;
                }
                await addDoc(collection(db, "paymentMethods"), dataToSave);
                modalMessage.textContent = "تمت الإضافة بنجاح!";
            }
            modalMessage.style.color = "green"; modalMessage.style.display = 'block';
            setTimeout(() => { closePaymentMethodModal(); loadManagedPaymentMethods(); }, 1500);
        } catch (error) {
            modalMessage.textContent = `فشل الحفظ: ${error.message}`;
            modalMessage.style.color = "red";
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'حفظ';
        }
    }
    async function deleteManagedPaymentMethod(documentId, displayName) {
        if (!documentId) return;
        if (confirm(`هل أنت متأكد أنك تريد حذف وسيلة الدفع "${displayName}"؟`)) {
            try {
                await deleteDoc(doc(db, "paymentMethods", documentId));
                alert(`تم حذف "${displayName}" بنجاح.`);
                loadManagedPaymentMethods();
            } catch (error) {
                console.error("Error deleting payment method:", error);
                alert(`فشل حذف "${displayName}": ${error.message}`);
            }
        }
    }
    async function loadManagedPaymentMethods() {
        if (!paymentMethodsContainer || !paymentMethodsLoadingMsg) return;
        paymentMethodsLoadingMsg.style.display = 'block';
        paymentMethodsContainer.innerHTML = '';
        paymentMethodsContainer.appendChild(paymentMethodsLoadingMsg);
        try {
            const methodsRef = collection(db, "paymentMethods");
            const q = query(methodsRef, orderBy("sortOrder", "asc"), orderBy("name", "asc"));
            const querySnapshot = await getDocs(q);
            paymentMethodsLoadingMsg.style.display = 'none';
            if (querySnapshot.empty) {
                paymentMethodsContainer.innerHTML = "<p>لم يتم إضافة وسائل دفع بعد.</p>";
                return;
            }
            querySnapshot.forEach((docSnapshot) => {
                const method = { id: docSnapshot.id, ...docSnapshot.data() };
                const card = document.createElement('div');
                card.className = 'payment-method-card';
                let siteAccountInfoHTML = '';
                if (method.isSiteAccount && method.recipientInfo) {
                    siteAccountInfoHTML = `<p style="background-color: #e9f5ff; padding: 5px; border-radius: 4px;"><strong>حساب الموقع:</strong> ${method.recipientInfo} (${method.recipientType || 'N/A'})</p>`;
                }
                let feesDisplayHTML = '<p><strong>الرسوم:</strong> <span>لا يوجد حاليًا</span></p>';
                if (method.fees) {
                    let sendingFeeText = 'لا يوجد';
                    if (method.fees.sending && method.fees.sending.type !== 'none') {
                        sendingFeeText = `${method.fees.sending.type === 'fixed' ? 
                                            (method.fees.sending.value ?? 0) + ' ' + (method.type || '') : 
                                            ((method.fees.sending.value ?? 0) * 100).toFixed(2) + '%'}`;
                        if (method.fees.sending.type === 'percentage') {
                            if (method.fees.sending.minCap !== null && method.fees.sending.minCap > 0) sendingFeeText += ` (أدنى ${method.fees.sending.minCap} ${method.type || ''})`;
                            if (method.fees.sending.maxCap !== null && method.fees.sending.maxCap > 0) sendingFeeText += `${(method.fees.sending.minCap !== null && method.fees.sending.minCap > 0) ? ' / ' : ' ('}أقصى ${method.fees.sending.maxCap} ${method.type || ''})`;
                            if ((method.fees.sending.minCap !== null && method.fees.sending.minCap > 0) || (method.fees.sending.maxCap !== null && method.fees.sending.maxCap > 0)) sendingFeeText += `)`;
                        }
                    }
                    let receivingFeeText = 'لا يوجد';
                    if (method.fees.receiving && method.fees.receiving.type !== 'none') {
                         receivingFeeText = `${method.fees.receiving.type === 'fixed' ? 
                                             (method.fees.receiving.value ?? 0) + ' ' + (method.type || '') : 
                                             ((method.fees.receiving.value ?? 0) * 100).toFixed(2) + '%'}`;
                        if (method.fees.receiving.type === 'percentage') {
                            if (method.fees.receiving.minCap !== null && method.fees.receiving.minCap > 0) receivingFeeText += ` (أدنى ${method.fees.receiving.minCap} ${method.type || ''})`;
                            if (method.fees.receiving.maxCap !== null && method.fees.receiving.maxCap > 0) receivingFeeText += `${(method.fees.receiving.minCap !== null && method.fees.receiving.minCap > 0) ? ' / ' : ' ('}أقصى ${method.fees.receiving.maxCap} ${method.type || ''})`;
                            if ((method.fees.receiving.minCap !== null && method.fees.receiving.minCap > 0) || (method.fees.receiving.maxCap !== null && method.fees.receiving.maxCap > 0)) receivingFeeText += `)`;
                        }
                    }
                    if (sendingFeeText !== 'لا يوجد' || receivingFeeText !== 'لا يوجد') {
                        feesDisplayHTML = `<div style="font-size:0.88em; margin-top:8px; padding-top:8px; border-top:1px dotted #e0e0e0;"><p><strong>رسوم الإرسال:</strong> ${sendingFeeText}</p><p><strong>رسوم الاستلام:</strong> ${receivingFeeText}</p></div>`;
                    }
                }
                card.innerHTML = `<h4>${(method.iconName && method.iconName.trim() !== "") ? `<box-icon name='${method.iconName}'></box-icon> ` : ''}${method.name} ${method.isActive ? '<span style="color:green;font-size:0.8em;">(مفعل)</span>' : '<span style="color:red;font-size:0.8em;">(غير مفعل)</span>'}</h4><p><strong>المفتاح (Key):</strong> ${method.key}</p><p><strong>النوع:</strong> ${method.type || 'N/A'}</p><p><strong>الترتيب:</strong> ${method.sortOrder || 'N/A'}</p><p><strong>الحد الأدنى:</strong> ${method.minAmount ?? 'N/A'} ${method.type || ''}</p><p><strong>رقم صحيح فقط:</strong> ${method.requiresWholeNumber ? 'نعم' : 'لا'}</p><p><strong>معرف المستخدم (للشات):</strong> ${method.userIdentifierType || 'غير محدد'}</p><p><strong>يمثل حساب موقع:</strong> ${method.isSiteAccount ? 'نعم' : 'لا'}</p>${siteAccountInfoHTML}${feesDisplayHTML}${method.notes ? `<p><strong>ملاحظات:</strong> ${method.notes}</p>` : ''}<div class="actions"><button class="button secondary edit-pm-btn">تعديل</button><button class="button danger delete-pm-btn">حذف</button></div>`;
                card.querySelector('.edit-pm-btn').addEventListener('click', () => openPaymentMethodModal(method));
                card.querySelector('.delete-pm-btn').addEventListener('click', () => deleteManagedPaymentMethod(method.id, method.name));
                paymentMethodsContainer.appendChild(card);
            });
        } catch (error) {
            console.error("Error loading payment methods: ", error);
            paymentMethodsLoadingMsg.style.display = 'none';
            paymentMethodsContainer.innerHTML = `<p style="color:red;">فشل تحميل وسائل الدفع: ${error.message}</p>`;
        }
    }
    
    const pmIsSiteAccountCheckbox = document.getElementById('pm-isSiteAccount');
    if (pmIsSiteAccountCheckbox) { pmIsSiteAccountCheckbox.addEventListener('change', function() { siteAccountFieldsDiv.style.display = this.checked ? 'block' : 'none'; if (!this.checked) { document.getElementById('pm-recipientInfo').value = ''; document.getElementById('pm-recipientType').value = ''; } }); }
    
    // ==============================================
    // SECTION: إدارة شريط الإشعارات (Marquee)
    // ==============================================
    async function loadMarqueeSettings() {
        if (!marqueeSettingsForm) return;
        marqueeSettingsLoadingMsg.style.display = 'block';
        marqueeSettingsMessage.style.display = 'none';
        try {
            const settingsRef = doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID);
            const docSnap = await getDoc(settingsRef);
            if (docSnap.exists()) {
                const settings = docSnap.data();
                if (settings.marqueeMessages && Array.isArray(settings.marqueeMessages)) {
                    mqMessagesTextarea.value = settings.marqueeMessages.join('\n');
                } else { mqMessagesTextarea.value = ''; }
                mqSpeedInput.value = settings.marqueeAnimationSpeedFactor ?? 7; 
            } else {
                marqueeSettingsMessage.textContent = "لم يتم العثور على إعدادات الشريط.";
                marqueeSettingsMessage.style.color = "orange"; marqueeSettingsMessage.style.display = 'block';
                mqSpeedInput.value = 7; 
            }
        } catch (error) {
            marqueeSettingsMessage.textContent = `فشل تحميل إعدادات الشريط: ${error.message}`;
            marqueeSettingsMessage.style.color = "red"; marqueeSettingsMessage.style.display = 'block';
        } finally { marqueeSettingsLoadingMsg.style.display = 'none'; }
    }
    async function saveMarqueeSettings(event) {
        event.preventDefault();
        const messagesArray = mqMessagesTextarea.value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const speedFactor = parseFloat(mqSpeedInput.value);
        if (isNaN(speedFactor) || speedFactor < 3) { 
            marqueeSettingsMessage.textContent = "الرجاء إدخال قيمة رقمية لسرعة الحركة (3 ثوانٍ على الأقل).";
            marqueeSettingsMessage.style.color = "red"; marqueeSettingsMessage.style.display = 'block';
            return;
        }
        const settingsData = { marqueeMessages: messagesArray, marqueeAnimationSpeedFactor: speedFactor, lastUpdatedMarquee: serverTimestamp() };
        marqueeSettingsMessage.textContent = "جارٍ حفظ إعدادات الشريط...";
        marqueeSettingsMessage.style.color = "blue"; marqueeSettingsMessage.style.display = 'block';
        try {
            const settingsRef = doc(db, "exchangeSettings", GLOBAL_SETTINGS_DOC_ID);
            await updateDoc(settingsRef, settingsData); 
            marqueeSettingsMessage.textContent = "تم حفظ إعدادات الشريط بنجاح!";
            marqueeSettingsMessage.style.color = "green";
        } catch (error) {
            marqueeSettingsMessage.textContent = `فشل حفظ الإعدادات: ${error.message}`;
            marqueeSettingsMessage.style.color = "red";
        }
    }

    // ==============================================
    // SECTION: تهيئة لوحة التحكم وربط الأحداث
    // ==============================================
    function initializeAdminPanel() {
        loadTransactions();
        loadGlobalExchangeSettings();
        loadManagedPaymentMethods();
        loadMarqueeSettings(); 

        if (statusFilterSelect) { statusFilterSelect.addEventListener('change', () => { if (searchTransactionsInput) searchTransactionsInput.value = ""; loadTransactions(statusFilterSelect.value); });}
        if (refreshTransactionsBtn) { refreshTransactionsBtn.addEventListener('click', () => { if (searchTransactionsInput) searchTransactionsInput.value = ""; loadTransactions(statusFilterSelect.value); });}
        if (globalExchangeSettingsForm) { globalExchangeSettingsForm.addEventListener('submit', saveGlobalExchangeSettings); }
        if (marqueeSettingsForm) { marqueeSettingsForm.addEventListener('submit', saveMarqueeSettings); } 
        if (addNewPaymentMethodBtn) { addNewPaymentMethodBtn.addEventListener('click', () => openPaymentMethodModal()); }
        if (closeModalBtn) { closeModalBtn.addEventListener('click', closePaymentMethodModal); }
        if (paymentMethodForm) { paymentMethodForm.addEventListener('submit', savePaymentMethod); }
        const cancelPaymentMethodBtn = document.getElementById('cancel-payment-method-btn');
        if (cancelPaymentMethodBtn) { cancelPaymentMethodBtn.addEventListener('click', closePaymentMethodModal); }
        window.addEventListener('click', (event) => { if (event.target === paymentMethodModal) { closePaymentMethodModal(); } });
        
        if (pmSendingFeeTypeSelect) { pmSendingFeeTypeSelect.addEventListener('change', () => { toggleFeeFields(pmSendingFeeTypeSelect, pmSendingFeeValueGroup, pmSendingFeeValueInput, pmSendingFeeMaxCapGroup, pmSendingFeeMaxCapInput, pmSendingFeeMinCapGroup, pmSendingFeeMinCapInput); });}
        if (pmReceivingFeeTypeSelect) { pmReceivingFeeTypeSelect.addEventListener('change', () => { toggleFeeFields(pmReceivingFeeTypeSelect, pmReceivingFeeValueGroup, pmReceivingFeeValueInput, pmReceivingFeeMaxCapGroup, pmReceivingFeeMaxCapInput, pmReceivingFeeMinCapGroup, pmReceivingFeeMinCapInput); });}
        if (gsUsdtServiceFeeTypeSelect) { gsUsdtServiceFeeTypeSelect.addEventListener('change', () => { toggleFeeFields(gsUsdtServiceFeeTypeSelect, gsUsdtServiceFeeValueGroup, gsUsdtServiceFeeValueInput, gsUsdtServiceFeeMaxCapGroup, gsUsdtServiceFeeMaxCapInput, gsUsdtServiceFeeMinCapGroup, gsUsdtServiceFeeMinCapInput); });}

        if (!document.getElementById('admin-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'admin-spinner-style';
            style.innerHTML = `
                .spinner {
                    border: 3px solid rgba(255, 255, 255, 0.3); border-radius: 50%;
                    border-top-color: #ffffff; width: 1em; height: 1em; 
                    animation: spin 1s linear infinite; display: none; 
                    margin-left: 8px; vertical-align: middle; 
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `;
            document.head.appendChild(style);
        }
    }
    checkAdminAuth();
});