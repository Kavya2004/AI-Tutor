# Security Implementation Guide

This document outlines the security measures implemented in the AI Tutor application to protect API keys and ensure safe operation.

## 🔒 Security Features Implemented

### 1. API Key Protection
- **Environment Variable Validation**: All API keys are validated for format and length
- **Runtime Key Checking**: Keys are verified before each API call
- **Secure Storage**: Keys stored in `.env` file (never in code)
- **No Logging**: API keys are never logged in full

### 2. Rate Limiting
- **Gemini API**: 10 requests per minute per client
- **OCR API**: 5 requests per minute per client  
- **Search API**: 20 requests per minute per client
- **Client Identification**: Uses IP address and headers
- **Automatic Cleanup**: Old rate limit data is cleaned periodically

### 3. Input Validation & Sanitization
- **Request Structure**: Validates required fields and content types
- **Input Sanitization**: Limits string lengths and array sizes
- **Body Size Limits**: Maximum 1MB request body size
- **Format Validation**: Checks data types and patterns

### 4. Error Handling
- **Secure Error Messages**: No sensitive data in error responses
- **Detailed Logging**: Errors logged securely for debugging
- **Production Mode**: Reduced error details in production

## 📁 File Structure

```
├── api/
│   ├── gemini.js          # Gemini API with security
│   ├── ocr.js             # OCR API with security
│   └── search.js          # Search API with security
├── middleware/
│   └── security.js        # Security middleware functions
├── config/
│   └── env-validator.js   # Environment validation
├── .env.example           # Secure environment template
├── .gitignore             # Security-focused exclusions
└── SECURITY.md            # This file
```

## 🚀 Setup Instructions

### 1. Environment Configuration
```bash
# Copy the example file
cp .env.example .env

# Edit with your actual API keys
nano .env

# Set secure file permissions
chmod 600 .env
```

### 2. Required API Keys

#### Gemini API Key (Required)
- Get from: https://makersuite.google.com/app/apikey
- Format: `AIza` followed by 35 characters
- Used for: AI chat responses

#### Mathpix Credentials (Required)
- Get from: https://mathpix.com/
- APP_ID: Alphanumeric with underscores
- APP_KEY: 64-character hexadecimal string
- Used for: OCR text extraction

#### Google Custom Search (Optional)
- Get from: https://developers.google.com/custom-search/v1/introduction
- Used for: Enhanced search functionality

### 3. Security Validation
The system automatically validates:
- ✅ API key presence and format
- ✅ Environment variable security
- ✅ Request rate limits
- ✅ Input sanitization

## 🛡️ Security Best Practices

### For Developers
1. **Never commit `.env` files** to version control
2. **Use different keys** for development and production
3. **Rotate API keys regularly** (monthly recommended)
4. **Monitor API usage** for unusual activity
5. **Keep dependencies updated** for security patches

### For Deployment
1. **Set environment variables** securely in production
2. **Use HTTPS** for all API communications
3. **Enable logging** for security monitoring
4. **Regular security audits** of API usage
5. **Backup and recovery** procedures for keys

## 🚨 Security Incident Response

If you suspect a security issue:

1. **Immediately rotate** all API keys
2. **Check logs** for unusual activity
3. **Update environment variables** in all environments
4. **Monitor API usage** for the next 24-48 hours
5. **Document the incident** for future reference

## 📊 Rate Limiting Details

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| `/api/gemini` | 10 req/min | 60s | AI responses |
| `/api/ocr` | 5 req/min | 60s | Image processing |
| `/api/search` | 20 req/min | 60s | Content search |

Rate limits are per client IP address and reset automatically.

## 🔍 Monitoring & Logging

### What's Logged
- API request timestamps
- Rate limit violations
- Validation failures
- Error messages (without sensitive data)

### What's NOT Logged
- Full API keys
- User personal data
- Request/response bodies with sensitive info

## 📞 Support

For security-related questions or issues:
1. Check this documentation first
2. Review error logs for specific issues
3. Verify API key configuration
4. Test with minimal examples

## 🔄 Updates

This security implementation is designed to be:
- **Non-breaking**: Existing functionality preserved
- **Transparent**: Security runs in background
- **Configurable**: Rate limits and validation can be adjusted
- **Maintainable**: Clear separation of security concerns

Last updated: January 2025