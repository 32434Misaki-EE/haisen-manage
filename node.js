// ===== ノード管理（作成・削除・イベント） =====

function calculateMinNodeWidth(socketCount, plugCount = 0) {
    // ソケット数とプラグ数の多い方を基準に計算
    const maxPortCount = Math.max(socketCount, plugCount);
    return (maxPortCount * 100) + ((maxPortCount > 0 ? maxPortCount - 1 : 0) * 8) + 58 + 50;
}

function updateNodeSocketsGap(node, newWidth, socketPortsCache) {
    const socketsContainer = node.querySelector('.sockets-container');
    if (!socketsContainer) return;

    // キャッシュされたDOM要素を使用、なければ取得
    const socketPorts = socketPortsCache || socketsContainer.querySelectorAll('.socket-port');
    
    // ポート数に応じた必要な最小幅を計算
    const socketCount = socketPorts.length;
    const requiredWidth = calculateMinNodeWidth(socketCount);
    
    // 現在の幅が必要幅より小さい場合は自動的に広げる
    const actualWidth = Math.max(newWidth, requiredWidth);
    if (actualWidth > newWidth) {
        node.style.width = actualWidth + 'px';
        newWidth = actualWidth;
    }
    
    if (socketCount <= 1) {
        socketsContainer.style.gap = '8px';
        return;
    }

    // 各socket-portのoffsetWidthを計算
    let totalPortWidth = 0;
    socketPorts.forEach(port => {
        totalPortWidth += port.offsetWidth;
    });

    // パディング（左右各10px）と+ボタン右からの距離（10px）と+ボタン幅（30px）を考慮
    const padding = 20;
    const buttonSpace = 50; // +ボタン右端から10px + ボタン幅30px
    const availableWidth = newWidth - padding - buttonSpace;
    const usedWidth = totalPortWidth;
    const totalGapWidth = Math.max(0, availableWidth - usedWidth);
    const gapCount = socketCount - 1;
    const gapSize = gapCount > 0 ? Math.max(1, Math.floor(totalGapWidth / gapCount)) : 8;

    socketsContainer.style.gap = gapSize + 'px';
}

function setSocketCount(node, desiredCount) {
    const socketsContainer = node.querySelector('.sockets-container');
    const addSocketBtn = node.querySelector('.add-socket-btn');
    if (!socketsContainer || !addSocketBtn) return;

    let sockets = Array.from(node.querySelectorAll('.socket-port'));

    // 削除
    while (sockets.length > desiredCount) {
        const last = sockets[sockets.length - 1];
        last.remove();
        sockets.pop();
    }

    // 追加
    while (sockets.length < desiredCount) {
        const newSocket = document.createElement('div');
        newSocket.className = 'socket-port';

        const label = document.createElement('input');
        label.type = 'text';
        label.className = 'port-label';
        label.placeholder = 'メモ';
        newSocket.appendChild(label);

        const selector = document.createElement('div');
        selector.className = 'port-type-selector';
        const typeLabel = document.createElement('span');
        typeLabel.className = 'port-type-label';
        typeLabel.textContent = '-';
        const arrow = document.createElement('span');
        arrow.className = 'port-type-arrow';
        arrow.textContent = '▼';
        selector.appendChild(typeLabel);
        selector.appendChild(arrow);
        newSocket.appendChild(selector);

        const pointContainer = document.createElement('div');
        pointContainer.style.display = 'flex';
        pointContainer.style.alignItems = 'center';
        pointContainer.style.gap = '2px';
        
        const point = document.createElement('div');
        point.className = 'port-point output-point';
        pointContainer.appendChild(point);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-socket-btn';
        removeBtn.title = '削除';
        removeBtn.textContent = '✕';
        pointContainer.appendChild(removeBtn);
        
        newSocket.appendChild(pointContainer);

        const dropdown = document.createElement('div');
        dropdown.className = 'port-type-dropdown';
        newSocket.appendChild(dropdown);

        socketsContainer.insertBefore(newSocket, addSocketBtn);
        const index = sockets.length;
        setupOutputPort(newSocket, node, index);
        
        if (Object.keys(portTypeData).length > 0) {
            initPortTypeDropdown(newSocket, node, index);
        }
        
        sockets.push(newSocket);
    }
    
    // キャッシュされたsocketsと現在のplugPortsを使用して調整
    const plugPorts = node.querySelectorAll('.plug-port');
    adjustNodeWidth(node, sockets, plugPorts);
    updateNodeSocketsGap(node, node.offsetWidth, sockets);
    updatePlugSocketsGap(node, plugPorts);
    
    // ソケット数が1つの場合は中央配置
    if (sockets.length === 1) {
        socketsContainer.classList.add('single-socket');
    } else {
        socketsContainer.classList.remove('single-socket');
    }
}

function adjustNodeWidth(node, socketPortsCache, plugPortsCache) {
    // キャッシュされたDOM要素を使用、なければ取得
    const socketPorts = socketPortsCache || node.querySelectorAll('.socket-port');
    const plugPorts = plugPortsCache || node.querySelectorAll('.plug-port');
    const socketCount = socketPorts.length;
    const plugCount = plugPorts.length;
    const newWidth = calculateMinNodeWidth(socketCount, plugCount);
    node.style.width = newWidth + 'px';
    updateNodeSocketsGap(node, newWidth, socketPorts);
}

function updatePlugSocketsGap(node, plugPortsCache) {
    const plugContainer = node.querySelector('.plug-container');
    if (!plugContainer) return;
    
    // キャッシュされたDOM要素を使用、なければ取得
    const plugPorts = plugPortsCache || node.querySelectorAll('.plug-port');
    const plugCount = plugPorts.length;
    if (plugCount === 0) return;

    const containerWidth = parseInt(node.style.width || '160', 10);
    const addPlugBtn = node.querySelector('.add-plug-btn');
    const buttonSpace = 50;
    const padding = 20;
    const availableWidth = containerWidth - padding - buttonSpace;
    
    let totalPlugWidth = 0;
    plugPorts.forEach(plug => {
        totalPlugWidth += plug.offsetWidth || 100;
    });

    const totalGapWidth = Math.max(0, availableWidth - totalPlugWidth);
    const gapCount = plugCount - 1;
    const gapSize = gapCount > 0 ? Math.max(1, Math.floor(totalGapWidth / gapCount)) : 8;

    plugContainer.style.gap = gapSize + 'px';
}

function setPlugCount(node, desiredCount) {
    const plugContainer = node.querySelector('.plug-container');
    const addPlugBtn = node.querySelector('.add-plug-btn');
    if (!plugContainer || !addPlugBtn) return;

    let plugs = Array.from(node.querySelectorAll('.plug-port'));
    const originalLength = plugs.length;

    // 削除
    while (plugs.length > desiredCount) {
        const last = plugs[plugs.length - 1];
        last.remove();
        plugs.pop();
    }

    // 追加
    while (plugs.length < desiredCount) {
        const newPlug = document.createElement('div');
        newPlug.className = 'plug-port';

        const pointContainer = document.createElement('div');
        pointContainer.style.display = 'flex';
        pointContainer.style.alignItems = 'center';
        pointContainer.style.gap = '2px';

        const point = document.createElement('div');
        point.className = 'port-point input-point';
        pointContainer.appendChild(point);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-plug-btn';
        removeBtn.title = '削除';
        removeBtn.textContent = '✕';
        pointContainer.appendChild(removeBtn);

        newPlug.appendChild(pointContainer);

        const label = document.createElement('input');
        label.type = 'text';
        label.className = 'port-label';
        label.placeholder = 'メモ';
        newPlug.appendChild(label);
        plugContainer.insertBefore(newPlug, addPlugBtn);
        plugs.push(newPlug);
    }
    
    // すべてのプラグに対してインデックスを設定（plugsは現在の状態を反映）
    plugs.forEach((plug, idx) => {
        plug.dataset.plugIndex = idx;
    });
    
    // 新しく追加されたプラグに対して setupInputPort を呼び出す
    for (let i = originalLength; i < plugs.length; i++) {
        setupInputPort(plugs[i], node);
    }
    
    // 既存のプラグの削除ボタンのリスナーを更新
    for (let i = 0; i < originalLength && i < plugs.length; i++) {
        const plug = plugs[i];
        const oldRemoveBtn = plug.querySelector('.remove-plug-btn');
        if (oldRemoveBtn) {
            const newRemoveBtn = oldRemoveBtn.cloneNode(true);
            oldRemoveBtn.parentNode.replaceChild(newRemoveBtn, oldRemoveBtn);
            
            // 新しい削除ボタンにリスナーを設定
            newRemoveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const plugElement = e.currentTarget.closest('.plug-port');
                const plugIndex = parseInt(plugElement.dataset.plugIndex, 10);

                // プラグが1つだけの場合は削除を無効化
                const plugCount = node.querySelectorAll('.plug-port').length;
                if (plugCount <= 1) {
                    return;
                }

                // このプラグに接続しているすべてのケーブルを削除
                for (let i = connections.length - 1; i >= 0; i--) {
                    const conn = connections[i];
                    if (conn.toNodeId === node.id && conn.toPlugIndex === plugIndex) {
                        connections.splice(i, 1);
                    }
                }

                // このプラグを削除
                plugElement.remove();

                // 後続のプラグのインデックスを更新
                reindexPlugPorts(node);

                // 後続の接続インデックスを更新
                connections.forEach(conn => {
                    if (conn.toNodeId === node.id && conn.toPlugIndex > plugIndex) {
                        conn.toPlugIndex--;
                    }
                });

                // ノード幅を調整
                adjustNodeWidth(node);
                // 上部ポートのギャップを再計算
                updatePlugSocketsGap(node);
                
                // プラグ数が1つになった場合、中央配置に変更
                const plugContainer = node.querySelector('.plug-container');
                const remainingPlugCount = node.querySelectorAll('.plug-port').length;
                if (plugContainer) {
                    if (remainingPlugCount === 1) {
                        plugContainer.classList.add('single-plug');
                    } else {
                        plugContainer.classList.remove('single-plug');
                    }
                }
                
                // ケーブルを再描画
                renderAllConnections();
                // 保存
                requestSaveWorkspace();
            });
        }
    }
    
    // キャッシュされたplugPortsを使用して調整
    const socketPorts = node.querySelectorAll('.socket-port');
    const plugPorts = node.querySelectorAll('.plug-port');
    adjustNodeWidth(node, socketPorts, plugPorts);
    updatePlugSocketsGap(node, plugPorts);
    
    // プラグ数が1つの場合は中央配置
    if (plugPorts.length === 1) {
        plugContainer.classList.add('single-plug');
    } else {
        plugContainer.classList.remove('single-plug');
    }
}

function createNode(type, x, y, nodeId) {
    const templateMap = { 'outlet': 'wall-outlet', 'strip': 'power-strip', 'device': 'device' };
    const template = document.getElementById(`tpl-${templateMap[type] || 'device'}`);
    const clone = template.content.cloneNode(true);
    const nodeEl = clone.querySelector('.node');
    
    nodeEl.id = nodeId || ('node-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
    
    // 初期位置決定
    if (x === undefined || y === undefined) {
         const rect = workspaceContainer.getBoundingClientRect();
         const centerX = (rect.width / 2) - workspaceOffset.x;
         const centerY = (rect.height / 2) - workspaceOffset.y;
         x = Math.round((centerX - 80) / 20) * 20;
         y = Math.round((centerY - 50) / 20) * 20;
         
         // 衝突回避（既存ノード位置をキャッシュ）
         const existingNodes = Array.from(document.querySelectorAll('.node')).map(n => ({
             x: parseInt(n.style.left),
             y: parseInt(n.style.top)
         }));
         let collision = true, attempts = 0;
         while (collision && attempts < 100) {
             collision = false;
             for (const node of existingNodes) {
                 if (Math.abs(node.x - x) < 30 && Math.abs(node.y - y) < 30) {
                     collision = true;
                     break;
                 }
             }
             if (collision) { x += 20; y += 20; attempts++; }
         }
    }
    
    nodeEl.style.left = x + 'px';
    nodeEl.style.top = y + 'px';
    
    // テンプレートからの初期色をdata属性として保存
    const colorBtn = nodeEl.querySelector('.color-dropdown-btn');
    if (colorBtn && colorBtn.style.backgroundColor) {
        nodeEl.dataset.color = colorBtn.style.backgroundColor;
    }
    
    setupNodeEvents(nodeEl);
    nodesLayer.appendChild(nodeEl);
    adjustNodeWidth(nodeEl);
    
    // ポート初期化
    const initialSockets = nodeEl.querySelectorAll('.socket-port');
    const hasPortTypeData = Object.keys(portTypeData).length > 0;
    initialSockets.forEach((port, index) => {
        setupOutputPort(port, nodeEl, index);
        if (hasPortTypeData) initPortTypeDropdown(port, nodeEl, index);
    });

    // プラグポート初期化
    const initialPlugs = nodeEl.querySelectorAll('.plug-port');
    initialPlugs.forEach((plug, idx) => {
        plug.dataset.plugIndex = idx;
        setupInputPort(plug, nodeEl);
    });
    updatePlugSocketsGap(nodeEl);

    // ソケット/プラグが1つだけの場合は中央配置
    const socketsContainer = nodeEl.querySelector('.sockets-container');
    if (initialSockets.length === 1 && socketsContainer) {
        socketsContainer.classList.add('single-socket');
    }
    const plugContainer = nodeEl.querySelector('.plug-container');
    if (initialPlugs.length === 1 && plugContainer) {
        plugContainer.classList.add('single-plug');
    }

    requestSaveWorkspace();
    return nodeEl;
}

function setupNodeEvents(node) {
    // ノードドラッグ開始
    node.addEventListener('mousedown', (e) => {
        if (e.target.closest('.socket-port, .plug-port, button, input')) return;
        e.stopPropagation();
        isDraggingNode = true;
        draggedNode = node;
        bringClusterToFront(node.id);
        
        const rect = workspaceContainer.getBoundingClientRect();
        const logicalMouseX = (e.clientX - rect.left) / zoomLevel - workspaceOffset.x;
        const logicalMouseY = (e.clientY - rect.top) / zoomLevel - workspaceOffset.y;
        dragOffset.x = logicalMouseX - parseInt(node.style.left || 0);
        dragOffset.y = logicalMouseY - parseInt(node.style.top || 0);
        node.classList.add('dragging');
    });

    // ノード名入力フィールド
    const nameInput = node.querySelector('.node-name');
    if (nameInput) {
        nameInput.addEventListener('mousedown', (e) => e.stopPropagation());
        nameInput.addEventListener('input', () => requestSaveWorkspace());
    }

    // アイコンボタン
    const nodeIcon = node.querySelector('.node-icon');
    if (nodeIcon) {
        nodeIcon.style.cursor = 'pointer';
        nodeIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            showIconPickerMenu(node);
        });
        nodeIcon.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // カラーボタン
    const colorDropdownBtn = node.querySelector('.color-dropdown-btn');
    if (colorDropdownBtn) {
        colorDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showColorModal(node);
        });
        colorDropdownBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // ソケット追加ボタン
    const addSocketBtn = node.querySelector('.add-socket-btn');
    if (addSocketBtn) {
        addSocketBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const socketPorts = node.querySelectorAll('.socket-port');
            setSocketCount(node, socketPorts.length + 1);
            renderAllConnections();
            requestSaveWorkspace();
        });
        addSocketBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // プラグ追加ボタン
    const addPlugBtn = node.querySelector('.add-plug-btn');
    if (addPlugBtn) {
        addPlugBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const plugPorts = node.querySelectorAll('.plug-port');
            setPlugCount(node, plugPorts.length + 1);
            renderAllConnections();
            requestSaveWorkspace();
        });
        addPlugBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // 全input要素（ラベル入力フィールド）
    node.querySelectorAll('input').forEach(input => {
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('input', () => requestSaveWorkspace());
    });

    // 説明テキストボックス
    const descriptionInput = node.querySelector('.description-input');
    if (descriptionInput) {
        descriptionInput.addEventListener('mousedown', (e) => e.stopPropagation());
        descriptionInput.addEventListener('input', () => requestSaveWorkspace());
    }
    
    // リサイズハンドル
    const resizeHandle = node.querySelector('.resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            resizedNode = node;
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
            resizeStartWidth = node.offsetWidth;
            // 説明コンテナの実際の高さを取得
            const descriptionContainer = node.querySelector('.node-description');
            resizeStartHeight = descriptionContainer ? descriptionContainer.offsetHeight : 50;
            node.style.cursor = 'se-resize';
        });
    }

    // 説明スペースがノード下部にある場合は角丸を適用
    const descriptionContainer = node.querySelector('.node-description');
    const socketsContainer = node.querySelector('.sockets-container');
    if (descriptionContainer && !socketsContainer) {
        descriptionContainer.classList.add('description-bottom');
    } else if (descriptionContainer && socketsContainer) {
        descriptionContainer.classList.remove('description-bottom');
    }
}

function applyNodeColor(node, color) {
    node.style.borderColor = color;
    node.dataset.color = color;  // ノード自身にdata属性として色を保存
    const header = node.querySelector('.node-header');
    if (header) {
        const rgb = hexToRgb(color);
        if (rgb) {
            header.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
        }
    }
    const colorBtn = node.querySelector('.color-dropdown-btn');
    if (colorBtn) {
        colorBtn.style.backgroundColor = color;
    }
}

function deleteNode(nodeId) {
    const nodeEl = document.getElementById(nodeId);
    if (!nodeEl) return;

    // 関連するケーブルを削除（配列は後ろから逆順で削除）
    for (let i = connections.length - 1; i >= 0; i--) {
        const conn = connections[i];
        if (conn.toNodeId === nodeId || conn.fromNodeId === nodeId) {
            connections.splice(i, 1);
        }
    }

    // ノードを削除
    nodeEl.remove();
    renderAllConnections();
    requestSaveWorkspace();
}

function bringClusterToFront(nodeId) {
    const visited = new Set();
    const toVisit = [nodeId];

    while (toVisit.length > 0) {
        const currentId = toVisit.pop();
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        // 接続を配列として処理
        connections.forEach(conn => {
            if (conn.fromNodeId === currentId && !visited.has(conn.toNodeId)) {
                toVisit.push(conn.toNodeId);
            }
            if (conn.toNodeId === currentId && !visited.has(conn.fromNodeId)) {
                toVisit.push(conn.fromNodeId);
            }
        });
    }

    visited.forEach(nodeId => {
        const node = document.getElementById(nodeId);
        if (node && node.parentElement === nodesLayer) {
            nodesLayer.appendChild(node);
        }
    });

    // 接続のz-orderも更新（配列の場合は順序で管理）
    // connectionsLayer内のケーブルをVisited順に並べ替える
    const visitedArray = Array.from(visited);
    connections.forEach((conn, index) => {
        if (visitedArray.includes(conn.toNodeId) || visitedArray.includes(conn.fromNodeId)) {
            const cableId = `conn-${conn.toNodeId}-${conn.toPlugIndex}`;
            const cable = connectionsLayer.querySelector(`[data-connection-id="${cableId}"]`);
            if (cable) {
                connectionsLayer.appendChild(cable);
            }
        }
    });

    renderAllConnections();
}
