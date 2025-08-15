"use client";
import React, { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Cropper, { Area } from 'react-easy-crop';
import { getCroppedImage } from '@/utils/cropImage';

interface AvatarCropOverlayProps {
  open: boolean;
  imageUrl: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

const AvatarCropOverlay: React.FC<AvatarCropOverlayProps> = ({ open, imageUrl, onCancel, onSave }) => {
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImage(imageUrl, {
      x: croppedAreaPixels.x,
      y: croppedAreaPixels.y,
      width: croppedAreaPixels.width,
      height: croppedAreaPixels.height,
    });
    onSave(blob);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Recadrer la photo</DialogTitle>
      <DialogContent>
        <Box sx={{ position: 'relative', width: '100%', height: 360, bgcolor: '#000', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onZoomChange={setZoom}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            cropShape="round"
            showGrid={false}
          />
        </Box>
        <Box sx={{ px: 1 }}>
          <Slider value={zoom} onChange={(_, v) => setZoom(v as number)} min={1} max={4} step={0.01} aria-label="Zoom" />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Annuler</Button>
        <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#894991', '&:hover': { bgcolor: '#6a3a7a' } }}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AvatarCropOverlay;
