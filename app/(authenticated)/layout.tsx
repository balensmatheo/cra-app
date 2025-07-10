"use client"
import Navbar from "@/components/Navbar";
import Box from "@mui/material/Box";
import { CRAProvider } from "@/context/CRAContext";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CRAProvider>
      <Box sx={{
        minHeight: "100vh",
        background: "#f5f5f5",
      }}>
        <Navbar />
        {children}
      </Box>
    </CRAProvider>
  );
}