import { notFound } from "next/navigation";
import Image from "next/image";
import { getBlogPostBySlug } from "@/lib/blog";
import { formatDate } from "@/lib/format";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) notFound();

  return (
    <article className="page-container max-w-3xl py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-gold-dark">
        {post.category}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-ink">{post.title}</h1>
      {post.published_at && (
        <p className="mt-2 text-sm text-stone">{formatDate(post.published_at)}</p>
      )}

      {post.cover_image && (
        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-cream-dark">
          <Image src={post.cover_image} alt={post.title} fill className="object-cover" />
        </div>
      )}

      <div className="mt-8 whitespace-pre-line text-stone">{post.content}</div>
    </article>
  );
}
