"use client"
import Navbar from "@/components/Navbar";
import Box from "@mui/material/Box";
import { CRAProvider } from "@/context/CRAContext";
import { usePathname } from "next/navigation";

// Force dynamic rendering to prevent static generation issues with usePathname
export const dynamic = 'force-dynamic';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Show navbar on main pages and profile page
  const showNavbar = pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/user") || pathname === "/profile";

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