/**
 * 智能小车控制系统主要JavaScript文件
 * 基于FreeMaster API实现小车控制功能
 */

// 全局变量
let pcm = undefined;
let pcmConnected = false;
let isDriving = false;
let updateInterval = null;

// CAN信号变量状态
const canVariables = {
    'CAN_DW.CAN_LeftDoor': 0,      // 0: 停止, 1: 开门, 2: 关门
    'CAN_DW.CAN_RightDoor': 0,     // 0: 停止, 1: 开门, 2: 关门
    'CAN_DW.CAN_LightStatus': 0,   // 0-3: 模式1-4
    'CAN_DW.CAN_FanStatus': 0      // 0-2: 档位0-2
};

// DOM元素
let elements = {};

// 初始化
$(document).ready(function() {
    console.log('页面加载完成，开始初始化...');
    initializeElements();
    initializeEventListeners();
    initPCM();
    addLogEntry('系统初始化完成', 'info');

    // 检查视频元素状态
    setTimeout(() => {
        checkVideoStatus();
    }, 1000);
});

/**
 * 初始化DOM元素引用
 */
function initializeElements() {
    elements = {
        connectionIndicator: document.getElementById('connection-indicator'),
        startDriving: document.getElementById('start-driving'),
        updateData: document.getElementById('update-data'),
        carVideo: document.getElementById('car-video'),
        videoOverlay: document.getElementById('video-overlay'),
        logContainer: document.getElementById('log-container'),
        
        // 状态显示元素
        drivingStatus: document.getElementById('driving-status'),
        updateStatus: document.getElementById('update-status'),
        leftDoorStatus: document.getElementById('left-door-status'),
        rightDoorStatus: document.getElementById('right-door-status'),
        lightStatus: document.getElementById('light-status'),
        fanStatus: document.getElementById('fan-status'),
        
        // CAN控件
        doorButtons: document.querySelectorAll('.door-btn'),
        fanSelect: document.getElementById('fan-select'),
        lightSelect: document.getElementById('light-select')
    };
}

/**
 * 初始化事件监听器
 */
function initializeEventListeners() {
    // 开始行驶按钮
    elements.startDriving.addEventListener('click', handleStartDriving);
    
    // 数据更新按钮
    elements.updateData.addEventListener('click', handleUpdateData);
    
    // 门控制按钮
    elements.doorButtons.forEach(button => {
        button.addEventListener('click', handleDoorButtonClick);
    });

    // 下拉框控件
    if (elements.fanSelect) {
        elements.fanSelect.addEventListener('change', handleSelectChange);
    }
    if (elements.lightSelect) {
        elements.lightSelect.addEventListener('change', handleSelectChange);
    }
    
    // 视频事件
    elements.carVideo.addEventListener('ended', handleVideoEnded);

    // 点击视频覆盖层也能开始播放（如果存在的话）
    if (elements.videoOverlay) {
        elements.videoOverlay.addEventListener('click', handleVideoOverlayClick);
    }

    // 键盘快捷键支持
    document.addEventListener('keydown', handleKeyDown);
}

/**
 * 初始化PCM连接
 */
function initPCM() {
    if (pcm !== undefined) {
        console.log('PCM already exists');
        return;
    }
    
    // FreeMaster WebSocket地址
    // 可以根据实际情况修改为本地地址或远程地址
    const rpcs_addr = "localhost:41000";
    // const rpcs_addr = "wss://fm.guliucang.com/ws";
    
    try {
        pcm = new PCM(rpcs_addr, onConnected, onDisconnected, onError);
        pcm.OnServerError = onError;
        pcm.OnSocketError = onError;
        addLogEntry('正在连接FreeMaster...', 'info');
    } catch (error) {
        addLogEntry('PCM初始化失败: ' + error.message, 'error');
    }
}

/**
 * 连接成功回调
 */
function onConnected() {
    pcmConnected = true;
    elements.connectionIndicator.className = 'indicator connected';
    addLogEntry('FreeMaster连接成功', 'success');
    
    // 启动定期数据更新
    startDataUpdate();
}

/**
 * 连接断开回调
 */
function onDisconnected() {
    pcmConnected = false;
    elements.connectionIndicator.className = 'indicator disconnected';
    addLogEntry('FreeMaster连接已断开', 'warning');
    
    // 停止数据更新
    stopDataUpdate();
}

/**
 * 错误处理回调
 */
function onError(error) {
    console.error('FreeMaster错误:', error);
    elements.connectionIndicator.className = 'indicator disconnected';
    
    if (error.type === 'error') {
        addLogEntry('FreeMaster通信错误', 'error');
    } else if (error.type === 'close') {
        addLogEntry('FreeMaster连接已关闭', 'warning');
    } else {
        addLogEntry('FreeMaster错误: ' + (error.message || error), 'error');
    }
    
    pcmConnected = false;
    stopDataUpdate();
}





/**
 * 处理开始行驶
 */
async function handleStartDriving() {
    if (isDriving) {
        // 如果正在行驶，则停止
        await handleStopDriving();
        return;
    }

    try {
        addLogEntry('开始行驶...', 'info');
        elements.startDriving.classList.add('loading');

        // 先开始播放视频
        await startVideo();

        // 如果FreeMaster已连接，则写入startdriving变量
        if (pcmConnected) {
            try {
                await writeVariable('CAN_DW.startdriving', 1);
                addLogEntry('已发送startdriving信号', 'info');
            } catch (error) {
                addLogEntry('发送startdriving信号失败: ' + error.message, 'warning');
            }
        } else {
            addLogEntry('FreeMaster未连接，仅播放视频', 'warning');
        }

        isDriving = true;
        updateUIStatus();
        updateStartButton();

        addLogEntry('小车开始行驶', 'success');
    } catch (error) {
        addLogEntry('开始行驶失败: ' + error.message, 'error');
        console.error('Start driving error:', error);
    } finally {
        elements.startDriving.classList.remove('loading');
    }
}

/**
 * 处理停止行驶
 */
async function handleStopDriving() {
    try {
        addLogEntry('停止行驶...', 'info');
        elements.startDriving.classList.add('loading');

        // 先停止视频
        stopVideo();

        // 如果FreeMaster已连接，则写入startdriving变量为0
        if (pcmConnected) {
            try {
                await writeVariable('CAN_DW.startdriving', 0);
                addLogEntry('已发送停止信号', 'info');
            } catch (error) {
                addLogEntry('发送停止信号失败: ' + error.message, 'warning');
            }
        } else {
            addLogEntry('FreeMaster未连接，仅停止视频', 'warning');
        }

        isDriving = false;
        updateUIStatus();
        updateStartButton();

        addLogEntry('小车已停止', 'success');
    } catch (error) {
        addLogEntry('停止行驶失败: ' + error.message, 'error');
        console.error('Stop driving error:', error);
    } finally {
        elements.startDriving.classList.remove('loading');
    }
}

/**
 * 开始播放视频
 */
async function startVideo() {
    return new Promise((resolve, reject) => {
        console.log('开始播放视频...');
        addLogEntry('正在加载视频...', 'info');

        // 检查视频元素
        if (!elements.carVideo) {
            const error = new Error('视频元素未找到');
            console.error(error);
            reject(error);
            return;
        }

        // 隐藏覆盖层（如果存在的话）
        if (elements.videoOverlay) {
            elements.videoOverlay.classList.add('hidden');
        }

        // 设置视频播放事件监听
        const onCanPlay = () => {
            console.log('视频可以播放');
            elements.carVideo.removeEventListener('canplay', onCanPlay);
            elements.carVideo.removeEventListener('error', onVideoError);
            elements.carVideo.removeEventListener('loadeddata', onLoadedData);
            addLogEntry('视频开始播放', 'success');
            resolve();
        };

        const onLoadedData = () => {
            console.log('视频数据已加载');
            elements.carVideo.removeEventListener('canplay', onCanPlay);
            elements.carVideo.removeEventListener('error', onVideoError);
            elements.carVideo.removeEventListener('loadeddata', onLoadedData);
            addLogEntry('视频开始播放', 'success');
            resolve();
        };

        const onVideoError = (event) => {
            console.error('视频加载错误:', event);
            elements.carVideo.removeEventListener('canplay', onCanPlay);
            elements.carVideo.removeEventListener('error', onVideoError);
            elements.carVideo.removeEventListener('loadeddata', onLoadedData);
            if (elements.videoOverlay) {
                elements.videoOverlay.classList.remove('hidden');
            }
            reject(new Error('视频加载失败: ' + (elements.carVideo.error ? elements.carVideo.error.message : '未知错误')));
        };

        // 添加事件监听器
        elements.carVideo.addEventListener('canplay', onCanPlay);
        elements.carVideo.addEventListener('loadeddata', onLoadedData);
        elements.carVideo.addEventListener('error', onVideoError);

        // 重置视频并开始播放
        elements.carVideo.currentTime = 0;

        // 尝试播放视频
        const playPromise = elements.carVideo.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('视频播放成功');
                })
                .catch((error) => {
                    console.error('视频播放被阻止:', error);
                    // 如果自动播放被阻止，显示用户交互提示
                    if (elements.videoOverlay) {
                        elements.videoOverlay.classList.remove('hidden');
                        const prompt = elements.videoOverlay.querySelector('.play-prompt p');
                        if (prompt) {
                            prompt.textContent = '请点击视频手动播放（浏览器阻止了自动播放）';
                        }
                    }
                    addLogEntry('视频自动播放被浏览器阻止，请手动点击播放', 'warning');
                    reject(new Error('视频自动播放被阻止: ' + error.message));
                });
        }

        // 设置超时
        setTimeout(() => {
            elements.carVideo.removeEventListener('canplay', onCanPlay);
            elements.carVideo.removeEventListener('error', onVideoError);
            elements.carVideo.removeEventListener('loadeddata', onLoadedData);
            if (elements.carVideo.paused) {
                if (elements.videoOverlay) {
                    elements.videoOverlay.classList.remove('hidden');
                }
                reject(new Error('视频播放超时'));
            }
        }, 5000);
    });
}

/**
 * 停止视频播放
 */
function stopVideo() {
    try {
        console.log('停止视频播放...');

        if (!elements.carVideo) {
            console.error('视频元素未找到');
            return;
        }

        // 暂停视频
        elements.carVideo.pause();

        // 重置播放位置
        elements.carVideo.currentTime = 0;

        // 显示覆盖层（如果存在的话）
        if (elements.videoOverlay) {
            elements.videoOverlay.classList.remove('hidden');

            // 重置覆盖层提示文本
            const prompt = elements.videoOverlay.querySelector('.play-prompt p');
            if (prompt) {
                prompt.textContent = '点击"开始行驶"开始视频';
            }
        }

        console.log('视频已停止');
        addLogEntry('视频已停止', 'info');

    } catch (error) {
        console.error('停止视频时出错:', error);
        addLogEntry('停止视频时出错: ' + error.message, 'error');
    }
}

/**
 * 处理数据更新
 */
async function handleUpdateData() {
    if (!pcmConnected) {
        addLogEntry('请先连接FreeMaster', 'warning');
        return;
    }
    
    try {
        addLogEntry('更新数据...', 'info');
        elements.updateData.classList.add('loading');
        
        // 写入updata变量
        await writeVariable('CAN_DW.updata', 1);
        
        // 读取所有CAN变量状态
        await updateCanVariablesStatus();
        
        elements.updateStatus.textContent = '已更新';
        addLogEntry('数据更新完成', 'success');
    } catch (error) {
        addLogEntry('数据更新失败: ' + error.message, 'error');
    } finally {
        elements.updateData.classList.remove('loading');
    }
}

/**
 * 处理门控制按钮点击
 */
async function handleDoorButtonClick(event) {
    const button = event.currentTarget;
    const variable = button.dataset.variable;
    const value = parseInt(button.dataset.value);

    if (!pcmConnected) {
        addLogEntry('请先连接FreeMaster', 'warning');
        return;
    }

    // 防止重复点击
    if (button.classList.contains('loading')) {
        return;
    }

    try {
        button.classList.add('loading');

        await writeVariable(variable, value);
        canVariables[variable] = value;

        // 更新按钮状态
        updateDoorButtonsUI(variable, value);
        updateStatusDisplay(variable, value);

        const variableName = getVariableDisplayName(variable);
        const actionText = getDoorActionText(value);
        addLogEntry(`${variableName} ${actionText}`, 'info');

        // 添加视觉反馈
        button.classList.add('slide-in');
        setTimeout(() => button.classList.remove('slide-in'), 300);

    } catch (error) {
        addLogEntry(`设置${getVariableDisplayName(variable)}失败: ` + error.message, 'error');
    } finally {
        button.classList.remove('loading');
    }
}

/**
 * 处理下拉框变化
 */
async function handleSelectChange(event) {
    const select = event.currentTarget;
    const variable = select.dataset.variable;
    const value = parseInt(select.value);

    if (!pcmConnected) {
        addLogEntry('请先连接FreeMaster', 'warning');
        // 恢复之前的值
        select.value = canVariables[variable];
        return;
    }

    try {
        await writeVariable(variable, value);
        canVariables[variable] = value;

        updateStatusDisplay(variable, value);

        const variableName = getVariableDisplayName(variable);
        const valueText = getSelectValueText(variable, value);
        addLogEntry(`${variableName} 设置为 ${valueText}`, 'info');

    } catch (error) {
        addLogEntry(`设置${getVariableDisplayName(variable)}失败: ` + error.message, 'error');
        // 恢复之前的值
        select.value = canVariables[variable];
    }
}

/**
 * 获取变量显示名称
 */
function getVariableDisplayName(variable) {
    const nameMap = {
        'CAN_DW.CAN_LeftDoor': '左门',
        'CAN_DW.CAN_RightDoor': '右门',
        'CAN_DW.CAN_LightStatus': '灯带',
        'CAN_DW.CAN_FanStatus': '风扇'
    };
    return nameMap[variable] || variable;
}

/**
 * 获取门操作文本
 */
function getDoorActionText(value) {
    const actionMap = {
        0: '停止',
        1: '开门',
        2: '关门'
    };
    return actionMap[value] || `值${value}`;
}

/**
 * 获取下拉框值文本
 */
function getSelectValueText(variable, value) {
    if (variable === 'CAN_DW.CAN_FanStatus') {
        return `档位 ${value}`;
    } else if (variable === 'CAN_DW.CAN_LightStatus') {
        return `模式 ${value + 1}`;
    }
    return `值 ${value}`;
}

/**
 * 视频播放结束处理
 */
function handleVideoEnded() {
    console.log('视频播放结束');

    // 显示覆盖层（如果存在的话）
    if (elements.videoOverlay) {
        elements.videoOverlay.classList.remove('hidden');

        // 重置覆盖层提示文本
        const prompt = elements.videoOverlay.querySelector('.play-prompt p');
        if (prompt) {
            prompt.textContent = '点击"开始行驶"开始视频';
        }
    }

    // 更新状态
    isDriving = false;
    updateUIStatus();
    updateStartButton();

    addLogEntry('视频播放结束', 'info');

    // 如果FreeMaster连接，也发送停止信号
    if (pcmConnected) {
        writeVariable('CAN_DW.startdriving', 0).catch(error => {
            console.error('发送停止信号失败:', error);
        });
    }
}

/**
 * 处理视频覆盖层点击
 */
function handleVideoOverlayClick() {
    if (!isDriving) {
        handleStartDriving();
    } else {
        // 如果正在行驶，直接播放视频
        if (elements.videoOverlay) {
            elements.videoOverlay.classList.add('hidden');
        }
        elements.carVideo.play().catch(error => {
            console.error('手动播放视频失败:', error);
            addLogEntry('手动播放视频失败: ' + error.message, 'error');
        });
    }
}



/**
 * 处理键盘按键事件
 */
function handleKeyDown(event) {
    // 避免在输入框中触发
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

    switch (event.code) {
        case 'Space':
            event.preventDefault();
            handleStartDriving();
            break;
    }
}

/**
 * 写入变量
 */
async function writeVariable(name, value) {
    if (!pcm || !pcmConnected) {
        throw new Error('FreeMaster未连接');
    }
    
    const result = await pcm.WriteVariable(name, value);
    if (!result.success) {
        throw new Error(result.error || '写入失败');
    }
    return result;
}

/**
 * 读取变量
 */
async function readVariable(name) {
    if (!pcm || !pcmConnected) {
        throw new Error('FreeMaster未连接');
    }
    
    const result = await pcm.ReadVariable(name);
    if (!result.success) {
        throw new Error(result.error || '读取失败');
    }
    return result.data;
}

/**
 * 更新CAN变量状态
 */
async function updateCanVariablesStatus() {
    for (const variable in canVariables) {
        try {
            const value = await readVariable(variable);
            canVariables[variable] = parseInt(value);

            // 更新门按钮状态
            if (variable.includes('Door')) {
                updateDoorButtonsUI(variable, canVariables[variable]);
            }

            // 更新下拉框状态
            if (variable === 'CAN_DW.CAN_FanStatus' && elements.fanSelect) {
                elements.fanSelect.value = canVariables[variable];
            } else if (variable === 'CAN_DW.CAN_LightStatus' && elements.lightSelect) {
                elements.lightSelect.value = canVariables[variable];
            }

            updateStatusDisplay(variable, canVariables[variable]);
        } catch (error) {
            console.error(`读取${variable}失败:`, error);
        }
    }
}

/**
 * 更新门按钮UI
 */
function updateDoorButtonsUI(variable, value) {
    const buttons = document.querySelectorAll(`[data-variable="${variable}"]`);
    buttons.forEach(button => {
        const buttonValue = parseInt(button.dataset.value);
        if (buttonValue === value) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

/**
 * 更新所有控件UI
 */
function updateAllControlsUI() {
    // 更新门按钮
    for (const variable in canVariables) {
        if (variable.includes('Door')) {
            updateDoorButtonsUI(variable, canVariables[variable]);
        }
    }

    // 更新下拉框
    if (elements.fanSelect) {
        elements.fanSelect.value = canVariables['CAN_DW.CAN_FanStatus'];
    }
    if (elements.lightSelect) {
        elements.lightSelect.value = canVariables['CAN_DW.CAN_LightStatus'];
    }
}

/**
 * 更新状态显示
 */
function updateStatusDisplay(variable, value) {
    switch (variable) {
        case 'CAN_DW.CAN_LeftDoor':
            elements.leftDoorStatus.textContent = getDoorActionText(value);
            break;
        case 'CAN_DW.CAN_RightDoor':
            elements.rightDoorStatus.textContent = getDoorActionText(value);
            break;
        case 'CAN_DW.CAN_LightStatus':
            elements.lightStatus.textContent = `模式 ${value + 1}`;
            break;
        case 'CAN_DW.CAN_FanStatus':
            elements.fanStatus.textContent = `档位 ${value}`;
            break;
    }
}

/**
 * 更新UI状态
 */
function updateUIStatus() {
    elements.drivingStatus.textContent = isDriving ? '行驶中' : '停止';
}

/**
 * 更新开始按钮状态
 */
function updateStartButton() {
    const button = elements.startDriving;
    const icon = button.querySelector('.icon');
    const span = button.querySelector('span');

    if (isDriving) {
        button.classList.remove('primary');
        button.classList.add('secondary');
        icon.textContent = '⏹';
        span.textContent = '停止行驶';
    } else {
        button.classList.remove('secondary');
        button.classList.add('primary');
        icon.textContent = '🚗';
        span.textContent = '开始行驶';
    }
}

/**
 * 开始数据更新
 */
function startDataUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
        if (pcmConnected) {
            try {
                await updateCanVariablesStatus();
            } catch (error) {
                console.error('定期数据更新失败:', error);
            }
        }
    }, 2000); // 每2秒更新一次
}

/**
 * 停止数据更新
 */
function stopDataUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

/**
 * 检查视频状态
 */
function checkVideoStatus() {
    console.log('检查视频状态...');

    if (!elements.carVideo) {
        addLogEntry('视频元素未找到', 'error');
        return;
    }

    const video = elements.carVideo;
    console.log('视频元素状态:', {
        src: video.currentSrc,
        readyState: video.readyState,
        networkState: video.networkState,
        error: video.error,
        duration: video.duration,
        paused: video.paused
    });

    addLogEntry(`视频状态: ${video.readyState === 4 ? '已加载' : '加载中'}`, 'info');

    if (video.error) {
        addLogEntry(`视频错误: ${video.error.message}`, 'error');
    }

    // 如果视频没有加载，尝试重新加载
    if (video.readyState === 0 && !video.error) {
        addLogEntry('尝试重新加载视频...', 'info');
        video.load();
    }
}

/**
 * 添加日志条目
 */
function addLogEntry(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;

    if (elements.logContainer) {
        elements.logContainer.appendChild(logEntry);
        elements.logContainer.scrollTop = elements.logContainer.scrollHeight;

        // 限制日志条目数量
        const entries = elements.logContainer.children;
        if (entries.length > 50) {
            elements.logContainer.removeChild(entries[0]);
        }
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}
