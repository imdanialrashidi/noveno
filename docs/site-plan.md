# Site Plan — Noveno Website

## Architecture

- **Framework**: Astro 5.x (static output)
- **Styling**: Tailwind CSS 3.x
- **Language**: TypeScript (strict)
- **Package Manager**: pnpm
- **Deployment**: Cloudflare Pages (static)
- **Domain**: https://noveno.ir

## Page Map

| Route | File | Purpose |
|-------|------|---------|
| `/` | `src/pages/index.astro` | Homepage — hero, problem, solution, services, process, trust, FAQ, review form |
| `/services` | `src/pages/services/index.astro` | Services overview |
| `/services/customer-acquisition-page` | `src/pages/services/customer-acquisition-page.astro` | Customer acquisition page service |
| `/services/light-business-website` | `src/pages/services/light-business-website.astro` | Lightweight business website service |
| `/services/light-online-store` | `src/pages/services/light-online-store.astro` | Lightweight online store service |
| `/services/conversion-path-optimization` | `src/pages/services/conversion-path-optimization.astro` | Conversion path optimization service |
| `/services/lead-management` | `src/pages/services/lead-management.astro` | Lead management service |
| `/services/monthly-care-reporting` | `src/pages/services/monthly-care-reporting.astro` | Monthly care & reporting service |
| `/services/templates-assets` | `src/pages/services/templates-assets.astro` | Future templates/assets (coming soon) |
| `/industries` | `src/pages/industries.astro` | Target industries |
| `/process` | `src/pages/process.astro` | Work process (9 steps) |
| `/about` | `src/pages/about.astro` | About Noveno |
| `/portfolio` | `src/pages/portfolio.astro` | Portfolio (demo placeholders) |
| `/contact` | `src/pages/contact.astro` | Contact page |
| `/customer-acquisition-review` | `src/pages/customer-acquisition-review.astro` | Main lead-gen page |
| `/blog` | `src/pages/blog/index.astro` | Blog index |
| `/blog/why-a-beautiful-website-is-not-enough` | `src/pages/blog/why-a-beautiful-website-is-not-enough.astro` | Draft article |
| `/thank-you` | `src/pages/thank-you.astro` | Post-form thank you page |

## Component Map

| Component | File | Purpose |
|-----------|------|---------|
| `BaseLayout` | `src/layouts/BaseLayout.astro` | HTML shell, meta, header, footer |
| `ServiceLayout` | `src/layouts/ServiceLayout.astro` | Reusable service page template |
| `Header` | `src/components/Header.astro` | Responsive nav with mobile hamburger |
| `Footer` | `src/components/Footer.astro` | Site links, contact info |
| `SEOHead` | `src/components/SEOHead.astro` | Centralized SEO/meta tags |
| `CTAButton` | `src/components/CTAButton.astro` | Primary/secondary/outline CTA |
| `SectionHeading` | `src/components/SectionHeading.astro` | Reusable section title |
| `ServiceCard` | `src/components/ServiceCard.astro` | Service preview card |
| `FAQItem` | `src/components/FAQItem.astro` | Expandable FAQ (details/summary) |
| `ProcessStep` | `src/components/ProcessStep.astro` | Numbered process step |
| `IndustryCard` | `src/components/IndustryCard.astro` | Industry category card |
| `ContactForm` | `src/components/ContactForm.astro` | Short contact form |
| `ReviewForm` | `src/components/ReviewForm.astro` | Main lead-gen review form (12 fields) |
| `Breadcrumbs` | `src/components/Breadcrumbs.astro` | Breadcrumb navigation |
| `DemoLabel` | `src/components/DemoLabel.astro` | "نمونه نمایشی" label |

## Design Tokens

- **Primary brand color**: `#5631A5` (deep purple)
- **Lavender accent**: `#DEDBEE`
- **Surface background**: warm off-white `#FEFCF9`
- **Font**: Vazirmatn (Google Fonts)
- **Direction**: RTL

## Key Directories

```
src/
├── components/     # Reusable Astro components
├── layouts/        # Page layouts (BaseLayout, ServiceLayout)
├── pages/          # Route pages
│   ├── services/   # Service pages
│   └── blog/       # Blog pages
├── scripts/        # Client-side JS (mobile menu)
└── styles/         # Global CSS with Tailwind
public/
├── logo.svg        # Logo placeholder
├── logo-icon.svg   # Icon-only logo
├── robots.txt
└── sitemap.xml
docs/
├── site-plan.md
├── qa-checklist.md
├── form-integration.md
├── management-guide.md
└── post-launch-optimization.md
```
