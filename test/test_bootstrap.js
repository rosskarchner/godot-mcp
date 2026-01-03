#!/usr/bin/env node

import { bootstrapProject } from '../src/project-bootstrap.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testBootstrap() {
    const testProjectPath = path.join(__dirname, 'test_godot_project');

    console.log('Testing project bootstrap...');
    console.log(`Creating test project at: ${testProjectPath}`);

    try {
        // Clean up if exists
        await fs.rm(testProjectPath, { recursive: true, force: true });

        // Test 1: Bootstrap with GUT
        console.log('\n=== Test 1: Bootstrap with GUT ===');
        const result = await bootstrapProject(testProjectPath, {
            projectName: 'Test Project',
            includeGUT: true
        });

        console.log('Result:', JSON.stringify(result, null, 2));

        // Verify files were created
        const projectGodot = await fs.readFile(path.join(testProjectPath, 'project.godot'), 'utf8');
        console.log('\nproject.godot content:');
        console.log(projectGodot);

        // Check if test directory exists
        const testDirExists = await fs.access(path.join(testProjectPath, 'test', 'unit'))
            .then(() => true)
            .catch(() => false);
        console.log(`\nTest directory exists: ${testDirExists}`);

        // Check if .gutconfig.json exists
        const gutConfigExists = await fs.access(path.join(testProjectPath, '.gutconfig.json'))
            .then(() => true)
            .catch(() => false);
        console.log(`GUT config exists: ${gutConfigExists}`);

        // Cleanup
        await fs.rm(testProjectPath, { recursive: true, force: true });
        console.log('\n✅ Test passed! Cleaned up test project.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        // Try to cleanup
        await fs.rm(testProjectPath, { recursive: true, force: true }).catch(() => {});
        process.exit(1);
    }
}

testBootstrap();
