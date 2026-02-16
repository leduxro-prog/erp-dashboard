# Claude Community Skills Index

This directory contains a comprehensive collection of community-created skills for Claude Code.

## Core Requested Skills

### 1. **obra/superpowers** - Agentic Skills Framework
- **Repository**: https://github.com/obra/superpowers
- **Files**: README.md (6.1K), SKILL-brainstorming.md
- **Description**: Complete software development workflow for AI coding agents with composable skills
- **Key Features**:
  - Seven sequential workflow stages (Brainstorming → Git Setup → Planning → Implementation → Testing → Review → Completion)
  - Automatic skill triggering based on context
  - Subagent-driven development with concurrent task handling
  - Test-first methodology with red-green-refactor cycles
  - Systematic debugging with four-phase root cause analysis

### 2. **lackeyjb/playwright-skill** - Browser Automation
- **Repository**: https://github.com/lackeyjb/playwright-skill
- **Files**: SKILL.md (14K), README.md (8.4K)
- **Location**: `skills/playwright-skill/`
- **Description**: Complete browser automation using Playwright
- **Capabilities**:
  - Auto-detects dev servers
  - Writes clean test scripts
  - Tests pages, fills forms, takes screenshots
  - Responsive design validation
  - Login flow testing
  - Link validation
  - General browser task automation

### 3. **trailofbits/skills** - Security Skills Marketplace
- **Repository**: https://github.com/trailofbits/skills
- **Files**: README.md (5.1K)
- **Description**: 25+ specialized security analysis and testing tools
- **Categories**:
  - Smart Contract Security (6 blockchains)
  - Code Auditing
  - Static Analysis (CodeQL, Semgrep, SARIF)
  - Verification
  - Malware Analysis (YARA)
  - Reverse Engineering (DWARF)
  - Mobile Security (Android APK)
  - Development Tools
  - Team Management

### 4. **chrisvoncsefalvay/claude-d3js-skill** - Data Visualization
- **Repository**: https://github.com/chrisvoncsefalvay/claude-d3js-skill
- **Files**: SKILL.md (22K)
- **Description**: Interactive data visualization using d3.js
- **Use Cases**:
  - Custom charts and graphs
  - Network diagrams
  - Geographic visualizations
  - Complex SVG-based visualizations
  - Interactive explorations
  - Publication-quality graphics

### 5. **K-Dense-AI/claude-scientific-skills** - Scientific Computing
- **Repository**: https://github.com/K-Dense-AI/claude-scientific-skills
- **Files**: README.md (33K, comprehensive guide)
- **Description**: 140 ready-to-use scientific skills
- **Domains**:
  - Bioinformatics & Genomics
  - Cheminformatics & Drug Discovery
  - Proteomics & Mass Spectrometry
  - Clinical Research & Precision Medicine
  - Data Analysis & Visualization

### 6. **alonw0/web-asset-generator** - Web Asset Generation
- **Repository**: https://github.com/alonw0/web-asset-generator
- **Files**: SKILL.md (26K), README.md (9.0K)
- **Location**: `skills/web-asset-generator/`
- **Description**: Automatic generation of web assets
- **Features**:
  - Favicon generation
  - App icons (PWA)
  - Social media meta images (Open Graph)
  - Emoji support (60+ curated)
  - Automatic resizing
  - Text-to-image generation
  - HTML meta tag generation

### 7. **conorluddy/ios-simulator-skill** - iOS Testing & Automation
- **Repository**: https://github.com/conorluddy/ios-simulator-skill
- **Files**: README.md (9.9K)
- **Description**: Production-ready iOS simulator automation
- **Features**:
  - 21 optimized scripts
  - Semantic navigation (96% token reduction)
  - Accessibility-first automation
  - Build & development scripts
  - Navigation & interaction tools
  - Testing & analysis
  - Device lifecycle management
  - macOS 12+, Xcode Command Line Tools required

### 8. **asklokesh/claudeskill-loki-mode** - Multi-Agent Autonomous System
- **Repository**: https://github.com/asklokesh/claudeskill-loki-mode
- **Files**: SKILL.md (9.9K)
- **Description**: Autonomous startup builder from PRD to deployment
- **Capabilities**:
  - 41 specialized AI agent types across 7 swarms
  - RARV cycle (Reason-Act-Reflect-Verify)
  - Multi-provider support (Claude, Codex, Gemini)
  - Parallel agent orchestration
  - HumanEval: 98.78% Pass@1
  - SWE-bench: 99.67% patch generation
  - Zero human intervention (with --dangerously-skip-permissions)

## Additional Skills Discovered

During the fetch process, several additional community skills were found and saved:

- **algorithmic-art** - Algorithmic art generation
- **brand-guidelines** - Brand identity and guidelines
- **canvas-design** - Canvas-based design
- **frontend-design** - Frontend UI/UX design
- **mcp-builder** - MCP (Model Context Protocol) builder
- **slack-gif-creator** - Animated GIF creation for Slack
- **web-artifacts-builder** - Web artifact generation
- **webapp-testing** - Web application testing

## Installation Methods

### Via Plugin Marketplace
```bash
/plugin marketplace add <org>/<repo>
```

### Manual Installation
1. Clone repository into `~/.claude/skills/<skill-name>/`
2. Restart Claude Code
3. Skill auto-loads from SKILL.md

### Project-Specific
Place skills in `<project>/.claude/skills/` directory

## Technical Notes

- **Path Resolution**: Skills can be installed in multiple locations (plugin system, global, project-specific)
- **Execution**: Most skills use universal executors (bash, node, python)
- **Dependencies**: Vary by skill (Python 3.6+, Node.js, Xcode CLI, etc.)
- **Permissions**: Some skills require explicit user approval (Loki Mode: `--dangerously-skip-permissions`)

## Statistics

- **Total Skills**: 16+ (8 primary + 8+ additional)
- **Total Documentation**: 25 files
- **Combined Size**: 228 KB
- **Coverage**: Browser automation, security, visualization, scientific computing, iOS testing, web assets, startup building, and more

## File Organization

```
.claude/skills/
├── obra-superpowers/
├── playwright-skill/
├── trailofbits-skills/
├── claude-d3js-skill/
├── claude-scientific-skills/
├── web-asset-generator/
├── ios-simulator-skill/
├── loki-mode/
└── [additional skills]/
```

## Getting Started

1. Choose a skill matching your needs
2. Review SKILL.md for detailed documentation
3. Install via marketplace or manually
4. Follow the skill-specific workflow in SKILL.md
5. Execute Claude commands as specified

---

*Last Updated: February 7, 2026*  
*Source: Community Claude Skills Repositories*
