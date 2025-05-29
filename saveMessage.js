const fs = require('fs');
const path = require('path');

/**
 * 保存用户话语到仓库根目录的 messages.json 文件
 * @param {string} message 用户提交的内容
 */
function saveMessage(message) {
  const filePath = path.join(__dirname, 'messages.json');
  let messages = [];
  // 检查文件是否存在
  if (fs.existsSync(filePath)) {
    messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  // 添加新内容
  messages.push({
    content: message,
    time: new Date().toISOString()
  });
  // 保存文件
  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
}

// 示例用法
// saveMessage('这是用户提交的一句话');
module.exports = saveMessage;
