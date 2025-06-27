// auth/rewards-script.js
// هذا الملف يحتوي على منطق واجهة المستخدم والمكافآت للمستخدم العادي
// (ليس لوحة تحكم المشرف)

import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    runTransaction,
    serverTimestamp,
    increment,
    limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// استيراد الدوال اللازمة من auth.js
import {
    protectPage, // لحماية الصفحة والتحقق من المصادقة
    getUserProfile, // لجلب بيانات ملف المستخدم (بما في ذلك completedTransactionsCount)
} from './auth.js';


// ==================================================
// --- State Variables ---
// متغيرات حالة يتم تعريفها في نطاق الموديل للاحتفاظ بالحالة
// ==================================================
let currentUser = null; // معلومات المستخدم الحالي المصادق عليه
let currentUserProfile = null; // بيانات ملف المستخدم من Firestore
let allRewards = []; // تخزين جميع تعريفات المكافآت النشطة التي تم جلبها
let userClaims = []; // تخزين مطالبات المكافآت الخاصة بالمستخدم الحالي
let isLoading = false; // لمنع المطالبة المتعددة أو التحميل أثناء الجلب


// ==================================================
// --- Element Selectors ---
// جلب العناصر التي سنتعامل معها في واجهة المستخدم
// ==================================================
const availableRewardsList = document.getElementById('availableRewardsList');
const claimedRewardsList = document.getElementById('claimedRewardsList');
const noAvailableRewardsMessage = document.getElementById('noAvailableRewardsMessage');
const noClaimedRewardsMessage = document.getElementById('noClaimedRewardsMessage');
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
    availableRewardsList.innerHTML = '';
    noAvailableRewardsMessage.style.display = 'none';

    if (!currentUser || !currentUserProfile || !allRewards) {
        return;
    }

    const fragment = document.createDocumentFragment();
    let hasAvailable = false;

    allRewards.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100)).forEach(reward => {
        if (!reward.isActive) return;

        const isEligible = checkEligibility(reward, currentUserProfile, userClaims);
        const userClaimedThisReward = userClaims.some(claim => claim.rewardId === reward.id);

        if (reward.claimLimitType === 'per_user' && typeof reward.claimLimitValue === 'number') {
            const userClaimsCount = userClaims.filter(claim => claim.rewardId === reward.id).length;
            if (userClaimsCount >= reward.claimLimitValue) {
                return;
            }
        } else if (userClaimedThisReward && reward.claimLimitType !== 'per_user') {
             return;
        }

        if (reward.claimLimitType === 'global' && typeof reward.claimLimitValue === 'number' && (reward.claimedCountGlobal ?? 0) >= reward.claimLimitValue) {
            return;
        }

        hasAvailable = true;
        const card = document.createElement('div');
        card.className = 'reward-card';

        let conditionHtml = '';
        if (reward.conditionType === 'transactions_count' && typeof reward.conditionValue === 'number') {
            const userCompletedTx = currentUserProfile.completedTransactionsCount || 0;
            const requiredTx = reward.conditionValue;
            const progress = Math.min(userCompletedTx, requiredTx);
            const percentage = requiredTx > 0 ? (progress / requiredTx) * 100 : 100;
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
            conditionHtml = `<div class="condition"><strong>الشرط:</strong> غير محدد.</div>`;
        }
        
        let importantInfoHtml = '';
        if (reward.importantInfoHtml && reward.importantInfoHtml.trim() !== '') {
            importantInfoHtml = `
                <div class="reward-info-toggle" data-reward-id="${reward.id}">
                    <span>معلومات هامة</span>
                    <box-icon name='chevron-down' class="toggle-icon"></box-icon>
                </div>
                <div class="reward-info-content" id="info-content-${reward.id}">
                    ${reward.importantInfoHtml}
                </div>
            `;
        }

        const buttonHtml = `
            <button class="claim-button" data-reward-id="${reward.id}" ${!isEligible ? 'disabled' : ''}>
                ${isEligible ? 'المطالبة بالمكافأة' : 'غير مؤهل حاليًا'}
            </button>
        `;

        card.innerHTML = `
            <h4><box-icon name='gift' type='solid' color='#5b3bb0'></box-icon> ${reward.name || 'مكافأة غير مسمى'}</h4>
            <div class="value">${reward.value || 'قيمة غير محددة'}</div>
            <p class="description">${reward.description || 'لا يوجد وصف.'}</p>
            
            <div class="reward-actions">
                ${conditionHtml}
                ${importantInfoHtml}
                ${buttonHtml}
            </div>
        `;

        const claimButton = card.querySelector('.claim-button');
        if (isEligible && reward.conditionType === 'manual') {
            claimButton.classList.add('manual-claim');
        }
        
        fragment.appendChild(card);
    });

    availableRewardsList.appendChild(fragment);

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
    claimedRewardsList.innerHTML = '';
    noClaimedRewardsMessage.style.display = 'none';

    if (!currentUser || !userClaims) {
        return;
    }

    if (userClaims.length === 0) {
        noClaimedRewardsMessage.style.display = 'block';
        return;
    }

    const fragment = document.createDocumentFragment();
    userClaims.sort((a, b) => (b.claimedAt?.seconds || 0) - (a.claimedAt?.seconds || 0)).forEach(claim => {
        const item = document.createElement('div');
        item.className = 'claimed-reward-item';
        
        const claimedDate = claim.claimedAt?.toDate() ? claim.claimedAt.toDate().toLocaleString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'غير متوفر';

        const originalReward = allRewards.find(r => r.id === claim.rewardId);
        let importantInfoHtml = '';
        if (originalReward && originalReward.importantInfoHtml && originalReward.importantInfoHtml.trim() !== '') {
            importantInfoHtml = `
                <div class="reward-info-toggle" data-claim-id="${claim.id}">
                    <span>معلومات هامة</span>
                    <box-icon name='chevron-down' class="toggle-icon"></box-icon>
                </div>
                <div class="reward-info-content" id="info-content-claimed-${claim.id}">
                    ${originalReward.importantInfoHtml}
                </div>
            `;
        }

        let codeHtml = '';
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
            ${importantInfoHtml}
            ${codeHtml}
        `;
        fragment.appendChild(item);
    });

    claimedRewardsList.appendChild(fragment);
    noClaimedRewardsMessage.style.display = 'none';
};


// ==================================================
// --- Eligibility Check Logic ---
// ==================================================
const checkEligibility = (reward, userProfile, userClaims) => {
    if (!userProfile) return false;

    let conditionMet = false;
    if (reward.conditionType === 'transactions_count' && typeof reward.conditionValue === 'number') {
        const userCompletedTx = userProfile.completedTransactionsCount || 0;
        conditionMet = userCompletedTx >= reward.conditionValue;
    } else if (reward.conditionType === 'manual') {
        conditionMet = true;
    }

    if (!conditionMet) return false;

    if (reward.claimLimitType === 'per_user' && typeof reward.claimLimitValue === 'number') {
        const userClaimsCount = userClaims.filter(claim => claim.rewardId === reward.id).length;
        if (userClaimsCount >= reward.claimLimitValue) {
             return false;
        }
    } else if (reward.claimLimitType !== 'per_user') {
         const userClaimedThisReward = userClaims.some(claim => claim.rewardId === reward.id);
         if (userClaimedThisReward) {
             return false;
         }
    }

    if (reward.claimLimitType === 'global' && typeof reward.claimLimitValue === 'number') {
         if ((reward.claimedCountGlobal ?? 0) >= reward.claimLimitValue) {
              return false;
         }
    }
    return true;
};


// ==================================================
// --- Claim Logic ---
// ==================================================
const handleClaimReward = async (rewardId) => {
    if (!currentUser || !currentUserProfile || isLoading) {
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
    if(claimButton) {
        claimButton.disabled = true;
        claimButton.textContent = 'جارٍ المطالبة...';
    }

    try {
        let claimedCode = null;
        let uniqueCodeId = null;

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
                throw new Error("No unique codes available for this reward.");
            }
            const codeDoc = availableCodesSnapshot.docs[0];
            uniqueCodeId = codeDoc.id;
            claimedCode = codeDoc.data().code;
        }

        await runTransaction(db, async (transaction) => {
            const rewardRef = doc(db, 'rewards', reward.id);
            const rewardDoc = await transaction.get(rewardRef);
            if (!rewardDoc.exists() || !rewardDoc.data().isActive) {
                 throw new Error("Reward not available or not active.");
            }
            const currentRewardData = rewardDoc.data();
            if (currentRewardData.claimLimitType === 'global' && typeof currentRewardData.claimLimitValue === 'number' && (currentRewardData.claimedCountGlobal ?? 0) >= currentRewardData.claimLimitValue) {
                 throw new Error("Claim limit reached.");
            }

            if (currentRewardData.rewardType === 'unique_code') {
                if (!uniqueCodeId) {
                    throw new Error("Code ID not found before transaction.");
                }
                const codeRef = doc(db, 'rewardCodes', uniqueCodeId);
                const codeDocInTransaction = await transaction.get(codeRef);
                if (!codeDocInTransaction.exists() || codeDocInTransaction.data().isClaimed) {
                    throw new Error("Code was just claimed. Please try again.");
                }
                transaction.update(codeRef, {
                    isClaimed: true,
                    claimedByUserId: currentUser.uid,
                    claimedAt: serverTimestamp()
                });
            } else if (currentRewardData.rewardType === 'fixed_code') {
                 claimedCode = currentRewardData.fixedCode || null;
            } else if (currentRewardData.rewardType === 'no_code') {
                 claimedCode = null;
            } else {
                throw new Error("Unknown reward type.");
            }

            if (currentRewardData.claimLimitType === 'global') {
                 transaction.update(rewardRef, {
                     claimedCountGlobal: increment(1)
                 });
            }
            
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

        await fetchUserRewardsAndRender();
        if(window.showToast) {
             window.showToast(`لقد حصلت على مكافأة: ${reward.name}!`, 'success');
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
        }
    } catch (error) {
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
         }
    } finally {
        isLoading = false;
        await fetchUserRewardsAndRender();
    }
};


// ==================================================
// --- Data Fetching ---
// ==================================================
const fetchAllRewards = async () => {
    availableRewardsList.innerHTML = '<p class="loading-message">جارٍ تحميل المكافآت المتاحة...</p>';
    noAvailableRewardsMessage.style.display = 'none';
    allRewards = [];

    try {
        const rewardsRef = collection(db, 'rewards');
        const q = query(rewardsRef, orderBy('sortOrder', 'asc'));
        const querySnapshot = await getDocs(q);
        allRewards = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching rewards:", error);
        availableRewardsList.innerHTML = '<p class="error-message">فشل تحميل المكافآت.</p>';
        allRewards = [];
    }
};

const fetchUserClaims = async (userId) => {
    claimedRewardsList.innerHTML = '<p class="loading-message">جارٍ تحميل المكافآت التي حصلت عليها...</p>';
    noClaimedRewardsMessage.style.display = 'none';
    userClaims = [];

    if (!userId) {
         claimedRewardsList.innerHTML = '<p class="error-message">لا يوجد مستخدم مسجل.</p>';
         return;
    }

    try {
        const userRewardsRef = collection(db, 'userRewards');
        const q = query(userRewardsRef, where('userId', '==', userId), orderBy('claimedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        userClaims = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching user claims:", error);
        claimedRewardsList.innerHTML = '<p class="error-message">فشل تحميل المكافآت التي حصلت عليها.</p>';
        userClaims = [];
    }
};

 const fetchUserRewardsAndRender = async () => {
     if (!currentUser) return;
     await fetchUserClaims(currentUser.uid);
     renderClaimedRewards();
     renderAvailableRewards();
 };


// ==================================================
// --- Initialization ---
// ==================================================
const initializePage = async () => {
    if (window.showPageSpinner) window.showPageSpinner();

    try {
        const user = await protectPage(true);
        if (!user) {
            return;
        }
        currentUser = user;

        currentUserProfile = await getUserProfile(currentUser.uid);
        currentUserProfile.completedTransactionsCount = currentUserProfile.completedTransactionsCount || 0;

        await fetchAllRewards();
        await fetchUserClaims(currentUser.uid);

        renderAvailableRewards();
        renderClaimedRewards();

        // ==================================================
        // --- Event Listeners ---
        // ==================================================
        availableRewardsList.addEventListener('click', (e) => {
            const claimButton = e.target.closest('.claim-button');
            const infoToggle = e.target.closest('.reward-info-toggle');

            if (claimButton && !claimButton.disabled) {
                const rewardId = claimButton.dataset.rewardId;
                if (rewardId) {
                    handleClaimReward(rewardId);
                }
            } 
            else if (infoToggle) {
                const rewardId = infoToggle.dataset.rewardId;
                const content = document.getElementById(`info-content-${rewardId}`);
                const icon = infoToggle.querySelector('.toggle-icon');
                if (content && icon) {
                    const isExpanded = content.classList.toggle('expanded');
                    icon.setAttribute('name', isExpanded ? 'chevron-up' : 'chevron-down');
                }
            }
        });

        claimedRewardsList.addEventListener('click', (e) => {
             const copyBtn = e.target.closest('.copy-code-btn');
             const infoToggle = e.target.closest('.reward-info-toggle');

             if (copyBtn) {
                 const codeToCopy = copyBtn.dataset.code;
                 if(codeToCopy) {
                      navigator.clipboard.writeText(codeToCopy)
                        .then(() => {
                            if(window.showToast) {
                                window.showToast("تم نسخ الكود بنجاح!", 'success');
                            }
                        })
                        .catch(err => {
                            console.error('Failed to copy code: ', err);
                            if(window.showToast) {
                                window.showToast('فشل النسخ. يرجى النسخ يدويًا.', 'error', 3000);
                            }
                        });
                 }
             } else if (infoToggle) {
                 const claimId = infoToggle.dataset.claimId;
                 const content = document.getElementById(`info-content-claimed-${claimId}`);
                 const icon = infoToggle.querySelector('.toggle-icon');
                 if (content && icon) {
                     const isExpanded = content.classList.toggle('expanded');
                     icon.setAttribute('name', isExpanded ? 'chevron-up' : 'chevron-down');
                 }
             }
        });
    } catch (error) {
        console.error("Error initializing rewards page:", error);
        showMessage("حدث خطأ أثناء تحميل صفحة المكافآت.", true);
        availableRewardsList.innerHTML = '<p class="error-message">فشل تحميل المكافآت المتاحة.</p>';
        claimedRewardsList.innerHTML = '<p class="error-message">فشل تحميل المكافآت التي حصلت عليها.</p>';
    } finally {
        if (window.hidePageSpinner) window.hidePageSpinner();
    }
};

// بدء عملية تهيئة الصفحة عند تحميل DOM بالكامل
initializePage();
