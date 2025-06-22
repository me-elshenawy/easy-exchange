// auth/rewards-script.js
// هذا الملف يحتوي على منطق واجهة المستخدم والمكافآت للمستخدم العادي
// (ليس لوحة تحكم المشرف)

import { auth, db } from './firebase-config.js';
import {
    // الدوال التالية يتم استيرادها واستخدامها في auth.js وليس هنا مباشرة
    // createUserWithEmailAndPassword,
    // sendEmailVerification,
    // signInWithEmailAndPassword,
    // signOut,
    onAuthStateChanged, // قد نحتاج لها إذا أردنا الاستماع لتغييرات حالة المصادقة هنا
    // updateProfile,
    // sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    runTransaction, // تستخدم لمعالجة عمليات المطالبة بالأكواد الفريدة بشكل آمن
    serverTimestamp, // للحصول على الطابع الزمني من الخادم
    increment, // لزيادة العدد (مثلاً claimedCountGlobal)
    limit, // <--- تأكد أنها موجودة
    // arrayUnion // قد نحتاج لها في تحديثات أخرى، ليست ضرورية للمكافآت هنا
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// استيراد الدوال اللازمة من auth.js
import {
    protectPage, // لحماية الصفحة والتحقق من المصادقة
    getUserProfile, // لجلب بيانات ملف المستخدم (بما في ذلك completedTransactionsCount)
    // أضف هنا أي دوال أخرى قد تحتاجها عالمياً من auth.js
} from './auth.js';


// ==================================================
// --- State Variables ---
// متغيرات حالة يتم تعريفها في نطاق الموديل للاحتفاظ بالحالة
// ==================================================
let currentUser = null; // معلومات المستخدم الحالي المصادق عليه
let currentUserProfile = null; // بيانات ملف المستخدم من Firestore
let allRewards = []; // تخزين جميع تعريفات المكافآت النشطة التي تم جلبها
let userClaims = []; // تخزين مطالبات المكافآت الخاصة بالمستخدم الحالي
let isLoading = false; // <-- **متغير الحالة لمنع المطالبة المتعددة أو التحميل أثناء الجلب**


// ==================================================
// --- Element Selectors ---
// جلب العناصر التي سنتعامل معها في واجهة المستخدم
// ==================================================
const availableRewardsList = document.getElementById('availableRewardsList');
const claimedRewardsList = document.getElementById('claimedRewardsList');
const noAvailableRewardsMessage = document.getElementById('noAvailableRewardsMessage');
const noClaimedRewardsMessage = document.getElementById('noClaimedRewardsMessage');
// Assumes messageBoxGlobal is defined in auth/rewards.html
const globalMessageBox = document.getElementById('messageBoxGlobal');


// ==================================================
// --- UI Rendering Functions ---
// دوال لعرض البيانات وتحديث واجهة المستخدم
// ==================================================

/**
 * يعرض رسالة في صندوق الرسائل العام بالصفحة.
 * @param {string} message - نص الرسالة.
 * @param {boolean} [isError=false] - هل الرسالة خطأ؟ (لتحديد اللون)
 */
const showMessage = (message, isError = false) => {
    if (!globalMessageBox) return;
    globalMessageBox.textContent = message;
    globalMessageBox.className = `message-feedback ${isError ? 'error' : 'success'}`;
    globalMessageBox.style.display = 'block';
    // إخفاء الرسالة بعد بضع ثوانٍ إذا لم تكن خطأ
    if (!isError) {
        setTimeout(() => {
            globalMessageBox.style.display = 'none';
        }, 5000);
    }
};

/**
 * يرسم بطاقات المكافآت المتاحة بناءً على حالة المستخدم والمكافآت المحملة.
 */
const renderAvailableRewards = () => {
    availableRewardsList.innerHTML = ''; // مسح محتوى التحميل أو المحتوى السابق
    noAvailableRewardsMessage.style.display = 'none';

    // لا تعرض شيئاً إذا لم يتم تحميل البيانات الأساسية بعد
    if (!currentUser || !currentUserProfile || !allRewards) {
         // يمكن هنا عرض رسالة "جارٍ التحميل..." إذا لم تكن موجودة بالفعل في HTML
        return;
    }

    const fragment = document.createDocumentFragment();
    let hasAvailable = false; // تتبع ما إذا كان هناك أي مكافآت مؤهلة للعرض


    // فرز المكافآت حسب sortOrder قبل العرض
    allRewards.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100)).forEach(reward => {
        // تجاهل المكافآت غير النشطة
        if (!reward.isActive) return;

        // تحقق من الأهلية بناءً على بيانات المستخدم والمطالبات
        const isEligible = checkEligibility(reward, currentUserProfile, userClaims);
        // تحقق مما إذا كان المستخدم قد طالب بالمكافأة بالفعل
        const userClaimedThisReward = userClaims.some(claim => claim.rewardId === reward.id);

        // لا تعرض المكافأة في قائمة "المتاحة" إذا كان المستخدم قد طالب بها بالفعل
        // وكان نوع حد المطالبة هو "لكل مستخدم" وقد وصل للحد الأقصى
        if (reward.claimLimitType === 'per_user' && typeof reward.claimLimitValue === 'number') {
            const userClaimsCount = userClaims.filter(claim => claim.rewardId === reward.id).length;
            if (userClaimsCount >= reward.claimLimitValue) {
                // المستخدم وصل للحد الأقصى المسموح به لهذه المكافأة
                return;
            }
        } else if (userClaimedThisReward && reward.claimLimitType !== 'per_user') {
             // المستخدم طالب بها بالفعل والحد ليس "لكل مستخدم" (يعني حد إجمالي أو لا يوجد حد)
             // في هذه الحالة لا تعرضها مرة أخرى في قائمة "المتاحة"
             return;
        }

        // تحقق من الحد الأقصى الإجمالي (فقط للعرض الأولي، التحقق النهائي يكون في المعاملة)
         if (reward.claimLimitType === 'global' && typeof reward.claimLimitValue === 'number' && (reward.claimedCountGlobal ?? 0) >= reward.claimLimitValue) {
              // تم الوصول للحد الأقصى الإجمالي (عرض تقريبي)
              return;
         }


        hasAvailable = true; // توجد مكافأة واحدة على الأقل سيتم عرضها
        const card = document.createElement('div');
        card.className = 'reward-card';

        let conditionHtml = '';
        if (reward.conditionType === 'transactions_count' && typeof reward.conditionValue === 'number') {
            const userCompletedTx = currentUserProfile.completedTransactionsCount || 0;
            const requiredTx = reward.conditionValue;
            const progress = Math.min(userCompletedTx, requiredTx);
            const percentage = requiredTx > 0 ? (progress / requiredTx) * 100 : 100; // تجنب القسمة على صفر
            conditionHtml = `
                <div class="condition">
                    <strong>الشرط:</strong> أكمل ${requiredTx} عملية تبادل ناجحة<br>
                    التقدم: ${progress} / ${requiredTx} ${reward.conditionUnit || ''}
                    <div class="progress-bar"><div class="progress-bar-fill" style="width: ${percentage}%;"></div></div>
                </div>
            `;
        } else if (reward.conditionType === 'manual') {
             conditionHtml = `<div class="condition"><strong>الشرط:</strong> متاح للمطالبة الآن.</div>`;
        } else {
             // Handle other condition types or show a default
            conditionHtml = `<div class="condition"><strong>الشرط:</strong> غير محدد.</div>`;
        }


        const button = document.createElement('button');
        button.className = 'claim-button';
        button.textContent = isEligible ? 'المطالبة بالمكافأة' : 'غير مؤهل حاليًا';
        button.disabled = !isEligible;
        // إضافة كلاس خاص لتمييز زر المطالبة اليدوية
        if(reward.conditionType === 'manual' && isEligible) {
             button.classList.add('manual-claim');
        }
        button.dataset.rewardId = reward.id;
        // لا نحتاج لتخزين الاسم والقيمة في dataset لأننا سنجلب كائن المكافأة من allRewardsData باستخدام rewardId


        card.innerHTML = `
            <h4><box-icon name='gift' type='solid' color='#5b3bb0'></box-icon> ${reward.name || 'مكافأة غير مسمى'}</h4>
            <div class="value">${reward.value || 'قيمة غير محددة'}</div>
            <p class="description">${reward.description || 'لا يوجد وصف.'}</p>
            ${conditionHtml}
        `;
        card.appendChild(button);
        fragment.appendChild(card);
    });

    availableRewardsList.appendChild(fragment);

    // عرض رسالة "لا توجد مكافآت متاحة" إذا لم يتم عرض أي بطاقة
    if (!hasAvailable) {
        noAvailableRewardsMessage.style.display = 'block';
    } else {
        noAvailableRewardsMessage.style.display = 'none';
    }
};

/**
 * يرسم قائمة المكافآت التي طالب بها المستخدم.
 */
const renderClaimedRewards = () => {
    claimedRewardsList.innerHTML = ''; // مسح محتوى التحميل أو المحتوى السابق
    noClaimedRewardsMessage.style.display = 'none';

    // لا تعرض شيئاً إذا لم يتم تحميل البيانات الأساسية بعد
    if (!currentUser || !userClaims) {
        // يمكن هنا عرض رسالة "جارٍ التحميل..."
        return;
    }

    // عرض رسالة "لم يحصل على مكافآت" إذا كانت قائمة المطالبات فارغة
    if (userClaims.length === 0) {
        noClaimedRewardsMessage.style.display = 'block';
        return;
    }

    const fragment = document.createDocumentFragment();
    // فرز المطالبات حسب تاريخ المطالبة (الأحدث أولاً)
    userClaims.sort((a, b) => (b.claimedAt?.seconds || 0) - (a.claimedAt?.seconds || 0)).forEach(claim => {
        const item = document.createElement('div');
        item.className = 'claimed-reward-item';

        // تنسيق تاريخ المطالبة
        const claimedDate = claim.claimedAt?.toDate() ? claim.claimedAt.toDate().toLocaleString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'غير متوفر';

        let codeHtml = '';
        // عرض الكود إذا كان موجوداً مع زر النسخ
        if (claim.claimedCode) {
             codeHtml = `
                <div class="code-info">
                    <strong>الكود:</strong>
                    <span class="code-display">${claim.claimedCode}</span>
                    <button class="copy-code-btn" title="نسخ الكود" data-code="${claim.claimedCode}">
                        <box-icon name='copy' size='xs'></box-icon>
                    </button>
                </div>
             `;
        }


        item.innerHTML = `
            <div class="details">
                <span>المكافأة: <strong>${claim.rewardName || 'مكافأة غير معروفة'}</strong></span>
                <span>القيمة: <strong>${claim.claimedValue || 'قيمة غير محددة'}</strong></span>
                <span>تاريخ المطالبة: ${claimedDate}</span>
            </div>
            ${codeHtml}
        `;
        fragment.appendChild(item);
    });

    claimedRewardsList.appendChild(fragment);
    // إخفاء رسالة "لم يحصل على مكافآت" إذا تم عرض عناصر
     noClaimedRewardsMessage.style.display = 'none';
};


// ==================================================
// --- Eligibility Check Logic ---
// دالة للتحقق مما إذا كان المستخدم مؤهلاً للمطالبة بمكافأة معينة
// ==================================================

/**
 * يتحقق مما إذا كان المستخدم مؤهلاً للمطالبة بمكافأة معينة.
 * يتم استخدام البيانات المحلية المحملة (userProfile, userClaims).
 * هذا التحقق هو للعرض الأولي للأهلية في الواجهة فقط، التحقق النهائي يتم في المعاملة على Firebase.
 * @param {object} reward - كائن المكافأة من مجموعة 'rewards'.
 * @param {object} userProfile - كائن ملف المستخدم من مجموعة 'users'.
 * @param {Array} userClaims - مصفوفة مطالبات المستخدم من مجموعة 'userRewards'.
 * @returns {boolean} - true إذا كان المستخدم مؤهلاً، false بخلاف ذلك.
 */
const checkEligibility = (reward, userProfile, userClaims) => {
    // يجب أن يكون هناك مستخدم وبيانات ملفه
    if (!userProfile) return false;

    // 1. التحقق من الشرط (Condition)
    let conditionMet = false;
    if (reward.conditionType === 'transactions_count' && typeof reward.conditionValue === 'number') {
        // تحقق من عدد العمليات المكتملة للمستخدم
        const userCompletedTx = userProfile.completedTransactionsCount || 0;
        conditionMet = userCompletedTx >= reward.conditionValue;
    } else if (reward.conditionType === 'manual') {
        // الشرط اليدوي يعني أن الشرط محقق طالما المكافأة نشطة ويمكن المطالبة بها بناءً على الحدود
        conditionMet = true;
    }
     // TODO: أضف منطق للتحقق من أنواع الشروط الأخرى هنا (مثال: 'referral')

    // إذا لم يتم استيفاء الشرط، فالمستخدم غير مؤهل
    if (!conditionMet) return false;

    // 2. التحقق من الحد الأقصى للمطالبات لكل مستخدم (per_user claim limit)
    if (reward.claimLimitType === 'per_user' && typeof reward.claimLimitValue === 'number') {
        // حساب عدد المرات التي طالب فيها المستخدم الحالي بهذه المكافأة
        const userClaimsCount = userClaims.filter(claim => claim.rewardId === reward.id).length;
        if (userClaimsCount >= reward.claimLimitValue) {
             // console.log(`User already claimed max allowed (${reward.claimLimitValue}) for reward ${reward.name}`);
             return false; // المستخدم وصل للحد الأقصى المسموح به
        }
    } else if (reward.claimLimitType !== 'per_user') {
        // إذا لم يكن الحد لكل مستخدم، فتحقق مما إذا كان قد طالب بها بالفعل مرة واحدة (إذا كان نوع الحد ليس per_user فالمطالبة لمرة واحدة فقط)
         const userClaimedThisReward = userClaims.some(claim => claim.rewardId === reward.id);
         if (userClaimedThisReward) {
              // console.log(`User already claimed reward ${reward.name} (not per_user limit type)`);
             return false;
         }
    }


    // 3. التحقق من الحد الأقصى الإجمالي للمطالبات (Global claim limit)
    // هذا تحقق أمامي (Frontend check) وقد يكون غير دقيق تماماً لحظة المطالبة الفعلية.
    // التحقق النهائي والحاسم يتم داخل الـ Transaction على Firebase.
    if (reward.claimLimitType === 'global' && typeof reward.claimLimitValue === 'number') {
         if ((reward.claimedCountGlobal ?? 0) >= reward.claimLimitValue) {
              // console.log(`Global claim limit reached for reward ${reward.name} (frontend check)`);
              return false; // تم الوصول للحد الأقصى الإجمالي
         }
    }

    // 4. إذا كان نوع المكافأة يتطلب أكواد فريدة، لا يمكننا التحقق من توفر الأكواد هنا بكفاءة
    // التحقق من توفر الأكواد يتم داخل الـ Transaction على Firebase
    // لذلك، إذا اجتاز جميع الشروط والحدود الأخرى (المتاحة للتحقق أمامياً)، نعتبره مؤهلاً أمامياً
    // وزر المطالبة سيظهر، ولكن قد يفشل في النهاية إذا لم يتوفر كود

    // إذا اجتاز جميع الشروط والحدود المعروفة أماميًا
    return true;
};


// ==================================================
// --- Claim Logic ---
// دالة للتعامل مع عملية المطالبة بمكافأة
// ==================================================

/**
 * يتعامل مع النقر على زر المطالبة بالمكافأة.
 * يستخدم Firebase Transactions لضمان الأمان والدقة، خاصة مع الأكواد الفريدة.
 * @param {string} rewardId - معرف المكافأة المراد المطالبة بها.
 */
const handleClaimReward = async (rewardId) => {
    if (!currentUser || !currentUserProfile || isLoading) {
         console.log("Claim aborted: user, profile not loaded, or already loading.", {user: !!currentUser, profile: !!currentUserProfile, isLoading});
         return;
    }
    isLoading = true;
    const reward = allRewards.find(r => r.id === rewardId);
    if (!reward) {
        showMessage("خطأ: لم يتم العثور على تفاصيل المكافأة.", true);
        isLoading = false;
        return;
    }
    const claimButton = availableRewardsList.querySelector(`button[data-reward-id="${rewardId}"]`);
    const originalButtonText = claimButton?.textContent || 'المطالبة بالمكافأة';
    if(claimButton) {
        claimButton.disabled = true;
        claimButton.textContent = 'جارٍ المطالبة...';
    }

    try {
        let claimedCode = null;
        let uniqueCodeId = null; // لتخزين معرف مستند الكود الفريد

         // === التعديل هنا: البحث عن الكود خارج المعاملة ===
        if (reward.rewardType === 'unique_code') {
            const codesRef = collection(db, 'rewardCodes');
            const availableCodeQuery = query(
                codesRef,
                where('rewardId', '==', reward.id),
                where('isClaimed', '==', false),
                orderBy('createdAt', 'asc'),
                limit(1)
            );
            const availableCodesSnapshot = await getDocs(availableCodeQuery);

            if (availableCodesSnapshot.empty) {
                // لا توجد أكواد متاحة، لا حاجة لبدء المعاملة
                throw new Error("No unique codes available for this reward.");
            }

            const codeDoc = availableCodesSnapshot.docs[0];
            uniqueCodeId = codeDoc.id; // نحتفظ بالمعرف
            claimedCode = codeDoc.data().code; // نحتفظ بقيمة الكود
        }
        // === نهاية التعديل ===


        await runTransaction(db, async (transaction) => {
            // قراءة مستند المكافأة للتأكد من حالتها النهائية
            const rewardRef = doc(db, 'rewards', reward.id);
            const rewardDoc = await transaction.get(rewardRef);
            if (!rewardDoc.exists() || !rewardDoc.data().isActive) {
                 throw new Error("Reward not available or not active.");
            }
            const currentRewardData = rewardDoc.data();
            if (currentRewardData.claimLimitType === 'global' && typeof currentRewardData.claimLimitValue === 'number' && (currentRewardData.claimedCountGlobal ?? 0) >= currentRewardData.claimLimitValue) {
                 throw new Error("Claim limit reached.");
            }

            // معالجة نوع المكافأة داخل المعاملة
            if (currentRewardData.rewardType === 'unique_code') {
                if (!uniqueCodeId) {
                    // هذا لا يجب أن يحدث إذا كان المنطق الخارجي صحيحاً، لكنه فحص أمان
                    throw new Error("Code ID not found before transaction.");
                }
                const codeRef = doc(db, 'rewardCodes', uniqueCodeId);
                const codeDocInTransaction = await transaction.get(codeRef);

                // التحقق الحاسم: هل الكود لا يزال متاحاً؟
                if (!codeDocInTransaction.exists() || codeDocInTransaction.data().isClaimed) {
                     // هذا يعني أن مستخدماً آخر طالب بهذا الكود في اللحظة الفاصلة
                    throw new Error("Code was just claimed. Please try again.");
                }

                // تحديث مستند الكود
                transaction.update(codeRef, {
                    isClaimed: true,
                    claimedByUserId: currentUser.uid,
                    claimedAt: serverTimestamp()
                });
                // قيمة الكود (claimedCode) تم الحصول عليها بالفعل خارج المعاملة

            } else if (currentRewardData.rewardType === 'fixed_code') {
                 claimedCode = currentRewardData.fixedCode || null;
            } else if (currentRewardData.rewardType === 'no_code') {
                 claimedCode = null;
            } else {
                throw new Error("Unknown reward type.");
            }

            // زيادة العداد الإجمالي إذا كان نوع الحد إجمالياً
            if (currentRewardData.claimLimitType === 'global') {
                 transaction.update(rewardRef, {
                     claimedCountGlobal: increment(1)
                 });
            }
            
            // إنشاء سجل المطالبة للمستخدم
            const newUserRewardRef = doc(collection(db, 'userRewards'));
            transaction.set(newUserRewardRef, {
                userId: currentUser.uid,
                rewardId: reward.id,
                rewardName: currentRewardData.name,
                claimedValue: currentRewardData.value,
                rewardType: currentRewardData.rewardType,
                claimedCode: claimedCode,
                claimedAt: serverTimestamp()
            });
        });

        // إذا نجحت المعاملة
        await fetchUserRewardsAndRender();
        if(window.showToast) {
             window.showToast(`لقد حصلت على مكافأة: ${reward.name}!`, 'success');
        } else {
             alert(`لقد حصلت على مكافأة: ${reward.name}!`);
        }
        let modalMessage = `<p>لقد نجحت في المطالبة بمكافأة <strong>${reward.name}</strong> بقيمة <strong>${reward.value}</strong>.</p>`;
        if (claimedCode) {
            modalMessage += `<p>استخدم الكود التالي:</p><div style="background-color: #f0f0f0; padding: 10px; border-radius: 8px; text-align: center; font-weight: 700; font-family: monospace; font-size: 1.1em; margin-top: 15px;">${claimedCode}</div>`;
        } else {
             modalMessage += `<p>تم تطبيق المكافأة على حسابك.</p>`;
        }
        if(window.showInfoModal) {
             await window.showInfoModal({
                 title: 'تم الحصول على المكافأة!',
                 message: modalMessage,
                 confirmText: 'حسناً',
                 iconName: 'gift',
                 iconColor: 'var(--success-color)'
             });
        } else {
             alert("تم الحصول على المكافأة! " + (claimedCode ? `الكود: ${claimedCode}` : ""));
        }
    } catch (error) {
        // معالجة الأخطاء
        console.error("Claim failed:", error);
        let userMessage = "فشل المطالبة بالمكافأة. يرجى المحاولة مرة أخرى.";
        if (error.message.includes("Claim limit reached")) {
            userMessage = "لا يمكن المطالبة بهذه المكافأة حاليًا. لقد تم الوصول للحد الأقصى.";
        } else if (error.message.includes("No unique codes available")) {
             userMessage = "آسفون، نفدت الأكواد لهذه المكافأة حاليًا. يرجى المحاولة لاحقًا.";
        } else if (error.message.includes("Code was just claimed")) {
            userMessage = "آسفون، لقد طالب مستخدم آخر بهذا الكود للتو. الرجاء محاولة المطالبة مرة أخرى للحصول على كود جديد.";
        } else if (error.message.includes("Reward not available")) {
             userMessage = "المكافأة غير متاحة حاليًا.";
        }
         if(window.showToast) {
             window.showToast(userMessage, 'error');
         } else {
             alert("خطأ: " + userMessage);
         }
    } finally {
        isLoading = false;
        // الزر سيتم تحديثه بواسطة renderAvailableRewards، لذلك لا حاجة لإعادة تمكينه يدوياً هنا
        // لأننا سنقوم بجلب البيانات وتحديث الواجهة بعد كل محاولة
        await fetchUserRewardsAndRender();
    }
};


// ==================================================
// --- Data Fetching ---
// دوال لجلب البيانات من Firebase
// ==================================================

/**
 * يجلب جميع تعريفات المكافآت النشطة من مجموعة 'rewards'.
 */
const fetchAllRewards = async () => {
    // عرض رسالة تحميل في قائمة المكافآت المتاحة
    availableRewardsList.innerHTML = '<p class="loading-message">جارٍ تحميل المكافآت المتاحة...</p>';
    noAvailableRewardsMessage.style.display = 'none'; // إخفاء رسالة "لا توجد" أثناء التحميل
    allRewards = []; // مسح البيانات المخزنة مؤقتاً

    try {
        const rewardsRef = collection(db, 'rewards');
        // جلب جميع المكافآت مع فرزها حسب sortOrder
        const q = query(rewardsRef, orderBy('sortOrder', 'asc')); // جلب الجميع، الفلترة للنشط تتم أثناء العرض
        const querySnapshot = await getDocs(q);
        allRewards = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() // تضمين claimedCountGlobal هنا
        }));
        // console.log("Fetched rewards:", allRewards); // للتتبع

    } catch (error) {
        console.error("Error fetching rewards:", error);
        availableRewardsList.innerHTML = '<p class="error-message">فشل تحميل المكافآت.</p>';
        allRewards = []; // التأكد من أن allRewards فارغة في حالة الخطأ
    }
};

/**
 * يجلب جميع مطالبات المكافآت للمستخدم الحالي من مجموعة 'userRewards'.
 * @param {string} userId - معرف المستخدم الحالي.
 */
const fetchUserClaims = async (userId) => {
    // عرض رسالة تحميل في قائمة المكافآت التي حصل عليها المستخدم
    claimedRewardsList.innerHTML = '<p class="loading-message">جارٍ تحميل المكافآت التي حصلت عليها...</p>';
    noClaimedRewardsMessage.style.display = 'none'; // إخفاء رسالة "لا توجد" أثناء التحميل
    userClaims = []; // مسح البيانات المخزنة مؤقتاً

    if (!userId) {
         claimedRewardsList.innerHTML = '<p class="error-message">لا يوجد مستخدم مسجل.</p>';
         return;
    }

    try {
        const userRewardsRef = collection(db, 'userRewards');
        // جلب مطالبات المستخدم الحالي وفرزها حسب تاريخ المطالبة (الأحدث أولاً)
        const q = query(userRewardsRef, where('userId', '==', userId), orderBy('claimedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        userClaims = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() // يشمل claimedCode
        }));
        // console.log("Fetched user claims:", userClaims); // للتتبع

    } catch (error) {
        console.error("Error fetching user claims:", error);
        claimedRewardsList.innerHTML = '<p class="error-message">فشل تحميل المكافآت التي حصلت عليها.</p>';
        userClaims = []; // التأكد من أن userClaims فارغة في حالة الخطأ
    }
};

/**
 * دالة مجمعة لجلب مطالبات المستخدم وإعادة رسم القوائم.
 * تُستخدم بعد نجاح عملية المطالبة لتحديث الواجهة.
 */
 const fetchUserRewardsAndRender = async () => {
     if (!currentUser) return;
     await fetchUserClaims(currentUser.uid); // جلب المطالبات المحدثة
     renderClaimedRewards(); // إعادة رسم قائمة المطالبات
     renderAvailableRewards(); // إعادة رسم قائمة المكافآت المتاحة (لتحديث حالة الأهلية/الأزرار)
 };


// ==================================================
// --- Initialization ---
// دالة تهيئة الصفحة عند التحميل
// ==================================================

const initializePage = async () => {
    // إظهار شاشة التحميل الكاملة (Assumes window.showPageSpinner is available from script.js)
    if (window.showPageSpinner) window.showPageSpinner();

    try {
        // حماية الصفحة والتأكد من تسجيل دخول المستخدم والتحقق من بريده الإلكتروني
        // protectPage تقوم بالتحقق وتوجيه المستخدم إذا لم يكن مؤهلاً
        const user = await protectPage(true);
        if (!user) {
            // protectPage ستقوم بتوجيه المستخدم، لا حاجة للمزيد هنا
            return;
        }
        currentUser = user; // تعيين المستخدم الحالي

        // جلب ملف المستخدم للحصول على معلومات مثل completedTransactionsCount
        currentUserProfile = await getUserProfile(currentUser.uid);
        // تأكد أن العداد موجود على الأقل كـ 0 إذا لم يكن موجوداً
        currentUserProfile.completedTransactionsCount = currentUserProfile.completedTransactionsCount || 0;
        // console.log("Current User Profile:", currentUserProfile); // للتتبع

        // جلب جميع المكافآت وتعريفاتها
        await fetchAllRewards();
        // جلب مطالبات المكافآت الخاصة بالمستخدم الحالي
        await fetchUserClaims(currentUser.uid);

        // بعد جلب جميع البيانات، قم برسم الواجهة
        renderAvailableRewards();
        renderClaimedRewards();


        // ==================================================
        // --- Event Listeners ---
        // ربط معالجات الأحداث بالعناصر
        // ==================================================

        // ربط معالج النقر على زر المطالبة (باستخدام Event Delegation على قائمة المكافآت المتاحة)
        availableRewardsList.addEventListener('click', (e) => {
            // تحقق مما إذا كان العنصر الذي تم النقر عليه أو أحد آبائه هو زر المطالبة وغير معطل
            const claimButton = e.target.closest('.claim-button');
            if (claimButton && !claimButton.disabled) {
                const rewardId = claimButton.dataset.rewardId;
                if (rewardId) {
                    // استدعاء دالة معالجة المطالبة
                    handleClaimReward(rewardId); // فقط نمرر الـ ID
                }
            }
        });

        // ربط معالج النقر على زر نسخ الكود (باستخدام Event Delegation على قائمة المكافآت التي تم المطالبة بها)
        claimedRewardsList.addEventListener('click', (e) => {
             // تحقق مما إذا كان العنصر الذي تم النقر عليه أو أحد آبائه هو زر النسخ
             const copyBtn = e.target.closest('.copy-code-btn');
             if(copyBtn) {
                 const codeToCopy = copyBtn.dataset.code;
                 if(codeToCopy) {
                     // استخدام API المتصفح لنسخ النص إلى الحافظة
                      navigator.clipboard.writeText(codeToCopy)
                        .then(() => {
                            // عرض رسالة تأكيد للنجاح (Assumes window.showToast is available)
                            if(window.showToast) {
                                window.showToast("تم نسخ الكود بنجاح!", 'success');
                            } else {
                                console.warn("window.showToast is not available.");
                                alert("تم نسخ الكود بنجاح!");
                            }
                        })
                        .catch(err => {
                            console.error('Failed to copy code: ', err);
                            // عرض رسالة خطأ إذا فشل النسخ (Assumes window.showToast is available)
                            if(window.showToast) {
                                window.showToast('فشل النسخ. يرجى النسخ يدويًا.', 'error', 3000);
                            } else {
                                alert('فشل النسخ. يرجى النسخ يدويًا.');
                            }
                        });
                 }
             }
        });


    } catch (error) {
        // معالجة الأخطاء العامة التي قد تحدث أثناء تهيئة الصفحة
        console.error("Error initializing rewards page:", error);
        showMessage("حدث خطأ أثناء تحميل صفحة المكافآت.", true); // عرض رسالة خطأ للمستخدم
        // عرض رسائل خطأ في قوائم المكافآت بدلاً من رسائل التحميل الأولية
        availableRewardsList.innerHTML = '<p class="error-message">فشل تحميل المكافآت المتاحة.</p>';
        claimedRewardsList.innerHTML = '<p class="error-message">فشل تحميل المكافآت التي حصلت عليها.</p>';
    } finally {
        // إخفاء شاشة التحميل الكاملة دائماً بعد محاولة التهيئة
        if (window.hidePageSpinner) window.hidePageSpinner();
    }
};

// بدء عملية تهيئة الصفحة عند تحميل DOM بالكامل
initializePage();