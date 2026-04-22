// ===== グローバル変数と定数 =====

// DOM参照
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
let activeDragLine = null;

// ノードリサイズ管理
let isResizing = false;
let resizedNode = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;

// ワークスペース座標管理
let isPanning = false;
let panStart = { x: 0, y: 0 };
let workspaceOffset = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };
let zoomLevel = 1.0;

// ズーム定数
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

// ノード最小幅
const MIN_NODE_WIDTH = 160;

// ケーブル接続管理
const connections = [];

// ポート型データ（port.jsonから読み込む）
let portTypeData = {};

// ストレージ管理
const STORAGE_KEY = 'consent-workspace-v1';
let saveTimer = null;
let isRestoring = false;
