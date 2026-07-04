"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginActionState } from "@/lib/actions/auth";

const initialState: LoginActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "Signing in..." : "Sign In"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-8">
      <div>
        <label htmlFor="email" className="label-field">
          Email
        </label>
        <input id="email" name="email" type="email" required className="input-field" />
      </div>
      <div>
        <label htmlFor="password" className="label-field">
          Password
        </label>
        <input id="password" name="password" type="password" required className="input-field" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
