import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
