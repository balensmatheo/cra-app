import Box from '@mui/material/Box';
import Image from "next/image";
import { signOut } from 'aws-amplify/auth';
import Button from '@mui/material/Button';

async function signout() {
  try {
    await signOut();
    // Optionally, you can redirect or refresh the page after sign out
    // window.location.reload();
  } catch (error) {
    console.error("Erreur lors de la déconnexion :", error);
  }
}

export default function Navbar() {
  return (
    <Box sx={{ 
      background: "#fff", 
      display: "flex", 
      alignItems: "center", 
      padding: "0 32px", 
      height: 72, 
      boxShadow: "0 2px 8px #f0f1f2" 
    }}>
      <Image 
        src="/logo/logo_sans_ecriture.png" 
        alt="Logo Decision Network" 
        width={48} 
        height={48} 
        style={{ objectFit: "contain" }} 
      />
      <Box component="span" sx={{ 
        color: "#894991", 
        fontWeight: 700, 
        fontSize: 24, 
        marginLeft: 5, 
        letterSpacing: 1 
      }}>
        Compte rendu d'activité
      </Box>
      <Box sx={{ flex: 1 }} />
      <Button
        variant="outlined"
        color="secondary"
        onClick={signout}
        sx={{ ml: 2, textTransform: 'none', borderColor: '#894991', color: '#894991', '&:hover': { borderColor: '#6a3a7a', color: '#6a3a7a' } }}
      >
        Se déconnecter
      </Button>
    </Box>
  );
} 