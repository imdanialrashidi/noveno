# Site Management Guide — Noveno Website

## After Delivery

### Content Updates

To update text on any page:
1. Edit the `.astro` file in `src/pages/`
2. Run `pnpm run build`
3. Deploy to Cloudflare Pages

### Adding Blog Posts

1. Create a new `.astro` file in `src/pages/blog/`
2. Add it to the `posts` array in `src/pages/blog/index.astro`
3. Add the route to `public/sitemap.xml`
4. Run `pnpm run build`

### Adding Service Pages

1. Create a new `.astro` file in `src/pages/services/` using `ServiceLayout`
2. Add it to the services array in `src/pages/services/index.astro`
3. Add the route to `public/sitemap.xml`
4. Add the card to the homepage services section
5. Run `pnpm run build`

### Updating Contact Information

Replace placeholder values:
- Phone: Search for `۰۲۱-XXXXXXXX` and `+98XXXXXXXXXX`
- WhatsApp: Search for `XXXXXXXXXXXXX`
- Email: Search for `info@noveno.ir`

### Replacing the Logo

1. Replace `public/logo.svg` and `public/logo-icon.svg`
2. Update the `<img>` tags in Header and Footer components if needed
3. Run `pnpm run build`

## Maintenance

### Monthly

- Check for broken links
- Update blog content if available
- Review form submissions
- Check performance

### As Needed

- Update service descriptions
- Add new portfolio items
- Update pricing or timelines
- Add new FAQ items

## Common Commands

```bash
# Development
pnpm run dev

# Build
pnpm run build

# Preview production build
pnpm run preview
```

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `PUBLIC_FORM_ENDPOINT` | Contact form submission endpoint | No |
| `PUBLIC_REVIEW_FORM_ENDPOINT` | Review form submission endpoint | No |

## Deployment

Cloudflare Pages settings:
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Production branch**: `main`
- **Domain**: `https://noveno.ir`

## Troubleshooting

### Build fails
- Run `pnpm install` first
- Check for syntax errors in `.astro` files
- Verify all imports are correct

### Forms not working
- Check if `PUBLIC_FORM_ENDPOINT` is set
- Verify endpoint accepts POST with JSON
- Check browser console for errors

### CSS not loading
- Verify `src/styles/global.css` exists
- Check Tailwind config includes all component paths
