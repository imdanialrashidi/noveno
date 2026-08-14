# بستهٔ آمادهٔ نمونه‌کارهای نوونو

این بسته یک overlay قابل‌کپی برای مخزن `imdanialrashidi/noveno` است و فقط پنج پروژهٔ واقعی صفحهٔ عمومی نمونه‌کارها را دارد؛ هیچ‌کدام از دموها داخل آن نیستند.

## نصب

محتویات این پوشه را از ریشهٔ مخزن نوونو کپی کن؛ یعنی پوشه‌های `src/`، `public/` و `scripts/` باید با همان نام‌ها در ریشهٔ مخزن قرار بگیرند.

این بسته:

- پنج فایل جدید در `src/content/work/` اضافه می‌کند.
- `src/data/work-previews.ts` را با نسخهٔ کاملِ شامل previewهای جدید جایگزین می‌کند.
- `src/pages/work/index.astro` و `src/pages/work/[slug].astro` را برای استفادهٔ درست از featured و caption عمومی preview به‌روزرسانی می‌کند.
- `public/sitemap.xml` را با URLهای پنج صفحهٔ جدید به‌روزرسانی می‌کند.
- ده فایل WebP واقعی از screenshot صفحهٔ اصلی پنج سایت در `public/images/work/` قرار می‌دهد.

بعد از کپی، فقط این دستورات را در ریشهٔ پروژه اجرا کن:

```bash
npm run check
npm test
npm run build
bash scripts/verify.sh
```

## مسیرهای نهایی

```text
/work/mobile-khorsandi
/work/elsa-hamrah
/work/php-ielts-house
/work/isbatab
/work/danial-rashidi-portfolio
```

صفحهٔ عمومی قدیمی `/portfolio/` منبع اطلاعات این بسته بود؛ ساختار فعلی README مخزن، نمونه‌کارها را در مسیر `/work` می‌سازد.

## عکس‌ها

عکس‌ها همین حالا داخل بسته هستند. هر پروژه دو فایل دارد:

```text
<slug>-hero.webp       # 1440×900
<slug>-hero-800.webp   # 720×450
```

این تصاویر screenshot واقعی از صفحهٔ اصلی همان سایت‌ها هستند، به 1440×900 crop و به WebP تبدیل شده‌اند. اگر بعداً طراحی یکی از سایت‌ها تغییر کرد، برای refresh کردن آن‌ها اجرا کن:

```bash
bash scripts/refresh-portfolio-previews.sh
```

اسکریپت برای گرفتن screenshot از سرویس عمومی `thum.io` استفاده می‌کند و آدرس سایت‌های اصلی داخل خودش مشخص است. اگر ترجیح می‌دهی تصویر اختصاصی‌تری داشته باشی، screenshot خودت را دقیقاً در اندازهٔ 1440×900 جایگزین فایل `*-hero.webp` کن و نسخهٔ 720×450 را هم دوباره بساز.

## نکتهٔ مهم دربارهٔ محتوا

همهٔ موارد از نوع `project` هستند، نه `case-study`، چون در منابع عمومی برای نتیجهٔ سایت‌ها دادهٔ عملکردیِ مستقل و قابل‌ارجاع پیدا نشد. بنابراین هیچ عدد ساختگی در frontmatter یا متن وارد نشده است.

تحقیق جزئی‌تر، اطلاعات عمومی و URL منابع در `research/portfolio-research.md` قرار دارد.
