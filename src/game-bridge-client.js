import fs from 'fs/promises';
import path from 'path';

/**
 * Client for communicating with the Game Bridge HTTP API (running game)
 */
export class GameBridgeClient {
    constructor(host = '127.0.0.1', port = 8766) {
        this.baseUrl = `http://${host}:${port}`;
        this.timeout = 10000;
        this.editorClient = null;
    }

    /**
     * Set the editor client reference for debugger state checking
     * @param {EditorApiClient} client 
     */
    setEditorClient(client) {
        this.editorClient = client;
    }

    /**
     * Check if any debugger session is paused
     * @returns {Promise<{paused: boolean, sessions: Array}>}
     */
    async checkDebuggerPaused() {
        if (!this.editorClient) {
            return { paused: false, sessions: [] };
        }

        try {
            const sessions = await this.editorClient.getDebuggerSessions();
            const pausedSessions = Array.isArray(sessions)
                ? sessions.filter(s => s.paused)
                : [];
            return {
                paused: pausedSessions.length > 0,
                sessions: pausedSessions
            };
        } catch {
            // Editor might not be responding either
            return { paused: false, sessions: [] };
        }
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
            // Handle timeout - AbortError in older Node.js, TimeoutError in newer versions
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                // Timeout occurred - check if game is paused in debugger
                const debuggerState = await this.checkDebuggerPaused();

                if (debuggerState.paused) {
                    const session = debuggerState.sessions[0]; // Primary session

                    let errorDetails = [];

                    // Session basic info
                    errorDetails.push(`Session ${session.id}: paused=${session.paused}, can_debug=${session.can_debug}`);

                    // Break reason and location
                    if (session.reason) {
                        errorDetails.push(`Reason: ${session.reason}`);
                    }
                    if (session.break_file) {
                        const location = session.break_line >= 0
                            ? `${session.break_file}:${session.break_line}`
                            : session.break_file;
                        errorDetails.push(`Location: ${location}`);
                    }

                    // Actual error message
                    if (session.error) {
                        errorDetails.push(`Error: ${session.error}`);
                    }

                    // Stack trace (if available)
                    let stackInfo = '';
                    if (session.stack && session.stack.length > 0) {
                        const stackLines = session.stack.map((frame, i) => {
                            const loc = frame.line >= 0 ? `${frame.file}:${frame.line}` : frame.file;
                            return `  ${i}: ${frame.function || '<anonymous>'} at ${loc}`;
                        }).join('\n');
                        stackInfo = `\n\nStack trace:\n${stackLines}`;
                    }

                    throw new Error(
                        `Game Bridge timeout - the game appears to be stopped in the debugger.\n\n` +
                        `${errorDetails.join('\n')}${stackInfo}\n\n` +
                        `To inspect or continue:\n` +
                        `1. Use godot_debugger_sessions to see full debugger state\n` +
                        `2. Use godot_debugger_resume to continue execution\n` +
                        `3. Or use godot_debugger_step_over to step through the code`
                    );
                }

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
