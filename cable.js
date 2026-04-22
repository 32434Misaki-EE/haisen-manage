// ===== ケーブル接続管理 =====

function startCableDrag(nodeId, portIndex, type, startX, startY) {
    isDrawingLine = true;
    dragStartPort = { nodeId, portIndex, type };
    
    activeDragLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    activeDragLine.setAttribute('class', 'cable cable-drag');
    connectionsLayer.appendChild(activeDragLine);
    
    const startPoint = getPortCenter(nodeId, type, portIndex);
    updatePath(activeDragLine, startPoint.x, startPoint.y, startPoint.x, startPoint.y, type); 
}

function getPortCenter(nodeId, type, index) {
    const node = document.getElementById(nodeId);
    if (!node) return { x: 0, y: 0 };

    let portEl;
    if (type === 'input') {
        const plugs = node.querySelectorAll('.plug-port');
        if (plugs[index]) {
            portEl = plugs[index].querySelector('.port-point');
        }
    } else {
        const sockets = node.querySelectorAll('.socket-port');
        if (sockets[index]) {
            portEl = sockets[index].querySelector('.port-point');
        }
    }

    if (!portEl) return { x: 0, y: 0 };

    const portRect = portEl.getBoundingClientRect();
    const containerRect = workspaceContainer.getBoundingClientRect();

    return {
        x: (portRect.left + portRect.width / 2 - containerRect.left) / zoomLevel - workspaceOffset.x,
        y: (portRect.top + portRect.height / 2 - containerRect.top) / zoomLevel - workspaceOffset.y
    };
}

function updatePath(pathEl, x1, y1, x2, y2, startNodePortType = 'output') {
    let cp1x, cp1y, cp2x, cp2y;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    let handleLen = Math.min(dist * 0.5, 150);
    if (Math.abs(dy) < 50 || Math.abs(dx) < 50) {
       handleLen = Math.max(handleLen, 80);
    }
    
    if (startNodePortType === 'output') {
        cp1x = x1;
        cp1y = y1 + handleLen;
        cp2x = x2;
        cp2y = y2 - handleLen;
    } else {
        cp1x = x1;
        cp1y = y1 - handleLen;
        cp2x = x2;
        cp2y = y2 + handleLen;
    }
    
    const pathData = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    pathEl.setAttribute('d', pathData);
}

function validateConnection(dragStartPort, targetPort) {
    // 自分自身への接続禁止
    const targetNode = targetPort.closest('.node');
    const startNode = document.getElementById(dragStartPort.nodeId);
    if (targetNode === startNode) return false;

    // Output同士、Input同士の接続禁止
    const targetType = targetPort.dataset.portType;
    if (!targetType) return false;
    
    if (dragStartPort.type === targetType) return false;

    // Input側の特定ポートに既に接続があれば禁止
    if (targetType === 'input') {
        const toPlugIndex = Array.from(targetNode.querySelectorAll('.plug-port')).indexOf(targetPort);
        const hasConnection = connections.some(conn => 
            conn.toNodeId === targetNode.id && conn.toPlugIndex === toPlugIndex
        );
        if (hasConnection) return false;
    }

    return true;
}

function createConnection(dragStartPort, targetPort) {
    const targetNode = targetPort.closest('.node');
    const startNode = document.getElementById(dragStartPort.nodeId);

    if (dragStartPort.type === 'output') {
        // Start: Output, Target: Input
        const targetPlugs = targetNode.querySelectorAll('.plug-port');
        const toPlugIndex = Array.from(targetPlugs).indexOf(targetPort);
        connections.push({
            fromNodeId: startNode.id,
            fromPortIndex: dragStartPort.portIndex,
            toNodeId: targetNode.id,
            toPlugIndex: toPlugIndex
        });
    } else {
        // Start: Input, Target: Output
        const targetSockets = targetNode.querySelectorAll('.socket-port');
        const fromPortIndex = Array.from(targetSockets).indexOf(targetPort);
        connections.push({
            fromNodeId: targetNode.id,
            fromPortIndex: fromPortIndex,
            toNodeId: startNode.id,
            toPlugIndex: dragStartPort.portIndex
        });
    }

    renderAllConnections();
    requestSaveWorkspace();
}

function removeConnection(toNodeId, toPlugIndex) {
    const index = connections.findIndex(conn => 
        conn.toNodeId === toNodeId && conn.toPlugIndex === toPlugIndex
    );
    if (index >= 0) {
        connections.splice(index, 1);
        renderAllConnections();
        requestSaveWorkspace();
    }
}

function renderAllConnections() {
    const existingCables = connectionsLayer.querySelectorAll('.cable:not(.cable-drag)');
    const existingMap = new Map();
    
    // 既存ケーブルをマップに保存（差分更新用）
    existingCables.forEach(cable => {
        const id = cable.dataset.connectionId;
        if (id) {
            existingMap.set(id, cable);
        }
    });

    // 必要なケーブルをマーク
    const requiredIds = new Set();
    connections.forEach((conn, idx) => {
        const id = `conn-${conn.toNodeId}-${conn.toPlugIndex}`;
        requiredIds.add(id);
    });

    // 不要なケーブルを削除
    existingMap.forEach((cable, id) => {
        if (!requiredIds.has(id)) {
            cable.remove();
        }
    });

    // 新規/更新ケーブルを処理
    connections.forEach((conn, idx) => {
        const id = `conn-${conn.toNodeId}-${conn.toPlugIndex}`;
        const toNode = document.getElementById(conn.toNodeId);
        const fromNode = document.getElementById(conn.fromNodeId);
        if (!toNode || !fromNode) return;

        let path = existingMap.get(id);
        if (!path) {
            // 新規ケーブルを作成
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'cable');
            path.dataset.connectionId = id;
            path.addEventListener('click', (e) => {
                e.stopPropagation();
                removeConnection(conn.toNodeId, conn.toPlugIndex);
            });
            connectionsLayer.appendChild(path);
        }

        // パスデータを更新（既存・新規共通）
        const startPoint = getPortCenter(conn.fromNodeId, 'output', conn.fromPortIndex);
        const endPoint = getPortCenter(conn.toNodeId, 'input', conn.toPlugIndex || 0);
        updatePath(path, startPoint.x, startPoint.y, endPoint.x, endPoint.y, 'output');
    });
}
