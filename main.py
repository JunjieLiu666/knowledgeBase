# 知识库后端服务
from flask import Flask, request, jsonify, render_template, send_from_directory, session
from flask_cors import CORS
import sqlite3
import os
import hashlib
import secrets
from datetime import datetime
from functools import wraps
from docx import Document
from docx.shared import Inches
from docx.oxml.ns import qn
import io
import uuid
import base64
import zipfile
import xml.etree.ElementTree as ET
import fitz  # PyMuPDF
import easyofd
import mimetypes

# 注册字体 MIME 类型 —— Windows 的 mimetypes 数据库不含 woff2/ttf，
# 若不注册，Flask 返回字体文件时缺少 Content-Type，浏览器会拒绝加载（图标显示为方框）
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('font/woff', '.woff')
mimetypes.add_type('font/ttf', '.ttf')

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
CORS(app, supports_credentials=True)

# 数据库路径
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'knowledge.db')
# 图片存储路径
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads', 'images')
# 附件存储路径
ATTACHMENT_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads', 'attachments')


def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """初始化数据库"""
    conn = get_db()
    cursor = conn.cursor()

    # 创建用户表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            created_at TEXT NOT NULL
        )
    ''')

    # 创建分类表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            icon TEXT NOT NULL DEFAULT 'fa-folder',
            sort_order INTEGER DEFAULT 0
        )
    ''')

    # 插入默认分类
    cursor.execute('SELECT COUNT(*) FROM categories')
    if cursor.fetchone()[0] == 0:
        default_categories = [
            ('tech', '编程技术', 'fa-code', 1),
            ('project', '项目文档', 'fa-project-diagram', 2),
            ('study', '学习笔记', 'fa-graduation-cap', 3),
            ('idea', '灵感想法', 'fa-lightbulb', 4),
        ]
        cursor.executemany('''
            INSERT INTO categories (key, name, icon, sort_order)
            VALUES (?, ?, ?, ?)
        ''', default_categories)

    # 创建附件表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
        )
    ''')

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

    # 创建默认管理员账号 (admin / admin123)
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        default_password = 'admin123'
        password_hash = hashlib.sha256(default_password.encode()).hexdigest()
        cursor.execute('''
            INSERT INTO users (username, password_hash, role, created_at)
            VALUES (?, ?, ?, ?)
        ''', ('admin', password_hash, 'admin', datetime.now().strftime('%Y-%m-%d')))

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


def login_required(f):
    """管理员权限验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录'}), 401
        if session.get('role') != 'admin':
            return jsonify({'error': '需要管理员权限'}), 403
        return f(*args, **kwargs)
    return decorated_function


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


@app.route('/api/auth/login', methods=['POST'])
def login():
    """管理员登录"""
    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '请输入用户名和密码'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({'error': '用户名或密码错误'}), 401

    if user['password_hash'] != hash_password(password):
        return jsonify({'error': '用户名或密码错误'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    session['role'] = user['role']

    return jsonify({
        'message': '登录成功',
        'user': {'id': user['id'], 'username': user['username'], 'role': user['role']}
    })


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """退出登录"""
    session.clear()
    return jsonify({'message': '已退出登录'})


@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    """检查登录状态"""
    if 'user_id' in session:
        return jsonify({
            'logged_in': True,
            'user': {'id': session['user_id'], 'username': session['username'], 'role': session['role']}
        })
    return jsonify({'logged_in': False})


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
@login_required
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
@login_required
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
@login_required
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


@app.route('/api/categories', methods=['GET'])
def get_categories():
    """获取所有分类"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM categories ORDER BY sort_order')
    categories = cursor.fetchall()
    conn.close()
    return jsonify([dict(c) for c in categories])


@app.route('/api/categories', methods=['POST'])
@login_required
def create_category():
    """创建分类"""
    data = request.get_json()
    key = data.get('key', '').strip().lower()
    name = data.get('name', '').strip()
    icon = data.get('icon', 'fa-folder').strip()

    if not key or not name:
        return jsonify({'error': '分类键名和名称不能为空'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM categories WHERE key = ?', (key,))
    if cursor.fetchone()[0] > 0:
        conn.close()
        return jsonify({'error': '该分类键名已存在'}), 409

    cursor.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories')
    next_order = cursor.fetchone()[0]

    cursor.execute('''
        INSERT INTO categories (key, name, icon, sort_order)
        VALUES (?, ?, ?, ?)
    ''', (key, name, icon, next_order))
    conn.commit()
    cat_id = cursor.lastrowid
    conn.close()

    return jsonify({'id': cat_id, 'key': key, 'name': name, 'icon': icon, 'message': '创建成功'}), 201


@app.route('/api/categories/<string:key>', methods=['PUT'])
@login_required
def update_category(key):
    """更新分类（重命名）"""
    data = request.get_json()
    name = data.get('name', '').strip()
    icon = data.get('icon', '').strip()

    if not name:
        return jsonify({'error': '分类名称不能为空'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE categories SET name = ?, icon = ? WHERE key = ?',
                   (name, icon, key))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': '分类不存在'}), 404
    conn.commit()
    conn.close()
    return jsonify({'message': '更新成功'})


@app.route('/api/categories/<string:key>', methods=['DELETE'])
@login_required
def delete_category_api(key):
    """删除分类（需管理员，且分类下无文章）"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM articles WHERE category = ?', (key,))
    count = cursor.fetchone()[0]
    if count > 0:
        conn.close()
        return jsonify({'error': f'该分类下有{count}篇文章，无法删除'}), 400

    cursor.execute('DELETE FROM categories WHERE key = ?', (key,))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': '分类不存在'}), 404

    conn.commit()
    conn.close()
    return jsonify({'message': '删除成功'})


@app.route('/api/upload/file', methods=['POST'])
@login_required
def upload_file():
    """上传并解析文件（支持Word、PDF、OFD格式）"""
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400

    # 获取文件扩展名
    file_ext = os.path.splitext(file.filename)[1].lower()

    # 支持的文件格式
    supported_formats = {
        '.docx': 'Word文档',
        '.pdf': 'PDF文档',
        '.ofd': 'OFD文档'
    }

    if file_ext not in supported_formats:
        return jsonify({'error': f'不支持的文件格式。支持的格式：{", ".join(supported_formats.keys())}'}), 400

    try:
        # 读取文件内容
        file_content = file.read()

        # 根据文件类型选择解析方法
        if file_ext == '.docx':
            result = parse_word(file_content, file.filename)
        elif file_ext == '.pdf':
            result = parse_pdf(file_content, file.filename)
        elif file_ext == '.ofd':
            result = parse_ofd(file_content, file.filename)
        else:
            return jsonify({'error': '不支持的文件格式'}), 400

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def parse_word(file_content, filename):
    """解析Word文件"""
    # 确保上传目录存在
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    doc = Document(io.BytesIO(file_content))

    # 提取标题（从第一个段落或文件名）
    title = ''
    content_parts = []
    image_count = 0

    # 处理文档中的所有元素（段落和图片）
    for element in doc.element.body:
        # 处理段落
        if element.tag.endswith('p'):
            # 找到对应的段落对象
            para = None
            for p in doc.paragraphs:
                if p._element == element:
                    para = p
                    break

            if para is None:
                continue

            # 检查段落中是否有图片
            has_image = False
            for run in para.runs:
                if run._element.xpath('.//a:blip'):
                    has_image = True
                    # 提取图片
                    for blip in run._element.xpath('.//a:blip'):
                        embed = blip.get(qn('r:embed'))
                        if embed:
                            # 获取图片数据
                            image_part = doc.part.related_parts[embed]
                            image_data = image_part.blob

                            # 生成唯一文件名
                            image_ext = os.path.splitext(image_part.filename)[1] if image_part.filename else '.png'
                            image_name = f"{uuid.uuid4().hex}{image_ext}"
                            image_path = os.path.join(UPLOAD_FOLDER, image_name)

                            # 保存图片
                            with open(image_path, 'wb') as f:
                                f.write(image_data)

                            # 添加Markdown图片引用
                            image_url = f"/static/uploads/images/{image_name}"
                            content_parts.append(f"![图片{image_count + 1}]({image_url})")
                            image_count += 1

            # 处理文本内容
            text = para.text.strip()
            if text:
                # 第一个非空段落作为标题
                if not title and len(content_parts) == 0:
                    # 检查是否是标题样式
                    if para.style.name.startswith('Heading'):
                        title = text
                    else:
                        # 如果第一段较短，可能是标题
                        if len(text) < 100:
                            title = text
                        else:
                            # 根据段落样式转换为Markdown格式
                            content_parts.append(convert_paragraph_to_markdown(para, text))
                else:
                    # 根据段落样式转换为Markdown格式
                    content_parts.append(convert_paragraph_to_markdown(para, text))

        # 处理表格
        elif element.tag.endswith('tbl'):
            for table in doc.tables:
                if table._element == element:
                    table_md = []
                    for i, row in enumerate(table.rows):
                        cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
                        table_md.append('| ' + ' | '.join(cells) + ' |')
                        if i == 0:
                            # 添加表头分隔线
                            table_md.append('| ' + ' | '.join(['---'] * len(cells)) + ' |')
                    content_parts.append('\n'.join(table_md))
                    break

    # 如果没有提取到标题，使用文件名
    if not title:
        title = os.path.splitext(filename)[0]

    content = '\n\n'.join(content_parts)

    return {
        'title': title,
        'content': content
    }


def parse_pdf(file_content, filename):
    """解析PDF文件，转换为图片展示"""
    try:
        # 确保上传目录存在
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # 打开PDF文件
        pdf_document = fitz.open(stream=file_content, filetype="pdf")

        title = os.path.splitext(filename)[0]
        content_parts = []

        # 处理每一页，转换为图片
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]

            # 添加页面分隔
            if page_num > 0:
                content_parts.append(f"\n---\n")

            # 将页面转换为高质量图片
            zoom = 2  # 缩放因子，提高清晰度
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            # 生成图片文件名
            page_image_name = f"{uuid.uuid4().hex}_page_{page_num + 1}.png"
            page_image_path = os.path.join(UPLOAD_FOLDER, page_image_name)

            # 保存页面图片
            pix.save(page_image_path)

            # 添加页面图片引用
            page_image_url = f"/static/uploads/images/{page_image_name}"
            content_parts.append(f"![第{page_num + 1}页]({page_image_url})")

        pdf_document.close()
        content = '\n\n'.join(content_parts)

        return {
            'title': title,
            'content': content
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise Exception(f'解析PDF文件失败: {str(e)}')


def parse_ofd(file_content, filename):
    """解析OFD文件，渲染为图片展示（保留原始排版）"""
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    title = os.path.splitext(filename)[0]
    content_parts = []

    def render_images(image_paths, prefix=''):
        """将提取的图片写入 uploads 并生成 Markdown"""
        parts = []
        for i, (img_data, ext) in enumerate(image_paths):
            img_name = f'{uuid.uuid4().hex}{ext or ".png"}'
            img_path = os.path.join(UPLOAD_FOLDER, img_name)
            with open(img_path, 'wb') as f:
                f.write(img_data)
            parts.append(f'![{prefix}{i + 1}](/static/uploads/images/{img_name})')
        return parts

    # ---- 方案一：easyofd 转 PDF，再逐页渲染为图片 ----
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.ofd') as temp_file:
            temp_file.write(file_content)
            temp_path = temp_file.name

        try:
            ofd = easyofd.OFD()
            ofd.read(temp_path, fmt="path")
            pdf_path = temp_path.replace('.ofd', '.pdf')
            ofd.to_pdf(pdf_path)

            pdf_doc = fitz.open(pdf_path)
            zoom = 2
            mat = fitz.Matrix(zoom, zoom)
            for page_num in range(len(pdf_doc)):
                if page_num > 0:
                    content_parts.append('\n---\n')
                pix = pdf_doc[page_num].get_pixmap(matrix=mat)
                page_img_name = f'{uuid.uuid4().hex}_page_{page_num + 1}.png'
                page_img_path = os.path.join(UPLOAD_FOLDER, page_img_name)
                pix.save(page_img_path)
                content_parts.append(f'![第{page_num + 1}页](/static/uploads/images/{page_img_name})')

            pdf_doc.close()

            if content_parts:
                return {'title': title, 'content': '\n\n'.join(content_parts)}

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            pdf_path = temp_path.replace('.ofd', '.pdf')
            if os.path.exists(pdf_path):
                os.remove(pdf_path)

    except Exception:
        import traceback
        traceback.print_exc()

    # ---- 方案二：直接从 OFD (ZIP) 中提取所有图片 ----
    try:
        with zipfile.ZipFile(io.BytesIO(file_content)) as zf:
            # 收集所有图片文件
            image_files = []
            for name in sorted(zf.namelist()):
                lower = name.lower()
                if lower.endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.tif')):
                    img_data = zf.read(name)
                    ext = os.path.splitext(name)[1]
                    image_files.append((img_data, ext))

            if image_files:
                parts = render_images(image_files, prefix='图片')
                return {'title': title, 'content': '\n\n'.join(parts)}

            # 没有图片文件，尝试将整个 OFD 作为 PDF 渲染
            # 如果 PDF 渲染也没成功，说明此 OFD 无可视化内容
            raise Exception('OFD文件中未找到可渲染的图片内容')

    except Exception as e:
        raise Exception(f'解析OFD文件失败: {str(e)}')


def convert_paragraph_to_markdown(para, text):
    """将段落转换为Markdown格式"""
    style_name = para.style.name

    if style_name == 'Heading 1' or style_name == 'Title':
        return f'# {text}'
    elif style_name == 'Heading 2':
        return f'## {text}'
    elif style_name == 'Heading 3':
        return f'### {text}'
    elif style_name == 'Heading 4':
        return f'#### {text}'
    elif style_name == 'List Bullet':
        return f'- {text}'
    elif style_name == 'List Number':
        return f'1. {text}'
    elif style_name == 'Quote':
        return f'> {text}'
    else:
        return text


# ---- 附件管理 API ----

@app.route('/api/articles/<int:article_id>/attachments', methods=['GET'])
def get_attachments(article_id):
    """获取文章的附件列表"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM attachments WHERE article_id = ? ORDER BY created_at DESC', (article_id,))
    attachments = cursor.fetchall()
    conn.close()
    return jsonify([dict(a) for a in attachments])


@app.route('/api/articles/<int:article_id>/attachments', methods=['POST'])
@login_required
def upload_attachment(article_id):
    """上传附件"""
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400

    os.makedirs(ATTACHMENT_FOLDER, exist_ok=True)

    original_filename = file.filename
    file_ext = os.path.splitext(original_filename)[1]
    stored_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(ATTACHMENT_FOLDER, stored_filename)

    file.save(file_path)
    file_size = os.path.getsize(file_path)

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO attachments (article_id, filename, original_filename, file_size, created_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (article_id, stored_filename, original_filename, file_size, now))
    attachment_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        'id': attachment_id,
        'original_filename': original_filename,
        'file_size': file_size,
        'message': '上传成功'
    }), 201


@app.route('/api/attachments/<int:attachment_id>/download', methods=['GET'])
def download_attachment(attachment_id):
    """下载附件"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM attachments WHERE id = ?', (attachment_id,))
    attachment = cursor.fetchone()
    conn.close()

    if not attachment:
        return jsonify({'error': '附件不存在'}), 404

    return send_from_directory(
        ATTACHMENT_FOLDER,
        attachment['filename'],
        as_attachment=True,
        download_name=attachment['original_filename']
    )


@app.route('/api/attachments/<int:attachment_id>', methods=['DELETE'])
@login_required
def delete_attachment(attachment_id):
    """删除附件"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM attachments WHERE id = ?', (attachment_id,))
    attachment = cursor.fetchone()

    if not attachment:
        conn.close()
        return jsonify({'error': '附件不存在'}), 404

    # 删除文件
    file_path = os.path.join(ATTACHMENT_FOLDER, attachment['filename'])
    if os.path.exists(file_path):
        os.remove(file_path)

    cursor.execute('DELETE FROM attachments WHERE id = ?', (attachment_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': '删除成功'})


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
