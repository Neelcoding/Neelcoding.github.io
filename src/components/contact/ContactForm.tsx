"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitContactForm, type ContactActionState } from "@/lib/actions/contact";

const initialState: ContactActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Sending..." : "Send Message"}
    </button>
  );
}

export default function ContactForm() {
  const [state, formAction] = useFormState(submitContactForm, initialState);

  if (state.success) {
    return (
      <div className="card p-6 text-center">
        <p className="font-medium text-ink">Thanks for reaching out!</p>
        <p className="mt-1 text-sm text-stone">I&rsquo;ll get back to you as soon as I can.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-6">
      <div>
        <label htmlFor="name" className="label-field">
          Name
        </label>
        <input id="name" name="name" required className="input-field" />
      </div>
      <div>
        <label htmlFor="email" className="label-field">
          Email
        </label>
        <input id="email" name="email" type="email" required className="input-field" />
      </div>
      <div>
        <label htmlFor="message" className="label-field">
          Message
        </label>
        <textarea id="message" name="message" required rows={5} className="input-field" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
