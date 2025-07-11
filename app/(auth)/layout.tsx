import Signin from "@/components/Signin";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Signin />
      {children}
    </>
  );
}