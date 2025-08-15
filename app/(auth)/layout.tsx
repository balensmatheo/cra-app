"use client";

// Amplify configuré globalement dans un provider client (voir RootAmplifyProvider)
import '@aws-amplify/ui-react/styles.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}