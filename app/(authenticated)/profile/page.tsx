"use client";
import React, { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUrl, uploadData } from 'aws-amplify/storage';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Profile from '@/components/Profile';
import AvatarCropOverlay from '@/components/AvatarCropOverlay';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [group, setGroup] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  // Identity scoping is handled by Amplify Storage when using accessLevel: 'protected'

  useEffect(() => {
    (async () => {
      try {
  const { tokens } = await fetchAuthSession();
        const payload: any = tokens?.idToken?.payload ?? {};
        setEmail(payload?.email || '');
        setGivenName(payload?.given_name || payload?.givenName || '');
        setFamilyName(payload?.family_name || payload?.familyName || '');
        // Cognito groups usually come under 'cognito:groups'
  const rawGroups = (payload?.['cognito:groups'] ?? payload?.groups ?? payload?.group) as string | string[] | undefined;
  const groups = Array.isArray(rawGroups) ? rawGroups : (rawGroups ? [rawGroups] : []);
  // Debug log: print groups to help diagnose membership
  // This logs in the browser console when opening /profile
  // Example: ["admins", "managers"]
  console.log('User groups (from ID token):', groups);
  setGroup(groups.join(', ') || 'Utilisateur');

        // Try to fetch current avatar from protected storage
        try {
          // Use storage-relative key; Amplify scopes to identity for protected level
          const key = `profile/avatar`;
          const { url } = await getUrl({ key, options: { accessLevel: 'protected', expiresIn: 300 } });
          setAvatarUrl(url.toString());
        } catch {
          // no avatar yet
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChangePhoto = async () => {
    try {
      // Prompt a file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      const filePromise = new Promise<File | null>((resolve) => {
        input.onchange = () => {
          const file = input.files && input.files[0] ? input.files[0] : null;
          resolve(file);
        };
      });
      input.click();
      const file = await filePromise;
      if (!file) return;
      // Open cropper with object URL, then upload the cropped result
      const objUrl = URL.createObjectURL(file);
      setCropImageUrl(objUrl);
      setCropOpen(true);
    } catch (e) {
      console.error('Avatar upload failed', e);
    } finally {
      // uploading handled after crop save
    }
  };

  const handleCropSave = async (blob: Blob) => {
    try {
      setUploading(true);
      const key = `profile/avatar`;
      await uploadData({ key, data: blob, options: { accessLevel: 'protected', contentType: 'image/jpeg' } }).result;
      const { url } = await getUrl({ key, options: { accessLevel: 'protected', expiresIn: 300 } });
      setAvatarUrl(url.toString());
    } catch (e) {
      console.error('Avatar upload failed', e);
    } finally {
      setUploading(false);
      setCropOpen(false);
      if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
      setCropImageUrl(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display:'flex', justifyContent:'center', mt: 4 }}>
        <Profile
          email={email}
          givenName={givenName}
          familyName={familyName}
          group={group}
          avatarUrl={avatarUrl}
          uploading={uploading}
          onChangePhoto={handleChangePhoto}
        />
      </Box>
      {cropImageUrl && (
        <AvatarCropOverlay
          open={cropOpen}
          imageUrl={cropImageUrl}
          onCancel={() => { setCropOpen(false); if (cropImageUrl) URL.revokeObjectURL(cropImageUrl); setCropImageUrl(null); }}
          onSave={handleCropSave}
        />
      )}
    </>
  );
}
