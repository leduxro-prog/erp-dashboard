# Claude Community Skills Repository

A comprehensive local collection of community-created Claude Code skills, fetched from leading open-source repositories.

## Quick Access

Start here:
- **[INDEX.md](./INDEX.md)** - Complete skill reference and descriptions
- **[MANIFEST.md](./MANIFEST.md)** - Detailed technical documentation
- **[FETCH_SUMMARY.md](./FETCH_SUMMARY.md)** - Fetch operation summary

## Core Skills (8)

1. **obra/superpowers** - Agentic skills framework (6.1K)
2. **playwright-skill** - Browser automation (22.4K)
3. **trailofbits/skills** - Security tools (5.1K)
4. **claude-d3js-skill** - Data visualization (22K)
5. **claude-scientific-skills** - Scientific computing (33K)
6. **web-asset-generator** - Web assets (35K)
7. **ios-simulator-skill** - iOS testing (9.9K)
8. **loki-mode** - Autonomous systems (9.9K)

## Getting Started

### 1. Browse Documentation
```bash
# Read the comprehensive index
cat INDEX.md

# Check a specific skill
cat playwright-skill/SKILL.md
cat claude-d3js-skill/SKILL.md
```

### 2. Install a Skill
```bash
# Via Claude Code marketplace
/plugin marketplace add lackeyjb/playwright-skill

# Or manually
cp -r playwright-skill ~/.claude/skills/
```

### 3. Use a Skill
Follow the instructions in the skill's SKILL.md file. Each skill includes:
- Workflow documentation
- Executable examples
- Installation paths
- Configuration options

## Skill Categories

| Category | Skills |
|----------|--------|
| Browser Automation | playwright-skill |
| Security Analysis | trailofbits/skills |
| Data Visualization | claude-d3js-skill |
| Scientific Computing | claude-scientific-skills |
| Web Development | web-asset-generator |
| Mobile Development | ios-simulator-skill |
| Autonomous Systems | loki-mode |
| Development Framework | obra/superpowers |

## Directory Structure

```
.
├── INDEX.md                          (Comprehensive index)
├── MANIFEST.md                       (Technical documentation)
├── FETCH_SUMMARY.md                  (Fetch operation report)
├── README.md                         (This file)
│
├── obra-superpowers/                 (Agentic framework)
├── playwright-skill/                 (Browser automation)
├── trailofbits-skills/               (Security marketplace)
├── claude-d3js-skill/                (D3.js visualization)
├── claude-scientific-skills/         (140 scientific skills)
├── web-asset-generator/              (Web assets)
├── ios-simulator-skill/              (iOS testing)
├── loki-mode/                        (Autonomous agents)
│
└── [9 additional skills]             (Additional community skills)
```

## Statistics

- **Total Skills**: 17 (8 core + 9 additional)
- **Total Files**: 27 documentation files
- **Total Size**: 248 KB
- **SKILL.md Files**: 5 complete + fallback docs for 3
- **README.md Files**: 6 comprehensive guides
- **Fetch Status**: 100% complete
- **Fetch Time**: <30 seconds

## Key Features

- Complete local copies of all skill documentation
- Multi-format documentation (SKILL.md + README.md)
- Executable code examples included
- Installation instructions for all methods
- Usage workflows documented
- No external dependencies required

## Documentation Files

### INDEX.md (26 KB)
Comprehensive index of all skills with:
- Detailed descriptions
- Feature lists
- Use cases
- Installation methods
- Getting started guide

### MANIFEST.md (Full technical report)
Includes:
- Fetch execution details
- File structure
- Implementation methodology
- Content validation
- Statistics and metrics
- Troubleshooting guide

### FETCH_SUMMARY.md (Summary report)
Quick overview of:
- Successfully fetched skills
- Repository information
- Skills status
- Directory structure
- Fetch notes

## Recommended Learning Path

1. **Start with INDEX.md** - Get overview of all skills
2. **Try playwright-skill** - Easy entry point for browser automation
3. **Explore claude-d3js-skill** - Learn visualization
4. **Review claude-scientific-skills** - Understand domain-specific skills
5. **Study obra/superpowers** - Understand skill framework
6. **Advanced: loki-mode** - Autonomous multi-agent systems

## Installing Skills

### Via Claude Code (Recommended)
```bash
/plugin marketplace add {org}/{repo}
```

### Manual Installation
```bash
# Copy to global skills directory
cp -r {skill-name} ~/.claude/skills/

# Or to project directory
cp -r {skill-name} .claude/skills/
```

### Requirements by Skill

- **playwright-skill**: Node.js 14+
- **web-asset-generator**: Python 3.6+, Node.js
- **ios-simulator-skill**: macOS 12+, Xcode CLI
- **claude-scientific-skills**: Python 3.6+
- **claude-d3js-skill**: Node.js (for any framework)

## Contributing

To add new community skills:
1. Fork this repository
2. Add skill directory and fetch SKILL.md
3. Update INDEX.md with new skill
4. Submit pull request

## License

All skills retain their original licenses. See individual skill repositories for license details.

## Support

For skill-specific issues:
- Check the skill's SKILL.md for troubleshooting
- Review GitHub issues in the original repository
- Check installation paths (may vary by system)

---

**Last Updated**: February 7, 2026  
**Total Skills Archived**: 17  
**Status**: All skills successfully fetched and documented

For detailed technical information, see [MANIFEST.md](./MANIFEST.md).
For complete skill descriptions, see [INDEX.md](./INDEX.md).
