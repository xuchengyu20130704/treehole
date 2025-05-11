/**
 * GitHub Issues 树洞实现
 * 安全存储方案 with 环境变量管理
 */

// ==================== 配置管理 ====================
const CONFIG = {
    repoOwner: import.meta.env.VITE_GH_OWNER || 'YOUR_GITHUB_USERNAME',
    repoName: import.meta.env.VITE_GH_REPO || 'YOUR_REPO_NAME',
    apiBaseUrl: 'https://api.github.com',
    defaultLabel: 'treehole',
    pageSize: 10,
    cacheTTL: 5 * 60 * 1000 // 5分钟缓存
};

// ==================== 安全 Token 管理 ====================
class GitHubAuth {
    static getToken() {
        // 优先级1: Vite环境变量 (构建时注入)
        if (import.meta.env.VITE_GH_TOKEN) {
            return import.meta.env.VITE_GH_TOKEN;
        }
        
        // 优先级2: 本地开发临时Token (仅开发环境)
        if (process.env.NODE_ENV === 'development') {
            console.warn('Development mode using fallback token');
            return window.__DEV_GH_TOKEN__; // 在index.html中定义
        }
        
        throw new Error('GitHub Token 未配置');
    }

    static getHeaders() {
        return {
            'Authorization': `token ${this.getToken()}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
    }
}

// ==================== GitHub 服务层 ====================
class GitHubService {
    static async createIssue(content) {
        const response = await fetch(
            `${CONFIG.apiBaseUrl}/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/issues`,
            {
                method: 'POST',
                headers: GitHubAuth.getHeaders(),
                body: JSON.stringify({
                    title: `树洞分享 ${new Date().toLocaleDateString()}`,
                    body: content,
                    labels: [CONFIG.defaultLabel]
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '提交失败');
        }

        return await response.json();
    }

    static async getIssues(page = 1) {
        const url = new URL(
            `${CONFIG.apiBaseUrl}/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/issues`
        );
        
        url.searchParams.append('labels', CONFIG.defaultLabel);
        url.searchParams.append('per_page', CONFIG.pageSize);
        url.searchParams.append('page', page);
        url.searchParams.append('sort', 'created');
        url.searchParams.append('direction', 'desc');

        const response = await fetch(url, {
            headers: GitHubAuth.getHeaders()
        });

        if (!response.ok) {
            throw new Error('获取数据失败');
        }

        return await response.json();
    }
}

// ==================== 数据缓存层 ====================
class CacheService {
    static getCacheKey() {
        return `gh_issues_cache_${CONFIG.repoOwner}_${CONFIG.repoName}`;
    }

    static get() {
        const cache = localStorage.getItem(this.getCacheKey());
        if (!cache) return null;
        
        const { data, timestamp } = JSON.parse(cache);
        if (Date.now() - timestamp > CONFIG.cacheTTL) return null;
        
        return data;
    }

    static set(data) {
        localStorage.setItem(
            this.getCacheKey(),
            JSON.stringify({
                data,
                timestamp: Date.now()
            })
        );
    }
}

// ==================== UI 交互层 ====================
class TreeholeUI {
    static init() {
        // 表单提交
        if (document.getElementById('secretForm')) {
            document.getElementById('secretForm')
                .addEventListener('submit', this.handleSubmit.bind(this));
        }

        // 加载数据
        if (document.getElementById('secretsContainer')) {
            this.loadSecrets();
        }
    }

    static async handleSubmit(event) {
        event.preventDefault();
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const textarea = document.getElementById('secretText');
        const content = textarea.value.trim();

        if (!content) return;

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
            
            await GitHubService.createIssue(content);
            this.showAlert('提交成功！', 'success');
            textarea.value = '';

            // 提交后跳转
            if (window.location.pathname.includes('submit.html')) {
                setTimeout(() => window.location.href = 'view.html', 1500);
            }
        } catch (error) {
            console.error('提交失败:', error);
            this.showAlert(`提交失败: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交';
        }
    }

    static async loadSecrets(page = 1) {
        const container = document.getElementById('secretsContainer');
        const loader = document.getElementById('loadingIndicator');
        const errorBox = document.getElementById('errorMessage');
        const emptyBox = document.getElementById('noSecretsMessage');

        try {
            // 显示加载状态
            container.innerHTML = '';
            loader.style.display = 'block';
            errorBox.style.display = 'none';
            emptyBox.style.display = 'none';

            // 尝试读取缓存
            const cachedData = CacheService.get();
            if (cachedData && page === 1) {
                this.renderSecrets(cachedData);
            }

            // 获取最新数据
            const issues = await GitHubService.getIssues(page);
            CacheService.set(issues);
            
            if (issues.length === 0 && page === 1) {
                emptyBox.style.display = 'block';
            } else {
                this.renderSecrets(issues);
            }
        } catch (error) {
            console.error('加载失败:', error);
            errorBox.style.display = 'block';
            errorBox.querySelector('#errorText').textContent = error.message;
        } finally {
            loader.style.display = 'none';
        }
    }

    static renderSecrets(issues) {
        const container = document.getElementById('secretsContainer');
        
        issues.forEach(issue => {
            const secretEl = document.createElement('div');
            secretEl.className = 'secret-card';
            secretEl.innerHTML = `
                <div class="secret-content">${this.escapeHtml(issue.body)}</div>
                <div class="secret-meta">
                    <span class="secret-date">
                        <i class="far fa-clock"></i> 
                        ${this.formatDate(new Date(issue.created_at))}
                    </span>
                    <a href="${issue.html_url}" target="_blank" class="gh-link">
                        <i class="fab fa-github"></i> 查看原文
                    </a>
                </div>
            `;
            container.appendChild(secretEl);
        });
    }

    static showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.add('fade-out');
            setTimeout(() => alert.remove(), 500);
        }, 3000);
    }

    static escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    static formatDate(date) {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// ==================== 初始化应用 ====================
document.addEventListener('DOMContentLoaded', () => {
    TreeholeUI.init();
});
