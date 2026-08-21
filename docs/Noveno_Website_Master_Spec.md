# Noveno Website — Master Product, UX, Content & Technical Specification

> **Document type:** AI-ready website master specification  
> **Brand:** Noveno / نوونو  
> **Version:** 1.0  
> **Primary language:** Persian (RTL)  
> **Market:** Iran  
> **Primary website goal:** Generate qualified sales conversations for Noveno  
> **Primary conversion:** Request an acquisition-path review / audit  
> **Source of truth:** Noveno Business DNA v1.1 + current strategic direction  
> **Intended users of this document:** Founder, designers, developers, AI coding agents, copywriting agents, QA agents, analytics agents

---

# 0. Purpose of This Document

This document is the implementation-level specification for the next version of the Noveno website.

It should be treated as the **single source of truth for website strategy, information architecture, content direction, UX, conversion design, technical architecture, measurement, CRM integration, and quality standards**.

The website must not be approached as a generic agency website or a portfolio redesign.

The website itself is part of Noveno's product philosophy and must demonstrate, through its own structure, how Noveno thinks about:

- customer acquisition;
- message clarity;
- conversion paths;
- lead capture;
- lead tracking;
- measurement;
- follow-up;
- continuous improvement.

The final website must be simpler than the internal business DNA.

The **Business DNA defines what Noveno is**.  
The **website defines what a prospect needs to understand, trust, and do next**.

---

# 1. Instructions for AI Agents

Any AI system working on this website must follow the rules below.

## 1.1 Source hierarchy

When making decisions, use this priority order:

1. This specification;
2. Noveno Business DNA;
3. actual project evidence and real customer data;
4. explicit founder instructions;
5. existing codebase conventions where they do not conflict with the above.

Do not silently introduce positioning, claims, services, prices, features, technologies, results, team members, customers, testimonials, or metrics that are not supported by a source.

---

## 1.2 Core decision rule

Every page, section, component, interaction, and piece of copy must perform at least one of these functions:

1. **Explain**
2. **Prove**
3. **Qualify**
4. **Convert**

If an element does none of these, strongly consider removing it.

---

## 1.3 Anti-hallucination rule

Never invent:

- clients;
- case-study outcomes;
- conversion-rate improvements;
- revenue increases;
- testimonials;
- team members;
- certifications;
- partnerships;
- customer logos;
- awards;
- user counts;
- years of experience;
- guarantees;
- performance numbers.

Demo data must be visually and verbally identified as demo data.

---

## 1.4 Complexity rule

Prefer the smallest reliable implementation that solves the actual requirement.

Do not introduce technical complexity for prestige.

Avoid architecture such as:

- microservices;
- Kubernetes;
- unnecessary authentication;
- complex CMS infrastructure;
- excessive client-side state;
- heavy animation libraries;
- large JavaScript bundles;
- unnecessary dashboards;

unless an explicit requirement later justifies them.

---

# 2. Strategic Definition

## 2.1 What Noveno is

Noveno is an Iranian service-and-systems business focused on improving the path between **customer attention and customer action**.

It helps small and medium businesses design and implement clearer, more trackable customer-acquisition systems.

A Noveno system may combine:

- messaging;
- landing pages;
- websites;
- calls to action;
- forms;
- telephone;
- WhatsApp or other practical messaging channels;
- lead capture;
- lightweight lead management;
- analytics;
- reporting;
- ongoing optimization.

The value is not any one of these components.

The value is the **system created by connecting them coherently**.

---

## 2.2 What Noveno is not

The website must not position Noveno as:

- a generic web design company;
- a cheap WordPress provider;
- a full-service marketing agency;
- a social media management agency;
- an advertising company;
- an SEO-only company;
- a complex enterprise CRM provider;
- an app development agency;
- a follower/view seller;
- a growth-hacking brand promising explosive results;
- an “AI agency” whose main product is AI itself.

---

# 3. Public Positioning

## 3.1 Primary public category

**سیستم جذب و پیگیری مشتری برای کسب‌وکارهای خدماتی**

English internal equivalent:

**Customer Acquisition & Lead Management Systems for Service Businesses**

---

## 3.2 Core problem statement

Many businesses do not primarily suffer from “not having a website.”

They suffer from a broken or unclear path after attention is created.

Typical flow:

```text
Attention
↓
Visit
↓
Unclear message
↓
Scattered contact channels
↓
Untracked inquiry
↓
Weak follow-up
↓
Lost customer
```

Noveno improves this path.

---

## 3.3 Core transformation

```text
Scattered attention and inquiries
                ↓
A clear customer journey
                ↓
A specific action
                ↓
Recorded lead
                ↓
Trackable follow-up
                ↓
Measurable learning
```

---

## 3.4 Core promise

Recommended public promise:

> **مسیر جذب مشتری را از دیدن شما تا تماس، ثبت درخواست و پیگیری، ساده‌تر و قابل‌اندازه‌گیری‌تر می‌کنیم.**

This is deliberately not a revenue guarantee.

---

## 3.5 Primary CTA

Use one primary CTA across the site:

> **درخواست بررسی مسیر جذب**

Possible alternative label in specific contexts:

> **شروع بررسی مسیر جذب**

Avoid generic primary CTAs such as:

- تماس با ما;
- شروع همکاری;
- همین حالا شروع کنید;
- مشاوره رایگان.

---

## 3.6 Secondary CTA

Recommended:

> **دیدن پروژه‌ها**

Later, when enough verified results exist:

> **دیدن نتایج واقعی**

---

# 4. Ideal Customer Profile

## 4.1 Primary ICP

The website should primarily speak to **small and medium service businesses** with meaningful customer value.

A good-fit customer typically:

- wants more qualified customers;
- already receives some attention or inquiries;
- has a reachable decision-maker;
- sells a defined service;
- can justify spending money to improve acquisition;
- receives inquiries through calls, forms, messages, referrals, social media, or search;
- lacks a coherent system for capture and follow-up;
- can benefit from measurable improvements.

---

## 4.2 Strong initial verticals

Do not over-specialize the homepage before sales data proves a winner.

Initial test markets may include:

- آموزشگاه‌ها;
- کلینیک‌ها و خدمات زیبایی;
- خدمات حرفه‌ای;
- املاک;
- مشاوران;
- مربیان و متخصصان مستقل;
- خدمات فنی با ارزش مشتری مناسب;
- کسب‌وکارهای خدماتی B2B کوچک.

---

## 4.3 Not ideal

Noveno is not a good fit when the prospect:

- expects guaranteed sales;
- has no real budget;
- is not the decision-maker;
- wants unlimited scope;
- runs an illegal or unethical operation;
- wants fake traffic, followers, engagement, or deceptive growth;
- expects complex enterprise software at SMB pricing;
- cannot define any economically meaningful customer action.

---

# 5. Website Mission

The Noveno website is a **B2B acquisition system**, not a digital brochure.

It must perform this sequence:

```text
Traffic
↓
Recognition
↓
Understanding
↓
Relevance
↓
Trust
↓
Proof
↓
Qualification
↓
Conversion
↓
Lead capture
↓
CRM
↓
Sales conversation
```

---

# 6. Website Success Metrics

## 6.1 Primary business metric

**Qualified audit requests**

Not pageviews.

---

## 6.2 Secondary metrics

Track:

- audit starts;
- audit completions;
- audit completion rate;
- primary CTA click rate;
- phone clicks;
- messaging clicks;
- case-study opens;
- service-page visits;
- qualified leads;
- discovery meetings booked;
- proposals sent;
- won deals;
- lead source;
- landing page;
- campaign;
- lost reason.

---

## 6.3 Funnel view

At minimum:

```text
Visitors
↓
CTA Clicks
↓
Audit Starts
↓
Audit Submissions
↓
Qualified Leads
↓
Discovery Meetings
↓
Proposals
↓
Won Clients
```

The website should eventually allow Noveno to calculate conversion between each stage.

---

# 7. Brand Architecture

## 7.1 Noveno

Noveno is the business brand.

Its public communication should focus on:

- customer acquisition;
- lead systems;
- business outcomes;
- simplicity;
- process;
- measurement.

---

## 7.2 Founder

Danial Rashidi may appear in the About page and trust layer.

Founder positioning should support credibility without turning the Noveno site into Danial's technical portfolio.

Recommended founder links:

- personal website;
- GitHub.

Do not place technical-stack branding at the center of Noveno.

---

# 8. Site Map

## 8.1 MVP information architecture

```text
/
├── /services
├── /work
│   └── /work/{case-study}
├── /process
├── /about
├── /audit
├── /audit/thank-you
├── /contact
├── /privacy
└── /terms
```

---

## 8.2 Phase 2

After Noveno has sufficient real work and repeatable content:

```text
/insights  [2026-10: renamed وبلاگ at /blog with permanent /insights redirects — see DESIGN §16.]
└── /insights/{article}  [2026-10: renamed وبلاگ at /blog with permanent /insights redirects — see DESIGN §16.]
```

---

## 8.3 Phase 3

Only after a niche shows real traction:

```text
/solutions/{industry}
```

Examples:

```text
/solutions/clinics
/solutions/education
/solutions/beauty
```

Industry pages must contain actual niche-specific thinking and proof.

Do not generate thin SEO pages at scale.

---

# 9. Global Navigation

## 9.1 Desktop navigation

Recommended:

- راه‌حل‌ها
- پروژه‌ها
- فرآیند
- درباره
- بینش‌ها _(when launched)_

Primary button:

> **درخواست بررسی**

---

## 9.2 Mobile navigation

Use:

- compact header;
- menu trigger;
- visible audit CTA where practical;
- no oversized mega-menu.

---

# 10. Homepage Architecture

The homepage should follow this sequence:

```text
Header
↓
Hero
↓
Problem Recognition
↓
System Model
↓
Core Offers
↓
Proof
↓
System Components
↓
Ideal Fit
↓
Process
↓
Measurement
↓
Why Noveno
↓
FAQ
↓
Final CTA
↓
Footer
```

The exact visual layout may evolve, but the information hierarchy should remain.

---

# 11. Homepage — Hero

## 11.1 Objective

In under approximately 10 seconds, a relevant visitor should understand:

- what Noveno does;
- who it is for;
- what problem it addresses;
- what to do next.

---

## 11.2 Recommended headline

Primary candidate:

> **بازدید را به یک مسیر قابل‌پیگیری برای جذب مشتری تبدیل کنید.**

Alternative:

> **لیدهایتان را از پیام‌های پراکنده به یک مسیر قابل‌پیگیری تبدیل کنید.**

Do not combine both.

Select one during copy refinement.

---

## 11.3 Supporting copy

Recommended direction:

> نوونو برای کسب‌وکارهای خدماتی، مسیر مشتری را از دیدن شما تا تماس، ثبت درخواست و پیگیری طراحی و اجرا می‌کند.

---

## 11.4 CTA structure

Primary:

> **درخواست بررسی مسیر جذب**

Secondary:

> **دیدن پروژه‌ها**

Microcopy:

> بدون وعده فروش تضمینی؛ ابتدا مسیر فعلی کسب‌وکار بررسی می‌شود.

---

## 11.5 Hero visual

Do not use a generic stock photo.

Preferred visual:

A compact acquisition-system visualization showing:

```text
Instagram / Google / Referral
↓
Landing / Website
↓
CTA / Form / Call
↓
Lead Captured
↓
Follow-up
↓
Outcome
```

Optionally include a small dashboard preview.

Any fictional dashboard metrics must be labeled:

> **نمونه رابط سیستم**

or equivalent.

---

# 12. Homepage — Problem Recognition

## 12.1 Objective

Make the visitor recognize their existing problem before presenting services.

---

## 12.2 Suggested headline

> **مشکل همیشه کمبود بازدید نیست؛ گاهی مسیر بعد از بازدید خراب است.**

---

## 12.3 Narrative

Illustrate a realistic failure path:

```text
تبلیغ / محتوا / معرفی
↓
بازدید
↓
پیام نامشخص
↓
چند مسیر تماس پراکنده
↓
دایرکت / تماس / پیام
↓
ثبت نشدن درخواست
↓
پیگیری نامنظم
↓
نامشخص بودن نتیجه
```

Then introduce Noveno's role.

---

# 13. Homepage — System Model

## 13.1 Objective

Explain the category Noveno operates in.

---

## 13.2 Suggested headline

> **یک مسیر منظم، نه مجموعه‌ای از ابزارهای پراکنده**

---

## 13.3 Six-stage model

### 1. جذب

Potential sources:

- Instagram;
- Google;
- advertising;
- referrals;
- offline exposure;
- existing customers.

### 2. متقاعدسازی

Possible mechanisms:

- landing page;
- service page;
- proof;
- FAQ;
- offer;
- trust signals.

### 3. اقدام

Possible actions:

- form;
- call;
- WhatsApp/message;
- booking.

### 4. ثبت

Store:

- identity;
- source;
- requested service;
- status.

### 5. پیگیری

Example statuses:

```text
New
Contacted
Qualified
Won
Lost
```

### 6. یادگیری

Review:

- traffic;
- conversion;
- lead quality;
- bottlenecks;
- follow-up;
- improvement opportunities.

---

# 14. Core Offer Architecture

Noveno should publicly organize its service model around **three offers**.

Do not present a long list of unrelated services as equal products.

---

# 15. Offer 1 — Lead Flow Audit

Persian name:

> **بررسی مسیر جذب**

## Objective

Low-friction diagnostic entry point.

## Can examine

- message clarity;
- website;
- landing pages;
- mobile experience;
- CTA;
- forms;
- trust;
- phone path;
- WhatsApp/message path;
- lead capture;
- lead tracking;
- acquisition source visibility;
- follow-up.

## Possible output

- current-state analysis;
- priority issues;
- recommended customer journey;
- implementation plan.

Do not promise that every audit is free unless that is intentionally established as policy.

---

# 16. Offer 2 — Lead System

Persian name:

> **طراحی و اجرای سیستم جذب**

This is the core project offer.

## Possible components

- landing page;
- service website;
- positioning and messaging structure;
- copy;
- CTA architecture;
- form design;
- telephone path;
- messaging path;
- lead capture;
- source capture;
- analytics;
- lightweight lead-management system;
- post-submit flow;
- reporting setup.

Not every project requires all components.

The system should be scoped according to the business problem.

---

# 17. Offer 3 — Growth & Optimization

Persian name:

> **بهبود و همراهی ماهانه**

Purpose:

Create recurring value after launch.

Possible scope:

- technical maintenance;
- analytics review;
- reporting;
- copy improvements;
- CTA improvements;
- funnel review;
- limited CRO experiments;
- form optimization;
- UX refinements;
- QA;
- small changes within defined scope.

This must not become unlimited support.

---

# 18. Proof Architecture

Proof is one of the most important parts of the website.

Use three explicit categories.

## 18.1 Case Study

A real client/project with real evidence.

May include verified outcomes.

---

## 18.2 Project

A real project where implementation is real but outcome data is unavailable or insufficient.

Do not imply performance results.

---

## 18.3 Concept

A fictional or demonstration system.

Clearly label it as:

- Concept;
- Demo;
- نمونه نمایشی;
- سناریوی مفهومی.

Concept projects may describe **design goals** and **recommended KPIs**, not invented results.

---

# 19. Proof Policy

Never write:

> افزایش ۳۷٪ لید

unless the number is supported by actual data.

For conceptual work write:

> **هدف طراحی:** کاهش اصطکاک ثبت درخواست

or:

> **KPI پیشنهادی:** نرخ تکمیل فرم

This distinction is mandatory.

---

# 20. Work Page

URL:

```text
/work
```

## Objective

Demonstrate execution quality and business thinking.

## Filters

Only add filters if enough projects exist.

Potential future filters:

- Case Study;
- Project;
- Concept;
- industry.

For an early portfolio, a simple curated list is better.

---

# 21. Case Study Template

Each real case study should follow a repeatable structure.

```text
Project Hero
↓
Client Context
↓
Situation
↓
Problem
↓
Previous Journey
↓
What Noveno Changed
↓
System Architecture
↓
Screens / Experience
↓
Tracking & Measurement
↓
Results
↓
Limitations
↓
What We Learned
↓
CTA
```

---

## 21.1 Project Hero

Show:

- project/client;
- industry;
- timeline;
- scope;
- project type.

---

## 21.2 Situation

Explain the business context.

Avoid unnecessary marketing language.

---

## 21.3 Problem

Describe the actual bottleneck.

---

## 21.4 Existing customer journey

Visualize the previous flow.

---

## 21.5 What changed

Explain the intervention.

---

## 21.6 System architecture

Show how channels, pages, forms, tracking, and follow-up connect.

---

## 21.7 Results

Use only measured results.

Possible metrics:

- inquiries;
- form submissions;
- CTA click rate;
- calls;
- qualified leads;
- lead source visibility;
- response time;
- follow-up completion.

---

## 21.8 Limitations

Mandatory whenever result interpretation has important constraints.

Example:

> داده فروش نهایی در اختیار Noveno نبود؛ بنابراین ارزیابی این پروژه بر اساس لیدهای ثبت‌شده انجام شده است.

Transparency increases trust.

---

# 22. System Components Section

The homepage and service page may display components as building blocks, not isolated service products.

Possible components:

- Landing Pages
- Service Websites
- Messaging
- Lead Forms
- Phone Paths
- WhatsApp / Messaging Paths
- Lead Tracking
- Lightweight CRM
- Analytics
- Follow-up
- Monthly Reporting
- Conversion Improvements

The key message:

> Noveno selects the components needed for the customer's acquisition system.

---

# 23. Qualification Section

Suggested headline:

> **Noveno برای همه مناسب نیست.**

Use two columns.

## Good fit

- customer acquisition matters economically;
- existing attention/inquiries exist;
- decision-maker participates;
- a defined service is being sold;
- budget is real;
- tracking matters;
- customer journey can be improved.

## Bad fit

- guaranteed sales expected;
- no budget;
- unlimited scope expected;
- deceptive growth requested;
- illegal business;
- fake traffic or engagement requested;
- decision-maker absent.

This section should reduce bad leads.

---

# 24. Process Page & Process Section

Use a five-stage model.

```text
Diagnose
→
Design
→
Build
→
Measure
→
Improve
↺
```

---

## 24.1 Diagnose — بررسی

Understand:

- business;
- customer;
- offer;
- current acquisition;
- bottlenecks;
- constraints.

---

## 24.2 Design — طراحی

Define:

- customer path;
- content structure;
- trust requirements;
- CTA;
- lead capture;
- tracking plan.

---

## 24.3 Build — اجرا

Implement only what is needed.

---

## 24.4 Measure — اندازه‌گیری

Track meaningful actions.

---

## 24.5 Improve — بهبود

Use evidence to prioritize changes.

The process should appear cyclical, not:

> build → deliver → disappear.

---

# 25. Measurement Section

Suggested headline:

> **اگر اندازه نگیریم، نمی‌دانیم چه چیزی بهتر شده است.**

Possible tracked metrics:

- page visits;
- CTA clicks;
- form starts;
- form submissions;
- calls;
- WhatsApp/message clicks;
- qualified leads;
- lead source;
- follow-up status.

Add:

> شاخص‌های هر پروژه بر اساس مدل کسب‌وکار و مسیر مشتری تعیین می‌شوند.

Avoid vanity metrics as the primary outcome.

---

# 26. Why Noveno

Do not use generic claims such as:

- بهترین کیفیت;
- تیم حرفه‌ای;
- پشتیبانی عالی;
- جدیدترین فناوری.

Use real principles.

## 26.1 Business-first

Technology serves a business problem.

## 26.2 Simple systems

Avoid unnecessary complexity.

## 26.3 Built for real Iranian conditions

Consider:

- mobile usage;
- unreliable access;
- channel redundancy;
- tool availability;
- replaceability;
- operating simplicity.

## 26.4 Measurement-minded

Important customer actions should be trackable when practical.

## 26.5 AI-assisted, human-reviewed

AI increases speed.

Human judgment remains responsible for:

- claims;
- architecture;
- quality;
- security;
- final decisions.

## 26.6 No false guarantees

Never guarantee sales.

---

# 27. AI Positioning

AI should be presented as an internal advantage, not the main customer value proposition.

Do not position Noveno as:

> آژانس هوش مصنوعی

unless the business strategy explicitly changes in the future.

Recommended language:

> از AI برای تحلیل، تولید پیش‌نویس، توسعه سریع‌تر و بهبود فرایند استفاده می‌کنیم؛ خروجی‌های مهم قبل از استفاده بررسی می‌شوند.

---

# 28. FAQ Architecture

FAQ should reduce genuine purchase objections.

Recommended questions:

1. آیا Noveno فروش را تضمین می‌کند؟
2. آیا فقط سایت طراحی می‌کنید؟
3. اگر از قبل سایت داشته باشیم چه؟
4. پروژه معمولاً چقدر طول می‌کشد؟
5. آیا بعد از تحویل پشتیبانی وجود دارد؟
6. آیا تبلیغات هم انجام می‌دهید؟
7. از چه تکنولوژی یا سیستم مدیریتی استفاده می‌کنید؟
8. هزینه پروژه چگونه تعیین می‌شود؟
9. آیا می‌توان همکاری را با بررسی مسیر فعلی شروع کرد؟

Avoid filler questions created only for SEO.

---

# 29. Final CTA Section

Suggested headline:

> **ببینیم مسیر فعلی جذب مشتری شما کجا می‌تواند بهتر شود.**

Supporting copy:

> چند سؤال کوتاه درباره کسب‌وکارتان پاسخ دهید تا قبل از تماس، تصویر دقیق‌تری از وضعیت فعلی داشته باشیم.

Primary button:

> **شروع بررسی**

Secondary:

> **تماس مستقیم**

---

# 30. Audit Page

URL:

```text
/audit
```

This page is the main conversion page.

It should:

- explain what the audit is;
- explain what information is needed;
- reduce anxiety;
- qualify prospects;
- collect useful pre-sales information;
- pass attribution data into the CRM.

---

# 31. Audit Form

Use a multi-step form if testing shows it improves completion.

Suggested fields:

## Step 1 — Business

> کسب‌وکار شما چیست؟

Capture:

- company/business name;
- industry;
- optional website/social link.

---

## Step 2 — Current acquisition

> در حال حاضر مشتری بیشتر از کجا می‌آید؟

Options may include:

- Instagram;
- Google;
- advertising;
- referrals;
- in-person;
- website;
- other.

Allow multiple selection.

---

## Step 3 — Main problem

> مشکل اصلی مسیر جذب چیست؟

Potential options:

- بازدید داریم ولی درخواست کم است;
- درخواست‌ها پراکنده یا گم می‌شوند;
- سایت نداریم;
- سایت داریم ولی عملکردش مشخص نیست;
- پیگیری ضعیف است;
- نمی‌دانیم کدام کانال نتیجه می‌دهد;
- مطمئن نیستیم.

---

## Step 4 — Customer economics

Ask for approximate customer value using ranges.

Do not force sensitive financial disclosure beyond what is useful.

---

## Step 5 — Need

Potential answers:

- بررسی و تحلیل;
- ساخت سیستم;
- بازطراحی مسیر فعلی;
- بهبود ماهانه;
- هنوز مطمئن نیستم.

---

## Step 6 — Contact

Capture:

- name;
- phone;
- preferred communication method.

Optional:

- email.

---

# 32. Audit Form Hidden Attribution

Store where technically possible:

```text
landing_page
referrer
utm_source
utm_medium
utm_campaign
utm_content
utm_term
first_seen_at
submitted_at
```

Preserve useful attribution through the form journey.

---

# 33. Post-Submission Experience

Do not show only:

> پیام شما ارسال شد.

Use:

```text
/audit/thank-you
```

Explain the next steps.

Example:

1. درخواست بررسی می‌شود.
2. اگر همکاری مناسب باشد، Noveno تماس می‌گیرد.
3. یک گفت‌وگوی کوتاه برای فهم دقیق‌تر مسئله انجام می‌شود.
4. در صورت نیاز، Scope و پیشنهاد همکاری ارائه می‌شود.

Optional:

- direct contact fallback;
- relevant case study;
- what information to prepare.

---

# 34. CRM Architecture

The Noveno website must dogfood Noveno's own philosophy.

At minimum, every serious inquiry should become a lead record.

Suggested lead pipeline:

```text
New
↓
Qualified
↓
Contacted
↓
Discovery Scheduled
↓
Discovery Complete
↓
Proposal Sent
↓
Negotiation
↓
Won / Lost
```

---

# 35. Lead Data Model

Recommended MVP model:

```text
Lead
├── id
├── created_at
├── name
├── phone
├── email
├── preferred_contact
├── business_name
├── industry
├── website
├── acquisition_channels[]
├── primary_problem
├── requested_service
├── customer_value_range
├── source
├── landing_page
├── referrer
├── utm_source
├── utm_medium
├── utm_campaign
├── utm_content
├── status
├── owner
├── last_contact_at
├── next_action_at
├── lost_reason
└── notes
```

Avoid overengineering the initial CRM.

A structured Sheet or lightweight CRM is acceptable at the MVP stage if reliable.

---

# 36. Analytics Event Model

At minimum:

```text
page_view

primary_cta_click
  page
  section
  cta_id

secondary_cta_click
  page
  section
  cta_id

audit_started

audit_step_completed
  step

audit_submitted

phone_click

messaging_click
  channel

service_opened
  service

case_study_opened
  case_study

project_opened
  project
```

Use consistent event names.

---

# 37. Analytics Principles

Analytics must:

- support business decisions;
- not break core website functionality;
- respect privacy obligations;
- avoid unnecessary data collection;
- degrade gracefully when third-party analytics is blocked.

Do not collect sensitive data simply because it is technically possible.

---

# 38. Services Page

URL:

```text
/services
```

Recommended architecture:

```text
Hero
↓
Problems We Solve
↓
Audit
↓
Lead System
↓
Growth & Optimization
↓
Possible Components
↓
Typical Engagement
↓
Pricing Philosophy
↓
FAQ
↓
CTA
```

---

# 39. Pricing Strategy on the Website

Prefer transparent framing.

Possible approaches:

- starting prices;
- realistic ranges;
- “projects are scoped after audit.”

Do not publish prices that cannot be maintained during rapid inflation.

If prices are shown, they must be easy to update.

Recommended structure:

```text
بررسی مسیر جذب
از ...

سیستم جذب
معمولاً ... تا ...

بهبود ماهانه
از ... / ماه
```

Final numbers are a business decision and are not defined by this specification.

---

# 40. About Page

URL:

```text
/about
```

Do not make this a long founder autobiography.

Recommended architecture:

```text
Why Noveno Exists
↓
What Noveno Believes
↓
Principles
↓
How Noveno Works
↓
Founder
↓
CTA
```

---

## 40.1 Founder section

Include:

- real founder name;
- real photo when available;
- short bio;
- personal website;
- GitHub.

Do not invent a team.

If Noveno is currently founder-led, it is acceptable to say so.

---

# 41. Contact Page

URL:

```text
/contact
```

Use this as a fallback.

Primary acquisition should still point to `/audit`.

Contact page may include:

- phone;
- messaging channel;
- email;
- audit link;
- expected communication process.

Do not create a dead-end generic contact form if the audit form already qualifies leads better.

---

# 42. Insights Strategy

Do not prioritize a blog before proof and sales.

Launch `/insights` after the core website and sales system are working. [2026-10: renamed وبلاگ at /blog with permanent /insights redirects — see DESIGN §16.]

Suggested content pillars:

## Acquisition

Examples:

- چگونه ورودی کسب‌وکار را بهتر هدایت کنیم؟
- قبل از تبلیغ چه چیزهایی باید آماده باشد؟

## Conversion

Examples:

- چرا کاربران وارد سایت می‌شوند ولی اقدام نمی‌کنند؟
- فرم کوتاه بهتر است یا تماس مستقیم؟

## Lead Management

Examples:

- یک CRM ساده برای کسب‌وکار کوچک چه شکلی است؟
- چطور بفهمیم یک لید از کجا آمده؟

Content should educate prospects and support sales.

Avoid low-value mass AI content.

---

# 43. SEO Architecture

SEO is secondary to positioning and proof during the early stage.

Technical SEO should still be correct from launch.

Requirements:

- semantic HTML;
- unique title;
- meta description;
- canonical;
- sitemap;
- robots;
- Open Graph;
- structured data where appropriate;
- clean URLs;
- good internal linking;
- fast performance;
- no duplicate thin pages.

---

# 44. Industry Pages

Do not create industry pages until there is real strategic reason.

When created, each industry page should include:

```text
Industry-specific problem
↓
Typical customer journey
↓
Common acquisition leakage
↓
Recommended system
↓
Relevant real proof
↓
Process
↓
CTA
```

Avoid template-spinning the same content across industries.

---

# 45. Visual Direction

Desired brand character:

> **Professional + calm + precise + modern + business-first**

Avoid:

- cyberpunk;
- “AI futuristic” visuals;
- neon overload;
- excessive gradients;
- glassmorphism everywhere;
- stock agency photography;
- visual noise;
- excessive animation;
- giant decorative dashboards.

---

# 46. Information Design

The website should feel like a system.

Prefer:

- diagrams;
- flows;
- small system previews;
- real screenshots;
- annotated before/after flows;
- simple metrics;
- structured content;
- clear hierarchy.

The design should visually reinforce Noveno's core idea:

> turning scattered customer journeys into structured systems.

---

# 47. Typography

Persian readability is critical.

Recommended principles:

- high-quality Persian typeface;
- strong hierarchy;
- comfortable line height;
- limited text width;
- no overly condensed body text.

Suggested approximate ranges:

```text
Desktop Hero: 48–64px
Desktop H2:   34–44px
Body:         16–18px
Mobile Hero:  34–40px
```

Actual values must be refined in implementation.

---

# 48. Layout

Recommended:

- max content width around 1180–1240px;
- narrower text columns for reading;
- generous whitespace;
- consistent vertical rhythm;
- RTL-native layouts.

Avoid filling every area with cards.

---

# 49. Mobile-First Requirements

The site must be designed for mobile usage first.

Requirements:

- readable typography;
- accessible tap targets;
- visible CTA;
- click-to-call;
- easy messaging access;
- form optimized for mobile keyboards;
- short interaction paths;
- no unreadable tables;
- horizontally resilient diagrams;
- no content dependent on hover;
- minimal heavy media.

---

# 50. Performance

The Iranian network environment makes performance a product requirement.

Targets should be ambitious but practical.

Principles:

- static rendering where possible;
- minimal JavaScript;
- optimized images;
- AVIF/WebP where supported;
- responsive images;
- lazy-load non-critical media;
- minimize third-party scripts;
- self-host essential assets when appropriate;
- aggressive caching where safe;
- avoid blocking fonts;
- avoid unnecessary client hydration.

---

# 51. Accessibility

Minimum requirements:

- semantic landmarks;
- keyboard navigation;
- visible focus states;
- sufficient contrast;
- labels for every input;
- error messages linked to fields;
- screen-reader-compatible form structure;
- reduced-motion support;
- meaningful alternative text;
- no critical information communicated only by color.

Aim for WCAG 2.2 AA where practical.

---

# 52. Copywriting Rules

Tone must be:

- direct;
- clear;
- non-hype;
- practical;
- business-aware;
- understandable to a nontechnical owner;
- confident without exaggeration.

---

## 52.1 Prohibited language patterns

Avoid claims such as:

- رشد انفجاری;
- چند برابر کردن فروش;
- بهترین آژانس;
- حرفه‌ای‌ترین;
- تضمین فروش;
- متحول کردن کسب‌وکار;
- جدیدترین تکنولوژی‌های دنیا;
- انقلابی;
- جادویی.

---

## 52.2 Preferred language patterns

Prefer:

- مسیر درخواست را ساده‌تر می‌کنیم;
- درخواست‌ها را ثبت و قابل پیگیری می‌کنیم;
- مشخص می‌کنیم کدام اقدام‌ها قابل اندازه‌گیری هستند;
- پیچیدگی غیرضروری ایجاد نمی‌کنیم;
- نتیجه را تا جایی که داده اجازه دهد اندازه می‌گیریم;
- بر اساس وضعیت واقعی کسب‌وکار Scope تعریف می‌کنیم.

---

# 53. Trust Architecture

Build trust through:

```text
Clear positioning
+
Real founder
+
Real projects
+
Real evidence
+
Transparent process
+
Clear boundaries
+
Honest limitations
+
No guarantees
+
Professional scope
+
Consistent communication
```

Do not manufacture trust through fake social proof.

---

# 54. Testimonials

Use only real testimonials.

Store:

- customer identity;
- permission status;
- exact original text;
- edited version if approved;
- relevant project.

Never fabricate testimonials.

---

# 55. Logos

Only display customer logos when:

- the customer relationship is real;
- usage is permitted;
- the relationship is not misrepresented.

---

# 56. Images

Priority order:

1. real product/system screenshots;
2. real case-study diagrams;
3. real business/client imagery with permission;
4. clearly labeled concept UI;
5. founder photography;
6. stock imagery only when truly necessary.

Stock “agency team around laptop” photography should be avoided.

---

# 57. Design System

Create a small, maintainable design system.

## Foundations

- colors;
- typography;
- spacing;
- sizing;
- containers;
- borders;
- radii;
- shadows;
- motion;
- icon rules.

---

## UI components

Recommended:

```text
Button
TextLink
Badge
Navigation
MobileMenu
SectionHeader
Hero
OfferCard
ProblemItem
Metric
CaseStudyCard
ProjectCard
ProcessStep
FAQItem
Testimonial
CTASection
FormField
Select
MultiSelect
Textarea
Footer
```

---

## Business-specific components

These should become Noveno signature components:

```text
LeadFlow
ChannelMap
FunnelVisualization
LeadStatusBoard
CRMPreview
AuditPreview
SystemArchitectureDiagram
CaseStudyResult
BeforeAfterJourney
AttributionPreview
```

---

# 58. Motion

Motion should clarify, not decorate.

Good uses:

- subtle flow progression;
- diagram activation;
- accordion transitions;
- gentle section entrance;
- interaction feedback.

Avoid:

- scroll hijacking;
- parallax excess;
- giant cursor effects;
- animation on every element;
- loading sequences that delay content.

Respect `prefers-reduced-motion`.

---

# 59. Technical Stack

Recommended current stack:

## Frontend

**Astro + TypeScript**

Reason:

- content-heavy marketing website;
- high performance;
- static generation;
- minimal JS;
- selective interactivity.

---

## Interactive islands

Use React only where it adds real value, such as:

- complex multi-step audit form;
- interactive diagrams if needed.

Do not hydrate static sections unnecessarily.

---

## Styling

Either:

- Tailwind CSS;
- or a disciplined CSS architecture.

If the existing codebase already uses Tailwind effectively, retaining it is reasonable.

---

## Content

Initial recommendation:

- Astro Content Collections;
- Markdown/MDX for case studies and insights.

Do not introduce a CMS until editing needs justify it.

---

## Backend

Use the smallest reliable backend needed for:

- audit form submission;
- validation;
- anti-spam;
- CRM/Sheet integration;
- notification;
- attribution storage.

---

## Database

PostgreSQL is a good future default when database persistence is justified.

For MVP, a reliable structured CRM/Sheet integration may be enough.

---

# 60. Technical Non-Goals

Do not add without requirement:

- user accounts;
- client authentication;
- client portal;
- GraphQL;
- microservices;
- Redis;
- message queues;
- WebSockets;
- Kubernetes;
- complex state management;
- headless CMS;
- multi-tenant SaaS architecture.

---

# 61. Form Reliability

Audit form is business-critical.

Requirements:

- server-side validation;
- client validation for UX;
- graceful error states;
- duplicate-submission handling;
- spam protection;
- submission logging;
- clear success confirmation;
- no silent failures;
- attribution preserved;
- contact data not exposed publicly.

---

# 62. Security

Minimum requirements:

- dependency hygiene;
- input validation;
- output escaping;
- secure headers where applicable;
- secret management;
- no secrets in repository;
- rate limiting or abuse mitigation for forms;
- least-privilege integrations;
- secure webhook validation where applicable;
- privacy-aware analytics;
- backups for business-critical lead records.

---

# 63. Privacy

The site should collect only data needed for the stated business process.

Privacy page should explain:

- what data is collected;
- why it is collected;
- how it is used;
- where relevant, how users can request deletion or correction;
- third-party processors where required.

Legal text must be reviewed for actual Iranian legal requirements before being treated as final legal advice.

---

# 64. Iran Resilience Principles

The website should be resilient to local constraints.

Design for:

- unstable connectivity;
- filtered services;
- mobile-heavy usage;
- payment/tool restrictions;
- service unavailability;
- need for replaceable vendors.

---

## 64.1 Contact redundancy

Offer more than one practical contact route where appropriate:

- form;
- phone;
- messaging app;
- email.

No single external channel should be the only route.

---

## 64.2 Asset resilience

Prefer keeping essential assets under Noveno's control.

Examples:

- critical fonts;
- primary scripts;
- images;
- content;
- backups.

---

## 64.3 Analytics resilience

Core website functionality must work if analytics fails.

---

# 65. Content Data Model

Recommended project types:

```text
CaseStudy
Project
Concept
```

Potential fields:

```text
title
slug
type
industry
summary
hero_image
client
client_public
timeline
scope
problem
solution
components[]
metrics[]
limitations[]
gallery[]
testimonial
published_at
featured
```

---

# 66. Case Study Metric Model

Each metric should store enough context to prevent misleading display.

Example:

```text
Metric
├── name
├── value
├── unit
├── period
├── baseline
├── source
├── verified
└── note
```

Do not reduce evidence to unexplained numbers.

---

# 67. Content Governance

Every major claim should be traceable.

For proof content, retain internal source records such as:

- analytics export;
- screenshot;
- customer confirmation;
- CRM result;
- project documentation.

---

# 68. Homepage Content Priority

If the homepage becomes too long, preserve sections in this priority order:

1. Hero;
2. Problem;
3. System Model;
4. Core Offers;
5. Proof;
6. Process;
7. Fit;
8. Measurement;
9. Why Noveno;
10. FAQ;
11. Final CTA.

Remove decoration before removing decision-critical information.

---

# 69. Conversion Principles

## 69.1 One primary conversion

Do not create competing primary buttons.

---

## 69.2 Reduce cognitive load

The user should not need to choose between 12 services.

---

## 69.3 Progressive disclosure

Homepage:

> understand the idea.

Services:

> understand the engagement.

Work:

> see proof.

Audit:

> become a lead.

---

## 69.4 CTA context

Repeat the same primary action at logical moments:

- hero;
- after proof;
- after process;
- final CTA.

Do not place it after every paragraph.

---

# 70. Sales Integration

The website should improve sales operations, not just generate forms.

For each lead, the system should eventually support:

- qualification;
- owner assignment;
- next action;
- follow-up date;
- proposal status;
- source;
- lost reason.

---

# 71. Internal Pipeline Reporting

Future dashboard may show:

```text
New Leads
Qualified Leads
Meetings
Proposals
Won
Lost

Pipeline Value
Average Project Value
Win Rate
Lead Source
Lead → Meeting
Meeting → Proposal
Proposal → Won
```

Do not build a custom dashboard until the sales workflow is stable enough to justify it.

---

# 72. Product Roadmap for Noveno Website

## Phase 1 — Conversion Foundation

Build:

- homepage;
- services;
- work;
- case-study template;
- process;
- about;
- audit;
- thank-you;
- contact;
- privacy/terms;
- analytics;
- CRM integration.

Goal:

**Launch and sell.**

---

## Phase 2 — Proof Engine

After real customers:

- improve case studies;
- add testimonials;
- add better project filtering if needed;
- add more complete measurement;
- refine offer copy based on objections.

Goal:

**Increase trust and conversion.**

---

## Phase 3 — Content & Niche Expansion

Add:

- insights;
- niche landing pages;
- deeper SEO;
- referral pages;
- campaign landing pages.

Goal:

**Create repeatable acquisition channels.**

---

## Phase 4 — Operational Leverage

Potential additions:

- automated audit preparation;
- automated lead routing;
- reporting templates;
- CRM automation;
- standardized proposal data;
- client reporting.

Goal:

**Reduce manual work.**

---

## Phase 5 — Productization

Only after sufficient service data.

Possible future product direction:

```text
Noveno Platform
├── Lead Inbox
├── Sources
├── Status
├── Notes
├── Follow-up
├── Forms
├── Analytics
└── Reports
```

Do not build this prematurely.

---

# 73. Launch Scope

The first version should be intentionally constrained.

Recommended initial launch:

```text
/
 /services
 /work
 /work/{case}
 /process
 /about
 /audit
 /audit/thank-you
 /contact
 /privacy
 /terms
```

No large blog required at launch.

---

# 74. Pre-Launch Acceptance Criteria

The website is not ready if any of the following fails.

## Strategy

- [ ] A new visitor can understand Noveno's category quickly.
- [ ] The site does not read like a generic web-design agency.
- [ ] There is one clear primary conversion.
- [ ] Service hierarchy is limited to three core offers.

## Proof

- [ ] Every case study is real.
- [ ] Every result is supported by evidence.
- [ ] Every demo is labeled as demo/concept.
- [ ] No fabricated testimonial exists.
- [ ] No fake customer logo exists.

## UX

- [ ] Navigation is clear.
- [ ] Mobile usability is strong.
- [ ] Audit form is easy to complete.
- [ ] Error states are clear.
- [ ] Thank-you flow explains next steps.
- [ ] No major dead ends exist.

## Content

- [ ] Persian copy is natural and readable.
- [ ] Claims are specific and non-hype.
- [ ] No sales guarantee exists.
- [ ] Technical jargon is minimized.
- [ ] CTA language is consistent.

## Technical

- [ ] Production build passes.
- [ ] No secrets are in the repository.
- [ ] Forms validate server-side.
- [ ] Critical forms cannot silently fail.
- [ ] Basic abuse mitigation exists.
- [ ] Analytics events are tested.
- [ ] Attribution is preserved.
- [ ] Sitemap works.
- [ ] Metadata is complete.
- [ ] Responsive images are optimized.

## Performance

- [ ] Pages remain usable on slower mobile connections.
- [ ] JavaScript is limited to actual interactive needs.
- [ ] Images are compressed.
- [ ] Core layout is stable.
- [ ] Third-party dependencies are minimized.

## Accessibility

- [ ] Keyboard navigation works.
- [ ] Focus states are visible.
- [ ] Forms have labels.
- [ ] Contrast is sufficient.
- [ ] Motion reduction is respected.

## Business Operations

- [ ] Every audit submission enters a reliable lead system.
- [ ] Lead source is captured where possible.
- [ ] A clear owner/next action exists operationally.
- [ ] Lost leads can be categorized later.

---

# 75. Definition of Done for an AI Coding Agent

An AI coding agent should not declare the project done merely because pages render.

Done means:

1. architecture matches this specification;
2. copy does not violate positioning;
3. demo/proof boundaries are explicit;
4. mobile UX is tested;
5. primary conversion works end-to-end;
6. lead data is actually stored or delivered reliably;
7. analytics events fire correctly;
8. performance is acceptable;
9. accessibility basics are implemented;
10. all claims remain truthful;
11. no unnecessary complexity has been introduced;
12. project documentation is updated.

---

# 76. AI Implementation Workflow

Recommended agent workflow:

```text
1. Read this specification
2. Read Noveno Business DNA
3. Inspect current repository
4. Inventory reusable assets
5. Define page schemas
6. Define content models
7. Define design tokens
8. Implement global shell
9. Implement homepage
10. Implement services/work/process/about
11. Implement audit flow
12. Integrate lead storage
13. Add analytics
14. Add proof content
15. Mobile QA
16. Accessibility QA
17. Performance QA
18. Content/claim QA
19. Production build
20. Launch checklist
```

---

# 77. AI Content Review Checklist

Before publishing any AI-generated copy ask:

- Is this true?
- Is it supported?
- Is it useful to the prospect?
- Is it understandable without technical knowledge?
- Is it specific?
- Does it imply a guarantee?
- Does it create fake authority?
- Is it more complicated than necessary?
- Does it help explain, prove, qualify, or convert?

If not, revise or delete.

---

# 78. AI Design Review Checklist

Before approving a UI section ask:

- Does the hierarchy make the next action obvious?
- Is this visually supporting the business idea?
- Is it usable on mobile?
- Is the animation useful?
- Could this be simpler?
- Does it look like generic SaaS/agency design?
- Is the screenshot real?
- If demo, is that clear?
- Does the design increase trust?

---

# 79. AI Technical Review Checklist

Before accepting implementation:

- Is this dependency necessary?
- Is this interaction possible without excessive JS?
- Can failure be handled?
- Can the founder maintain it?
- Does it work under weak connectivity?
- Are data and secrets handled correctly?
- Can a third-party tool be replaced later?
- Is the code understandable?
- Is the architecture proportional to current business scale?

---

# 80. Canonical Short Description for AI Context

When an AI system needs a compact understanding of the project, use:

> **Noveno is an Iranian service-and-systems business that helps small and medium service businesses turn scattered customer attention into a clearer, trackable path from visit to inquiry, lead capture, follow-up, and improvement. Its product is not merely a website; it combines messaging, web experiences, CTAs, forms, calls or messaging channels, lightweight lead management, analytics, and ongoing optimization. The Noveno website itself must operate as a high-quality example of this philosophy: business-first, mobile-first, simple, measurable, transparent, resilient to Iranian operating conditions, and free of exaggerated claims. The website's primary goal is to generate qualified acquisition-path review requests.**

---

# 81. Canonical Public Positioning

## Short

> **سیستم جذب و پیگیری مشتری برای کسب‌وکارهای خدماتی**

## Medium

> **Noveno به کسب‌وکارهای خدماتی کمک می‌کند مسیر مشتری را از دیدن کسب‌وکار تا تماس، ثبت درخواست و پیگیری، ساده‌تر و قابل‌اندازه‌گیری‌تر کنند.**

## Internal extended

> **Noveno designs and implements simple customer-acquisition systems by combining messaging, web experiences, lead capture, contact paths, tracking, follow-up, reporting, and continuous improvement.**

---

# 82. Canonical Website Principle

Place this principle in the project documentation:

> **Every page must explain, prove, qualify, or convert.**

And the implementation principle:

> **Use the smallest reliable system that solves the real business problem.**

---

# 83. Final Product Vision

The Noveno website should feel like the opposite of a generic Iranian web-design agency website.

It should not try to impress with:

- excessive claims;
- dozens of services;
- technology logos;
- visual effects;
- fake metrics;
- inflated agency language.

It should impress through:

- clarity;
- systems thinking;
- strong information architecture;
- real proof;
- practical business understanding;
- transparent limitations;
- excellent mobile UX;
- reliable engineering;
- disciplined measurement.

The visitor should leave with one clear idea:

> **Noveno understands how customer inquiries move through a business, can build the system around that path, and can help make that path more visible and manageable.**

The website itself must be proof of that capability.

---

# 84. Final Scope Guardrail

Before adding any major feature, page, service, or technology, answer:

1. What user or business problem does it solve?
2. What evidence shows this problem matters now?
3. Does it improve acquisition, trust, qualification, conversion, delivery, or measurement?
4. Can a simpler solution work?
5. Does it create maintenance burden?
6. Is it appropriate for Noveno's current stage?

If these questions cannot be answered convincingly, do not add it.

---

**End of Noveno Website Master Specification — v1.0**
