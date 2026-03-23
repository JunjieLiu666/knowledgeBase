// 知识库博客系统交互脚本

class KnowledgeBlog {
    constructor() {
        this.apiBase = '/api';
        this.articles = [];
        this.currentPage = 1;
        this.articlesPerPage = 6;
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.init();
    }

    async init() {
        await this.loadArticles();
        this.bindEvents();
        this.renderArticles();
        this.updateStats();
    }

    async loadArticles() {
        try {
            const response = await fetch(`${this.apiBase}/articles`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.articles = await response.json();
        } catch (error) {
            console.error('加载文章失败:', error);
            this.showNotification('无法连接到服务器，请确保已启动后端服务 (python main.py)', 'error');
            // 显示空状态提示
            const container = document.getElementById('articlesContainer');
            if (container) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #7f8c8d;">
                        <i class="fas fa-server" style="font-size: 48px; margin-bottom: 20px;"></i>
                        <h3>无法连接到服务器</h3>
                        <p style="margin-top: 10px;">请先启动后端服务：</p>
                        <code style="background: #f0f0f0; padding: 8px 16px; border-radius: 4px; display: inline-block; margin-top: 10px;">python main.py</code>
                    </div>
                `;
            }
        }
    }

    async updateStats() {
        try {
            const response = await fetch(`${this.apiBase}/stats`);
            const stats = await response.json();

            // 更新分类计数
            const categoryItems = document.querySelectorAll('.category-item');
            categoryItems.forEach(item => {
                const category = item.dataset.category;
                const countEl = item.querySelector('.count');
                if (countEl) {
                    if (category === 'all') {
                        countEl.textContent = stats.total;
                    } else {
                        const catStat = stats.categories.find(c => c.category === category);
                        countEl.textContent = catStat ? catStat.count : 0;
                    }
                }
            });
        } catch (error) {
            console.error('更新统计失败:', error);
        }
    }

    getFilteredArticles() {
        let filtered = this.articles;

        // 分类筛选
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(a => a.category === this.currentCategory);
        }

        // 搜索筛选
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(a => {
                const title = a.title.toLowerCase();
                const content = a.content.toLowerCase();
                const tags = (a.tags || '').toLowerCase();
                return title.includes(query) || content.includes(query) || tags.includes(query);
            });
        }

        return filtered;
    }

    renderArticles() {
        const container = document.getElementById('articlesContainer');
        if (!container) return;

        const filtered = this.getFilteredArticles();
        const startIndex = (this.currentPage - 1) * this.articlesPerPage;
        const endIndex = startIndex + this.articlesPerPage;
        const pageArticles = filtered.slice(startIndex, endIndex);

        container.innerHTML = pageArticles.map(article => this.createArticleCard(article)).join('');

        this.bindArticleClickEvents();
        this.updatePagination(filtered.length);
    }

    renderMarkdown(content) {
        if (typeof marked !== 'undefined') {
            // 配置marked选项
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            return marked.parse(content);
        }
        // 如果marked库未加载，返回原始内容
        return content.replace(/\n/g, '<br>');
    }

    createArticleCard(article) {
        const categoryNames = {
            'tech': '编程技术',
            'project': '项目文档',
            'study': '学习笔记',
            'idea': '灵感想法'
        };

        const tags = article.tags ? article.tags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join('') : '';

        // 获取摘要（前200个字符）
        const plainText = article.content.replace(/[#*`>\-\[\]]/g, '').replace(/\n/g, ' ');
        const summary = plainText.length > 200 ? plainText.substring(0, 200) + '...' : plainText;

        return `
            <article class="article-card" data-id="${article.id}">
                <div class="article-header">
                    <div class="article-meta">
                        <span class="category-badge ${article.category}">${categoryNames[article.category] || article.category}</span>
                        <span class="article-date"><i class="fas fa-calendar-alt"></i> ${article.created_at}</span>
                        <span class="article-views"><i class="fas fa-eye"></i> ${article.views}</span>
                    </div>
                    <div class="article-actions">
                        <button class="btn-action" title="编辑"><i class="fas fa-edit"></i></button>
                        <button class="btn-action" title="删除"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <h2 class="article-title clickable-title">${article.title}</h2>
                <div class="article-tags">${tags}</div>
                <div class="article-summary">${summary}</div>
                <div class="article-footer">
                    <button class="btn-read-more">阅读全文 <i class="fas fa-arrow-right"></i></button>
                </div>
            </article>
        `;
    }

    updatePagination(total) {
        const totalPages = Math.ceil(total / this.articlesPerPage);
        const pagination = document.querySelector('.pagination');
        if (!pagination) return;

        let html = `<button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}">${i}</button>`;
        }

        html += `<button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        pagination.innerHTML = html;

        this.bindPaginationEvents(totalPages);
    }

    bindPaginationEvents(totalPages) {
        const buttons = document.querySelectorAll('.page-btn');
        buttons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                if (index === 0) {
                    // 上一页
                    if (this.currentPage > 1) {
                        this.currentPage--;
                        this.renderArticles();
                    }
                } else if (index === buttons.length - 1) {
                    // 下一页
                    if (this.currentPage < totalPages) {
                        this.currentPage++;
                        this.renderArticles();
                    }
                } else {
                    // 具体页码
                    this.currentPage = index;
                    this.renderArticles();
                }
            });
        });
    }

    bindToolbarEvents() {
        const toolbarBtns = document.querySelectorAll('.toolbar-btn');
        const textarea = document.getElementById('docContent');

        toolbarBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.insertMarkdown(action, textarea);
            });
        });
    }

    insertMarkdown(action, textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let replacement = '';
        let cursorOffset = 0;

        switch (action) {
            case 'bold':
                replacement = `**${selectedText || '粗体文字'}**`;
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'italic':
                replacement = `*${selectedText || '斜体文字'}*`;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'heading':
                replacement = `\n## ${selectedText || '标题'}\n`;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'link':
                replacement = `[${selectedText || '链接文字'}](url)`;
                cursorOffset = selectedText ? -1 : -5;
                break;
            case 'image':
                replacement = `![${selectedText || '图片描述'}](图片URL)`;
                cursorOffset = selectedText ? -1 : -5;
                break;
            case 'list':
                replacement = `\n- ${selectedText || '列表项'}\n`;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'quote':
                replacement = `\n> ${selectedText || '引用内容'}\n`;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'code':
                if (selectedText.includes('\n')) {
                    replacement = `\n\`\`\`\n${selectedText}\n\`\`\`\n`;
                } else {
                    replacement = `\`${selectedText || '代码'}\``;
                    cursorOffset = selectedText ? 0 : -1;
                }
                break;
            case 'hr':
                replacement = '\n---\n';
                break;
        }

        // 插入文本
        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);

        // 设置光标位置
        const newPos = start + replacement.length + cursorOffset;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
    }

    bindEvents() {
        // 编辑器工具栏
        this.bindToolbarEvents();

        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.currentPage = 1;
                this.renderArticles();
            });
        }

        // 分类切换
        const categoryItems = document.querySelectorAll('.category-item');
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                categoryItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.currentCategory = item.dataset.category;
                this.currentPage = 1;
                this.renderArticles();
            });
        });

        // 新建文章按钮
        const addDocBtn = document.getElementById('addDocBtn');
        if (addDocBtn) {
            addDocBtn.addEventListener('click', () => {
                this.openModal('docModal');
            });
        }

        // 关闭模态框
        const closeModal = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelBtn');

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal('docModal');
            });
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal('docModal');
            });
        }

        // 保存文章
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveArticle();
            });
        }

        // 返回列表按钮
        const backBtn = document.getElementById('backToList');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.hideArticleDetail();
            });
        }

        // 详情页编辑按钮
        const editDetailBtn = document.getElementById('editDetailArticle');
        if (editDetailBtn) {
            editDetailBtn.addEventListener('click', () => {
                if (this.currentArticle) {
                    this.editArticle(this.currentArticle);
                    this.hideArticleDetail();
                }
            });
        }

        // 详情页删除按钮
        const deleteDetailBtn = document.getElementById('deleteDetailArticle');
        if (deleteDetailBtn) {
            deleteDetailBtn.addEventListener('click', () => {
                if (this.currentArticle) {
                    this.deleteArticle(this.currentArticle.id);
                    this.hideArticleDetail();
                }
            });
        }

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    this.closeModal(modal.id);
                });
            }
        });
    }

    bindArticleClickEvents() {
        const articles = document.querySelectorAll('.article-card');
        articles.forEach(article => {
            const articleId = parseInt(article.dataset.id);

            // 点击标题跳转
            const title = article.querySelector('.article-title');
            if (title) {
                title.style.cursor = 'pointer';
                title.addEventListener('click', () => {
                    this.showArticleDetail(articleId);
                });
            }

            // 点击阅读全文按钮跳转
            const readMoreBtn = article.querySelector('.btn-read-more');
            if (readMoreBtn) {
                readMoreBtn.addEventListener('click', () => {
                    this.showArticleDetail(articleId);
                });
            }

            // 编辑按钮
            const editBtn = article.querySelector('.article-actions .btn-action:first-child');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editArticle(this.articles.find(a => a.id === articleId));
                });
            }

            // 删除按钮
            const deleteBtn = article.querySelector('.article-actions .btn-action:last-child');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteArticle(articleId);
                });
            }
        });
    }

    async showArticleDetail(articleId) {
        const article = this.articles.find(a => a.id === articleId);
        if (!article) return;

        // 增加阅读量
        try {
            await fetch(`${this.apiBase}/articles/${articleId}/view`, { method: 'POST' });
            article.views++;
        } catch (error) {
            console.error('更新阅读量失败:', error);
        }

        this.currentArticle = article;

        const categoryNames = {
            'tech': '编程技术',
            'project': '项目文档',
            'study': '学习笔记',
            'idea': '灵感想法'
        };

        // 填充详情页
        document.getElementById('detailTitle').textContent = article.title;
        document.getElementById('detailCategory').textContent = categoryNames[article.category] || article.category;
        document.getElementById('detailCategory').className = 'category-badge ' + article.category;
        document.getElementById('detailDate').textContent = article.created_at;
        document.getElementById('detailViews').textContent = article.views;

        const tags = article.tags ? article.tags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join('') : '';
        document.getElementById('detailTags').innerHTML = tags;
        // 使用Markdown渲染内容
        document.getElementById('detailBody').innerHTML = this.renderMarkdown(article.content);

        // 切换视图
        const detailView = document.getElementById('articleDetailView');
        const articlesContainer = document.getElementById('articlesContainer');
        const pagination = document.querySelector('.pagination');

        articlesContainer.style.display = 'none';
        pagination.style.display = 'none';
        detailView.style.display = 'block';

        // 滚动到顶部
        window.scrollTo(0, 0);
    }

    hideArticleDetail() {
        const detailView = document.getElementById('articleDetailView');
        const articlesContainer = document.getElementById('articlesContainer');
        const pagination = document.querySelector('.pagination');

        detailView.style.display = 'none';
        articlesContainer.style.display = 'grid';
        pagination.style.display = 'flex';

        this.renderArticles();
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            // 重置表单
            document.getElementById('docTitle').value = '';
            document.getElementById('docCategory').value = 'tech';
            document.getElementById('docTags').value = '';
            document.getElementById('docContent').value = '';
            document.getElementById('modalTitle').textContent = '写文章';
            this.editingArticleId = null;
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    editArticle(article) {
        this.editingArticleId = article.id;
        document.getElementById('docTitle').value = article.title;
        document.getElementById('docCategory').value = article.category;
        document.getElementById('docTags').value = article.tags || '';
        document.getElementById('docContent').value = article.content;
        document.getElementById('modalTitle').textContent = '编辑文章';
        // 直接打开模态框，不重置表单
        const modal = document.getElementById('docModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    async saveArticle() {
        const title = document.getElementById('docTitle').value;
        const category = document.getElementById('docCategory').value;
        const tags = document.getElementById('docTags').value;
        const content = document.getElementById('docContent').value;

        if (!title || !content) {
            this.showNotification('请填写标题和内容', 'error');
            return;
        }

        const data = { title, category, tags, content };

        try {
            if (this.editingArticleId) {
                // 更新
                await fetch(`${this.apiBase}/articles/${this.editingArticleId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                this.showNotification('文章更新成功');
            } else {
                // 创建
                await fetch(`${this.apiBase}/articles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                this.showNotification('文章发布成功');
            }

            this.closeModal('docModal');
            await this.loadArticles();
            this.renderArticles();
            this.updateStats();
        } catch (error) {
            console.error('保存失败:', error);
            this.showNotification('保存失败', 'error');
        }
    }

    async deleteArticle(articleId) {
        if (!confirm('确定要删除这篇文章吗？')) return;

        try {
            await fetch(`${this.apiBase}/articles/${articleId}`, {
                method: 'DELETE'
            });
            this.showNotification('文章已删除');
            await this.loadArticles();
            this.renderArticles();
            this.updateStats();
        } catch (error) {
            console.error('删除失败:', error);
            this.showNotification('删除失败', 'error');
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 3000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100px); }
    }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.knowledgeBlog = new KnowledgeBlog();
});
