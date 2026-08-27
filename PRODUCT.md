# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people with a spare bottle they will not finish. A gift that does not
suit them, an impulse buy, a scent they wore for a year and moved on from. They
are not assumed to know fragrance vocabulary, house names, batch codes, or what
a decant is. The interface has to teach rather than assume.

Buyers are the same population from the other side, plus people hunting a
specific bottle they already know by name.

Known tension to design against, not around: the audience is casual, but the
sell form currently asks for fill percentage, condition grade, batch code and
scent family. Batch code is optional; fill and condition are required. A first
time seller may not know how to answer these accurately, and inaccurate answers
undermine the positioning below.

## Product Purpose

Move part used and unused fragrance between people instead of into a drawer or
a bin. A seller lists a bottle; a buyer finds it, asks about it, and buys it.
Success is a completed handover both sides felt safe doing.

## Positioning

Fragrance-native structure a general resale marketplace cannot model. Listings
carry size, fill level, condition, box status, batch code, purchase year and
scent family as first class fields rather than free text in a description.
Browsing filters on scent family. Auctions exist for bottles where price
discovery matters, capped at seven days.

eBay and Depop can list a perfume. They cannot filter by scent family or
express "60% full, gently used, box included" as structured, comparable data.

## Operating Context

Listing happens after the fact, from a shelf or a drawer, usually on a phone,
with the bottle in hand. That is when fill level and batch code can actually be
read off the glass.

Buying is considered rather than impulsive: buyers compare fill against price,
ask the seller questions, and may negotiate or wait out an auction before
committing.

## Capabilities and Constraints

Confirmed and built:

- Browse with search plus filters for brand, gender, condition, scent family
  and price. Category links carry filters through the URL.
- Listing detail with size, fill level, condition, box, batch code, purchase
  year, gender, scent family, description and seller.
- Direct buyer/seller messaging with unread counts.
- Offers: non binding, must be below asking price, seller accepts or declines.
- Auctions: seven day maximum, bids must exceed the current high.
- Stripe Checkout, with a 5% processing fee shown to the buyer as its own line
  item before checkout.
- Seller payouts via Stripe Connect Express. Each sale is a destination charge:
  the item price transfers to the seller's connected account and the 5% stays
  with the platform as an application fee. Sellers with unfinished onboarding
  have the Buy button hidden rather than a checkout that fails.
- Orders: shipping address collected at checkout, seller marks shipped with
  carrier and tracking, buyer confirms delivery or reports a problem.
- Accounts with profile, avatar upload, and a seller's own listings view.
- Liked items, bag, and recently viewed, all stored per browser in
  localStorage rather than against the account.

Technical constraints:

- Static HTML, CSS and vanilla JS ES modules. No build step, no framework.
- Supabase for Postgres, auth, storage and edge functions. Tables: profiles,
  listings, offers, bids, conversations, messages, orders.
- Stripe Checkout and Connect via edge functions. Going live needs dashboard
  steps only the account owner can take; see `SETUP-PAYOUTS.md`.
- Hosted on GitHub Pages at usevial.com.

Open and explicitly undecided:

- **Refunds are manual.** A buyer can flag an order as a problem, which tells
  the seller and marks the record, but no money moves until someone issues the
  refund by hand in the Stripe dashboard. There is no dispute adjudication and
  no policy on who decides.
- **No shipping labels or carrier integration.** The address is collected and a
  tracking number can be typed in, but nothing is validated: a seller can mark
  an order shipped without shipping it, and nothing confirms delivery except
  the buyer saying so.
- **Fragrance ships as a flammable liquid.** Checkout is restricted to US
  addresses for that reason, and the seller is told it must go ground. Nothing
  enforces either.
- No moderation flow.
- No authenticity verification. Batch code is captured but never checked
  against anything.
- Liked, bag and recently viewed do not follow a user across devices.

## Brand Commitments

- Name: Vial.
- Wordmark: "Vi" in ink with "al" in the accent colour, set in Playfair
  Display. Confirmed as binding and kept when body headings changed typeface.
- Footer line in use: "Fragrance that changes hands, not a landfill trip."

## Evidence on Hand

- One licensed hero photograph at `images/hero-spray.jpg`.
- Demo fixtures in `js/mock-data.js` referencing real houses
  (Dior, Chanel, YSL, Tom Ford). These render only in demo mode when Supabase
  is unconfigured. They are placeholders, not inventory or partnerships.

Absences future work must not paper over:

- **The live database has no listings.** Every page currently shows an empty
  state. Any "X items for sale" or "Y new listings a day" figure would be
  invented.
- No users, transactions, reviews, ratings or testimonials exist.
- No press, partnerships, brand relationships or endorsements exist.
- No returns policy, authentication or buyer protection guarantee exists, so no
  surface may promise one. Shipping is recorded, not arranged or insured.

## Product Principles

1. **The bottle's real state is the product.** Fill, condition and box status
   are the reason to use Vial over a general marketplace. Anything that makes
   them easier to state accurately is core; anything that lets them be vague
   attacks the premise.
2. **Assume the seller is a first timer.** Someone who has never heard "batch
   code" must still be able to list a bottle honestly and finish.
3. **Never invent proof.** No fabricated counts, reviews, or guarantees. With
   no inventory and no transaction history, empty states and honest feature
   descriptions carry the weight instead.
4. **Do not imply protections that do not exist.** Payouts and a shipping
   record are built; automatic refunds, dispute resolution, insured delivery
   and authentication are not. Copy must not suggest otherwise.
5. **Buying is considered, not impulsive.** Comparison, questions and
   negotiation are the real path to purchase, not a one tap checkout.
