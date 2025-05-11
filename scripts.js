/**
 * 树洞网站 - GitHub Issues 存储方案
 * 完整 scripts.js 文件
 * 功能：提交秘密、获取秘密列表、基础错误处理
 */

// ==================== 配置区域 ====================
const CONFIG = {
    repoOwner: 'xuchengyu20130704',
    repoName: 'xuchengyu20130704.github.io',
    apiBaseUrl: 'https://api.github.com',
    defaultLabel: 'treehole',
    pageSize: 20,
    enableLocalCache: true,
    cacheExpiry: 30 * 60 * 1000,
    useProxy: false,
    proxyEndpoint: '/.netlify/functions/github-proxy'
};

// ==================== 状态管理 ====================
const STATE = {
    currentPage: 1,
    isLoading: false,
    lastFetchTime: 0
};

// ==================== DOM元素引用 ====================
const DOM = {
    secretForm: document.getElementById('secretForm'),
    secretText: document.getElementById('secretText'),
    secretsContainer: document.getElementById('secretsContainer'),
    loadMoreBtn: document.getElementById('loadMoreBtn')
};

// ==================== 主功能函数 ====================

/**
 * 初始化应用
 */
function initApp() {
    // 如果是提交页面，设置表单提交事件
    if (DOM.secretForm) {
        DOM.secretForm.addEventListener('submit', handleSubmit);
    }
    
    // 如果是查看页面，加载秘密
    if (DOM.secretsContainer) {
        loadSecrets();
        
        // 如果有加载更多按钮，设置点击事件
        if (DOM.loadMoreBtn) {
            DOM.loadMoreBtn.addEventListener('click', loadMoreSecrets);
        }
    }
}

/**
 * 处理表单提交
 */
async function handleSubmit(e) {
    e.preventDefault();
    
    const text = DOM.secretText.value.trim();
    if (!text) {
        alert('请输入内容');
        return;
    }
    
    try {
        // 禁用提交按钮防止重复提交
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';
        
        // 提交到GitHub
        const result = await submitSecret(text);
        
        // 清空表单并显示成功消息
        DOM.secretText.value = '';
        showAlert('提交成功！你的秘密已安全保存', 'success');
        
        // 如果是提交后跳转到查看页
        if (window.location.pathname.includes('submit')) {
            setTimeout(() => {
                window.location.href = 'view.html';
            }, 1500);
        }
    } catch (error) {
        console.error('提交失败:', error);
        showAlert('提交失败: ' + (error.message || '请稍后再试'), 'error');
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交';
        }
    }
}

/**
 * 加载秘密列表
 */
async function loadSecrets() {
    if (STATE.isLoading) return;
    
    STATE.isLoading = true;
    showLoading(true);
    
    try {
        // 检查本地缓存
        const cachedData = getCachedSecrets();
        if (cachedData && cachedData.length > 0) {
            renderSecrets(cachedData);
        }
        
        // 从GitHub获取最新数据
        const secrets = await fetchSecrets();
        STATE.lastFetchTime = Date.now();
        
        // 更新缓存
        if (CONFIG.enableLocalCache) {
            localStorage.setItem('treehole_cache', JSON.stringify({
                data: secrets,
                timestamp: STATE.lastFetchTime
            }));
        }
        
        renderSecrets(secrets);
        
        // 如果没有秘密，显示提示
        if (secrets.length === 0) {
            DOM.secretsContainer.innerHTML = '<p class="no-secrets">还没有人分享秘密...</p>';
        }
    } catch (error) {
        console.error('加载失败:', error);
        DOM.secretsContainer.innerHTML = `
            <div class="error-message">
                <p>加载失败: ${error.message || '请刷新重试'}</p>
                <button onclick="loadSecrets()">重试</button>
            </div>
        `;
    } finally {
        STATE.isLoading = false;
        showLoading(false);
    }
}

/**
 * 加载更多秘密(分页)
 */
async function loadMoreSecrets() {
    STATE.currentPage++;
    await loadSecrets();
}

// ==================== GitHub API 交互 ====================

/**
 * 提交秘密到GitHub Issues
 */
async function submitSecret(text) {
    const payload = {
        title: `树洞分享 ${formatDate(new Date())}`,
        body: text,
        labels: [CONFIG.defaultLabel]
    };
    
    if (CONFIG.useProxy) {
        // 使用代理端点(更安全)
        const response = await fetch(CONFIG.proxyEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error('代理请求失败');
        }
        
        return await response.json();
    } else {
        // 直接调用GitHub API(需在前端暴露token，不安全)
        const response = await fetch(
            `${CONFIG.apiBaseUrl}/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/issues`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${getGitHubToken()}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(payload)
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '提交失败');
        }
        
        return await response.json();
    }
}

/**
 * 从GitHub获取秘密列表
 */
async function fetchSecrets() {
    const url = new URL(
        `${CONFIG.apiBaseUrl}/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/issues`
    );
    
    url.searchParams.append('labels', CONFIG.defaultLabel);
    url.searchParams.append('per_page', CONFIG.pageSize);
    url.searchParams.append('page', STATE.currentPage);
    url.searchParams.append('sort', 'created');
    url.searchParams.append('direction', 'desc');
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            ...(CONFIG.useProxy ? {} : { 'Authorization': `token ${getGitHubToken()}` })
        }
    });
    
    if (!response.ok) {
        throw new Error('获取数据失败');
    }
    
    return await response.json();
}

// ==================== 辅助函数 ====================

/**
 * 渲染秘密列表
 */
function renderSecrets(secrets) {
    if (!secrets || secrets.length === 0) return;
    
    // 如果是第一页，清空容器
    if (STATE.currentPage === 1) {
        DOM.secretsContainer.innerHTML = '';
    }
    
    secrets.forEach(secret => {
        const secretEl = document.createElement('div');
        secretEl.className = 'secret-card';
        secretEl.innerHTML = `
            <div class="secret-content">${escapeHtml(secret.body)}</div>
            <div class="secret-meta">
                <span class="secret-date">${formatDate(new Date(secret.created_at))}</span>
                <span class="secret-id">#${secret.number}</span>
            </div>
        `;
        DOM.secretsContainer.appendChild(secretEl);
    });
    
    // 显示加载更多按钮(如果还有更多数据)
    if (secrets.length >= CONFIG.pageSize && DOM.loadMoreBtn) {
        DOM.loadMoreBtn.style.display = 'block';
    } else if (DOM.loadMoreBtn) {
        DOM.loadMoreBtn.style.display = 'none';
    }
}

/**
 * 从本地缓存获取秘密
 */
function getCachedSecrets() {
    if (!CONFIG.enableLocalCache) return null;
    
    const cache = localStorage.getItem('treehole_cache');
    if (!cache) return null;
    
    const { data, timestamp } = JSON.parse(cache);
    
    // 检查缓存是否过期
    if (Date.now() - timestamp > CONFIG.cacheExpiry) {
        return null;
    }
    
    return data;
}

/**
 * 安全获取GitHub Token(实际项目中应该使用环境变量或后端代理)
 */
function getGitHubToken() {
    // 警告：这只是演示用途，实际项目中不应该这样存储token
    // 生产环境应该使用后端代理或环境变量
    return 'ghp_your_token_here'; // 替换为你的token
}

/**
 * 显示加载状态
 */
function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

/**
 * 显示提示消息
 */
function showAlert(message, type = 'info') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    
    document.body.appendChild(alertBox);
    
    setTimeout(() => {
        alertBox.classList.add('fade-out');
        setTimeout(() => alertBox.remove(), 500);
    }, 3000);
}

/**
 * 格式化日期
 */
function formatDate(date) {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * HTML转义防止XSS
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==================== 初始化应用 ====================
document.addEventListener('DOMContentLoaded', initApp);
