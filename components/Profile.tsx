import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';

interface ProfileProps {
  email: string;
  givenName: string;
  familyName: string;
  group: string;
}

const Profile: React.FC<ProfileProps> = ({ email, givenName, familyName, group }) => {
  return (
    <Box sx={{ p: 3, minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Avatar sx={{ bgcolor: '#894991', width: 64, height: 64, mb: 2 }}>
        {givenName.charAt(0)}{familyName.charAt(0)}
      </Avatar>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {givenName} {familyName}
      </Typography>
      <Divider sx={{ width: '100%', my: 2 }} />
      <Box sx={{ width: '100%' }}>
        <Typography variant="body2" color="text.secondary">Email</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>{email}</Typography>
        <Typography variant="body2" color="text.secondary">Groupe</Typography>
        <Typography variant="body1">{group}</Typography>
      </Box>
    </Box>
  );
};

export default Profile; 