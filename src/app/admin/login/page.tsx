import LoginForm from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="page-container flex min-h-[70vh] max-w-md flex-col justify-center py-12">
      <h1 className="mb-6 text-center font-serif text-2xl font-semibold text-ink">
        Admin Login
      </h1>
      <LoginForm />
    </div>
  );
}
