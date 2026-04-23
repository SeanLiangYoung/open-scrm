---
name: html-editing
description: Edit existing HTML/CSS/JS files based on user change requests while preserving working structure, shared styles, relative paths, and local-preview behavior when possible. Use when the user wants to revise an existing static page, adjust sections, restyle components, replace copy, or evolve already-generated HTML rather than create a new site from scratch.
---

> Compatibility copy. Canonical source: `skills/html-editing/SKILL.md`.

# HTML Editing

Edit existing static sites with an `edit-first` mindset.

This skill is for changing pages that already exist. Preserve working structure, shared styling, relative paths, and local-preview behavior unless the user clearly asks for a broader redesign.

If the user is asking for a new site, a new page set, or there is no meaningful existing HTML to inherit from, do not use this skill. Use `website-generator` instead.

## When To Use

Use this skill when the user says things like:
- "edit this html"
- "modify the existing page"
- "keep the current site, just change..."
- "update the hero / CTA / footer"
- "restyle this site without rebuilding everything"
- "replace the phone number everywhere"
- "rename this product across the site"

## Default Behavior

- Prefer targeted edits over rewrites.
- Keep existing file paths unless the user explicitly asks to restructure.
- Reuse existing shared CSS, classes, and assets before introducing new ones.
- Preserve relative paths so pages still work when opened locally.
- Keep changes proportional to the request.

## Editing Workflow

### 1. Read the real surface area first

Before editing, identify:
- The page the user is looking at
- Shared CSS or JS files
- Shared header, footer, navigation, CTA, and legal links
- Repeated visible content on the current page
- Repeated visible content across the site

Do not assume a change is local just because the user mentioned one page.

### 2. Classify the requested change

Classify the request along both axes:

**Scope**
- `local`: only affects one page or one page-specific section
- `shared`: affects repeated content, shared styles, or site-wide entities

**Change type**
- `copy-edit`: wording, labels, contact details, product names
- `style-edit`: colors, spacing, radius, shadows, typography, button/card styling
- `layout-edit`: reorder, add, or remove sections while keeping the page identity
- `structural-rewrite`: rewrite a section or whole page because the current structure no longer fits

### 3. Choose the smallest valid edit level

Apply this order:
1. `edit-first`: patch the existing HTML/CSS/JS in place
2. `rewrite-section`: rewrite one section if patching would create inconsistent or messy code
3. `rewrite-page`: rewrite the page only when the user asked for a redesign or the page structure cannot support the requested change

Do not jump to a page rewrite for a small change.

## Consistency Rules

Maintain consistency at two levels for every edit:
1. Page consistency
2. Site-wide consistency

### Page Consistency

Within the current page, matching elements should remain visually and semantically aligned.

Check for repeated instances of:
- Buttons
- Cards
- Heading levels
- Section spacing
- Product names
- Contact details
- CTA copy

If the user points at one instance but the same pattern appears elsewhere on the page, update the related instances too unless the user clearly wants a special case.

### Site-Wide Consistency

If the user changes a shared style or shared content entity, do not stop at the current page. Scan the site and synchronize all relevant occurrences.

Treat these as shared by default:
- Phone numbers
- Email addresses
- Company or brand names
- Product names
- Solution names
- Primary CTA copy
- Navigation labels
- Footer contact details
- Legal link labels
- Shared theme tokens
- Shared button, card, header, and footer styles

Examples:
- If the user changes a phone number, update every visible occurrence across the site.
- If the user renames a product, update the detail page, listing cards, related solutions, news mentions, and any other visible references.
- If the user changes shared button styling, update the shared CSS source first rather than patching a single page override.

## Propagation Rules

Use this decision rule:

### Local changes

Typical examples:
- A section-specific explanation
- A page-only case study block
- A unique image caption on one page

For local changes:
- Edit only the affected page or section
- Still keep same-page patterns consistent

### Shared changes

Typical examples:
- Phone number, email, company name, product name
- Navigation labels, main CTA, footer contact details
- Header/footer styling
- Site-wide buttons, cards, theme variables

For shared changes:
- Search the whole site
- Identify both visible occurrences and the shared source of truth
- Update the shared source first when possible
- Then fix any page-specific exceptions

## Preservation Rules

- Do not rename files, move files, or restructure directories unless the user asked for it.
- Do not casually rename shared classes or break shared selectors.
- Do not replace relative paths with root-absolute paths.
- Do not remove legal links, contact details, or accessibility attributes unless the user explicitly asks.
- If the site uses a shared header or footer pattern, keep it aligned across pages.
- If a style change should be global, prefer editing shared CSS over per-page overrides.

## Rewrite Escalation

Escalate from patching to rewriting only when one of these is true:
- The user explicitly asked for a redesign
- The current section structure cannot express the new requirement cleanly
- A patch would create obvious duplication, inconsistency, or brittle code

When escalating:
- Rewrite the smallest reasonable surface area
- Preserve paths, shared assets, and site-wide conventions where possible
- Avoid unnecessary collateral changes

## Output Expectations

After editing:
- Keep the site locally previewable
- Keep file count changes minimal unless expansion was requested
- Be explicit about which files changed and why
- Mention when a change propagated from one page to the whole site

## Anti-Patterns

Avoid these mistakes:
- Changing only one visible instance of a phone number or product name
- Fixing one button style while leaving equivalent buttons inconsistent
- Adding a single-page CSS override for something that should be site-wide
- Rewriting an entire page for a small copy or style request
- Breaking local preview by introducing `/assets/...` paths
- Treating a shared header/footer as page-local

## Quick Checklist

Before finishing, verify:
- Is this change `local` or `shared`?
- Did I keep the current page internally consistent?
- Did I synchronize shared entities across the site when needed?
- Did I edit the shared CSS/source instead of patching one page when the change is global?
- Did I preserve paths, preview behavior, and existing conventions?
