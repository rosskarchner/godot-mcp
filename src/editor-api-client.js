/**
 * Client for communicating with the Editor Bridge HTTP API
 */
export class EditorApiClient {
    constructor(host = '127.0.0.1', port = 8765) {
        this.baseUrl = `http://${host}:${port}`;
        this.timeout = 10000;
    }

    async request(endpoint, data = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`Editor API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout to Editor API at ${this.baseUrl}`);
            }
            throw error;
        }
    }

    // Scene operations
    async getSceneTree(maxDepth = 10) {
        return this.request('/scene/tree', { max_depth: maxDepth });
    }

    async getCurrentScene() {
        return this.request('/scene/current');
    }

    async loadScene(path) {
        return this.request('/scene/load', { path });
    }

    async saveScene() {
        return this.request('/scene/save');
    }

    // Node operations
    async getNodeInfo(nodePath) {
        return this.request('/node/info', { node_path: nodePath });
    }

    async getNodeProperties(nodePath) {
        return this.request('/node/properties', { node_path: nodePath });
    }

    async setNodeProperty(nodePath, property, value) {
        return this.request('/node/set', { node_path: nodePath, property, value });
    }

    async createNode(parentPath, nodeType, nodeName) {
        return this.request('/node/create', {
            parent_path: parentPath,
            node_type: nodeType,
            node_name: nodeName
        });
    }

    async deleteNode(nodePath) {
        return this.request('/node/delete', { node_path: nodePath });
    }

    async renameNode(nodePath, newName) {
        return this.request('/node/rename', { node_path: nodePath, new_name: newName });
    }

    // Script operations
    async getNodeScript(nodePath) {
        return this.request('/script/get', { node_path: nodePath });
    }

    async attachScript(nodePath, scriptPath) {
        return this.request('/script/attach', { node_path: nodePath, script_path: scriptPath });
    }

    async getScriptSource(scriptPath) {
        return this.request('/script/source', { script_path: scriptPath });
    }

    // Resource operations
    async listResources(directory = 'res://', filter = '') {
        return this.request('/resources/list', { directory, filter });
    }

    // Project Settings
    async listProjectSettings(prefix = '') {
        return this.request('/project/settings', { prefix });
    }

    async getProjectSetting(name) {
        return this.request('/project/get', { setting_name: name });
    }

    async setProjectSetting(name, value) {
        return this.request('/project/set', { setting_name: name, value });
    }

    // Input Map
    async listInputActions() {
        return this.request('/input/actions');
    }

    // Editor output
    async readEditorLogs(maxLines = 100, filterText = null) {
        const body = { max_lines: maxLines };
        if (filterText) {
            body.filter_text = filterText;
        }
        return this.request('/editor/output', body);
    }

    // Health check
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                signal: AbortSignal.timeout(2000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
