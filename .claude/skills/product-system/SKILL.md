---
name: product-system
description: Use this skill when you need to preserve ProfitDash product logic, page roles, and conceptual consistency across the app.
---

# ProfitDash Product System Skill

Use this skill whenever you are:
- editing multiple pages
- changing page structure
- renaming sections
- adding new product flows
- unsure how a page should relate to another page

## Goal

Protect product coherence.
Do not let ProfitDash become a collection of disconnected pages.

## Core page roles

### Dashboard
Immediate operating layer.
Shows current performance, current issues, current engine actions.
Do not overload it with deep settings or strategic analysis.

### Campaigns
Operating list.
Must lead into Campaign Detail.

### Campaign Detail
Single-campaign operating layer.
Must connect performance, rules, assets, routes, metadata, and revenue events.

### Wizard
Creation flow only.
Should stay launch-oriented.

### Preview
Visual rendering check before launch.
Not a generic summary.
Must use real campaign context.

### Vault
Inventory of assets and routes.
Not dead storage.

### Transactions
Revenue signal from postbacks.
Not payments or invoices.

### Analytics
Strategic analysis layer.
Used to understand patterns and trends.
Not a live dashboard clone.

### Decision Rules
Engine logic controls.
Should be fully manageable on a dedicated page.

### Settings
Trust / control / defaults section.
Should be decomposed into sub-pages.

## Decision rules for page design

When working on a page, always ask:
1. What is this page's exact job?
2. What should the user do here?
3. What related pages should it link to?
4. What should NOT be on this page?

## Anti-patterns

Avoid:
- turning every page into a dashboard
- mixing strategic analysis with operational execution
- showing transactions like accounting data
- leaving assets disconnected from campaigns
- burying important decisions in tiny buttons
- making settings one giant monolithic form

## If a product decision is unclear

Choose the option that improves:
- clarity
- hierarchy
- system cohesion
- operational usefulness

Do not choose based only on visual novelty.
