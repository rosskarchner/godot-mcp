"""Bootstrap new Godot projects with optional GUT (Godot Unit Testing) support."""

import io
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import httpx


def log(*args):
    print(*args, file=sys.stderr, flush=True)


def detect_godot_version() -> str | None:
    """Detect the Godot version from the godot binary in PATH (e.g. '4.5')."""
    try:
        result = subprocess.run(["godot", "--version"], capture_output=True,
                                text=True, timeout=30)
        match = re.match(r"^(\d+\.\d+)", result.stdout.strip())
        if match:
            return match.group(1)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return None


async def bootstrap_project(project_path: str, project_name: str | None = None,
                            godot_version: str | None = None, include_gut: bool = False,
                            gut_version: str = "9.5.1") -> dict:
    if not godot_version:
        godot_version = detect_godot_version() or "4.5"

    project_dir = Path(project_path)
    project_name = project_name or project_dir.name

    project_dir.mkdir(parents=True, exist_ok=True)

    entries = [p.name for p in project_dir.iterdir()]
    if "project.godot" in entries:
        raise FileExistsError(f"Godot project already exists at: {project_path}")
    if entries:
        log(f"Warning: Directory is not empty. Bootstrapping in existing directory: {project_path}")

    created_files = []
    try:
        (project_dir / "project.godot").write_text(
            generate_project_godot(project_name, godot_version, include_gut))
        created_files.append("project.godot")

        (project_dir / "icon.svg").write_text(generate_default_icon())
        created_files.append("icon.svg")

        (project_dir / "scenes").mkdir(exist_ok=True)
        (project_dir / "scripts").mkdir(exist_ok=True)
        created_files += ["scenes/", "scripts/"]

        (project_dir / ".gitignore").write_text(generate_gitignore())
        created_files.append(".gitignore")

        if include_gut:
            await setup_gut(project_dir, gut_version)
            created_files += ["test/", ".gutconfig.json", "addons/gut/"]

        return {
            "success": True,
            "projectPath": str(project_dir),
            "projectName": project_name,
            "createdFiles": created_files,
            "includesGUT": include_gut,
            "message": f"Successfully bootstrapped Godot project at {project_path}",
        }
    except Exception:
        shutil.rmtree(project_dir, ignore_errors=True)
        raise


def generate_project_godot(project_name: str, godot_version: str, include_gut: bool) -> str:
    content = f"""; Engine configuration file.
; It's best edited using the editor UI and not directly,
; since the parameters that go here are not all obvious.
;
; Format:
;   [section] ; section goes between []
;   param=value ; assign values to parameters

config_version=5

[application]

config/name="{project_name}"
config/features=PackedStringArray("{godot_version}")
config/icon="res://icon.svg"
"""
    if include_gut:
        content += """
[editor_plugins]

enabled=PackedStringArray("res://addons/gut/plugin.cfg")
"""
    return content


def generate_default_icon() -> str:
    # Simplified version of Godot's default icon
    return """<svg height="128" width="128" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#363d52" height="128" rx="6.4" width="128"/>
  <g transform="scale(.101) translate(122 122)">
    <g fill="#fff">
      <path d="m464 428c0 22-18 40-40 40h-336c-22 0-40-18-40-40v-336c0-22 18-40 40-40h336c22 0 40 18 40 40z"/>
      <path d="m672 96v336c0 44-36 80-80 80h-16c0 44-36 80-80 80h-336c-44 0-80-36-80-80v-336c0-44 36-80 80-80h16c0-44 36-80 80-80h336c44 0 80 36 80 80z" fill="none" stroke="#fff" stroke-width="40"/>
    </g>
  </g>
</svg>"""


def generate_gitignore() -> str:
    return """# Godot 4+ specific ignores
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
"""


async def setup_gut(project_dir: Path, gut_version: str):
    test_dir = project_dir / "test" / "unit"
    test_dir.mkdir(parents=True, exist_ok=True)

    gut_config = {
        "dirs": ["res://test/unit/"],
        "double_strategy": "partial",
        "ignore_pause": False,
        "include_subdirs": True,
        "inner_class": "",
        "log_level": 1,
        "opacity": 100,
        "prefix": "test_",
        "selected": "",
        "should_exit": False,
        "should_maximize": False,
        "suffix": ".gd",
        "tests": [],
        "unit_test_name": "",
    }
    (project_dir / ".gutconfig.json").write_text(json.dumps(gut_config, indent=2))

    sample_test = """extends GutTest

# This is an example test file
# GUT will automatically discover and run tests in files matching the pattern test_*.gd

func test_example_assertion():
    # Basic assertion examples
    assert_true(true, "This should pass")
    assert_eq(2 + 2, 4, "Math should work")

func test_example_failing():
    # This test is pending and won't run
    pending("Implement this test later")
"""
    (test_dir / "test_example.gd").write_text(sample_test)

    await download_gut(project_dir, gut_version)


async def download_gut(project_dir: Path, version: str):
    addons_dir = project_dir / "addons"
    addons_dir.mkdir(exist_ok=True)

    readme_path = addons_dir / "GUT_INSTALLATION.md"
    readme_path.write_text(f"""# GUT Installation

To complete the GUT setup:

1. Download GUT {version} from: https://github.com/bitwes/Gut/releases/tag/v{version}
2. Extract the `addons/gut` directory from the zip file
3. Copy it to: {addons_dir}/gut/
4. Restart Godot to enable the plugin

Alternatively, you can install GUT via the AssetLib in Godot Editor.

Once installed, run tests with:
- From Editor: Go to the "GUT" panel at the bottom
- From Command Line: `godot --path . -s addons/gut/gut_cmdln.gd`
""")

    try:
        url = f"https://github.com/bitwes/Gut/archive/refs/tags/v{version}.zip"
        async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
            response = await client.get(url)
            response.raise_for_status()

        extract_dir = project_dir / "gut_extract"
        with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
            zf.extractall(extract_dir)

        gut_source = extract_dir / f"Gut-{version}" / "addons" / "gut"
        shutil.copytree(gut_source, addons_dir / "gut")

        shutil.rmtree(extract_dir, ignore_errors=True)
        readme_path.unlink(missing_ok=True)  # Instructions unnecessary on success
    except Exception as e:
        log(f"Could not auto-download GUT. Manual installation required. {e}")
        # Instructions file already created above
