import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}
