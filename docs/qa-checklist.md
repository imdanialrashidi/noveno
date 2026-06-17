# QA Checklist — Noveno Website

## Build & Deploy

- [ ] `pnpm install` completes without errors
- [ ] `pnpm run build` completes successfully
- [ ] `pnpm run preview` starts without errors
- [ ] All 18 pages generate in `dist/`
- [ ] No build warnings about missing files
- [ ] Static output compatible with Cloudflare Pages

## Mobile Layout

- [ ] Homepage hero visible on 320px width
- [ ] Navigation hamburger works on mobile
- [ ] Mobile menu opens/closes correctly
- [ ] All CTAs are tap-friendly (min 44px)
- [ ] Forms are easy to fill on mobile
- [ ] No horizontal scroll on any page
- [ ] Text is readable without zooming
- [ ] Images/icons are responsive

## SEO

- [ ] Unique `<title>` on every page
- [ ] Unique meta description on every page
- [ ] `lang="fa"` on `<html>` element
- [ ] `dir="rtl"` on `<html>` element
- [ ] Canonical URLs set on all pages
- [ ] Open Graph tags present on all pages
- [ ] JSON-LD structured data on homepage
- [ ] FAQ schema on homepage
- [ ] Service schema on service pages
- [ ] BlogPosting schema on blog article
- [ ] BreadcrumbList schema on all pages
- [ ] `sitemap.xml` covers all routes
- [ ] `robots.txt` references sitemap
- [ ] Internal linking between pages
- [ ] One clear H1 per page
- [ ] Logical heading hierarchy

## Accessibility

- [ ] Skip-to-content link present
- [ ] All form fields have visible labels
- [ ] Focus states visible on interactive elements
- [ ] `aria-label` on icon-only buttons
- [ ] `aria-expanded` on mobile menu toggle
- [ ] `aria-current="page"` on active nav links
- [ ] Alt text on all images
- [ ] Semantic HTML throughout
- [ ] Reduced-motion support in CSS
- [ ] Color contrast sufficient (brand-600 on white)
- [ ] Keyboard navigation works
- [ ] No keyboard traps

## Content Quality

- [ ] No fake testimonials
- [ ] No fake portfolio claims
- [ ] No fake metrics or results
- [ ] No guaranteed sales claims
- [ ] All content in Persian
- [ ] Professional, non-hype tone
- [ ] Clear value proposition
- [ ] Contact information present (placeholders)
- [ ] No exposed secrets or API keys

## Forms

- [ ] Contact form has validation
- [ ] Review form has all 12 required fields
- [ ] Phone field accepts Iranian format
- [ ] Success state shows after submission
- [ ] Error state shows on failure
- [ ] Forms handle missing endpoint gracefully
- [ ] `.env.example` documented

## Performance

- [ ] No unnecessary JavaScript
- [ ] No heavy animation libraries
- [ ] Vazirmatn font loaded efficiently
- [ ] No render-blocking resources
- [ ] CSS minified in build
- [ ] No large background images/videos
- [ ] No carousel/slider dependencies

## Security

- [ ] No secrets in source code
- [ ] No tracking scripts
- [ ] No cookies set
- [ ] `.env` files gitignored
- [ ] Forms sanitize input
