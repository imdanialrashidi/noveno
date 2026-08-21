import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { isPublished, sortByDate } from "../data/blog";
import { FALLBACK_SITE_ORIGIN } from "../../scripts/lib/site-origin.mjs";

export async function GET(context: { site?: URL }) {
  const posts = sortByDate((await getCollection("blog")).filter(isPublished));
  return rss({
    title: "وبلاگ نوونو — نوشته‌هایی درباره جذب و پیگیری مشتری",
    description:
      "نوشته‌های کاربردی نوونو برای کسب‌وکارهای خدماتی: جذب مشتری، پیگیری لید، ثبت درخواست و تبدیل بازدید به درخواست — با مثال و بدون وعده تضمینی.",
    site: context.site ?? new URL(FALLBACK_SITE_ORIGIN),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.published_at,
      author: post.data.author,
      categories: [post.data.category, ...post.data.tags],
      link: `/blog/${post.id}/`,
    })),
    customData: `<language>fa</language>`,
  });
}
