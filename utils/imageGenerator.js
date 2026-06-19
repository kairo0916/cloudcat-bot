const path = require('path');
const fs = require('fs');

// --- 圖片與字型模組初始化 ---
let canvasModule = null;
try {
  canvasModule = require('@napi-rs/canvas');
  // 將字型路徑指向根目錄的 assets 資料夾，並使用更通用的 NotoSansTC 字型
  const fontPath = path.join(__dirname, '..', 'assets', 'NotoSansTC-Bold.ttf'); 
  if (fs.existsSync(fontPath)) {
    canvasModule.GlobalFonts.registerFromPath(fontPath, 'NotoSansTC');
    console.log('✅ 中文字型 NotoSansTC 載入成功，圖片亂碼問題已修復！');
  } else {
    console.error(`❌ 找不到字型檔！請確認 'NotoSansTC-Bold.ttf' 已放置於 'assets' 資料夾中。`);
    console.error(`路徑檢查: ${fontPath}`);
  }
} catch (err) {
  console.error('⚠️ @napi-rs/canvas 載入失敗或環境不支援原生模組，圖片生成功能將被停用:', err.message);
}

const generateWelcomeImage = async (type, username, avatarURL, backgroundURL, memberCount, guildName = '未知伺服器') => {
  if (!canvasModule) return null; // 如果模組載入失敗，返回 null
  
  const { createCanvas, loadImage } = canvasModule;
  const width = 1024;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 背景圖（含錯誤處理）
  try {
    if (backgroundURL) {
      const background = await loadImage(backgroundURL);
      ctx.drawImage(background, 0, 0, width, height);
    } else {
      throw new Error('No background');
    }
  } catch (err) {
    // 預設漸層背景
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#2c2f33');
    gradient.addColorStop(1, '#23272a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // 加上一點點綴裝飾
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for(let i=0; i<50; i++) {
        ctx.beginPath();
        ctx.arc(Math.random()*width, Math.random()*height, Math.random()*5, 0, Math.PI*2);
        ctx.fill();
    }
  }

  // 頭像（含錯誤處理）
  try {
    const avatar = await loadImage(avatarURL);
    const avatarSize = 200;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 60;
    const avatarCenterX = width / 2;
    const avatarCenterY = avatarY + avatarSize / 2;

    // 頭像外圈發光效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2 + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 頭像裁切
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    ctx.fillStyle = '#FF0000';
    ctx.font = '24px sans-serif';
    ctx.fillText('頭像載入失敗', width / 2, 150);
  }

  // 文字渲染
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // 主文字
  const textPrefix = type === 'welcome' ? '歡迎' : '再見了';
  const textSuffix = type === 'welcome' ? '！' : '...';
  const mainText = `${textPrefix} ${username} ${type === 'welcome' ? '加入' : '離開'} ${guildName}${textSuffix}`;
  
  let fontSize = 48;
  const maxTextWidth = 900;
  do {
    ctx.font = `bold ${fontSize}px "NotoSansTC", sans-serif`;
    if (ctx.measureText(mainText).width <= maxTextWidth) break;
    fontSize -= 2;
  } while (fontSize > 20);
  ctx.fillText(mainText, width / 2, 330);

  // 成員計數
  if (type === 'welcome') {
    ctx.font = `bold 32px "NotoSansTC", sans-serif`;
    ctx.fillText(`你是第 ${memberCount} 位成員！`, width / 2, 380);
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // 日期
  const now = new Date();
  const formattedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(formattedDate, width - 20, height - 20);

  const buffer = canvas.toBuffer('image/png');
  canvas.width = 0;
  canvas.height = 0;
  return buffer;
};

module.exports = generateWelcomeImage;
