// This script handles the main page logic, dynamic header/navigation, and global utilities.

import { db } from './auth/firebase-config.js'; 

import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// EXPORTED AND ATTACHED TO WINDOW FOR GLOBAL ACCESS
// --- START: NEW Confirmation and Info Modal Logic ---

/**
 * Shows a custom confirmation modal.
 * @param {object} options - Configuration for the modal.
 * @param {string} options.title - The title of the modal.
 * @param {string} options.message - The main message content (can include HTML).
 * @param {string} [options.confirmText='تأكيد'] - Text for the confirm button.
 * @param {string} [options.cancelText='إلغاء'] - Text for the cancel button.
 * @param {string} [options.iconName='error-warning'] - Boxicons icon name (e.g., 'check-circle').
 * @param {string} [options.iconColor='var(--warning-color)'] - CSS color for the icon.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled/closed.
 */
export function showConfirmationModal({
    title = 'تأكيد الإجراء',
    message,
    confirmText = 'تأكيد',
    cancelText = 'إلغاء',
    iconName = 'error-warning',
    iconColor = 'var(--warning-color)'
}) {
    return new Promise(resolve => {
        const existingModal = document.getElementById('custom-confirmation-modal');
        if (existingModal) existingModal.remove();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'custom-confirmation-modal';
        modalOverlay.className = 'custom-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="custom-modal">
                <div class="modal-header">
                    <span class="modal-icon" style="color: ${iconColor};">
                        <box-icon name='${iconName}' type='solid'></box-icon>
                    </span>
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    ${message}
                </div>
                <div class="modal-footer">
                    <button class="modal-button confirm">${confirmText}</button>
                    <button class="modal-button cancel">${cancelText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);
        
        const confirmBtn = modalOverlay.querySelector('.modal-button.confirm');
        const cancelBtn = modalOverlay.querySelector('.modal-button.cancel');

        const closeModal = (result) => {
            modalOverlay.classList.remove('show');
            setTimeout(() => {
                modalOverlay.remove();
                resolve(result);
            }, 200);
        };

        confirmBtn.onclick = () => closeModal(true);
        cancelBtn.onclick = () => closeModal(false);
        modalOverlay.onclick = (e) => { // Click outside closes modal
            if (e.target === modalOverlay) {
                closeModal(false);
            }
        };

        // Show the modal with a slight delay for CSS transition
        setTimeout(() => modalOverlay.classList.add('show'), 10);
    });
}

/**
 * Shows a custom informational modal (single button).
 * @param {object} options - Configuration for the modal.
 * @param {string} options.title - The title of the modal.
 * @param {string} options.message - The main message content (can include HTML).
 * @param {string} [options.confirmText='حسناً'] - Text for the confirm button.
 * @param {string} [options.iconName='info-circle'] - Boxicons icon name.
 * @param {string} [options.iconColor='var(--info-color)'] - CSS color for the icon.
 * @returns {Promise<boolean>} Resolves to true when the button is clicked.
 */
export function showInfoModal({
    title = 'تنبيه',
    message,
    confirmText = 'حسناً',
    iconName = 'info-circle',
    iconColor = 'var(--info-color)'
}) {
     return new Promise(resolve => {
        const existingModal = document.getElementById('custom-confirmation-modal');
        if (existingModal) existingModal.remove();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'custom-confirmation-modal';
        modalOverlay.className = 'custom-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="custom-modal">
                <div class="modal-header">
                    <span class="modal-icon" style="color: ${iconColor};">
                        <box-icon name='${iconName}' type='solid'></box-icon>
                    </span>
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    ${message}
                </div>
                <div class="modal-footer">
                    <button class="modal-button confirm">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);
        const confirmBtn = modalOverlay.querySelector('.modal-button.confirm');

        const closeModal = (result) => {
            modalOverlay.classList.remove('show');
            setTimeout(() => {
                modalOverlay.remove();
                resolve(result);
            }, 200);
        };

        confirmBtn.onclick = () => closeModal(true);
        modalOverlay.onclick = (e) => { // Click outside closes modal
            if (e.target === modalOverlay) {
                closeModal(false);
            }
        };

        setTimeout(() => modalOverlay.classList.add('show'), 10);
    });
}

/**
 * Shows a temporary toast notification.
 * @param {string} message - The text content of the toast.
 * @param {'info'|'success'|'error'|'warning'} [type='info'] - The type of toast, affects styling.
 * @param {number} [duration=3000] - Duration in milliseconds before the toast disappears.
 */
export function showToast(message, type = 'info', duration = 3000) { 
    const existingToast = document.querySelector('.toast-notification'); 
    if (existingToast && !existingToast.classList.contains('persistent')) existingToast.remove(); // Remove non-persistent toasts if new one comes
    const toast = document.createElement('div'); 
    toast.className = 'toast-notification'; 
    if (type === 'success') toast.classList.add('success'); 
    else if (type === 'error') toast.classList.add('error'); 
    else if (type === 'info') toast.classList.add('info'); 
    else if (type === 'warning') toast.classList.add('warning'); 
    toast.textContent = message; 
    document.body.appendChild(toast); 
    // Trigger CSS transition
    setTimeout(() => toast.classList.add('show'), 10); 
    // Remove after duration
    setTimeout(() => { 
        toast.classList.remove('show'); 
        setTimeout(() => toast.remove(), 500); // Allow fade-out animation to complete
    }, duration); 
}
// --- END: NEW Confirmation and Info Modal Logic ---


document.addEventListener('DOMContentLoaded', async () => {

    // --- Attach exported functions to window object (for global access if scripts are not modules) ---
    // This provides a robust way to ensure access in all script loading scenarios.
    if (typeof window.showConfirmationModal === 'undefined') { // Avoid re-assignment if already attached by prior module import
        window.showConfirmationModal = showConfirmationModal;
    }
    if (typeof window.showInfoModal === 'undefined') {
        window.showInfoModal = showInfoModal;
    }
    if (typeof window.showToast === 'undefined') {
        window.showToast = showToast;
    }
    // --- End attaching to window ---

    // --- START: Full Page Spinner Logic ---

    let spinnerOverlay;



    function createSpinner() {

        if (document.getElementById('full-page-spinner-overlay')) return;

        

        spinnerOverlay = document.createElement('div');

        spinnerOverlay.id = 'full-page-spinner-overlay';

        spinnerOverlay.className = 'spinner-overlay';

        

        const spinnerLoader = document.createElement('div');

        spinnerLoader.className = 'spinner-loader';

        

        spinnerOverlay.appendChild(spinnerLoader);

        document.body.appendChild(spinnerOverlay);

    }



    // Make spinner functions globally accessible (already part of window, just defined here)

    window.showPageSpinner = function() {

        if (spinnerOverlay) spinnerOverlay.classList.add('show');

    };



    window.hidePageSpinner = function() {

        if (spinnerOverlay) spinnerOverlay.classList.remove('show');

    };

    

    // Create the spinner as soon as the DOM is ready

    createSpinner();

    // --- END: Full Page Spinner Logic ---





    let mainNav = null;

    let hamburgerIcon = null;



    function toggleMobileMenu() {

        if (mainNav && hamburgerIcon) {
            const isActive = mainNav.classList.toggle('mobile-active');
            hamburgerIcon.setAttribute('aria-expanded', isActive);
            const menuIcon = hamburgerIcon.querySelector('box-icon');
            menuIcon.setAttribute('name', isActive ? 'x' : 'menu');

            // --- START: TEMPORARY FIX FOR GHOST CLICKS (Controlled by JS) ---
            // This explicitly controls display and pointer-events for the main navigation menu
            if (isActive) {
                // When menu is active, ensure it's visible and responsive to clicks
                mainNav.style.display = 'flex'; // Or 'block', depending on layout needs from CSS
                mainNav.style.pointerEvents = 'auto'; 
            } else {
                // When menu is inactive, hide it and prevent clicks
                // Delay setting display: 'none' to allow CSS transitions (opacity, transform) to complete
                mainNav.style.pointerEvents = 'none'; // Prevent immediate clicks on the fading/moving menu
                setTimeout(() => {
                    // Only set display: 'none' if it hasn't become active again during the delay
                    if (!mainNav.classList.contains('mobile-active')) { 
                        mainNav.style.display = 'none';
                    }
                }, 250); // A duration that matches common CSS transition times
            }
            // --- END: TEMPORARY FIX FOR GHOST CLICKS ---
        }
    }



    function updateLayoutPadding() {

        const currentSiteTopHeader = document.getElementById('site-top-header');

        const proNotificationBarElement = document.getElementById('professional-notification-bar');

        const mainContentWrapper = document.querySelector('.main-content-wrapper');



        let siteTopHeaderActualHeight = 0;

        if (currentSiteTopHeader && !currentSiteTopHeader.classList.contains('hidden')) {

            siteTopHeaderActualHeight = currentSiteTopHeader.offsetHeight;

        }

        

        let proNotificationBarActualHeight = 0;

        if (proNotificationBarElement && proNotificationBarElement.style.display !== 'none' && proNotificationBarElement.classList.contains('visible')) {

            proNotificationBarElement.style.top = `${siteTopHeaderActualHeight}px`;

            proNotificationBarActualHeight = proNotificationBarElement.offsetHeight;

        } else if (proNotificationBarElement) { 

             proNotificationBarElement.style.top = `${siteTopHeaderActualHeight}px`;

        }



        if (mainContentWrapper) {

            mainContentWrapper.style.paddingTop = `${siteTopHeaderActualHeight + proNotificationBarActualHeight}px`;

            document.body.style.paddingTop = '0px'; 

        }

    }

    

    function closeUserMenuOnClickOutside(event) {

        const userMenuTrigger = document.getElementById('user-menu-trigger');

        const userDropdownMenu = document.getElementById('user-dropdown-menu');

        if (userMenuTrigger && userDropdownMenu && !userMenuTrigger.contains(event.target) && !userDropdownMenu.contains(event.target)) {

            userMenuTrigger.classList.remove('active');

            userDropdownMenu.classList.remove('visible');

        }

    }



    async function initializeUserAccountStatus() {

        const mainNavContainer = document.getElementById('main-nav');

        if (!mainNavContainer) return;



        try {

            const { auth, onAuthStateChanged, logoutUser } = await import('./auth/auth.js');

            onAuthStateChanged(auth, async (user) => {

                mainNavContainer.innerHTML = '';

                document.removeEventListener('click', closeUserMenuOnClickOutside);

                

                let navHtml = '';

                const isHelpPage = window.location.pathname.includes('/help.html');
                const isBlogPage = window.location.pathname.includes('/blog.html') || window.location.pathname.includes('/article.html');


                const helpLinkPath = window.location.pathname.startsWith('/auth/') ? 'help.html' : 'auth/help.html';
                const blogLinkPath = window.location.pathname.startsWith('/auth/') ? 'blog.html' : 'auth/blog.html';

                

                if (user && user.emailVerified) {

                    const displayName = user.displayName || user.email.split('@')[0];

                    const email = user.email;

                    const nameParts = displayName.trim().split(' ');

                    const initials = (nameParts[0] ? nameParts[0][0] : '') + (nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '');

                    const dashboardPath = window.location.pathname.startsWith('/auth/') ? 'dashboard.html' : 'auth/dashboard.html';



                    navHtml = `
                        <a href="${blogLinkPath}" class="nav-link ${isBlogPage ? 'active' : ''}">
                            <box-icon name='news'></box-icon>
                            <span>المدونة</span>
                        </a>
                        <a href="${helpLinkPath}" class="nav-link ${isHelpPage ? 'active' : ''}">
                            <box-icon name='help-circle' type='solid'></box-icon>
                            <span>مساعدة</span>
                        </a>
                        <div class="user-menu">
                            <div id="user-menu-trigger" class="user-menu-trigger">
                                <span class="user-avatar-initials">${initials.toUpperCase()}</span>
                                <span class="user-menu-name">${displayName}</span>
                                <box-icon name='chevron-down' class="chevron-icon"></box-icon>
                            </div>
                            <div id="user-dropdown-menu" class="user-dropdown-menu">
                                <div class="dropdown-user-info">
                                    <p class="name">${displayName}</p>
                                    <p class="email">${email}</p>
                                </div>
                                <nav class="dropdown-nav">
                                    <a href="${dashboardPath}">
                                        <box-icon name='category' type='solid'></box-icon>
                                        <span>لوحة التحكم</span>
                                    </a>
                                    <button id="logout-button-main" class="logout-item">
                                        <box-icon name='log-out-circle'></box-icon>
                                        <span>تسجيل الخروج</span>
                                    </button>
                                </nav>
                            </div>
                        </div>
                    `;

                    mainNavContainer.innerHTML = navHtml;

                    

                    const userMenuTrigger = document.getElementById('user-menu-trigger');

                    const userDropdownMenu = document.getElementById('user-dropdown-menu');

                    userMenuTrigger.addEventListener('click', (e) => {

                        e.stopPropagation();

                        userMenuTrigger.classList.toggle('active');

                        userDropdownMenu.classList.toggle('visible');

                    });

                    document.addEventListener('click', closeUserMenuOnClickOutside);



                } else {

                    const loginPath = window.location.pathname.startsWith('/auth/') ? 'login.html' : 'auth/login.html';

                    const registerPath = window.location.pathname.startsWith('/auth/') ? 'register.html' : 'auth/register.html';

                    navHtml = `
                        <a href="${blogLinkPath}" class="nav-link ${isBlogPage ? 'active' : ''}">المدونة</a>
                        <a href="${helpLinkPath}" class="nav-link ${isHelpPage ? 'active' : ''}">مساعدة</a>
                        <a href="${registerPath}" class="header-button outline">إنشاء حساب</a>
                        <a href="${loginPath}" class="header-button primary">تسجيل الدخول</a>
                    `;

                    mainNavContainer.innerHTML = navHtml;

                }



                const logoutButton = document.getElementById('logout-button-main');

                if (logoutButton) {

                    logoutButton.addEventListener('click', async () => {

                        window.showPageSpinner();

                        const redirectAfterLogout = window.location.pathname.startsWith('/auth/') ? '../index.html' : '/index.html';

                        await logoutUser(redirectAfterLogout);

                    });

                }

                

                mainNavContainer.querySelectorAll('a, button').forEach(link => {

                    link.addEventListener('click', function(e) {

                         if ((this.href && !this.href.includes('#')) || this.id === 'logout-button-main') {

                            window.showPageSpinner();

                        }

                    });

                });

            });

        } catch (e) {

            console.error("Error loading auth module for user status:", e);

            const helpLinkPathFallback = window.location.pathname.startsWith('/auth/') ? 'help.html' : 'auth/help.html';

            mainNavContainer.innerHTML = `<a href="${helpLinkPathFallback}" class="nav-link">مساعدة</a> <a href="/auth/login.html" class="header-button primary">تسجيل الدخول</a>`;

        }

    }

    let proNotificationBar, proNotificationTextSpan, proNotificationIconSpan, proNotificationCloseBtn, currentMessageIndex = 0, messageInterval;

    const MESSAGE_FADE_DURATION = 300;

    let proNotificationSettings = { messages: ["مرحباً بك في Easy Exchange!"], displayDurationPerMessage: 7 };

    async function fetchProNotificationSettings() { try { const settingsRef = doc(db, "exchangeSettings", "currentGlobalRates"); const docSnap = await getDoc(settingsRef); if (docSnap.exists()) { const settings = docSnap.data(); if (settings.marqueeMessages && Array.isArray(settings.marqueeMessages) && settings.marqueeMessages.length > 0) { proNotificationSettings.messages = settings.marqueeMessages; } if (typeof settings.marqueeAnimationSpeedFactor === 'number' && settings.marqueeAnimationSpeedFactor >= 3) { proNotificationSettings.displayDurationPerMessage = settings.marqueeAnimationSpeedFactor; } } else { console.warn("Notification settings document not found."); } } catch (error) { console.error("Error fetching pro notification settings:", error); } }

    function showNextProMessage() { if (!proNotificationTextSpan || !proNotificationSettings.messages || proNotificationSettings.messages.length === 0) return; proNotificationTextSpan.classList.add('fade-out'); setTimeout(() => { currentMessageIndex = (currentMessageIndex + 1) % proNotificationSettings.messages.length; proNotificationTextSpan.textContent = proNotificationSettings.messages[currentMessageIndex]; proNotificationTextSpan.classList.remove('fade-out'); }, MESSAGE_FADE_DURATION); }

    function loadNotificationBar() { const placeholder = document.getElementById('notification-placeholder'); if (!placeholder) { if (document.querySelector('.main-content-wrapper')) updateLayoutPadding(); return; } fetch('/notification.html') .then(response => { if (!response.ok) throw new Error(`Fetch notification.html failed: ${response.status}`); return response.text(); }).then(async data => { placeholder.innerHTML = data; mainNav = document.getElementById('main-nav'); hamburgerIcon = document.getElementById('hamburger-icon'); if (hamburgerIcon && mainNav) { hamburgerIcon.addEventListener('click', toggleMobileMenu); } proNotificationBar = document.getElementById('professional-notification-bar'); proNotificationTextSpan = document.getElementById('pro-notification-text'); proNotificationIconSpan = document.getElementById('pro-notification-icon'); proNotificationCloseBtn = document.getElementById('pro-notification-close'); if (proNotificationBar && proNotificationTextSpan && proNotificationCloseBtn) { await fetchProNotificationSettings(); if (proNotificationSettings.messages.length > 0) { proNotificationTextSpan.textContent = proNotificationSettings.messages[0]; if (proNotificationIconSpan && !proNotificationIconSpan.hasChildNodes()) { proNotificationIconSpan.innerHTML = `<box-icon name='bell' type='solid' color='#ffffff'></box-icon>`; } const displayInterval = proNotificationSettings.displayDurationPerMessage * 1000; proNotificationBar.style.display = 'block'; requestAnimationFrame(() => { proNotificationBar.classList.add('visible'); updateLayoutPadding(); }); if (messageInterval) clearInterval(messageInterval); if (proNotificationSettings.messages.length > 1) { messageInterval = setInterval(showNextProMessage, displayInterval + MESSAGE_FADE_DURATION); } proNotificationCloseBtn.addEventListener('click', () => { proNotificationBar.classList.remove('visible'); if (messageInterval) clearInterval(messageInterval); setTimeout(() => { proNotificationBar.style.display = 'none'; updateLayoutPadding(); }, 500); }); } else { proNotificationBar.style.display = 'none'; } } initializeUserAccountStatus(); setupScrollListener(); }).catch(error => { console.error('Error loading notification bar:', error); if (document.querySelector('.main-content-wrapper')) updateLayoutPadding(); }); }

    

    function setupScrollListener() { 

        const currentSiteTopHeader = document.getElementById('site-top-header'); 

        if (!currentSiteTopHeader) return; 

        let lastScrollTop = 0; 

        const scrollThreshold = 10; 

        window.addEventListener('scroll', () => { 

            let scrollTop = window.pageYOffset || document.documentElement.scrollTop; 

            if (scrollTop > 0) { currentSiteTopHeader.classList.add('scrolled'); } 

            else { currentSiteTopHeader.classList.remove('scrolled'); } 

            if (scrollTop > lastScrollTop && scrollTop > currentSiteTopHeader.offsetHeight) { currentSiteTopHeader.classList.add('hidden'); } 

            else if (scrollTop < lastScrollTop - scrollThreshold || scrollTop <= scrollThreshold) { currentSiteTopHeader.classList.remove('hidden'); } 

            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; updateLayoutPadding(); 

        }, false); 

    }

    

    // --- START: Exchange Form Logic (Main Page) ---

    if (document.getElementById('sendCurrency')) {

        const sendCurrencySelect = document.getElementById('sendCurrency'), receiveCurrencySelect = document.getElementById('receiveCurrency'), sendAmountInput = document.getElementById('sendAmount'), receiveAmountInput = document.getElementById('receiveAmount'), sendCurrencyLabel = document.getElementById('sendCurrencyLabel'), receiveCurrencyLabel = document.getElementById('receiveCurrencyLabel'), continueButton = document.getElementById('continueButton');

        let allPaymentMethods = {}, exchangeRatesAndFees = null, isCalculating = false;

        async function fetchExchangeSettings_local() { try { const settingsRef = doc(db, "exchangeSettings", "currentGlobalRates"); const docSnap = await getDoc(settingsRef); if (docSnap.exists()) { exchangeRatesAndFees = docSnap.data(); } else { console.error("CRITICAL: Exchange settings 'currentGlobalRates' not found!"); showToast("خطأ حرج: لم يتم تحميل إعدادات التبادل.", "error", 10000); disableExchangeForm(); } } catch (error) { console.error("Error fetching exchange settings (local):", error); showToast("فشل تحميل إعدادات التبادل. حاول لاحقاً.", "error", 10000); disableExchangeForm(); } }

        async function fetchAllPaymentMethods() { sendCurrencySelect.innerHTML = '<option value="">جارٍ تحميل الوسائل...</option>'; receiveCurrencySelect.innerHTML = '<option value="">...</option>'; receiveCurrencySelect.disabled = true; try { const methodsRef = collection(db, "paymentMethods"); const q = query(methodsRef, where("isActive", "==", true), orderBy("sortOrder", "asc")); const querySnapshot = await getDocs(q); allPaymentMethods = {}; sendCurrencySelect.innerHTML = '<option value="">اختر عملة الإرسال</option>'; if (querySnapshot.empty) { showToast("لا توجد وسائل دفع متاحة حاليًا.", "warning"); disableExchangeForm(); return; } querySnapshot.forEach((docSnap) => { const method = { id: docSnap.id, ...docSnap.data() }; allPaymentMethods[method.key] = method; const option = document.createElement('option'); option.value = method.key; option.textContent = method.name; sendCurrencySelect.appendChild(option); }); updateReceiveCurrencyOptions(); } catch (error) { console.error("Error fetching payment methods:", error); showToast("فشل تحميل وسائل الدفع. حاول تحديث الصفحة.", "error"); sendCurrencySelect.innerHTML = '<option value="">خطأ في التحميل</option>'; disableExchangeForm(); } }

        function disableExchangeForm() { sendCurrencySelect.disabled = true; receiveCurrencySelect.disabled = true; sendAmountInput.disabled = true; receiveAmountInput.disabled = true; if (continueButton) { continueButton.disabled = true; continueButton.textContent = "النظام غير متاح حاليًا"; } }

        function updateReceiveCurrencyOptions() { const sendKey = sendCurrencySelect.value; receiveCurrencySelect.innerHTML = '<option value="">اختر عملة الإرسال أولاً</option>'; receiveCurrencySelect.disabled = true; if (sendKey && allPaymentMethods[sendKey]) { const sendMethod = allPaymentMethods[sendKey]; let hasOptions = false; receiveCurrencySelect.innerHTML = ''; Object.keys(allPaymentMethods).forEach(receiveKey => { const receiveMethod = allPaymentMethods[receiveKey]; if (receiveKey === sendKey || !receiveMethod.isActive) return; let canExchange = false; if (sendMethod.type === "EGP" && receiveMethod.type === "USDT") canExchange = true; else if (sendMethod.type === "USDT") canExchange = true; if (canExchange) { const option = document.createElement('option'); option.value = receiveKey; option.textContent = receiveMethod.name; receiveCurrencySelect.appendChild(option); hasOptions = true; } }); if (hasOptions) { const defaultOption = document.createElement('option'); defaultOption.value = ""; defaultOption.textContent = "اختر عملة الاستلام"; defaultOption.disabled = true; defaultOption.selected = true; receiveCurrencySelect.insertBefore(defaultOption, receiveCurrencySelect.firstChild); receiveCurrencySelect.disabled = false; } else { receiveCurrencySelect.innerHTML = '<option value="">لا تبادلات متاحة لهذه الوسيلة</option>'; receiveCurrencySelect.disabled = true; } } else if (sendKey) { receiveCurrencySelect.innerHTML = '<option value="">وسيلة إرسال غير معروفة</option>'; receiveCurrencySelect.disabled = true; } updateCurrencyLabelsAndClearAmounts('receive'); }

        function updateCurrencyLabelsAndClearAmounts(clearTarget = 'receive') { const sendKey = sendCurrencySelect.value; const receiveKey = receiveCurrencySelect.value; sendCurrencyLabel.textContent = (sendKey && allPaymentMethods[sendKey]) ? allPaymentMethods[sendKey].type : ""; receiveCurrencyLabel.textContent = (receiveKey && allPaymentMethods[receiveKey]) ? allPaymentMethods[receiveKey].type : ""; if (clearTarget === 'receive') receiveAmountInput.value = ""; else if (clearTarget === 'send') sendAmountInput.value = ""; else if (clearTarget === 'both') { sendAmountInput.value = ""; receiveAmountInput.value = ""; } if (sendKey && receiveKey) { if (sendAmountInput.value && (clearTarget !== 'send' && clearTarget !== 'both')) handleAmountChange_local('send'); else if (receiveAmountInput.value && (clearTarget !== 'receive' && clearTarget !== 'both')) handleAmountChange_local('receive'); } }

        function calculateExchange(sendMethodKey, receiveMethodKey, amount, calculationSource) { if (!exchangeRatesAndFees || !allPaymentMethods[sendMethodKey] || !allPaymentMethods[receiveMethodKey] || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return "0.00"; const sendMethod = allPaymentMethods[sendMethodKey], receiveMethod = allPaymentMethods[receiveMethodKey], rates = exchangeRatesAndFees; let result = 0; if (calculationSource === 'send') { let amountToConvert = parseFloat(amount); if (sendMethod.fees && sendMethod.fees.sending && sendMethod.fees.sending.type !== 'none') { const feeConfig = sendMethod.fees.sending; let calculatedFee = 0; if (feeConfig.type === 'fixed') calculatedFee = feeConfig.value || 0; else if (feeConfig.type === 'percentage') { calculatedFee = amountToConvert * (feeConfig.value || 0); if (feeConfig.minCap != null && calculatedFee < feeConfig.minCap) calculatedFee = feeConfig.minCap; if (feeConfig.maxCap != null && calculatedFee > feeConfig.maxCap) calculatedFee = feeConfig.maxCap; } amountToConvert -= calculatedFee; } if (amountToConvert <= 0) return "0.00"; let receivedAmountBeforeFees = 0; if (sendMethod.type === "USDT" && receiveMethod.type === "EGP") receivedAmountBeforeFees = amountToConvert * (rates.usdtToEgpBuyRate || 0); else if (sendMethod.type === "EGP" && receiveMethod.type === "USDT") receivedAmountBeforeFees = amountToConvert / (rates.usdtToEgpSellRate || 1); else if (sendMethod.type === "USDT" && receiveMethod.type === "USDT") { receivedAmountBeforeFees = amountToConvert; if (sendMethod.key !== receiveMethod.key && rates.usdtToUsdtServiceFeeType && rates.usdtToUsdtServiceFeeType !== 'none') { let serviceFee = 0; if (rates.usdtToUsdtServiceFeeType === 'fixed') serviceFee = rates.usdtToUsdtServiceFeeValue || 0; else if (rates.usdtToUsdtServiceFeeType === 'percentage') { serviceFee = amountToConvert * (rates.usdtToUsdtServiceFeeValue || 0); if (rates.usdtToUsdtServiceFeeMinCap != null && serviceFee < rates.usdtToUsdtServiceFeeMinCap) serviceFee = rates.usdtToUsdtServiceFeeMinCap; if (rates.usdtToUsdtServiceFeeMaxCap != null && serviceFee > rates.usdtToUsdtServiceFeeMaxCap) serviceFee = rates.usdtToUsdtServiceFeeMaxCap; } receivedAmountBeforeFees -= serviceFee; } } else if (sendMethod.type === "EGP" && receiveMethod.type === "EGP") receivedAmountBeforeFees = amountToConvert; else return "0.00"; if (receivedAmountBeforeFees <= 0) return "0.00"; let finalAmount = receivedAmountBeforeFees; if (receiveMethod.fees && receiveMethod.fees.receiving && receiveMethod.fees.receiving.type !== 'none') { const feeConfig = receiveMethod.fees.receiving; let calculatedFee = 0; if (feeConfig.type === 'fixed') calculatedFee = feeConfig.value || 0; else if (feeConfig.type === 'percentage') { calculatedFee = receivedAmountBeforeFees * (feeConfig.value || 0); if (feeConfig.minCap != null && calculatedFee < feeConfig.minCap) calculatedFee = feeConfig.minCap; if (feeConfig.maxCap != null && calculatedFee > feeConfig.maxCap) calculatedFee = feeConfig.maxCap; } finalAmount -= calculatedFee; } result = finalAmount; } else if (calculationSource === 'receive') { let amountToCalculateFrom = parseFloat(amount); let amountBeforeReceivingFee = amountToCalculateFrom; if (receiveMethod.fees && receiveMethod.fees.receiving && receiveMethod.fees.receiving.type !== 'none') { const feeConfig = receiveMethod.fees.receiving; if (feeConfig.type === 'fixed') { amountBeforeReceivingFee += feeConfig.value || 0; } else if (feeConfig.type === 'percentage') { const percentage = feeConfig.value || 0; if (percentage < 1) { let initialGuess = amountToCalculateFrom / (1 - percentage); let calculatedFee = initialGuess * percentage; if (feeConfig.minCap != null && calculatedFee < feeConfig.minCap) calculatedFee = feeConfig.minCap; if (feeConfig.maxCap != null && calculatedFee > feeConfig.maxCap) calculatedFee = feeConfig.maxCap; amountBeforeReceivingFee = amountToCalculateFrom + calculatedFee; } } } if (amountBeforeReceivingFee <= 0) return "0.00"; let amountAfterSendingFee = 0; if (sendMethod.type === "USDT" && receiveMethod.type === "EGP") { amountAfterSendingFee = amountBeforeReceivingFee / (rates.usdtToEgpBuyRate || 1); } else if (sendMethod.type === "EGP" && receiveMethod.type === "USDT") { amountAfterSendingFee = amountBeforeReceivingFee * (rates.usdtToEgpSellRate || 0); } else if (sendMethod.type === "USDT" && receiveMethod.type === "USDT") { if (sendMethod.key === receiveMethod.key) { amountAfterSendingFee = amountBeforeReceivingFee; } else { const feeConfig = { type: rates.usdtToUsdtServiceFeeType, value: rates.usdtToUsdtServiceFeeValue, minCap: rates.usdtToUsdtServiceFeeMinCap, maxCap: rates.usdtToUsdtServiceFeeMaxCap }; if (feeConfig.type === 'none' || !feeConfig.type) { amountAfterSendingFee = amountBeforeReceivingFee; } else if (feeConfig.type === 'fixed') { amountAfterSendingFee = amountBeforeReceivingFee + (feeConfig.value || 0); } else if (feeConfig.type === 'percentage') { const p = feeConfig.value || 0; if (p < 1) { let potentialSend_A = amountBeforeReceivingFee / (1 - p); let calculatedFee_A = potentialSend_A * p; if ((feeConfig.minCap == null || calculatedFee_A >= feeConfig.minCap) && (feeConfig.maxCap == null || calculatedFee_A <= feeConfig.maxCap)) { amountAfterSendingFee = potentialSend_A; } else if (feeConfig.minCap != null && calculatedFee_A < feeConfig.minCap) { amountAfterSendingFee = amountBeforeReceivingFee + feeConfig.minCap; } else if (feeConfig.maxCap != null && calculatedFee_A > feeConfig.maxCap) { amountAfterSendingFee = amountBeforeReceivingFee + feeConfig.maxCap; } else { amountAfterSendingFee = potentialSend_A; } } } else { amountAfterSendingFee = amountBeforeReceivingFee; } } } else if (sendMethod.type === "EGP" && receiveMethod.type === "EGP") { amountAfterSendingFee = amountBeforeReceivingFee; } else { return "0.00"; } if (amountAfterSendingFee <= 0) return "0.00"; let initialSendAmount = amountAfterSendingFee; if (sendMethod.fees && sendMethod.fees.sending && sendMethod.fees.sending.type !== 'none') { const feeConfig = sendMethod.fees.sending; if (feeConfig.type === 'fixed') { initialSendAmount += feeConfig.value || 0; } else if (feeConfig.type === 'percentage') { const percentage = feeConfig.value || 0; if (percentage < 1) { let initialGuess = amountAfterSendingFee / (1 - percentage); let calculatedFee = initialGuess * percentage; if (feeConfig.minCap != null && calculatedFee < feeConfig.minCap) calculatedFee = feeConfig.minCap; if (feeConfig.maxCap != null && calculatedFee > feeConfig.maxCap) calculatedFee = feeConfig.maxCap; initialSendAmount = amountAfterSendingFee + calculatedFee; } } } result = initialSendAmount; } if (result <= 0 || isNaN(result)) return "0.00"; let finalValue; if (calculationSource === 'send') { finalValue = Math.floor(result * 100) / 100; } else { finalValue = Math.ceil(result * 100) / 100; } return finalValue.toFixed(2); }

        function handleAmountChange_local(source) { if (isCalculating) return; const sendKey = sendCurrencySelect.value, receiveKey = receiveCurrencySelect.value; if (!sendKey || !receiveKey || !exchangeRatesAndFees) { if (source === 'send') receiveAmountInput.value = ""; else sendAmountInput.value = ""; return; } isCalculating = true; try { if (source === 'send') { const amountToConvert = parseFloat(sendAmountInput.value); if (isNaN(amountToConvert) || amountToConvert <= 0) { receiveAmountInput.value = ""; } else { receiveAmountInput.value = calculateExchange(sendKey, receiveKey, amountToConvert, 'send'); } } else if (source === 'receive') { const amountToConvert = parseFloat(receiveAmountInput.value); if (isNaN(amountToConvert) || amountToConvert <= 0) { sendAmountInput.value = ""; } } else { sendAmountInput.value = calculateExchange(sendKey, receiveKey, amountToConvert, 'receive'); } } catch (e) { console.error("Calculation error:", e); sendAmountInput.value = ""; receiveAmountInput.value = ""; } finally { isCalculating = false; } }

        

        async function validateAndProceed() {

            window.showPageSpinner();

            const sendMethodKey = sendCurrencySelect.value,

                receiveMethodKey = receiveCurrencySelect.value,

                sendAmountVal = sendAmountInput.value,

                receiveAmountVal = receiveAmountInput.value,

                sendAmountNum = parseFloat(sendAmountVal),

                receiveAmountNum = parseFloat(receiveAmountVal);

        

            if (!allPaymentMethods || Object.keys(allPaymentMethods).length === 0 || !exchangeRatesAndFees) {

                window.showToast("خطأ في تحميل إعدادات الموقع. يرجى تحديث الصفحة.", 'error');

                window.hidePageSpinner();

                return;

            }

        

            if (!sendMethodKey || !receiveMethodKey) {

                window.showToast("الرجاء اختيار عملتي الإرسال والاستلام.", 'error');

                window.hidePageSpinner();

                return;

            }

        

            if (isNaN(sendAmountNum) || sendAmountNum <= 0 || isNaN(receiveAmountNum) || receiveAmountNum <= 0) {

                window.showToast("الرجاء إدخال مبالغ صحيحة.", 'error');

                window.hidePageSpinner();

                return;

            }

        

            const sendMethodDetails = allPaymentMethods[sendMethodKey];

            const receiveMethodDetails = allPaymentMethods[receiveMethodKey];

        

            if (!sendMethodDetails || !receiveMethodDetails) {

                window.showToast("وسيلة الإرسال أو الاستلام المختارة غير صالحة.", "error");

                window.hidePageSpinner();

                return;

            }

        

            if (typeof sendMethodDetails.minAmount === 'number' && sendAmountNum < sendMethodDetails.minAmount) {

                window.showToast(`الحد الأدنى للإرسال بعملة ${sendMethodDetails.name} هو ${sendMethodDetails.minAmount} ${sendMethodDetails.type}.`, 'warning');

                window.hidePageSpinner();

                return;

            }

        

            if (typeof receiveMethodDetails.minAmount === 'number' && receiveAmountNum < receiveMethodDetails.minAmount) {

                window.showToast(`الحد الأدنى للاستلام بعملة ${receiveMethodDetails.name} هو ${receiveMethodDetails.minAmount} ${receiveMethodDetails.type}.`, 'warning');

                window.hidePageSpinner();

                return;

            }

        

            // START: Add Balance Check Logic

            const receiveMethodBalance = receiveMethodDetails.balance;



            // Check if a balance is set for the receiving method

            if (typeof receiveMethodBalance === 'number' && receiveAmountNum > receiveMethodBalance) {

                // Construct the specific error message you requested

                const errorMessage = `الرصيد المتاح حاليًا لا يكفي. الحد الأقصى المسموح به هو ${receiveMethodBalance.toFixed(2)} ${receiveMethodDetails.type} لوسيلة ${receiveMethodDetails.name}.`;

                

                window.showToast(errorMessage, 'error', 6000); // Show for 6 seconds

                window.hidePageSpinner();

                return; // Stop the function from proceeding

            }

            // END: Add Balance Check Logic



            if (sendMethodDetails.requiresWholeNumber && sendAmountNum % 1 !== 0) {

                window.showToast(`المبلغ المرسل بعملة ${sendMethodDetails.name} يجب أن يكون رقمًا صحيحًا (بدون كسور).`, 'warning');

                window.hidePageSpinner();

                return;

            }

        

            try {

                const { getCurrentUser } = await import('./auth/auth.js');

                const user = await getCurrentUser();

                if (!user || !user.emailVerified) {

                    window.showToast("يجب تسجيل الدخول والتحقق من بريدك الإلكتروني للمتابعة...", 'info', 3000);

                    localStorage.setItem('pendingExchangeData', JSON.stringify({

                        sendCurrency: sendMethodKey,

                        receiveCurrency: receiveMethodKey,

                        sendAmount: sendAmountVal,

                        receiveAmount: receiveAmountVal

                    }));

                    setTimeout(() => {

                        window.location.href = `/auth/login.html?action=continueExchange&next=../exchange.html`;

                    }, 2500);

                    return;

                }

            } catch (e) {

                console.error("Error checking auth status:", e);

                window.showToast("حدث خطأ أثناء التحقق من حالة تسجيل الدخول.", 'error', 5000);

                window.hidePageSpinner();

                return;

            }

        

            const params = new URLSearchParams({

                sendAmount: sendAmountVal,

                sendCurrency: sendMethodKey,

                receiveAmount: receiveAmountVal,

                receiveCurrency: receiveMethodKey

            });

            window.location.href = `exchange.html?${params.toString()}`;

        }



        sendCurrencySelect.addEventListener('change', updateReceiveCurrencyOptions);

        receiveCurrencySelect.addEventListener('change', () => updateCurrencyLabelsAndClearAmounts('send'));

        sendAmountInput.addEventListener('input', () => handleAmountChange_local('send'));

        receiveAmountInput.addEventListener('input', () => handleAmountChange_local('receive'));

        if (continueButton) continueButton.addEventListener('click', validateAndProceed);

        async function initializePage() { window.showPageSpinner(); try { await fetchExchangeSettings_local(); if (exchangeRatesAndFees) { await fetchAllPaymentMethods(); const pendingExchange = localStorage.getItem('pendingExchangeData'); if (pendingExchange) { try { const data = JSON.parse(pendingExchange); if (data.sendCurrency && sendCurrencySelect.querySelector(`option[value="${data.sendCurrency}"]`)) { sendCurrencySelect.value = data.sendCurrency; updateReceiveCurrencyOptions(); } if (data.receiveCurrency && receiveCurrencySelect.querySelector(`option[value="${data.receiveCurrency}"]`)) { receiveCurrencySelect.value = data.receiveCurrency; } if (data.sendAmount) sendAmountInput.value = data.sendAmount; if (sendAmountInput.value) handleAmountChange_local('send'); else if (data.receiveAmount) { receiveAmountInput.value = data.receiveAmount; handleAmountChange_local('receive'); } updateCurrencyLabelsAndClearAmounts('none'); } catch (e) { console.error("Error parsing pendingExchangeData:", e); } finally { localStorage.removeItem('pendingExchangeData'); } } else { updateReceiveCurrencyOptions(); } } } finally { window.hidePageSpinner(); } }

        initializePage();

    }

    // --- END: Exchange Form Logic ---



    // --- START: PENDING TRANSACTION NOTIFIER (MODIFIED) ---

    async function checkAndNotifyPendingTransactions(user) {

        if (!user) return;



        const notificationClosedTimestamp = sessionStorage.getItem('pendingTxNotificationClosed');

        if (notificationClosedTimestamp && (Date.now() - notificationClosedTimestamp < 1 * 60 * 60 * 1000)) { // 1 hour cooldown

            return;

        }



        const { getUserTransactions } = await import('./auth/auth.js');

        const transactions = await getUserTransactions(user.uid);

        const pendingTx = transactions.find(tx => tx.status === 'Pending');



        if (pendingTx) {

            showPendingTransactionToast(pendingTx);

        }

    }



    function showPendingTransactionToast(tx) {

        const toastId = `toast-${Date.now()}`;

        const toast = document.createElement('div');

        toast.id = toastId;

        toast.className = 'toast-notification persistent';

        

        toast.innerHTML = `

            <div class="toast-persistent-header">

                <h4>

                    <box-icon name='info-circle' type='solid'></box-icon>

                    عملية معلقة

                </h4>

                <button class="toast-close-btn" aria-label="إغلاق">

                    <box-icon name='x'></box-icon>

                </button>

            </div>

            <div class="toast-content">

                <p>لديك عملية تبادل برقم <strong>${tx.transactionId}</strong> لم تكتمل بعد. ماذا تود أن تفعل؟</p>

                <div class="toast-actions">

                    <button class="toast-btn continue">متابعة العملية</button>

                    <button class="toast-btn complete">لقد أتممتها</button>

                    <button class="toast-btn cancel">إلغاء العملية</button>

                </div>

            </div>

        `;



        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);



        const closeToast = () => {

            toast.classList.remove('show');

            setTimeout(() => toast.remove(), 500);

        };

        

        toast.querySelector('.toast-close-btn').onclick = () => {

             sessionStorage.setItem('pendingTxNotificationClosed', Date.now());

             closeToast();

        };



        toast.querySelector('.toast-btn.continue').onclick = async () => {

            const { getGlobalSettings } = await import('./auth/auth.js');

            const settings = await getGlobalSettings();

            if (settings && settings.whatsAppNumber) {

                 const userIdentifierForChat = tx.receiveUserIdentifierType || "المعرف الخاص بي";

                 const message = `مرحبًا، أرغب في إتمام عملية التبادل التالية (رقم العملية: ${tx.transactionId}):

أرسل:
- المبلغ: ${tx.sendAmount.toFixed(2)} ${tx.sendCurrencyType}
- عبر: ${tx.sendCurrencyName}

أستلم:
- المبلغ: ${tx.receiveAmount.toFixed(2)} ${tx.receiveCurrencyType}
- عبر: ${tx.receiveCurrencyName}

سأقوم بإرسال إيصال التحويل و ${userIdentifierForChat} الآن.`;

                 const whatsappUrl = `https://wa.me/${settings.whatsAppNumber}?text=${encodeURIComponent(message)}`;

                 window.open(whatsappUrl, '_blank');

            } else {

                window.showInfoModal({

                    title: 'خطأ',

                    message: 'لا يمكن المتابعة، خطأ في تحميل رقم التواصل.',

                    iconName: 'error',

                    iconColor: 'var(--danger-color)'

                });

            }

            closeToast();

        };



        toast.querySelector('.toast-btn.cancel').onclick = async () => {

            const confirmed = await window.showConfirmationModal({

                title: 'تأكيد الإلغاء',

                message: 'هل أنت متأكد من رغبتك في إلغاء هذه العملية؟ لا يمكن التراجع عن هذا الإجراء.',

                confirmText: 'نعم، قم بالإلغاء',

                cancelText: 'تراجع',

                iconName: 'trash',

                iconColor: 'var(--danger-color)'

            });



            if (confirmed) {

                const txRef = doc(db, "transactions", tx.id);

                await updateDoc(txRef, {

                    status: "Rejected",

                    statusHistory: arrayUnion({ status: "Rejected", timestamp: new Date() })

                });

                window.showInfoModal({

                    title: 'تم الإلغاء',

                    message: 'تم إلغاء العملية بنجاح.',

                    iconName: 'check-circle',

                    iconColor: 'var(--success-color)'

                });

                closeToast();

            }

        };

        

        toast.querySelector('.toast-btn.complete').onclick = async () => {

             const confirmed = await window.showConfirmationModal({

                title: 'تأكيد الإتمام',

                message: 'هل أنت متأكد أنك قمت بتحويل المبلغ وإرسال الإيصال للدعم؟ سيتم تحديث حالة العملية إلى "قيد المعالجة".',

                confirmText: 'نعم، أؤكد',

                cancelText: 'تراجع',

                iconName: 'send',

                iconColor: 'var(--primary-color)'

            });



            if (confirmed) {

                const txRef = doc(db, "transactions", tx.id);

                await updateDoc(txRef, {

                    status: "Processing",

                    statusHistory: arrayUnion({ status: "Processing", timestamp: new Date() })

                });

                window.showInfoModal({

                    title: 'شكرًا لك',

                    message: 'سيقوم المشرف بمراجعة عمليتك وتأكيدها في أقرب وقت. يمكنك متابعة حالة العملية من صفحة "سجل العمليات".',

                    iconName: 'check-circle',

                    iconColor: 'var(--success-color)'

                });

                closeToast();

            }

        };

    }



    // Initialize the notifier trigger

    (async () => {

        try {

            const { auth, onAuthStateChanged } = await import('./auth/auth.js');

            onAuthStateChanged(auth, (user) => {

                if (user && user.emailVerified) {

                    setTimeout(() => checkAndNotifyPendingTransactions(user), 3000);

                }

            });

        } catch (e) {

            console.error("Could not initialize pending transaction notifier:", e);

        }

    })();

    // --- END: PENDING TRANSACTION NOTIFIER ---



    // --- Global Initializers ---

    loadNotificationBar(); 

    window.addEventListener('load', () => { setTimeout(updateLayoutPadding, 350); setTimeout(window.hidePageSpinner, 500); });

    window.addEventListener('resize', updateLayoutPadding);

    window.addEventListener('pageshow', function (event) { if (event.persisted) { window.hidePageSpinner(); } });

});
