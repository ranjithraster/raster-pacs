/**
 * Collaboration Manager
 * Handles real-time collaboration features via WebSocket
 */

class CollaborationManager {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.userId = null;
        this.userName = null;
        this.currentStudyUid = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.viewers = new Map();
        this.cursors = new Map();
        this.messageHandlers = new Map();
        this.pingInterval = null;
        this.chatMessages = [];
    }

    /**
     * Initialize collaboration
     */
    initialize(userId, userName, userRole = 'VIEWER') {
        this.userId = userId || 'user-' + Math.random().toString(36).substr(2, 9);
        this.userName = userName || 'Anonymous';
        this.userRole = userRole;
        this.sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        this.setupMessageHandlers();
        this.connect();

        console.log('Collaboration Manager initialized', { userId: this.userId, sessionId: this.sessionId });
    }

    /**
     * Connect to WebSocket
     */
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => this.handleOpen();
            this.socket.onmessage = (event) => this.handleMessage(event);
            this.socket.onclose = (event) => this.handleClose(event);
            this.socket.onerror = (error) => this.handleError(error);

        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket open
     */
    handleOpen() {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Start ping interval
        this.pingInterval = setInterval(() => this.sendPing(), 30000);

        // If we were viewing a study, rejoin
        if (this.currentStudyUid) {
            this.joinStudy(this.currentStudyUid);
        }

        this.emit('connected', { sessionId: this.sessionId });
    }

    /**
     * Handle WebSocket message
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            const handler = this.messageHandlers.get(message.type);

            if (handler) {
                handler(message);
            } else {
                console.log('Unhandled message type:', message.type, message);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    /**
     * Handle WebSocket close
     */
    handleClose(event) {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnected = false;

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        this.emit('disconnected', { code: event.code, reason: event.reason });
        this.scheduleReconnect();
    }

    /**
     * Handle WebSocket error
     */
    handleError(error) {
        console.error('WebSocket error:', error);
        this.emit('error', { error });
    }

    /**
     * Schedule reconnection
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            this.emit('reconnectFailed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
    }

    /**
     * Setup message handlers
     */
    setupMessageHandlers() {
        this.messageHandlers.set('connected', (msg) => {
            console.log('Connected to server:', msg);
        });

        this.messageHandlers.set('viewers', (msg) => {
            this.viewers.clear();
            msg.viewers.forEach(v => this.viewers.set(v.sessionId, v));
            this.updateViewersList();
            this.emit('viewersUpdated', { viewers: Array.from(this.viewers.values()) });
        });

        this.messageHandlers.set('user_joined', (msg) => {
            this.viewers.set(msg.user.sessionId, msg.user);
            this.updateViewersList();
            this.showNotification(`${msg.user.userName} joined`, 'info');
            this.emit('userJoined', msg.user);
        });

        this.messageHandlers.set('user_left', (msg) => {
            const viewer = this.viewers.get(msg.sessionId);
            this.viewers.delete(msg.sessionId);
            this.removeCursor(msg.sessionId);
            this.updateViewersList();
            if (viewer) {
                this.showNotification(`${viewer.userName} left`, 'info');
            }
            this.emit('userLeft', { sessionId: msg.sessionId });
        });

        this.messageHandlers.set('cursor_move', (msg) => {
            this.updateCursor(msg.sessionId, msg.x, msg.y, msg.viewportId);
        });

        this.messageHandlers.set('scroll', (msg) => {
            if (msg.sessionId !== this.sessionId) {
                this.emit('remoteScroll', {
                    sessionId: msg.sessionId,
                    frameNumber: msg.frameNumber,
                    seriesUid: msg.seriesUid,
                    viewportId: msg.viewportId
                });
            }
        });

        this.messageHandlers.set('annotation', (msg) => {
            if (msg.sessionId !== this.sessionId) {
                this.emit('remoteAnnotation', {
                    action: msg.action,
                    annotation: msg.annotation
                });
            }
        });

        this.messageHandlers.set('tool_change', (msg) => {
            const viewer = this.viewers.get(msg.sessionId);
            if (viewer) {
                viewer.currentTool = msg.tool;
            }
        });

        this.messageHandlers.set('chat', (msg) => {
            this.chatMessages.push(msg);
            this.updateChatUI(msg);
            this.emit('chatMessage', msg);
        });

        this.messageHandlers.set('pong', (msg) => {
            // Connection is alive
        });

        this.messageHandlers.set('error', (msg) => {
            console.error('Server error:', msg.message);
            this.showNotification(msg.message, 'error');
        });
    }

    /**
     * Send message to server
     */
    send(type, data = {}) {
        if (!this.isConnected || !this.socket) {
            console.warn('Cannot send: not connected');
            return false;
        }

        const message = { type, ...data };

        try {
            this.socket.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Send error:', error);
            return false;
        }
    }

    /**
     * Send ping to keep connection alive
     */
    sendPing() {
        this.send('ping');
    }

    /**
     * Join a study for collaboration
     */
    joinStudy(studyUid, seriesUid = null) {
        this.currentStudyUid = studyUid;

        this.send('join', {
            studyUid: studyUid,
            seriesUid: seriesUid,
            userId: this.userId,
            userName: this.userName,
            userRole: this.userRole
        });

        // Create presence panel
        this.createPresencePanel();
    }

    /**
     * Leave current study
     */
    leaveStudy() {
        if (this.currentStudyUid) {
            this.send('leave', { studyUid: this.currentStudyUid });
            this.currentStudyUid = null;
            this.viewers.clear();
            this.clearCursors();
        }
    }

    /**
     * Send cursor position
     */
    sendCursorPosition(x, y, viewportId = 0) {
        if (!this.currentStudyUid) return;

        this.send('cursor', {
            studyUid: this.currentStudyUid,
            x: x,
            y: y,
            viewportId: viewportId
        });
    }

    /**
     * Send scroll/frame change
     */
    sendScroll(frameNumber, seriesUid, viewportId = 0) {
        if (!this.currentStudyUid) return;

        this.send('scroll', {
            studyUid: this.currentStudyUid,
            frameNumber: frameNumber,
            seriesUid: seriesUid,
            viewportId: viewportId
        });
    }

    /**
     * Send annotation update
     */
    sendAnnotation(action, annotation) {
        if (!this.currentStudyUid) return;

        this.send('annotation', {
            studyUid: this.currentStudyUid,
            action: action,
            annotation: annotation
        });
    }

    /**
     * Send tool change
     */
    sendToolChange(tool) {
        if (!this.currentStudyUid) return;

        this.send('tool', {
            studyUid: this.currentStudyUid,
            tool: tool
        });
    }

    /**
     * Send chat message
     */
    sendChatMessage(message) {
        if (!this.currentStudyUid || !message.trim()) return;

        this.send('chat', {
            studyUid: this.currentStudyUid,
            message: message.trim()
        });
    }

    /**
     * Update remote cursor position
     */
    updateCursor(sessionId, x, y, viewportId) {
        const viewer = this.viewers.get(sessionId);
        if (!viewer) return;

        let cursor = this.cursors.get(sessionId);
        if (!cursor) {
            cursor = this.createCursorElement(sessionId, viewer);
            this.cursors.set(sessionId, cursor);
        }

        const viewport = document.querySelectorAll('.viewport-element')[viewportId];
        if (viewport) {
            const rect = viewport.getBoundingClientRect();
            cursor.style.left = (rect.left + x) + 'px';
            cursor.style.top = (rect.top + y) + 'px';
            cursor.style.display = 'block';
        }
    }

    /**
     * Create cursor element for remote user
     */
    createCursorElement(sessionId, viewer) {
        const cursor = document.createElement('div');
        cursor.className = 'remote-cursor';
        cursor.id = `cursor-${sessionId}`;
        cursor.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="${viewer.cursorColor}">
                <path d="M5.5,21l2-8L12,9.5l4.5,3.5l2,8l-6.5-3L5.5,21z M12,3L4,11l8,6l8-6L12,3z"/>
            </svg>
            <span class="cursor-label" style="background: ${viewer.cursorColor}">${viewer.userName}</span>
        `;
        cursor.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 10000;
            display: none;
            transform: translate(-3px, -3px);
        `;
        document.body.appendChild(cursor);
        return cursor;
    }

    /**
     * Remove cursor element
     */
    removeCursor(sessionId) {
        const cursor = this.cursors.get(sessionId);
        if (cursor) {
            cursor.remove();
            this.cursors.delete(sessionId);
        }
    }

    /**
     * Clear all cursors
     */
    clearCursors() {
        this.cursors.forEach((cursor, sessionId) => {
            cursor.remove();
        });
        this.cursors.clear();
    }

    /**
     * Create presence panel
     */
    createPresencePanel() {
        let panel = document.getElementById('presencePanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'presencePanel';
            panel.className = 'presence-panel';
            panel.innerHTML = `
                <div class="presence-header">
                    <span>👥 Viewers</span>
                    <span class="viewer-count" id="viewerCount">1</span>
                </div>
                <div class="presence-list" id="presenceList"></div>
                <div class="chat-container" id="chatContainer">
                    <div class="chat-messages" id="chatMessages"></div>
                    <div class="chat-input">
                        <input type="text" id="chatInput" placeholder="Type a message...">
                        <button onclick="collaborationManager.sendChatFromInput()">Send</button>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);

            // Chat input handler
            document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatFromInput();
                }
            });
        }

        this.updateViewersList();
    }

    /**
     * Update viewers list UI
     */
    updateViewersList() {
        const listEl = document.getElementById('presenceList');
        const countEl = document.getElementById('viewerCount');

        if (countEl) {
            countEl.textContent = this.viewers.size + 1; // +1 for self
        }

        if (!listEl) return;

        let html = `
            <div class="viewer-item self">
                <span class="viewer-dot" style="background: #00ff00"></span>
                <span class="viewer-name">${this.userName} (you)</span>
            </div>
        `;

        this.viewers.forEach((viewer, sessionId) => {
            html += `
                <div class="viewer-item" data-session="${sessionId}">
                    <span class="viewer-dot" style="background: ${viewer.cursorColor}"></span>
                    <span class="viewer-name">${viewer.userName}</span>
                    <span class="viewer-tool">${viewer.currentTool || ''}</span>
                </div>
            `;
        });

        listEl.innerHTML = html;
    }

    /**
     * Update chat UI
     */
    updateChatUI(msg) {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const isOwn = msg.sessionId === this.sessionId;
        const div = document.createElement('div');
        div.className = `chat-message ${isOwn ? 'own' : ''}`;
        div.innerHTML = `
            <span class="chat-user">${msg.userName}:</span>
            <span class="chat-text">${this.escapeHtml(msg.message)}</span>
            <span class="chat-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Send chat from input field
     */
    sendChatFromInput() {
        const input = document.getElementById('chatInput');
        if (input && input.value.trim()) {
            this.sendChatMessage(input.value);
            input.value = '';
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        }
    }

    /**
     * Event emitter
     */
    emit(event, data) {
        const customEvent = new CustomEvent(`collaboration:${event}`, { detail: data });
        window.dispatchEvent(customEvent);
    }

    /**
     * Listen for collaboration events
     */
    on(event, callback) {
        window.addEventListener(`collaboration:${event}`, (e) => callback(e.detail));
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.isConnected = false;
        this.clearCursors();
    }

    /**
     * Check if following another user
     */
    followUser(sessionId) {
        this.followingUser = sessionId;
        this.showNotification(`Following ${this.viewers.get(sessionId)?.userName}`, 'info');
    }

    /**
     * Stop following
     */
    stopFollowing() {
        this.followingUser = null;
        this.showNotification('Stopped following', 'info');
    }
}

// Create global instance
const collaborationManager = new CollaborationManager();

// Initialize with default user (would come from auth in production)
document.addEventListener('DOMContentLoaded', () => {
    // Auto-initialize with default user
    const userId = localStorage.getItem('userId') || 'user-' + Math.random().toString(36).substr(2, 9);
    const userName = localStorage.getItem('userName') || 'User ' + userId.slice(-4);

    localStorage.setItem('userId', userId);
    localStorage.setItem('userName', userName);

    collaborationManager.initialize(userId, userName, 'VIEWER');
});

