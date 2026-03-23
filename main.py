# 知识库后端服务
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# 数据库路径
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'knowledge.db')


def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """初始化数据库"""
    conn = get_db()
    cursor = conn.cursor()

    # 创建文章表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT,
            views INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')

    # 检查是否有数据，没有则插入示例数据
    cursor.execute('SELECT COUNT(*) FROM articles')
    if cursor.fetchone()[0] == 0:
        sample_articles = [
            ('Python装饰器详解', 'tech', '装饰器是Python中一个非常强大的功能，它允许我们在不修改原函数代码的情况下，为函数添加额外的功能。装饰器本质上是一个函数，它接受一个函数作为参数，并返回一个新的函数。常用于日志记录、性能测试、权限验证、缓存和重试机制等场景。', 'Python,装饰器,高级特性', 128, '2024-03-15', '2024-03-15'),
            ('RESTful API设计规范', 'project', 'RESTful API是一种软件架构风格，用于设计网络应用程序。它基于HTTP协议，使用标准的HTTP方法（GET、POST、PUT、DELETE）来操作资源。良好的API设计应该遵循统一接口、无状态、可缓存等原则。', 'API,RESTful,后端', 95, '2024-03-12', '2024-03-12'),
            ('Vue3组合式API学习笔记', 'study', 'Vue3引入了组合式API（Composition API），提供了一种更灵活的方式来组织组件逻辑。相比选项式API，组合式API允许我们将相关逻辑放在一起，提高代码的可读性和复用性。', 'Vue3,JavaScript,前端', 156, '2024-03-10', '2024-03-10'),
            ('Docker容器化部署实践', 'tech', 'Docker是一种容器化技术，可以将应用程序及其依赖打包到一个可移植的容器中。本文介绍了Docker的基本概念、常用命令以及如何使用Docker部署Web应用。', 'Docker,DevOps,容器', 89, '2024-03-08', '2024-03-08'),
            ('机器学习入门指南', 'study', '机器学习是人工智能的一个分支，它使计算机能够从数据中学习并做出决策或预测。本文介绍了机器学习的基本概念、常见算法以及学习路径。', '机器学习,AI,Python', 234, '2024-03-05', '2024-03-05'),
            ('Git工作流最佳实践', 'tech', 'Git是现代软件开发中不可或缺的版本控制工具。本文介绍了Git分支管理策略、提交规范以及团队协作中的最佳实践。', 'Git,版本控制,协作', 167, '2024-03-03', '2024-03-03'),
            ('个人知识管理系统设计', 'idea', '如何构建一个高效的个人知识管理系统？本文探讨了知识管理的核心理念、工具选择以及信息组织方法。', '知识管理,效率,方法论', 78, '2024-03-01', '2024-03-01'),
            ('TypeScript高级类型技巧', 'tech', 'TypeScript提供了强大的类型系统，本文深入探讨了泛型、条件类型、映射类型等高级类型特性，帮助写出更安全的代码。', 'TypeScript,前端,类型系统', 112, '2024-02-28', '2024-02-28'),
            ('项目文档编写规范', 'project', '良好的项目文档是团队协作的基础。本文介绍了README、API文档、架构文档等的编写规范和常用工具。', '文档,规范,协作', 65, '2024-02-25', '2024-02-25'),
            ('正则表达式实战技巧', 'study', '正则表达式是文本处理的利器。本文通过实际案例讲解了常用正则表达式的写法和技巧。', '正则表达式,文本处理', 98, '2024-02-22', '2024-02-22'),
            ('微服务架构设计思考', 'idea', '微服务架构适合什么样的项目？它有哪些优势和挑战？本文分享了在微服务架构设计中的思考和经验。', '微服务,架构,后端', 145, '2024-02-20', '2024-02-20'),
            ('CSS Grid布局完全指南', 'tech', 'CSS Grid是一个强大的二维布局系统。本文全面介绍了Grid布局的属性、用法和实际应用场景。', 'CSS,布局,前端', 87, '2024-02-18', '2024-02-18'),
        ]
        cursor.executemany('''
            INSERT INTO articles (title, category, content, tags, views, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', sample_articles)

    conn.commit()
    conn.close()


@app.route('/')
def index():
    """主页"""
    return render_template('index.html')


@app.route('/api/articles', methods=['GET'])
def get_articles():
    """获取所有文章"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM articles ORDER BY created_at DESC')
    articles = cursor.fetchall()
    conn.close()

    return jsonify([dict(article) for article in articles])


@app.route('/api/articles/<int:article_id>', methods=['GET'])
def get_article(article_id):
    """获取单篇文章"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM articles WHERE id = ?', (article_id,))
    article = cursor.fetchone()
    conn.close()

    if article:
        return jsonify(dict(article))
    return jsonify({'error': '文章不存在'}), 404


@app.route('/api/articles', methods=['POST'])
def create_article():
    """创建文章"""
    data = request.get_json()
    now = datetime.now().strftime('%Y-%m-%d')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO articles (title, category, content, tags, views, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
    ''', (data['title'], data['category'], data['content'], data.get('tags', ''), now, now))
    article_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'id': article_id, 'message': '创建成功'}), 201


@app.route('/api/articles/<int:article_id>', methods=['PUT'])
def update_article(article_id):
    """更新文章"""
    data = request.get_json()
    now = datetime.now().strftime('%Y-%m-%d')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE articles SET title = ?, category = ?, content = ?, tags = ?, updated_at = ?
        WHERE id = ?
    ''', (data['title'], data['category'], data['content'], data.get('tags', ''), now, article_id))
    conn.commit()
    conn.close()

    return jsonify({'message': '更新成功'})


@app.route('/api/articles/<int:article_id>', methods=['DELETE'])
def delete_article(article_id):
    """删除文章"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM articles WHERE id = ?', (article_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': '删除成功'})


@app.route('/api/articles/<int:article_id>/view', methods=['POST'])
def increment_view(article_id):
    """增加阅读量"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE articles SET views = views + 1 WHERE id = ?', (article_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': '成功'})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """获取统计数据"""
    conn = get_db()
    cursor = conn.cursor()

    # 总文章数
    cursor.execute('SELECT COUNT(*) FROM articles')
    total = cursor.fetchone()[0]

    # 各分类文章数
    cursor.execute('SELECT category, COUNT(*) as count FROM articles GROUP BY category')
    categories = cursor.fetchall()

    conn.close()

    return jsonify({
        'total': total,
        'categories': [dict(c) for c in categories]
    })


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
