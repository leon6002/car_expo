/**
 * 车辆3D渲染器
 * 使用Three.js渲染GLB格式的车辆模型
 */

class Car3DRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.car = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
        
        // 门对象和动画相关
        this.leftDoor = null;
        this.rightDoor = null;
        this.doorAnimations = {};
        this.doorStates = {
            leftDoor: 0,  // 0: 关闭, 1: 开启
            rightDoor: 0
        };

        // 轮子对象和动画相关
        this.wheels = {
            frontLeft: null,
            frontRight: null,
            rearLeft: null,
            rearRight: null
        };
        this.wheelRotationSpeed = 0; // 轮子旋转速度
        this.isWheelsRotating = false;

        // 道路系统
        this.road = null;
        this.roadTexture = null;
        this.roadSpeed = 0; // 道路移动速度
        this.isRoadMoving = false;

        // 灯光动画相关
        this.lightAnimation = null;

        // 车灯系统
        this.lights = {
            headlights: [], // 前灯
            taillights: [], // 尾灯
            brakelights: [], // 刹车灯
            indicators: [], // 转向灯
            daylights: [], // 日间行车灯
            reverselights: [] // 倒车灯
        };
        this.lightsState = {
            headlights: false,
            taillights: false,
            brakelights: false,
            leftIndicator: false,
            rightIndicator: false,
            daylights: false,
            reverselights: false
        };

        // 运镜系统
        this.cameraAnimation = {
            isActive: false,
            mode: 'orbit', // orbit, showcase, cinematic, follow
            startTime: 0,
            duration: 10000, // 10秒
            originalPosition: null,
            originalTarget: null,
            keyframes: [],
            currentKeyframe: 0
        };
        
        this.init();
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLights();
        this.loadCarModel();
        this.setupControls();
        this.animate();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.onWindowResize());
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // 添加雾效果
        this.scene.fog = new THREE.Fog(0xf0f0f0, 10, 50);
    }

    createCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(40, aspect, 0.2, 1000);
        this.camera.position.set(-8, 2, 1.5);
        this.camera.lookAt(0, 0, 0);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        
        this.container.appendChild(this.renderer.domElement);
    }

    createLights() {
        // 进一步增强环境光 - 提高整体亮度
        const ambientLight = new THREE.AmbientLight(0x808080, 2);
        this.scene.add(ambientLight);

        // 主光源 - 从右上方照射，产生阴影
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(-8, 15, 12);
        directionalLight.target.position.set(6, -3, -8);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 5;
        directionalLight.shadow.camera.far = 40;
        directionalLight.shadow.camera.left = 15;
        directionalLight.shadow.camera.right = -15;
        directionalLight.shadow.camera.top = 15;
        directionalLight.shadow.camera.bottom = -15;
        this.scene.add(directionalLight);
        this.scene.add(directionalLight.target);

        // 创建道路
        this.createRoad();

        // 背光补充光源 - 从左后方照射，照亮背光面，不产生阴影
        const backFillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backFillLight.position.set(-12, 8, -10);
        backFillLight.castShadow = false;
        this.scene.add(backFillLight);

        // 侧面补充光源 - 从右侧照射，不产生阴影
        const sideFillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sideFillLight.position.set(20, 6, 0);
        sideFillLight.castShadow = false;
        this.scene.add(sideFillLight);

        // 底部补充光源 - 从下方轻微照射，减少过暗的阴影
        const bottomFillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        bottomFillLight.position.set(0, -3, 0);
        bottomFillLight.castShadow = false;
        this.scene.add(bottomFillLight);
    }

    loadCarModel() {
        const loader = new THREE.GLTFLoader();
        
        loader.load(
            './assets/models/Car.glb',
            (gltf) => {
                console.log('车辆模型加载成功');
                this.car = gltf.scene;
                
                // 设置模型属性并查找门对象
                this.car.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = false; // 车辆不接收阴影，保持亮度
                    }

                    // 查找门对象、轮子对象和车灯对象
                    if (child.name) {
                        const childNameLower = child.name.toLowerCase();
                        // console.log('找到模型对象:', child.name);

                        // 识别车灯对象
                        this.identifyLights(child);

                        // 精确匹配门对象 - 只匹配主门体，排除所有子组件
                        if (this.isDoorMainBody(child.name, 'left')) {
                            this.leftDoor = child;
                            console.log('✓ 找到左门主体:', child.name);
                        } else if (this.isDoorMainBody(child.name, 'right')) {
                            this.rightDoor = child;
                            console.log('✓ 找到右门主体:', child.name);
                        }

                        // 查找轮子对象
                        if (this.isWheelObject(child.name)) {
                            this.assignWheel(child, child.name);
                        }
                    }
                });

                // 调整模型大小和位置
                this.car.scale.set(1, 1, 1);
                // 降低车辆位置，让轮子贴合道路表面
                this.car.position.set(0, -0.5, 0);

                this.scene.add(this.car);

                // 打印模型结构信息
                // console.log('模型加载完成，门对象状态:', {
                //     leftDoor: !!this.leftDoor,
                //     rightDoor: !!this.rightDoor,
                //     leftDoorName: this.leftDoor?.name,
                //     rightDoorName: this.rightDoor?.name
                // });

                // 如果没有找到门对象，尝试通过其他方式查找
                if (!this.leftDoor && !this.rightDoor) {
                    console.warn('未找到门对象，尝试其他查找方式...');
                    this.findDoorsByPosition();
                }

                // 设置动画（如果有预制动画）
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.car);
                    this.setupDoorAnimations(gltf.animations);
                }

                // 添加地面
                this.createGround();
                
                // 通知模型加载完成
                this.onModelLoaded();
            },
            (progress) => {
                // console.log('模型加载进度:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('模型加载失败:', error);
                this.showLoadError();
            }
        );
    }

    setupDoorAnimations(animations) {
        console.log('设置门动画，找到的动画数量:', animations.length);

        animations.forEach((clip, index) => {
            console.log(`动画 ${index}: "${clip.name}", 时长: ${clip.duration}秒`);

            const action = this.mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;

            const clipNameLower = clip.name.toLowerCase();

            // 根据动画名称分类 - 扩展匹配规则
            if (clipNameLower.includes('leftdoor') ||
                clipNameLower.includes('left_door') ||
                clipNameLower.includes('left-door') ||
                clipNameLower.includes('door_left') ||
                clipNameLower.includes('door-left') ||
                clipNameLower.includes('门左') ||
                clipNameLower.includes('左门')) {
                this.doorAnimations.leftDoor = action;
                console.log('✓ 找到左门动画:', clip.name);
            } else if (clipNameLower.includes('rightdoor') ||
                       clipNameLower.includes('right_door') ||
                       clipNameLower.includes('right-door') ||
                       clipNameLower.includes('door_right') ||
                       clipNameLower.includes('door-right') ||
                       clipNameLower.includes('门右') ||
                       clipNameLower.includes('右门')) {
                this.doorAnimations.rightDoor = action;
                console.log('✓ 找到右门动画:', clip.name);
            } else {
                console.log('? 未识别的动画:', clip.name);
                // 如果只有一个动画，假设它是左门动画
                if (animations.length === 1) {
                    this.doorAnimations.leftDoor = action;
                    console.log('→ 将唯一动画设为左门动画');
                }
            }
        });

        console.log('动画设置完成:', {
            leftDoor: !!this.doorAnimations.leftDoor,
            rightDoor: !!this.doorAnimations.rightDoor
        });

        // 存储所有动画以便按名称查找
        this.allAnimations = {};
        animations.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            this.allAnimations[clip.name] = action;
            console.log(`存储动画: "${clip.name}"`);
        });
    }

    // 判断是否为门主体对象
    isDoorMainBody(objectName, side) {
        const nameLower = objectName.toLowerCase();
        const sidePattern = side === 'left' ? 'left_door' : 'right_door';

        // 必须包含门的基本标识
        if (!nameLower.includes(sidePattern)) {
            return false;
        }

        // 排除所有子组件和附件
        const excludeKeywords = [
            'glass', 'stitch', 'handle', 'mirror', 'trim', 'interior',
            'buttons', 'letterings', 'panel', 'window', 'seal', 'rubber',
            'chrome', 'molding', 'weatherstrip', 'lock', 'latch'
        ];

        for (const keyword of excludeKeywords) {
            if (nameLower.includes(keyword)) {
                return false;
            }
        }

        // 检查是否符合主门体的命名模式（如 Left_Door_126_229）
        // 主门体通常只有基本的 Left_Door 或 Right_Door 加上数字
        const pattern = new RegExp(`^${sidePattern}_\\d+_\\d+$`, 'i');
        if (pattern.test(objectName)) {
            return true;
        }

        // 如果名称就是简单的 Left_Door 或 Right_Door
        if (nameLower === sidePattern) {
            return true;
        }

        return false;
    }

    // 判断是否为轮子主体对象
    isWheelObject(objectName) {
        const nameLower = objectName.toLowerCase();

        // 必须包含轮子的基本标识
        if (!nameLower.includes('wheel')) {
            return false;
        }

        // 必须包含位置标识
        if (!(nameLower.includes('front') || nameLower.includes('rear')) ||
            !(nameLower.includes('left') || nameLower.includes('right'))) {
            return false;
        }

        // 排除轮子的子组件
        const excludeKeywords = [
            'tire', 'treads', 'rim', 'hub', 'brake', 'disc', 'caliper',
            'bearing', 'bolt', 'nut', 'valve', 'cap', 'cover'
        ];

        for (const keyword of excludeKeywords) {
            if (nameLower.includes(keyword)) {
                return false;
            }
        }

        // 检查是否符合轮子主体的命名模式（如 Rear_Right_Wheel_28_51）
        const pattern = /^(front|rear)_(left|right)_wheel_\d+_\d+$/i;
        if (pattern.test(objectName)) {
            return true;
        }

        // 如果名称就是简单的 Front_Left_Wheel 等
        const simplePattern = /^(front|rear)_(left|right)_wheel$/i;
        if (simplePattern.test(objectName)) {
            return true;
        }

        return false;
    }

    // 分配轮子对象到对应位置
    assignWheel(wheelObject, objectName) {
        const nameLower = objectName.toLowerCase();

        if (nameLower.includes('front') && nameLower.includes('left')) {
            this.wheels.frontLeft = wheelObject;
            console.log('✓ 找到前左轮:', objectName);
        } else if (nameLower.includes('front') && nameLower.includes('right')) {
            this.wheels.frontRight = wheelObject;
            console.log('✓ 找到前右轮:', objectName);
        } else if (nameLower.includes('rear') && nameLower.includes('left')) {
            this.wheels.rearLeft = wheelObject;
            console.log('✓ 找到后左轮:', objectName);
        } else if (nameLower.includes('rear') && nameLower.includes('right')) {
            this.wheels.rearRight = wheelObject;
            console.log('✓ 找到后右轮:', objectName);
        }
    }

    // 识别车灯对象
    identifyLights(object) {
        const name = object.name.toLowerCase();
        let lightType = null;

        // 前灯 (头灯)
        if (name.includes('lights_low_beams') || name.includes('lights_high_beams') ||
            name.includes('lights_day_lights')) {
            this.lights.headlights.push(object);
            lightType = 'headlights';
        }
        // 尾灯
        else if (name.includes('lights_taillights') || name.includes('rear_lights') ||
                 name.includes('trunk_taillight')) {
            this.lights.taillights.push(object);
            lightType = 'taillights';
        }
        // 刹车灯
        else if (name.includes('lights_brake_lights') || name.includes('rear_bumper_brake_lights')) {
            this.lights.brakelights.push(object);
            lightType = 'brakelights';
        }
        // 转向灯
        else if (name.includes('indicator_blinker')) {
            this.lights.indicators.push(object);
            lightType = 'indicators';
        }
        // 日间行车灯
        else if (name.includes('day_lights')) {
            this.lights.daylights.push(object);
            lightType = 'daylights';
        }
        // 倒车灯
        else if (name.includes('reverse_lights')) {
            this.lights.reverselights.push(object);
            lightType = 'reverselights';
        }

        // 如果识别到车灯，打印详细属性
        // if (lightType) {
        //     console.log(`🔍 识别到${lightType}车灯:`, {
        //         name: object.name,
        //         type: object.type,
        //         visible: object.visible,
        //         material: object.material ? {
        //             type: object.material.type,
        //             color: object.material.color,
        //             emissive: object.material.emissive,
        //             opacity: object.material.opacity,
        //             transparent: object.material.transparent
        //         } : 'no material',
        //         children: object.children.length,
        //         position: object.position,
        //         scale: object.scale
        //     });
        // }
    }

    findDoorsByPosition() {
        // 如果通过名称找不到门，尝试通过更宽泛的名称匹配
        const allObjects = [];
        this.car.traverse((child) => {
            if (child.name) {
                allObjects.push({
                    name: child.name,
                    object: child,
                    isMesh: child.isMesh,
                    position: child.position.clone()
                });
            }
        });

        console.log('模型中的所有命名对象:', allObjects.map(obj => obj.name));

        // 使用精确匹配查找门主体
        allObjects.forEach(obj => {
            if (this.isDoorMainBody(obj.name, 'left') && !this.leftDoor) {
                this.leftDoor = obj.object;
                console.log('✓ 通过备用方法找到左门主体:', obj.name);
            } else if (this.isDoorMainBody(obj.name, 'right') && !this.rightDoor) {
                this.rightDoor = obj.object;
                console.log('✓ 通过备用方法找到右门主体:', obj.name);
            }
        });

        console.log('门主体查找结果:', {
            leftDoor: this.leftDoor?.name || 'Not found',
            rightDoor: this.rightDoor?.name || 'Not found'
        });

        // 如果还是没找到，列出所有包含 "door" 的对象供调试
        if (!this.leftDoor && !this.rightDoor) {
            const allDoorObjects = allObjects.filter(obj =>
                obj.name.toLowerCase().includes('door')
            );
            console.log('所有包含"door"的对象:', allDoorObjects.map(obj => obj.name));
        }
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    // 创建道路
    createRoad() {
        // 创建道路纹理
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // 绘制道路背景
        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制道路标线
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.setLineDash([20, 20]);

        // 中央虚线
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();

        // 边线
        ctx.setLineDash([]);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(50, 0);
        ctx.lineTo(50, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(canvas.width - 50, 0);
        ctx.lineTo(canvas.width - 50, canvas.height);
        ctx.stroke();

        // 创建纹理
        this.roadTexture = new THREE.CanvasTexture(canvas);
        this.roadTexture.wrapS = THREE.RepeatWrapping;
        this.roadTexture.wrapT = THREE.RepeatWrapping;
        this.roadTexture.repeat.set(1, 5); // 重复8次，创建长道路效果

        // 创建道路几何体
        const roadGeometry = new THREE.PlaneGeometry(10, 150);
        const roadMaterial = new THREE.MeshLambertMaterial({
            map: this.roadTexture,
            transparent: false
        });

        this.road = new THREE.Mesh(roadGeometry, roadMaterial);
        this.road.rotation.x = -Math.PI / 2;
        this.road.position.y = -0.49; // 稍微高于地面，避免z-fighting
        this.road.receiveShadow = true;

        this.scene.add(this.road);
        console.log('道路已创建');
    }

    setupControls() {
        // 使用 OrbitControls 进行相机控制
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2;
            this.controls.minDistance = 2;
            this.controls.maxDistance = 20;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        if (this.mixer) {
            this.mixer.update(delta);
        }

        if (this.controls) {
            this.controls.update();
        }

        // 更新轮子旋转
        this.updateWheelRotation(delta);

        // 更新道路移动
        this.updateRoadMovement(delta);

        // 更新运镜动画
        this.updateCameraAnimation(delta);

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }

    onModelLoaded() {
        // 隐藏加载提示
        const loadingElement = this.container.querySelector('.loading-3d');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        // 触发自定义事件
        const event = new CustomEvent('car3dLoaded');
        document.dispatchEvent(event);
    }

    showLoadError() {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-3d';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h3>模型加载失败</h3>
                <p>请检查模型文件路径: assets/models/Car.glb</p>
            </div>
        `;
        this.container.appendChild(errorDiv);
    }

    // 门控制方法
    controlLeftDoor(action) {
        console.log('控制左门，动作:', action);
        console.log('左门对象是否存在:', !!this.leftDoor);

        if (!this.leftDoor) {
            console.warn('左门对象不存在');
            return;
        }

        switch(action) {
            case 1: // 开门
                console.log('执行左门开门动画');
                this.animateDoor(this.leftDoor, 'left', true);
                this.doorStates.leftDoor = 1;
                break;
            case 2: // 关门
                console.log('执行左门关门动画');
                this.animateDoor(this.leftDoor, 'left', false);
                this.doorStates.leftDoor = 0;
                break;
            case 0: // 停止
                console.log('停止左门动画');
                // 停止动画的逻辑可以在这里实现
                break;
        }
    }

    controlRightDoor(action) {
        console.log('控制右门，动作:', action);
        console.log('右门对象是否存在:', !!this.rightDoor);

        if (!this.rightDoor) {
            console.warn('右门对象不存在');
            return;
        }

        switch(action) {
            case 1: // 开门
                console.log('执行右门开门动画');
                this.animateDoor(this.rightDoor, 'right', true);
                this.doorStates.rightDoor = 1;
                break;
            case 2: // 关门
                console.log('执行右门关门动画');
                this.animateDoor(this.rightDoor, 'right', false);
                this.doorStates.rightDoor = 0;
                break;
            case 0: // 停止
                console.log('停止右门动画');
                // 停止动画的逻辑可以在这里实现
                break;
        }
    }

    // 灯光控制方法
    controlLights(mode) {
        console.log('控制灯光，模式:', mode);

        if (!this.carModel) {
            console.warn('车辆模型不存在，无法控制灯光');
            return;
        }

        // 根据模式设置不同的灯光效果
        switch (mode) {
            case 0:
                console.log('灯光模式 1 - 常亮');
                this.setLightMode('constant');
                break;
            case 1:
                console.log('灯光模式 2 - 慢闪');
                this.setLightMode('slow_blink');
                break;
            case 2:
                console.log('灯光模式 3 - 快闪');
                this.setLightMode('fast_blink');
                break;
            case 3:
                console.log('灯光模式 4 - 呼吸灯');
                this.setLightMode('breathing');
                break;
            default:
                console.log('未知灯光模式:', mode);
                this.setLightMode('constant');
                break;
        }
    }

    // 设置灯光模式
    setLightMode(mode) {
        // 清除之前的灯光动画
        if (this.lightAnimation) {
            clearInterval(this.lightAnimation);
            this.lightAnimation = null;
        }

        // 查找车辆的灯光部件（这里需要根据实际模型结构调整）
        const lights = [];
        if (this.carModel) {
            this.carModel.traverse((child) => {
                // 查找可能是灯光的部件（根据名称或材质特征）
                if (child.isMesh && child.material) {
                    const name = child.name.toLowerCase();
                    if (name.includes('light') || name.includes('lamp') ||
                        name.includes('headlight') || name.includes('taillight')) {
                        lights.push(child);
                    }
                }
            });
        }

        console.log('找到灯光部件数量:', lights.length);

        // 根据模式设置动画
        switch (mode) {
            case 'constant':
                lights.forEach(light => {
                    if (light.material.emissive) {
                        light.material.emissive.setHex(0xffffff);
                        light.material.emissiveIntensity = 0.5;
                    }
                });
                break;

            case 'slow_blink':
                this.startBlinkAnimation(lights, 1000); // 1秒间隔
                break;

            case 'fast_blink':
                this.startBlinkAnimation(lights, 300); // 0.3秒间隔
                break;

            case 'breathing':
                this.startBreathingAnimation(lights);
                break;
        }
    }

    // 开始闪烁动画
    startBlinkAnimation(lights, interval) {
        let isOn = true;
        this.lightAnimation = setInterval(() => {
            lights.forEach(light => {
                if (light.material.emissive) {
                    if (isOn) {
                        light.material.emissive.setHex(0xffffff);
                        light.material.emissiveIntensity = 0.8;
                    } else {
                        light.material.emissive.setHex(0x000000);
                        light.material.emissiveIntensity = 0;
                    }
                }
            });
            isOn = !isOn;
        }, interval);
    }

    // 开始呼吸灯动画
    startBreathingAnimation(lights) {
        let intensity = 0;
        let direction = 1;
        this.lightAnimation = setInterval(() => {
            intensity += direction * 0.05;
            if (intensity >= 1) {
                intensity = 1;
                direction = -1;
            } else if (intensity <= 0) {
                intensity = 0;
                direction = 1;
            }

            lights.forEach(light => {
                if (light.material.emissive) {
                    light.material.emissive.setHex(0xffffff);
                    light.material.emissiveIntensity = intensity;
                }
            });
        }, 50); // 50ms间隔，创建平滑的呼吸效果
    }

    // 获取相机位置用于调试
    getCameraPosition() {
        return {
            position: this.camera.position.clone(),
            target: this.controls ? this.controls.target.clone() : new THREE.Vector3()
        };
    }

    // 设置相机位置
    setCameraPosition(position, target) {
        this.camera.position.copy(position);
        if (this.controls && target) {
            this.controls.target.copy(target);
            this.controls.update();
        }
    }

    // 门动画方法
    animateDoor(doorObject, side, isOpening) {
        if (!doorObject) return;

        // 先打印门对象的当前状态，帮助调试
        console.log(`${side}门当前状态:`, {
            position: doorObject.position,
            rotation: {
                x: doorObject.rotation.x * 180 / Math.PI,
                y: doorObject.rotation.y * 180 / Math.PI,
                z: doorObject.rotation.z * 180 / Math.PI
            }
        });

        // 设置门的旋转信息（铰链位置等）
        this.setDoorPivot(doorObject, side);

        // 普通车门的旋转角度（度数）
        const openAngle = -72; // 72度
        const closeAngle = 0;

        // 根据门的朝向调整旋转方向 - 修正方向
        const direction = side === 'left' ? -1 : 1; // 左门向前开，右门向前开
        const targetAngle = isOpening ? openAngle * direction : closeAngle;
        console.log(`${side}门动画: ${isOpening ? '开启' : '关闭'}, 目标角度: ${targetAngle}度`);

        // 使用 rotateOnWorldAxis 进行旋转
        this.rotateDoorOnWorldAxis(doorObject, targetAngle);
    }



    // 门旋转动画 - 正确的铰链旋转方法
    rotateDoorOnWorldAxis(doorObject, targetAngle) {
        const hingePosition = doorObject.userData.hingePosition;
        const originalPosition = doorObject.userData.originalPosition;
        const currentAngle = doorObject.userData.currentAngle || 0;

        if (!hingePosition || !originalPosition) {
            console.error('门的铰链位置或原始位置未找到');
            return;
        }

        const angleChange = targetAngle - currentAngle;
        const duration = 1500; // 1.5秒
        const startTime = Date.now();

        console.log(`开始门旋转动画: 从 ${currentAngle}° 到 ${targetAngle}°`);
        console.log('铰链位置:', hingePosition);
        console.log('门原始位置:', originalPosition);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用缓动函数
            const easeProgress = this.easeInOutCubic(progress);

            // 计算当前应该的角度
            const currentFrameAngle = currentAngle + angleChange * easeProgress;

            // 计算门相对于铰链的偏移向量
            const offsetFromHinge = originalPosition.clone().sub(hingePosition);

            // 创建旋转矩阵，绕Y轴旋转
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationY(THREE.MathUtils.degToRad(currentFrameAngle));

            // 应用旋转到偏移向量
            const rotatedOffset = offsetFromHinge.clone().applyMatrix4(rotationMatrix);

            // 计算门的新位置 = 铰链位置 + 旋转后的偏移
            const newPosition = hingePosition.clone().add(rotatedOffset);

            // 设置门的新位置
            doorObject.position.copy(newPosition);

            // 设置门的旋转（保持原始旋转 + 当前旋转角度）
            doorObject.rotation.copy(doorObject.userData.originalRotation);
            doorObject.rotation.y += THREE.MathUtils.degToRad(currentFrameAngle);

            // 更新当前角度
            doorObject.userData.currentAngle = currentFrameAngle;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log(`门旋转动画完成，最终角度: ${currentFrameAngle}°`);
            }
        };

        animate();
    }


    // 设置门的旋转信息 - 使用 rotateOnWorldAxis 方法
    setDoorPivot(doorObject, side) {
        // 如果已经设置过，直接返回
        if (doorObject.userData.hingePosition) {
            return doorObject;
        }

        console.log(`设置${side}门的旋转信息`);

        // 保存门的原始状态
        const originalPosition = doorObject.position.clone();
        const originalRotation = doorObject.rotation.clone();

        console.log(`${side}门原始位置:`, originalPosition);
        console.log(`${side}门原始旋转:`, originalRotation);

        // 获取门的边界框来了解门的尺寸
        const doorBox = new THREE.Box3().setFromObject(doorObject);
        const doorSize = doorBox.getSize(new THREE.Vector3());

        console.log(`${side}门尺寸:`, doorSize);

        // 计算铰链位置 - 铰链应该在门靠近车身的边缘
        let hingeWorldPosition = originalPosition.clone();

        // 根据门的方向调整铰链位置
        // 铰链通常在门的后边缘（靠近车身的一侧）
        if (side === 'left') {
            // 左门铰链在门的右侧边缘（靠近车身中心）
            // 使用门尺寸的一半作为偏移
            hingeWorldPosition.x += doorSize.x * 0.4;
        } else {
            // 右门铰链在门的左侧边缘（靠近车身中心）
            hingeWorldPosition.x -= doorSize.x * 0.4;
        }

        console.log(`${side}门铰链位置:`, hingeWorldPosition);

        // 保存铰链位置和原始状态到门的userData中
        doorObject.userData.hingePosition = hingeWorldPosition;
        doorObject.userData.originalPosition = originalPosition;
        doorObject.userData.originalRotation = originalRotation;
        doorObject.userData.side = side;
        doorObject.userData.currentAngle = 0; // 当前旋转角度

        console.log(`${side}门旋转信息设置完成`);

        return doorObject;
    }

    // 添加门的调试可视化
    addDoorDebugVisuals(doorObject, pivotGroup, side) {
        // 如果已经添加过调试可视化，先移除
        if (doorObject.userData.debugVisuals) {
            doorObject.userData.debugVisuals.forEach(visual => {
                visual.parent.remove(visual);
            });
        }

        const debugVisuals = [];

        // 1. 添加门的边界框
        const doorBox = new THREE.Box3().setFromObject(doorObject);
        const doorBoxHelper = new THREE.Box3Helper(doorBox, 0xff0000); // 红色边界框
        this.scene.add(doorBoxHelper);
        debugVisuals.push(doorBoxHelper);

        // 2. 添加轴心点标记（小球）
        const pivotGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const pivotMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // 绿色轴心
        const pivotMarker = new THREE.Mesh(pivotGeometry, pivotMaterial);

        // 轴心标记的世界位置
        const worldPosition = new THREE.Vector3();
        pivotGroup.getWorldPosition(worldPosition);
        pivotMarker.position.copy(worldPosition);

        this.scene.add(pivotMarker);
        debugVisuals.push(pivotMarker);

        // 3. 添加门中心点标记（小球）
        const doorCenter = new THREE.Vector3();
        doorBox.getCenter(doorCenter);
        const centerGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const centerMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // 蓝色中心点
        const centerMarker = new THREE.Mesh(centerGeometry, centerMaterial);
        centerMarker.position.copy(doorCenter);
        this.scene.add(centerMarker);
        debugVisuals.push(centerMarker);

        // 4. 添加坐标轴辅助器到轴心组
        const axesHelper = new THREE.AxesHelper(0.5);
        pivotGroup.add(axesHelper);
        debugVisuals.push(axesHelper);

        // 5. 添加文本标签
        console.log(`${side}门调试信息:`);
        console.log(`- 门边界框:`, doorBox);
        console.log(`- 门中心:`, doorCenter);
        console.log(`- 轴心位置:`, worldPosition);

        // 保存调试可视化对象的引用
        doorObject.userData.debugVisuals = debugVisuals;
    }

    // 移除门的调试可视化
    removeDoorDebugVisuals(doorObject) {
        if (doorObject.userData.debugVisuals) {
            doorObject.userData.debugVisuals.forEach(visual => {
                if (visual.parent) {
                    visual.parent.remove(visual);
                }
            });
            doorObject.userData.debugVisuals = [];
        }
    }


    // 更新轮子旋转
    updateWheelRotation(delta) {
        if (this.isWheelsRotating && this.wheelRotationSpeed > 0) {
            // 计算旋转角度
            const rotationAngle = this.wheelRotationSpeed * delta;

            // 旋转所有轮子
            Object.values(this.wheels).forEach(wheel => {
                if (wheel) {
                    wheel.rotation.x -= rotationAngle;
                }
            });
        }
    }

    // 开始轮子旋转
    startWheelRotation(speed = 5) {
        console.log('开始轮子旋转，速度:', speed);
        this.wheelRotationSpeed = speed;
        this.isWheelsRotating = true;

        // 显示找到的轮子状态
        console.log('轮子状态:', {
            frontLeft: !!this.wheels.frontLeft,
            frontRight: !!this.wheels.frontRight,
            rearLeft: !!this.wheels.rearLeft,
            rearRight: !!this.wheels.rearRight
        });
    }

    // 停止轮子旋转
    stopWheelRotation() {
        console.log('停止轮子旋转');
        this.isWheelsRotating = false;
        this.wheelRotationSpeed = 0;
    }

    // 设置轮子旋转速度
    setWheelRotationSpeed(speed) {
        console.log('设置轮子旋转速度:', speed);
        this.wheelRotationSpeed = speed;
    }

    // 更新道路移动
    updateRoadMovement(delta) {
        if (this.isRoadMoving && this.roadSpeed > 0 && this.roadTexture) {
            // 移动道路纹理的偏移
            this.roadTexture.offset.y += this.roadSpeed * delta;

            // 当偏移超过1时重置，创建无缝循环
            if (this.roadTexture.offset.y >= 1) {
                this.roadTexture.offset.y = 0;
            }
        }
    }

    // 开始道路移动
    startRoadMovement(speed = 2) {
        console.log('开始道路移动，速度:', speed);
        this.roadSpeed = speed;
        this.isRoadMoving = true;
    }

    // 停止道路移动
    stopRoadMovement() {
        console.log('停止道路移动');
        this.isRoadMoving = false;
        this.roadSpeed = 0;
    }

    // 设置道路移动速度
    setRoadMovementSpeed(speed) {
        console.log('设置道路移动速度:', speed);
        this.roadSpeed = speed;
    }

    // 缓动函数
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // 车灯控制方法
    toggleHeadlights() {
        this.lightsState.headlights = !this.lightsState.headlights;
        this.updateLights('headlights', this.lightsState.headlights);
        console.log('前灯状态:', this.lightsState.headlights ? '开启' : '关闭');
        return this.lightsState.headlights;
    }

    toggleTaillights() {
        this.lightsState.taillights = !this.lightsState.taillights;
        this.updateLights('taillights', this.lightsState.taillights);
        console.log('尾灯状态:', this.lightsState.taillights ? '开启' : '关闭');
        return this.lightsState.taillights;
    }

    toggleBrakelights() {
        this.lightsState.brakelights = !this.lightsState.brakelights;
        this.updateLights('brakelights', this.lightsState.brakelights);
        console.log('刹车灯状态:', this.lightsState.brakelights ? '开启' : '关闭');
        return this.lightsState.brakelights;
    }

    // 更新车灯状态
    updateLights(lightType, isOn) {
        const lights = this.lights[lightType];
        if (!lights || lights.length === 0) {
            console.warn(`未找到 ${lightType} 车灯对象`);
            return;
        }

        console.log(`🔧 更新${lightType}车灯状态:`, isOn ? '开启' : '关闭', `(共${lights.length}个)`);

        lights.forEach((light, index) => {
            console.log(`  处理车灯 ${index + 1}:`, light.name);

            // 方法1: 使用visible属性
            light.visible = isOn;

            // 方法2: 遍历所有子对象，也设置visible
            light.traverse((child) => {
                if (child.isMesh) {
                    child.visible = isOn;
                }
            });

            // 方法3: 如果有材质，也调整材质属性
            if (light.material) {
                if (isOn) {
                    // 根据车灯类型设置不同的颜色和亮度
                    let emissiveColor, intensity;

                    if (lightType === 'headlights') {
                        // 前灯 - 更亮的白色
                        emissiveColor = new THREE.Color(0xffffff);
                        intensity = 2.0;
                    } else if (lightType === 'taillights') {
                        // 尾灯 - 更红的颜色
                        emissiveColor = new THREE.Color(0xff0000);
                        intensity = 0.8;
                    } else if (lightType === 'brakelights') {
                        // 刹车灯 - 明亮的红色
                        emissiveColor = new THREE.Color(0xff0000);
                        intensity = 1.0;
                    } else {
                        // 其他车灯 - 默认白色
                        emissiveColor = new THREE.Color(0xffffff);
                        intensity = 0.8;
                    }

                    light.material.emissive = emissiveColor;
                    if (light.material.emissiveIntensity !== undefined) {
                        light.material.emissiveIntensity = intensity;
                    }
                    if (light.material.opacity !== undefined) {
                        light.material.opacity = 1;
                    }
                    light.material.transparent = false;
                } else {
                    // 关闭车灯
                    light.material.emissive = new THREE.Color(0x000000);
                    if (light.material.emissiveIntensity !== undefined) {
                        light.material.emissiveIntensity = 0;
                    }
                    if (light.material.opacity !== undefined) {
                        light.material.opacity = 0.1;
                    }
                    light.material.transparent = true;
                }
            }

            // 方法4: 遍历子对象的材质
            light.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (isOn) {
                        // 根据车灯类型设置不同的颜色和亮度
                        let emissiveColor, intensity;

                        if (lightType === 'headlights') {
                            // 前灯 - 更亮的白色
                            emissiveColor = new THREE.Color(0xffffff);
                            intensity = 2.0;
                        } else if (lightType === 'taillights') {
                            // 尾灯 - 更红的颜色
                            emissiveColor = new THREE.Color(0xff0000);
                            intensity = 0.8;
                        } else if (lightType === 'brakelights') {
                            // 刹车灯 - 明亮的红色
                            emissiveColor = new THREE.Color(0xff0000);
                            intensity = 1.0;
                        } else {
                            // 其他车灯 - 默认白色
                            emissiveColor = new THREE.Color(0xffffff);
                            intensity = 0.8;
                        }

                        child.material.emissive = emissiveColor;
                        if (child.material.emissiveIntensity !== undefined) {
                            child.material.emissiveIntensity = intensity;
                        }
                        if (child.material.opacity !== undefined) {
                            child.material.opacity = 1;
                        }
                        child.material.transparent = false;
                    } else {
                        child.material.emissive = new THREE.Color(0x000000);
                        if (child.material.emissiveIntensity !== undefined) {
                            child.material.emissiveIntensity = 0;
                        }
                        if (child.material.opacity !== undefined) {
                            child.material.opacity = 0.1;
                        }
                        child.material.transparent = true;
                    }
                }
            });

            console.log(`  ✓ 车灯 ${index + 1} 状态已更新`);
        });
    }

    // 获取车灯状态信息
    getLightsInfo() {
        return {
            headlights: this.lights.headlights.length,
            taillights: this.lights.taillights.length,
            brakelights: this.lights.brakelights.length,
            indicators: this.lights.indicators.length,
            daylights: this.lights.daylights.length,
            reverselights: this.lights.reverselights.length,
            state: this.lightsState
        };
    }

    // ==================== 运镜系统 ====================

    // 开始运镜动画
    startCameraAnimation(mode = 'orbit', duration = 10000) {
        console.log(`开始运镜动画: ${mode}, 时长: ${duration}ms`);

        // 保存当前相机状态
        this.cameraAnimation.originalPosition = this.camera.position.clone();
        this.cameraAnimation.originalTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0);

        // 设置动画参数
        this.cameraAnimation.mode = mode;
        this.cameraAnimation.duration = duration;
        this.cameraAnimation.startTime = Date.now();
        this.cameraAnimation.isActive = true;
        this.cameraAnimation.currentKeyframe = 0;

        // 根据模式生成关键帧
        this.generateCameraKeyframes(mode);

        // 禁用手动控制
        if (this.controls) {
            this.controls.enabled = false;
        }
    }

    // 停止运镜动画
    stopCameraAnimation() {
        console.log('停止运镜动画');
        this.cameraAnimation.isActive = false;

        // 恢复手动控制
        if (this.controls) {
            this.controls.enabled = true;
        }
    }

    // 生成相机关键帧
    generateCameraKeyframes(mode) {
        this.cameraAnimation.keyframes = [];

        switch (mode) {
            case 'orbit':
                this.generateOrbitKeyframes();
                break;
            case 'showcase':
                this.generateShowcaseKeyframes();
                break;
            case 'cinematic':
                this.generateCinematicKeyframes();
                break;
            case 'follow':
                this.generateFollowKeyframes();
                break;
            default:
                this.generateOrbitKeyframes();
        }

        console.log(`生成了 ${this.cameraAnimation.keyframes.length} 个关键帧`);
    }

    // 生成环绕运镜关键帧
    generateOrbitKeyframes() {
        const radius = 12;
        const height = 3;
        const target = new THREE.Vector3(0, 0, 0);
        const steps = 8;

        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const position = new THREE.Vector3(
                Math.cos(angle) * radius,
                height + Math.sin(angle * 2) * 1, // 上下波动
                Math.sin(angle) * radius
            );

            this.cameraAnimation.keyframes.push({
                position: position,
                target: target.clone(),
                time: i / steps
            });
        }
    }

    // 生成展示运镜关键帧
    generateShowcaseKeyframes() {
        const positions = [
            // 前方低角度
            { pos: new THREE.Vector3(0, 1, 8), target: new THREE.Vector3(0, 0, 0) },
            // 右侧
            { pos: new THREE.Vector3(8, 2, 0), target: new THREE.Vector3(0, 0, 0) },
            // 后方高角度
            { pos: new THREE.Vector3(0, 4, -8), target: new THREE.Vector3(0, 0, 0) },
            // 左侧
            { pos: new THREE.Vector3(-8, 2, 0), target: new THREE.Vector3(0, 0, 0) },
            // 俯视角度
            { pos: new THREE.Vector3(0, 10, 2), target: new THREE.Vector3(0, 0, 0) },
            // 回到前方
            { pos: new THREE.Vector3(0, 1, 8), target: new THREE.Vector3(0, 0, 0) }
        ];

        positions.forEach((keyframe, index) => {
            this.cameraAnimation.keyframes.push({
                position: keyframe.pos,
                target: keyframe.target,
                time: index / (positions.length - 1)
            });
        });
    }

    // 生成电影运镜关键帧
    generateCinematicKeyframes() {
        const keyframes = [
            // 开场：远景
            { pos: new THREE.Vector3(-15, 8, 10), target: new THREE.Vector3(0, 0, 0) },
            // 推进：中景
            { pos: new THREE.Vector3(-8, 4, 6), target: new THREE.Vector3(0, 0, 0) },
            // 特写：车头
            { pos: new THREE.Vector3(0, 1.5, 4), target: new THREE.Vector3(0, 0, 2) },
            // 侧面滑动
            { pos: new THREE.Vector3(6, 2, 2), target: new THREE.Vector3(0, 0, 0) },
            // 后方追踪
            { pos: new THREE.Vector3(0, 2, -6), target: new THREE.Vector3(0, 0, 0) },
            // 高空俯视
            { pos: new THREE.Vector3(0, 12, 0), target: new THREE.Vector3(0, 0, 0) },
            // 结尾：回到初始位置
            { pos: new THREE.Vector3(-8, 2, 1.5), target: new THREE.Vector3(0, 0, 0) }
        ];

        keyframes.forEach((keyframe, index) => {
            this.cameraAnimation.keyframes.push({
                position: keyframe.pos,
                target: keyframe.target,
                time: index / (keyframes.length - 1)
            });
        });
    }

    // 生成跟随运镜关键帧（模拟车辆行驶）
    generateFollowKeyframes() {
        const carOffset = new THREE.Vector3(-6, 3, 2); // 相对车辆的偏移
        const target = new THREE.Vector3(0, 0, 0);
        const steps = 10;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // 模拟车辆沿道路行驶
            const carPosition = new THREE.Vector3(
                Math.sin(t * Math.PI * 2) * 2, // 左右摆动
                0,
                t * 10 - 5 // 前进
            );

            const cameraPosition = carPosition.clone().add(carOffset);
            const lookTarget = carPosition.clone();

            this.cameraAnimation.keyframes.push({
                position: cameraPosition,
                target: lookTarget,
                time: t
            });
        }
    }

    // 更新运镜动画
    updateCameraAnimation(delta) {
        if (!this.cameraAnimation.isActive || this.cameraAnimation.keyframes.length === 0) {
            return;
        }

        const elapsed = Date.now() - this.cameraAnimation.startTime;
        const progress = Math.min(elapsed / this.cameraAnimation.duration, 1);

        if (progress >= 1) {
            // 动画结束
            this.stopCameraAnimation();
            return;
        }

        // 在关键帧之间插值
        this.interpolateCameraPosition(progress);
    }

    // 在关键帧之间插值相机位置
    interpolateCameraPosition(progress) {
        const keyframes = this.cameraAnimation.keyframes;
        if (keyframes.length < 2) return;

        // 找到当前进度对应的关键帧区间
        let startFrame = 0;
        let endFrame = 1;

        for (let i = 0; i < keyframes.length - 1; i++) {
            if (progress >= keyframes[i].time && progress <= keyframes[i + 1].time) {
                startFrame = i;
                endFrame = i + 1;
                break;
            }
        }

        const start = keyframes[startFrame];
        const end = keyframes[endFrame];

        // 计算在当前区间内的插值进度
        const segmentProgress = (progress - start.time) / (end.time - start.time);
        const smoothProgress = this.easeInOutCubic(segmentProgress);

        // 插值位置和目标
        const position = start.position.clone().lerp(end.position, smoothProgress);
        const target = start.target.clone().lerp(end.target, smoothProgress);

        // 应用到相机
        this.camera.position.copy(position);
        this.camera.lookAt(target);

        // 如果有控制器，也更新控制器的目标
        if (this.controls) {
            this.controls.target.copy(target);
        }
    }

    // 获取运镜状态
    getCameraAnimationStatus() {
        return {
            isActive: this.cameraAnimation.isActive,
            mode: this.cameraAnimation.mode,
            progress: this.cameraAnimation.isActive ?
                Math.min((Date.now() - this.cameraAnimation.startTime) / this.cameraAnimation.duration, 1) : 0,
            keyframeCount: this.cameraAnimation.keyframes.length
        };
    }

    // 设置运镜模式并开始
    setCameraAnimationMode(mode, duration = 10000) {
        if (this.cameraAnimation.isActive) {
            this.stopCameraAnimation();
        }
        setTimeout(() => {
            this.startCameraAnimation(mode, duration);
        }, 100);
    }

    // 强制修复所有材质
    fixAllMaterials() {
        if (!this.car) return;

        console.log('=== 开始强制修复材质 ===');

        this.car.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach((material, index) => {
                    // 强制设置颜色，避免纯白色
                    if (!material.color || material.color.getHex() === 0xffffff) {
                        const meshName = child.name.toLowerCase();

                        if (meshName.includes('body') || meshName.includes('car')) {
                            material.color = new THREE.Color(0x1e40af); // 深蓝色车身
                        } else if (meshName.includes('wheel') || meshName.includes('tire')) {
                            material.color = new THREE.Color(0x111827); // 黑色轮胎
                        } else if (meshName.includes('glass') || meshName.includes('window')) {
                            material.color = new THREE.Color(0x60a5fa); // 浅蓝色玻璃
                            material.transparent = true;
                            material.opacity = 0.4;
                        } else if (meshName.includes('chrome') || meshName.includes('metal')) {
                            material.color = new THREE.Color(0x9ca3af); // 银色金属
                            material.metalness = 0.8;
                            material.roughness = 0.2;
                        } else if (meshName.includes('light')) {
                            material.color = new THREE.Color(0xfbbf24); // 黄色灯光
                            material.emissive = new THREE.Color(0x332200);
                        } else {
                            // 默认颜色
                            material.color = new THREE.Color(0x6b7280); // 中灰色
                        }

                        console.log(`修复材质: ${child.name}[${index}] -> ${material.color.getHexString()}`);
                    }

                    // 确保材质更新
                    material.needsUpdate = true;
                });
            }
        });

        console.log('=== 材质修复完成 ===');
    }

    // 播放指定名称的动画
    playAnimationByName(animationName, reverse = false) {
        if (!this.mixer || !this.allAnimations) {
            console.warn('动画系统未初始化');
            return false;
        }

        const action = this.allAnimations[animationName];
        if (!action) {
            console.warn(`未找到动画: "${animationName}"`);
            console.log('可用动画:', Object.keys(this.allAnimations));
            return false;
        }

        console.log(`播放动画: "${animationName}"${reverse ? ' (倒放)' : ''}`);

        if (reverse) {
            // 倒放动画
            action.reset();
            action.time = action.getClip().duration; // 从结尾开始
            action.timeScale = -1; // 负时间缩放实现倒放
            action.paused = false;
            action.play();
        } else {
            // 正常播放动画
            action.reset();
            action.time = 0;
            action.timeScale = 1; // 正常时间缩放
            action.paused = false;
            action.play();
        }

        return true;
    }

    // 获取所有可用动画名称
    getAvailableAnimations() {
        if (!this.allAnimations) {
            return [];
        }
        return Object.keys(this.allAnimations);
    }

    // 开门/关门切换（单个动画）
    toggleDoor(animationName) {
        if (!this.doorStates) {
            this.doorStates = {};
        }

        // 获取当前门的状态（默认为关闭状态）
        const isOpen = this.doorStates[animationName] || false;

        if (isOpen) {
            // 门是开的，播放关门动画（倒放）
            console.log(`关门: ${animationName}`);
            const success = this.playAnimationByName(animationName, true);
            if (success) {
                this.doorStates[animationName] = false;
            }
            return { action: 'close', success };
        } else {
            // 门是关的，播放开门动画（正放）
            console.log(`开门: ${animationName}`);
            const success = this.playAnimationByName(animationName, false);
            if (success) {
                this.doorStates[animationName] = true;
            }
            return { action: 'open', success };
        }
    }

    // 同时控制多个门的开关
    toggleMultipleDoors(animationNames) {
        if (!this.doorStates) {
            this.doorStates = {};
        }

        // 检查所有门的状态，如果任何一个门是开的，就全部关门；否则全部开门
        const anyDoorOpen = animationNames.some(name => this.doorStates[name] || false);

        const results = [];
        let allSuccess = true;

        if (anyDoorOpen) {
            // 有门是开的，全部关门
            console.log('关闭所有门:', animationNames);
            animationNames.forEach(animationName => {
                const success = this.playAnimationByName(animationName, true);
                if (success) {
                    this.doorStates[animationName] = false;
                }
                results.push({ animation: animationName, success });
                if (!success) allSuccess = false;
            });
            return { action: 'close', success: allSuccess, results };
        } else {
            // 所有门都是关的，全部开门
            console.log('打开所有门:', animationNames);
            animationNames.forEach(animationName => {
                const success = this.playAnimationByName(animationName, false);
                if (success) {
                    this.doorStates[animationName] = true;
                }
                results.push({ animation: animationName, success });
                if (!success) allSuccess = false;
            });
            return { action: 'open', success: allSuccess, results };
        }
    }

    // 获取门的状态
    getDoorState(animationName) {
        if (!this.doorStates) {
            return false;
        }
        return this.doorStates[animationName] || false;
    }
}

// 导出类供全局使用
window.Car3DRenderer = Car3DRenderer;
