# Web Application Testing Toolkit Summary

This toolkit enables automated testing of local web applications using Python and Playwright. Here's what you need to know:

## Core Purpose
The toolkit helps verify frontend functionality, debug UI behavior, capture screenshots, and view browser logs for locally-running web applications.

## Key Helper Script
**`scripts/with_server.py`** manages server lifecycle, supporting single or multiple concurrent servers. Always run with `--help` first to understand usage before examining source code.

## Workflow Decision Tree
The documentation recommends:
- For static HTML: Read files directly to find selectors, then write Playwright scripts
- For dynamic apps: Start servers via the helper script, then use reconnaissance (screenshots/DOM inspection) before executing automation actions

## Critical Practice
"Wait for `page.wait_for_load_state('networkidle')`" before inspecting dynamic content—this ensures JavaScript execution completes before your script attempts to locate elements.

## Implementation Pattern
Launch Chromium in headless mode, navigate to your local server URL, wait for network idle, then execute automation logic using discovered selectors.

## Best Practices
Treat bundled scripts as self-contained tools rather than reading their source code. Use descriptive selectors (text, role, CSS, IDs) and appropriate waits to handle asynchronous page behavior reliably.