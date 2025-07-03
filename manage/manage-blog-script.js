// manage/manage-blog-script.js
import { db } from '../auth/firebase-config.js';
import { formatDate, showModal, hideModal } from './admin-utils.js';
import {
    collection, getDocs, doc, updateDoc, addDoc, deleteDoc,
    orderBy, query, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- Element Selectors ---
    const addNewArticleBtn = document.getElementById('add-new-article-btn');
    const articlesTableContainer = document.getElementById('articles-table-container');
    const articlesLoadingMsg = document.getElementById('articles-loading');
    const articleModal = document.getElementById('article-modal');
    const articleModalTitle = document.getElementById('article-modal-title');
    const articleForm = document.getElementById('article-form');
    const articleDocumentId = document.getElementById('article-document-id');
    const articleTitleInput = document.getElementById('article-title');
    const articleCategoryInput = document.getElementById('article-category');
    const articleExcerptInput = document.getElementById('article-excerpt');
    const articleAllowCommentsCheckbox = document.getElementById('article-allow-comments');
    const articleStatusCheckbox = document.getElementById('article-status');
    
    let quillEditor = null;

    // --- Helper Functions ---
    const formatDate = (firebaseTimestamp) => {
        if (!firebaseTimestamp || typeof firebaseTimestamp.toDate !== 'function') return 'N/A';
        return firebaseTimestamp.toDate().toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
    };
    const showModal = (modalElement) => { modalElement.classList.add('show'); document.getElementById('overlay').classList.add('active'); };
    const hideModal = (modalElement) => { modalElement.classList.remove('show'); document.getElementById('overlay').classList.remove('active'); };

    // --- Core Blog Management Functions ---
    function initializeQuillEditor() {
        if (!quillEditor) {
            quillEditor = new Quill('#editor-container', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'link'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['clean']
                    ]
                }
            });
        }
    }
    
    async function openArticleModal(article = null) {
        articleForm.reset();
        articleDocumentId.value = '';
        initializeQuillEditor();
        quillEditor.root.innerHTML = '';
        if (article) {
            articleModalTitle.textContent = "تعديل مقال";
            articleDocumentId.value = article.id;
            articleTitleInput.value = article.title || '';
            articleCategoryInput.value = article.category || '';
            articleExcerptInput.value = article.excerpt || '';
            quillEditor.root.innerHTML = article.content || '';
            articleAllowCommentsCheckbox.checked = article.allowComments !== false;
            articleStatusCheckbox.checked = article.status === 'published';
        } else {
            articleModalTitle.textContent = "إضافة مقال جديد";
            articleAllowCommentsCheckbox.checked = true;
            articleStatusCheckbox.checked = true;
        }
        showModal(articleModal);
    }
    
    async function saveArticle(event) {
        event.preventDefault();
        const docId = articleDocumentId.value;
        const slug = articleTitleInput.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
        const articleData = {
            title: articleTitleInput.value.trim(),
            category: articleCategoryInput.value.trim(),
            excerpt: articleExcerptInput.value.trim(),
            content: quillEditor.root.innerHTML,
            slug: slug,
            allowComments: articleAllowCommentsCheckbox.checked,
            status: articleStatusCheckbox.checked ? 'published' : 'draft',
            authorName: "Admin",
            updatedAt: serverTimestamp()
        };
        try {
            if (docId) {
                await updateDoc(doc(db, "articles", docId), articleData);
            } else {
                articleData.createdAt = serverTimestamp();
                articleData.publishedAt = articleStatusCheckbox.checked ? serverTimestamp() : null;
                await addDoc(collection(db, "articles"), articleData);
            }
            alert("تم حفظ المقال بنجاح!");
            hideModal(articleModal);
            fetchAllArticles();
        } catch (error) {
            alert(`فشل حفظ المقال: ${error.message}`);
            console.error("Error saving article:", error);
        }
    }

    async function deleteArticle(docId, title) {
        if (confirm(`هل أنت متأكد من رغبتك في حذف المقال "${title}"؟`)) {
            try {
                await deleteDoc(doc(db, "articles", docId));
                alert("تم حذف المقال بنجاح.");
                fetchAllArticles();
            } catch (error) {
                alert(`فشل حذف المقال: ${error.message}`);
            }
        }
    }

    async function fetchAllArticles() {
        if(!articlesLoadingMsg || !articlesTableContainer) return;
        articlesLoadingMsg.style.display = 'block';
        articlesTableContainer.innerHTML = '<p id="articles-loading" style="text-align:center; padding: 20px;">جارٍ تحميل المقالات...</p>';
        try {
            const q = query(collection(db, "articles"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                articlesTableContainer.innerHTML = "<p>لم يتم إضافة مقالات بعد.</p>";
                return;
            }
            const table = document.createElement('table');
            table.innerHTML = `<thead><tr><th>العنوان</th><th>التصنيف</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr></thead><tbody></tbody>`;
            const tbody = table.querySelector('tbody');
            querySnapshot.forEach(docSnapshot => {
                const article = { id: docSnapshot.id, ...docSnapshot.data() };
                const row = tbody.insertRow();
                row.innerHTML = `<td>${article.title}</td><td>${article.category}</td><td><span class="status-tag ${article.status === 'published' ? 'status-completed' : 'status-pending'}">${article.status === 'published' ? 'منشور' : 'مسودة'}</span></td><td>${formatDate(article.createdAt)}</td><td><button class="button secondary edit-article-btn">تعديل</button><button class="button danger delete-article-btn">حذف</button></td>`;
                row.querySelector('.edit-article-btn').onclick = () => openArticleModal(article);
                row.querySelector('.delete-article-btn').onclick = () => deleteArticle(article.id, article.title);
            });
            articlesTableContainer.innerHTML = '';
            articlesTableContainer.appendChild(table);
        } catch (error) {
            articlesTableContainer.innerHTML = `<p style="color:red;">فشل تحميل المقالات: ${error.message}</p>`;
            console.error("Error fetching articles:", error);
        }
    }

    // --- View Initializer ---
    window.initializeBlogManagementView = fetchAllArticles;

    // --- Event Listeners ---
    addNewArticleBtn?.addEventListener('click', () => openArticleModal());
    articleForm?.addEventListener('submit', saveArticle);
    articleModal?.querySelectorAll('.close-modal-btn, .cancel-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => hideModal(articleModal));
    });

});