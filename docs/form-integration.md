# Form Integration Guide — Noveno Website

## Current State

Forms are designed for email submission but the deployment target is static Cloudflare Pages with no backend. Currently, forms submit with a success message but **email delivery is not active**.

## Environment Variables

```env
# .env.example
PUBLIC_FORM_ENDPOINT=https://your-endpoint.example.com/api/contact
PUBLIC_REVIEW_FORM_ENDPOINT=https://your-endpoint.example.com/api/review
```

When these are set, forms POST JSON to the endpoint. When not set, forms show success and redirect to `/thank-you`.

## Integration Options

### 1. Cloudflare Pages Functions

Create `functions/api/contact.js`:

```javascript
export async function onRequestPost(context) {
  const data = await context.request.json();
  // Send email via Resend, SendGrid, or Mailgun API
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Set `PUBLIC_FORM_ENDPOINT=/api/contact` in Cloudflare Pages environment variables.

### 2. Webhook / n8n

- Create a webhook in n8n or similar tool
- Point `PUBLIC_FORM_ENDPOINT` to the webhook URL
- Webhook can forward to email, Slack, or database

### 3. Google Sheets via Google Apps Script

- Create a Google Sheet
- Write a Google Apps Script web app that accepts POST
- Deploy as web app
- Point `PUBLIC_FORM_ENDPOINT` to the Apps Script URL

### 4. CRM Endpoint

- If using a CRM (e.g., HubSpot, Pipedrive), use their form API
- Set `PUBLIC_FORM_ENDPOINT` to the CRM's form submission endpoint
- Adjust field names to match CRM expectations

### 5. Email Form Service

- Use Formspree, Basin, or similar service
- Create a form endpoint
- Point `PUBLIC_FORM_ENDPOINT` to the service URL
- Note: some services have free tiers with limits

## Form Data Structure

Both forms send JSON with these fields:

### Contact Form
```json
{
  "source": "contact | contact-page",
  "page_url": "https://noveno.ir/contact",
  "submitted_at": "2025-06-01T12:00:00.000Z",
  "name": "...",
  "phone": "...",
  "message": "..."
}
```

### Review Form
```json
{
  "source": "customer-acquisition-review",
  "page_url": "https://noveno.ir/customer-acquisition-review",
  "submitted_at": "2025-06-01T12:00:00.000Z",
  "fullname": "...",
  "business_name": "...",
  "business_type": "...",
  "city": "...",
  "phone": "...",
  "website_or_page": "...",
  "main_problem": "...",
  "does_advertising": "yes | no | sometimes",
  "customer_source": "...",
  "leads_tracked": "yes | no | partial",
  "preferred_contact": "phone | whatsapp | form",
  "extra_info": "..."
}
```

## Testing

1. Set the environment variable in `.env`
2. Run `pnpm run dev`
3. Submit the form
4. Check your endpoint receives the data
5. Verify redirect to `/thank-you`
