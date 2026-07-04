import Image from "next/image";
import Link from "next/link";
import type { BlogPost } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="card flex flex-col overflow-hidden">
      <div className="relative aspect-[16/10] w-full bg-cream-dark">
        {post.cover_image ? (
          <Image src={post.cover_image} alt={post.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone">
            Buzz&rsquo;s Scents
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gold-dark">
          {post.category}
        </p>
        <h3 className="font-serif text-lg font-semibold text-ink">{post.title}</h3>
        {post.excerpt && <p className="text-sm text-stone">{post.excerpt}</p>}
        {post.published_at && (
          <p className="mt-auto pt-2 text-xs text-stone">{formatDate(post.published_at)}</p>
        )}
      </div>
    </Link>
  );
}
