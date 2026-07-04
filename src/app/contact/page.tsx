import { Instagram, Music2, Youtube } from "lucide-react";
import ContactForm from "@/components/contact/ContactForm";

const SOCIAL_LINKS = [
  { href: "https://instagram.com", label: "Instagram", icon: Instagram },
  { href: "https://tiktok.com", label: "TikTok", icon: Music2 },
  { href: "https://youtube.com", label: "YouTube", icon: Youtube },
];

const FAQS = [
  {
    question: "Are these fragrances authentic?",
    answer:
      "Yes — every fragrance sold comes from my personal collection or trusted, verified sources. I never sell counterfeit or unauthorized fragrances.",
  },
  {
    question: "How are orders packaged?",
    answer:
      "Every order is carefully hand-packed to prevent leaks or damage in transit, with extra protection for glass bottles.",
  },
  {
    question: "Can I request a specific fragrance?",
    answer:
      "Absolutely — send a message using the form and I'll let you know if it's something I can source or already have.",
  },
  {
    question: "What if my item arrives damaged?",
    answer:
      "Contact me right away with photos and I'll make it right — a replacement or refund, depending on the situation.",
  },
];

export default function ContactPage() {
  return (
    <div className="page-container py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-ink">Get in Touch</h1>
        <p className="mt-2 max-w-xl text-stone">
          Questions about an order, a fragrance, or just want to talk scents? Send a message
          or find me on social media.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <ContactForm />

          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-stone">
              Follow Along
            </p>
            <div className="mt-3 flex gap-3">
              {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-light text-ink transition-colors hover:border-gold hover:text-gold-dark"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-serif text-xl font-semibold text-ink">Frequently Asked Questions</h2>
          <div className="mt-4 divide-y divide-stone-light">
            {FAQS.map((faq) => (
              <div key={faq.question} className="py-4">
                <p className="font-medium text-ink">{faq.question}</p>
                <p className="mt-1 text-sm text-stone">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
