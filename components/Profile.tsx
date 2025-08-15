import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import Divider from '@mui/material/Divider';

interface ProfileProps {
  email: string;
  givenName: string;
  familyName: string;
  group: string;
  avatarUrl?: string;
  onChangePhoto?: () => void;
  uploading?: boolean;
}

const Profile: React.FC<ProfileProps> = ({ email, givenName, familyName, group, avatarUrl, onChangePhoto, uploading }) => {
  return (
    <Box sx={{ p: 3, minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box
        sx={{
          position: 'relative',
          width: 96,
          height: 96,
          mb: 2,
          '&:hover .avatar-overlay': { opacity: 1 }
        }}
      >
        <Avatar src={avatarUrl} sx={{ bgcolor: '#894991', width: '100%', height: '100%' }}>
          {(!avatarUrl) && (
            <>{givenName.charAt(0)}{familyName.charAt(0)}</>
          )}
        </Avatar>
        {onChangePhoto && (
          <Box
            role="button"
            aria-label="Changer la photo de profil"
            tabIndex={0}
            onClick={uploading ? undefined : onChangePhoto}
            onKeyDown={(e) => { if (!uploading && (e.key === 'Enter' || e.key === ' ')) onChangePhoto(); }}
            className="avatar-overlay"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.4)',
              color: '#fff',
              borderRadius: '50%',
              cursor: uploading ? 'default' : 'pointer',
              opacity: uploading ? 1 : 0,
              transition: 'opacity 0.2s ease'
            }}
          >
            {uploading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : <PhotoCameraIcon />}
          </Box>
        )}
      </Box>
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