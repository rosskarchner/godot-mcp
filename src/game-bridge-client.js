import fs from 'fs/promises';
import path from 'path';

/**
 * Client for communicating with the Game Bridge HTTP API (running game)
 */
export class GameBridgeClient {
    constructor(host = '127.0.0.1', port = 8766) {
        this.baseUrl = `http://${host}:${port}`;
        this.timeout = 10000;
    }

    async request(method, endpoint, data = null) {
        const options = {
            method,
            signal: AbortSignal.timeout(this.timeout)
        };

        if (data) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, options);

            if (!response.ok) {
                throw new Error(`Game Bridge error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout to Game Bridge at ${this.baseUrl}`);
            }
            throw error;
        }
    }

    // Screenshot from running game
    async captureScreenshot(options = {}) {
        const params = new URLSearchParams();
        if (options.maxWidth) params.set('max_width', options.maxWidth);
        if (options.maxHeight) params.set('max_height', options.maxHeight);
        // We force save_to_disk=false on the Godot side so we get the data back
        // and handle saving it on the Node.js side. (Godot would save to user://)

        const queryString = params.toString();
        const url = queryString ? `/screenshot?${queryString}` : '/screenshot';

        const result = await this.request('GET', url);

        // Check for 'data' (Game Bridge uses "data" key for base64) or 'base64' (legacy)
        const base64Data = result.data || result.base64;

        if (base64Data) {
            try {
                const buffer = Buffer.from(base64Data, 'base64');
                const filename = `screenshot_${Date.now()}.png`;
                const filepath = path.resolve(process.cwd(), filename);
                await fs.writeFile(filepath, buffer);

                // Return generic info + path, explicitly exclude base64
                return {
                    width: result.width,
                    height: result.height,
                    saved_to: filepath,
                    note: "Image saved to disk to avoid context overflow"
                };
            } catch (e) {
                console.error("Failed to save screenshot to disk:", e);
                // Fallback? Or just error.
                return { error: "Failed to save screenshot to disk", details: e.message };
            }
        }
        return result;
    }

    // Scene tree of running game
    async getSceneTree(maxDepth = 10) {
        return this.request('GET', `/scene_tree?max_depth=${maxDepth}`);
    }

    // Send single input event
    async sendInput(eventData) {
        return this.request('POST', '/input', eventData);
    }

    // Send input sequence
    async sendInputSequence(sequence, captureScreenshot = false) {
        return this.request('POST', '/input-sequence', {
            sequence,
            capture_screenshot: captureScreenshot
        });
    }

    // Convenience methods for common inputs
    async sendAction(actionName, pressed = true, strength = 1.0) {
        return this.sendInput({
            event_type: 'action',
            action_name: actionName,
            pressed,
            strength
        });
    }

    async sendKey(keycode, pressed = true, modifiers = {}) {
        return this.sendInput({
            event_type: 'key',
            keycode,
            pressed,
            ...modifiers
        });
    }

    async sendMouseButton(buttonIndex, x, y, pressed = true, doubleClick = false) {
        return this.sendInput({
            event_type: 'mouse_button',
            button_index: buttonIndex,
            position_x: x,
            position_y: y,
            pressed,
            double_click: doubleClick
        });
    }

    async sendMouseMotion(x, y, relativeX = 0, relativeY = 0) {
        return this.sendInput({
            event_type: 'mouse_motion',
            position_x: x,
            position_y: y,
            relative_x: relativeX,
            relative_y: relativeY
        });
    }

    // Health check
    async isGameRunning() {
        try {
            await fetch(`${this.baseUrl}/screenshot`, {
                method: 'HEAD',
                signal: AbortSignal.timeout(1000)
            });
            return true;
        } catch {
            return false;
        }
    }
}
