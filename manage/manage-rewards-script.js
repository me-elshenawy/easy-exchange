// manage/manage-rewards-script.js
import { db } from '../auth/firebase-config.js';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    orderBy,
    query,
    where,
    getDoc,
    setDoc,
    serverTimestamp,
    runTransaction, 
    writeBatch, 
    increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {

    const rewardsTableBody = document.getElementById('rewards-table-body');
    const rewardsTable = document.getElementById('rewards-table');
    const rewardsLoadingMsg = document.getElementById('rewards-loading');
    const noRewardsMessage = document.getElementById('no-rewards-message');
    const addNewRewardBtn = document.getElementById('add-new-reward-btn');

    const rewardModal = document.getElementById('reward-modal');
    const rewardModalTitle = document.getElementById('reward-modal-title');
    const rewardForm = document.getElementById('reward-form');
    const rewardDocumentIdInput = document.getElementById('reward-document-id');
    const rewardNameInput = document.getElementById('reward-name');
    const rewardValueInput = document.getElementById('reward-value');
    const rewardDescriptionInput = document.getElementById('reward-description');
    const rewardTypeSelect = document.getElementById('reward-type');
    const fixedCodeGroup = document.getElementById('fixed-code-group');
    const fixedCodeInput = document.getElementById('fixed-code');
    const conditionTypeSelect = document.getElementById('condition-type');
    const conditionValueGroup = document.getElementById('condition-value-group');
    const conditionValueInput = document.getElementById('condition-value');
    const conditionUnitGroup = document.getElementById('condition-unit-group');
    const conditionUnitInput = document.getElementById('condition-unit');
    const claimLimitTypeSelect = document.getElementById('claim-limit-type');
    const claimLimitValueGroup = document.getElementById('claim-limit-value-group');
    const claimLimitValueInput = document.getElementById('claim-limit-value');
    const rewardIsActiveCheckbox = document.getElementById('reward-is-active');
    const rewardSortOrderInput = document.getElementById('reward-sort-order');
    const rewardModalMessage = document.getElementById('reward-modal-message');
    
    // === MODIFIED: Added new element selectors for the important info fields ===
    const rewardHasInfoCheckbox = document.getElementById('reward-has-info');
    const importantInfoGroup = document.getElementById('important-info-group');
    const rewardImportantInfoTextarea = document.getElementById('reward-important-info');


    const manageCodesModal = document.getElementById('manage-codes-modal');
    const rewardNameForCodesSpan = document.getElementById('reward-name-for-codes');
    const rewardIdForCodesInput = document.getElementById('reward-id-for-codes');
    const newCodesTextarea = document.getElementById('new-codes-textarea');
    const addCodesBtn = document.getElementById('add-codes-btn');
    const addCodesMessage = document.getElementById('add-codes-message');
    const codeStatusFilterSelect = document.getElementById('code-status-filter');
    const codesTableBody = document.getElementById('codes-table-body');
    const codesTable = document.getElementById('codes-table');
    const codesLoadingMsg = document.getElementById('codes-loading');
    const noCodesMessage = document.getElementById('no-codes-message');

    const userClaimsTableBody = document.getElementById('user-claims-table-body');
    const userClaimsTable = document.getElementById('user-claims-table');
    const userClaimsLoadingMsg = document.getElementById('user-claims-loading');
    const noUserClaimsMessage = document.getElementById('no-user-claims-message');

    let allRewardsData = [];
    let allUserClaimsData = [];
    let currentCodesForManage = []; 


    // --- Helper Functions ---
    const showModal = (modalElement) => { modalElement.classList.add('show'); document.getElementById('overlay').classList.add('active'); };
    const hideModal = (modalElement) => { modalElement.classList.remove('show'); document.getElementById('overlay').classList.remove('active'); };
    const formatDate = (firebaseTimestamp) => {
        if (!firebaseTimestamp || typeof firebaseTimestamp.toDate !== 'function') return 'N/A';
        return firebaseTimestamp.toDate().toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
    };

    const toggleRewardFields = () => {
        const rewardType = rewardTypeSelect.value;
        fixedCodeGroup.style.display = rewardType === 'fixed_code' ? 'block' : 'none';
        fixedCodeInput.required = rewardType === 'fixed_code';

        const conditionType = conditionTypeSelect.value;
        conditionValueGroup.style.display = conditionType === 'transactions_count' ? 'block' : 'none';
        conditionValueInput.required = conditionType === 'transactions_count';
        conditionUnitGroup.style.display = conditionType === 'transactions_count' ? 'block' : 'none';

        const claimLimitType = claimLimitTypeSelect.value;
        claimLimitValueGroup.style.display = claimLimitType !== 'none' ? 'block' : 'none';
        claimLimitValueInput.required = claimLimitType !== 'none';
    };


    // --- Fetching Data ---
    const fetchAllRewards = async () => {
        rewardsLoadingMsg.style.display = 'block';
        rewardsTable.style.display = 'none';
        noRewardsMessage.style.display = 'none';
        rewardsTableBody.innerHTML = '';

        try {
            const q = query(collection(db, "rewards"), orderBy("sortOrder", "asc"));
            const querySnapshot = await getDocs(q);
            allRewardsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderRewardsTable();
        } catch (error) {
            console.error("Error fetching rewards:", error);
            rewardsLoadingMsg.textContent = `فشل تحميل المكافآت: ${error.message}`;
        } finally {
            rewardsLoadingMsg.style.display = 'none';
        }
    };

    const fetchAllUserClaims = async () => {
        userClaimsLoadingMsg.style.display = 'block';
        userClaimsTable.style.display = 'none';
        noUserClaimsMessage.style.display = 'none';
        userClaimsTableBody.innerHTML = '';

        try {
            const claimsQ = query(collection(db, "userRewards"), orderBy("claimedAt", "desc"));
            const claimsSnapshot = await getDocs(claimsQ);
            allUserClaimsData = claimsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const usersQ = query(collection(db, "users"));
            const usersSnapshot = await getDocs(usersQ);
            const usersMap = new Map();
            usersSnapshot.forEach(doc => {
                 const userData = doc.data();
                 usersMap.set(userData.uid, userData);
            });

            allUserClaimsData = allUserClaimsData.map(claim => {
                 const user = usersMap.get(claim.userId);
                 return {
                      ...claim,
                      userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'مستخدم محذوف',
                      userEmail: user ? user.email : 'N/A'
                 };
            });

            renderUserClaimsTable();

        } catch (error) {
            console.error("Error fetching user claims:", error);
            userClaimsLoadingMsg.textContent = `فشل تحميل سجل المطالبات: ${error.message}`;
        } finally {
            userClaimsLoadingMsg.style.display = 'none';
        }
    };

    const fetchCodesForReward = async (rewardId) => {
        codesLoadingMsg.style.display = 'block';
        codesTable.style.display = 'none';
        noCodesMessage.style.display = 'none';
        codesTableBody.innerHTML = '';

        try {
            const q = query(collection(db, "rewardCodes"), where("rewardId", "==", rewardId), orderBy("createdAt", "asc"));
            const querySnapshot = await getDocs(q);
            currentCodesForManage = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderCodesTable();
        } catch (error) {
            console.error("Error fetching codes:", error);
            codesLoadingMsg.textContent = `فشل تحميل الأكواد: ${error.message}`;
            currentCodesForManage = [];
        } finally {
            codesLoadingMsg.style.display = 'none';
        }
    };


    // --- Rendering Tables ---
    const renderRewardsTable = () => {
        rewardsTableBody.innerHTML = '';
        if (allRewardsData.length === 0) {
            rewardsTable.style.display = 'none';
            noRewardsMessage.style.display = 'block';
            return;
        }

        rewardsTable.style.display = 'table';
        noRewardsMessage.style.display = 'none';

        allRewardsData.forEach(reward => {
            const row = rewardsTableBody.insertRow();
            
            const totalClaimsForThisReward = allUserClaimsData.filter(claim => claim.rewardId === reward.id).length;
            
            const statusClass = reward.isActive ? 'active' : 'inactive';
            const conditionDisplay = reward.conditionType === 'transactions_count' ? `${reward.conditionValue} ${reward.conditionUnit || 'عملية'}` : 'يدوي';
            const limitDisplay = reward.claimLimitType === 'none' ? 'لا يوجد' : `${reward.claimLimitValue} ${reward.claimLimitType === 'per_user' ? 'لكل مستخدم' : 'إجمالي'}`;
            const rewardTypeDisplay = reward.rewardType === 'no_code' ? 'لا يوجد كود' : reward.rewardType === 'fixed_code' ? 'كود ثابت' : 'أكواد فريدة';

            row.innerHTML = `
                <td data-label="الاسم">${reward.name}</td>
                <td data-label="النوع">${rewardTypeDisplay}</td>
                <td data-label="القيمة">${reward.value}</td>
                <td data-label="الشرط">${conditionDisplay}</td>
                <td data-label="الحد الأقصى">${limitDisplay}</td>
                <td data-label="تم المطالبة (إجمالي)">${totalClaimsForThisReward}</td>
                <td data-label="الحالة"><span class="status-tag ${statusClass}">${reward.isActive ? 'مفعلة' : 'غير مفعلة'}</span></td>
                <td data-label="إجراءات" class="actions-cell">
                    <div class="table-actions-buttons">
                        <button class="table-action-btn edit-btn" data-id="${reward.id}" title="تعديل"><box-icon name='edit'></box-icon> تعديل</button>
                        ${reward.rewardType === 'unique_code' ? `<button class="table-action-btn manage-codes-btn" data-id="${reward.id}" data-name="${reward.name}" title="إدارة الأكواد"><box-icon name='code'></box-icon> إدارة الأكواد</button>` : ''}
                        <button class="table-action-btn delete-btn" data-id="${reward.id}" data-name="${reward.name}" title="حذف"><box-icon name='trash'></box-icon> حذف</button>
                    </div>
                </td>
            `;
        });
    };

    const renderUserClaimsTable = () => {
        userClaimsTableBody.innerHTML = '';
        if (allUserClaimsData.length === 0) {
            userClaimsTable.style.display = 'none';
            noUserClaimsMessage.style.display = 'block';
            return;
        }

        userClaimsTable.style.display = 'table';
        noUserClaimsMessage.style.display = 'none';

        allUserClaimsData.forEach(claim => {
            const row = userClaimsTableBody.insertRow();
            const claimedCodeDisplay = claim.claimedCode ? `<span class="claimed-code-cell">${claim.claimedCode}</span>` : 'لا يوجد';

            row.innerHTML = `
                <td data-label="المستخدم">${claim.userName || claim.userId} <br> <small style="direction:ltr; display:block; text-align:right;">${claim.userEmail || ''}</small></td>
                <td data-label="المكافأة">${claim.rewardName || claim.rewardId}</td>
                <td data-label="القيمة">${claim.claimedValue || 'N/A'}</td>
                <td data-label="الكود">${claimedCodeDisplay}</td>
                <td data-label="تاريخ المطالبة">${formatDate(claim.claimedAt)}</td>
            `;
        });
    };

     const renderCodesTable = () => {
        codesTableBody.innerHTML = '';
        const filteredCodes = currentCodesForManage.filter(code => {
            const statusFilter = codeStatusFilterSelect.value;
            if (statusFilter === 'all') return true;
            return statusFilter === 'claimed' ? code.isClaimed === true : code.isClaimed === false;
        });

        if (filteredCodes.length === 0) {
            codesTable.style.display = 'none';
            noCodesMessage.style.display = 'block';
            return;
        }

        codesTable.style.display = 'table';
        noCodesMessage.style.display = 'none';

        filteredCodes.forEach(code => {
            const row = codesTableBody.insertRow();
            const statusClass = code.isClaimed ? 'claimed' : 'unused';
            const statusText = code.isClaimed ? 'تم المطالبة بها' : 'غير مستخدمة';
            const claimedByDisplay = code.claimedByUserId || 'N/A';
            const claimedAtDisplay = formatDate(code.claimedAt);

            row.innerHTML = `
                <td data-label="الكود">${code.code}</td>
                <td data-label="الحالة"><span class="status-tag ${statusClass}">${statusText}</span></td>
                <td data-label="تم المطالبة بواسطة">${claimedByDisplay}</td>
                <td data-label="تاريخ المطالبة">${claimedAtDisplay}</td>
                <td data-label="إجراء" class="actions-cell">
                    ${!code.isClaimed ? `<button class="table-action-btn delete-code-btn" data-id="${code.id}" data-code-str="${code.code}" title="حذف الكود"><box-icon name='trash'></box-icon> حذف</button>` : ''}
                </td>
            `;
        });
     }


    // --- Reward Management ---
    const openRewardModal = (reward = null) => {
        rewardForm.reset();
        rewardModalMessage.style.display = 'none';
        rewardDocumentIdInput.value = '';
        rewardIsActiveCheckbox.checked = true;
        rewardSortOrderInput.value = 100;
        fixedCodeInput.required = false;
        conditionValueInput.required = false;
        claimLimitValueInput.required = false;

        // --- [NEW] START: Reset and handle important info fields ---
        rewardHasInfoCheckbox.checked = false;
        importantInfoGroup.style.display = 'none';
        rewardImportantInfoTextarea.value = '';
        // --- [NEW] END ---

        if (reward) {
            rewardModalTitle.textContent = "تعديل مكافأة";
            rewardDocumentIdInput.value = reward.id;
            rewardNameInput.value = reward.name || '';
            rewardValueInput.value = reward.value || '';
            rewardDescriptionInput.value = reward.description || '';
            rewardTypeSelect.value = reward.rewardType || 'no_code';
            fixedCodeInput.value = reward.fixedCode || '';
            conditionTypeSelect.value = reward.conditionType || 'manual';
            conditionValueInput.value = reward.conditionValue ?? '';
            conditionUnitInput.value = reward.conditionUnit || '';
            claimLimitTypeSelect.value = reward.claimLimitType || 'none';
            claimLimitValueInput.value = reward.claimLimitValue ?? '';
            rewardIsActiveCheckbox.checked = reward.isActive !== false;
            rewardSortOrderInput.value = reward.sortOrder ?? 100;

            // --- [NEW] START: Populate important info fields on edit ---
            if (reward.importantInfoHtml && reward.importantInfoHtml.trim() !== '') {
                rewardHasInfoCheckbox.checked = true;
                importantInfoGroup.style.display = 'block';
                rewardImportantInfoTextarea.value = reward.importantInfoHtml;
            }
            // --- [NEW] END ---

        } else {
            rewardModalTitle.textContent = "إضافة مكافأة جديدة";
             rewardTypeSelect.value = 'no_code';
             conditionTypeSelect.value = 'manual';
             claimLimitTypeSelect.value = 'none';
        }

        toggleRewardFields();
        showModal(rewardModal);
    };

    const saveReward = async (event) => {
        event.preventDefault();
        rewardModalMessage.style.display = 'none';

        const documentId = rewardDocumentIdInput.value;

        const rewardType = rewardTypeSelect.value;
        const conditionType = conditionTypeSelect.value;
        const claimLimitType = claimLimitTypeSelect.value;

        const rewardData = {
            name: rewardNameInput.value.trim(),
            description: rewardDescriptionInput.value.trim(),
            value: rewardValueInput.value.trim(),
            conditionType: conditionType,
            conditionValue: conditionType === 'transactions_count' ? parseFloat(conditionValueInput.value) : null,
            conditionUnit: conditionType === 'transactions_count' ? conditionUnitInput.value.trim() : null,
            claimLimitType: claimLimitType,
            claimLimitValue: claimLimitType !== 'none' ? parseInt(claimLimitValueInput.value) : null,
            rewardType: rewardType,
            fixedCode: rewardType === 'fixed_code' ? fixedCodeInput.value.trim() : null,
            isActive: rewardIsActiveCheckbox.checked,
            sortOrder: parseInt(rewardSortOrderInput.value) || 100,
            updatedAt: serverTimestamp(),
            // --- [NEW] START: Conditionally add the importantInfoHtml field ---
            importantInfoHtml: rewardHasInfoCheckbox.checked ? rewardImportantInfoTextarea.value.trim() : null
            // --- [NEW] END ---
        };

        if (!documentId) {
             rewardData.createdAt = serverTimestamp();
             rewardData.claimedCountGlobal = 0;
        }

        try {
            if (documentId) {
                 await updateDoc(doc(db, "rewards", documentId), rewardData);
            } else {
                await addDoc(collection(db, "rewards"), rewardData);
            }
            alert("تم حفظ المكافأة بنجاح!");
            hideModal(rewardModal);
            window.initializeManageRewardsView();
        } catch (error) {
            console.error("Error saving reward:", error);
            rewardModalMessage.textContent = `فشل حفظ المكافأة: ${error.message}`;
            rewardModalMessage.className = 'form-message error';
            rewardModalMessage.style.display = 'block';
        }
    };

    const deleteReward = async (rewardId, rewardName) => {
        if (confirm(`هل أنت متأكد أنك تريد حذف المكافأة "${rewardName}"؟\nسيتم حذف جميع الأكواد والمطالبات المرتبطة بهذه المكافأة بشكل نهائي!`)) {
            try {
                const batch = writeBatch(db);

                const codesSnapshot = await getDocs(query(collection(db, 'rewardCodes'), where('rewardId', '==', rewardId)));
                codesSnapshot.forEach(doc => batch.delete(doc.ref));

                const claimsSnapshot = await getDocs(query(collection(db, 'userRewards'), where('rewardId', '==', rewardId)));
                claimsSnapshot.forEach(doc => batch.delete(doc.ref));
                
                const rewardRef = doc(db, "rewards", rewardId);
                batch.delete(rewardRef);

                await batch.commit();

                alert("تم حذف المكافأة وجميع العناصر المرتبطة بها بنجاح.");
                window.initializeManageRewardsView();
            } catch (error) {
                console.error("Error deleting reward and related items:", error);
                alert(`فشل حذف المكافأة: ${error.message}`);
            }
        }
    };

    // --- Code Management (for unique_code rewards) ---
     const openManageCodesModal = (rewardId, rewardName) => {
        addCodesMessage.style.display = 'none';
        newCodesTextarea.value = '';
        rewardIdForCodesInput.value = rewardId;
        rewardNameForCodesSpan.textContent = rewardName;
        codeStatusFilterSelect.value = 'all';
        fetchCodesForReward(rewardId);
        showModal(manageCodesModal);
     };

     const addCodes = async () => {
         const rewardId = rewardIdForCodesInput.value;
         const codesToAdd = newCodesTextarea.value.trim().split('\n').map(code => code.trim()).filter(code => code);

         if (!rewardId || codesToAdd.length === 0) {
             addCodesMessage.textContent = 'الرجاء تحديد المكافأة وإدخال الأكواد.';
             addCodesMessage.className = 'form-message error';
             addCodesMessage.style.display = 'block';
             return;
         }
         addCodesBtn.disabled = true;
         addCodesMessage.style.display = 'none';

         try {
             const existingCodesSnapshot = await getDocs(query(collection(db, 'rewardCodes'), where('rewardId', '==', rewardId)));
             const existingCodes = new Set(existingCodesSnapshot.docs.map(doc => doc.data().code));
             const uniqueCodesToAdd = codesToAdd.filter(code => !existingCodes.has(code));
             const duplicateCount = codesToAdd.length - uniqueCodesToAdd.length;
             if (uniqueCodesToAdd.length === 0) {
                 addCodesMessage.textContent = `لم يتم إضافة أكواد جديدة. ${duplicateCount > 0 ? `(${duplicateCount} كود مكرر تم تجاهله).` : ''}`;
                 addCodesMessage.className = 'form-message warning';
                 addCodesMessage.style.display = 'block';
                 addCodesBtn.disabled = false;
                 return;
             }
             const batch = writeBatch(db);
             uniqueCodesToAdd.forEach(code => {
                 const newCodeRef = doc(collection(db, 'rewardCodes'));
                 batch.set(newCodeRef, {
                     code: code,
                     rewardId: rewardId,
                     isClaimed: false,
                     createdAt: serverTimestamp()
                 });
             });
             await batch.commit();
             addCodesMessage.textContent = `تم إضافة ${uniqueCodesToAdd.length} كود بنجاح. ${duplicateCount > 0 ? `(${duplicateCount} كود مكرر تم تجاهله).` : ''}`;
             addCodesMessage.className = 'form-message success';
             addCodesMessage.style.display = 'block';
             newCodesTextarea.value = '';
             fetchCodesForReward(rewardId);
         } catch (error) {
             console.error("Error adding codes:", error);
             addCodesMessage.textContent = `فشل إضافة الأكواد: ${error.message}`;
             addCodesMessage.className = 'form-message error';
             addCodesMessage.style.display = 'block';
         } finally {
             addCodesBtn.disabled = false;
         }
     };

    const deleteCode = async (codeDocId, codeStr) => {
        if (confirm(`هل أنت متأكد من رغبتك في حذف الكود "${codeStr}"؟`)) {
            try {
                const codeRef = doc(db, 'rewardCodes', codeDocId);
                const codeDoc = await getDoc(codeRef);
                if (codeDoc.exists() && codeDoc.data().isClaimed) {
                     alert("لا يمكن حذف الكود المطالب به.");
                     return;
                }
                await deleteDoc(codeRef);
                alert("تم حذف الكود بنجاح.");
                fetchCodesForReward(rewardIdForCodesInput.value);
            } catch (error) {
                console.error("Error deleting code:", error);
                alert(`فشل حذف الكود: ${error.message}`);
            }
        }
    };


    // --- Initialization ---
    window.initializeManageRewardsView = async () => {
        console.log("Initializing Manage Rewards View...");
        await fetchAllUserClaims();
        await fetchAllRewards(); 
    };


    // --- Event Listeners ---
    addNewRewardBtn.addEventListener('click', () => openRewardModal());
    rewardForm.addEventListener('submit', saveReward);
    rewardTypeSelect.addEventListener('change', toggleRewardFields);
    conditionTypeSelect.addEventListener('change', toggleRewardFields);
    claimLimitTypeSelect.addEventListener('change', toggleRewardFields);

    rewardsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const manageCodesBtn = e.target.closest('.manage-codes-btn');
        if (editBtn) {
            const rewardId = editBtn.dataset.id;
            const rewardToEdit = allRewardsData.find(r => r.id === rewardId);
            if (rewardToEdit) openRewardModal(rewardToEdit);
        } else if (deleteBtn) {
            deleteReward(deleteBtn.dataset.id, deleteBtn.dataset.name);
        } else if (manageCodesBtn) {
            openManageCodesModal(manageCodesBtn.dataset.id, manageCodesBtn.dataset.name);
        }
    });

    rewardModal.querySelectorAll('.close-modal-btn, .cancel-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => hideModal(rewardModal));
    });
     manageCodesModal.querySelectorAll('.close-modal-btn').forEach(btn => {
         btn.addEventListener('click', () => hideModal(manageCodesModal));
     });

    addCodesBtn.addEventListener('click', addCodes);
    codeStatusFilterSelect.addEventListener('change', renderCodesTable);
    codesTableBody.addEventListener('click', (e) => {
         const deleteBtn = e.target.closest('.delete-code-btn');
         if(deleteBtn) deleteCode(deleteBtn.dataset.id, deleteBtn.dataset.codeStr);
    });

    // --- [NEW] START: Add event listener for the new checkbox ---
    rewardHasInfoCheckbox.addEventListener('change', () => {
        importantInfoGroup.style.display = rewardHasInfoCheckbox.checked ? 'block' : 'none';
    });
    // --- [NEW] END ---
});
