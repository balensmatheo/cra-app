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
  // Show navbar on main pages, but not on profile or other specific pages
  const showNavbar = pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/user");

  return (
    <CRAProvider>
      <Box sx={{
        minHeight: "100vh",
        background: "#f5f5f5",
      }}>
        {showNavbar && <Navbar />}
        <Box sx={{
          paddingTop: showNavbar ? 0 : 0,
          minHeight: showNavbar ? "calc(100vh - 72px)" : "100vh"
        }}>
          {children}
        </Box>
      </Box>
    </CRAProvider>
  );
}