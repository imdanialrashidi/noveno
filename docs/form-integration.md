# Form Integration Guide — Noveno Website

## Current Implementation

Both forms use **Web3Forms** as the form backend. This is a static, serverless form submission service that requires no backend, no database, and no captcha.

- **Endpoint**: `https://api.web3forms.com/submit`
- **Access Key**: `57f6da33-cef2-4b2b-a3de-f4b279030c53`
- **Domain**: `https://noveno.ir`

## How It Works

1. User fills out the form
2. Browser submits via standard HTML `POST` to Web3Forms
3. Web3Forms sends an email to the configured address
4. User is redirected to `/thank-you?source=...`

No JavaScript is required for form submission. The forms use native HTML form submission.

## Forms

### 1. Customer Acquisition Review Form

- **Location**: `/customer-acquisition-review` page
- **Component**: `src/components/ReviewForm.astro`
- **Subject**: `درخواست بررسی مسیر جذب - Noveno`
- **Redirect**: `https://noveno.ir/thank-you?source=review`

**Field Mapping**:

| Persian Label | Field Name |
|---------------|------------|
| نام و نام خانوادگی | `full_name` |
| نام کسب‌وکار | `business_name` |
| نوع کسب‌وکار | `business_type` |
| شهر | `city` |
| شماره تماس | `phone` |
| آدرس پیج یا سایت | `website_or_social` |
| مهم‌ترین مشکل فعلی در جذب مشتری | `main_customer_acquisition_problem` |
| آیا تبلیغات انجام می‌دهید؟ | `running_ads` |
| مشتری‌ها بیشتر از کجا می‌آیند؟ | `lead_sources` |
| آیا لیدها جایی ثبت می‌شوند؟ | `lead_tracking_status` |
| روش ترجیحی تماس | `preferred_contact_method` |
| توضیح اختیاری | `extra_notes` |

**Hidden Fields**: `access_key`, `from_name`, `redirect`, `subject`, `botcheck`, `form_name`, `site_domain`

### 2. Quick Contact Form

- **Location**: `/contact` page, footer, and other pages
- **Component**: `src/components/ContactForm.astro`
- **Subject**: `پیام تماس سریع - Noveno`
- **Redirect**: `https://noveno.ir/thank-you?source=contact`

**Field Mapping**:

| Persian Label | Field Name |
|---------------|------------|
| نام | `name` |
| شماره تماس | `phone` |
| پیام کوتاه | `message` |

**Hidden Fields**: `access_key`, `from_name`, `redirect`, `subject`, `botcheck`, `form_name`, `site_domain`, `source`

## Testing

### Local Testing

1. Run `pnpm run dev`
2. Navigate to `/customer-acquisition-review` or `/contact`
3. Fill out the form
4. Submit the form
5. Check your email inbox for the submission

### After Deployment

1. Deploy to Cloudflare Pages
2. Visit `https://noveno.ir/customer-acquisition-review`
3. Fill out and submit the form
4. Verify redirect to `/thank-you?source=review`
5. Check email inbox

### Email Delivery Troubleshooting

If email is not received:
1. Check **inbox**, **spam**, **promotions**, and **updates** folders
2. Verify the access key is correct in the form
3. Check Web3Forms dashboard for submission logs
4. Ensure the redirect URL is correct

## Privacy Note

Both forms include this Persian note under the submit button:

> اطلاعات شما فقط برای بررسی درخواست و تماس با شما استفاده می‌شود.

## Technical Details

- No backend required
- No database required
- No captcha implemented
- No JavaScript enhancement for submission
- Standard HTML form submission
- Static Cloudflare Pages compatible
- Bot protection via Web3Forms `botcheck` field
