// 1. 从 unpkg 导入 TOTP 对象。
import { TOTP } from 'https://unpkg.com/totp-generator?module';

// 2. 获取需要操作的 DOM 元素
const secretInput = document.getElementById('secret');
const tokenDisplay = document.getElementById('token-display');
const progressBarInner = document.getElementById('progress-bar-inner');

/**
 * 根据输入框中的密钥更新验证码显示。
 */
function updateToken() {
    // 获取并清理密钥字符串
    const secret = secretInput.value.trim();

    // 如果密钥为空，则重置显示
    if (!secret) {
        tokenDisplay.textContent = '------';
        tokenDisplay.classList.remove('error');
        return;
    }

    try {
        // 使用库生成验证码，根据新用法解构出 otp
        const { otp } = TOTP.generate(secret);
        // 为了可读性，将6位数字格式化为 "123 456"
        tokenDisplay.textContent = otp.slice(0, 3) + ' ' + otp.slice(3);
        tokenDisplay.classList.remove('error');

        // 成功了，进行存储
        localStorage.setItem('secret', secret);
    } catch (error) {
        // 如果密钥无效，库会抛出错误，在此捕获并显示错误信息
        console.error("Error generating token:", error);
        tokenDisplay.textContent = 'Invalid Secret Key';
        tokenDisplay.classList.add('error');
    }
}

/**
 * 更新进度条，并在需要时触发验证码刷新。
 */
function updateTimerAndToken() {
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const countdown = 30 - (epoch % 30);

    // 更新进度条宽度
    const progressPercentage = (countdown / 30) * 100;
    // 防止在计时器刚重置时出现闪烁
    if (countdown === 30) {
        progressBarInner.style.transition = 'none'; // 立即重置
    } else {
        progressBarInner.style.transition = 'width 1s linear'; // 恢复平滑过渡
    }
    progressBarInner.style.width = `${progressPercentage}%`;

    // 当一个新的30秒周期开始时 (countdown 恰好为30)，重新生成验证码
    if (countdown === 30) {
        updateToken();
    }
}

// 3. 设置事件监听器
// 当用户在输入框中输入时，立即更新验证码
secretInput.addEventListener('input', updateToken);

// 4. 初始化
// 页面加载后，立即执行一次，以显示初始状态
updateToken();
updateTimerAndToken();

// 每秒钟调用一次计时器更新函数
setInterval(updateTimerAndToken, 1000);

if (localStorage.getItem('secret')) {
    secretInput.value = localStorage.getItem('secret')
    updateToken()
}