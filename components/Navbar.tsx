import Box from '@mui/material/Box';
import Image from "next/image";

export default function Navbar() {
  return (
    <Box style={{ background: "#fff", display: "flex", alignItems: "center", padding: "0 32px", height: 72, boxShadow: "0 2px 8px #f0f1f2" }}>
      <Image src="/logo/logo_sans_ecriture.png" alt="Logo Decision Network" width={48} height={48} style={{ objectFit: "contain" }} />
      <span style={{ color: "#894991", fontWeight: 700, fontSize: 24, marginLeft: 16, letterSpacing: 1 }}>
        Compte rendu d'activité
      </span>
    </Box>
  );
} 