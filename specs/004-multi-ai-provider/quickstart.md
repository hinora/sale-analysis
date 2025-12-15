# Quickstart: Multi AI Provider Support

**Feature Branch**: `004-multi-ai-provider`  
**Last Updated**: December 8, 2025

## Overview

This feature enables switching between AI providers (Ollama and Gemini) via environment configuration. No code changes required to switch providers.

---

## Quick Configuration

### Option 1: Use Ollama (Default)

No configuration needed. The system defaults to Ollama.

```bash
# Optional - these are the defaults
AI_PROVIDER=ollama
OLLAMA_HOST=http://host.docker.internal:11434
AI_MODEL=deepseek-r1:1.5b
```

### Option 2: Use Gemini

```bash
# Required
AI_PROVIDER=gemini
GEMINI_API_KEY=your-api-key-here

# Optional
GEMINI_MODEL=gemini-2.5-flash  # Default if not set
```

---

## Step-by-Step Setup

### For Ollama (Local AI)

1. **Ensure Ollama is running** on your host machine:
   ```bash
   ollama serve
   ```

2. **Pull the model** (if not already):
   ```bash
   ollama pull deepseek-r1:1.5b  # Development
   # or
   ollama pull deepseek-r1:8b    # Production
   ```

3. **Configure environment** (docker-compose.yml):
   ```yaml
   environment:
     - AI_PROVIDER=ollama
     - OLLAMA_HOST=http://host.docker.internal:11434
     - AI_MODEL=deepseek-r1:1.5b
   ```

4. **Start the application**:
   ```bash
   docker-compose up
   ```

### For Gemini (Cloud AI)

1. **Get API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

2. **Configure environment** (docker-compose.yml):
   ```yaml
   environment:
     - AI_PROVIDER=gemini
     - GEMINI_API_KEY=your-api-key-here
     - GEMINI_MODEL=gemini-2.5-flash  # Optional
   ```

3. **Start the application**:
   ```bash
   docker-compose up
   ```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | No | `ollama` | Provider selection: `ollama` or `gemini` |
| `OLLAMA_HOST` | When Ollama | `http://ollama:11434` | Ollama server URL |
| `AI_MODEL` | No | `deepseek-r1:1.5b` | Model for Ollama |
| `GEMINI_API_KEY` | When Gemini | - | Google AI API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Model for Gemini |

---

## Verify Configuration

### Check Provider Status

After starting the application, verify the active provider:

```bash
# Health check endpoint
curl http://localhost:3000/api/ai/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-08T10:30:00.000Z",
  "provider": {
    "name": "ollama",
    "configured": "ollama",
    "healthy": true,
    "latencyMs": 45,
    "details": {
      "host": "http://host.docker.internal:11434",
      "defaultModel": "deepseek-r1:1.5b"
    }
  }
}
```

### Test AI Query

Navigate to the AI Analysis page and submit a test query to verify the provider is working correctly.

---

## Troubleshooting

### Ollama Connection Failed

**Symptom**: `CONNECTION_FAILED` error

**Solutions**:
1. Verify Ollama is running: `curl http://localhost:11434/api/tags`
2. Check `OLLAMA_HOST` is correct (use `host.docker.internal` for Docker)
3. Ensure the model is pulled: `ollama list`

### Gemini Authentication Failed

**Symptom**: `AUTH_FAILED` error

**Solutions**:
1. Verify API key is set: `echo $GEMINI_API_KEY`
2. Check API key is valid at [Google AI Studio](https://aistudio.google.com/)
3. Ensure no whitespace in the API key value

### Invalid Provider Value

**Symptom**: Warning in logs, falls back to Ollama

**Solution**: Set `AI_PROVIDER` to exactly `ollama` or `gemini` (lowercase)

---

## Development vs Production

| Setting | Development | Production |
|---------|-------------|------------|
| `AI_PROVIDER` | `ollama` | `ollama` or `gemini` |
| `AI_MODEL` | `deepseek-r1:1.5b` | `deepseek-r1:8b` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | `gemini-2.5-flash` |

---

## Common Use Cases

### Switch from Ollama to Gemini

1. Stop the application
2. Update environment:
   ```bash
   export AI_PROVIDER=gemini
   export GEMINI_API_KEY=your-api-key
   ```
3. Restart the application

### Use Different Gemini Model

```bash
export GEMINI_MODEL=gemini-2.5-pro  # For complex reasoning
```

### Use Production Ollama Model

```bash
export AI_MODEL=deepseek-r1:8b
```

---

## Security Notes

- **Never commit API keys** to version control
- Use `.env` files or secrets management for `GEMINI_API_KEY`
- Gemini API key should only be used server-side (not exposed to browser)
