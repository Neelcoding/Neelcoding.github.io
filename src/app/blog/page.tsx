import { getBlogPosts } from "@/lib/blog";
import BlogCard from "@/components/blog/BlogCard";

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <div className="page-container py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-ink">The Blog</h1>
        <p className="mt-2 max-w-xl text-stone">
          Fragrance reviews, top 10 lists, and buying guides from Buzz&rsquo;s Scents.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-stone">No posts yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
