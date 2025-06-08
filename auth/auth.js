import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, setDoc, getDoc, serverTimestamp, updateDoc, 
    collection, addDoc, query, where, getDocs, orderBy, arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// A utility function to show messages, primarily using a toast function if available.
const showMessage = (toastFn, message, type = 'info', duration = 4000) => {
    if (typeof toastFn === 'function') {
        toastFn(message, type, duration);
    } else {
        // Fallback to alert if no toast function is provided
        console.warn("Toast function not available. Falling back to alert.");
        alert(`${type.toUpperCase()}: ${message}`);
    }
};

const handleSuccessfulAuth = (user) => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const nextUrlRaw = urlParams.get('next');

    const exchangePathFromAuth = '../exchange.html';
    const dashboardPathFromAuth = 'dashboard.html';

    if (action === 'continueExchange' && user.emailVerified) {
        const pendingUrlParams = localStorage.getItem('pendingExchangeUrlParams');
        localStorage.removeItem('pendingExchangeUrlParams');
        let finalUrl = exchangePathFromAuth;
        if (pendingUrlParams) {
            finalUrl += `?${pendingUrlParams}&auth_success=true`;
        } else if (nextUrlRaw) {
            finalUrl = `${decodeURIComponent(nextUrlRaw)}?auth_success=true`;
        } else {
             finalUrl += '?auth_success=true';
        }
        window.location.href = finalUrl;
    } else if (user.emailVerified) {
        const redirectTo = nextUrlRaw ? decodeURIComponent(nextUrlRaw) : dashboardPathFromAuth;
        window.location.href = redirectTo;
    } else {
        window.location.href = 'verify-email.html';
    }
};

export const registerUser = async (email, password, additionalData, messageElementId, toastFn) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, {
            displayName: `${additionalData.firstName || ''} ${additionalData.lastName || ''}`.trim() || user.email.split('@')[0]
        });

        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            firstName: additionalData.firstName || "",
            lastName: additionalData.lastName || "",
            phoneNumber: additionalData.phoneNumber || "",
            dateOfBirth: additionalData.dateOfBirth || "",
            createdAt: serverTimestamp()
        });

        await sendEmailVerification(user);

        const successMsg = "تم التسجيل بنجاح! تم إرسال رسالة التحقق إلى بريدك الإلكتروني.";
        showMessage(toastFn, successMsg, 'success', 5000);
        
        setTimeout(() => {
            handleSuccessfulAuth(user);
        }, 4000);
        return user;
    } catch (error) {
        console.error("خطأ في التسجيل:", error);
        let friendlyMessage = `فشل التسجيل: ${error.message}`;
        if (error.code === 'auth/email-already-in-use') {
            friendlyMessage = "فشل التسجيل: هذا البريد الإلكتروني مستخدم بالفعل.";
        } else if (error.code === 'auth/weak-password') {
            friendlyMessage = "فشل التسجيل: كلمة المرور ضعيفة جدًا (6 أحرف على الأقل).";
        }
        
        showMessage(toastFn, friendlyMessage, 'error');
        return null;
    }
};

export const loginUser = async (email, password, messageElementId, toastFn) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (user.emailVerified) {
            handleSuccessfulAuth(user);
        } else {
            const verifyMsg = "يرجى التحقق من بريدك الإلكتروني قبل تسجيل الدخول. يتم الآن إعادة توجيهك...";
            showMessage(toastFn, verifyMsg, 'info', 3500);
            setTimeout(() => {
                window.location.href = 'verify-email.html';
            }, 3000);
        }
        return user;
    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error);
        let friendlyMessage = `فشل تسجيل الدخول: ${error.message}`;
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            friendlyMessage = "فشل تسجيل الدخول: البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        }
        showMessage(toastFn, friendlyMessage, 'error');
        return null;
    }
};

export const logoutUser = async (redirectPath = 'login.html') => {
    try {
        await signOut(auth);
        window.location.href = redirectPath;
    } catch (error) {
        console.error("خطأ في تسجيل الخروج:", error);
        alert(`فشل تسجيل الخروج: ${error.message}`);
    }
};

export const sendPasswordReset = async (email, messageElementId, toastFn) => {
    try {
        await sendPasswordResetEmail(auth, email);
        const successMsg = "تم إرسال الرابط بنجاح. يرجى تفقد بريدك الإلكتروني (بما في ذلك مجلد الرسائل غير المرغوب فيها) لإكمال العملية.";
        showMessage(toastFn, successMsg, 'success', 8000);
    } catch (error) {
        console.error("خطأ في إرسال بريد إعادة تعيين كلمة المرور:", error);
        let friendlyMessage = `فشل إرسال رابط إعادة التعيين.`;
        if (error.code === 'auth/user-not-found') {
            const successMsg = "تم إرسال الرابط بنجاح. يرجى تفقد بريدك الإلكتروني (بما في ذلك مجلد الرسائل غير المرغوب فيها) لإكمال العملية.";
            showMessage(toastFn, successMsg, 'success', 8000);
        } else if (error.code === 'auth/invalid-email') {
            friendlyMessage = "البريد الإلكتروني الذي أدخلته غير صالح.";
        } else if (error.code === 'auth/too-many-requests') { 
            friendlyMessage = "لقد طلبت إعادة تعيين كلمة المرور عدة مرات. يرجى المحاولة مرة أخرى لاحقًا.";
        }
        
        if(error.code !== 'auth/user-not-found') {
            showMessage(toastFn, friendlyMessage, 'error');
        }
    }
};

export const resendVerificationEmail = async (messageElementId, toastFn) => {
    const user = auth.currentUser;
    if (user) {
        try {
            await sendEmailVerification(user);
            const successMsg = "تم إرسال رسالة تحقق جديدة. يرجى تفقد بريدك الإلكتروني.";
            showMessage(toastFn, successMsg, 'success');
        } catch (error) {
            console.error("خطأ في إعادة إرسال التحقق:", error);
            let errorMsg = `فشل إعادة الإرسال: ${error.message}`;
            if (error.code === 'auth/too-many-requests') {
                errorMsg = "لقد أرسلت الكثير من الطلبات. يرجى المحاولة لاحقًا.";
            }
            showMessage(toastFn, errorMsg, 'error');
        }
    } else {
        const noUserMsg = "لا يوجد مستخدم مسجل حاليًا لإرسال رسالة تحقق له.";
        showMessage(toastFn, noUserMsg, 'error');
    }
};

export const checkEmailVerificationStatus = async (messageElementId, toastFn) => {
    const user = auth.currentUser;
    if (user) {
        await user.reload();
        if (user.emailVerified) {
            const successMsg = "تم التحقق بنجاح! يتم الآن توجيهك إلى لوحة التحكم...";
            showMessage(toastFn, successMsg, 'success', 3000);
            setTimeout(() => {
                handleSuccessfulAuth(user);
            }, 2500);
            return true;
        } else {
            const notVerifiedMsg = "الحساب لم يتم التحقق منه بعد. يرجى فتح الرابط في بريدك الإلكتروني.";
            showMessage(toastFn, notVerifiedMsg, 'warning');
            return false;
        }
    } else {
        const noUserMsg = "لا يوجد مستخدم مسجل حاليًا للتحقق من حالته.";
        showMessage(toastFn, noUserMsg, 'error');
        return false;
    }
};

export const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        }, reject);
    });
};

export const protectPage = async (requiresVerification = true) => {
    const user = await getCurrentUser();
    const currentPathname = window.location.pathname;
    const onAuthDir = currentPathname.includes('/auth/');
    
    const publicAuthPages = ['/auth/login.html', '/auth/register.html', '/auth/forgot-password.html'];
    const isPublicAuthPage = publicAuthPages.includes(currentPathname);
    const isVerifyPage = currentPathname.endsWith('verify-email.html');

    if (!user) {
        if (requiresVerification) {
            window.location.href = onAuthDir ? 'login.html' : 'auth/login.html';
        }
        return null;
    }

    if (user.emailVerified) {
        if (isPublicAuthPage || isVerifyPage) {
            handleSuccessfulAuth(user);
        }
        return user;
    } else {
        if (!isVerifyPage) {
            window.location.href = onAuthDir ? 'verify-email.html' : 'auth/verify-email.html';
        }
        return user;
    }
};

export const getUserProfile = async (uid) => {
    if (!uid) return null;
    try {
        const userDocRef = doc(db, "users", uid);
        const docSnap = await getDoc(userDocRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("خطأ في جلب ملف تعريف المستخدم:", error);
        return null;
    }
};

export const updateUserProfileData = async (uid, dataToUpdate) => {
    if (!uid) return false;
    try {
        const user = auth.currentUser;
        if (!user || user.uid !== uid) return false;

        const userDocRef = doc(db, "users", uid);
        const docSnap = await getDoc(userDocRef);

        let finalUpdateData = { ...dataToUpdate };

        if (docSnap.exists()) {
            const currentData = docSnap.data();
            const oldPhoneNumber = currentData.phoneNumber;
            const newPhoneNumber = dataToUpdate.phoneNumber;

            if (newPhoneNumber && newPhoneNumber !== oldPhoneNumber && oldPhoneNumber) {
                finalUpdateData.previousPhoneNumbers = arrayUnion(oldPhoneNumber);
            }
        }
        
        await updateDoc(userDocRef, { ...finalUpdateData, updatedAt: serverTimestamp() });
        
        const newDisplayName = `${dataToUpdate.firstName || ''} ${dataToUpdate.lastName || ''}`.trim();
        if (newDisplayName && newDisplayName !== user.displayName) {
            await updateProfile(user, { displayName: newDisplayName });
        }
        return true;
    } catch (error) {
        console.error("Error updating user profile:", error);
        return false;
    }
};

export const generateTransactionId = () => {
    const timestampPart = Date.now().toString(36).slice(-4).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EZ-${timestampPart}${randomPart}`;
};

/**
 * @description يحفظ بيانات العملية في Firestore. (الإصدار النهائي)
 * @param {string} userId - معرف المستخدم.
 * @param {object} transactionData - بيانات العملية.
 * @returns {Promise<string|null>} - يعيد transactionId عند النجاح، و null عند الفشل.
 */
export const saveTransactionToFirestore = async (userId, transactionData) => {
    if (!userId || !transactionData) return null;
    try {
        // 1. إعداد البيانات الأساسية للعملية مع الطابع الزمني من الخادم
        const baseTransactionData = {
            ...transactionData,
            userId: userId,
            transactionId: transactionData.transactionId || generateTransactionId(),
            status: transactionData.status || "Pending",
            timestamp: serverTimestamp() // الطابع الزمني الرسمي للإنشاء
        };

        // 2. إنشاء المستند أولاً
        const docRef = await addDoc(collection(db, "transactions"), baseTransactionData);

        // --- الحل النهائي للمشكلة ---
        // 3. إنشاء سجل الحالة الأول باستخدام طابع زمني من جهاز العميل (new Date())
        // هذا يتجنب خطأ Firebase المتعلق باستخدام serverTimestamp داخل مصفوفة عند الإنشاء
        const initialStatusEntry = {
            status: baseTransactionData.status,
            timestamp: new Date() 
        };

        // 4. تحديث المستند لإضافة سجل الحالة الأولي
        await updateDoc(docRef, {
            statusHistory: [initialStatusEntry] // تعيين المصفوفة مباشرة
        });
        
        return baseTransactionData.transactionId;

    } catch (error) {
        console.error("Error saving transaction:", error);
        return null;
    }
};


export const getUserTransactions = async (uid) => {
    if (!uid) return [];
    try {
        const transactionsRef = collection(db, "transactions");
        const q = query(transactionsRef, where("userId", "==", uid), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching user transactions:", error);
        return [];
    }
};

let globalSettingsCache = null;

export const getGlobalSettings = async () => {
    if (globalSettingsCache) {
        return globalSettingsCache;
    }

    try {
        const settingsRef = doc(db, "exchangeSettings", "currentGlobalRates");
        const docSnap = await getDoc(settingsRef);
        
        if (docSnap.exists()) {
            globalSettingsCache = docSnap.data();
            return globalSettingsCache;
        } else {
            console.error("CRITICAL: Global settings document ('currentGlobalRates') not found!");
            return null;
        }
    } catch (error) {
        console.error("Error fetching global settings:", error);
        return null;
    }
};

export { onAuthStateChanged, auth };
