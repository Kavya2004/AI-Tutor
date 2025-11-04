// Environment variable validation and security checks
import fs from 'fs';
import path from 'path';

// Required environment variables with validation rules
const ENV_REQUIREMENTS = {
    GEMINI_API_KEY: {
        required: true,
        minLength: 30,
        pattern: /^AIza[0-9A-Za-z_-]{35}$/,
        description: 'Google Gemini API key'
    },
    MATHPIX_APP_ID: {
        required: true,
        minLength: 10,
        pattern: /^[a-zA-Z0-9_]+$/,
        description: 'Mathpix application ID'
    },
    MATHPIX_APP_KEY: {
        required: true,
        minLength: 32,
        pattern: /^[a-fA-F0-9]{64}$/,
        description: 'Mathpix application key'
    },
    GOOGLE_CSE_API_KEY: {
        required: false,
        minLength: 30,
        pattern: /^AIza[0-9A-Za-z_-]{35}$/,
        description: 'Google Custom Search API key (optional)'
    },
    GOOGLE_CSE_ID: {
        required: false,
        minLength: 10,
        pattern: /^[a-zA-Z0-9:]+$/,
        description: 'Google Custom Search Engine ID (optional)'
    }
};

// Validate environment variables
export function validateEnvironment() {
    const results = {
        valid: true,
        errors: [],
        warnings: [],
        missing: [],
        invalid: []
    };

    for (const [key, requirements] of Object.entries(ENV_REQUIREMENTS)) {
        const value = process.env[key];

        if (!value) {
            if (requirements.required) {
                results.errors.push(`Missing required environment variable: ${key} (${requirements.description})`);
                results.missing.push(key);
                results.valid = false;
            } else {
                results.warnings.push(`Optional environment variable not set: ${key} (${requirements.description})`);
            }
            continue;
        }

        // Check minimum length
        if (value.length < requirements.minLength) {
            results.errors.push(`${key} is too short (minimum ${requirements.minLength} characters)`);
            results.invalid.push(key);
            results.valid = false;
            continue;
        }

        // Check pattern if specified
        if (requirements.pattern && !requirements.pattern.test(value)) {
            results.errors.push(`${key} format is invalid`);
            results.invalid.push(key);
            results.valid = false;
            continue;
        }

        // Additional security checks
        if (value.includes(' ') || value.includes('\n') || value.includes('\t')) {
            results.errors.push(`${key} contains invalid whitespace characters`);
            results.invalid.push(key);
            results.valid = false;
        }
    }

    return results;
}

// Runtime API key validation (for use in API endpoints)
export function validateRuntimeKeys(requiredKeys = []) {
    const results = { valid: true, errors: [] };
    
    for (const key of requiredKeys) {
        const value = process.env[key];
        const requirements = ENV_REQUIREMENTS[key];
        
        if (!value) {
            results.valid = false;
            results.errors.push(`Missing API key: ${key}`);
            continue;
        }
        
        if (requirements) {
            if (value.length < requirements.minLength) {
                results.valid = false;
                results.errors.push(`Invalid API key format: ${key}`);
            }
            
            if (requirements.pattern && !requirements.pattern.test(value)) {
                results.valid = false;
                results.errors.push(`Invalid API key pattern: ${key}`);
            }
        }
    }
    
    return results;
}