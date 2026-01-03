import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Detects the Godot version from the godot binary in PATH
 * @returns {Promise<string|null>} Version string or null if not found
 */
async function detectGodotVersion() {
    try {
        const { stdout } = await execFileAsync('godot', ['--version']);
        // Parse version from output like "4.5.0.stable.official.abcd1234"
        const match = stdout.trim().match(/^(\d+\.\d+)/);
        if (match) {
            return match[1]; // Returns "4.5" from "4.5.0.stable.official.abcd1234"
        }
    } catch (err) {
        // godot binary not found or failed to execute
        return null;
    }
    return null;
}

/**
 * Bootstraps a new Godot project with optional GUT (Godot Unit Testing) support
 * @param {string} projectPath - Absolute path where the project should be created
 * @param {object} options - Configuration options
 * @param {string} options.projectName - Name of the project
 * @param {string} options.godotVersion - Godot version (auto-detected from PATH if not provided)
 * @param {boolean} options.includeGUT - Whether to include GUT testing framework
 * @param {string} options.gutVersion - GUT version (defaults to "9.5.1" for Godot 4.x)
 * @returns {Promise<object>} Result with created files and configuration
 */
export async function bootstrapProject(projectPath, options = {}) {
    // Auto-detect Godot version if not provided
    let detectedVersion = options.godotVersion;
    if (!detectedVersion) {
        detectedVersion = await detectGodotVersion();
        if (!detectedVersion) {
            detectedVersion = "4.5"; // Fallback default
        }
    }

    const {
        projectName = path.basename(projectPath),
        godotVersion = detectedVersion,
        includeGUT = false,
        gutVersion = "9.5.1"
    } = options;

    // Check if directory exists
    try {
        await fs.access(projectPath);
        throw new Error(`Directory already exists: ${projectPath}`);
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }

    // Create project directory
    await fs.mkdir(projectPath, { recursive: true });

    const createdFiles = [];

    try {
        // 1. Create project.godot
        const projectGodotContent = generateProjectGodot(projectName, godotVersion, includeGUT);
        const projectGodotPath = path.join(projectPath, 'project.godot');
        await fs.writeFile(projectGodotPath, projectGodotContent);
        createdFiles.push('project.godot');

        // 2. Create basic icon.svg (Godot default)
        const iconPath = path.join(projectPath, 'icon.svg');
        await fs.writeFile(iconPath, generateDefaultIcon());
        createdFiles.push('icon.svg');

        // 3. Create basic directory structure
        await fs.mkdir(path.join(projectPath, 'scenes'), { recursive: true });
        await fs.mkdir(path.join(projectPath, 'scripts'), { recursive: true });
        createdFiles.push('scenes/');
        createdFiles.push('scripts/');

        // 4. Create .gitignore for Godot
        const gitignorePath = path.join(projectPath, '.gitignore');
        await fs.writeFile(gitignorePath, generateGitignore());
        createdFiles.push('.gitignore');

        // 5. Setup GUT if requested
        if (includeGUT) {
            await setupGUT(projectPath, gutVersion);
            createdFiles.push('test/');
            createdFiles.push('.gutconfig.json');
            createdFiles.push('addons/gut/');
        }

        return {
            success: true,
            projectPath,
            projectName,
            createdFiles,
            includesGUT: includeGUT,
            message: `Successfully bootstrapped Godot project at ${projectPath}`
        };

    } catch (error) {
        // Cleanup on failure
        try {
            await fs.rm(projectPath, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.error('Failed to cleanup after error:', cleanupErr);
        }
        throw error;
    }
}

/**
 * Generates the content for project.godot file
 */
function generateProjectGodot(projectName, godotVersion, includeGUT) {
    let content = `; Engine configuration file.
; It's best edited using the editor UI and not directly,
; since the parameters that go here are not all obvious.
;
; Format:
;   [section] ; section goes between []
;   param=value ; assign values to parameters

config_version=5

[application]

config/name="${projectName}"
config/features=PackedStringArray("${godotVersion}")
config/icon="res://icon.svg"
`;

    if (includeGUT) {
        content += `
[editor_plugins]

enabled=PackedStringArray("res://addons/gut/plugin.cfg")
`;
    }

    return content;
}

/**
 * Generates a basic Godot icon.svg
 */
function generateDefaultIcon() {
    // This is a simplified version of Godot's default icon
    return `<svg height="128" width="128" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#363d52" height="128" rx="6.4" width="128"/>
  <g transform="scale(.101) translate(122 122)">
    <g fill="#fff">
      <path d="m464 428c0 22-18 40-40 40h-336c-22 0-40-18-40-40v-336c0-22 18-40 40-40h336c22 0 40 18 40 40z"/>
      <path d="m672 96v336c0 44-36 80-80 80h-16c0 44-36 80-80 80h-336c-44 0-80-36-80-80v-336c0-44 36-80 80-80h16c0-44 36-80 80-80h336c44 0 80 36 80 80z" fill="none" stroke="#fff" stroke-width="40"/>
    </g>
  </g>
</svg>`;
}

/**
 * Generates .gitignore for Godot projects
 */
function generateGitignore() {
    return `# Godot 4+ specific ignores
.godot/

# Godot-specific ignores
.import/
export.cfg
export_presets.cfg

# Imported translations (automatically generated from CSV files)
*.translation

# Mono-specific ignores
.mono/
data_*/
mono_crash.*.json

# System/tool-specific ignores
.DS_Store
*~
`;
}

/**
 * Sets up GUT (Godot Unit Testing) in the project
 */
async function setupGUT(projectPath, gutVersion) {
    // Create test directory
    const testDir = path.join(projectPath, 'test', 'unit');
    await fs.mkdir(testDir, { recursive: true });

    // Create .gutconfig.json
    const gutConfig = {
        dirs: ["res://test/unit/"],
        double_strategy: "partial",
        ignore_pause: false,
        include_subdirs: true,
        inner_class: "",
        log_level: 1,
        opacity: 100,
        prefix: "test_",
        selected: "",
        should_exit: false,
        should_maximize: false,
        suffix: ".gd",
        tests: [],
        unit_test_name: ""
    };

    await fs.writeFile(
        path.join(projectPath, '.gutconfig.json'),
        JSON.stringify(gutConfig, null, 2)
    );

    // Create a sample test file
    const sampleTestPath = path.join(testDir, 'test_example.gd');
    const sampleTestContent = `extends GutTest

# This is an example test file
# GUT will automatically discover and run tests in files matching the pattern test_*.gd

func test_example_assertion():
    # Basic assertion examples
    assert_true(true, "This should pass")
    assert_eq(2 + 2, 4, "Math should work")

func test_example_failing():
    # This test is pending and won't run
    pending("Implement this test later")
`;
    await fs.writeFile(sampleTestPath, sampleTestContent);

    // Download and extract GUT
    await downloadGUT(projectPath, gutVersion);
}

/**
 * Downloads GUT from GitHub releases
 */
async function downloadGUT(projectPath, version) {
    const addonsDir = path.join(projectPath, 'addons');
    await fs.mkdir(addonsDir, { recursive: true });

    // For now, we'll provide instructions to download manually
    // In a production version, we could use fetch/download libraries
    const readmePath = path.join(addonsDir, 'GUT_INSTALLATION.md');
    const instructions = `# GUT Installation

To complete the GUT setup:

1. Download GUT ${version} from: https://github.com/bitwes/Gut/releases/tag/v${version}
2. Extract the \`addons/gut\` directory from the zip file
3. Copy it to: ${addonsDir}/gut/
4. Restart Godot to enable the plugin

Alternatively, you can install GUT via the AssetLib in Godot Editor.

Once installed, run tests with:
- From Editor: Go to the "GUT" panel at the bottom
- From Command Line: \`godot --path . -s addons/gut/gut_cmdln.gd\`
`;

    await fs.writeFile(readmePath, instructions);

    // Try to download using curl/wget if available
    try {
        const gutZipUrl = `https://github.com/bitwes/Gut/archive/refs/tags/v${version}.zip`;
        const zipPath = path.join(projectPath, 'gut_temp.zip');

        // Try curl first
        try {
            await execFileAsync('curl', ['-L', '-o', zipPath, gutZipUrl]);
        } catch {
            // Fallback to wget
            await execFileAsync('wget', ['-O', zipPath, gutZipUrl]);
        }

        // Try to extract (requires unzip)
        try {
            const extractDir = path.join(projectPath, 'gut_extract');
            await execFileAsync('unzip', ['-q', zipPath, '-d', extractDir]);

            // Find and copy the addons/gut directory
            const gutSourceDir = path.join(extractDir, `Gut-${version}`, 'addons', 'gut');
            const gutDestDir = path.join(addonsDir, 'gut');

            // Use cp -r to copy recursively
            await execFileAsync('cp', ['-r', gutSourceDir, gutDestDir]);

            // Cleanup
            await fs.rm(zipPath, { force: true });
            await fs.rm(extractDir, { recursive: true, force: true });
            await fs.rm(readmePath, { force: true }); // Remove instructions since we succeeded

        } catch (extractErr) {
            console.error('Could not auto-extract GUT. Manual installation required.', extractErr);
        }
    } catch (downloadErr) {
        console.error('Could not auto-download GUT. Manual installation required.', downloadErr);
        // Instructions file already created above
    }
}
