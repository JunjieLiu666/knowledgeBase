// 知识库博客系统交互脚本

class KnowledgeBlog {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.bindArticleClickEvents();
    }

    bindEvents() {
        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // 分类切换
        const categoryItems = document.querySelectorAll('.category-item');
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                this.switchCategory(item);
            });
        });

        // 标签点击
        document.querySelectorAll('.tag').forEach(tag => {
            tag.addEventListener('click', () => {
                this.filterByTag(tag.textContent);
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
                if (this.currentArticleCard) {
                    this.editArticle(this.currentArticleCard);
                    this.hideArticleDetail();
                }
            });
        }
        
        // 详情页删除按钮
        const deleteDetailBtn = document.getElementById('deleteDetailArticle');
        if (deleteDetailBtn) {
            deleteDetailBtn.addEventListener('click', () => {
                if (this.currentArticleCard) {
                    this.deleteArticle(this.currentArticleCard);
                    this.hideArticleDetail();
                }
            });
        }

        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveArticle();
            });
        }

        // 文章操作按钮
        document.querySelectorAll('.article-card').forEach(card => {
            this.bindArticleEvents(card);
        });

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

    bindArticleEvents(card) {
        // 展开/收起文章
        const readMoreBtn = card.querySelector('.btn-read-more');
        const content = card.querySelector('.article-content');
        
        if (readMoreBtn && content) {
            readMoreBtn.addEventListener('click', () => {
                const isExpanded = content.classList.toggle('expanded');
                readMoreBtn.innerHTML = isExpanded 
                    ? '收起文章 <i class="fas fa-chevron-up"></i>'
                    : '展开全文 <i class="fas fa-chevron-down"></i>';
            });
        }

        // 编辑按钮
        const editBtn = card.querySelector('.btn-action[title="编辑"]');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editArticle(card);
            });
        }

        // 删除按钮
        const deleteBtn = card.querySelector('.btn-action[title="删除"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteArticle(card);
            });
        }

        // 点击标题展开文章
        const title = card.querySelector('.article-title');
        if (title) {
            title.addEventListener('click', () => {
                if (!content.classList.contains('expanded')) {
                    content.classList.add('expanded');
                    readMoreBtn.innerHTML = '收起文章 <i class="fas fa-chevron-up"></i>';
                }
            });
        }
    }

    handleSearch(query) {
        const articles = document.querySelectorAll('.article-card');
        const lowerQuery = query.toLowerCase();
        
        articles.forEach(article => {
            const title = article.querySelector('.article-title').textContent.toLowerCase();
            const content = article.querySelector('.article-content').textContent.toLowerCase();
            const tags = Array.from(article.querySelectorAll('.article-tags .tag'))
                .map(t => t.textContent.toLowerCase()).join(' ');
            
            const searchText = `${title} ${content} ${tags}`;
            article.style.display = searchText.includes(lowerQuery) ? 'block' : 'none';
        });
    }

    switchCategory(item) {
        const categoryItems = document.querySelectorAll('.category-item');
        categoryItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const category = item.dataset.category;
        this.filterByCategory(category);
    }

    filterByCategory(category) {
        const articles = document.querySelectorAll('.article-card');
        
        if (category === 'all') {
            articles.forEach(article => article.style.display = 'block');
        } else {
            articles.forEach(article => {
                const badge = article.querySelector('.category-badge');
                const articleCategory = badge ? badge.classList[1] : '';
                article.style.display = articleCategory === category ? 'block' : 'none';
            });
        }
    }

    filterByTag(tag) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = tag;
            this.handleSearch(tag);
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    saveArticle() {
        const title = document.getElementById('docTitle').value;
        const category = document.getElementById('docCategory').value;
        const tags = document.getElementById('docTags').value;
        const content = document.getElementById('docContent').value;

        if (!title) {
            this.showNotification('请输入文章标题', 'error');
            return;
        }

        if (!content) {
            this.showNotification('请输入文章内容', 'error');
            return;
        }

        const articleData = {
            title,
            category,
            tags: tags.split(',').map(t => t.trim()).filter(t => t),
            content,
            createdAt: new Date().toISOString()
        };

        console.log('保存文章:', articleData);
        
        // 这里可以调用API保存文章
        this.closeModal('docModal');
        this.showNotification('文章发布成功！');
        this.clearForm();
        
        // 刷新页面或添加新文章到列表
        // location.reload();
    }

    clearForm() {
        document.getElementById('docTitle').value = '';
        document.getElementById('docCategory').value = 'tech';
        document.getElementById('docTags').value = '';
        document.getElementById('docContent').value = '';
    }

    editArticle(card) {
        const title = card.querySelector('.article-title').textContent;
        const content = card.querySelector('.article-content').innerText;
        const tags = Array.from(card.querySelectorAll('.article-tags .tag'))
            .map(t => t.textContent).join(', ');
        const categoryBadge = card.querySelector('.category-badge');
        const category = categoryBadge ? categoryBadge.classList[1] : 'tech';

        document.getElementById('modalTitle').textContent = '编辑文章';
        document.getElementById('docTitle').value = title;
        document.getElementById('docContent').value = content;
        document.getElementById('docTags').value = tags;
        document.getElementById('docCategory').value = category;

        this.openModal('docModal');
    }

    deleteArticle(card) {
        if (confirm('确定要删除这篇文章吗？')) {
            card.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                card.remove();
                this.showNotification('文章已删除');
            }, 300);
        }
    }


    // 文章详情相关方法
    showArticleDetail(articleCard) {
        const detailView = document.getElementById('articleDetailView');
        const articlesContainer = document.getElementById('articlesContainer');
        const pagination = document.querySelector('.pagination');
        
        // 获取文章数据
        const title = articleCard.querySelector('.article-title').textContent;
        const category = articleCard.querySelector('.category-badge').textContent;
        const categoryClass = articleCard.querySelector('.category-badge').classList[1];
        const date = articleCard.querySelector('.article-date').textContent.trim();
        const views = articleCard.querySelector('.article-views').textContent.trim();
        const tags = articleCard.querySelector('.article-tags').innerHTML;
        
        // 获取完整内容（从隐藏的 full-content 中获取，如果没有则使用 summary）
        let fullContent = articleCard.querySelector('.article-full-content');
        if (!fullContent) {
            // 如果没有完整内容，创建一个（将 summary 内容作为完整内容）
            const summary = articleCard.querySelector('.article-summary');
            fullContent = summary;
        }
        
        // 填充详情页
        document.getElementById('detailTitle').textContent = title;
        document.getElementById('detailCategory').textContent = category;
        document.getElementById('detailCategory').className = 'category-badge ' + categoryClass;
        document.getElementById('detailDate').textContent = date.replace(/^[\s\S]*?\s/, '');
        document.getElementById('detailViews').textContent = views.replace(/^[\s\S]*?\s/, '');
        document.getElementById('detailTags').innerHTML = tags;
        document.getElementById('detailBody').innerHTML = fullContent.innerHTML;
        
        // 保存当前文章卡片的引用
        this.currentArticleCard = articleCard;
        
        // 切换视图
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
        articlesContainer.style.display = 'block';
        pagination.style.display = 'flex';
    }
    
    // 为文章卡片绑定点击事件
    bindArticleClickEvents() {
        const articles = document.querySelectorAll('.article-card');
        articles.forEach(article => {
            // 点击标题跳转
            const title = article.querySelector('.article-title');
            if (title) {
                title.style.cursor = 'pointer';
                title.addEventListener('click', () => {
                    this.showArticleDetail(article);
                });
            }
            
            // 点击阅读全文按钮跳转
            const readMoreBtn = article.querySelector('.btn-read-more');
            if (readMoreBtn) {
                readMoreBtn.addEventListener('click', () => {
                    this.showArticleDetail(article);
                });
            }
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
