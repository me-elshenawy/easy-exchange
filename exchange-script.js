import { db } from './auth/firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function getPaymentMethodDetailsByKey(pmKey) {
    if (!pmKey) return null;
    try {
        const methodsRef = collection(db, "paymentMethods");
        const q = query(methodsRef, where("key", "==", pmKey));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0].data();
            if (docData.isActive) {
                 return { id: querySnapshot.docs[0].id, ...docData };
            } else {
                console.warn(`Payment method with key ${pmKey} found but is not active.`);
                return null;
            }
        }
        console.warn(`Payment method with key ${pmKey} not found.`);
        return null;
    } catch (error) {
        console.error(`Error fetching payment method details for key ${pmKey}:`, error);
        return null;
    }
}

async function protectPageExchange() {
    try {
        // Dynamically import all necessary functions from auth.js
        const { getCurrentUser, saveTransactionToFirestore, generateTransactionId, getGlobalSettings } = await import('./auth/auth.js');
        const user = await getCurrentUser();

        if (!user || !user.emailVerified) {
            console.log("User not authenticated or verified for exchange page.");
            const currentParams = new URLSearchParams(window.location.search).toString();
            if (currentParams) {
                localStorage.setItem('pendingExchangeUrlParams', currentParams);
            }
            let loginRedirect = '/auth/login.html?action=continueExchange&next=../exchange.html';
            window.location.href = loginRedirect;
            return { accessGranted: false };
        }
        // If access is granted, return the user object and the functions needed by the main script.
        return {
            accessGranted: true,
            user,
            saveTransactionToFirestore,
            generateTransactionId,
            getGlobalSettings // Pass the function itself
        };
    } catch (e) {
        console.error("Error during page protection check:", e);
        document.body.innerHTML = "<h1>خطأ</h1><p>حدث خطأ أثناء التحقق من صلاحية الوصول. يرجى المحاولة مرة أخرى أو تسجيل الدخول.</p><a href='/auth/login.html'>تسجيل الدخول</a>";
        return { accessGranted: false };
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Show spinner at the very beginning
    if(window.showPageSpinner) window.showPageSpinner();

    try {
        const authContext = await protectPageExchange();
        if (!authContext.accessGranted || !authContext.user) {
            // Spinner will be hidden by page navigation if redirect happens
            return;
        }

        const { user, saveTransactionToFirestore, generateTransactionId, getGlobalSettings } = authContext;
        const contentWrapper = document.querySelector('.main-content-wrapper .content-wrapper-inner') || document.body;
        
        // Fetch global settings from Firestore
        const globalSettings = await getGlobalSettings();
        if (!globalSettings || !globalSettings.whatsAppNumber) {
            contentWrapper.innerHTML = `<h1>خطأ فني</h1><p>لم يتم تحميل إعدادات التواصل. يرجى المحاولة لاحقاً أو إبلاغ الدعم.</p> <a href='index.html' class='site-button' style='text-decoration:none; display:inline-block; width:auto; padding:10px 20px;'>العودة للصفحة الرئيسية</a>`;
            if(window.hidePageSpinner) window.hidePageSpinner();
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const sendAmountStr = urlParams.get("sendAmount");
        const sendCurrencyKey = urlParams.get("sendCurrency");
        const receiveAmountStr = urlParams.get("receiveAmount");
        const receiveCurrencyKey = urlParams.get("receiveCurrency");

        if (!sendAmountStr || !sendCurrencyKey || !receiveAmountStr || !receiveCurrencyKey) {
            contentWrapper.innerHTML = `<h1>خطأ</h1><p>بيانات العملية غير مكتملة أو خاطئة. قد تكون جلسة التبادل قد انتهت.</p> <a href='index.html' class='site-button' style='text-decoration:none; display:inline-block; width:auto; padding:10px 20px;'>العودة للصفحة الرئيسية</a>`;
            return;
        }
        
        const sendAmount = parseFloat(sendAmountStr);
        const receiveAmount = parseFloat(receiveAmountStr);

        const sendMethodDetails = await getPaymentMethodDetailsByKey(sendCurrencyKey);
        const receiveMethodDetails = await getPaymentMethodDetailsByKey(receiveCurrencyKey);

        if (!sendMethodDetails || !receiveMethodDetails) {
            contentWrapper.innerHTML = `<h1>خطأ</h1><p>لم يتم العثور على تفاصيل وسائل الدفع المختارة. قد تكون غير نشطة أو تم حذفها.</p> <a href='index.html' class='site-button' style='text-decoration:none; display:inline-block; width:auto; padding:10px 20px;'>العودة للصفحة الرئيسية</a>`;
            return;
        }

        if (!sendMethodDetails.isSiteAccount || !sendMethodDetails.recipientInfo) {
            const errorMessage = `وسيلة الدفع المختارة للدفع للموقع (${sendMethodDetails.name}) غير مُعدة لاستقبال الأموال حاليًا أو لا تحتوي على معلومات حساب. يرجى المحاولة لاحقًا أو الاتصال بالدعم.`;
            contentWrapper.innerHTML = `<h1>خطأ</h1><p>${errorMessage}</p> <a href='index.html' class='site-button' style='text-decoration:none; display:inline-block; width:auto; padding:10px 20px;'>العودة للصفحة الرئيسية</a>`;
            return;
        }

        document.getElementById("sendCurrencyValue").textContent = sendMethodDetails.name;
        document.getElementById("sendAmountValue").textContent = `${sendAmount.toFixed(2)} ${sendMethodDetails.type}`;
        document.getElementById("receiveCurrencyValue").textContent = receiveMethodDetails.name;
        document.getElementById("receiveAmountValue").textContent = `${receiveAmount.toFixed(2)} ${receiveMethodDetails.type}`;

        const userIdentifierForChat = receiveMethodDetails.userIdentifierType || "المعرف الخاص بك";
        document.getElementById("instructionNote").innerHTML = `يرجى تحويل المبلغ الموضح أعلاه. لا تنسى الاحتفاظ بإيصال المعاملة (سكرين شوت)، وإرساله مع <strong>${userIdentifierForChat}</strong> الخاص بوسيلة الاستلام (<strong>${receiveMethodDetails.name}</strong>) في الدردشة.`;

        const recipientInfoToDisplay = sendMethodDetails.recipientInfo;
        const recipientTypeForInstruction = sendMethodDetails.recipientType || "المعرف";
        const siteReceivingMethodNameForDisplay = sendMethodDetails.name;

        document.getElementById("transferMessage").innerHTML = `برجاء التحويل إلى <strong>${recipientTypeForInstruction}</strong> التالي الخاص بوسيلة <strong>${siteReceivingMethodNameForDisplay}</strong>:`;
        document.getElementById("dynamicRecipientInfo").textContent = recipientInfoToDisplay;

        const recipientInfoBox = document.getElementById("recipientInfoBox");
        if(recipientInfoBox) {
            recipientInfoBox.addEventListener('click', () => {
                navigator.clipboard.writeText(recipientInfoToDisplay)
                    .then(() => {
                        window.showToast(`تم نسخ ${recipientTypeForInstruction}: ${recipientInfoToDisplay} بنجاح!`);
                    })
                    .catch(err => {
                        console.error('Failed to copy: ', err);
                        window.showToast('فشل النسخ. يرجى النسخ يدويًا.', 'error', 3000);
                    });
            });
        }

        const reportProblemLink = document.getElementById("reportProblemLink");
        if (reportProblemLink) {
            reportProblemLink.addEventListener('click', (e) => {
                e.preventDefault();
                const message = `مرحبًا، أواجه مشكلة في وسيلة الدفع الموضحة لـ ${siteReceivingMethodNameForDisplay}.\nالمعرف/الرقم الظاهر هو: ${recipientInfoToDisplay}\n\nهل يمكن المساعدة؟`;
                const whatsappUrl = `https://wa.me/${globalSettings.whatsAppNumber}?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            });
        }

        const goToChatButton = document.getElementById("goToChatButton");
        if (goToChatButton) {
            goToChatButton.addEventListener('click', async () => {
                if (window.showPageSpinner) window.showPageSpinner();
                goToChatButton.disabled = true;
                goToChatButton.innerHTML = '<span class="spinner" style="border-top-color: #fff; width:18px; height:18px; display:inline-block; margin-left:5px;"></span> جارٍ التجهيز...';

                const transactionDetails = {
                    exchangerName: user.displayName || user.email.split('@')[0],
                    sendCurrencyKey: sendMethodDetails.key,
                    sendCurrencyName: sendMethodDetails.name,
                    sendAmount: sendAmount,
                    sendCurrencyType: sendMethodDetails.type,
                    receiveCurrencyKey: receiveMethodDetails.key,
                    receiveCurrencyName: receiveMethodDetails.name,
                    receiveAmount: receiveAmount,
                    receiveCurrencyType: receiveMethodDetails.type,
                    transactionId: generateTransactionId(),
                    status: "Pending" 
                };

                const savedTxId = await saveTransactionToFirestore(user.uid, transactionDetails);

                if (savedTxId) {
                    const message = `مرحبًا، أرغب في إتمام عملية التبادل التالية (رقم العملية: ${savedTxId}):\n\nأرسل:\n- المبلغ: ${sendAmount.toFixed(2)} ${sendMethodDetails.type}\n- عبر: ${sendMethodDetails.name}\n\nأستلم:\n- المبلغ: ${receiveAmount.toFixed(2)} ${receiveMethodDetails.type}\n- عبر: ${receiveMethodDetails.name}\n\nسأقوم بإرسال إيصال التحويل و ${userIdentifierForChat} الخاص بي الآن.`;
                    const whatsappUrl = `https://wa.me/${globalSettings.whatsAppNumber}?text=${encodeURIComponent(message)}`;
                    window.open(whatsappUrl, '_blank');
                    goToChatButton.textContent = 'تم التوجيه للدردشة';
                    // The spinner will be hidden by the browser when the new tab opens.
                } else {
                    console.error("لم يتم حفظ العملية، لن يتم فتح الواتساب.");
                    window.showToast("فشل حفظ العملية. يرجى المحاولة مرة أخرى أو الاتصال بالدعم.", 'error', 4000);
                    goToChatButton.disabled = false;
                    goToChatButton.innerHTML = 'التوجه إلى الدردشة للتأكيد <box-icon name="whatsapp" type="logo" animation="tada" color="#ffffff"></box-icon>';
                    if (window.hidePageSpinner) window.hidePageSpinner();
                }
            });
        }
    } finally {
        // Hide spinner after all initial setup is done
        if(window.hidePageSpinner) window.hidePageSpinner();
    }
});