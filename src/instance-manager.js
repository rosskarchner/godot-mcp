import { spawn } from 'child_process';
import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class InstanceManager extends EventEmitter {
    constructor() {
        super();
        this.instances = new Map();  // projectPath (id) -> InstanceInfo
        this.basePort = 6005;
        this.portSpacing = 10;
        this.stateFilePath = path.join(__dirname, '../.instances.json');
    }

    /**
     * Restore previous sessions
     */
    async loadState() {
        try {
            if (!await this.fileExists(this.stateFilePath)) return;

            const data = await fs.readFile(this.stateFilePath, 'utf8');
            const state = JSON.parse(data);

            for (const item of state) {
                // Use project path as ID (migrate from UUID if needed)
                const id = item.projectPath;

                // Check if process is still running
                try {
                    process.kill(item.pid, 0); // Throws if not running

                    // Adopt it
                    const instanceInfo = {
                        id: id,
                        projectPath: item.projectPath,
                        ports: item.ports,
                        pid: item.pid,
                        process: null,
                        status: 'running (restored)',
                        launchedAt: new Date(item.launchedAt)
                    };
                    this.instances.set(id, instanceInfo);

                    console.error(`[InstanceManager] Restored session for ${id} (PID ${item.pid})`);

                    this.monitorExternalProcess(instanceInfo);

                } catch (e) {
                    console.error(`[InstanceManager] Discarding dead session ${id} (PID ${item.pid})`);
                }
            }
        } catch (e) {
            console.error("[InstanceManager] Failed to load state:", e);
        }
    }

    async saveState() {
        // ID is path, so just save properties
        const state = Array.from(this.instances.values()).map(data => ({
            id: data.id,
            pid: data.process ? data.process.pid : data.pid,
            projectPath: data.projectPath,
            ports: data.ports,
            launchedAt: data.launchedAt
        }));

        try {
            await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2));
        } catch (e) {
            console.error("[InstanceManager] Failed to save state:", e);
        }
    }

    monitorExternalProcess(instance) {
        // Poll regularly to see if it died
        const interval = setInterval(() => {
            try {
                process.kill(instance.pid, 0);
            } catch {
                console.error(`[InstanceManager] Restored instance ${instance.id} exited`);
                clearInterval(interval);
                this.instances.delete(instance.id);
                this.saveState();
            }
        }, 5000);
        instance._monitorInterval = interval;
    }

    allocatePorts(instanceIndex) {
        // Find a free index
        let index = 0;
        while (true) {
            const testLsp = this.basePort + (index * this.portSpacing);
            const isUsed = Array.from(this.instances.values()).some(i => i.ports.lsp === testLsp);
            if (!isUsed) break;
            index++;
        }

        const baseOffset = index * this.portSpacing;
        return {
            lsp: this.basePort + baseOffset,
            dap: this.basePort + 1 + baseOffset,
            editorApi: 8765 + (index * 10),
            gameBridge: 8766 + (index * 10),
        };
    }

    async adoptInstance(projectPath, customPorts = {}) {
        projectPath = path.resolve(projectPath);

        if (this.instances.has(projectPath)) {
            return this.instances.get(projectPath);
        }

        const ports = {
            lsp: customPorts.lsp_port || 6005,
            dap: customPorts.dap_port || 6006,
            editorApi: customPorts.editor_port || 8765,
            gameBridge: customPorts.game_bridge_port || 8766
        };

        const instanceInfo = {
            id: projectPath,
            projectPath,
            ports,
            process: null,
            pid: 0,
            status: 'adopted',
            launchedAt: new Date()
        };

        this.instances.set(projectPath, instanceInfo);
        await this.saveState();
        return instanceInfo;
    }

    async launchInstance(projectPath, options = {}) {
        // Ensure path is absolute and normalized
        projectPath = path.resolve(projectPath);

        if (this.instances.has(projectPath)) {
            return this.instances.get(projectPath);
        }

        const instanceId = projectPath;
        const ports = this.allocatePorts();
        console.error(`[InstanceManager] Launching '${path.basename(projectPath)}' (${projectPath}) on ports:`, ports);

        await this.injectMCPSupport(projectPath, ports);

        const godotPath = options.godotPath || 'godot';
        const args = [
            '--path', projectPath,
            '--editor',
            `--remote-debug-port=${ports.dap}`,
            `--language-server-port=${ports.lsp}`
        ];

        if (options.headless) {
            args.push('--headless');
        }

        console.error(`[InstanceManager] Executing: ${godotPath} ${args.join(' ')}`);

        const fs = await import('fs');
        const outLog = fs.openSync(path.join(projectPath, 'godot_access.log'), 'a');
        const errLog = fs.openSync(path.join(projectPath, 'godot_error.log'), 'a');

        // Ensure XDG_RUNTIME_DIR is set (critical for Wayland/Godot)
        if (!process.env.XDG_RUNTIME_DIR) {
            process.env.XDG_RUNTIME_DIR = '/run/user/1000';
        }
        console.error(`[InstanceManager] Launching with XDG_RUNTIME_DIR: ${process.env.XDG_RUNTIME_DIR}`);

        const childProcess = spawn(godotPath, args, {
            stdio: ['ignore', outLog, errLog],
            env: process.env
        });

        childProcess.on('close', (code) => {
            console.error(`[InstanceManager] Instance ${instanceId} exited with code ${code}`);
            this.instances.delete(instanceId);
            this.saveState();
        });

        // childProcess.unref(); // Keep attached for now to debug

        const instanceInfo = {
            id: instanceId,
            projectPath,
            ports,
            process: childProcess,
            status: 'starting',
            launchedAt: new Date()
        };

        this.instances.set(instanceId, instanceInfo);

        await this.saveState();

        instanceInfo.status = 'running';
        return instanceInfo;
    }

    async injectMCPSupport(projectPath, ports) {
        const addonSourceDir = path.join(__dirname, '../addon_template/addons/godot_mcp_bridge');
        const addonTargetDir = path.join(projectPath, 'addons/godot_mcp_bridge');
        await fs.cp(addonSourceDir, addonTargetDir, { recursive: true, force: true });

        const templatePath = path.join(addonTargetDir, 'mcp_config.gd.template');
        const configPath = path.join(addonTargetDir, 'mcp_config.gd');

        if (await this.fileExists(templatePath)) {
            let template = await fs.readFile(templatePath, 'utf8');
            template = template.replace('8765', ports.editorApi.toString());
            template = template.replace('8766', ports.gameBridge.toString());
            await fs.writeFile(configPath, template);
            await fs.unlink(templatePath).catch(() => { });
        }

        const projectFile = path.join(projectPath, 'project.godot');
        await this.modifyProjectFile(projectFile);
    }

    async modifyProjectFile(projectFile) {
        if (!await this.fileExists(projectFile)) {
            throw new Error(`project.godot not found at ${projectFile}`);
        }

        let content = await fs.readFile(projectFile, 'utf8');
        let changed = false;

        if (!content.includes('[autoload]')) {
            content += '\n[autoload]\n\n';
            changed = true;
        }

        const autoloadLine = 'MCPGameBridge="*res://addons/godot_mcp_bridge/runtime/game_bridge.gd"';
        if (!content.includes('MCPGameBridge=')) {
            content = content.replace(/\[autoload\]/, `[autoload]\n\n${autoloadLine}`);
            changed = true;
        }

        if (!content.includes('[editor_plugins]')) {
            content += '\n[editor_plugins]\n\n';
            changed = true;
        }

        const pluginPath = "res://addons/godot_mcp_bridge/plugin.cfg";
        if (!content.includes(pluginPath)) {
            const enabledRegex = /enabled=PackedStringArray\((.*)\)/;
            const match = content.match(enabledRegex);

            if (match) {
                const existing = match[1];
                const newArray = existing ? `${existing}, "${pluginPath}"` : `"${pluginPath}"`;
                content = content.replace(enabledRegex, `enabled=PackedStringArray(${newArray})`);
            } else {
                content = content.replace(/\[editor_plugins\]/, `[editor_plugins]\n\nenabled=PackedStringArray("${pluginPath}")`);
            }
            changed = true;
        }

        if (changed) {
            await fs.writeFile(projectFile, content);
            console.error(`[InstanceManager] Updated project.godot`);
        }
    }

    async fileExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    getInstance(identifier) {
        if (!identifier) return null;

        // Exact match
        if (this.instances.has(identifier)) return this.instances.get(identifier);

        // Try resolving path (in case identifier is relative or slightly different string representation)
        try {
            const resolved = path.resolve(identifier);
            if (this.instances.has(resolved)) return this.instances.get(resolved);
        } catch { }

        return null;
    }

    listInstances() {
        return Array.from(this.instances.values()).map(i => ({
            id: i.id, // This is now the project path
            ports: i.ports,
            status: i.status
        }));
    }

    async terminateInstance(identifier) {
        const instance = this.getInstance(identifier);
        if (!instance) return false;

        if (instance.process) {
            instance.process.kill();
        } else if (instance.pid) {
            try {
                process.kill(instance.pid);
            } catch { }
        }

        if (instance._monitorInterval) clearInterval(instance._monitorInterval);

        this.instances.delete(instance.id);
        await this.saveState();
        return true;
    }
}
