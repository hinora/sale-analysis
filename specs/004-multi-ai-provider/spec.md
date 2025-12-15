# Feature Specification: Multi AI Provider Support

**Feature Branch**: `004-multi-ai-provider`  
**Created**: December 8, 2025  
**Status**: Draft  
**Input**: User description: "Currently using Ollama as our AI API. Now want to use Gemini too. Update current AI struct into mapper config based. Then we can switch AI provider by env config."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch AI Provider via Environment Configuration (Priority: P1)

As a system administrator, I want to switch between AI providers (Ollama or Gemini) by changing an environment variable, so that I can use different AI backends without code changes.

**Why this priority**: This is the core capability that enables the multi-provider architecture. Without this, users cannot benefit from having multiple AI providers available.

**Independent Test**: Can be fully tested by setting `AI_PROVIDER=gemini` or `AI_PROVIDER=ollama` in environment variables and verifying the correct provider handles AI queries.

**Acceptance Scenarios**:

1. **Given** the environment variable `AI_PROVIDER=ollama` is set, **When** the application starts, **Then** all AI queries are processed using the Ollama provider
2. **Given** the environment variable `AI_PROVIDER=gemini` is set, **When** the application starts, **Then** all AI queries are processed using the Gemini provider
3. **Given** no `AI_PROVIDER` environment variable is set, **When** the application starts, **Then** the system defaults to Ollama provider for backward compatibility
4. **Given** an invalid `AI_PROVIDER` value is set, **When** the application starts, **Then** the system logs a warning and falls back to the default provider

---

### User Story 2 - Query AI Using Gemini Provider (Priority: P1)

As an analyst, I want to query my transaction data using Google Gemini AI when Gemini is configured, so that I can leverage Gemini's capabilities for data analysis.

**Why this priority**: Without Gemini integration working properly, there's no value in having multi-provider support.

**Independent Test**: Can be tested by configuring Gemini as the provider and executing natural language queries against transaction data, verifying responses are generated correctly.

**Acceptance Scenarios**:

1. **Given** Gemini is configured as the AI provider with valid API key, **When** user submits a query about transaction data, **Then** Gemini processes the query and returns analysis results
2. **Given** Gemini is configured but API key is missing or invalid, **When** user submits a query, **Then** the system displays a clear error message about authentication failure
3. **Given** Gemini is configured, **When** user asks for data aggregations, **Then** the response includes relevant citations and confidence levels

---

### User Story 3 - Configure Provider-Specific Settings (Priority: P2)

As a system administrator, I want to configure provider-specific settings (like model name, API keys, temperature) per provider, so that each provider can be optimized for my use case.

**Why this priority**: Different providers have different configuration needs; this enables proper tuning but isn't strictly required for basic functionality.

**Independent Test**: Can be tested by setting provider-specific environment variables and verifying each provider uses its respective configuration.

**Acceptance Scenarios**:

1. **Given** Ollama-specific settings are configured (host URL, model name), **When** Ollama is active, **Then** it uses those specific settings
2. **Given** Gemini-specific settings are configured (API key, model name), **When** Gemini is active, **Then** it uses those specific settings
3. **Given** a provider is configured with custom temperature and context window settings, **When** queries are processed, **Then** the provider uses those custom settings

---

### User Story 4 - Health Check for Active Provider (Priority: P2)

As a system administrator, I want to verify the active AI provider is healthy and reachable, so that I can diagnose connectivity issues quickly.

**Why this priority**: Operational visibility is important but not critical for core functionality.

**Independent Test**: Can be tested by calling a health check endpoint and verifying it reports the status of the configured provider.

**Acceptance Scenarios**:

1. **Given** Ollama is configured and running, **When** health check is requested, **Then** system reports healthy status with provider name
2. **Given** Gemini is configured with valid credentials, **When** health check is requested, **Then** system reports healthy status with provider name
3. **Given** the configured provider is unreachable, **When** health check is requested, **Then** system reports unhealthy status with error details

---

### Edge Cases

- What happens when switching providers mid-session? System should use the configured provider at startup time; runtime switching requires restart.
- How does the system handle provider rate limiting? Provider implementations should surface rate limit errors clearly to users.
- What happens if Gemini API quota is exceeded? System displays quota-exceeded error and suggests checking billing/quota settings.
- How does the system handle network timeouts to providers? Each provider should have configurable timeout settings with sensible defaults.
- What happens when any provider fails (network, rate limit, outage)? System fails the request with a clear error message; no automatic fallback to another provider.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support Ollama as an AI provider
- **FR-002**: System MUST support Google Gemini as an AI provider
- **FR-003**: System MUST allow selecting the active AI provider via `AI_PROVIDER` environment variable
- **FR-004**: System MUST default to Ollama provider when `AI_PROVIDER` is not set (backward compatibility)
- **FR-005**: System MUST validate the `AI_PROVIDER` value and log warnings for invalid values
- **FR-006**: All AI providers MUST implement a common interface for generating responses
- **FR-007**: All AI providers MUST implement a health check capability
- **FR-008**: System MUST support provider-specific configuration via environment variables:
  - Ollama: `OLLAMA_HOST`, `AI_MODEL` (existing behavior)
  - Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`
- **FR-009**: System MUST handle authentication failures gracefully with clear error messages
- **FR-010**: System MUST preserve existing query response format regardless of provider (answer, citations, confidence, processingTime)

### Key Entities

- **AIProvider**: Abstract interface that defines the contract for AI providers (generate text, health check, list models)
- **OllamaProvider**: Concrete implementation for Ollama backend (existing functionality refactored)
- **GeminiProvider**: Concrete implementation using official Google Gemini SDK (not direct HTTP API calls)
- **ProviderConfig**: Configuration object holding provider-specific settings (host, API key, model, temperature, etc.)
- **ProviderRegistry**: Mapper/factory that resolves the correct provider based on configuration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Analysts can complete AI-powered queries within the same time tolerance regardless of which provider is configured (±20% response time variance acceptable)
- **SC-002**: System administrators can switch providers by changing one environment variable without any code modifications
- **SC-003**: 100% of existing Ollama functionality continues to work after refactoring (backward compatibility)
- **SC-004**: New provider onboarding requires implementing only the defined interface without modifying core query handling logic
- **SC-005**: Health check accurately reports provider status within 5 seconds of request

## Clarifications

### Session 2024-12-08

- Q: When Gemini API fails (network error, rate limit, or service outage), should the system automatically fallback to Ollama, or fail the request with an error message? → A: Fail request with clear error message (no automatic fallback)
- Q: What is the maximum acceptable response time for AI queries? → A: Use Gemini SDK/library instead of direct API calls

## Assumptions

- Google Gemini API key will be obtained separately by the user (not provisioned by this feature)
- Gemini API has sufficient quota for the expected query volume
- Network connectivity to Gemini API endpoints is available in the deployment environment
- The existing response format (answer, citations, confidence) is provider-agnostic and both providers can generate compatible responses
- Default model for Gemini will be `gemini-1.5-flash` (can be overridden via environment variable)
- Temperature and other generation parameters will have sensible defaults per provider
- Gemini integration will use the official Google Gen AI SDK (@google/genai) rather than direct HTTP API calls
