// ===== ズーム・パンニング =====

function updateZoom(newZoom, centerX, centerY) {
    const oldZoom = zoomLevel;
    zoomLevel = Math.round(newZoom * 100) / 100;

    if (centerX === undefined || centerY === undefined) {
         const rect = workspaceContainer.getBoundingClientRect();
         centerX = rect.width / 2;
         centerY = rect.height / 2;
    }

    const logicalX = centerX / oldZoom - workspaceOffset.x;
    const logicalY = centerY / oldZoom - workspaceOffset.y;

    workspaceOffset.x = centerX / zoomLevel - logicalX;
    workspaceOffset.y = centerY / zoomLevel - logicalY;

    updateWorkspaceTransform();
    requestSaveWorkspace();
}

function updateWorkspaceTransform() {
    const transform = `scale(${zoomLevel}) translate(${workspaceOffset.x}px, ${workspaceOffset.y}px)`;
    
    nodesLayer.style.transform = transform;
    connectionsLayer.style.transform = transform;
    
    if(workspaceBg) {
         workspaceBg.style.transform = transform;
    }
}

function handleWorkspaceMouseDown(e) {
    // ドロップダウンをすべて閉じる
    const dropdowns = document.querySelectorAll('.port-type-dropdown');
    dropdowns.forEach(d => d.style.display = 'none');
    
    // モーダルをすべて閉じる
    const modals = document.querySelectorAll('.icon-modal, .color-modal');
    modals.forEach(m => m.remove());
    
    // ノードやポート上でのクリックなら無視
    const target = e.target;
    if (target.closest('.node') || target.closest('.socket-port') || target.closest('.plug-port') || target.closest('.delete-btn') || target.closest('.cable')) {
        return;
    }

    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    panStartOffset = { x: workspaceOffset.x, y: workspaceOffset.y };
    workspaceContainer.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    const rect = workspaceContainer.getBoundingClientRect();

    if (isResizing && resizedNode) {
        const deltaX = e.clientX - resizeStartX;
        const socketCount = resizedNode.querySelectorAll('.socket-port').length;
        const plugCount = resizedNode.querySelectorAll('.plug-port').length;
        const minWidth = calculateMinNodeWidth(socketCount, plugCount);
        const rawWidth = resizeStartWidth + deltaX / zoomLevel;
        
        // グリッドサイズでスナップ（最小幅は確保）
        const gridSize = 20;
        const snappedWidth = Math.max(minWidth, Math.round(rawWidth / gridSize) * gridSize);
        
        resizedNode.style.width = snappedWidth + 'px';
        updateNodeSocketsGap(resizedNode, snappedWidth);
        updatePlugSocketsGap(resizedNode);

        // 縦方向のリサイズ：説明入力スペースの高さを変更
        const deltaY = e.clientY - resizeStartY;
        const descriptionContainer = resizedNode.querySelector('.node-description');
        if (descriptionContainer) {
            const rawHeight = resizeStartHeight + deltaY / zoomLevel;
            // グリッドサイズでスナップ
            const snappedHeight = Math.max(20, Math.round(rawHeight / gridSize) * gridSize);
            descriptionContainer.style.height = snappedHeight + 'px';
        }

        renderAllConnections();
        return;
    }

    if (isPanning) {
        const dx = (e.clientX - panStart.x) / zoomLevel;
        const dy = (e.clientY - panStart.y) / zoomLevel;
        
        workspaceOffset.x = panStartOffset.x + dx;
        workspaceOffset.y = panStartOffset.y + dy;
        
        updateWorkspaceTransform();
        return;
    }

    const logicalMouseX = (e.clientX - rect.left) / zoomLevel - workspaceOffset.x;
    const logicalMouseY = (e.clientY - rect.top) / zoomLevel - workspaceOffset.y;

    if (isDraggingNode && draggedNode) {
        let rawX = logicalMouseX - dragOffset.x;
        let rawY = logicalMouseY - dragOffset.y;
        
        const gridSize = 20;
        const snappedX = Math.round(rawX / gridSize) * gridSize;
        const snappedY = Math.round(rawY / gridSize) * gridSize;

        draggedNode.style.left = snappedX + 'px'; 
        draggedNode.style.top = snappedY + 'px';

        renderAllConnections();
        return;
    }

    if (isDrawingLine && activeDragLine && dragStartPort) {
        const startPoint = getPortCenter(dragStartPort.nodeId, dragStartPort.type, dragStartPort.portIndex);
        updatePath(activeDragLine, startPoint.x, startPoint.y, logicalMouseX, logicalMouseY, dragStartPort.type);
    }
}

function handleMouseUp(e) {
    if (isResizing) {
        isResizing = false;
        if (resizedNode) {
            resizedNode.style.cursor = '';
            renderAllConnections();
            requestSaveWorkspace();
        }
        resizedNode = null;
        return;
    }
    
    if (isPanning) {
        isPanning = false;
        workspaceContainer.style.cursor = ''; 
        requestSaveWorkspace();
        return;
    }
    
    if (isDraggingNode) {
        isDraggingNode = false;
        if (draggedNode) draggedNode.classList.remove('dragging');
        draggedNode = null;
        requestSaveWorkspace();
        return;
    }

    if (isDrawingLine) {
        activeDragLine.style.display = 'none';
        
        const elBelow = document.elementFromPoint(e.clientX, e.clientY);
        
        let targetPort = null;
        if (elBelow) {
            targetPort = elBelow.closest('.socket-port') || elBelow.closest('.plug-port');
        }
        
        if (targetPort && validateConnection(dragStartPort, targetPort)) {
            createConnection(dragStartPort, targetPort);
        }
        
        if (activeDragLine) {
            activeDragLine.remove();
        }
        activeDragLine = null;
        isDrawingLine = false;
        dragStartPort = null;
    }
}
