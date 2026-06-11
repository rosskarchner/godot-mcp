#!/usr/bin/env python3
"""Test project bootstrap (direct module test, no Godot instance needed)."""

import asyncio
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from godot_mcp.project_bootstrap import bootstrap_project

TEST_PROJECT_PATH = Path(__file__).resolve().parent / "test_godot_project"


async def main():
    print("Testing project bootstrap...")
    print(f"Creating test project at: {TEST_PROJECT_PATH}")

    try:
        shutil.rmtree(TEST_PROJECT_PATH, ignore_errors=True)

        print("\n=== Test 1: Bootstrap with GUT ===")
        result = await bootstrap_project(
            str(TEST_PROJECT_PATH), project_name="Test Project", include_gut=True)
        print("Result:", json.dumps(result, indent=2))

        project_godot = (TEST_PROJECT_PATH / "project.godot").read_text()
        print("\nproject.godot content:")
        print(project_godot)

        assert 'config/name="Test Project"' in project_godot
        test_dir_exists = (TEST_PROJECT_PATH / "test" / "unit").is_dir()
        gut_config_exists = (TEST_PROJECT_PATH / ".gutconfig.json").is_file()
        gut_addon_exists = (TEST_PROJECT_PATH / "addons" / "gut" / "plugin.cfg").is_file()
        print(f"\nTest directory exists: {test_dir_exists}")
        print(f"GUT config exists: {gut_config_exists}")
        print(f"GUT addon downloaded: {gut_addon_exists}")
        assert test_dir_exists and gut_config_exists

        shutil.rmtree(TEST_PROJECT_PATH, ignore_errors=True)
        print("\n✅ Test passed! Cleaned up test project.")
    except Exception as e:
        print(f"❌ Test failed: {e}")
        shutil.rmtree(TEST_PROJECT_PATH, ignore_errors=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
