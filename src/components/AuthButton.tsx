import {
  SignInButton,
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";

export function AuthButton() {
  const { isSignedIn, user } = useUser();

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          Welcome, {user.firstName || user.emailAddresses[0].emailAddress}
        </span>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignInButton mode="modal">
        <button className="brutal-button text-sm px-3 py-1">Sign In</button>
      </SignInButton>
      <SignInButton mode="modal" signUpForceRedirectUrl="/">
        <button className="brutal-button text-sm px-3 py-1">Sign Up</button>
      </SignInButton>
    </div>
  );
}
