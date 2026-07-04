import { ShieldCheck, PackageCheck, Heart } from "lucide-react";

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-stone-light bg-cream-dark py-16">
        <div className="page-container max-w-2xl text-center">
          <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">
            About Buzz&rsquo;s Scents
          </h1>
          <p className="mt-4 text-stone">
            Buzz&rsquo;s Scents is the shop side of my fragrance blog and content account.
            Everything here started with a genuine love of fragrance — testing, reviewing,
            and collecting bottles from all over. This site is where that collection meets
            the blog: fragrances I&rsquo;ve worn, reviewed, or collected, made available to
            you directly.
          </p>
        </div>
      </section>

      <section className="page-container grid gap-8 py-16 sm:grid-cols-3">
        <TrustPoint
          icon={ShieldCheck}
          title="100% Authentic"
          description="Every fragrance sold here comes directly from my personal collection or trusted, verified sources — never from unauthorized resellers."
        />
        <TrustPoint
          icon={PackageCheck}
          title="Careful Packaging"
          description="Each order is packed by hand with care to make sure your fragrance arrives safely, exactly as described."
        />
        <TrustPoint
          icon={Heart}
          title="Personally Curated"
          description="I only list fragrances I've personally worn and can honestly speak to — condition, quantity, and description are always accurate."
        />
      </section>

      <section className="page-container max-w-2xl pb-16 text-stone">
        <h2 className="font-serif text-xl font-semibold text-ink">Connected to the blog</h2>
        <p className="mt-3">
          If you follow the blog or my content elsewhere, you&rsquo;ll recognize a lot of what&rsquo;s
          listed here — reviews, comparisons, and collection features often turn into shop listings
          once I&rsquo;m ready to let a bottle go. Follow along on the blog to see what&rsquo;s coming
          next.
        </p>
      </section>
    </div>
  );
}

function TrustPoint({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold-dark">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-serif text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-stone">{description}</p>
    </div>
  );
}
