// 知识库博客系统交互脚本

class KnowledgeBlog {
    constructor() {
        this.apiBase = '/api';
        this.articles = [];
        this.currentPage = 1;
        this.articlesPerPage = 6;
        this.currentCategory = 'all';
        this.searchQuery = '';

        // 分类名称映射
        this.categoryNames = {
            'all': '全部文章',
            'tech': '编程技术',
            'project': '项目文档',
            'study': '学习笔记',
            'idea': '灵感想法'
        };

        // 分类图标映射
        this.categoryIcons = {
            'tech': 'fa-code',
            'project': 'fa-project-diagram',
            'study': 'fa-graduation-cap',
            'idea': 'fa-lightbulb'
        };

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
            // 先解析Markdown，然后处理HTML标签
            let html = marked.parse(content);
            return html;
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

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileNameEl = document.getElementById('fileName');
        fileNameEl.textContent = file.name;
        fileNameEl.style.color = '#27ae60';

        // 获取文件扩展名
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileTypes = {
            'docx': 'Word',
            'doc': 'Word',
            'pdf': 'PDF',
            'ofd': 'OFD'
        };
        const fileType = fileTypes[fileExt] || '文件';

        // 显示加载状态
        this.showNotification(`正在解析${fileType}文件...`, 'success');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${this.apiBase}/upload/file`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                // 填充表单
                document.getElementById('docTitle').value = result.title;
                document.getElementById('docContent').value = result.content;
                this.showNotification(`${fileType}文件解析成功`, 'success');
            } else {
                this.showNotification(result.error || '解析失败', 'error');
                fileNameEl.textContent = '解析失败，请重试';
                fileNameEl.style.color = '#e74c3c';
            }
        } catch (error) {
            console.error('上传失败:', error);
            this.showNotification('上传失败，请检查网络连接', 'error');
            fileNameEl.textContent = '上传失败';
            fileNameEl.style.color = '#e74c3c';
        }

        // 清空文件输入，允许重复上传同一文件
        event.target.value = '';
    }

    bindEvents() {
        // 编辑器工具栏
        this.bindToolbarEvents();

        // 文件上传
        const uploadFileBtn = document.getElementById('uploadFileBtn');
        const fileInput = document.getElementById('fileInput');
        if (uploadFileBtn && fileInput) {
            uploadFileBtn.addEventListener('click', () => {
                fileInput.click();
            });
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e);
            });
        }

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

        // 设置按钮 - 打开系统设置
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }

        // 系统设置模态框关闭
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        if (closeSettingsModal) {
            closeSettingsModal.addEventListener('click', () => {
                this.closeModal('settingsModal');
            });
        }

        // 设置标签页切换
        const settingsTabs = document.querySelectorAll('.settings-tab');
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchSettingsTab(tabName);
            });
        });

        // 添加分类按钮
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => {
                this.addCategory();
            });
        }

        // 主题颜色选择
        const themeColorOptions = document.querySelectorAll('.theme-color-option');
        themeColorOptions.forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.changeTheme(theme);
            });
        });

        // 字体大小选择
        const fontSizeBtns = document.querySelectorAll('.font-size-btn');
        fontSizeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                this.changeFontSize(size);
            });
        });

        // 显示设置
        const showArticleViews = document.getElementById('showArticleViews');
        if (showArticleViews) {
            showArticleViews.addEventListener('change', (e) => {
                this.updateDisplaySetting('showViews', e.target.checked);
            });
        }

        const showArticleDate = document.getElementById('showArticleDate');
        if (showArticleDate) {
            showArticleDate.addEventListener('change', (e) => {
                this.updateDisplaySetting('showDate', e.target.checked);
            });
        }

        const showArticleTags = document.getElementById('showArticleTags');
        if (showArticleTags) {
            showArticleTags.addEventListener('change', (e) => {
                this.updateDisplaySetting('showTags', e.target.checked);
            });
        }

        const articlesPerPageSelect = document.getElementById('articlesPerPageSelect');
        if (articlesPerPageSelect) {
            articlesPerPageSelect.addEventListener('change', (e) => {
                this.articlesPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.renderArticles();
                this.saveSettings();
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

        // 生成并显示文章大纲
        this.generateOutline();

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

    generateOutline() {
        const detailBody = document.getElementById('detailBody');
        const outlineContent = document.getElementById('outlineContent');
        const outlineElement = document.getElementById('detailOutline');

        // 查找所有标题元素
        const headings = detailBody.querySelectorAll('h1, h2, h3, h4, h5, h6');

        if (headings.length === 0) {
            outlineElement.style.display = 'none';
            return;
        }

        outlineElement.style.display = 'block';

        // 生成大纲列表
        let outlineHTML = '<ul class="outline-list">';

        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent.trim();
            const id = `heading-${index}`;

            // 为标题添加ID，用于锚点跳转
            heading.id = id;

            // 根据标题级别添加缩进
            const indent = (level - 1) * 16;

            outlineHTML += `
                <li class="outline-item outline-level-${level}" style="padding-left: ${indent}px;">
                    <a href="#${id}" class="outline-link" data-heading-id="${id}">
                        ${text}
                    </a>
                </li>
            `;
        });

        outlineHTML += '</ul>';
        outlineContent.innerHTML = outlineHTML;

        // 添加点击事件，实现平滑滚动
        const outlineLinks = outlineContent.querySelectorAll('.outline-link');
        outlineLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const headingId = link.getAttribute('data-heading-id');
                const headingElement = document.getElementById(headingId);

                if (headingElement) {
                    // 平滑滚动到标题位置
                    headingElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // 高亮当前选中的大纲项
                    outlineLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        });
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

    // 系统设置相关方法
    openSettings() {
        this.renderCategoryList();
        this.loadSettings();
        this.openModal('settingsModal');
    }

    switchSettingsTab(tabName) {
        // 切换标签页
        const tabs = document.querySelectorAll('.settings-tab');
        const panels = document.querySelectorAll('.settings-panel');

        tabs.forEach(tab => tab.classList.remove('active'));
        panels.forEach(panel => panel.classList.remove('active'));

        document.querySelector(`.settings-tab[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Panel`).classList.add('active');
    }

    changeTheme(theme) {
        const themeColors = {
            'default': { primary: '#3498db', accent: '#3498db', hover: '#2980b9' },
            'green': { primary: '#27ae60', accent: '#27ae60', hover: '#229954' },
            'purple': { primary: '#9b59b6', accent: '#9b59b6', hover: '#8e44ad' },
            'orange': { primary: '#e67e22', accent: '#e67e22', hover: '#d35400' },
            'red': { primary: '#e74c3c', accent: '#e74c3c', hover: '#c0392b' },
            'dark': { primary: '#2c3e50', accent: '#3498db', hover: '#34495e' }
        };

        const colors = themeColors[theme];
        if (colors) {
            document.documentElement.style.setProperty('--primary-color', colors.primary);
            document.documentElement.style.setProperty('--accent-color', colors.accent);
            document.documentElement.style.setProperty('--accent-hover', colors.hover);

            // 更新选中状态
            document.querySelectorAll('.theme-color-option').forEach(opt => {
                opt.classList.remove('active');
            });
            document.querySelector(`.theme-color-option[data-theme="${theme}"]`).classList.add('active');

            this.currentTheme = theme;
            this.saveSettings();
            this.showNotification('主题已更换', 'success');
        }
    }

    changeFontSize(size) {
        const fontSizes = {
            'small': '14px',
            'medium': '16px',
            'large': '18px'
        };

        if (fontSizes[size]) {
            document.documentElement.style.setProperty('--base-font-size', fontSizes[size]);

            // 更新选中状态
            document.querySelectorAll('.font-size-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`.font-size-btn[data-size="${size}"]`).classList.add('active');

            this.currentFontSize = size;
            this.saveSettings();
            this.showNotification('字体大小已调整', 'success');
        }
    }

    updateDisplaySetting(key, value) {
        if (!this.displaySettings) {
            this.displaySettings = {};
        }
        this.displaySettings[key] = value;
        this.saveSettings();
        this.renderArticles();
    }

    saveSettings() {
        const settings = {
            theme: this.currentTheme || 'default',
            fontSize: this.currentFontSize || 'medium',
            displaySettings: this.displaySettings || { showViews: true, showDate: true, showTags: true },
            articlesPerPage: this.articlesPerPage,
            categoryNames: this.categoryNames,
            categoryIcons: this.categoryIcons
        };
        localStorage.setItem('knowledgeBlogSettings', JSON.stringify(settings));
    }

    loadSettings() {
        const saved = localStorage.getItem('knowledgeBlogSettings');
        if (saved) {
            const settings = JSON.parse(saved);

            // 应用主题
            if (settings.theme) {
                this.changeTheme(settings.theme);
            }

            // 应用字体大小
            if (settings.fontSize) {
                this.changeFontSize(settings.fontSize);
            }

            // 应用显示设置
            if (settings.displaySettings) {
                this.displaySettings = settings.displaySettings;
                const showViews = document.getElementById('showArticleViews');
                const showDate = document.getElementById('showArticleDate');
                const showTags = document.getElementById('showArticleTags');

                if (showViews) showViews.checked = settings.displaySettings.showViews;
                if (showDate) showDate.checked = settings.displaySettings.showDate;
                if (showTags) showTags.checked = settings.displaySettings.showTags;
            }

            // 应用每页文章数
            if (settings.articlesPerPage) {
                this.articlesPerPage = settings.articlesPerPage;
                const select = document.getElementById('articlesPerPageSelect');
                if (select) select.value = settings.articlesPerPage;
            }

            // 应用分类设置
            if (settings.categoryNames) {
                this.categoryNames = settings.categoryNames;
            }
            if (settings.categoryIcons) {
                this.categoryIcons = settings.categoryIcons;
            }
        }
    }

    // 分类管理相关方法
    openCategoryManager() {
        this.renderCategoryList();
        this.openModal('settingsModal');
    }

    renderCategoryList() {
        const manageCategoryList = document.getElementById('manageCategoryList');
        if (!manageCategoryList) return;

        // 获取所有分类（排除"全部"）
        const categories = Object.entries(this.categoryNames).filter(([key]) => key !== 'all');

        let html = '';
        categories.forEach(([key, name]) => {
            const count = this.articles.filter(a => a.category === key).length;
            html += `
                <li class="manage-category-item">
                    <div class="category-info">
                        <i class="fas ${this.categoryIcons[key] || 'fa-folder'}"></i>
                        <span class="category-name">${name}</span>
                        <span class="category-key">(${key})</span>
                        <span class="category-count">${count}篇文章</span>
                    </div>
                    <div class="category-actions">
                        <button class="btn-edit-category" data-key="${key}" title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete-category" data-key="${key}" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </li>
            `;
        });

        manageCategoryList.innerHTML = html;

        // 绑定编辑和删除事件
        manageCategoryList.querySelectorAll('.btn-edit-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.currentTarget.dataset.key;
                this.editCategory(key);
            });
        });

        manageCategoryList.querySelectorAll('.btn-delete-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.currentTarget.dataset.key;
                this.deleteCategory(key);
            });
        });
    }

    addCategory() {
        const nameInput = document.getElementById('newCategoryName');
        const iconInput = document.getElementById('newCategoryIcon');
        const keyInput = document.getElementById('newCategoryKey');

        const name = nameInput.value.trim();
        const icon = iconInput.value.trim() || 'fa-folder';
        const key = keyInput.value.trim().toLowerCase();

        if (!name || !key) {
            this.showNotification('请填写分类名称和键名', 'error');
            return;
        }

        // 检查键名是否已存在
        if (this.categoryNames[key]) {
            this.showNotification('该分类键名已存在', 'error');
            return;
        }

        // 添加新分类
        this.categoryNames[key] = name;
        this.categoryIcons[key] = icon;

        // 更新左侧分类列表
        this.updateCategorySidebar();

        // 清空输入框
        nameInput.value = '';
        iconInput.value = '';
        keyInput.value = '';

        // 重新渲染管理列表
        this.renderCategoryList();

        this.showNotification('分类添加成功', 'success');
    }

    editCategory(key) {
        const currentName = this.categoryNames[key];
        const currentIcon = this.categoryIcons[key] || 'fa-folder';

        const newName = prompt('请输入新的分类名称:', currentName);
        if (newName && newName.trim()) {
            this.categoryNames[key] = newName.trim();
            this.updateCategorySidebar();
            this.renderCategoryList();
            this.showNotification('分类更新成功', 'success');
        }
    }

    deleteCategory(key) {
        // 检查是否有文章使用该分类
        const count = this.articles.filter(a => a.category === key).length;
        if (count > 0) {
            this.showNotification(`该分类下有${count}篇文章，无法删除`, 'error');
            return;
        }

        if (confirm(`确定要删除分类"${this.categoryNames[key]}"吗？`)) {
            delete this.categoryNames[key];
            delete this.categoryIcons[key];
            this.updateCategorySidebar();
            this.renderCategoryList();
            this.showNotification('分类删除成功', 'success');
        }
    }

    updateCategorySidebar() {
        const categoryList = document.querySelector('.category-list');
        if (!categoryList) return;

        // 保留"全部文章"项
        let html = `
            <li class="category-item ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all">
                <i class="fas fa-th-large"></i>
                <span>全部文章</span>
                <span class="count">${this.articles.length}</span>
            </li>
        `;

        // 添加其他分类
        Object.entries(this.categoryNames).forEach(([key, name]) => {
            if (key === 'all') return;
            const count = this.articles.filter(a => a.category === key).length;
            html += `
                <li class="category-item ${this.currentCategory === key ? 'active' : ''}" data-category="${key}">
                    <i class="fas ${this.categoryIcons[key] || 'fa-folder'}"></i>
                    <span>${name}</span>
                    <span class="count">${count}</span>
                </li>
            `;
        });

        categoryList.innerHTML = html;

        // 重新绑定分类切换事件
        const categoryItems = categoryList.querySelectorAll('.category-item');
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                categoryItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.currentCategory = item.dataset.category;
                this.currentPage = 1;
                this.renderArticles();
            });
        });
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
