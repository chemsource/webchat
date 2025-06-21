// LeanCloud 初始化 - 使用您提供的配置
AV.init({
    appId: 'K1Ti1lg1RKzrO0XekFjysCx8-MdYXbMMI',
    appKey: 'kGVleuo6XC5PqYnSjQVZAiJt',
    serverURL: 'https://k1ti1lg1.api.lncldglobal.com'
});

// 全局变量
let currentUser = null;
let currentChannel = null;
let realtimeClient = null;
let channelsSubscription = null;

// DOM 元素
const loginModal = document.getElementById('login-modal');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');

const createChannelModal = document.getElementById('create-channel-modal');
const channelNameInput = document.getElementById('channel-name-input');
const createChannelBtn = document.getElementById('create-channel-btn');
const cancelCreateChannelBtn = document.getElementById('cancel-create-channel-btn');
const createChannelBtnMain = document.getElementById('create-channel-btn-main');

const channelList = document.getElementById('channel-list');
const chatArea = document.getElementById('chat-area');
const messageText = document.getElementById('message-text');
const sendBtn = document.getElementById('send-btn');

// 初始化函数
function init() {
    // 检查当前用户
    currentUser = AV.User.current();
    if (currentUser) {
        showMainUI();
        initRealtime();
        loadChannels();
    } else {
        showLoginModal();
    }

    // 事件监听
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);
    createChannelBtn.addEventListener('click', createChannel);
    cancelCreateChannelBtn.addEventListener('click', () => createChannelModal.style.display = 'none');
    createChannelBtnMain.addEventListener('click', () => createChannelModal.style.display = 'flex');
    sendBtn.addEventListener('click', sendMessage);
    
    messageText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// 初始化实时通信
async function initRealtime() {
    realtimeClient = await new Realtime({
        appId: AV.applicationId,
        appKey: AV.applicationKey,
        server: AV.serverURL
    }).createIMClient(currentUser);
}

// 用户登录
async function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    try {
        currentUser = await AV.User.logIn(username, password);
        showMainUI();
        initRealtime();
        loadChannels();
        loginModal.style.display = 'none';
    } catch (error) {
        alert('登录失败: ' + error.message);
    }
}

// 用户注册
async function handleRegister() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    const user = new AV.User();
    user.setUsername(username);
    user.setPassword(password);
    
    try {
        await user.signUp();
        currentUser = user;
        showMainUI();
        initRealtime();
        loadChannels();
        loginModal.style.display = 'none';
    } catch (error) {
        alert('注册失败: ' + error.message);
    }
}

// 加载频道列表
async function loadChannels() {
    const query = new AV.Query('Channel');
    query.include('owner');
    query.descending('createdAt');
    
    try {
        const channels = await query.find();
        renderChannelList(channels);
        
        // 订阅频道更新
        if (channelsSubscription) {
            channelsSubscription.unsubscribe();
        }
        channelsSubscription = await realtimeClient.subscribe({
            collection: 'Channel',
        });
        channelsSubscription.on('create', (channel) => {
            renderChannelList([channel, ...channels]);
        });
    } catch (error) {
        console.error('加载频道失败:', error);
    }
}

// 渲染频道列表
function renderChannelList(channels) {
    channelList.innerHTML = '';
    
    channels.forEach(channel => {
        const channelElement = document.createElement('div');
        channelElement.className = 'channel';
        if (currentChannel && channel.id === currentChannel.id) {
            channelElement.classList.add('active');
        }
        channelElement.textContent = channel.get('name');
        channelElement.addEventListener('click', () => joinChannel(channel));
        channelList.appendChild(channelElement);
    });
}

// 加入频道
async function joinChannel(channel) {
    currentChannel = channel;
    renderChannelList(await new AV.Query('Channel').find());
    
    // 加载历史消息
    const messageQuery = new AV.Query('Message');
    messageQuery.equalTo('channel', channel);
    messageQuery.include('sender');
    messageQuery.descending('createdAt');
    messageQuery.limit(50);
    
    try {
        const messages = await messageQuery.find();
        renderMessages(messages.reverse());
        
        // 订阅新消息
        realtimeClient.on('message', (message) => {
            if (message.get('channel').id === channel.id) {
                renderMessages([message]);
            }
        });
    } catch (error) {
        console.error('加载消息失败:', error);
    }
}

// 渲染消息
function renderMessages(messages) {
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        const senderElement = document.createElement('span');
        senderElement.className = 'sender';
        senderElement.textContent = message.get('sender').getUsername() + ': ';
        
        const contentElement = document.createElement('span');
        contentElement.textContent = message.get('content');
        
        messageElement.appendChild(senderElement);
        messageElement.appendChild(contentElement);
        chatArea.appendChild(messageElement);
    });
    
    // 滚动到底部
    chatArea.scrollTop = chatArea.scrollHeight;
}

// 创建频道
async function createChannel() {
    const channelName = channelNameInput.value.trim();
    if (!channelName) return;
    
    const channel = new AV.Object('Channel');
    channel.set('name', channelName);
    channel.set('owner', currentUser);
    
    try {
        await channel.save();
        createChannelModal.style.display = 'none';
        channelNameInput.value = '';
        loadChannels();
    } catch (error) {
        alert('创建频道失败: ' + error.message);
    }
}

// 发送消息
async function sendMessage() {
    const content = messageText.value.trim();
    if (!content || !currentChannel) return;
    
    const message = new AV.Object('Message');
    message.set('content', content);
    message.set('sender', currentUser);
    message.set('channel', currentChannel);
    
    try {
        await message.save();
        messageText.value = '';
    } catch (error) {
        alert('发送消息失败: ' + error.message);
    }
}

// 显示主界面
function showMainUI() {
    loginModal.style.display = 'none';
}

// 显示登录模态框
function showLoginModal() {
    loginModal.style.display = 'flex';
}

// 初始化应用
init();
