#!/usr/bin/env node

// Security test script for AI Tutor
// Run with: node test-security.js

import { config } from 'dotenv';
config();

import { validateEnvironment } from './config/env-validator.js';
import { checkRateLimit, sanitizeInput, validateRequest } from './middleware/security.js';

console.log('🔒 AI Tutor Security Test\n');

// Test 1: Environment Validation
console.log('1. Testing Environment Validation...');
try {
    const envResult = validateEnvironment();
    if (envResult.valid) {
        console.log('   ✅ Environment validation passed');
    } else {
        console.log('   ❌ Environment validation failed:');
        envResult.errors.forEach(error => console.log(`      - ${error}`));
    }
    
    if (envResult.warnings.length > 0) {
        console.log('   ⚠️  Warnings:');
        envResult.warnings.forEach(warning => console.log(`      - ${warning}`));
    }
} catch (error) {
    console.log(`   ❌ Environment test error: ${error.message}`);
}

// Test 2: Input Sanitization
console.log('\n2. Testing Input Sanitization...');
try {
    const testInputs = [
        'Normal string',
        'A'.repeat(20000), // Long string
        ['item1', 'item2', 'item3'],
        { key: 'value', nested: { data: 'test' } },
        null,
        undefined
    ];
    
    testInputs.forEach((input, index) => {
        const sanitized = sanitizeInput(input);
        console.log(`   Test ${index + 1}: ${typeof input} -> ${typeof sanitized} ✅`);
    });
} catch (error) {
    console.log(`   ❌ Sanitization test error: ${error.message}`);
}

// Test 3: Request Validation
console.log('\n3. Testing Request Validation...');
try {
    const mockRequests = [
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: { messages: ['test'] }
        },
        {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: { messages: ['test'] }
        },
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: {}
        }
    ];
    
    mockRequests.forEach((req, index) => {
        const result = validateRequest(req, ['messages']);
        const status = result.valid ? '✅' : '❌';
        console.log(`   Request ${index + 1}: ${status} (${result.errors.length} errors)`);
        if (result.errors.length > 0) {
            result.errors.forEach(error => console.log(`      - ${error}`));
        }
    });
} catch (error) {
    console.log(`   ❌ Request validation test error: ${error.message}`);
}

// Test 4: Rate Limiting
console.log('\n4. Testing Rate Limiting...');
try {
    const mockReq = {
        headers: {},
        connection: { remoteAddress: '127.0.0.1' }
    };
    
    // Test multiple requests
    for (let i = 1; i <= 3; i++) {
        const result = checkRateLimit('gemini', mockReq);
        const status = result.allowed ? '✅' : '❌';
        console.log(`   Request ${i}: ${status} (${result.remaining || 0} remaining)`);
    }
} catch (error) {
    console.log(`   ❌ Rate limiting test error: ${error.message}`);
}

console.log('\n🎉 Security tests completed!');

// Show loaded environment status
const hasGemini = !!process.env.GEMINI_API_KEY;
const hasMathpix = !!process.env.MATHPIX_APP_ID && !!process.env.MATHPIX_APP_KEY;
console.log(`\nEnvironment Status:`);
console.log(`- Gemini API: ${hasGemini ? '✅ Loaded' : '❌ Missing'}`);
console.log(`- Mathpix API: ${hasMathpix ? '✅ Loaded' : '❌ Missing'}`);

console.log('\nNext steps:');
console.log('1. Ensure your .env file has valid API keys');
console.log('2. Test your API endpoints with a tool like curl or Postman');
console.log('3. Monitor logs for any security warnings');
console.log('4. Review SECURITY.md for best practices');