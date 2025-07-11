"use client"
import Navbar from "@/components/Navbar";
import Box from "@mui/material/Box";
import { CRAProvider } from "@/context/CRAContext";
import { usePathname } from "next/navigation";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <CRAProvider>
      <Box sx={{
        minHeight: "100vh",
        background: "#f5f5f5",
      }}>
        {isHomePage && <Navbar />}
        {children}
      </Box>
    </CRAProvider>
  );
}