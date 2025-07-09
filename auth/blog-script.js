// auth/blog-script.js
import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, query, where, getDocs, orderBy, doc, getDoc,
    addDoc, updateDoc, serverTimestamp, runTransaction, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global DOM element references for comments section, initialized in initializeComments
let commentsList, noCommentsMsg, commentFormContainer;

// Global state variables for comments
let currentUser = null;
let expandedCommentIds = new Set();
let allCommentsFromDB = [];
let usersMapCache = new Map();

// Utility functions
const sanitizeHTML = (str) => {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
};

const timeSince = (firebaseTimestamp) => {
    let date;
    if (!firebaseTimestamp) return 'تاريخ غير متوفر';

    if (typeof firebaseTimestamp.toDate === 'function') { // It's a real Firebase Timestamp
        date = firebaseTimestamp.toDate();
    } else if (typeof firebaseTimestamp.seconds === 'number' && typeof firebaseTimestamp.nanoseconds === 'number') { // It's a plain JS object mimicking Firestore Timestamp
        date = new Date(firebaseTimestamp.seconds * 1000 + Math.floor(firebaseTimestamp.nanoseconds / 1_000_000));
    } else if (firebaseTimestamp instanceof Date) { // It's already a Date object
        date = firebaseTimestamp;
    } else { // Fallback for any other unexpected format
        console.warn("Unexpected timestamp format:", firebaseTimestamp);
        return 'تاريخ غير متوفر';
    }
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return "منذ " + Math.floor(interval) + " سنة";
    interval = seconds / 2592000;
    if (interval > 1) return "منذ " + Math.floor(interval) + " شهر";
    interval = seconds / 604800; // weeks
    if (interval > 1) return "منذ " + Math.floor(interval) + " أسبوع";
    interval = seconds / 86400;
    if (interval > 1) return "منذ " + Math.floor(interval) + " يوم";
    interval = seconds / 3600;
    if (interval > 1) return "منذ " + Math.floor(interval) + " ساعة";
    interval = seconds / 60;
    if (interval > 1) return "منذ " + Math.floor(interval) + " دقيقة";
    return "الآن";
};

const formatDate = (firebaseTimestamp) => { // Kept for consistency
    if (!firebaseTimestamp || typeof firebaseTimestamp.toDate !== 'function') return 'تاريخ غير متوفر';
    return new Date(firebaseTimestamp.toDate()).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
};

// Main DOM Content Loaded Listener
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('articles-container')) {
        initializeBlogListingPage();
    }
    if (document.getElementById('article-content-container')) {
        initializeArticlePage();
    }
});

// Blog Listing Page Logic (functions below)
async function initializeBlogListingPage() {
    const articlesGrid = document.getElementById('articles-grid');
    const loadingMsg = document.getElementById('articles-loading');
    const noArticlesMsg = document.getElementById('no-articles-message');
    const categoryContainer = document.getElementById('category-filter-container');

    let allArticles = [];
    let allCategories = new Set();

    const renderArticles = (articlesToRender) => {
        articlesGrid.innerHTML = '';
        if (articlesToRender.length === 0) {
            noArticlesMsg.style.display = 'block';
            return;
        }
        noArticlesMsg.style.display = 'none';

        articlesToRender.forEach(article => {
            const card = document.createElement('a');
            card.href = `article.html?id=${article.id}`;
            card.className = 'article-card';
            card.innerHTML = `
                <span class="card-category">${sanitizeHTML(article.category)}</span>
                <h3 class="card-title">${sanitizeHTML(article.title)}</h3>
                <p class="card-excerpt">${sanitizeHTML(article.excerpt)}</p>
                <div class="card-footer">
                    <span class="card-author">بواسطة: ${sanitizeHTML(article.authorName)}</span>
                    <span class="card-date">${formatDate(article.publishedAt)}</span>
                </div>
            `;
            articlesGrid.appendChild(card);
        });
    };

    const renderCategories = () => {
        categoryContainer.innerHTML = '<button class="category-btn active" data-category="all">الكل</button>';
        allCategories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.dataset.category = category;
            btn.textContent = sanitizeHTML(category);
            categoryContainer.appendChild(btn);
        });
    };

    categoryContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const selectedCategory = e.target.dataset.category;
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderArticles(selectedCategory === 'all' ? allArticles : allArticles.filter(article => article.category === selectedCategory));
        }
    });

    try {
        loadingMsg.textContent = "جارٍ تحميل المقالات..."; // Ensure loading message is set
        loadingMsg.style.color = 'var(--text-secondary, #6c757d)'; // Reset color for loading state
        noArticlesMsg.style.display = 'none'; // Ensure 'no articles' message is hidden
        articlesGrid.innerHTML = ''; // Clear existing articles if any
        console.log("Attempting to fetch articles from Firestore...");
        const articlesRef = collection(db, "articles");
        // Ensure status is correctly handled and document has 'publishedAt' for ordering
        const q = query(articlesRef, where("status", "==", "published"), orderBy("publishedAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) { // This block handles "no articles found"
            console.warn("No published articles found in Firestore.");
            allArticles = [];
            loadingMsg.style.display = 'none'; // Hides loading message
            noArticlesMsg.style.display = 'block'; // Shows no articles message
            noArticlesMsg.textContent = "لم يتم العثور على مقالات للعرض حاليًا.\nيرجى التحقق من اتصالك بالإنترنت أو المحاولة لاحقًا.";
            renderCategories(); // Render categories even if no articles
            return;
        }

        allArticles = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Basic validation for critical fields
            if (!data.title || !data.category || !data.excerpt || !data.publishedAt) {
                console.warn("Skipping article due to missing critical data:", doc.id, data);
                return null; // Exclude incomplete articles
            }
            allCategories.add(data.category);
            return { id: doc.id, ...data };
        }).filter(Boolean); // Filter out nulls

        console.log(`Successfully fetched ${allArticles.length} published articles.`);
        loadingMsg.style.display = 'none'; // Hide loading message on success
        renderCategories();
        renderArticles(allArticles);

    } catch (error) { // This block handles errors (e.g., network issues)
        console.error("Error fetching articles:", error);
        loadingMsg.style.display = 'block'; // Ensure loading message is visible
        loadingMsg.style.color = 'red'; // Make the error message red
        articlesGrid.innerHTML = ''; // Clear the articles grid
        noArticlesMsg.style.display = 'none'; // CRITICAL FIX: Hide "no articles" message on error

        let errorMessageText = "فشل تحميل المقالات. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى."; // General network error
        if (error.code === 'permission-denied') {
            errorMessageText = "خطأ في الصلاحيات: لا يمكن تحميل المقالات. قد تحتاج إلى التحقق من قواعد أمان Firebase الخاصة بك.";
        } else if (error.message.includes("does not exist or is not a timestamp")) { // Common if orderBy field is missing
             errorMessageText = "خطأ في بيانات المقالات: لا يوجد حقل تاريخ النشر. الرجاء التأكد من بنية بيانات المقالات.";
        } else if (error.code === 'unavailable' || error.code === 'internal') {
             errorMessageText = "مشكلة في الخادم: تعذر تحميل المقالات. يرجى المحاولة مرة أخرى لاحقًا.";
        }
        loadingMsg.textContent = errorMessageText;
    }
}

// Single Article Page Logic (functions below)
async function initializeArticlePage() {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    const loadingMsg = document.getElementById('article-loading');
    const articleContainer = document.getElementById('article-content-container');
    const commentsSectionContainer = document.getElementById('comments-section'); // Corrected variable name

    if (!articleId) {
        console.error("Article ID is missing in URL parameters.");
        loadingMsg.innerHTML = `
            <h1>خطأ: معرف المقال غير موجود.</h1>
            <p>لا يمكن تحميل المقال بدون معرف صحيح.</p>
            <a href="blog.html" class="button primary">العودة إلى المدونة</a>
        `;
        return; // Exit if no articleId
    }

    loadingMsg.textContent = "جارٍ تحميل المقال..."; // Ensure loading message is set

    try {
        console.log(`Attempting to fetch article with ID: ${articleId} from Firestore.`);
        const articleRef = doc(db, "articles", articleId);
        const articleSnap = await getDoc(articleRef);

        if (!articleSnap.exists()) {
            console.warn(`Article with ID ${articleId} not found in Firestore.`);
            loadingMsg.innerHTML = `
                <h1>المقال غير موجود</h1>
                <p>قد يكون المقال الذي تبحث عنه قد تم حذفه أو أن الرابط غير صحيح.</p>
                <a href="blog.html" class="button primary">العودة إلى المدونة</a>
            `;
            return;
        }

        const article = { id: articleSnap.id, ...articleSnap.data() };

        if (article.status !== 'published') {
            console.warn(`Article with ID ${articleId} is not published (status: ${article.status}).`);
            loadingMsg.innerHTML = `
                <h1>المقال غير منشور</h1>
                <p>المقال الذي تحاول عرضه لم يتم نشره بعد أو تم إلغاء نشره.</p>
                <a href="blog.html" class="button primary">العودة إلى المدونة</a>
            `;
            return;
        }

        renderArticleContent(article);

        console.log(`Successfully loaded article: ${article.title}`);
        loadingMsg.style.display = 'none';
        articleContainer.style.display = 'block';

        if (article.allowComments) {
            commentsSectionContainer.style.display = 'block';
            initializeComments(articleId); // This will handle form rendering
        } else {
            console.log("Comments are disabled for this article.");
            commentsSectionContainer.style.display = 'none'; // Ensure comments section is hidden
        }

    } catch (error) {
        console.error(`Error fetching or processing article ID ${articleId}:`, error);
        loadingMsg.innerHTML = `
            <h1>خطأ في التحميل</h1>
            <p>حدث خطأ أثناء تحميل المقال. يرجى المحاولة لاحقاً.</p>
            <a href="blog.html" class="button primary">العودة إلى المدونة</a>
        `;
         if (error.code === 'permission-denied') {
            loadingMsg.innerHTML += "<p style='color:red;'>خطأ في الصلاحيات: لا يمكن قراءة المقال. قد تحتاج إلى التحقق من قواعد أمان Firebase.</p>";
        }
    }
}

function renderArticleContent(article) {
    document.title = `${sanitizeHTML(article.title)} - Easy Exchange`;
    document.getElementById('article-category-breadcrumb').textContent = sanitizeHTML(article.category);
    document.getElementById('article-title').textContent = sanitizeHTML(article.title);
    document.getElementById('article-excerpt').textContent = sanitizeHTML(article.excerpt);
    document.getElementById('author-name').textContent = sanitizeHTML(article.authorName);
    document.getElementById('article-date').textContent = formatDate(article.publishedAt); // Still using formatDate here
    document.getElementById('article-body').innerHTML = article.content;

    const pageUrl = window.location.href;
    const shareText = encodeURIComponent(`اكتشف هذا المقال الرائع: ${article.title}`);
    document.getElementById('share-whatsapp').href = `https://api.whatsapp.com/send?text=${shareText}%20${encodeURIComponent(pageUrl)}`;
    document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;

    document.getElementById('copy-link-btn').addEventListener('click', async () => {
        // Ensure showToast is available from a dynamically imported module or window
        const { showToast } = await importDefaultGlobalFunctions();
        if (typeof showToast !== 'function') { // Check again in specific event listener
            console.error("showToast is not defined for copy link button. Using alert as fallback.");
            alert('تم النسخ إلى الحافظة.'); // Fallback alert
            return;
        }
        navigator.clipboard.writeText(pageUrl).then(() => {
            showToast('تم نسخ الرابط بنجاح!', 'success');
        });
    });

    document.querySelector('meta[property="og:title"]').setAttribute('content', sanitizeHTML(article.title));
    document.querySelector('meta[property="og:description"]').setAttribute('content', sanitizeHTML(article.excerpt));
    document.querySelector('meta[property="og:url"]').setAttribute('content', pageUrl);
}

// Comments System Core Logic (functions below)
const reRenderCommentsDisplay = () => { // Moved to global scope
    commentsList.innerHTML = '';
    if (allCommentsFromDB.length === 0) {
        noCommentsMsg.style.display = 'block';
        return;
    }
    noCommentsMsg.style.display = 'none';

    const topLevelComments = allCommentsFromDB.filter(c => !c.parentCommentId);
    const repliesMap = allCommentsFromDB.reduce((acc, reply) => {
        if (reply.parentCommentId) (acc[reply.parentCommentId] = acc[reply.parentCommentId] || []).push(reply);
        return acc;
    }, {});
    Object.values(repliesMap).forEach(replies => replies.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));

    topLevelComments.forEach(comment => {
        const commentElement = createCommentElement(comment, usersMapCache, repliesMap, allCommentsFromDB);
        commentsList.appendChild(commentElement);
    });
};

async function initializeComments(articleId) {
    commentsList = document.getElementById('comments-list');
    noCommentsMsg = document.getElementById('no-comments-message');
    commentFormContainer = document.getElementById('comment-form-container');

    // Initial message before user status is confirmed
    commentsList.innerHTML = `<p class="blog-message">جارٍ تحميل التعليقات...</p>`;
    noCommentsMsg.style.display = 'none'; // Initially hidden
    // Also, initialize the comment form container's content based on loading status.
    commentFormContainer.innerHTML = `<p class="blog-message">جاري تحميل حالة التعليقات...</p>`;


    const fetchAndCacheCommentsAndUsers = async (currentArticleId) => {
        try {
            const commentsQuery = query(collection(db, "comments"), where("articleId", "==", currentArticleId), orderBy("createdAt", "desc"));
            const commentsSnapshot = await getDocs(commentsQuery);
            allCommentsFromDB = commentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const userIds = [...new Set(allCommentsFromDB.map(c => c.userId))].filter(Boolean);
            usersMapCache = await getUsersData(userIds);

        } catch (error) {
            console.error("Error fetching comments and users for cache:", error);
            allCommentsFromDB = [];
            usersMapCache = new Map();
            commentsList.innerHTML = `<p class="blog-message error-message">فشل تحميل التعليقات.</p>`;
        }
    };

    onAuthStateChanged(auth, async user => {
        currentUser = user;

        // This is the key change: always re-render comment form container based on actual user status
        renderCommentForm(articleId);

        await fetchAndCacheCommentsAndUsers(articleId);
        reRenderCommentsDisplay();
    });

    commentsList.addEventListener('click', async e => {
        const toggleBtn = e.target.closest('.toggle-replies-btn');
        const optionsToggleBtn = e.target.closest('.comment-options-toggle');
        const editOption = e.target.closest('.comment-option.edit');
        const deleteOption = e.target.closest('.comment-option.delete');
        const likeButton = e.target.closest('.comment-action.like');
        const replyButton = e.target.closest('.comment-action.reply');

        // Close any open options menu if clicking elsewhere
        if (!optionsToggleBtn && !e.target.closest('.comment-options-menu')) {
            document.querySelectorAll('.comment-options-menu').forEach(menu => menu.classList.remove('active'));
        }

        if (toggleBtn) {
            const repliesContainer = toggleBtn.closest('.comment-thread')?.querySelector('.replies-container');
            const commentId = toggleBtn.closest('.comment')?.dataset.commentId;

            if (repliesContainer && commentId) {
                const isHidden = repliesContainer.style.display === 'none';
                repliesContainer.style.display = isHidden ? 'block' : 'none';
                toggleBtn.textContent = isHidden ? `[-] إخفاء الردود` : `[+] ${toggleBtn.dataset.text}`;

                if (isHidden) expandedCommentIds.add(commentId);
                else expandedCommentIds.delete(commentId);
            }
            return;
        }

        if (optionsToggleBtn) {
            const menu = optionsToggleBtn.closest('.comment-options-wrapper')?.querySelector('.comment-options-menu');
            if (menu) {
                document.querySelectorAll('.comment-options-menu').forEach(openMenu => {
                    if (openMenu !== menu) openMenu.classList.remove('active');
                });
                menu.classList.toggle('active');
            }
            return;
        }

        // Import global modal functions only when needed for specific actions
        const { showConfirmationModal, showToast } = await importDefaultGlobalFunctions();

        // This crucial block checks authentication and handles redirection
        // Added specific checks for each interactive button and stop processing if not authenticated
        if (!currentUser || !currentUser.emailVerified) {
            showToast('الرجاء تسجيل الدخول والتحقق من بريدك الإلكتروني للمتابعة...', 'info', 3000);
            setTimeout(() => {
                window.location.href = `login.html?next=${encodeURIComponent(window.location.href)}`;
            }, 2500); // Redirect after toast is shown
            return; // Stop further processing if not authenticated
        }

        if (editOption) {
            startEditComment(editOption.dataset.commentId, allCommentsFromDB);
            return;
        }

        if (deleteOption) {
            const commentText = deleteOption.closest('.comment-content').querySelector('.comment-text').textContent;
            await handleDeleteComment(deleteOption.dataset.commentId, commentText, showConfirmationModal, showToast);
            return;
        }

        if (likeButton && !likeButton.disabled) {
            const commentIdToLike = likeButton.dataset.commentId;
            const likeSpan = likeButton.querySelector('span');

            const originalLikedState = likeButton.classList.contains('liked');
            let currentLikes = parseInt(likeSpan.textContent) || 0;

            likeButton.classList.toggle('liked', !originalLikedState);
            likeButton.querySelector('box-icon').setAttribute('type', !originalLikedState ? 'solid' : 'regular');
            likeSpan.textContent = currentLikes + (originalLikedState ? -1 : 1);
            likeButton.disabled = true;

            try {
                const commentInCache = allCommentsFromDB.find(c => c.id === commentIdToLike);
                if (commentInCache) commentInCache.likes = originalLikedState ? (commentInCache.likes || []).filter(id => id !== currentUser.uid) : [...(commentInCache.likes || []), currentUser.uid];
                await toggleLike(commentIdToLike, currentUser.uid, showToast);
                likeButton.disabled = false;
            } catch (error) {
                console.error("Error toggling like:", error);

                likeButton.classList.toggle('liked', originalLikedState);
                likeButton.querySelector('box-icon').setAttribute('type', originalLikedState ? 'solid' : 'regular');
                likeSpan.textContent = currentLikes;
                showToast('حدث خطأ أثناء التفاعل. حاول مرة أخرى.', 'error');
                likeButton.disabled = false;
            }
            return;
        }

        if (replyButton) {
            showReplyForm(replyButton.dataset.commentId, articleId);
        }
    });
}

// Helper to dynamically import global functions that might be attached to window or exported from main script
async function importDefaultGlobalFunctions() {
    // Check if window already has these and prefer them, otherwise try dynamic import.
    // This allows for both global attachment and module exports scenario.
    if (typeof window.showToast === 'function' && typeof window.showConfirmationModal === 'function') {
        return {
            showConfirmationModal: window.showConfirmationModal,
            showInfoModal: window.showInfoModal || (() => console.warn('showInfoModal not available on window')), // Fallback for showInfoModal if only Toast/Confirm exist
            showToast: window.showToast
        };
    }
    // Fallback for environment where functions are only exported by main script (type=module)
    try {
        // Correct path assumption for script.js (depends on its location relative to blog-script.js)
        // Adjust '../script.js' if it's located differently
        const scriptModule = await import('../script.js');
        return {
            showConfirmationModal: scriptModule.showConfirmationModal || window.showConfirmationModal,
            showInfoModal: scriptModule.showInfoModal || window.showInfoModal,
            showToast: scriptModule.showToast || window.showToast
        };
    } catch (e) {
        console.warn("Could not find global modal/toast functions, please ensure script.js attaches them to window or exports them properly.", e);
        // Last resort: Provide dummy functions to prevent crashes, though user experience will be degraded
        return {
            showConfirmationModal: (options) => { console.error("Dummy showConfirmationModal:", options.message); return true; },
            showInfoModal: (options) => { console.error("Dummy showInfoModal:", options.message); return; },
            showToast: (message, type) => { console.error("Dummy showToast:", message, type); alert(message); }
        };
    }
}


// User Data Helper
async function getUsersData(userIds) {
    const usersMap = new Map();
    if (!userIds || userIds.length === 0) return usersMap;
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 10) chunks.push(userIds.slice(i, i + 10));

    try {
        await Promise.all(chunks.map(async (chunk) => {
            const userDocs = await getDocs(query(collection(db, "users"), where("uid", "in", chunk)));
            userDocs.forEach(doc => {
                const data = doc.data();

                let derivedName = (`${data.firstName || ''} ${data.lastName || ''}`).trim();
                let derivedInitials = ((data.firstName?.[0] || 'U') + (data.lastName?.[0] || 'S')).toUpperCase();

                // If first/last name is empty, try to derive from email
                if (!derivedName && data.email && typeof data.email === 'string' && data.email.trim()) {
                    derivedName = data.email.split('@')[0]; // Use part before @
                    derivedInitials = (data.email[0] || 'U').toUpperCase(); // Use first letter of email
                }

                usersMap.set(data.uid, {
                    name: derivedName,
                    initials: derivedInitials,
                    role: data.role || 'user'
                });
            });
        }));
    } catch(e) { console.error("Error fetching user data:", e)}
    return usersMap;
}

// Create Comment Element HTML
function createCommentElement(comment, usersMap, repliesMap, allCommentsData) {
    const wrapper = document.createElement('div');
    wrapper.className = 'comment-thread';
    const commentDiv = document.createElement('div');
    commentDiv.setAttribute('data-comment-id', comment.id);

    // Using `name: null` initially in userInfo because `getUsersData` will populate it
    const userInfo = usersMap.get(comment.userId) || { name: null, initials: 'م.غ', role: 'user' };
    const isThisCommentFromAdmin = userInfo.role === 'admin' || comment.isAdminComment;
    commentDiv.className = `comment ${isThisCommentFromAdmin ? 'admin-comment' : ''}`;

    // Determine the display name: prioritize Admin name, then userInfo.name, then fallback to UID snippet
    let displayUserName;
    let finalAvatarInitials;

    if (isThisCommentFromAdmin) {
        displayUserName = 'Easy Exchange';
        finalAvatarInitials = 'EZ';
    } else if (userInfo.name && userInfo.name.trim()) { // If name from user profile (firstName/lastName/email) is found and not empty
        displayUserName = userInfo.name;
        finalAvatarInitials = userInfo.initials || 'م.غ';
    } else if (comment.userId && typeof comment.userId === 'string' && comment.userId.length > 5) {
        // Fallback for cases where name/email couldn't be derived, but UID exists
        displayUserName = `مستخدم (ID: ${comment.userId.substring(0, 5)}...)`;
        finalAvatarInitials = (comment.userId[0] || 'U').toUpperCase(); // Use first char of UID for initials
    } else { // Truly unknown or very short/invalid userId
        displayUserName = 'مستخدم غير معروف';
        finalAvatarInitials = 'م.غ';
    }

    const adminBadge = isThisCommentFromAdmin ? `<span class="verification-badge" title="مشرف"><box-icon name='check' color='#ffffff'></box-icon></span>` : '';
    const isLiked = currentUser && Array.isArray(comment.likes) && comment.likes.includes(currentUser.uid);
    const likeCount = Array.isArray(comment.likes) ? comment.likes.length : 0;

    let commentTextHtml = sanitizeHTML(comment.commentText);
    if (comment.parentCommentId) {
        const parentComment = allCommentsData.find(c => c.id === comment.parentCommentId);
        if (parentComment && usersMap.has(parentComment.userId)) {
            const parentAuthorInfo = usersMap.get(parentComment.userId);
            const parentAuthorDisplayName = parentAuthorInfo.role === 'admin' ? 'Easy Exchange' : parentAuthorInfo.name;
            commentTextHtml = `<span class="reply-mention">@${sanitizeHTML(parentAuthorDisplayName)}</span> ${commentTextHtml}`;
        }
    }

    const replies = repliesMap[comment.id] || [];
    let repliesToggleHtml = '';
    if (replies.length > 0) repliesToggleHtml = `<button class="toggle-replies-btn" data-text="عرض الـ ${replies.length} ردود">[+] عرض الـ ${replies.length} ردود</button>`;

    const canManageComment = currentUser && (currentUser.uid === comment.userId || (usersMap.get(currentUser.uid)?.role === 'admin'));
    let optionsMenuHtml = '';
    if (canManageComment) {
        optionsMenuHtml = `
            <div class="comment-options-wrapper">
                <button class="comment-options-toggle">
                    <box-icon name='dots-horizontal-rounded'></box-icon>
                </button>
                <div class="comment-options-menu">
                    <button class="comment-option edit" data-comment-id="${comment.id}">
                        <box-icon name='edit-alt'></box-icon> <span>تعديل</span>
                    </button>
                    <button class="comment-option delete" data-comment-id="${comment.id}">
                        <box-icon name='trash'></box-icon> <span>حذف</span>
                    </button>
                </div>
            </div>
        `;
    }

    commentDiv.innerHTML = `
        <div class="comment-avatar" title="${sanitizeHTML(displayUserName)}">${finalAvatarInitials}</div>
        <div class="comment-content">
            <div class="comment-header">
                <span class="comment-author">${sanitizeHTML(displayUserName)} ${adminBadge}</span>
                <span class="comment-timestamp">${timeSince(comment.createdAt)}</span>
                ${optionsMenuHtml}
            </div>
            <p class="comment-text">${commentTextHtml}</p>
            <div class="comment-actions">
                <button class="comment-action like ${isLiked ? 'liked' : ''}" data-comment-id="${comment.id}" title="إعجاب">
                    <box-icon name='${isLiked ? 'like' : 'like'}' type='${isLiked ? 'solid' : 'regular'}'></box-icon>
                    <span>${likeCount}</span>
                </button>
                <button class="comment-action reply" data-comment-id="${comment.id}" title="رد">
                    <box-icon name='reply'></box-icon><span>رد</span>
                </button>
                ${repliesToggleHtml}
            </div>
            <div class="comment-edit-area" style="display: none;"></div>
        </div>`;

    wrapper.appendChild(commentDiv);

    if (replies.length > 0) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        if (expandedCommentIds.has(comment.id)) {
            repliesContainer.style.display = 'block';
            const toggleButtonInCurrentCommentDiv = commentDiv.querySelector('.toggle-replies-btn');
            if (toggleButtonInCurrentCommentDiv) toggleButtonInCurrentCommentDiv.textContent = `[-] إخفاء الردود`;
        } else {
            repliesContainer.style.display = 'none';
        }

        replies.forEach(reply => repliesContainer.appendChild(createCommentElement(reply, usersMap, repliesMap, allCommentsData)));
        wrapper.appendChild(repliesContainer);
    }
    return wrapper;
}

// Render Comment Form
function renderCommentForm(articleId, parentId = null) {
    const container = parentId ? document.getElementById(`reply-form-container-${parentId}`) : document.getElementById('comment-form-container');
    if (!container) return; // Should not happen after DOM is ready

    if (currentUser && currentUser.emailVerified) {
        // User is logged in and verified: show the comment form
        container.innerHTML = `<form class="comment-form ${parentId ? 'reply-form' : ''}"><textarea name="commentText" placeholder="${parentId ? 'اكتب ردك...' : 'اكتب تعليقك...'}" required></textarea><div class="form-actions"><button type="submit" class="button primary">نشر</button>${parentId ? '<button type="button" class="button secondary cancel-reply">إلغاء</button>' : ''}</div></form>`;

        container.querySelector('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const button = form.querySelector('button[type="submit"]');

            const resetButtonState = () => {
                button.disabled = false;
                button.textContent = 'نشر'; // Revert text to "نشر"
            };

            button.disabled = true;
            button.textContent = 'جارٍ النشر...';

            try {
                await postComment(articleId, form.querySelector('textarea').value, parentId);
                form.reset();
                if (parentId) container.innerHTML = '';
            } finally {
                // Ensure button state is reset whether successful or failed
                resetButtonState();
            }
        });
        if (parentId) container.querySelector('.cancel-reply').addEventListener('click', () => container.innerHTML = '');

    } else {
        // User is not logged in or not verified: show a message asking to log in
        container.innerHTML = `<div class="login-prompt-comment"><p>الرجاء <a href="login.html?next=${encodeURIComponent(window.location.href)}">تسجيل الدخول</a> للتعليق.</p></div>`;
    }
}

// Show Reply Form
function showReplyForm(parentCommentId, articleId) {
    document.querySelectorAll('.reply-form-container').forEach(c => c.innerHTML = '');
    const parentCommentActions = document.querySelector(`.comment-action.reply[data-comment-id="${parentCommentId}"]`).closest('.comment-actions');
    if (!parentCommentActions) return;

    let replyContainer = parentCommentActions.parentElement.querySelector('.reply-form-container');
    if (!replyContainer) {
        replyContainer = document.createElement('div');
        replyContainer.className = 'reply-form-container';
        replyContainer.id = `reply-form-container-${parentCommentId}`;
        parentCommentActions.parentNode.insertBefore(replyContainer, parentCommentActions.nextSibling);
    }
    renderCommentForm(articleId, parentCommentId);
    replyContainer.querySelector('textarea')?.focus();
}

// Comment Edit/Delete Functions
function startEditComment(commentId, commentsData) {
    document.querySelectorAll('.comment-edit-area').forEach(area => {
        area.style.display = 'none';
        const commentDiv = area.closest('.comment');
        if (commentDiv) {
             commentDiv.querySelector('.comment-text').style.display = 'block';
             commentDiv.querySelector('.comment-actions').style.display = 'flex';
        }
    });

    const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
    if (!commentElement) return;
    const commentToEdit = commentsData.find(c => c.id === commentId);
    if (!commentToEdit) return;

    const commentTextDisplay = commentElement.querySelector('.comment-text');
    const commentActionsDiv = commentElement.querySelector('.comment-actions');
    const editArea = commentElement.querySelector('.comment-edit-area');

    if (!commentTextDisplay || !commentActionsDiv || !editArea) return;

    commentTextDisplay.style.display = 'none';
    commentActionsDiv.style.display = 'none';

    editArea.innerHTML = `
        <textarea class="edit-comment-textarea" rows="4">${sanitizeHTML(commentToEdit.commentText)}</textarea>
        <div class="form-actions">
            <button class="button primary save-edit-comment" data-comment-id="${commentId}">حفظ</button>
            <button class="button secondary cancel-edit-comment" data-comment-id="${commentId}">إلغاء</button>
        </div>
    `;
    editArea.style.display = 'block';

    editArea.querySelector('.save-edit-comment').addEventListener('click', async (e) => {
        const newText = editArea.querySelector('.edit-comment-textarea').value.trim();
        await updateComment(commentId, newText, commentToEdit);
    });

    editArea.querySelector('.cancel-edit-comment').addEventListener('click', () => {
        editArea.style.display = 'none';
        commentTextDisplay.style.display = 'block';
        commentActionsDiv.style.display = 'flex';
    });
}

async function updateComment(commentId, newText, originalComment) {
    const commentRef = doc(db, "comments", commentId);
    if (!newText) {
        window.showToast("نص التعليق لا يمكن أن يكون فارغاً.", 'error');
        return;
    }

    const saveButton = document.querySelector(`.save-edit-comment[data-comment-id="${commentId}"]`);
    if(saveButton) { saveButton.disabled = true; saveButton.textContent = 'جاري الحفظ...'; }

    try {
        await updateDoc(commentRef, {
            commentText: newText,
            updatedAt: serverTimestamp()
        });

        const index = allCommentsFromDB.findIndex(c => c.id === commentId);
        if (index !== -1) {
            allCommentsFromDB[index].commentText = newText;
            allCommentsFromDB[index].updatedAt = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
        }
        reRenderCommentsDisplay();
        window.showToast("تم تعديل التعليق بنجاح!", 'success');
    } catch (error) {
        console.error("Error updating comment:", error);
        window.showToast("فشل تعديل التعليق. يرجى المحاولة مرة أخرى.", 'error');
        const index = allCommentsFromDB.findIndex(c => c.id === commentId);
        if (index !== -1) {
             allCommentsFromDB[index].commentText = originalComment.commentText;
             allCommentsFromDB[index].updatedAt = originalComment.updatedAt;
        }
        reRenderCommentsDisplay();
    }
}

async function handleDeleteComment(commentId, commentTextPreview, showConfirmationModal, showToast) { // Passed as args
    // Directly use the passed functions. If they are undefined, that's an issue from the caller's side.
    if (typeof showConfirmationModal !== 'function') { // Fallback check in case the import fails dramatically
        console.error("showConfirmationModal is not a function within handleDeleteComment. Reverting to window object if exists.");
        // Attempt to fall back to window.showConfirmationModal directly if it got attached for some reason
        showConfirmationModal = window.showConfirmationModal || ((opts) => { console.error("FATAL: Confirmation modal missing.", opts.message); return true; }); // dummy fallback
        showToast = window.showToast || ((msg, type) => { console.error("FATAL: Toast missing.", msg, type); alert(msg); }); // dummy fallback
    }

    const confirmed = await showConfirmationModal({
        title: 'تأكيد الحذف',
        message: `هل أنت متأكد من حذف هذا التعليق: <br><strong>"${sanitizeHTML(commentTextPreview.substring(0, 70))}${commentTextPreview.length > 70 ? '...' : ''}"</strong><br>إذا كان هذا تعليقاً رئيسياً، فسيتم حذف جميع الردود المرتبطة به بشكل نهائي.`,
        confirmText: 'نعم، احذف',
        cancelText: 'إلغاء',
        iconName: 'trash',
        iconColor: 'var(--danger-color)'
    });

    if (!confirmed) return;

    try {
        const commentsToDeleteIds = [commentId];
        const repliesSnapshot = await getDocs(query(collection(db, "comments"), where("parentCommentId", "==", commentId)));
        repliesSnapshot.forEach(replyDoc => commentsToDeleteIds.push(replyDoc.id));

        const batch = writeBatch(db);
        commentsToDeleteIds.forEach(id => batch.delete(doc(db, "comments", id)));
        await batch.commit();

        allCommentsFromDB = allCommentsFromDB.filter(c => !commentsToDeleteIds.includes(c.id));
        reRenderCommentsDisplay();
        showToast("تم حذف التعليق بنجاح!", 'success'); // Using passed showToast
    } catch (error) {
        console.error("Error deleting comment:", error);
        showToast("فشل حذف التعليق. يرجى المحاولة مرة أخرى.", 'error'); // Using passed showToast
    }
}

// Post & Like Functions (Optimistic UI & Cache Update)
async function postComment(articleId, text, parentId = null) {
    // This assumes window.showToast is reliably available through the main script
    if (typeof window.showToast !== 'function') {
        console.error("window.showToast is not defined for postComment.");
        return; // Exit if fundamental toast function not available
    }

    if (!currentUser) {
        window.showToast('الرجاء تسجيل الدخول لنشر التعليق.', 'error');
        return;
    }
    try {
        await currentUser.reload();
        if (!currentUser.emailVerified) {
            window.showToast('يرجى التحقق من بريدك الإلكتروني أولاً قبل التعليق.', 'error', 5000);
            return;
        }
    } catch (reloadError) {
        console.error("Failed to reload user on comment post:", reloadError);
        window.showToast('خطأ في التحقق من حالتك. يرجى تسجيل الدخول مجدداً.', 'error', 5000);
        return;
    }

    if (!text.trim()) {
        window.showToast('الرجاء كتابة تعليق صالح.', 'warning');
        return;
    }

    const userInfo = (await getUsersData([currentUser.uid])).get(currentUser.uid);
    const isAdmin = userInfo?.role === 'admin';

    const newCommentData = {
        articleId, userId: currentUser.uid, commentText: text.trim(),
        createdAt: serverTimestamp(), isAdminComment: isAdmin,
        likes: [], parentCommentId: parentId || null
    };

    let createdCommentInCache = null;

    try {
        const docRef = await addDoc(collection(db, "comments"), newCommentData);
        window.showToast('تم نشر تعليقك بنجاح!', 'success');

        createdCommentInCache = {
            id: docRef.id, ...newCommentData,
            createdAt: {seconds: Math.floor(Date.now() / 1000), nanoseconds: 0}
        };
        allCommentsFromDB.unshift(createdCommentInCache);

        // This function would ensure all parent comments in the chain of a reply are expanded.
        // It requires recursively finding parents in `allCommentsFromDB` and adding their IDs to `expandedCommentIds`
        // Example (conceptual, requires full implementation based on `allCommentsFromDB` structure):
        // if (parentId) { await ensureParentsExpandedRecursive(parentId, allCommentsFromDB); }

        reRenderCommentsDisplay();
    } catch (error) {
        console.error("Error posting comment:", error);
        window.showToast('فشل نشر التعليق.', 'error');
        if (createdCommentInCache) {
            allCommentsFromDB = allCommentsFromDB.filter(c => c.id !== createdCommentInCache.id);
            reRenderCommentsDisplay();
        }
    }
}

async function toggleLike(commentId, userId, showToast) { // showToast passed as argument
    const commentRef = doc(db, "comments", commentId);
    try {
        await runTransaction(db, async (transaction) => {
            const commentDoc = await transaction.get(commentRef);
            if (!commentDoc.exists()) throw "Comment does not exist!";
            const data = commentDoc.data();
            const likes = Array.isArray(data.likes) ? data.likes : [];
            if (likes.includes(userId)) {
                transaction.update(commentRef, { likes: likes.filter(id => id !== userId) });
            } else {
                transaction.update(commentRef, { likes: [...likes, userId] });
            }
        });
    } catch (error) {
        console.error("Error toggling like:", error);
        showToast('حدث خطأ أثناء التفاعل.', 'error'); // Using passed showToast
        throw error;
    }
} 
