# Turning payouts on

The code for seller payouts, shipping and refunds is written. None of it does
anything until the steps below are done, and every one of them needs the owner
of the Stripe and Supabase accounts. They can't be done from the codebase.

Work through them in order. Steps 1 to 5 take about twenty minutes.

---

## 1. Enable Connect on the Stripe account

Stripe Dashboard → **Connect** → **Get started** → choose **Platform or
marketplace**, then accept the Connect service agreement.

Without this, creating a seller account returns an error and nobody can onboard.

## 2. Run the database migration

Supabase Dashboard → **SQL Editor** → **New query** → paste the whole of
`sql/005_payouts_and_orders.sql` → **Run**.

This adds the payout columns to `profiles`, creates the `orders` table, and
installs the three functions that let sellers mark orders shipped and buyers
report problems.

## 3. Deploy the new edge function

Supabase Dashboard → **Edge Functions** → **Deploy a new function** → **Via
Editor**. Name it exactly `connect-onboard` and paste the contents of
`supabase/functions/connect-onboard/index.ts`.

## 4. Redeploy the two changed edge functions

Same place, but replacing what's already there:

- `create-checkout-session` — now splits the payment instead of keeping all of it
- `stripe-webhook` — now records orders and syncs payout status

## 5. Check the secrets

Supabase Dashboard → **Edge Functions** → **Secrets**. These must all exist:

| Secret | Where it comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → your endpoint |
| `SUPABASE_URL` | usually already set |
| `SUPABASE_ANON_KEY` | usually already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |

`SUPABASE_SERVICE_ROLE_KEY` is the one most likely to be missing, and both
`create-checkout-session` and `stripe-webhook` now need it. Treat it like a
password: it bypasses every row-level security rule in the database.

## 6. Subscribe the webhook to the new events

Stripe Dashboard → **Developers** → **Webhooks** → your existing endpoint →
**Update details** → add these event types:

- `checkout.session.completed` (already there)
- `account.updated` — keeps a seller's payout status current
- `charge.refunded` — closes an order out when money goes back

If Stripe makes you create a **separate Connect endpoint** for `account.updated`,
point it at the same function URL and put that endpoint's signing secret into a
secret named `STRIPE_CONNECT_WEBHOOK_SECRET`. The function checks both.

---

## Testing it before real money

Use Stripe **test mode** for all of this; it has its own keys, its own webhook
endpoints and its own Connect accounts.

1. Sign in to Vial, go to **Account**, and click **Set up payouts**. Stripe's
   test onboarding accepts fake data — use SSN `000-00-0000`, any test address,
   and routing `110000000` / account `000123456789`.
2. Come back. The account page should say the payout account is active.
3. List a bottle from that account.
4. Sign in as a second account and buy it with card `4242 4242 4242 4242`, any
   future expiry, any CVC.
5. Check **Orders**. The buyer sees it under Bought; the seller sees it under
   Sold with the shipping address and a place to add tracking.
6. In Stripe → **Connect** → **Accounts**, the seller's balance should show the
   item price, and your platform balance should show the 5%.

If step 6 shows nothing, the webhook is the usual culprit: Stripe → Developers →
Webhooks → your endpoint shows every delivery attempt and the response.

---

## What this does not do

Worth knowing before pointing anyone at the site.

**Refunds are manual.** A buyer can report a problem, which flags the order and
tells the seller, but no money moves until you issue the refund yourself in the
Stripe dashboard. There is no rule about who wins a disagreement, and no
timeline. That decision is yours every time, and you should decide the policy
before the first one arrives rather than during it.

**Shipping is recorded, not arranged.** Nothing buys a label, validates a
tracking number, or confirms delivery. A seller can mark an order shipped
without shipping it. The only real check is the buyer saying it arrived.

**The 5% is not 5% of profit.** On a destination charge the platform is the
merchant of record, so Stripe's own fee (about 2.9% + 30¢) comes out of your
side. On a $100 bottle you collect $5.00 and pay Stripe about $3.35, leaving
roughly $1.65. Raising `PROCESSING_FEE_RATE` in `create-checkout-session` is
the lever if that needs to change.

**Disputes land on you.** Merchant of record also means a chargeback is taken
from the platform balance, even after the seller has been paid. With a real
volume of strangers this is the risk that matters most.

**US addresses only.** Fragrance is a flammable liquid: it ships ground and
carriers largely refuse it across borders. Checkout collects US addresses only,
and the seller is told it has to go ground. Nothing enforces that it does.
