// 存储秘密的数组
let secrets = [];

// 检查本地存储中是否有已保存的秘密
if (localStorage.getItem('secrets')) {
    secrets = JSON.parse(localStorage.getItem('secrets'));
}

// 提交表单处理
if (document.getElementById('secretForm')) {
    document.getElementById('secretForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const secretText = document.getElementById('secretText').value.trim();
        
        if (secretText) {
            // 创建新秘密对象
            const newSecret = {
                id: Date.now(),
                text: secretText,
                date: new Date().toLocaleString()
            };
            
            // 添加到数组并保存到本地存储
            secrets.push(newSecret);
            localStorage.setItem('secrets', JSON.stringify(secrets));
            
            // 清空表单并显示成功消息
            document.getElementById('secretText').value = '';
            alert('你的秘密已安全保存！');
        }
    });
}

// 显示所有秘密
if (document.getElementById('secretsContainer')) {
    const container = document.getElementById('secretsContainer');
    
    if (secrets.length === 0) {
        container.innerHTML = '<p>还没有人分享秘密...</p>';
    } else {
        container.innerHTML = '';
        secrets.forEach(secret => {
            const secretElement = document.createElement('div');
            secretElement.className = 'secret';
            secretElement.innerHTML = `
                <p>${secret.text}</p>
                <small>${secret.date}</small>
            `;
            container.appendChild(secretElement);
        });
    }
}
