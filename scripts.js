document.addEventListener('DOMContentLoaded', () => {
    // === グローバル変数 ===
    const nodesLayer = document.getElementById('nodes-layer');
    const connectionsLayer = document.getElementById('connections-layer');
    const workspaceContainer = document.getElementById('workspace-container');
    const workspaceBg = document.getElementById('workspace-bg');
    
    // 状態管理
    let isDraggingNode = false;
    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };
    
    let isDrawingLine = false;
    let dragStartPort = null;
    let activeDragLine = null; // SVG path element for dragging
    
    // ワークスペース移動用 (無限スクロール座標管理)
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    // scrollLeft/Topではなく、コンテナのTransformまたはレイヤーのオフセットで管理する
    let workspaceOffset = { x: 0, y: 0 };
    let panStartOffset = { x: 0, y: 0 };
    let startTime = Date.now();
    let zoomLevel = 1.0;
    const ZOOM_STEP = 0.1;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2.0;

    // データ管理
    // connection: { fromNodeId, fromPortIndex, toNodeId } 
    // ※ 1つのInputには1つの接続しか入らない前提
    // key: toNodeId, value: { fromNodeId, fromPortIndex }
    const connections = new Map(); 

    // === 保存/復元 ===
    const STORAGE_KEY = 'consent-workspace-v1';
    let saveTimer = null;
    let isRestoring = false;

    function requestSaveWorkspace() {
        if (isRestoring) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveWorkspaceState();
        }, 250);
    }

    function saveWorkspaceState() {
        if (isRestoring) return;
        try {
            const state = {
                version: 1,
                zoomLevel,
                workspaceOffset: { ...workspaceOffset },
                nodes: Array.from(document.querySelectorAll('.node')).map(n => {
                    const x = parseInt(n.style.left || '0', 10);
                    const y = parseInt(n.style.top || '0', 10);
                    const type = n.dataset.type;
                    const name = n.querySelector('.node-name')?.value ?? '';
                    const limit = n.querySelector('.limit-input')?.value ?? null;
                    const usage = n.querySelector('.usage-input')?.value ?? null;
                    const socketCount = n.querySelectorAll('.socket-port').length;

                    return {
                        id: n.id,
                        type,
                        x,
                        y,
                        name,
                        limit,
                        usage,
                        socketCount
                    };
                }),
                connections: Array.from(connections.entries()).map(([toNodeId, conn]) => ({
                    toNodeId,
                    fromNodeId: conn.fromNodeId,
                    fromPortIndex: conn.fromPortIndex
                }))
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            // localStorageが使えない環境/容量不足でも動作は継続
        }
    }

    function setSocketCount(node, desiredCount) {
        const socketsContainer = node.querySelector('.sockets-container');
        const addSocketBtn = node.querySelector('.add-socket-btn');
        if (!socketsContainer || !addSocketBtn) return;

        let sockets = Array.from(node.querySelectorAll('.socket-port'));

        // Remove from end
        while (sockets.length > desiredCount) {
            const last = sockets[sockets.length - 1];
            last.remove();
            sockets.pop();
        }

        // Add to end
        while (sockets.length < desiredCount) {
            const newSocket = document.createElement('div');
            newSocket.className = 'socket-port';
            newSocket.title = '差込口';

            const point = document.createElement('div');
            point.className = 'port-point output-point';
            newSocket.appendChild(point);

            socketsContainer.insertBefore(newSocket, addSocketBtn);
            const index = sockets.length; // next index
            setupOutputPort(newSocket, node, index);
            sockets.push(newSocket);
        }
    }

    function restoreWorkspaceState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;

            const state = JSON.parse(raw);
            if (!state || state.version !== 1) return false;

            isRestoring = true;

            // Clear existing
            nodesLayer.innerHTML = '';
            const dragLine = connectionsLayer.querySelector('.cable-drag');
            connectionsLayer.innerHTML = '';
            if (dragLine) connectionsLayer.appendChild(dragLine);
            connections.clear();

            // Restore pan/zoom first
            zoomLevel = typeof state.zoomLevel === 'number' ? state.zoomLevel : 1.0;
            workspaceOffset = state.workspaceOffset ? { ...state.workspaceOffset } : { x: 0, y: 0 };
            updateWorkspaceTransform();

            // Restore nodes
            if (Array.isArray(state.nodes)) {
                state.nodes.forEach(n => {
                    if (!n || !n.id || !n.type) return;
                    const nodeEl = createNode(n.type, n.x, n.y, n.id);
                    const nameInput = nodeEl.querySelector('.node-name');
                    if (nameInput && typeof n.name === 'string') nameInput.value = n.name;

                    const limitInput = nodeEl.querySelector('.limit-input');
                    if (limitInput && n.limit !== null && n.limit !== undefined) limitInput.value = n.limit;

                    const usageInput = nodeEl.querySelector('.usage-input');
                    if (usageInput && n.usage !== null && n.usage !== undefined) usageInput.value = n.usage;

                    if (typeof n.socketCount === 'number') {
                        setSocketCount(nodeEl, Math.max(0, n.socketCount));
                    }
                });
            }

            // Restore connections
            if (Array.isArray(state.connections)) {
                state.connections.forEach(c => {
                    if (!c) return;
                    if (!document.getElementById(c.toNodeId)) return;
                    if (!document.getElementById(c.fromNodeId)) return;
                    connections.set(c.toNodeId, { fromNodeId: c.fromNodeId, fromPortIndex: parseInt(c.fromPortIndex, 10) || 0 });
                });
            }

            renderAllConnections();
            calculateAllLoads();

            return true;
        } catch (err) {
            return false;
        } finally {
            isRestoring = false;
        }
    }

    // === 初期化 ===
    
    // ツールバーのボタン
    document.getElementById('add-wall-outlet').addEventListener('click', () => createNode('outlet'));
    document.getElementById('add-power-strip').addEventListener('click', () => createNode('strip'));
    document.getElementById('add-device').addEventListener('click', () => createNode('device'));

    // ズームボタン
    document.getElementById('zoom-in').addEventListener('click', () => {
        const rect = workspaceContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const newZoom = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
        updateZoom(newZoom, centerX, centerY);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        const rect = workspaceContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const newZoom = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
        updateZoom(newZoom, centerX, centerY);
    });

    // キャンバス上のイベント (Node Dragging & Line Drawing & Panning)
    workspaceContainer.addEventListener('mousedown', handleWorkspaceMouseDown);
    workspaceContainer.addEventListener('mousemove', handleMouseMove);
    workspaceContainer.addEventListener('mouseup', handleMouseUp);
    workspaceContainer.addEventListener('mouseleave', handleMouseUp); // 画面外に出たときも終了
    
    // Ctrl + ホイールでのズーム
    workspaceContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const rect = workspaceContainer.getBoundingClientRect();
            // 上回転（deltaY < 0）で拡大、下回転（deltaY > 0）で縮小
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            const newZoom = Math.min(Math.max(zoomLevel + delta, MIN_ZOOM), MAX_ZOOM);
            
            // マウス位置を中心にズーム
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            updateZoom(newZoom, mouseX, mouseY);
        }
    }, { passive: false });

    window.addEventListener('beforeunload', () => {
        saveWorkspaceState();
    });

    // ノード削除ボタン（重なり・伝播順の影響を受けにくいように document キャプチャで処理）
    document.addEventListener('pointerdown', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            e.preventDefault();
            const node = deleteBtn.closest('.node');
            if (node) {
                deleteNode(node.id);
            }
        }
    }, true);
    
    // 保存データがあれば復元、なければ初期ノードを配置
    const restored = restoreWorkspaceState();
    if (!restored) {
        setTimeout(() => {
            const rect = workspaceContainer.getBoundingClientRect();
            createNode('outlet', rect.width / 2 - 40, rect.height / 2 - 40);
        }, 100);
    }

    // === ノード作成 ===
    function createNode(type, x, y, nodeId) {
        const template = document.getElementById(`tpl-${type === 'outlet' ? 'wall-outlet' : type === 'strip' ? 'power-strip' : 'device'}`);
        const clone = template.content.cloneNode(true);
        const nodeEl = clone.querySelector('.node');
        
        // ID生成（復元時は保持）
        nodeEl.id = nodeId || ('node-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
        
        // 初期位置
        if (x === undefined || y === undefined) {
             const rect = workspaceContainer.getBoundingClientRect();
             // 中心座標 (workspaceOffsetを考慮して論理座標での中心を計算)
             const centerX = (rect.width / 2) - workspaceOffset.x;
             const centerY = (rect.height / 2) - workspaceOffset.y;
             
             // 基本位置
             x = Math.round((centerX - 80) / 20) * 20;
             y = Math.round((centerY - 50) / 20) * 20;
             
             // 既存のノードと重ならないように位置を調整
             const existingNodes = document.querySelectorAll('.node');
             let collision = true;
             let attempts = 0;
             
             while (collision && attempts < 100) {
                 collision = false;
                 for (const node of existingNodes) {
                     const nx = parseInt(node.style.left);
                     const ny = parseInt(node.style.top);
                     // 完全に一致する場合のみずらす（あるいは非常に近い場合）
                     if (Math.abs(nx - x) < 30 && Math.abs(ny - y) < 30) {
                         collision = true;
                         break;
                     }
                 }
                 
                 if (collision) {
                     x += 20;
                     y += 20;
                     attempts++;
                 }
             }
        }
        nodeEl.style.left = x + 'px';
        nodeEl.style.top = y + 'px';

        setupNodeEvents(nodeEl);
        nodesLayer.appendChild(nodeEl);
        
        // 初期負荷表示
        updateLoadDisplay(nodeEl, 0);

        requestSaveWorkspace();

        return nodeEl;
    }

    function setupNodeEvents(node) {
        // ノードドラッグ開始
        node.addEventListener('mousedown', (e) => {
            // ポートやボタンをクリックした場合はドラッグしない
            if (e.target.closest('.socket-port') || e.target.closest('.plug-port') || e.target.closest('button') || e.target.closest('input')) return;
            
            e.stopPropagation(); // ワークスペースへの伝播を止める
            isDraggingNode = true;
            draggedNode = node;

            // クラスターを最前面へ
            bringClusterToFront(node.id);
            
            const rect = workspaceContainer.getBoundingClientRect();
            // ズームの影響を排除する（論理座標系に戻す）
            const logicalMouseX = (e.clientX - rect.left) / zoomLevel - workspaceOffset.x;
            const logicalMouseY = (e.clientY - rect.top) / zoomLevel - workspaceOffset.y;
            
            dragOffset.x = logicalMouseX - parseInt(node.style.left || 0);
            dragOffset.y = logicalMouseY - parseInt(node.style.top || 0);
            
            node.classList.add('dragging');
        });

        const nameInput = node.querySelector('.node-name');
        if (nameInput) {
            nameInput.addEventListener('click', (e) => e.stopPropagation());
            nameInput.addEventListener('mousedown', (e) => e.stopPropagation());
            nameInput.addEventListener('input', () => requestSaveWorkspace());
        }

        // 差込口追加ボタン
        const addSocketBtn = node.querySelector('.add-socket-btn');
        if (addSocketBtn) {
            addSocketBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const socketsContainer = node.querySelector('.sockets-container');
                
                // 新しい差込口を作成
                const newSocket = document.createElement('div');
                newSocket.className = 'socket-port';
                newSocket.title = '差込口';
                
                const point = document.createElement('div');
                point.className = 'port-point output-point';
                newSocket.appendChild(point);
                
                // ボタンの手前に追加
                socketsContainer.insertBefore(newSocket, addSocketBtn);
                
                // イベント設定
                const index = node.querySelectorAll('.socket-port').length - 1;
                setupOutputPort(newSocket, node, index);

                // ポート追加によりレイアウトが変わるため線を再描画
                renderAllConnections();

                requestSaveWorkspace();
            });
            addSocketBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        }

        // 入力フィールドのイベント監視
        const inputs = node.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            
            // 値が変わったら再計算
            if (input.classList.contains('usage-input') || input.classList.contains('limit-input')) {
                input.addEventListener('input', () => {
                    calculateAllLoads();
                    requestSaveWorkspace();
                });
            }
        });

        // ポートの設定
        node.querySelectorAll('.socket-port').forEach((port, index) => {
            setupOutputPort(port, node, index);
        });
        
        const plugPort = node.querySelector('.plug-port');
        if (plugPort) {
            setupInputPort(plugPort, node);
        }
    }

    function setupOutputPort(portEl, node, index) {
        portEl.dataset.portType = 'output';
        portEl.dataset.nodeId = node.id;
        portEl.dataset.portIndex = index;
        
        // 出力ポートクリック時の処理
        portEl.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startCableDrag(node.id, index, 'output', e.clientX, e.clientY);
        });
    }

    function setupInputPort(portEl, node) {
        portEl.dataset.portType = 'input';
        portEl.dataset.nodeId = node.id;
        
        // 入力ポートクリック時の処理
        portEl.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            // 既にこの入力ポートに接続がある場合
            if (connections.has(node.id)) {
                removeConnection(node.id);
                return;
            }

            // 未接続なら、ここをStartとしてドラッグ開始 (Input -> Output への線引き)
            startCableDrag(node.id, 0, 'input', e.clientX, e.clientY);
        });
    }

    // === ズーム ===
    function updateZoom(newZoom, centerX, centerY) {
        const oldZoom = zoomLevel;
        zoomLevel = parseFloat(newZoom.toFixed(2)); // 浮動小数点の誤差対策

        // 中心座標が指定されていない場合は画面中心を使用
        if (centerX === undefined || centerY === undefined) {
             const rect = workspaceContainer.getBoundingClientRect();
             centerX = rect.width / 2;
             centerY = rect.height / 2;
        }

        // ズーム中心の論理座標を計算（変更前のズームレベルで）
        // Screen = (Logical + Offset) * Zoom
        // Logical = Screen / Zoom - Offset
        const logicalX = centerX / oldZoom - workspaceOffset.x;
        const logicalY = centerY / oldZoom - workspaceOffset.y;

        // 新しいズームレベルでのOffsetを逆算
        // Screen = (Logical + NewOffset) * NewZoom
        // Screen / NewZoom = Logical + NewOffset
        // NewOffset = Screen / NewZoom - Logical
        workspaceOffset.x = centerX / zoomLevel - logicalX;
        workspaceOffset.y = centerY / zoomLevel - logicalY;

        updateWorkspaceTransform();

        requestSaveWorkspace();
    }

    // === ワークスペース操作 ===
    function handleWorkspaceMouseDown(e) {
        // ノードやポート上でのクリックなら無視
        if (e.target.closest('.node') || e.target.closest('.socket-port') || e.target.closest('.plug-port') || e.target.closest('.delete-btn')) {
            return;
        }
        
        // ケーブル上のクリックも無視（切断用イベントがあるため）
        if (e.target.closest('.cable')) {
            return;
        }

        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        panStartOffset = { x: workspaceOffset.x, y: workspaceOffset.y };
        workspaceContainer.style.cursor = 'grabbing';
    }


    // === ケーブルドラッグ & 描画 ===

    function startCableDrag(nodeId, portIndex, type, startX, startY) {
        isDrawingLine = true;
        dragStartPort = { nodeId, portIndex, type };
        
        // ダミーのSVGラインを作成
        activeDragLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        activeDragLine.setAttribute('class', 'cable cable-drag');
        connectionsLayer.appendChild(activeDragLine);
        
        // 始点の座標計算
        const startPoint = getPortCenter(nodeId, type, portIndex);
        // 初期描画: startTypeを渡す
        updatePath(activeDragLine, startPoint.x, startPoint.y, startPoint.x, startPoint.y, type); 
    }

    function handleMouseMove(e) {
        const rect = workspaceContainer.getBoundingClientRect();

        // ワークスペースのパン中
        if (isPanning) {
            const dx = (e.clientX - panStart.x) / zoomLevel;
            const dy = (e.clientY - panStart.y) / zoomLevel;
            
            workspaceOffset.x = panStartOffset.x + dx;
            workspaceOffset.y = panStartOffset.y + dy;
            
            updateWorkspaceTransform();
            return;
        }

        // --- 座標変換 ---
        // マウス座標(client) -> ワークスペース論理座標(logical)
        const logicalMouseX = (e.clientX - rect.left) / zoomLevel - workspaceOffset.x;
        const logicalMouseY = (e.clientY - rect.top) / zoomLevel - workspaceOffset.y;

        // ノードドラッグ中
        if (isDraggingNode && draggedNode) {
            // ノードの左上座標 = 論理マウス座標 - ドラッグ開始時のオフセット
            let rawX = logicalMouseX - dragOffset.x;
            let rawY = logicalMouseY - dragOffset.y;
            
            // グリッドスナップ (20px単位)
            const gridSize = 20;
            const snappedX = Math.round(rawX / gridSize) * gridSize;
            const snappedY = Math.round(rawY / gridSize) * gridSize;

            draggedNode.style.left = snappedX + 'px'; 
            draggedNode.style.top = snappedY + 'px';

            updateConnectionsLines(); // 接続線を追従させる
            return;
        }

        // ケーブルドラッグ中
        if (isDrawingLine && activeDragLine && dragStartPort) {
            const startPoint = getPortCenter(dragStartPort.nodeId, dragStartPort.type, dragStartPort.portIndex);
            // dragStartPort.type が 'output' なら、始点は Output。 'input' なら始点は Input。
            // これを updatePath に伝えて、制御点の向きを固定する。
            updatePath(activeDragLine, startPoint.x, startPoint.y, logicalMouseX, logicalMouseY, dragStartPort.type);
        }
    }
    
    function updateWorkspaceTransform() {
        // スケーリングと移動を同時に適用
        // スケール原点を画面中心に見せかけるには、Offsetの計算を複雑にする必要があるが、
        // 今回はシンプルに 左上原点 + Offset移動 にする。
        // ただし、拡大縮小の中心を固定するためには、Offset自体を調整する必要があるかもしれないが、
        // UIが「＋」「－」ボタンのみなので、単純なスケール変更とする。
        // transformの適用順序: translate -> scale だと、移動してから拡大（移動量も拡大される）。
        // scale -> translate だと、拡大してから移動（移動量は画面ピクセル）。
        // ここでは、論理座標(workspaceOffset)を画面座標に変換したい。
        // 画面上の点 P_screen = (P_logical + workspaceOffset) * zoom
        // よって、 transform: scale(zoom) translate(workspaceOffset.x, workspaceOffset.y) としたいが、
        // CSS transformは右から適用される (matrixの掛け算順序)。
        // または、 transform-origin: 0 0 であれば、
        // translate( X_screen, Y_screen ) scale( zoom ) 
        // X_screen = workspaceOffset.x * zoom
        
        // シンプルに実装するため、ノードレイヤーの親にスケールをかけるか、
        // あるいは個別に計算するかだが、
        // ここでは transform-origin: 0 0 前提で：
        // "scale(zoom) translate(offset.x, offset.y)" だと、translateもzoom倍されてしまう？
        // 実際にCSSで書くと: transform: scale(2) translate(100px, 100px);
        // -> scale(2) が外側、translate(100px) が内側。
        // 座標変換: x' = 2 * (x + 100) = 2x + 200。
        // これは「論理座標を100ずらして、全体を2倍」にする。
        // workspaceOffset は「論理座標系の原点がどこにあるか」を示すものと定義している(panStartOffset + dx)。
        // よって、この式で正しい。
        
        const transform = `scale(${zoomLevel}) translate(${workspaceOffset.x}px, ${workspaceOffset.y}px)`;
        
        nodesLayer.style.transform = transform;
        connectionsLayer.style.transform = transform;
        
        if(workspaceBg) {
             // 背景も同様に
             workspaceBg.style.transform = transform;
        }
    }

    function handleMouseUp(e) {
        // パン終了
        if (isPanning) {
            isPanning = false;
            workspaceContainer.style.cursor = ''; 
            requestSaveWorkspace();
            return;
        }
        
        // ノードドラッグ終了
        if (isDraggingNode) {
            isDraggingNode = false;
            if (draggedNode) draggedNode.classList.remove('dragging');
            draggedNode = null;
            requestSaveWorkspace();
            return;
        }

        // ケーブルドラッグ終了
        if (isDrawingLine) {
            // ドロップ先の要素を特定
            // ポート上でドロップされたか？ (SVGレイヤーが手前にあるため、elementFromPointは使いにくい)
            // イベントバブリングではなく、e.targetを直接見る
            // しかしマウスアップイベントは document/workspaceContainer で拾っているため、
            // e.target は最後にマウスがあった要素になる。
            // clickイベントと異なり、SVGのpathが邪魔をしている可能性がある。
            // ここでは簡易的に、マウス位置にある要素を手動で探すこともできるが、
            // CSSで .cable { pointer-events: stroke; } にしているので、
            // 空白部分は抜けて下のポートに当たるはず。
            // ただし、ドラッグ中の activeDragLine がマウス直下にあるので、これが邪魔をする。
            
            // 一時的にドラッグラインを非表示にして判定
            activeDragLine.style.display = 'none';
            
            // 下にある要素を取得
            const elBelow = document.elementFromPoint(e.clientX, e.clientY);
            // ※ここで activeDragLine.style.display = '' に戻す必要はない。
            // どうせこの後すぐ削除するか、リセットするため。
            // 逆に戻してしまうと、削除漏れがあった場合に画面に残ってしまう。
            
            let targetPort = null;
            if (elBelow) {
                targetPort = elBelow.closest('.socket-port') || elBelow.closest('.plug-port');
            }
            
            if (targetPort && validateConnection(dragStartPort, targetPort)) {
                // 接続を確立
                createConnection(dragStartPort, targetPort);
            }
            
            // ドラッグ用ライン処理の終了
            // 接続できたかに関わらず、必ず最後に削除する
            // 確実に削除する
            if (activeDragLine) {
                activeDragLine.remove();
            }
            activeDragLine = null;
            isDrawingLine = false;
            dragStartPort = null;
        }
    }

    // === 座標計算 ===
    function getPortCenter(nodeId, type, index) {
        const node = document.getElementById(nodeId);
        if (!node) return { x: 0, y: 0 };

        let portEl;
        if (type === 'input') {
            portEl = node.querySelector('.plug-port');
        } else {
            const sockets = node.querySelectorAll('.socket-port');
            portEl = sockets[index];
        }

        if (!portEl) return { x: 0, y: 0 };

        const portRect = portEl.getBoundingClientRect();
        const containerRect = workspaceContainer.getBoundingClientRect();

        // 論理座標(レイヤー上の座標)に変換する
        // portRect.left は画面上の絶対位置(Zoom適用後)
        // containerRect.left はコンテナの画面上の位置
        // コンテナ内の相対位置 = portRect.left - containerRect.left
        // 論理座標 = (相対位置 / Zoom) - workspaceOffset.x
        
        return {
            x: (portRect.left + portRect.width / 2 - containerRect.left) / zoomLevel - workspaceOffset.x,
            y: (portRect.top + portRect.height / 2 - containerRect.top) / zoomLevel - workspaceOffset.y
        };
    }

    function updatePath(pathEl, x1, y1, x2, y2, startNodePortType = 'output') {
        // startNodePortType: 始点(x1,y1)が 'output' ポートか 'input' ポートか。
        // デフォルトは 'output' (renderAllConnectionsからは常にOutput->Inputで呼ばれるため)
        
        let cp1x, cp1y, cp2x, cp2y;
        
        // ベクトル計算用
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // ハンドルの基本長
        let handleLen = Math.min(dist * 0.5, 150);
        // 近すぎる場合や真下に近い場合はハンドルを少し長くして見栄えを良くする
        if (Math.abs(dy) < 50 || Math.abs(dx) < 50) {
           handleLen = Math.max(handleLen, 80);
        }
        
        if (startNodePortType === 'output') {
            // Case A: Start(x1, y1) is Output -> End(x2, y2) is Input
            cp1x = x1;
            cp1y = y1 + handleLen; // 下へ
            
            cp2x = x2;
            cp2y = y2 - handleLen; // 上へ
            
        } else {
            // Case B: Start(x1, y1) is Input -> End(x2, y2) is Output
            cp1x = x1;
            cp1y = y1 - handleLen; // 上へ
            
            cp2x = x2;
            cp2y = y2 + handleLen; // 下へ
        }

        const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
        pathEl.setAttribute('d', d);
    }

    // === 接続管理 ===
    function validateConnection(startObj, targetEl) {
        const targetType = targetEl.dataset.portType;
        const targetNodeId = targetEl.dataset.nodeId;
        const targetOutputIndex = parseInt(targetEl.dataset.portIndex || 0);
        
        // 1. 同じノード同士は不可
        if (startObj.nodeId === targetNodeId) return false;
        
        // 2. Input同士、Output同士は不可
        if ((startObj.type === 'input' && targetType === 'input') ||
            (startObj.type === 'output' && targetType === 'output')) {
                return false;
        }
        
        // 3. 一つのOutputから複数のInputへの接続は不可
        let outputNodeId, outputPortIndex;

        if (startObj.type === 'output') {
            outputNodeId = startObj.nodeId;
            outputPortIndex = parseInt(startObj.portIndex);
        } else {
            // targetEl is output
            outputNodeId = targetNodeId;
            outputPortIndex = targetOutputIndex;
        }

        // Outputが既に使用されているかチェック
        // ただし、もし「既存の接続を上書きしたい（つなぎ変え）」という場合はロジックが変わるが、
        // 現実のコンセントは「空いてないと刺せない」ので、使用中ならNGにする
        for (const conn of connections.values()) {
            if (conn.fromNodeId === outputNodeId && parseInt(conn.fromPortIndex) === outputPortIndex) {
                 // return false; // ここで弾くとドラッグ終了時に何も起きないだけ。UX的には「接続できません」と出すか、単に繋がらないか。
                 // 今回は「繋がらない」とする
                 return false;
            }
        }
        
        return true;
    }

    function createConnection(startPortObj, targetPortEl) {
        if (!validateConnection(startPortObj, targetPortEl)) {
            // alert('接続できません'); // うるさいのでなしで
            return;
        }

        const targetType = targetPortEl.dataset.portType;
        const targetNodeId = targetPortEl.dataset.nodeId;
        const targetIndex = targetPortEl.dataset.portIndex || 0;

        let fromNodeId, fromPortIndex, toNodeId;

        // すべて Output -> Input の向きで保存する
        if (startPortObj.type === 'output') {
            fromNodeId = startPortObj.nodeId;
            fromPortIndex = startPortObj.portIndex;
            toNodeId = targetNodeId;
        } else {
            fromNodeId = targetNodeId;
            fromPortIndex = targetIndex;
            toNodeId = startPortObj.nodeId;
        }

        if (connections.has(toNodeId)) {
            removeConnection(toNodeId);
        }

        connections.set(toNodeId, { fromNodeId, fromPortIndex: parseInt(fromPortIndex) });

        renderAllConnections();
        calculateAllLoads();
        requestSaveWorkspace();
    }

    function removeConnection(toNodeId) {
        connections.delete(toNodeId);
        renderAllConnections();
        calculateAllLoads();
        requestSaveWorkspace();
    }

    function deleteNode(nodeId) {
        const node = document.getElementById(nodeId);
        if (node) node.remove();

        // このノードに入ってくる接続を削除
        connections.delete(nodeId);
        
        // このノードから出ている接続を削除
        for (const [toId, conn] of connections.entries()) {
            if (conn.fromNodeId === nodeId) {
                connections.delete(toId);
            }
        }

        renderAllConnections();
        calculateAllLoads();
        requestSaveWorkspace();
    }
    
    // UIとしてクリアボタンがないため、機能としても削除。必要なら再実装。
    // function clearAll() { ... }

    function renderAllConnections() {
        // ドラッグ中の線以外を削除
        const lines = connectionsLayer.querySelectorAll('.cable:not(.cable-drag)');
        lines.forEach(l => l.remove());
        
        connections.forEach((conn, toNodeId) => {
            const start = getPortCenter(conn.fromNodeId, 'output', conn.fromPortIndex);
            const end = getPortCenter(toNodeId, 'input', 0);
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'cable');
            updatePath(path, start.x, start.y, end.x, end.y);
            
            // ポインターイベント設定（クリックして削除）
            path.style.cursor = 'pointer';
            path.addEventListener('click', (e) => {
                e.stopPropagation(); // パンしないように
                removeConnection(toNodeId);
            });
             
            connectionsLayer.appendChild(path);
        });
    }
    
    function updateConnectionsLines() {
        renderAllConnections();
    }

    // === 計算ロジック ===
    function calculateAllLoads() {
        document.querySelectorAll('.node').forEach(n => n.classList.remove('warning', 'overloaded'));
        // すべてのノードの表示をリセット
        document.querySelectorAll('.current-load').forEach(d => d.textContent = '0');
        
        // ルート（壁コンセント）を探す
        const rootNodes = document.querySelectorAll('.node[data-type="outlet"]');

        rootNodes.forEach(root => {
            calcNodeLoad(root.id);
        });
    }
    
    function updateLoadDisplay(node, val) {
        if (!node) return;
        const display = node.querySelector('.current-load');
        if (display) display.textContent = val;
    }
    
    function calcNodeLoad(nodeId) { 
        const node = document.getElementById(nodeId);
        if (!node) return 0;
        
        let totalLoad = 0;
        
        // 自身の負荷 (デバイスの場合)
        // input.usage-input があればその値を使う
        const loadInput = node.querySelector('.usage-input');
        if (loadInput) {
            totalLoad = parseInt(loadInput.value) || 0;
        }
        
        // 子要素（connectionsMapにおいて、fromNodeId == nodeId であるもの）
        const children = [];
        connections.forEach((conn, toId) => {
            if (conn.fromNodeId === nodeId) {
                children.push(toId);
            }
        });
        
        // 子の負荷を加算
        children.forEach(childId => {
            totalLoad += calcNodeLoad(childId);
        });
        
        updateLoadDisplay(node, totalLoad);
        
        // 警告判定 (許容値を超えている場合)
        const limitInput = node.querySelector('.limit-input');
        if (limitInput) {
            const limit = parseInt(limitInput.value) || 1500;
            if (totalLoad > limit) {
                node.classList.add('overloaded');
            } else if (totalLoad > limit * 0.8) {
                node.classList.add('warning');
            }
        }
        
        return totalLoad;
    }

    function bringClusterToFront(startNodeId) {
        // 全接続情報の逆引きマップ(親->子)を作成 (毎回作成しても要素数が少ないのでOK)
        const parentToChildren = new Map();
        for (const [child, parentInfo] of connections.entries()) {
            if (!parentToChildren.has(parentInfo.fromNodeId)) {
                parentToChildren.set(parentInfo.fromNodeId, []);
            }
            parentToChildren.get(parentInfo.fromNodeId).push(child);
        }

        // 探索用キューと訪問済みセット
        const queue = [startNodeId];
        const visited = new Set([startNodeId]);

        while (queue.length > 0) {
            const currentId = queue.shift();

            // 1. 親方向 (currentId が誰かの子である場合)
            if (connections.has(currentId)) {
                const parentId = connections.get(currentId).fromNodeId;
                if (!visited.has(parentId)) {
                    visited.add(parentId);
                    queue.push(parentId);
                }
            }

            // 2. 子方向 (currentId が親である場合)
            if (parentToChildren.has(currentId)) {
                for (const childId of parentToChildren.get(currentId)) {
                    if (!visited.has(childId)) {
                        visited.add(childId);
                        queue.push(childId);
                    }
                }
            }
        }
        
        // DOMの並び順を変更（末尾に追加することで最前面へ）
        visited.forEach(nodeId => {
            const node = document.getElementById(nodeId);
            if (node && node.parentElement === nodesLayer) {
                nodesLayer.appendChild(node);
            }
        });

        // 3. 接続情報マップ(connections)の並び順を変更 (Mapは挿入順を保持するため、delete -> set で末尾に移動)
        // visited に含まれるノードに入ってくる線、またはそこから出る線を最後に移動する
        const keysToMove = [];
        
        connections.forEach((conn, toNodeId) => {
            // toNodeId が visited に含まれる = 入ってくる線
            // conn.fromNodeId が visited に含まれる = 出ていく線
            if (visited.has(toNodeId) || visited.has(conn.fromNodeId)) {
                keysToMove.push(toNodeId);
            }
        });

        keysToMove.forEach(key => {
            const val = connections.get(key);
            connections.delete(key);
            connections.set(key, val);
        });

        // 4. 線を再描画して現在のDOMに反映
        renderAllConnections();
    }

});
