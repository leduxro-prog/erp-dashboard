# Web Artifacts Builder Overview

This is a comprehensive toolkit for creating sophisticated Claude.ai HTML artifacts using modern frontend technologies.

## Core Purpose
The Web Artifacts Builder enables developers to construct "elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui)."

## Technology Stack
Projects leverage React 18, TypeScript, Vite, Parcel for bundling, Tailwind CSS, and shadcn/ui components—totaling 40+ pre-installed UI components with Radix UI dependencies included.

## Workflow Overview
The process follows five main phases:

1. **Initialize**: Run `scripts/init-artifact.sh` to scaffold a fully configured React project
2. **Develop**: Edit generated files to build your artifact
3. **Bundle**: Execute `scripts/bundle-artifact.sh` to consolidate everything into a single HTML file
4. **Share**: Display the bundled artifact to users
5. **Test** (optional): Validate functionality if needed

## Key Design Principle
The documentation emphasizes avoiding "what is often referred to as 'AI slop'" by steering clear of excessive centered layouts, purple gradients, uniform rounded corners, and Inter font usage.

## Notable Features
- Path aliases (`@/`) pre-configured
- Node 18+ compatibility with automatic Vite version detection
- Self-contained bundles with all dependencies inlined
- No source maps in production builds