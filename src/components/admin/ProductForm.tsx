"use client";

import { useFormState, useFormStatus } from "react-dom";
import ImageUploader from "@/components/admin/ImageUploader";
import type { Product } from "@/lib/types";
import type { ProductActionState } from "@/lib/actions/products";

type ProductFormAction = (
  prevState: ProductActionState | undefined,
  formData: FormData
) => Promise<ProductActionState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function ProductForm({
  action,
  product,
  submitLabel,
}: {
  action: ProductFormAction;
  product?: Product;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="card p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fragrance Name" name="name" defaultValue={product?.name} required />
          <Field label="Brand" name="brand" defaultValue={product?.brand} required />
          <Field
            label="Price (USD)"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.price}
            required
          />
          <Field
            label="Quantity Available"
            name="quantity"
            type="number"
            min="0"
            defaultValue={product?.quantity ?? 0}
            required
          />
          <Field
            label="Size (e.g. 50ml)"
            name="size"
            defaultValue={product?.size}
            required
          />
          <SelectField
            label="Concentration"
            name="concentration"
            defaultValue={product?.concentration ?? "EDT"}
            options={["EDT", "EDP", "Parfum", "Extrait"]}
          />
          <SelectField
            label="Condition"
            name="condition"
            defaultValue={product?.condition ?? "new"}
            options={["new", "used", "tester", "decant"]}
          />
          <SelectField
            label="Category"
            name="category"
            defaultValue={product?.category ?? "unisex"}
            options={["men", "women", "unisex"]}
          />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink">Description</h2>
        <div className="flex flex-col gap-4">
          <Field
            label="Short Description (shown on product cards)"
            name="short_description"
            defaultValue={product?.short_description ?? ""}
          />
          <TextareaField
            label="Full Description"
            name="description"
            defaultValue={product?.description ?? ""}
          />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink">Fragrance Notes</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Top Notes" name="top_notes" defaultValue={product?.top_notes ?? ""} />
          <Field
            label="Middle Notes"
            name="middle_notes"
            defaultValue={product?.middle_notes ?? ""}
          />
          <Field label="Base Notes" name="base_notes" defaultValue={product?.base_notes ?? ""} />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink">Wear Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Longevity (e.g. 6-8 hours)"
            name="longevity"
            defaultValue={product?.longevity ?? ""}
          />
          <Field
            label="Projection (e.g. moderate)"
            name="projection"
            defaultValue={product?.projection ?? ""}
          />
          <Field
            label="Season (e.g. fall, winter)"
            name="season"
            defaultValue={product?.season ?? ""}
          />
          <Field
            label="Occasion (e.g. evening, date night)"
            name="occasion"
            defaultValue={product?.occasion ?? ""}
          />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink">Photos</h2>
        <ImageUploader
          existingImages={product?.product_images}
          hiddenInputName={product ? "new_image_urls" : "image_urls"}
        />
      </div>

      <div className="card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:gap-8">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={product?.is_active ?? true}
            className="h-4 w-4 rounded border-stone-light text-gold focus:ring-gold"
          />
          Active (visible on the shop)
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="is_sold_out"
            defaultChecked={product?.is_sold_out ?? false}
            className="h-4 w-4 rounded border-stone-light text-gold focus:ring-gold"
          />
          Mark as sold out
        </label>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  step,
  min,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-field">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        min={min}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="input-field"
      />
    </div>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-field">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={5}
        defaultValue={defaultValue ?? ""}
        className="input-field"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="label-field">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className="input-field capitalize">
        {options.map((option) => (
          <option key={option} value={option} className="capitalize">
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
