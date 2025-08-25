# 智能小车控制系统

基于FreeMaster API开发的现代化小车控制网页应用。

## 功能特性

### 🚗 主要功能
- **实时视频播放**: 点击"开始行驶"时自动播放视频
- **FreeMaster集成**: 通过WebSocket连接FreeMaster进行实时通信
- **CAN信号控制**: 支持左门、右门、灯光状态、风扇状态等信号控制
- **实时状态监控**: 显示所有系统状态和CAN信号状态
- **紧急停止**: 一键停止所有操作并重置系统状态

### 🎨 界面特性
- **现代化UI设计**: 采用现代化的界面设计和动画效果
- **响应式布局**: 支持不同屏幕尺寸的设备
- **实时日志**: 显示系统操作日志和状态变化
- **连接状态指示**: 实时显示FreeMaster连接状态

## 项目结构

```
car_expo/
├── index.html              # 主页面
├── assets/
│   ├── css/
│   │   └── main.css        # 主样式文件
│   ├── js/
│   │   ├── main.js         # 主要JavaScript逻辑
│   │   ├── freemaster-client.js    # FreeMaster客户端库
│   │   ├── simple-jsonrpc-js.js    # JSON-RPC库
│   │   └── jquery-3.7.1.min.js    # jQuery库
│   └── videos/
│       └── car-demo.mp4    # 示例视频文件（需要添加）
└── README.md               # 项目说明文档
```

## 使用方法

### 1. 环境准备
- 确保FreeMaster软件已安装并运行
- FreeMaster需要配置WebSocket服务（默认端口41000）
- 准备一个MP4格式的视频文件放入`assets/videos/`目录

### 2. 配置FreeMaster变量
在FreeMaster项目中需要定义以下变量：
- `startdriving`: 开始行驶控制变量
- `updata`: 数据更新触发变量
- `CAN_LeftDoor`: 左门控制变量
- `CAN_RightDoor`: 右门控制变量
- `CAN_LightStatus`: 灯光状态控制变量
- `CAN_FanStatus`: 风扇状态控制变量

### 3. 启动应用
1. 启动FreeMaster并加载相应的项目文件
2. 确保WebSocket服务已启用（端口41000）
3. 在浏览器中打开`index.html`文件
4. 等待连接状态指示器变为绿色（已连接）

### 4. 操作说明

#### 主控制区域
- **开始行驶**: 点击后开始播放视频并发送startdriving信号（即使FreeMaster未连接也会播放视频）
- **停止行驶**: 行驶状态下点击可停止视频和行驶
- **数据更新**: 手动触发数据更新，读取所有CAN变量状态

#### 键盘快捷键
- **空格键**: 开始/停止行驶（等同于点击开始行驶按钮）

#### CAN信号控制
- 点击各个CAN信号按钮可切换对应信号的开/关状态
- 按钮会显示当前状态（激活时高亮显示）
- 状态变化会实时反映在右侧状态面板中

#### 状态监控
- **连接状态**: 显示与FreeMaster的连接状态
- **系统状态**: 显示当前行驶状态和数据更新状态
- **CAN状态**: 显示所有CAN信号的当前状态
- **系统日志**: 显示操作历史和错误信息

## 配置选项

### FreeMaster连接配置
在`assets/js/main.js`文件中可以修改连接地址：

```javascript
// 本地连接（默认）
const rpcs_addr = "localhost:41000";

// 或者远程连接
// const rpcs_addr = "wss://your-server.com/ws";
```

### 视频文件配置
在`index.html`中修改视频源：

```html
<video id="car-video" controls muted>
    <source src="./assets/videos/your-video.mp4" type="video/mp4">
    您的浏览器不支持视频播放
</video>
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **库依赖**: jQuery 3.7.1, simple-jsonrpc-js
- **通信协议**: WebSocket + JSON-RPC
- **FreeMaster**: NXP FreeMaster客户端库

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 故障排除

### 连接问题
1. 检查FreeMaster是否正在运行
2. 确认WebSocket服务已启用（端口41000）
3. 检查防火墙设置
4. 查看浏览器控制台错误信息

### 视频播放问题
1. 确认视频文件存在且格式正确
2. 检查浏览器是否支持该视频格式
3. 确认浏览器允许自动播放

### CAN信号问题
1. 确认FreeMaster项目中已定义相应变量
2. 检查变量名称是否匹配
3. 确认目标设备已连接并响应

## 开发说明

### 添加新的CAN信号
1. 在`canVariables`对象中添加新变量
2. 在HTML中添加对应的按钮和状态显示
3. 在`getVariableDisplayName`函数中添加显示名称映射
4. 在`updateStatusDisplay`函数中添加状态更新逻辑

### 自定义样式
所有样式定义在`assets/css/main.css`中，使用CSS变量便于主题定制。

## 许可证

本项目基于参考项目开发，请遵循相应的许可证要求。
