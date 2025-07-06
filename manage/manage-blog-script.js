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
    // Helper function for rudimentary Markdown to HTML conversion
    const convertMarkdownToHtml = (markdownText) => {
        let html = markdownText;

        // Convert headings (rudimentary) - Process longer headers first to avoid misinterpretations
        html = html.replace(/^####\s(.+)/gm, '<h4>$1</h4>'); // H4
        html = html.replace(/^###\s(.+)/gm, '<h3>$1</h3>'); // H3
        html = html.replace(/^##\s(.+)/gm, '<h2>$1</h2>'); // H2
        html = html.replace(/^#\s(.+)/gm, '<h1>$1</h1>');   // H1
        
        // Convert **bold** and *italic*
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert --- horizontal rule
        html = html.replace(/^-{3,}$/gm, '<hr>');

        // Convert `inline code`
        html = html.replace(/`(.*?)`/g, '<code>$1</code>'); // Add inline code support

        // Convert lists (basic, supports only single level using - or *)
        // This regex part captures lines starting with '*' or '-' followed by a space and content
        const listItemsRegex = /^[*-]\s(.+)/gm;
        let processedLines = html.split('\n'); // Split the entire HTML content by newlines for line-by-line processing

        let finalOutput = [];
        let inListBlock = false;

        for (let i = 0; i < processedLines.length; i++) {
            let line = processedLines[i];
            const listItemMatch = line.match(listItemsRegex); // Check if the line is a list item

            if (listItemMatch) {
                if (!inListBlock) {
                    finalOutput.push('<ul>'); // Start a new unordered list if not already inside one
                    inListBlock = true;
                }
                // Convert the matched list item line to an <li> tag
                finalOutput.push(`<li>${line.substring(line.indexOf(' ') + 1).trim()}</li>`);
            } else {
                if (inListBlock) {
                    finalOutput.push('</ul>'); // Close the list if ending a block of list items
                    inListBlock = false;
                }
                finalOutput.push(line); // Add non-list line as is
            }
        }
        if (inListBlock) { // Ensure the last list block is closed if the file ends with list items
            finalOutput.push('</ul>');
        }
        
        html = finalOutput.join('\n'); // Rejoin processed lines with list structures
        
        // Convert basic links (simplified) - [text](url) -> <a>
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

        return html;
    };


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
            quillEditor.root.innerHTML = article.content || ''; // Quill will handle display of HTML
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
        const slug = articleTitleInput.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

        // Convert Quill's raw HTML (which might contain basic Markdown characters user typed) to refined HTML
        const contentHtml = convertMarkdownToHtml(quillEditor.root.innerHTML);

        const articleData = {
            title: articleTitleInput.value.trim(),
            category: articleCategoryInput.value.trim(),
            excerpt: articleExcerptInput.value.trim(),
            content: contentHtml, // Use the converted HTML
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
    // Make this function available globally for admin-script.js to call
    window.initializeBlogManagementView = fetchAllArticles;

    // --- Event Listeners ---
    addNewArticleBtn?.addEventListener('click', () => openArticleModal());
    articleForm?.addEventListener('submit', saveArticle);
    articleModal?.querySelectorAll('.close-modal-btn, .cancel-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => hideModal(articleModal));
    });

});
